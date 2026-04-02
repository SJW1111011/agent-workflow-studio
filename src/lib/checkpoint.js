const path = require("path");
const { fileExists, readJson, readText, writeFile, writeJson } = require("./fs-utils");
const { listRuns } = require("./task-service");
const { projectProfilePath, taskFiles } = require("./workspace");

function buildCheckpoint(workspaceRoot, taskId) {
  const files = taskFiles(workspaceRoot, taskId);
  if (!fileExists(files.meta)) {
    throw new Error(`Task ${taskId} does not exist yet.`);
  }

  const task = readJson(files.meta, {});
  const runs = listRuns(workspaceRoot, taskId);
  const latestRun = runs[runs.length - 1] || null;
  const risks = deriveRisks(workspaceRoot, files, latestRun);
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

  const checkpoint = {
    taskId,
    generatedAt: new Date().toISOString(),
    latestRunStatus: latestRun ? latestRun.status : "none",
    runCount: runs.length,
    risks,
    completed,
  };

  writeJson(path.join(files.root, "checkpoint.json"), checkpoint);
  writeFile(files.checkpoint, renderCheckpointMarkdown(task, checkpoint, latestRun));

  return checkpoint;
}

function deriveRisks(workspaceRoot, files, latestRun) {
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

  return risks;
}

function renderCheckpointMarkdown(task, checkpoint, latestRun) {
  const completedLines = checkpoint.completed.map((item) => `- ${item}`).join("\n") || "- None yet";
  const riskLines = checkpoint.risks.map((item) => `- ${item}`).join("\n") || "- No immediate risks detected";

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

## Risks

${riskLines}

## Latest evidence

- Summary: ${latestRun ? latestRun.summary : "No runs recorded"}
- Timestamp: ${latestRun ? latestRun.createdAt : "N/A"}

## Resume instructions

1. Read task.md, context.md, and verification.md.
2. Review the latest prompt and decide whether it still reflects scope.
3. Continue only after acknowledging the risks above.
`;
}

module.exports = {
  buildCheckpoint,
};

