const fs = require("fs");
const path = require("path");
const { appendText, fileExists, readJson, writeJson } = require("./fs-utils");
const { listAdapters } = require("./adapters");
const { buildTaskFreshness } = require("./freshness");
const { badRequest, conflict, notFound } = require("./http-errors");
const { getRecipe, normalizeRecipeId } = require("./recipes");
const {
  defaultCheckStatusForRunStatus,
  formatVerificationCheck,
  normalizeArtifactRefs,
  normalizeProofAnchors,
  normalizeProofPaths,
  normalizeRunRecordForRead,
  normalizeVerificationChecks,
} = require("./evidence-utils");
const { buildScopeProofAnchors, loadRepositorySnapshot } = require("./repository-snapshot");
const { buildTaskVerificationGate } = require("./verification-gates");
const {
  appendTaskContextNote,
  ensureTaskArtifacts,
  syncManagedTaskDocs,
} = require("./task-documents");
const { inferAllTestResultsResult, inferProofPathsResult } = require("./smart-defaults");
const { appendUndoEntry, buildUndoFileList, captureTaskRestoreSnapshots } = require("./undo-log");
const {
  ensureWorkflowScaffold,
  resolveAutoInferTest,
  resolveStrictVerification,
  runsRoot,
  taskFiles,
  taskRoot,
} = require("./workspace");

const TASK_STATUSES = new Set(["todo", "in_progress", "blocked", "done"]);
const TASK_PRIORITIES = new Set(["P0", "P1", "P2", "P3"]);
const TASK_SCAFFOLD_MODES = new Set(["full", "lite"]);
const RUN_RECORD_FILE_PREFIX = "run-";
const ACTIVITY_RECORD_FILE_PREFIX = "activity-";
const RECORD_FILE_EXTENSION = ".json";
const EVIDENCE_CONTEXT_KEYS = new Set([
  "commandsRun",
  "filesModified",
  "sessionDurationMs",
  "toolCallCount",
]);

function createTask(workspaceRoot, taskId, title, options = {}) {
  ensureWorkflowScaffold(workspaceRoot);

  const files = taskFiles(workspaceRoot, taskId);
  const exists = fileExists(files.meta);
  const now = new Date().toISOString();
  const recipeId = normalizeRecipeId(options.recipe);
  const recipe = getRecipe(workspaceRoot, recipeId);
  const scaffoldMode = normalizeTaskScaffoldMode(options.scaffoldMode || options.mode || "full");

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
    ensureTaskArtifacts(workspaceRoot, taskId, {
      task: true,
      context: scaffoldMode === "full",
      verification: scaffoldMode === "full",
      checkpoint: scaffoldMode === "full",
      runs: scaffoldMode === "full",
    });
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
  return listTaskRecords(workspaceRoot, taskId, RUN_RECORD_FILE_PREFIX, (value) =>
    normalizeRunRecordForRead(value)
  );
}

function listActivityRecords(workspaceRoot, taskId) {
  return listTaskRecords(workspaceRoot, taskId, ACTIVITY_RECORD_FILE_PREFIX, (value, fileName) =>
    normalizeActivityRecordForRead(value, fileName)
  );
}

function getTaskDetail(workspaceRoot, taskId) {
  const files = taskFiles(workspaceRoot, taskId);
  if (!fileExists(files.meta)) {
    return null;
  }

  const meta = readJson(files.meta, {});
  const recipe = getRecipe(workspaceRoot, meta.recipeId);
  const runs = listRuns(workspaceRoot, taskId);
  const activityRecords = listActivityRecords(workspaceRoot, taskId);
  const taskText = safeRead(files.task);
  const strictVerification = resolveStrictVerification(workspaceRoot);
  const repositorySnapshot = loadRepositorySnapshot(workspaceRoot, {
    strict: strictVerification,
  });
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
    activityRecords,
    freshness: buildTaskFreshness(workspaceRoot, meta, runs),
    verificationGate: buildTaskVerificationGate(workspaceRoot, meta, runs, repositorySnapshot, taskText, {
      strict: strictVerification,
    }),
    generatedFiles: buildGeneratedFiles(workspaceRoot, files),
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
    assertStatusTransitionAllowed(meta.status, status, taskId);
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

function appendTaskNote(workspaceRoot, taskId, note, options = {}) {
  const files = taskFiles(workspaceRoot, taskId);
  if (!fileExists(files.meta)) {
    throw notFound(`Task ${taskId} does not exist yet.`, "task_not_found");
  }

  const noteText = isNonEmptyString(note) ? note.trim() : "";
  if (!noteText) {
    throw badRequest('Task note must be a non-empty "note" string.', "task_note_required");
  }

  const { taskMeta } = ensureTaskArtifacts(workspaceRoot, taskId, {
    context: true,
  });
  const timestamp = isNonEmptyString(options.timestamp)
    ? options.timestamp.trim()
    : new Date().toISOString();
  const appended = appendTaskContextNote(files, noteText, timestamp);

  taskMeta.updatedAt = timestamp;
  writeJson(files.meta, taskMeta);

  return {
    taskId,
    note: appended.note,
    timestamp: appended.timestamp,
    contextText: appended.content,
    contextPath: `.agent-workflow/tasks/${taskId}/context.md`,
    updatedAt: taskMeta.updatedAt,
  };
}

function recordRun(workspaceRoot, taskId, summary, status, agent = "manual", fields = {}, options = {}) {
  const undoType = isNonEmptyString(options.undoType) ? options.undoType.trim() : "";
  const restoreSnapshots = undoType ? captureTaskRestoreSnapshots(workspaceRoot, taskId) : null;
  const strictVerification = resolveStrictVerification(workspaceRoot, options.strict);
  const resolvedDefaults = resolveRunSmartDefaults(workspaceRoot, status, normalizeRunFields(fields));
  const run = createRunRecord(taskId, {
    agent,
    status: resolvedDefaults.status,
    summary,
    ...resolvedDefaults.fields,
  });

  const persistedRun = attachRunRuntimeMetadata(
    persistRunRecord(workspaceRoot, taskId, run, {
      strict: strictVerification,
    }),
    resolvedDefaults
  );

  if (undoType) {
    const runFile = `.agent-workflow/tasks/${taskId}/runs/${persistedRun.id}.json`;
    const undoRestoreSnapshots = restoreSnapshots.concat([
      {
        path: runFile,
        kind: "file",
        existed: false,
      },
    ]);
    appendUndoEntry(workspaceRoot, {
      type: undoType,
      taskId,
      files: buildUndoFileList(undoRestoreSnapshots),
      metadata: {
        restore: undoRestoreSnapshots,
        runFile,
        runId: persistedRun.id,
      },
    });
  }

  return persistedRun;
}

function recordActivity(workspaceRoot, taskId, activity, fields = {}) {
  const record = createActivityRecord(taskId, {
    activity,
    createdAt: fields && fields.createdAt,
    filesModified: fields && fields.filesModified,
    id: fields && fields.id,
    metadata: fields && fields.metadata,
  });

  return persistActivityRecord(workspaceRoot, taskId, record);
}

module.exports = {
  appendTaskNote,
  createRunRecord,
  createActivityRecord,
  createTask,
  getRunLog,
  getTaskDetail,
  listActivityRecords,
  listRuns,
  listTasks,
  normalizeTaskScaffoldMode,
  persistActivityRecord,
  persistRunRecord,
  recordActivity,
  recordRun,
  updateTaskMeta,
};

function safeRead(filePath) {
  return fileExists(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function listTaskRecords(workspaceRoot, taskId, filePrefix, normalizer) {
  const targetRoot = runsRoot(workspaceRoot, taskId);
  if (!fs.existsSync(targetRoot)) {
    return [];
  }

  return fs
    .readdirSync(targetRoot, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith(filePrefix) &&
        entry.name.endsWith(RECORD_FILE_EXTENSION)
    )
    .map((entry) => normalizer(readJson(path.join(targetRoot, entry.name), null), entry.name))
    .filter(Boolean)
    .sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")));
}

function normalizeRunFields(fields = {}) {
  const input = fields && typeof fields === "object" ? fields : {};
  const nextFields = { ...input };
  const evidenceContext = normalizeEvidenceContext(input.evidenceContext);

  if (
    evidenceContext &&
    nextFields.scopeProofPaths === undefined &&
    Array.isArray(evidenceContext.filesModified) &&
    evidenceContext.filesModified.length > 0
  ) {
    nextFields.scopeProofPaths = evidenceContext.filesModified.slice();
  }

  if (evidenceContext !== undefined) {
    nextFields.evidenceContext = evidenceContext;
  } else {
    delete nextFields.evidenceContext;
  }

  return nextFields;
}

function resolveRunSmartDefaults(workspaceRoot, status, fields = {}) {
  const input = fields && typeof fields === "object" ? fields : {};
  const inferenceOptions = input.smartDefaultOptions || {};
  const nextFields = omitUndefined(
    input,
    new Set(["collectorResults", "inferScopeProofPaths", "inferTestStatus", "skipInferTest", "smartDefaultOptions"])
  );
  const messages = [];
  const explicitStatus = isNonEmptyString(status) ? status.trim() : "";
  const explicitScopeProofPaths = input.scopeProofPaths !== undefined;
  const explicitVerificationChecks = input.verificationChecks !== undefined;
  let inferredStatus = "";

  if (input.inferScopeProofPaths !== false && !explicitScopeProofPaths) {
    const inferredProofPaths = inferProofPathsResult(workspaceRoot, inferenceOptions);
    messages.push(...inferredProofPaths.messages);
    nextFields.scopeProofPaths = inferredProofPaths.proofPaths;
  }

  if (input.skipInferTest !== true && resolveAutoInferTest(workspaceRoot, input.inferTestStatus)) {
    const inferredCollectors = inferAllTestResultsResult(workspaceRoot, inferenceOptions);
    messages.push(...inferredCollectors.messages);
    if (inferredCollectors.results.length > 0) {
      nextFields.collectorResults = inferredCollectors.results;
      inferredStatus = inferRunStatusFromCollectors(inferredCollectors.results);
      if (!explicitVerificationChecks) {
        nextFields.verificationChecks = inferredCollectors.results.map((result) => ({
          label: result.check,
          status: result.status,
        }));
      }
    }
  }

  return {
    status: explicitStatus || inferredStatus || "draft",
    fields: nextFields,
    messages,
  };
}

function attachRunRuntimeMetadata(run, metadata) {
  if (!run || !metadata) {
    return run;
  }

  Object.defineProperty(run, "smartDefaults", {
    value: {
      messages: Array.isArray(metadata.messages) ? metadata.messages.slice() : [],
    },
    enumerable: false,
    configurable: true,
  });

  return run;
}

function describeFile(name, absolutePath) {
  return {
    name,
    exists: fileExists(absolutePath),
  };
}

function buildGeneratedFiles(workspaceRoot, files) {
  const adapterFiles = listAdapters(workspaceRoot)
    .filter((adapter) => adapter && adapter.exists && adapter.config)
    .flatMap((adapter) => {
      const config = adapter.config;
      return [
        describeFile(config.promptFile, path.join(files.root, config.promptFile)),
        describeFile(config.runRequestFile, path.join(files.root, config.runRequestFile)),
        describeFile(config.launchPackFile, path.join(files.root, config.launchPackFile)),
      ];
    });

  const staticFiles = [
    describeFile("checkpoint.md", files.checkpoint),
    describeFile("task.md", files.task),
    describeFile("context.md", files.context),
    describeFile("verification.md", files.verification),
  ];

  return Array.from(
    new Map(adapterFiles.concat(staticFiles).map((file) => [file.name, file])).values()
  );
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

function createActivityRecord(taskId, fields = {}) {
  const activity = isNonEmptyString(fields.activity) ? fields.activity.trim() : "";
  if (!activity) {
    throw badRequest('Activity record requires a non-empty "activity" string.', "activity_required");
  }

  const createdAt = isNonEmptyString(fields.createdAt) ? fields.createdAt.trim() : new Date().toISOString();
  const filesModified = normalizeProofPathList(fields.filesModified, "filesModified");
  const metadata = normalizeActivityMetadata(fields.metadata);

  return omitUndefined({
    id: isNonEmptyString(fields.id) ? fields.id.trim() : `activity-${Date.now()}`,
    type: "activity",
    taskId,
    activity,
    createdAt,
    filesModified: filesModified.length > 0 ? filesModified : undefined,
    metadata,
  });
}

function persistRunRecord(workspaceRoot, taskId, run, options = {}) {
  const { files, taskMeta: meta } = ensureTaskArtifacts(workspaceRoot, taskId, {
    task: true,
    context: true,
    verification: true,
    runs: true,
  });
  const existingRuns = listRuns(workspaceRoot, taskId);
  const taskText = safeRead(files.task);
  const strictVerification = resolveStrictVerification(workspaceRoot, options.strict);
  const repositorySnapshot = loadRepositorySnapshot(workspaceRoot, {
    strict: strictVerification,
  });
  const gateBeforePersist = buildTaskVerificationGate(workspaceRoot, meta, existingRuns, repositorySnapshot, taskText, {
    strict: strictVerification,
  });
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
    run.scopeProofPaths !== undefined ? run.scopeProofPaths : inferredScopeProofPaths
  );
  const verificationChecks = normalizeVerificationChecks(
    run.verificationChecks,
    defaultCheckStatusForRunStatus(run.status)
  );
  const verificationArtifacts = normalizeArtifactRefs(run.verificationArtifacts);
  const collectorResults = normalizeCollectorResults(run.collectorResults);
  const scopeProofAnchors =
    strictVerification && run.status === "passed" && scopeProofPaths.length > 0
      ? normalizeProofAnchors(
          Array.isArray(run.scopeProofAnchors) && run.scopeProofAnchors.length > 0
            ? run.scopeProofAnchors
            : buildScopeProofAnchors(workspaceRoot, scopeProofPaths, repositorySnapshot, {
                strict: strictVerification,
              }),
          {
            strict: strictVerification,
          }
        )
      : [];
  const persistableRun = { ...run };
  delete persistableRun.collectorResults;
  const evidence = buildRunEvidence(scopeProofPaths, verificationChecks, collectorResults);

  const persistedRun = {
    ...persistableRun,
    taskId,
    scopeProofPaths: scopeProofPaths.length > 0 ? scopeProofPaths : undefined,
    scopeProofAnchors: scopeProofAnchors.length > 0 ? scopeProofAnchors : undefined,
    verificationChecks: verificationChecks.length > 0 ? verificationChecks : undefined,
    verificationArtifacts: verificationArtifacts.length > 0 ? verificationArtifacts : undefined,
    evidence,
  };

  fs.mkdirSync(files.runs, { recursive: true });
  writeJson(path.join(files.runs, `${persistedRun.id}.json`), persistedRun);
  appendText(files.verification, renderVerificationEvidence(persistedRun));

  const updatedAt = persistedRun.completedAt || persistedRun.createdAt || new Date().toISOString();
  const nextMeta = {
    ...meta,
    updatedAt,
  };
  const autoAdvancedTaskStatus = nextMeta.status === "todo";

  if (autoAdvancedTaskStatus) {
    nextMeta.status = "in_progress";
  }

  writeJson(files.meta, nextMeta);

  if (autoAdvancedTaskStatus) {
    syncManagedTaskDocs(files, nextMeta, getRecipe(workspaceRoot, nextMeta.recipeId));
  }

  return persistedRun;
}

function persistActivityRecord(workspaceRoot, taskId, activityRecord) {
  const { files, taskMeta } = ensureTaskArtifacts(workspaceRoot, taskId, {
    runs: true,
  });
  const persistedRecord = createActivityRecord(taskId, activityRecord);

  fs.mkdirSync(files.runs, { recursive: true });
  writeJson(path.join(files.runs, `${persistedRecord.id}.json`), persistedRecord);

  const updatedAt = persistedRecord.createdAt || new Date().toISOString();
  writeJson(files.meta, {
    ...taskMeta,
    updatedAt,
  });

  return persistedRecord;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function inferRunStatusFromCollectors(results) {
  const normalized = normalizeCollectorResults(results);
  if (normalized.some((result) => result.status === "failed")) {
    return "failed";
  }

  return normalized.some((result) => result.status === "passed") ? "passed" : "";
}

function normalizeCollectorResults(values) {
  return (Array.isArray(values) ? values : [values]).map(normalizeCollectorResult).filter(Boolean);
}

function normalizeCollectorResult(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const collectorId = isNonEmptyString(value.collectorId) ? value.collectorId.trim() : "";
  const status = value.status === "passed" || value.status === "failed" ? value.status : "";
  const check = isNonEmptyString(value.check) ? value.check.trim() : "";
  const durationMs = Number.isInteger(value.durationMs) && value.durationMs >= 0 ? value.durationMs : 0;

  if (!collectorId || !status || !check) {
    return null;
  }

  return {
    collectorId,
    status,
    check,
    durationMs,
  };
}

function buildRunEvidence(scopeProofPaths, verificationChecks, collectorResults) {
  const evidence = {};

  if (scopeProofPaths.length > 0) {
    evidence.proofPaths = scopeProofPaths;
  }

  if (verificationChecks.length > 0) {
    evidence.checks = verificationChecks;
  }

  if (collectorResults.length > 0) {
    evidence.collectors = collectorResults;
  }

  return Object.keys(evidence).length > 0 ? evidence : undefined;
}

function normalizeTaskScaffoldMode(value) {
  const mode = String(value || "full").trim().toLowerCase() || "full";
  if (!TASK_SCAFFOLD_MODES.has(mode)) {
    throw badRequest(`Unsupported task scaffold mode: ${value}`, "unsupported_task_scaffold_mode");
  }
  return mode;
}

function assertStatusTransitionAllowed(currentStatus, nextStatus, taskId) {
  if (currentStatus === "done" && nextStatus !== "done") {
    throw conflict(
      `Task ${taskId} is already done and cannot regress to ${nextStatus}.`,
      "task_status_regression"
    );
  }
}

function omitUndefined(value, excludedKeys) {
  const blockedKeys = excludedKeys instanceof Set ? excludedKeys : new Set();
  return Object.fromEntries(
    Object.entries(value || {}).filter(
      ([key, entryValue]) => !blockedKeys.has(key) && entryValue !== undefined
    )
  );
}

function renderVerificationEvidence(run) {
  const timestamp = run.completedAt || run.createdAt || new Date().toISOString();
  const evidenceContext = normalizeEvidenceContext(run.evidenceContext);
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
    [
      "Evidence context files modified",
      evidenceContext && Array.isArray(evidenceContext.filesModified) && evidenceContext.filesModified.length > 0
        ? evidenceContext.filesModified.join(", ")
        : undefined,
    ],
    [
      "Evidence context commands run",
      evidenceContext && Array.isArray(evidenceContext.commandsRun) && evidenceContext.commandsRun.length > 0
        ? evidenceContext.commandsRun.join(" | ")
        : undefined,
    ],
    [
      "Evidence context tool call count",
      evidenceContext && evidenceContext.toolCallCount !== undefined ? evidenceContext.toolCallCount : undefined,
    ],
    [
      "Evidence context session duration ms",
      evidenceContext && evidenceContext.sessionDurationMs !== undefined
        ? evidenceContext.sessionDurationMs
        : undefined,
    ],
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

function normalizeActivityRecordForRead(value, fileName = "") {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    const activity = isNonEmptyString(value.activity) ? value.activity.trim() : "";
    const taskId = isNonEmptyString(value.taskId) ? value.taskId.trim() : "";
    const createdAt = isNonEmptyString(value.createdAt) ? value.createdAt.trim() : "";
    const normalizedId =
      isNonEmptyString(value.id) ? value.id.trim() : String(fileName || "").replace(/\.json$/i, "");

    if (!activity || !taskId || !createdAt || !normalizedId) {
      return null;
    }

    const filesModified = normalizeProofPathList(value.filesModified, "filesModified");
    const metadata = normalizeActivityMetadata(value.metadata);

    return omitUndefined({
      id: normalizedId,
      type: "activity",
      taskId,
      activity,
      createdAt,
      filesModified: filesModified.length > 0 ? filesModified : undefined,
      metadata,
    });
  } catch (error) {
    return null;
  }
}

function normalizeEvidenceContext(value) {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest('"evidenceContext" must be an object.', "evidence_context_invalid");
  }

  const unknownKeys = Object.keys(value).filter((key) => !EVIDENCE_CONTEXT_KEYS.has(key));
  if (unknownKeys.length > 0) {
    throw badRequest(
      `evidenceContext contains unsupported field(s): ${unknownKeys.join(", ")}.`,
      "evidence_context_invalid"
    );
  }

  const filesModified = normalizeProofPathList(value.filesModified, "evidenceContext.filesModified");
  const commandsRun = normalizeStringList(value.commandsRun, "evidenceContext.commandsRun");
  const toolCallCount = normalizeNonNegativeInteger(value.toolCallCount, "evidenceContext.toolCallCount");
  const sessionDurationMs = normalizeNonNegativeInteger(
    value.sessionDurationMs,
    "evidenceContext.sessionDurationMs"
  );

  const normalized = omitUndefined({
    filesModified: filesModified.length > 0 ? filesModified : undefined,
    commandsRun: commandsRun.length > 0 ? commandsRun : undefined,
    toolCallCount,
    sessionDurationMs,
  });

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeActivityMetadata(value) {
  if (value === undefined) {
    return undefined;
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest('"metadata" must be an object.', "activity_metadata_invalid");
  }

  const normalized = Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      key,
      normalizeActivityMetadataValue(entryValue, `metadata.${key}`),
    ])
  );

  return Object.keys(normalized).length > 0 ? normalized : undefined;
}

function normalizeActivityMetadataValue(value, fieldPath) {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeActivityMetadataScalar(item, `${fieldPath}[${index}]`));
  }

  throw badRequest(
    `${fieldPath} must be a string, boolean, number, null, or array of those values.`,
    "activity_metadata_invalid"
  );
}

function normalizeActivityMetadataScalar(value, fieldPath) {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  throw badRequest(
    `${fieldPath} must be a string, boolean, number, or null.`,
    "activity_metadata_invalid"
  );
}

function normalizeProofPathList(value, fieldPath) {
  if (value === undefined) {
    return [];
  }

  const entries = Array.isArray(value) ? value : [value];
  return Array.from(
    new Set(
      entries.map((entry) => {
        if (!isNonEmptyString(entry)) {
          throw badRequest(`${fieldPath} must contain non-empty strings.`, "task_record_invalid");
        }

        const normalized = normalizeProofPaths([entry]);
        if (normalized.length !== 1) {
          throw badRequest(`${fieldPath} must contain repo-relative paths.`, "task_record_invalid");
        }

        return normalized[0];
      })
    )
  );
}

function normalizeStringList(value, fieldPath) {
  if (value === undefined) {
    return [];
  }

  const entries = Array.isArray(value) ? value : [value];
  return Array.from(
    new Set(
      entries.map((entry) => {
        if (!isNonEmptyString(entry)) {
          throw badRequest(`${fieldPath} must contain non-empty strings.`, "task_record_invalid");
        }

        return entry.trim();
      })
    )
  );
}

function normalizeNonNegativeInteger(value, fieldPath) {
  if (value === undefined) {
    return undefined;
  }

  if (!Number.isInteger(value) || value < 0) {
    throw badRequest(`${fieldPath} must be a non-negative integer.`, "task_record_invalid");
  }

  return value;
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

