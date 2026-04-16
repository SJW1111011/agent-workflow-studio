const fs = require("fs");
const path = require("path");
const {
  defaultCheckStatusForRunStatus,
  formatVerificationCheck,
  isVerifiedEvidence,
  normalizeEvidenceFreshnessStatus,
  normalizeArtifactRef,
  normalizeProofAnchors,
  normalizeProofPath,
  normalizeVerificationChecks,
} = require("./evidence-utils");
const { fileExists, readText } = require("./fs-utils");
const { buildProofAnchor, loadRepositorySnapshot } = require("./repository-snapshot");
const { parseManualProofItems } = require("./verification-proof");
const { taskFiles } = require("./workspace");

function loadRepositoryDiff(workspaceRoot, options = {}) {
  return loadRepositorySnapshot(workspaceRoot, options);
}

function buildTaskVerificationGate(workspaceRoot, taskMeta, runs = [], repositorySnapshot = null, taskText = null) {
  const files = taskFiles(workspaceRoot, taskMeta.id);
  const workspaceIndex = repositorySnapshot || loadRepositorySnapshot(workspaceRoot);
  const scopeBundle = collectTaskScopeHints(workspaceRoot, taskMeta, taskText === null ? readText(files.task, "") : taskText);
  const scopeHints = scopeBundle.hints;
  const verificationText = readText(files.verification, "");
  const latestRun = runs[runs.length - 1] || null;
  const taskCreatedAtMs = parseTime(taskMeta.createdAt || taskMeta.updatedAt);
  const latestRunAtMs = latestRun ? parseTime(latestRun.completedAt || latestRun.createdAt) : null;
  const verificationUpdatedAtMs = fileExists(files.verification) ? fs.statSync(files.verification).mtimeMs : null;
  const latestEvidenceAtMs = maxTime([latestRunAtMs, verificationUpdatedAtMs]);
  const proofCoverage = buildProofCoverage(verificationText, verificationUpdatedAtMs, runs);
  const scopedFiles = workspaceIndex.files
    .map((workspaceFile) => enrichMatchedFile(scopeHints, workspaceFile))
    .filter((workspaceFile) => workspaceFile.matchedBy.length > 0);
  const coveredScopedFiles = [];
  const relevantChangedFiles = [];
  const resolveCurrentProofAnchor = createCurrentProofAnchorResolver(workspaceRoot);

  scopedFiles.forEach((workspaceFile) => {
    const matchingProofItems = findMatchingProofItems(proofCoverage.validItems, workspaceFile.path);
    const proofAtMs = maxTime(matchingProofItems.map((item) => item.recordedAtMs));
    const baselineAtMs = maxTime([taskCreatedAtMs, proofAtMs]);
    const anchorCoverage = evaluateAnchorCoverage(workspaceFile, matchingProofItems, resolveCurrentProofAnchor);

    if (anchorCoverage.hasAnchors) {
      if (anchorCoverage.matched) {
        coveredScopedFiles.push(
          stripInternalFileFields(workspaceFile, proofAtMs, matchingProofItems, {
            proofFreshnessSource: "current",
          })
        );
      } else {
        relevantChangedFiles.push(
          stripInternalFileFields(workspaceFile, proofAtMs, matchingProofItems, {
            proofFreshnessSource: "outdated",
          })
        );
      }
      return;
    }

    if (hasScopedFileChangedSinceBaseline(workspaceFile, baselineAtMs)) {
      relevantChangedFiles.push(stripInternalFileFields(workspaceFile, proofAtMs, matchingProofItems));
      return;
    }

    if (isScopedFileCoveredByProof(workspaceFile, proofAtMs)) {
      coveredScopedFiles.push(
        stripInternalFileFields(workspaceFile, proofAtMs, matchingProofItems, {
          proofFreshnessSource: "recorded",
        })
      );
    }
  });

  if (scopeHints.length === 0) {
    const shouldWarnMissingScope = workspaceIndex.fileCount > 0 && (runs.length > 0 || taskMeta.status !== "todo");
    return {
      summary: {
        status: shouldWarnMissingScope ? "unconfigured" : "ready",
        message: shouldWarnMissingScope
          ? "This task has no repo-relative scope yet, so changed work cannot be matched to recorded evidence."
          : "Add repo-relative scope paths to make evidence coverage automatic.",
        relevantChangeCount: 0,
      },
      scopeHints,
      scopeCoverage: summarizeScopeCoverage(scopeBundle),
      relevantChangedFiles: [],
      coveredScopedFiles: [],
      repository: summarizeRepositoryDiff(workspaceIndex, scopedFiles.length),
      evidence: buildEvidenceSummary(latestRunAtMs, verificationUpdatedAtMs, latestEvidenceAtMs),
      proofCoverage: summarizeProofCoverage(proofCoverage),
    };
  }

  if (scopedFiles.length === 0) {
    return {
      summary: {
        status: "ready",
        message: "No current workspace files match this task's declared scope.",
        relevantChangeCount: 0,
      },
      scopeHints,
      scopeCoverage: summarizeScopeCoverage(scopeBundle),
      relevantChangedFiles: [],
      coveredScopedFiles: [],
      repository: summarizeRepositoryDiff(workspaceIndex, 0),
      evidence: buildEvidenceSummary(latestRunAtMs, verificationUpdatedAtMs, latestEvidenceAtMs),
      proofCoverage: summarizeProofCoverage(proofCoverage),
    };
  }

  if (relevantChangedFiles.length === 0) {
    return {
      summary: {
        status: coveredScopedFiles.length > 0 ? "covered" : "ready",
        message: coveredScopedFiles.length > 0
          ? "Recorded verification covers the current scoped file set."
          : "No scoped files have changed since this task was created.",
        relevantChangeCount: 0,
      },
      scopeHints,
      scopeCoverage: summarizeScopeCoverage(scopeBundle),
      relevantChangedFiles: [],
      coveredScopedFiles,
      repository: summarizeRepositoryDiff(workspaceIndex, scopedFiles.length),
      evidence: buildEvidenceSummary(latestRunAtMs, verificationUpdatedAtMs, latestEvidenceAtMs),
      proofCoverage: summarizeProofCoverage(proofCoverage),
    };
  }

  return {
    summary: {
      status: coveredScopedFiles.length > 0 ? "incomplete" : "action-required",
      message: coveredScopedFiles.length > 0
        ? "Some scoped files already have verified evidence, but newer scoped changes still need attention."
        : "Scoped files are newer than the latest verified evidence linked to this task.",
      relevantChangeCount: relevantChangedFiles.length,
    },
    scopeHints,
    scopeCoverage: summarizeScopeCoverage(scopeBundle),
    relevantChangedFiles,
    coveredScopedFiles,
    repository: summarizeRepositoryDiff(workspaceIndex, scopedFiles.length),
    evidence: buildEvidenceSummary(latestRunAtMs, verificationUpdatedAtMs, latestEvidenceAtMs),
    proofCoverage: summarizeProofCoverage(proofCoverage),
  };
}

function collectTaskScopeHints(workspaceRoot, taskMeta, taskText) {
  const hints = [];
  const ambiguousEntries = [];

  (Array.isArray(taskMeta.scope) ? taskMeta.scope : []).forEach((value) => {
    addScopeHints(hints, ambiguousEntries, workspaceRoot, value, "task.json", true);
  });

  extractScopeCandidatesFromMarkdown(taskText).forEach((candidate) => {
    addScopeHints(hints, ambiguousEntries, workspaceRoot, candidate.value, candidate.source, candidate.explicit);
  });

  const dedupedHints = new Map();
  hints.forEach((hint) => {
    const key = `${hint.pattern}::${hint.source}`;
    if (!dedupedHints.has(key)) {
      dedupedHints.set(key, hint);
    }
  });

  const dedupedAmbiguous = new Map();
  ambiguousEntries.forEach((entry) => {
    const key = `${entry.value}::${entry.source}`;
    if (!dedupedAmbiguous.has(key)) {
      dedupedAmbiguous.set(key, entry);
    }
  });

  return {
    hints: Array.from(dedupedHints.values()),
    ambiguousEntries: Array.from(dedupedAmbiguous.values()),
  };
}

function addScopeHints(target, ambiguousEntries, workspaceRoot, rawValue, source, explicit = false) {
  const patterns = extractPathPatterns(rawValue, workspaceRoot);
  patterns.forEach((pattern) => {
    target.push({ pattern, source });
  });

  if (patterns.length === 0 && explicit && String(rawValue || "").trim()) {
    ambiguousEntries.push({
      source,
      value: String(rawValue || "").trim(),
    });
  }
}

function extractScopeCandidatesFromMarkdown(taskText) {
  const scopeSection = getMarkdownSection(taskText, "Scope");
  if (!scopeSection) {
    return [];
  }

  const candidates = [];
  let currentLane = "generic";

  scopeSection.split(/\r?\n/).forEach((line) => {
    const normalizedLine = stripMarkdownDecorators(line);
    if (!normalizedLine) {
      return;
    }

    const lowerLine = normalizedLine.toLowerCase();
    if (lowerLine.startsWith("in scope:")) {
      currentLane = "in";
      const inlineValue = normalizedLine.slice("In scope:".length).trim();
      if (inlineValue) {
        candidates.push({
          value: inlineValue,
          source: "task.md",
          explicit: true,
        });
      }
      return;
    }

    if (lowerLine.startsWith("out of scope:")) {
      currentLane = "out";
      return;
    }

    if (currentLane === "out") {
      return;
    }

    candidates.push({
      value: normalizedLine,
      source: "task.md",
      explicit: currentLane === "in" || looksLikePathDirective(normalizedLine),
    });
  });

  return candidates;
}

function getMarkdownSection(content, title) {
  const normalized = String(content || "").replace(/\r\n/g, "\n");
  const pattern = new RegExp(`(?:^|\\n)## ${escapeRegex(title)}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = normalized.match(pattern);
  return match ? match[1].trim() : "";
}

function stripMarkdownDecorators(line) {
  return String(line || "")
    .replace(/^\s*[-*+]\s*/, "")
    .replace(/^\s*\d+\.\s*/, "")
    .trim();
}

function extractPathPatterns(value, workspaceRoot) {
  const text = String(value || "");
  const directiveValues = extractDirectiveValues(text);
  const backtickValues = Array.from(text.matchAll(/`([^`]+)`/g)).map((match) => match[1]);
  const regexValues = text.match(/(?:\.{0,2}\/)?[A-Za-z0-9_.*-]+(?:[\\/][A-Za-z0-9_.*\-]+)+\/?/g) || [];
  const fallbackToken = sanitizeScopeToken(text);
  const candidates = []
    .concat(directiveValues)
    .concat(backtickValues)
    .concat(regexValues)
    .concat(regexValues.length === 0 && directiveValues.length === 0 && backtickValues.length === 0 && fallbackToken ? [fallbackToken] : []);

  return candidates
    .map((candidate) => normalizeScopePattern(candidate, workspaceRoot))
    .filter(Boolean);
}

function extractDirectiveValues(text) {
  const directiveMatch = String(text || "").match(/^(?:repo\s+)?(?:path|paths|file|files|dir|dirs|directory|directories)\s*:\s*(.+)$/i);
  if (!directiveMatch) {
    return [];
  }

  return directiveMatch[1]
    .split(/[;,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function sanitizeScopeToken(value) {
  const cleaned = String(value || "")
    .replace(/[`"'()[\],]/g, " ")
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0];

  return cleaned || "";
}

function normalizeScopePattern(value, workspaceRoot) {
  let pattern = String(value || "")
    .replace(/[`"']/g, "")
    .replace(/[),.;:]+$/, "")
    .replace(/\\/g, "/")
    .trim();

  if (!pattern) {
    return null;
  }

  if (path.isAbsolute(pattern) || /^[A-Za-z]:/.test(pattern)) {
    return null;
  }

  pattern = pattern.replace(/^\.\//, "");

  if (!pattern.includes("/") && !pattern.includes("*")) {
    const absolutePath = path.join(workspaceRoot, pattern);
    if (!fileExists(absolutePath)) {
      return null;
    }

    if (fs.statSync(absolutePath).isDirectory()) {
      return `${pattern}/`;
    }

    return pattern;
  }

  if (!pattern.includes("*")) {
    const absolutePath = path.join(workspaceRoot, pattern.split("/").join(path.sep));
    if (fileExists(absolutePath) && fs.statSync(absolutePath).isDirectory() && !pattern.endsWith("/")) {
      return `${pattern}/`;
    }
  }

  return pattern;
}

function enrichMatchedFile(scopeHints, workspaceFile) {
  return {
    ...workspaceFile,
    matchedBy: scopeHints.filter((hint) => matchesScopePattern(hint.pattern, workspaceFile.path)),
  };
}

function matchesScopePattern(pattern, filePath) {
  const normalizedPattern = String(pattern || "").replace(/\\/g, "/");
  const normalizedPath = String(filePath || "").replace(/\\/g, "/");

  if (!normalizedPattern || !normalizedPath) {
    return false;
  }

  if (normalizedPattern.includes("*")) {
    return globToRegExp(normalizedPattern).test(normalizedPath);
  }

  if (normalizedPattern.endsWith("/")) {
    return normalizedPath === normalizedPattern.slice(0, -1) || normalizedPath.startsWith(normalizedPattern);
  }

  return normalizedPath === normalizedPattern;
}

function globToRegExp(pattern) {
  let expression = "^";

  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];

    if (character === "*") {
      if (pattern[index + 1] === "*") {
        expression += ".*";
        index += 1;
      } else {
        expression += "[^/]*";
      }
    } else {
      expression += escapeRegex(character);
    }
  }

  expression += "$";
  return new RegExp(expression);
}

function hasScopedFileChangedSinceBaseline(workspaceFile, baselineAtMs) {
  if (!baselineAtMs) {
    return true;
  }

  if (!Number.isFinite(workspaceFile.modifiedAtMs)) {
    return true;
  }

  return workspaceFile.modifiedAtMs > baselineAtMs;
}

function isScopedFileCoveredByProof(workspaceFile, proofAtMs) {
  return Number.isFinite(proofAtMs) && Number.isFinite(workspaceFile.modifiedAtMs) && proofAtMs >= workspaceFile.modifiedAtMs;
}

function buildEvidenceSummary(latestRunAtMs, verificationUpdatedAtMs, latestEvidenceAtMs) {
  return {
    latestRunAt: latestRunAtMs ? new Date(latestRunAtMs).toISOString() : null,
    verificationUpdatedAt: verificationUpdatedAtMs ? new Date(verificationUpdatedAtMs).toISOString() : null,
    latestEvidenceAt: latestEvidenceAtMs ? new Date(latestEvidenceAtMs).toISOString() : null,
  };
}

function summarizeRepositoryDiff(workspaceIndex, scopedFileCount) {
  return {
    available: workspaceIndex.available,
    mode: workspaceIndex.mode || "filesystem",
    headCommit: workspaceIndex.headCommit || null,
    fileCount: workspaceIndex.fileCount || 0,
    scopedFileCount,
  };
}

function summarizeScopeCoverage(scopeBundle) {
  return {
    hintCount: scopeBundle.hints.length,
    ambiguousCount: scopeBundle.ambiguousEntries.length,
    ambiguousEntries: scopeBundle.ambiguousEntries,
  };
}

function stripInternalFileFields(workspaceFile, proofAtMs, proofItems = [], options = {}) {
  return {
    path: workspaceFile.path,
    modifiedAt: workspaceFile.modifiedAt,
    changeType: workspaceFile.changeType || "modified",
    gitState: workspaceFile.gitState || null,
    previousPath: workspaceFile.previousPath || null,
    matchedBy: workspaceFile.matchedBy,
    proofUpdatedAt: proofAtMs ? new Date(proofAtMs).toISOString() : null,
    proofFreshnessSource: normalizeEvidenceFreshnessStatus(options.proofFreshnessSource) || null,
    proofItems: proofItems.map(summarizeProofItem),
  };
}

function createCurrentProofAnchorResolver(workspaceRoot) {
  const cache = new Map();

  return (workspaceFile) => {
    const cacheKey = String(workspaceFile && workspaceFile.path ? workspaceFile.path : "");
    if (!cacheKey) {
      return null;
    }

    if (!cache.has(cacheKey)) {
      cache.set(cacheKey, buildProofAnchor(workspaceRoot, workspaceFile.path, workspaceFile));
    }

    return cache.get(cacheKey);
  };
}

function evaluateAnchorCoverage(workspaceFile, proofItems, resolveCurrentProofAnchor) {
  const anchoredItems = (Array.isArray(proofItems) ? proofItems : []).filter(
    (item) => Array.isArray(item.anchors) && item.anchors.some((anchor) => matchesScopePattern(anchor.path, workspaceFile.path))
  );
  if (anchoredItems.length === 0) {
    return {
      hasAnchors: false,
      matched: false,
    };
  }

  const currentAnchor = resolveCurrentProofAnchor(workspaceFile);
  const matched = anchoredItems.some((item) => {
    return item.anchors.some((anchor) => matchesProofAnchor(anchor, currentAnchor));
  });

  return {
    hasAnchors: true,
    matched,
  };
}

function matchesProofAnchor(anchor, currentAnchor) {
  if (!anchor || !currentAnchor || anchor.path !== currentAnchor.path) {
    return false;
  }

  let comparedFieldCount = 0;

  if (isNonEmptyString(anchor.gitState) && isNonEmptyString(currentAnchor.gitState)) {
    comparedFieldCount += 1;
    if (anchor.gitState !== currentAnchor.gitState) {
      return false;
    }
  }

  if (isNonEmptyString(anchor.previousPath) && isNonEmptyString(currentAnchor.previousPath)) {
    comparedFieldCount += 1;
    if (anchor.previousPath !== currentAnchor.previousPath) {
      return false;
    }
  }

  if (typeof anchor.exists === "boolean" && typeof currentAnchor.exists === "boolean") {
    comparedFieldCount += 1;
    if (anchor.exists !== currentAnchor.exists) {
      return false;
    }
  }

  if (isNonEmptyString(anchor.contentFingerprint) && isNonEmptyString(currentAnchor.contentFingerprint)) {
    comparedFieldCount += 1;
    if (anchor.contentFingerprint !== currentAnchor.contentFingerprint) {
      return false;
    }
  }

  return comparedFieldCount > 0;
}

function buildProofCoverage(verificationText, verificationUpdatedAtMs, runs) {
  const manualProofItems = parseManualProofItems(verificationText, verificationUpdatedAtMs);
  const runProofItems = buildRunProofItems(runs);
  const validItems = [];
  const draftItems = [];

  manualProofItems.concat(runProofItems).forEach((item) => {
    if (isVerifiedProofItem(item)) {
      validItems.push(item);
    } else {
      draftItems.push(item);
    }
  });

  return {
    items: validItems.concat(draftItems),
    validItems,
    draftItems,
    weakItems: draftItems,
  };
}

function summarizeProofCoverage(proofCoverage) {
  const proofItems = proofCoverage.items.map(summarizeProofItem);
  const verifiedItems = proofItems.filter((item) => item.verified);

  return {
    explicitProofCount: proofCoverage.validItems.length,
    verifiedEvidenceCount: proofCoverage.validItems.length,
    weakProofCount: proofCoverage.draftItems.length,
    draftEvidenceCount: proofCoverage.draftItems.length,
    anchoredStrongProofCount: verifiedItems.filter((item) => item.anchorCount > 0).length,
    currentVerifiedEvidenceCount: verifiedItems.filter((item) => item.anchorCount > 0).length,
    compatibilityStrongProofCount: verifiedItems.filter((item) => item.anchorCount === 0).length,
    recordedVerifiedEvidenceCount: verifiedItems.filter((item) => item.anchorCount === 0).length,
    items: proofItems,
  };
}

function buildRunProofItems(runs) {
  return (Array.isArray(runs) ? runs : [])
    .filter((run) => run && run.status === "passed" && Array.isArray(run.scopeProofPaths) && run.scopeProofPaths.length > 0)
    .map((run) => {
      const proofPaths = uniqueStrings((run.scopeProofPaths || []).map(normalizeProofPath).filter(Boolean));
      const verificationChecks = normalizeVerificationChecks(
        run.verificationChecks,
        defaultCheckStatusForRunStatus(run.status)
      );
      const proofArtifacts = [
        run.stdoutFile,
        run.stderrFile,
        run.promptFile,
        run.runRequestFile,
        run.launchPackFile,
        ...(Array.isArray(run.verificationArtifacts) ? run.verificationArtifacts : []),
      ]
        .map(normalizeArtifactRef)
        .filter(Boolean);

      return {
        sourceType: "run",
        sourceLabel: run.id,
        recordedAtMs: parseTime(run.completedAt || run.createdAt),
        paths: proofPaths,
        anchors: normalizeProofAnchors(run.scopeProofAnchors).filter((anchor) =>
          proofPaths.some((proofPath) => matchesScopePattern(proofPath, anchor.path))
        ),
        checks:
          verificationChecks.length > 0
            ? uniqueStrings(verificationChecks.map((item) => formatVerificationCheck(item)).filter(Boolean))
            : uniqueStrings([run.summary].filter(Boolean)),
        artifacts: uniqueStrings(proofArtifacts),
      };
    })
    .filter(hasAnyProofData);
}

function hasAnyProofData(item) {
  return item.paths.length > 0 || item.checks.length > 0 || item.artifacts.length > 0;
}

function isVerifiedProofItem(item) {
  return Boolean(item && item.recordedAtMs && isVerifiedEvidence(item));
}

function findMatchingProofItems(items, filePath) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item.paths.some((pattern) => matchesScopePattern(pattern, filePath)))
    .sort((left, right) => left.recordedAtMs - right.recordedAtMs);
}

function summarizeProofItem(item) {
  const verified = isVerifiedProofItem(item);
  return {
    sourceType: item.sourceType,
    sourceLabel: item.sourceLabel,
    recordedAt: item.recordedAtMs ? new Date(item.recordedAtMs).toISOString() : null,
    paths: item.paths,
    anchorCount: Array.isArray(item.anchors) ? item.anchors.length : 0,
    checks: item.checks,
    artifacts: item.artifacts,
    verified,
    strong: verified,
  };
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

function parseTime(value) {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function maxTime(values) {
  const filtered = values.filter((value) => Number.isFinite(value));
  return filtered.length > 0 ? Math.max(...filtered) : null;
}

function escapeRegex(value) {
  return String(value || "").replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function looksLikePathDirective(value) {
  return /^(?:repo\s+)?(?:path|paths|file|files|dir|dirs|directory|directories)\s*:/i.test(String(value || "").trim());
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

module.exports = {
  buildTaskVerificationGate,
  loadRepositoryDiff,
  loadRepositorySnapshot: loadRepositoryDiff,
};
