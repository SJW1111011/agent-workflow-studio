(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  root.AgentWorkflowDashboardDocumentHelpers = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const CHECK_STATUSES = new Set(["passed", "failed", "recorded", "info"]);

  const EDITABLE_DOCUMENTS = {
    "task.md": {
      detailField: "taskText",
      note: "Task title and managed recipe block stay synced from task.json. Use repo-relative paths in Scope for stronger verification gates.",
      managedSections: [
        "Heading from task id/title",
        "Recipe block from task.json and the active recipe",
      ],
      freeSections: [
        "Goal",
        "Scope",
        "Required docs",
        "Deliverables",
        "Risks",
      ],
    },
    "context.md": {
      detailField: "contextText",
      note: "Managed recipe guidance and priority constraints stay synced from task.json.",
      managedSections: [
        "Heading from task id",
        "Recipe guidance block from the active recipe",
        "Priority and workflow reminder lines inside Constraints",
      ],
      freeSections: [
        "Why now",
        "Facts",
        "Open questions",
        "Any extra custom constraints",
      ],
    },
    "verification.md": {
      detailField: "verificationText",
      note: "Run evidence can still append to verification.md after edits. Use Proof links with repo-relative files plus check/result/artifact refs for stronger coverage. The draft shortcut can add planned manual checks and file-only Proof links, but it still stays non-authoritative until you complete the proof.",
      managedSections: ["Heading from task id"],
      freeSections: [
        "Planned checks",
        "Proof links",
        "Blocking gaps",
        "Any manual notes between evidence refreshes",
      ],
    },
  };

  function parseRunEvidenceDraft(values = {}) {
    const status = String(values.status || "draft").trim().toLowerCase();
    const scopeProofPaths = parseRepoRelativeList(values.scopeProofPaths || values.proofPaths || "");
    const verificationArtifacts = parseRepoRelativeList(values.verificationArtifacts || values.artifacts || "");
    const verificationChecks = parseRunChecks(values.verificationChecks || values.checks || "", status);

    return omitEmptyEvidenceFields({
      scopeProofPaths,
      verificationChecks,
      verificationArtifacts,
    });
  }

  function parseRunChecks(text, runStatus) {
    const fallbackStatus = defaultCheckStatusForRun(runStatus);
    return splitLineEntries(text)
      .map((line) => parseRunCheckLine(line, fallbackStatus))
      .filter(Boolean);
  }

  function parseRunCheckLine(line, fallbackStatus) {
    const parts = String(line || "")
      .split("|")
      .map((part) => part.trim())
      .filter(Boolean);

    if (parts.length === 0) {
      return null;
    }

    let status = fallbackStatus;
    let label = parts[0];
    let details;
    let artifacts = [];

    if (parts.length > 1 && CHECK_STATUSES.has(parts[0].toLowerCase())) {
      status = parts[0].toLowerCase();
      label = parts[1] || "";
      details = parts[2] || undefined;
      artifacts = parseLooseList(parts.slice(3).join("|"));
    } else {
      details = parts[1] || undefined;
      artifacts = parseLooseList(parts.slice(2).join("|"));
    }

    if (!label) {
      return null;
    }

    return omitUndefinedFields({
      label,
      status,
      details,
      artifacts: artifacts.length > 0 ? artifacts : undefined,
    });
  }

  function parseRepoRelativeList(text) {
    return uniqueStrings(parseLooseList(text));
  }

  function getPendingProofPaths(detail) {
    return uniqueStrings(
      detail && detail.verificationGate && Array.isArray(detail.verificationGate.relevantChangedFiles)
        ? detail.verificationGate.relevantChangedFiles.map((item) => item.path).filter(Boolean)
        : []
    );
  }

  function buildPendingProofCheckLines(detail) {
    return getPendingProofPaths(detail).map((item) => `Review ${item} diff`);
  }

  function mergeProofPathDraft(currentText, detail) {
    return uniqueStrings(parseRepoRelativeList(currentText).concat(getPendingProofPaths(detail))).join("\n");
  }

  function mergeProofCheckDraft(currentText, detail, runStatus) {
    const existingLines = splitLineEntries(currentText);
    const fallbackStatus = defaultCheckStatusForRun(String(runStatus || "").trim().toLowerCase());
    const existingLabels = new Set(
      existingLines
        .map((line) => parseRunCheckLine(line, fallbackStatus))
        .filter(Boolean)
        .map((item) => item.label)
    );
    const nextLines = buildPendingProofCheckLines(detail).filter((line) => {
      const parsed = parseRunCheckLine(line, fallbackStatus);
      return parsed && !existingLabels.has(parsed.label);
    });

    return existingLines.concat(nextLines).join("\n");
  }

  function buildVerificationProofDraft(detail, currentText = "") {
    return buildVerificationProofDraftFromPaths(getPendingProofPaths(detail), currentText);
  }

  function buildVerificationProofDraftFromPaths(paths, currentText = "") {
    const existingPaths = extractVerificationProofPaths(currentText);
    const nextProofPaths = uniqueStrings(paths).filter((item) => item && !existingPaths.has(item));
    const nextProofNumber = getNextProofNumber(currentText);

    return nextProofPaths
      .map(
        (item, index) => `### Proof ${nextProofNumber + index}

- Files: ${item}
- Check:
- Result:
- Artifact:`
      )
      .join("\n\n");
  }

  function buildVerificationPlannedCheckDraft(detail, currentText = "") {
    const existingChecks = extractVerificationPlannedManualChecks(currentText);

    return buildPendingProofCheckLines(detail)
      .filter((item) => !existingChecks.has(item))
      .map((item) => `- manual: ${item}`)
      .join("\n");
  }

  function parseRunVerificationDraft(values = {}) {
    const status = String(values.status || "draft").trim().toLowerCase();
    return {
      status,
      scopeProofPaths: parseRepoRelativeList(values.scopeProofPaths || values.proofPaths || ""),
      verificationChecks: parseRunChecks(values.verificationChecks || values.checks || "", status),
    };
  }

  function buildVerificationPlannedCheckDraftFromRunDraft(values = {}, currentText = "") {
    const existingChecks = extractVerificationPlannedManualChecks(currentText);
    const runDraft = parseRunVerificationDraft(values);

    return runDraft.verificationChecks
      .map((item) => formatVerificationPlannedCheck(item))
      .filter(Boolean)
      .filter((item) => !existingChecks.has(item))
      .map((item) => `- manual: ${item}`)
      .join("\n");
  }

  function formatVerificationPlannedCheck(check) {
    if (!check || !check.label) {
      return "";
    }

    return check.details ? `${check.label} - ${check.details}` : check.label;
  }

  function mergeVerificationPlannedCheckDraft(currentText, detail) {
    const draftLines = buildVerificationPlannedCheckDraft(detail, currentText);
    return mergeVerificationPlannedCheckLines(currentText, draftLines);
  }

  function mergeVerificationPlannedCheckLines(currentText, draftLines) {
    const normalized = String(currentText || "").replace(/\r\n/g, "\n").trim();

    if (!draftLines) {
      return normalized;
    }

    if (!normalized) {
      return `## Planned checks\n\n${draftLines}`;
    }

    const plannedRange = findMarkdownSectionRange(normalized, "Planned checks");
    if (plannedRange) {
      const existingBody = normalized.slice(plannedRange.bodyStart, plannedRange.end).trim();
      const mergedSection = `## Planned checks\n\n${[existingBody, draftLines].filter(Boolean).join("\n")}`;
      return [normalized.slice(0, plannedRange.start).trimEnd(), mergedSection, normalized.slice(plannedRange.end).trimStart()]
        .filter(Boolean)
        .join("\n\n");
    }

    const proofRange = findMarkdownSectionRange(normalized, "Proof links") || findMarkdownSectionRange(normalized, "Proof Links");
    if (proofRange) {
      const plannedSection = `## Planned checks\n\n${draftLines}`;
      return [normalized.slice(0, proofRange.start).trimEnd(), plannedSection, normalized.slice(proofRange.start).trimStart()]
        .filter(Boolean)
        .join("\n\n");
    }

    return `${normalized}\n\n## Planned checks\n\n${draftLines}`;
  }

  function mergeVerificationProofDraft(currentText, detail) {
    return mergeVerificationProofDraftFromPaths(currentText, getPendingProofPaths(detail));
  }

  function mergeVerificationProofDraftFromPaths(currentText, paths) {
    const draftBlocks = buildVerificationProofDraftFromPaths(paths, currentText);
    const normalized = String(currentText || "").replace(/\r\n/g, "\n").trim();

    if (!draftBlocks) {
      return normalized;
    }

    if (!normalized) {
      return `## Proof links\n\n${draftBlocks}`;
    }

    const proofRange = findMarkdownSectionRange(normalized, "Proof links") || findMarkdownSectionRange(normalized, "Proof Links");
    if (proofRange) {
      const existingBody = normalized.slice(proofRange.bodyStart, proofRange.end).trim();
      const mergedSection = `## ${proofRange.title}\n\n${[existingBody, draftBlocks].filter(Boolean).join("\n\n")}`;
      return [normalized.slice(0, proofRange.start).trimEnd(), mergedSection, normalized.slice(proofRange.end).trimStart()]
        .filter(Boolean)
        .join("\n\n");
    }

    const blockingRange = findMarkdownSectionRange(normalized, "Blocking gaps");
    if (blockingRange) {
      const proofSection = `## Proof links\n\n${draftBlocks}`;
      return [normalized.slice(0, blockingRange.start).trimEnd(), proofSection, normalized.slice(blockingRange.start).trimStart()]
        .filter(Boolean)
        .join("\n\n");
    }

    return `${normalized}\n\n## Proof links\n\n${draftBlocks}`;
  }

  function mergeVerificationProofPlanDraft(currentText, detail) {
    return mergeVerificationProofDraft(mergeVerificationPlannedCheckDraft(currentText, detail), detail);
  }

  function mergeVerificationFromRunDraft(currentText, values = {}) {
    const normalized = String(currentText || "").replace(/\r\n/g, "\n").trim();
    const runDraft = parseRunVerificationDraft(values);
    const plannedDraft = buildVerificationPlannedCheckDraftFromRunDraft(values, normalized);
    const withPlannedChecks = mergeVerificationPlannedCheckLines(normalized, plannedDraft);
    return mergeVerificationProofDraftFromPaths(withPlannedChecks, runDraft.scopeProofPaths);
  }

  function hasRunDraftVerificationContent(values = {}) {
    const runDraft = parseRunVerificationDraft(values);
    return runDraft.scopeProofPaths.length > 0 || runDraft.verificationChecks.length > 0;
  }

  function extractVerificationProofPaths(text) {
    const proofSection = getMarkdownSection(text, "Proof links") || getMarkdownSection(text, "Proof Links");
    const proofPaths = new Set();

    splitLineEntries(proofSection).forEach((line) => {
      const normalized = String(line || "").replace(/^\s*[-*+]\s*/, "").trim();
      if (/^(?:files?|paths?)\s*:/i.test(normalized)) {
        const value = normalized.slice(normalized.indexOf(":") + 1).trim();
        parseRepoRelativeList(value).forEach((item) => {
          proofPaths.add(item);
        });
      }
    });

    return proofPaths;
  }

  function extractVerificationPlannedManualChecks(text) {
    const plannedSection = getMarkdownSection(text, "Planned checks");
    const plannedChecks = new Set();

    splitLineEntries(plannedSection).forEach((line) => {
      const normalized = String(line || "").replace(/^\s*[-*+]\s*/, "").trim();
      if (/^manual\s*:/i.test(normalized)) {
        const value = normalized.slice(normalized.indexOf(":") + 1).trim();
        if (value) {
          plannedChecks.add(value);
        }
      }
    });

    return plannedChecks;
  }

  function getNextProofNumber(text) {
    const matches = Array.from(String(text || "").matchAll(/^###\s+Proof\s+(\d+)/gm));
    if (matches.length === 0) {
      return 1;
    }

    const maxValue = matches.reduce((current, match) => {
      const numeric = Number(match[1]);
      return Number.isFinite(numeric) && numeric > current ? numeric : current;
    }, 0);
    return maxValue + 1;
  }

  function getMarkdownSection(text, title) {
    const range = findMarkdownSectionRange(text, title);
    return range ? String(text || "").replace(/\r\n/g, "\n").slice(range.bodyStart, range.end).trim() : "";
  }

  function findMarkdownSectionRange(text, title) {
    const normalized = String(text || "").replace(/\r\n/g, "\n");
    if (!normalized.trim()) {
      return null;
    }

    const lines = normalized.split("\n");
    const headingLine = `## ${title}`;
    const lineOffsets = [];
    let offset = 0;

    lines.forEach((line) => {
      lineOffsets.push(offset);
      offset += line.length + 1;
    });

    const startLine = lines.findIndex((line) => line.trim() === headingLine);
    if (startLine === -1) {
      return null;
    }

    let endLine = lines.length;
    for (let index = startLine + 1; index < lines.length; index += 1) {
      if (lines[index].startsWith("## ")) {
        endLine = index;
        break;
      }
    }

    const start = lineOffsets[startLine];
    const bodyStart = start + lines[startLine].length + 1;
    const end = endLine < lines.length ? lineOffsets[endLine] - 1 : normalized.length;

    return {
      title,
      start,
      bodyStart: Math.min(bodyStart, normalized.length),
      end: Math.max(bodyStart, end),
    };
  }

  function parseLooseList(text) {
    return String(text || "")
      .split(/\r?\n/)
      .flatMap((line) => line.split(/[;,]/))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }

  function splitLineEntries(text) {
    return String(text || "")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  function defaultCheckStatusForRun(status) {
    if (status === "passed") {
      return "passed";
    }
    if (status === "failed") {
      return "failed";
    }
    return "recorded";
  }

  function uniqueStrings(values) {
    return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
  }

  function omitUndefinedFields(value) {
    return Object.fromEntries(Object.entries(value || {}).filter(([, item]) => item !== undefined));
  }

  function omitEmptyEvidenceFields(value) {
    return Object.fromEntries(
      Object.entries(value || {}).filter(([, item]) => {
        if (Array.isArray(item)) {
          return item.length > 0;
        }

        return item !== undefined;
      })
    );
  }

  function extractVerificationPlannedChecks(text) {
    return splitLineEntries(getMarkdownSection(text, "Planned checks"))
      .map((line) => normalizeVerificationPlannedCheckLine(line))
      .filter(Boolean);
  }

  function normalizeVerificationPlannedCheckLine(line) {
    const normalized = String(line || "").replace(/^\s*[-*+]\s*/, "").trim();
    if (!normalized) {
      return "";
    }

    const labeledMatch = normalized.match(/^(automated|manual)\s*:\s*(.*)$/i);
    if (labeledMatch) {
      const value = String(labeledMatch[2] || "").trim();
      return value ? `${labeledMatch[1].toLowerCase()}: ${value}` : "";
    }

    return normalized;
  }

  function describeVerificationProofSignals(verificationGate, verificationText = "") {
    const proofCoverage = verificationGate && verificationGate.proofCoverage ? verificationGate.proofCoverage : {};
    const items = Array.isArray(proofCoverage.items) ? proofCoverage.items : [];
    const strongItems = items.filter((item) => item && item.strong);
    const weakItems = items.filter((item) => item && !item.strong);
    const plannedChecks = extractVerificationPlannedChecks(verificationText);

    let presentation;
    if (strongItems.length > 0 && weakItems.length > 0) {
      presentation = {
        tone: "draft",
        headline: "Some proof is strong, some is still draft",
        summary: "Strong proof exists, but draft placeholders still need explicit checks, results, or artifact refs.",
      };
    } else if (weakItems.length > 0) {
      presentation = {
        tone: "draft",
        headline: "Draft proof does not satisfy the gate yet",
        summary: "Proof links without enough check/result/artifact detail stay non-authoritative.",
      };
    } else if (strongItems.length > 0 && plannedChecks.length > 0) {
      presentation = {
        tone: "passed",
        headline: "Strong proof recorded; planned checks remain notes",
        summary: "Planned checks can stay as reminders, but only strong proof satisfies the verification gate.",
      };
    } else if (strongItems.length > 0) {
      presentation = {
        tone: "passed",
        headline: "Strong proof recorded",
        summary: "Repo-relative paths are explicitly linked to checks or artifacts.",
      };
    } else if (plannedChecks.length > 0) {
      presentation = {
        tone: "pending",
        headline: "Planned checks are not proof yet",
        summary: "Verification plans are helpful, but they do not count until backed by explicit proof.",
      };
    } else {
      presentation = {
        tone: "idle",
        headline: "No explicit proof recorded",
        summary: "Add planned checks or strong proof items to make verification intent and coverage visible.",
      };
    }

    return {
      plannedChecks,
      strongItems,
      weakItems,
      presentation,
    };
  }

  function getEditableDocumentConfig(documentName) {
    return EDITABLE_DOCUMENTS[documentName] || EDITABLE_DOCUMENTS["task.md"];
  }

  return {
    buildPendingProofCheckLines,
    buildVerificationPlannedCheckDraft,
    buildVerificationPlannedCheckDraftFromRunDraft,
    buildVerificationProofDraft,
    buildVerificationProofDraftFromPaths,
    describeVerificationProofSignals,
    EDITABLE_DOCUMENTS,
    extractVerificationPlannedChecks,
    extractVerificationPlannedManualChecks,
    extractVerificationProofPaths,
    findMarkdownSectionRange,
    formatVerificationPlannedCheck,
    getEditableDocumentConfig,
    getMarkdownSection,
    getNextProofNumber,
    getPendingProofPaths,
    hasRunDraftVerificationContent,
    mergeProofCheckDraft,
    mergeProofPathDraft,
    mergeVerificationFromRunDraft,
    mergeVerificationPlannedCheckDraft,
    mergeVerificationProofDraft,
    mergeVerificationProofPlanDraft,
    normalizeVerificationPlannedCheckLine,
    parseLooseList,
    parseRepoRelativeList,
    parseRunCheckLine,
    parseRunChecks,
    parseRunEvidenceDraft,
    parseRunVerificationDraft,
    splitLineEntries,
  };
});
