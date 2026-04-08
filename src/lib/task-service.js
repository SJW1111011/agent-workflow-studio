const fs = require("fs");
const path = require("path");
const { appendText, fileExists, readJson, writeFile, writeJson } = require("./fs-utils");
const { buildTaskFreshness } = require("./freshness");
const { badRequest, notFound } = require("./http-errors");
const { getRecipe, normalizeRecipeId } = require("./recipes");
const {
  defaultCheckStatusForRunStatus,
  formatVerificationCheck,
  normalizeArtifactRefs,
  normalizeProofAnchors,
  normalizeProofPaths,
  normalizeVerificationChecks,
} = require("./evidence-utils");
const { buildScopeProofAnchors, loadRepositorySnapshot } = require("./repository-snapshot");
const { buildTaskVerificationGate } = require("./verification-gates");
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
    throw badRequest(`Unknown recipe: ${recipeId}`, "unknown_recipe");
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
  const taskText = safeRead(files.task);
  const repositorySnapshot = loadRepositorySnapshot(workspaceRoot);
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
    taskText,
    contextText: safeRead(files.context),
    verificationText: safeRead(files.verification),
    checkpointText: safeRead(files.checkpoint),
    runs,
    freshness: buildTaskFreshness(workspaceRoot, meta, runs),
    verificationGate: buildTaskVerificationGate(workspaceRoot, meta, runs, repositorySnapshot, taskText),
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
    throw notFound(`Task ${taskId} does not exist yet.`, "task_not_found");
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
      throw badRequest(`Unsupported priority: ${changes.priority}`, "unsupported_priority");
    }
    nextMeta.priority = priority;
  }

  if (isNonEmptyString(changes.status)) {
    const status = changes.status.trim();
    if (!TASK_STATUSES.has(status)) {
      throw badRequest(`Unsupported status: ${changes.status}`, "unsupported_status");
    }
    nextMeta.status = status;
  }

  if (isNonEmptyString(changes.recipeId) || isNonEmptyString(changes.recipe)) {
    const recipeId = normalizeRecipeId(changes.recipeId || changes.recipe);
    const matchedRecipe = getRecipe(workspaceRoot, recipeId);
    if (!matchedRecipe) {
      throw badRequest(`Unknown recipe: ${recipeId}`, "unknown_recipe");
    }
    nextMeta.recipeId = recipeId;
    recipe = matchedRecipe;
  }

  nextMeta.updatedAt = new Date().toISOString();
  writeJson(files.meta, nextMeta);

  syncManagedTaskDocs(files, nextMeta, recipe);

  return nextMeta;
}

function recordRun(workspaceRoot, taskId, summary, status = "draft", agent = "manual", fields = {}) {
  const run = createRunRecord(taskId, {
    agent,
    status,
    summary,
    ...fields,
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
    throw notFound(`Task ${taskId} does not exist yet.`, "task_not_found");
  }

  const meta = readJson(files.meta, {});
  const existingRuns = listRuns(workspaceRoot, taskId);
  const taskText = safeRead(files.task);
  const repositorySnapshot = loadRepositorySnapshot(workspaceRoot);
  const gateBeforePersist = buildTaskVerificationGate(workspaceRoot, meta, existingRuns, repositorySnapshot, taskText);
  const inferredScopeProofPaths =
    run.status === "passed"
      ? Array.from(
          new Set(
            []
              .concat((gateBeforePersist.relevantChangedFiles || []).map((item) => item.path))
              .concat((gateBeforePersist.coveredScopedFiles || []).map((item) => item.path))
          )
        )
      : (gateBeforePersist.relevantChangedFiles || []).map((item) => item.path);
  const scopeProofPaths = normalizeProofPaths(
    Array.isArray(run.scopeProofPaths) && run.scopeProofPaths.length > 0 ? run.scopeProofPaths : inferredScopeProofPaths
  );
  const verificationChecks = normalizeVerificationChecks(
    run.verificationChecks,
    defaultCheckStatusForRunStatus(run.status)
  );
  const verificationArtifacts = normalizeArtifactRefs(run.verificationArtifacts);
  const scopeProofAnchors =
    run.status === "passed" && scopeProofPaths.length > 0
      ? normalizeProofAnchors(
          Array.isArray(run.scopeProofAnchors) && run.scopeProofAnchors.length > 0
            ? run.scopeProofAnchors
            : buildScopeProofAnchors(workspaceRoot, scopeProofPaths, repositorySnapshot)
        )
      : [];

  const persistedRun = {
    ...run,
    taskId,
    scopeProofPaths: scopeProofPaths.length > 0 ? scopeProofPaths : undefined,
    scopeProofAnchors: scopeProofAnchors.length > 0 ? scopeProofAnchors : undefined,
    verificationChecks: verificationChecks.length > 0 ? verificationChecks : undefined,
    verificationArtifacts: verificationArtifacts.length > 0 ? verificationArtifacts : undefined,
  };

  fs.mkdirSync(files.runs, { recursive: true });
  writeJson(path.join(files.runs, `${persistedRun.id}.json`), persistedRun);
  appendText(files.verification, renderVerificationEvidence(persistedRun));

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
  const verificationChecks = normalizeVerificationChecks(
    run.verificationChecks,
    defaultCheckStatusForRunStatus(run.status)
  );
  const verificationArtifacts = normalizeArtifactRefs(run.verificationArtifacts);
  const proofArtifacts = collectRunArtifactRefs(run);
  const lines = [
    ["Agent", run.agent],
    ["Source", run.source],
    ["Adapter", run.adapterId],
    ["Status", run.status],
    ["Outcome", run.outcome],
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
    ["Scoped files covered", Array.isArray(run.scopeProofPaths) ? run.scopeProofPaths.join(", ") : undefined],
    ["Verification artifacts", verificationArtifacts.length > 0 ? verificationArtifacts.join(", ") : undefined],
    ["Proof artifacts", proofArtifacts.length > 0 ? proofArtifacts.join(", ") : undefined],
    ["Failure category", run.failureCategory],
    ["Error", run.errorMessage],
    ["Summary", run.summary],
  ]
    .filter(([, value]) => value !== undefined && value !== null && String(value).trim() !== "")
    .map(([label, value]) => `- ${label}: ${value}`);

  verificationChecks.forEach((check) => {
    lines.push(`- Verification check: ${formatVerificationCheck(check)}`);
  });

  return `\n## Evidence ${timestamp}\n\n${lines.join("\n")}\n`;
}

function collectRunArtifactRefs(run) {
  return Array.from(
    new Set(
      [run.stdoutFile, run.stderrFile, run.promptFile, run.runRequestFile, run.launchPackFile]
        .concat(normalizeArtifactRefs(run.verificationArtifacts))
        .filter((value) => isNonEmptyString(value))
    )
  );
}

function getRunLog(workspaceRoot, taskId, runId, streamName, maxChars = 12000) {
  const files = taskFiles(workspaceRoot, taskId);
  if (!fileExists(files.meta)) {
    throw notFound(`Task ${taskId} does not exist yet.`, "task_not_found");
  }

  const run = listRuns(workspaceRoot, taskId).find((item) => item.id === runId);
  if (!run) {
    throw notFound(`Run ${runId} does not exist for task ${taskId}.`, "run_not_found");
  }

  const fieldName = streamName === "stderr" ? "stderrFile" : streamName === "stdout" ? "stdoutFile" : null;
  if (!fieldName) {
    throw badRequest(`Unsupported log stream: ${streamName}`, "unsupported_log_stream");
  }

  if (!isNonEmptyString(run[fieldName])) {
    throw notFound(`Run ${runId} has no ${streamName} log.`, "run_log_unavailable");
  }

  const absolutePath = path.resolve(workspaceRoot, run[fieldName]);
  const allowedRoot = path.resolve(files.runs);
  const normalizedAllowedRoot = `${allowedRoot}${path.sep}`;
  if ((absolutePath !== allowedRoot && !absolutePath.startsWith(normalizedAllowedRoot)) || !fileExists(absolutePath)) {
    throw notFound(`Log file is missing for run ${runId} (${streamName}).`, "run_log_missing");
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

