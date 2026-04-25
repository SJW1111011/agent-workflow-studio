const path = require("path");
const { fileExists, readText, writeFile, writeJson } = require("./fs-utils");
const { listHandoffRecords, listRuns, normalizeTaskClaimForRead } = require("./task-service");
const { ensureTaskArtifacts } = require("./task-documents");
const { appendUndoEntry, buildUndoFileList, captureTaskRestoreSnapshots } = require("./undo-log");
const { buildTaskVerificationGate } = require("./verification-gates");
const { projectProfilePath, resolveStrictVerification } = require("./workspace");

function buildCheckpoint(workspaceRoot, taskId, options = {}) {
  const strictVerification = resolveStrictVerification(workspaceRoot, options.strict);
  const restoreSnapshots = options.logUndo === true
    ? captureTaskRestoreSnapshots(workspaceRoot, taskId, {
        includeTaskMeta: false,
        includeRunsDirectory: false,
      })
    : null;
  const { files, taskMeta } = ensureTaskArtifacts(workspaceRoot, taskId, {
    task: true,
    context: true,
    verification: true,
  });
  const task = normalizeTaskClaimForRead(taskMeta);
  const runs = listRuns(workspaceRoot, taskId);
  const handoffRecords = listHandoffRecords(workspaceRoot, taskId);
  const latestRun = runs[runs.length - 1] || null;
  const latestHandoff = handoffRecords[handoffRecords.length - 1] || null;
  const verificationGate = buildTaskVerificationGate(workspaceRoot, task, runs, null, null, {
    strict: strictVerification,
  });
  const risks = deriveRisks(workspaceRoot, files, latestRun, verificationGate);
  const completed = [];

  if (fileExists(files.promptCodex) || fileExists(files.promptClaude)) {
    completed.push("Prompt compiled");
  }

  if (runs.length > 0) {
    completed.push(`${runs.length} run(s) recorded`);
  }

  if (handoffRecords.length > 0) {
    completed.push(`${handoffRecords.length} handoff(s) recorded`);
  }

  if (readText(files.context, "").trim()) {
    completed.push("Task context captured");
  }

  if (verificationGate.summary.status === "covered") {
    completed.push("Scoped verification evidence looks current");
  }

  if (verificationGate.summary.status === "incomplete") {
    completed.push("Some scoped files are already linked to verified evidence");
  }

  const scopeCoverage = getScopeCoverageSummary(verificationGate);

  const checkpoint = {
    taskId,
    generatedAt: new Date().toISOString(),
    latestRunStatus: latestRun ? latestRun.status : "none",
    runCount: runs.length,
    claimedBy: task.claimedBy || null,
    claimExpiry: task.claimExpiry || null,
    claimStatus: task.claimStatus || "unclaimed",
    claimExpired: task.claimExpired === true,
    latestHandoff: latestHandoff
      ? {
          id: latestHandoff.id,
          agent: latestHandoff.agent,
          summary: latestHandoff.summary,
          remaining: latestHandoff.remaining,
          filesModified: latestHandoff.filesModified || [],
          createdAt: latestHandoff.createdAt,
        }
      : null,
    risks,
    completed,
    verificationGate: {
      status: verificationGate.summary.status,
      message: verificationGate.summary.message,
      relevantChangeCount: verificationGate.summary.relevantChangeCount,
      coveragePercent: normalizeCoveragePercent(verificationGate.coveragePercent),
      scopeHintCount: scopeCoverage.hintCount,
      ambiguousScopeCount: scopeCoverage.ambiguousCount,
      scopedFileCount: scopeCoverage.scopedFileCount,
      coveredFileCount: scopeCoverage.coveredFileCount,
      relevantChangedFiles: verificationGate.relevantChangedFiles,
    },
  };

  writeJson(path.join(files.root, "checkpoint.json"), checkpoint);
  writeFile(files.checkpoint, renderCheckpointMarkdown(task, checkpoint, latestRun, verificationGate));

  if (restoreSnapshots) {
    appendUndoEntry(workspaceRoot, {
      type: "checkpoint",
      taskId,
      files: buildUndoFileList(restoreSnapshots),
      metadata: {
        restore: restoreSnapshots,
      },
    });
  }

  return checkpoint;
}

function deriveRisks(workspaceRoot, files, latestRun, verificationGate) {
  const risks = [];

  if (!fileExists(projectProfilePath(workspaceRoot))) {
    risks.push("Project profile is missing. Run scan to build a repository snapshot.");
  }

  if (!fileExists(files.promptCodex) && !fileExists(files.promptClaude)) {
    risks.push("No compiled prompt found for this task.");
  }

  if (!latestRun) {
    risks.push("No execution evidence recorded yet.");
  } else if (latestRun.status === "failed") {
    risks.push("Latest recorded run failed.");
  }

  if (verificationGate.summary.status === "action-required") {
    risks.push(`Scoped files still need verified evidence: ${verificationGate.relevantChangedFiles.map((item) => item.path).join(", ")}`);
  }

  if (verificationGate.summary.status === "incomplete") {
    risks.push(`Some scoped files still need verified evidence: ${verificationGate.relevantChangedFiles.map((item) => item.path).join(", ")}`);
  }

  if (verificationGate.summary.status === "unconfigured") {
    risks.push("Task scope does not include clear repo-relative paths yet, so diff-aware verification is limited.");
  }

  if (verificationGate.scopeCoverage && verificationGate.scopeCoverage.ambiguousCount > 0) {
    risks.push("Some scope entries are too ambiguous for automatic matching. Prefer repo-relative paths.");
  }

  if (
    verificationGate.proofCoverage &&
    ((verificationGate.proofCoverage.draftEvidenceCount || 0) > 0 || (verificationGate.proofCoverage.weakProofCount || 0) > 0)
  ) {
    risks.push("Some evidence is still draft. Add explicit files plus checks or artifacts.");
  }

  return risks;
}

function renderCheckpointMarkdown(task, checkpoint, latestRun, verificationGate) {
  const completedLines = checkpoint.completed.map((item) => `- ${item}`).join("\n") || "- None yet";
  const riskLines = checkpoint.risks.map((item) => `- ${item}`).join("\n") || "- No immediate risks detected";
  const scopeCoverage = getScopeCoverageSummary(verificationGate);
  const relevantFileLines = (verificationGate.relevantChangedFiles || []).map((item) => `- ${item.path}`).join("\n") || "- None";
  const coveredFileLines = (verificationGate.coveredScopedFiles || []).map((item) => `- ${item.path}`).join("\n") || "- None";
  const ambiguousScopeLines = (scopeCoverage.ambiguousEntries || []).map((item) => `- ${item.value} (${item.source})`).join("\n") || "- None";
  const proofItemLines = (((verificationGate.proofCoverage || {}).items) || [])
    .slice(0, 6)
    .map((item) => `- ${item.sourceType}:${item.sourceLabel} | paths=${item.paths.join(", ") || "none"} | checks=${item.checks.join("; ") || "none"} | artifacts=${item.artifacts.join(", ") || "none"}`)
    .join("\n") || "- None";
  const nextProofSteps = renderNextProofSteps(verificationGate);
  const latestHandoff = checkpoint.latestHandoff;
  const latestHandoffLines = latestHandoff
    ? [
        `- Agent: ${latestHandoff.agent}`,
        `- Timestamp: ${latestHandoff.createdAt}`,
        `- Summary: ${latestHandoff.summary}`,
        `- Remaining: ${latestHandoff.remaining}`,
        `- Files modified: ${
          Array.isArray(latestHandoff.filesModified) && latestHandoff.filesModified.length > 0
            ? latestHandoff.filesModified.join(", ")
            : "None recorded"
        }`,
      ].join("\n")
    : "- No handoff recorded yet";

  return `# ${task.id} Checkpoint

Generated at: ${checkpoint.generatedAt}

## Completed

${completedLines}

## Confirmed facts

- Title: ${task.title}
- Priority: ${task.priority}
- Status: ${task.status}
- Claimed by: ${checkpoint.claimedBy || "unclaimed"}
- Claim status: ${checkpoint.claimStatus || "unclaimed"}
- Latest run status: ${checkpoint.latestRunStatus}
- Total runs: ${checkpoint.runCount}

## Latest handoff

${latestHandoffLines}

## Verification gate

- Status: ${verificationGate.summary.status}
- Summary: ${verificationGate.summary.message}
- Evidence coverage: ${formatEvidenceCoverageLabel(verificationGate, scopeCoverage)}
- Scope hints: ${scopeCoverage.hintCount}
- Ambiguous scope entries: ${scopeCoverage.ambiguousCount}
- Scoped files awaiting proof: ${verificationGate.summary.relevantChangeCount}

### Scoped files awaiting proof

${relevantFileLines}

### Scoped files already linked to proof

${coveredFileLines}

### Explicit evidence items

${proofItemLines}

### Scope entries that need tightening

${ambiguousScopeLines}

## Risks

${riskLines}

## Latest evidence

- Summary: ${latestRun ? latestRun.summary : "No runs recorded"}
- Timestamp: ${latestRun ? latestRun.createdAt : "N/A"}

## Resume instructions

1. Read task.md, context.md, and verification.md.
2. Review the latest prompt and decide whether it still reflects scope.
3. ${nextProofSteps}
4. Continue only after acknowledging the risks above.
`;
}

function renderNextProofSteps(verificationGate) {
  if (verificationGate.summary.status === "action-required") {
    const firstPath = verificationGate.relevantChangedFiles && verificationGate.relevantChangedFiles[0]
      ? verificationGate.relevantChangedFiles[0].path
      : "the scoped files above";
    return `Refresh verification.md after checking ${firstPath}, then rebuild or confirm checkpoint.md.`;
  }

  if (verificationGate.summary.status === "incomplete") {
    const firstPath = verificationGate.relevantChangedFiles && verificationGate.relevantChangedFiles[0]
      ? verificationGate.relevantChangedFiles[0].path
      : "the remaining scoped files above";
    return `Keep the existing proof, then add explicit coverage for ${firstPath} before handoff.`;
  }

  if (verificationGate.summary.status === "unconfigured") {
    return "Add repo-relative scope paths in task.md or task.json before trusting the verification state.";
  }

  if (verificationGate.scopeCoverage && verificationGate.scopeCoverage.ambiguousCount > 0) {
    return "Tighten any ambiguous scope entries into repo-relative paths before the next handoff.";
  }

  return "Refresh verification.md and checkpoint.md again if scoped files change.";
}

function getScopeCoverageSummary(verificationGate) {
  const scopeCoverage =
    verificationGate && verificationGate.scopeCoverage
      ? verificationGate.scopeCoverage
      : {
          hintCount: Array.isArray(verificationGate && verificationGate.scopeHints) ? verificationGate.scopeHints.length : 0,
          ambiguousCount: 0,
          ambiguousEntries: [],
        };

  const scopedFileCount = normalizeNonNegativeInteger(
    scopeCoverage.scopedFileCount !== undefined
      ? scopeCoverage.scopedFileCount
      : verificationGate &&
            verificationGate.repository &&
            verificationGate.repository.scopedFileCount !== undefined
        ? verificationGate.repository.scopedFileCount
        : (verificationGate && verificationGate.relevantChangedFiles ? verificationGate.relevantChangedFiles.length : 0) +
          (verificationGate && verificationGate.coveredScopedFiles ? verificationGate.coveredScopedFiles.length : 0)
  );
  const coveredFileCount = normalizeNonNegativeInteger(
    scopeCoverage.coveredFileCount !== undefined
      ? scopeCoverage.coveredFileCount
      : verificationGate && Array.isArray(verificationGate.coveredScopedFiles)
        ? verificationGate.coveredScopedFiles.length
        : 0
  );

  return {
    ...scopeCoverage,
    hintCount: normalizeNonNegativeInteger(scopeCoverage.hintCount),
    ambiguousCount: normalizeNonNegativeInteger(scopeCoverage.ambiguousCount),
    ambiguousEntries: Array.isArray(scopeCoverage.ambiguousEntries) ? scopeCoverage.ambiguousEntries : [],
    scopedFileCount,
    coveredFileCount,
    uncoveredFileCount: Math.max(scopedFileCount - coveredFileCount, 0),
  };
}

function formatEvidenceCoverageLabel(verificationGate, scopeCoverage = getScopeCoverageSummary(verificationGate)) {
  if ((scopeCoverage.hintCount || 0) === 0) {
    return "no scope defined";
  }

  if ((scopeCoverage.scopedFileCount || 0) === 0) {
    return "no scoped files matched";
  }

  return `${normalizeCoveragePercent(verificationGate && verificationGate.coveragePercent)}% (${scopeCoverage.coveredFileCount}/${scopeCoverage.scopedFileCount} scoped files)`;
}

function normalizeCoveragePercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeNonNegativeInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }

  return Math.round(numeric);
}

module.exports = {
  buildCheckpoint,
};

