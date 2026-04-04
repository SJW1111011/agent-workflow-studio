const fs = require("fs");
const path = require("path");
const {
  defaultCheckStatusForRunStatus,
  formatVerificationCheck,
  normalizeArtifactRef,
  normalizeProofPath,
  normalizeVerificationChecks,
} = require("./evidence-utils");
const { fileExists, readText } = require("./fs-utils");
const { taskFiles } = require("./workspace");

function loadRepositoryDiff(workspaceRoot) {
  const files = walkWorkspaceFiles(workspaceRoot);
  return {
    available: true,
    fileCount: files.length,
    files,
  };
}

function buildTaskVerificationGate(workspaceRoot, taskMeta, runs = [], repositoryDiff = null, taskText = null) {
  const files = taskFiles(workspaceRoot, taskMeta.id);
  const workspaceIndex = repositoryDiff || loadRepositoryDiff(workspaceRoot);
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

  scopedFiles.forEach((workspaceFile) => {
    const matchingProofItems = findMatchingProofItems(proofCoverage.validItems, workspaceFile.path);
    const proofAtMs = maxTime(matchingProofItems.map((item) => item.recordedAtMs));
    const baselineAtMs = maxTime([taskCreatedAtMs, proofAtMs]);

    if (!baselineAtMs || workspaceFile.modifiedAtMs > baselineAtMs) {
      relevantChangedFiles.push(stripInternalFileFields(workspaceFile, proofAtMs, matchingProofItems));
      return;
    }

    if (proofAtMs && proofAtMs >= workspaceFile.modifiedAtMs) {
      coveredScopedFiles.push(stripInternalFileFields(workspaceFile, proofAtMs, matchingProofItems));
    }
  });

  if (scopeHints.length === 0) {
    const shouldWarnMissingScope = workspaceIndex.fileCount > 0 && (runs.length > 0 || taskMeta.status !== "todo");
    return {
      summary: {
        status: shouldWarnMissingScope ? "scope-missing" : "ready",
        message: shouldWarnMissingScope
          ? "This task has no repo-relative scope hints yet, so changed work cannot be tied to explicit proof."
          : "Add explicit repo-relative paths in the task scope to enable stronger verification gates.",
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
          ? "Explicit verification now covers the current scoped file set."
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
      status: coveredScopedFiles.length > 0 ? "partially-covered" : "needs-proof",
      message: coveredScopedFiles.length > 0
        ? "Some scoped files are explicitly covered, but newer scoped changes still need proof."
        : "Scoped files are newer than the latest explicit proof linked in verification evidence.",
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

function walkWorkspaceFiles(workspaceRoot, relativeDir = "") {
  const directoryPath = relativeDir ? path.join(workspaceRoot, relativeDir) : workspaceRoot;

  return fs
    .readdirSync(directoryPath, { withFileTypes: true })
    .filter((entry) => entry.name !== ".git" && entry.name !== "node_modules")
    .flatMap((entry) => {
      const relativePath = relativeDir ? path.join(relativeDir, entry.name) : entry.name;

      if (entry.isDirectory()) {
        return walkWorkspaceFiles(workspaceRoot, relativePath);
      }

      if (!entry.isFile()) {
        return [];
      }

      const absolutePath = path.join(workspaceRoot, relativePath);
      const stats = fs.statSync(absolutePath);
      return [
        {
          path: relativePath.replace(/\\/g, "/"),
          modifiedAt: new Date(stats.mtimeMs).toISOString(),
          modifiedAtMs: stats.mtimeMs,
        },
      ];
    });
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
  const pattern = new RegExp(`^## ${escapeRegex(title)}\\n([\\s\\S]*?)(?=^## |\\Z)`, "m");
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

function stripInternalFileFields(workspaceFile, proofAtMs, proofItems = []) {
  return {
    path: workspaceFile.path,
    modifiedAt: workspaceFile.modifiedAt,
    changeType: "modified",
    matchedBy: workspaceFile.matchedBy,
    proofUpdatedAt: proofAtMs ? new Date(proofAtMs).toISOString() : null,
    proofItems: proofItems.map(summarizeProofItem),
  };
}

function buildProofCoverage(verificationText, verificationUpdatedAtMs, runs) {
  const manualProofItems = parseManualProofItems(stripEvidenceBlocks(verificationText), verificationUpdatedAtMs);
  const runProofItems = buildRunProofItems(runs);
  const validItems = [];
  const weakItems = [];

  manualProofItems.concat(runProofItems).forEach((item) => {
    if (isStrongProofItem(item)) {
      validItems.push(item);
    } else {
      weakItems.push(item);
    }
  });

  return {
    items: validItems.concat(weakItems),
    validItems,
    weakItems,
  };
}

function stripEvidenceBlocks(verificationText) {
  const normalized = String(verificationText || "").replace(/\r\n/g, "\n");
  const markerIndex = normalized.search(/(?:^|\n)## Evidence /m);
  return markerIndex >= 0 ? normalized.slice(0, markerIndex).trim() : normalized.trim();
}

function summarizeProofCoverage(proofCoverage) {
  return {
    explicitProofCount: proofCoverage.validItems.length,
    weakProofCount: proofCoverage.weakItems.length,
    items: proofCoverage.items.map(summarizeProofItem),
  };
}

function parseManualProofItems(verificationText, verificationUpdatedAtMs) {
  if (!verificationUpdatedAtMs) {
    return [];
  }

  const proofSection = getMarkdownSection(verificationText, "Proof links") || getMarkdownSection(verificationText, "Proof Links");
  if (!proofSection) {
    return [];
  }

  return splitProofBlocks(proofSection)
    .map((block, index) => parseProofBlock(block, {
      sourceType: "manual",
      sourceLabel: `verification.md#proof-${index + 1}`,
      recordedAtMs: verificationUpdatedAtMs,
    }))
    .filter(hasAnyProofData);
}

function splitProofBlocks(sectionText) {
  const normalized = String(sectionText || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return [];
  }

  if (/^### /m.test(normalized)) {
    return normalized
      .split(/^### .+$/m)
      .map((block) => block.trim())
      .filter(Boolean);
  }

  return [normalized];
}

function parseProofBlock(blockText, options) {
  const item = {
    sourceType: options.sourceType,
    sourceLabel: options.sourceLabel,
    recordedAtMs: options.recordedAtMs,
    paths: [],
    checks: [],
    artifacts: [],
  };
  let lastCheckIndex = -1;

  String(blockText || "")
    .split(/\r?\n/)
    .map((line) => stripMarkdownDecorators(line))
    .filter(Boolean)
    .forEach((line) => {
      const normalized = String(line).trim();
      const lower = normalized.toLowerCase();

      if (/^(?:files?|paths?)\s*:/.test(lower)) {
        extractProofPaths(normalized).forEach((proofPath) => {
          item.paths.push(proofPath);
        });
        return;
      }

      if (/^(?:check|checks|command|commands)\s*:/.test(lower)) {
        const value = normalized.slice(normalized.indexOf(":") + 1).trim();
        if (value) {
          item.checks.push(value);
          lastCheckIndex = item.checks.length - 1;
        }
        return;
      }

      if (/^(?:result|results?|status|outcome)\s*:/.test(lower)) {
        const value = normalized.slice(normalized.indexOf(":") + 1).trim();
        if (value) {
          if (lastCheckIndex >= 0) {
            item.checks[lastCheckIndex] = `${item.checks[lastCheckIndex]} (result: ${value})`;
          } else {
            item.checks.push(`result: ${value}`);
            lastCheckIndex = item.checks.length - 1;
          }
        }
        return;
      }

      if (/^(?:artifact|artifacts)\s*:/.test(lower)) {
        extractArtifactRefs(normalized.slice(normalized.indexOf(":") + 1).trim()).forEach((artifact) => {
          item.artifacts.push(artifact);
        });
      }
    });

  item.paths = uniqueStrings(item.paths);
  item.checks = uniqueStrings(item.checks);
  item.artifacts = uniqueStrings(item.artifacts);
  return item;
}

function buildRunProofItems(runs) {
  return (Array.isArray(runs) ? runs : [])
    .filter((run) => run && run.status === "passed" && Array.isArray(run.scopeProofPaths) && run.scopeProofPaths.length > 0)
    .map((run) => {
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
        paths: uniqueStrings((run.scopeProofPaths || []).map(normalizeProofPath).filter(Boolean)),
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

function isStrongProofItem(item) {
  return item.recordedAtMs && item.paths.length > 0 && (item.checks.length > 0 || item.artifacts.length > 0);
}

function findMatchingProofItems(items, filePath) {
  return (Array.isArray(items) ? items : [])
    .filter((item) => item.paths.some((pattern) => matchesScopePattern(pattern, filePath)))
    .sort((left, right) => left.recordedAtMs - right.recordedAtMs);
}

function summarizeProofItem(item) {
  return {
    sourceType: item.sourceType,
    sourceLabel: item.sourceLabel,
    recordedAt: item.recordedAtMs ? new Date(item.recordedAtMs).toISOString() : null,
    paths: item.paths,
    checks: item.checks,
    artifacts: item.artifacts,
    strong: isStrongProofItem(item),
  };
}

function extractProofPaths(text) {
  const directiveValues = extractDirectiveValues(text);
  const backtickValues = Array.from(String(text || "").matchAll(/`([^`]+)`/g)).map((match) => match[1]);
  const regexValues = String(text || "").match(/(?:\.{0,2}\/)?[A-Za-z0-9_.*-]+(?:[\\/][A-Za-z0-9_.*\-]+)+\/?/g) || [];

  return uniqueStrings(
    directiveValues
      .concat(backtickValues)
      .concat(regexValues)
      .map(normalizeProofPath)
      .filter(Boolean)
  );
}

function extractArtifactRefs(text) {
  const backtickValues = Array.from(String(text || "").matchAll(/`([^`]+)`/g)).map((match) => match[1]);
  const regexValues = String(text || "").match(/(?:\.{0,2}\/)?[A-Za-z0-9_.*-]+(?:[\\/][A-Za-z0-9_.*\-]+)+\/?/g) || [];
  const values = backtickValues.length > 0 ? backtickValues : regexValues.length > 0 ? regexValues : splitLooseValues(text);
  return uniqueStrings(values.map(normalizeArtifactRef).filter(Boolean));
}

function splitLooseValues(text) {
  return String(text || "")
    .split(/[;,]/)
    .map((value) => value.trim())
    .filter(Boolean);
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

module.exports = {
  buildTaskVerificationGate,
  loadRepositoryDiff,
};
