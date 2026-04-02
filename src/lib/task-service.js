const fs = require("fs");
const path = require("path");
const { appendText, fileExists, readJson, writeFile, writeJson } = require("./fs-utils");
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
    runs: listRuns(workspaceRoot, taskId),
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
  const files = taskFiles(workspaceRoot, taskId);

  if (!fileExists(files.meta)) {
    throw new Error(`Task ${taskId} does not exist yet.`);
  }

  const createdAt = new Date().toISOString();
  const run = {
    id: `run-${Date.now()}`,
    taskId,
    agent,
    status,
    summary,
    createdAt,
  };

  fs.mkdirSync(files.runs, { recursive: true });
  writeJson(path.join(files.runs, `${run.id}.json`), run);

  appendText(
    files.verification,
    `\n## Evidence ${createdAt}\n\n- Agent: ${agent}\n- Status: ${status}\n- Summary: ${summary}\n`
  );

  const meta = readJson(files.meta, {});
  meta.updatedAt = createdAt;
  if (status === "passed" && meta.status === "todo") {
    meta.status = "in_progress";
  }
  writeJson(files.meta, meta);

  return run;
}

module.exports = {
  createTask,
  getTaskDetail,
  listRuns,
  listTasks,
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

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

