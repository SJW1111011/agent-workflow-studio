const fs = require("fs");
const path = require("path");
const { appendText, fileExists, readJson, writeFile, writeJson } = require("./fs-utils");
const { buildTaskFreshness } = require("./freshness");
const { getRecipe, normalizeRecipeId } = require("./recipes");
const {
  renderCheckpointSkeleton,
  renderContextMarkdown,
  renderTaskMarkdown,
  renderVerificationMarkdown,
  syncManagedTaskDocs,
} = require("./task-documents");
const { ensureWorkflowScaffold, runsRoot, taskFiles, taskRoot } = require("./workspace");

const TASK_STATUSES = new Set(["todo", "in_progress", "blocked", "done"]);
const TASK_PRIORITIES = new Set(["P0", "P1", "P2", "P3"]);

function createTask(workspaceRoot, taskId, title, options = {}) {
  ensureWorkflowScaffold(workspaceRoot);

  const files = taskFiles(workspaceRoot, taskId);
  const exists = fileExists(files.meta);
  const now = new Date().toISOString();
  const recipeId = normalizeRecipeId(options.recipe);
  const recipe = getRecipe(workspaceRoot, recipeId);

  if (!recipe) {
    throw new Error(`Unknown recipe: ${recipeId}`);
  }

  const taskMeta = exists
    ? readJson(files.meta, {})
    : {
        id: taskId,
        title,
        recipeId,
        priority: options.priority || "P2",
        status: "todo",
        createdAt: now,
        updatedAt: now,
        goal: "",
        scope: [],
        nonGoals: [],
        requiredDocs: [],
        verificationCommands: [],
      };

  if (!exists) {
    writeJson(files.meta, taskMeta);
    writeFile(files.task, renderTaskMarkdown(taskMeta, recipe));
    writeFile(files.context, renderContextMarkdown(taskMeta, recipe));
    writeFile(files.verification, renderVerificationMarkdown(taskMeta));
    writeFile(files.checkpoint, renderCheckpointSkeleton(taskMeta));
    fs.mkdirSync(files.runs, { recursive: true });
  }

  return taskMeta;
}

function listTasks(workspaceRoot) {
  const tasksDir = path.join(workspaceRoot, ".agent-workflow", "tasks");
  if (!fs.existsSync(tasksDir)) {
    return [];
  }

  return fs
    .readdirSync(tasksDir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => {
      const taskId = entry.name;
      const meta = readJson(path.join(taskRoot(workspaceRoot, taskId), "task.json"), {});
      const runCount = listRuns(workspaceRoot, taskId).length;

      return {
        ...meta,
        runCount,
      };
    })
    .sort((left, right) => left.id.localeCompare(right.id));
}

function listRuns(workspaceRoot, taskId) {
  const targetRoot = runsRoot(workspaceRoot, taskId);
  if (!fs.existsSync(targetRoot)) {
    return [];
  }

  return fs
    .readdirSync(targetRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => readJson(path.join(targetRoot, entry.name), null))
    .filter(Boolean)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
}

function getTaskDetail(workspaceRoot, taskId) {
  const files = taskFiles(workspaceRoot, taskId);
  if (!fileExists(files.meta)) {
    return null;
  }

  const meta = readJson(files.meta, {});
  const recipe = getRecipe(workspaceRoot, meta.recipeId);
  const runs = listRuns(workspaceRoot, taskId);
  return {
    meta,
    recipe: recipe
      ? {
          id: recipe.id,
          name: recipe.name,
          summary: recipe.summary,
          recommendedFor: recipe.recommendedFor,
        }
      : null,
    taskText: safeRead(files.task),
    contextText: safeRead(files.context),
    verificationText: safeRead(files.verification),
    checkpointText: safeRead(files.checkpoint),
    runs,
    freshness: buildTaskFreshness(workspaceRoot, meta, runs),
    generatedFiles: [
      describeFile("prompt.codex.md", files.promptCodex),
      describeFile("prompt.claude.md", files.promptClaude),
      describeFile("run-request.codex.json", path.join(files.root, "run-request.codex.json")),
      describeFile("run-request.claude-code.json", path.join(files.root, "run-request.claude-code.json")),
      describeFile("launch.codex.md", path.join(files.root, "launch.codex.md")),
      describeFile("launch.claude-code.md", path.join(files.root, "launch.claude-code.md")),
      describeFile("checkpoint.md", files.checkpoint),
      describeFile("task.md", files.task),
      describeFile("context.md", files.context),
      describeFile("verification.md", files.verification),
    ],
  };
}

function updateTaskMeta(workspaceRoot, taskId, changes = {}) {
  const files = taskFiles(workspaceRoot, taskId);
  if (!fileExists(files.meta)) {
    throw new Error(`Task ${taskId} does not exist yet.`);
  }

  const meta = readJson(files.meta, {});
  const nextMeta = { ...meta };
  let recipe = getRecipe(workspaceRoot, nextMeta.recipeId);

  if (isNonEmptyString(changes.title)) {
    nextMeta.title = changes.title.trim();
  }

  if (isNonEmptyString(changes.priority)) {
    const priority = changes.priority.trim().toUpperCase();
    if (!TASK_PRIORITIES.has(priority)) {
      throw new Error(`Unsupported priority: ${changes.priority}`);
    }
    nextMeta.priority = priority;
  }

  if (isNonEmptyString(changes.status)) {
    const status = changes.status.trim();
    if (!TASK_STATUSES.has(status)) {
      throw new Error(`Unsupported status: ${changes.status}`);
    }
    nextMeta.status = status;
  }

  if (isNonEmptyString(changes.recipeId) || isNonEmptyString(changes.recipe)) {
    const recipeId = normalizeRecipeId(changes.recipeId || changes.recipe);
    const matchedRecipe = getRecipe(workspaceRoot, recipeId);
    if (!matchedRecipe) {
      throw new Error(`Unknown recipe: ${recipeId}`);
    }
    nextMeta.recipeId = recipeId;
    recipe = matchedRecipe;
  }

  nextMeta.updatedAt = new Date().toISOString();
  writeJson(files.meta, nextMeta);

  syncManagedTaskDocs(files, nextMeta, recipe);

  return nextMeta;
}

function recordRun(workspaceRoot, taskId, summary, status = "draft", agent = "manual") {
  const run = createRunRecord(taskId, {
    agent,
    status,
    summary,
  });

  return persistRunRecord(workspaceRoot, taskId, run);
}

module.exports = {
  createRunRecord,
  createTask,
  getRunLog,
  getTaskDetail,
  listRuns,
  listTasks,
  persistRunRecord,
  recordRun,
  updateTaskMeta,
};

function safeRead(filePath) {
  return fileExists(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function describeFile(name, absolutePath) {
  return {
    name,
    exists: fileExists(absolutePath),
  };
}

function createRunRecord(taskId, fields = {}) {
  const createdAt = isNonEmptyString(fields.createdAt) ? fields.createdAt : new Date().toISOString();
  return {
    id: isNonEmptyString(fields.id) ? fields.id : `run-${Date.now()}`,
    taskId,
    agent: fields.agent || "manual",
    status: fields.status || "draft",
    summary: fields.summary || "",
    createdAt,
    ...omitUndefined(fields, new Set(["id", "taskId", "agent", "status", "summary", "createdAt"])),
  };
}

function persistRunRecord(workspaceRoot, taskId, run) {
  const files = taskFiles(workspaceRoot, taskId);

  if (!fileExists(files.meta)) {
    throw new Error(`Task ${taskId} does not exist yet.`);
  }

  const persistedRun = {
    ...run,
    taskId,
  };

  fs.mkdirSync(files.runs, { recursive: true });
  writeJson(path.join(files.runs, `${persistedRun.id}.json`), persistedRun);
  appendText(files.verification, renderVerificationEvidence(persistedRun));

  const meta = readJson(files.meta, {});
  const updatedAt = persistedRun.completedAt || persistedRun.createdAt || new Date().toISOString();
  meta.updatedAt = updatedAt;
  if (persistedRun.status === "passed" && meta.status === "todo") {
    meta.status = "in_progress";
  }
  writeJson(files.meta, meta);

  return persistedRun;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function omitUndefined(value, excludedKeys) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(
      ([key, entryValue]) => !excludedKeys.has(key) && entryValue !== undefined
    )
  );
}

function renderVerificationEvidence(run) {
  const timestamp = run.completedAt || run.createdAt || new Date().toISOString();
  const lines = [
    ["Agent", run.agent],
    ["Source", run.source],
    ["Adapter", run.adapterId],
    ["Status", run.status],
    ["Exit code", run.exitCode],
    ["Duration ms", run.durationMs],
    ["Timed out", run.timedOut],
    ["Timeout ms", run.timeoutMs],
    ["Interrupted", run.interrupted],
    ["Interruption signal", run.interruptionSignal],
    ["Termination signal", run.terminationSignal],
    ["Prompt file", run.promptFile],
    ["Run request file", run.runRequestFile],
    ["Launch pack file", run.launchPackFile],
    ["Stdout log", run.stdoutFile],
    ["Stderr log", run.stderrFile],
    ["Error", run.errorMessage],
    ["Summary", run.summary],
  ]
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([label, value]) => `- ${label}: ${value}`);

  return `\n## Evidence ${timestamp}\n\n${lines.join("\n")}\n`;
}

function getRunLog(workspaceRoot, taskId, runId, streamName, maxChars = 12000) {
  const files = taskFiles(workspaceRoot, taskId);
  if (!fileExists(files.meta)) {
    throw new Error(`Task ${taskId} does not exist yet.`);
  }

  const run = listRuns(workspaceRoot, taskId).find((item) => item.id === runId);
  if (!run) {
    throw new Error(`Run ${runId} does not exist for task ${taskId}.`);
  }

  const fieldName = streamName === "stderr" ? "stderrFile" : streamName === "stdout" ? "stdoutFile" : null;
  if (!fieldName) {
    throw new Error(`Unsupported log stream: ${streamName}`);
  }

  if (!isNonEmptyString(run[fieldName])) {
    throw new Error(`Run ${runId} has no ${streamName} log.`);
  }

  const absolutePath = path.resolve(workspaceRoot, run[fieldName]);
  const allowedRoot = path.resolve(files.runs);
  const normalizedAllowedRoot = `${allowedRoot}${path.sep}`;
  if ((absolutePath !== allowedRoot && !absolutePath.startsWith(normalizedAllowedRoot)) || !fileExists(absolutePath)) {
    throw new Error(`Log file is missing for run ${runId} (${streamName}).`);
  }

  const content = fs.readFileSync(absolutePath, "utf8");
  const limit = Number.isInteger(maxChars) && maxChars > 0 ? maxChars : 12000;
  const truncated = content.length > limit;

  return {
    runId,
    stream: streamName,
    path: run[fieldName],
    size: content.length,
    truncated,
    content: truncated ? content.slice(-limit) : content,
  };
}

