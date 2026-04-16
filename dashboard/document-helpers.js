(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  root.AgentWorkflowDashboardDocumentHelpers = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const CHECK_STATUSES = new Set(["passed", "failed", "recorded", "info"]);
  const VERIFICATION_MANUAL_PROOF_ANCHOR_BLOCK_ID = "verification-manual-proof-anchors";

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
      note: "Run evidence can still append to verification.md after edits. Use Verification records with repo-relative files plus check/result/artifact refs for verified coverage. The draft shortcut can add draft manual checks and file-only verification records, but they stay incomplete until you finish them. Refresh Verification Records only after saving the manual proof text you want to keep.",
      managedSections: [
        "Heading from task id",
        "Managed verification record block under Evidence after an explicit local refresh",
      ],
      freeSections: [
        "Draft checks",
        "Verification records",
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
        (item, index) => `### Record ${nextProofNumber + index}

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
      return `## Draft checks\n\n${draftLines}`;
    }

    const plannedRange = findMarkdownSectionRange(normalized, "Draft checks") || findMarkdownSectionRange(normalized, "Planned checks");
    if (plannedRange) {
      const existingBody = normalized.slice(plannedRange.bodyStart, plannedRange.end).trim();
      const mergedSection = `## Draft checks\n\n${[existingBody, draftLines].filter(Boolean).join("\n")}`;
      return [normalized.slice(0, plannedRange.start).trimEnd(), mergedSection, normalized.slice(plannedRange.end).trimStart()]
        .filter(Boolean)
        .join("\n\n");
    }

    const proofRange =
      findMarkdownSectionRange(normalized, "Verification records") ||
      findMarkdownSectionRange(normalized, "Proof links") ||
      findMarkdownSectionRange(normalized, "Proof Links");
    if (proofRange) {
      const plannedSection = `## Draft checks\n\n${draftLines}`;
      return [normalized.slice(0, proofRange.start).trimEnd(), plannedSection, normalized.slice(proofRange.start).trimStart()]
        .filter(Boolean)
        .join("\n\n");
    }

    return `${normalized}\n\n## Draft checks\n\n${draftLines}`;
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
      return `## Verification records\n\n${draftBlocks}`;
    }

    const proofRange =
      findMarkdownSectionRange(normalized, "Verification records") ||
      findMarkdownSectionRange(normalized, "Proof links") ||
      findMarkdownSectionRange(normalized, "Proof Links");
    if (proofRange) {
      const existingBody = normalized.slice(proofRange.bodyStart, proofRange.end).trim();
      const mergedSection = `## Verification records\n\n${[existingBody, draftBlocks].filter(Boolean).join("\n\n")}`;
      return [normalized.slice(0, proofRange.start).trimEnd(), mergedSection, normalized.slice(proofRange.end).trimStart()]
        .filter(Boolean)
        .join("\n\n");
    }

    const blockingRange = findMarkdownSectionRange(normalized, "Blocking gaps");
    if (blockingRange) {
      const proofSection = `## Verification records\n\n${draftBlocks}`;
      return [normalized.slice(0, blockingRange.start).trimEnd(), proofSection, normalized.slice(blockingRange.start).trimStart()]
        .filter(Boolean)
        .join("\n\n");
    }

    return `${normalized}\n\n## Verification records\n\n${draftBlocks}`;
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
    const proofSection =
      getMarkdownSection(text, "Verification records") ||
      getMarkdownSection(text, "Proof links") ||
      getMarkdownSection(text, "Proof Links");
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
    const plannedSection = getMarkdownSection(text, "Draft checks") || getMarkdownSection(text, "Planned checks");
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
    const matches = Array.from(String(text || "").matchAll(/^###\s+(?:Proof|Record)\s+(\d+)/gm));
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
    return splitLineEntries(getMarkdownSection(text, "Draft checks") || getMarkdownSection(text, "Planned checks"))
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
    const verifiedItems = items.filter((item) => item && (item.verified || item.strong));
    const draftItems = items.filter((item) => item && !(item.verified || item.strong));
    const draftChecks = extractVerificationPlannedChecks(verificationText);

    let presentation;
    if (verifiedItems.length > 0 && (draftItems.length > 0 || draftChecks.length > 0)) {
      presentation = {
        tone: "draft",
        headline: "Verified evidence recorded; draft items remain",
        summary: "Verified evidence exists, but some draft checks or draft evidence still need to be completed.",
      };
    } else if (draftItems.length > 0) {
      presentation = {
        tone: "draft",
        headline: "Draft evidence does not satisfy the gate yet",
        summary: "Verification records without enough check/result/artifact detail stay incomplete.",
      };
    } else if (draftChecks.length > 0) {
      presentation = {
        tone: verifiedItems.length > 0 ? "draft" : "pending",
        headline: verifiedItems.length > 0 ? "Draft checks remain after verification" : "Draft checks are not verification yet",
        summary: verifiedItems.length > 0
          ? "Draft checks can stay as reminders, but they still need to be completed before handoff."
          : "Draft checks are helpful, but they do not count until backed by explicit verification records.",
      };
    } else if (verifiedItems.length > 0) {
      presentation = {
        tone: "passed",
        headline: "Verified evidence recorded",
        summary: "Repo-relative paths are explicitly linked to checks or artifacts.",
      };
    } else {
      presentation = {
        tone: "idle",
        headline: "No explicit evidence recorded",
        summary: "Add draft checks or verified evidence to make verification intent and coverage visible.",
      };
    }

    return {
      draftChecks,
      plannedChecks: draftChecks,
      verifiedItems,
      strongItems: verifiedItems,
      draftItems,
      weakItems: draftItems,
      presentation,
    };
  }

  function getEditableDocumentConfig(documentName) {
    return EDITABLE_DOCUMENTS[documentName] || EDITABLE_DOCUMENTS["task.md"];
  }

  function getEditableDocumentContent(documentName, content = "") {
    if (documentName !== "verification.md") {
      return String(content || "").replace(/\r\n/g, "\n");
    }

    return stripManagedVerificationAnchorBlock(content);
  }

  function stripManagedVerificationAnchorBlock(content = "") {
    const normalized = String(content || "").replace(/\r\n/g, "\n").trim();
    if (!normalized) {
      return "";
    }

    const stripped = normalized
      .replace(
        new RegExp(
          `(?:\\n)?${escapeRegex(managedBlockStart(VERIFICATION_MANUAL_PROOF_ANCHOR_BLOCK_ID))}[\\s\\S]*?${escapeRegex(
            managedBlockEnd(VERIFICATION_MANUAL_PROOF_ANCHOR_BLOCK_ID)
          )}(?:\\n)?`,
          "m"
        ),
        "\n"
      )
      .replace(/\n{3,}/g, "\n\n")
      .trim();

    const evidenceRange = findMarkdownSectionRange(stripped, "Evidence");
    if (!evidenceRange) {
      return stripped;
    }

    const evidenceBody = stripped.slice(evidenceRange.bodyStart, evidenceRange.end).trim();
    if (evidenceBody) {
      return stripped;
    }

    return [stripped.slice(0, evidenceRange.start).trimEnd(), stripped.slice(evidenceRange.end).trimStart()]
      .filter(Boolean)
      .join("\n\n");
  }

  function hasManagedVerificationAnchorBlock(content = "") {
    return String(content || "").includes(managedBlockStart(VERIFICATION_MANUAL_PROOF_ANCHOR_BLOCK_ID));
  }

  function managedBlockStart(blockId) {
    return `<!-- agent-workflow:managed:${blockId}:start -->`;
  }

  function managedBlockEnd(blockId) {
    return `<!-- agent-workflow:managed:${blockId}:end -->`;
  }

  function escapeRegex(value) {
    return String(value || "").replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
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
    getEditableDocumentContent,
    getEditableDocumentConfig,
    getMarkdownSection,
    getNextProofNumber,
    getPendingProofPaths,
    hasManagedVerificationAnchorBlock,
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
    stripManagedVerificationAnchorBlock,
  };
});
