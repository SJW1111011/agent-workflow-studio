const path = require("path");
const { buildCheckpoint } = require("./checkpoint");
const { normalizeAdapterId } = require("./adapters");
const { compilePrompt } = require("./prompt-compiler");
const { prepareRun } = require("./run-preparer");
const { scanWorkspace } = require("./scanner");
const { createTask, listTasks } = require("./task-service");
const { badRequest, conflict } = require("./http-errors");
const { appendUndoEntry, listWorkflowPaths } = require("./undo-log");
const { workflowRoot } = require("./workspace");

function quickCreateTask(workspaceRoot, title, options = {}) {
  const normalizedTitle = String(title || "").trim();
  const recipeId = String(options.recipe || "feature").trim() || "feature";
  const priority = String(options.priority || "P2").trim().toUpperCase() || "P2";
  const agent = normalizeQuickAgent(options.agent);
  const mode = normalizeQuickMode(options.mode || "full");
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
    scaffoldMode: mode,
  });
  const prompt = mode === "full" ? compilePrompt(workspaceRoot, taskId, agent.promptAgent) : null;
  const prepared = mode === "full" ? prepareRun(workspaceRoot, taskId, agent.adapterId) : null;
  const checkpoint = mode === "full" ? buildCheckpoint(workspaceRoot, taskId) : null;
  const taskRootRelativePath = `.agent-workflow/tasks/${taskId}`;

  appendUndoEntry(workspaceRoot, {
    type: "quick",
    taskId,
    files: listWorkflowPaths(workspaceRoot, taskRootRelativePath),
    metadata: {
      taskRoot: taskRootRelativePath,
      mode,
      agent: agent.promptAgent,
      adapterId: agent.adapterId,
    },
  });

  return {
    workspaceRoot,
    workflowRoot: workflowRoot(workspaceRoot),
    taskId,
    title: normalizedTitle,
    priority,
    recipeId,
    mode,
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

function normalizeQuickMode(value) {
  const mode = String(value || "full").trim().toLowerCase() || "full";
  if (mode !== "full" && mode !== "lite") {
    throw badRequest(`Unsupported quick mode: ${value}`, "unsupported_quick_mode");
  }
  return mode;
}

function formatQuickTaskSummary(result) {
  const lines = [
    `Quick task ready: ${result.taskId}`,
    `- Workflow root: ${toDisplayPath(result.workflowRoot)}`,
    `- Mode: ${result.mode}`,
    `- Task: ${result.taskId} | ${result.priority} | recipe=${result.recipeId}`,
    `- Project profile: ${toDisplayPath(path.join(result.workflowRoot, "project-profile.md"))}`,
  ];

  if (result.mode === "lite") {
    lines.push(`- Task doc: ${toDisplayPath(path.join(result.workflowRoot, "tasks", result.taskId, "task.md"))}`);
    lines.push("Next steps:");
    lines.push(`1. Review .agent-workflow/tasks/${result.taskId}/task.md.`);
    lines.push("2. Use prompt:compile, run:prepare, checkpoint, or run:add to materialize the rest on demand.");
    return lines.join("\n");
  }

  lines.push(`- Prompt (${result.agent}): ${toDisplayPath(result.prompt.outputPath)}`);
  lines.push(`- Run request (${result.adapterId}): ${toDisplayPath(result.prepared.runRequestPath)}`);
  lines.push(`- Launch pack (${result.adapterId}): ${toDisplayPath(result.prepared.launchPackPath)}`);
  lines.push(`- Checkpoint: ${toDisplayPath(path.join(result.workflowRoot, "tasks", result.taskId, "checkpoint.md"))}`);
  lines.push("Next steps:");
  lines.push(`1. Review .agent-workflow/tasks/${result.taskId}/task.md and context.md.`);
  lines.push(`2. Give ${path.basename(result.prompt.outputPath)} to ${result.adapterId}.`);
  lines.push("3. After the run, record evidence and refresh the checkpoint.");
  return lines.join("\n");
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
