const path = require("path");
const { buildCheckpoint } = require("./checkpoint");
const { normalizeAdapterId } = require("./adapters");
const { compilePrompt } = require("./prompt-compiler");
const { prepareRun } = require("./run-preparer");
const { scanWorkspace } = require("./scanner");
const { createTask, listTasks } = require("./task-service");
const { badRequest, conflict } = require("./http-errors");
const { workflowRoot } = require("./workspace");

function quickCreateTask(workspaceRoot, title, options = {}) {
  const normalizedTitle = String(title || "").trim();
  const recipeId = String(options.recipe || "feature").trim() || "feature";
  const priority = String(options.priority || "P2").trim().toUpperCase() || "P2";
  const agent = normalizeQuickAgent(options.agent);
  const taskId = isNonEmptyString(options.taskId) ? String(options.taskId).trim() : buildNextTaskId(workspaceRoot);

  if (!normalizedTitle) {
    throw badRequest("Quick task title is required.", "quick_title_required");
  }

  if (listTasks(workspaceRoot).some((task) => task && task.id === taskId)) {
    throw conflict(`Task already exists: ${taskId}`, "task_already_exists");
  }

  const profile = scanWorkspace(workspaceRoot);
  const task = createTask(workspaceRoot, taskId, normalizedTitle, {
    recipe: recipeId,
    priority,
  });
  const prompt = compilePrompt(workspaceRoot, taskId, agent.promptAgent);
  const prepared = prepareRun(workspaceRoot, taskId, agent.adapterId);
  const checkpoint = buildCheckpoint(workspaceRoot, taskId);

  return {
    workspaceRoot,
    workflowRoot: workflowRoot(workspaceRoot),
    taskId,
    title: normalizedTitle,
    priority,
    recipeId,
    agent: agent.promptAgent,
    adapterId: agent.adapterId,
    profile,
    task,
    prompt,
    prepared,
    checkpoint,
  };
}

function buildNextTaskId(workspaceRoot) {
  const taskIds = listTasks(workspaceRoot).map((task) => String((task && task.id) || "").trim());
  const numericIds = taskIds
    .map((taskId) => {
      const match = taskId.match(/^T-(\d+)$/i);
      return match ? Number(match[1]) : null;
    })
    .filter((value) => Number.isInteger(value));

  const nextValue = (numericIds.length > 0 ? Math.max(...numericIds) : 0) + 1;
  const width = Math.max(3, String(nextValue).length);
  return `T-${String(nextValue).padStart(width, "0")}`;
}

function normalizeQuickAgent(value) {
  const adapterId = normalizeAdapterId(value || "codex");
  if (adapterId !== "codex" && adapterId !== "claude-code") {
    throw badRequest(`Unsupported quick agent: ${value}`, "unsupported_quick_agent");
  }
  return {
    adapterId,
    promptAgent: adapterId === "claude-code" ? "claude" : "codex",
  };
}

function formatQuickTaskSummary(result) {
  return [
    `Quick task ready: ${result.taskId}`,
    `- Workflow root: ${toDisplayPath(result.workflowRoot)}`,
    `- Task: ${result.taskId} | ${result.priority} | recipe=${result.recipeId}`,
    `- Project profile: ${toDisplayPath(path.join(result.workflowRoot, "project-profile.md"))}`,
    `- Prompt (${result.agent}): ${toDisplayPath(result.prompt.outputPath)}`,
    `- Run request (${result.adapterId}): ${toDisplayPath(result.prepared.runRequestPath)}`,
    `- Launch pack (${result.adapterId}): ${toDisplayPath(result.prepared.launchPackPath)}`,
    `- Checkpoint: ${toDisplayPath(path.join(result.workflowRoot, "tasks", result.taskId, "checkpoint.md"))}`,
    "Next steps:",
    `1. Review .agent-workflow/tasks/${result.taskId}/task.md and context.md.`,
    `2. Give ${path.basename(result.prompt.outputPath)} to ${result.adapterId}.`,
    `3. After the run, record evidence and refresh the checkpoint.`,
  ].join("\n");
}

function toDisplayPath(value) {
  return String(value || "").replace(/\\/g, "/");
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

module.exports = {
  buildNextTaskId,
  formatQuickTaskSummary,
  quickCreateTask,
};
