const path = require("path");
const { fileExists, readJson, readText, writeFile, writeJson } = require("./fs-utils");
const { notFound } = require("./http-errors");
const { listRuns } = require("./task-service");
const { buildTaskVerificationGate } = require("./verification-gates");
const { projectProfilePath, taskFiles } = require("./workspace");

function buildCheckpoint(workspaceRoot, taskId) {
  const files = taskFiles(workspaceRoot, taskId);
  if (!fileExists(files.meta)) {
    throw notFound(`Task ${taskId} does not exist yet.`, "task_not_found");
  }

  const task = readJson(files.meta, {});
  const runs = listRuns(workspaceRoot, taskId);
  const latestRun = runs[runs.length - 1] || null;
  const verificationGate = buildTaskVerificationGate(workspaceRoot, task, runs);
  const risks = deriveRisks(workspaceRoot, files, latestRun, verificationGate);
  const completed = [];

  if (fileExists(files.promptCodex) || fileExists(files.promptClaude)) {
    completed.push("Prompt compiled");
  }

  if (runs.length > 0) {
    completed.push(`${runs.length} run(s) recorded`);
  }

  if (readText(files.context, "").trim()) {
    completed.push("Task context captured");
  }

  if (verificationGate.summary.status === "covered") {
    completed.push("Scoped verification evidence looks current");
  }

  if (verificationGate.summary.status === "partially-covered") {
    completed.push("Some scoped files are already linked to explicit proof");
  }

  const checkpoint = {
    taskId,
    generatedAt: new Date().toISOString(),
    latestRunStatus: latestRun ? latestRun.status : "none",
    runCount: runs.length,
    risks,
    completed,
    verificationGate: {
      status: verificationGate.summary.status,
      message: verificationGate.summary.message,
      relevantChangeCount: verificationGate.summary.relevantChangeCount,
      scopeHintCount: verificationGate.scopeCoverage ? verificationGate.scopeCoverage.hintCount : verificationGate.scopeHints.length,
      ambiguousScopeCount: verificationGate.scopeCoverage ? verificationGate.scopeCoverage.ambiguousCount : 0,
      relevantChangedFiles: verificationGate.relevantChangedFiles,
    },
  };

  writeJson(path.join(files.root, "checkpoint.json"), checkpoint);
  writeFile(files.checkpoint, renderCheckpointMarkdown(task, checkpoint, latestRun, verificationGate));

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

  if (verificationGate.summary.status === "needs-proof") {
    risks.push(`Scoped files need explicit proof: ${verificationGate.relevantChangedFiles.map((item) => item.path).join(", ")}`);
  }

  if (verificationGate.summary.status === "partially-covered") {
    risks.push(`Some scoped files still need proof: ${verificationGate.relevantChangedFiles.map((item) => item.path).join(", ")}`);
  }

  if (verificationGate.summary.status === "scope-missing") {
    risks.push("Task scope does not include clear repo-relative paths yet, so diff-aware proof is weak.");
  }

  if (verificationGate.scopeCoverage && verificationGate.scopeCoverage.ambiguousCount > 0) {
    risks.push("Some scope entries are too ambiguous for automatic matching. Prefer repo-relative paths.");
  }

  if (verificationGate.proofCoverage && verificationGate.proofCoverage.weakProofCount > 0) {
    risks.push("Some proof items are too weak to satisfy coverage. Add explicit files plus checks or artifacts.");
  }

  return risks;
}

function renderCheckpointMarkdown(task, checkpoint, latestRun, verificationGate) {
  const completedLines = checkpoint.completed.map((item) => `- ${item}`).join("\n") || "- None yet";
  const riskLines = checkpoint.risks.map((item) => `- ${item}`).join("\n") || "- No immediate risks detected";
  const scopeCoverage = verificationGate.scopeCoverage || { hintCount: verificationGate.scopeHints.length, ambiguousCount: 0, ambiguousEntries: [] };
  const relevantFileLines = (verificationGate.relevantChangedFiles || []).map((item) => `- ${item.path}`).join("\n") || "- None";
  const coveredFileLines = (verificationGate.coveredScopedFiles || []).map((item) => `- ${item.path}`).join("\n") || "- None";
  const ambiguousScopeLines = (scopeCoverage.ambiguousEntries || []).map((item) => `- ${item.value} (${item.source})`).join("\n") || "- None";
  const proofItemLines = (((verificationGate.proofCoverage || {}).items) || [])
    .slice(0, 6)
    .map((item) => `- ${item.sourceType}:${item.sourceLabel} | paths=${item.paths.join(", ") || "none"} | checks=${item.checks.join("; ") || "none"} | artifacts=${item.artifacts.join(", ") || "none"}`)
    .join("\n") || "- None";
  const nextProofSteps = renderNextProofSteps(verificationGate);

  return `# ${task.id} Checkpoint

Generated at: ${checkpoint.generatedAt}

## Completed

${completedLines}

## Confirmed facts

- Title: ${task.title}
- Priority: ${task.priority}
- Status: ${task.status}
- Latest run status: ${checkpoint.latestRunStatus}
- Total runs: ${checkpoint.runCount}

## Verification gate

- Status: ${verificationGate.summary.status}
- Summary: ${verificationGate.summary.message}
- Scope hints: ${scopeCoverage.hintCount}
- Ambiguous scope entries: ${scopeCoverage.ambiguousCount}
- Scoped files awaiting proof: ${verificationGate.summary.relevantChangeCount}

### Scoped files awaiting proof

${relevantFileLines}

### Scoped files already linked to proof

${coveredFileLines}

### Explicit proof items

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
  if (verificationGate.summary.status === "needs-proof") {
    const firstPath = verificationGate.relevantChangedFiles && verificationGate.relevantChangedFiles[0]
      ? verificationGate.relevantChangedFiles[0].path
      : "the scoped files above";
    return `Refresh verification.md after checking ${firstPath}, then rebuild or confirm checkpoint.md.`;
  }

  if (verificationGate.summary.status === "partially-covered") {
    const firstPath = verificationGate.relevantChangedFiles && verificationGate.relevantChangedFiles[0]
      ? verificationGate.relevantChangedFiles[0].path
      : "the remaining scoped files above";
    return `Keep the existing proof, then add explicit coverage for ${firstPath} before handoff.`;
  }

  if (verificationGate.summary.status === "scope-missing") {
    return "Add repo-relative scope paths in task.md or task.json before trusting the verification state.";
  }

  if (verificationGate.scopeCoverage && verificationGate.scopeCoverage.ambiguousCount > 0) {
    return "Tighten any ambiguous scope entries into repo-relative paths before the next handoff.";
  }

  return "Refresh verification.md and checkpoint.md again if scoped files change.";
}

module.exports = {
  buildCheckpoint,
};

