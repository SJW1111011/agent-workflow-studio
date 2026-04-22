const path = require("path");
const { normalizeAdapterId } = require("./adapters");
const { buildCheckpoint } = require("./checkpoint");
const { recordDone } = require("./done");
const { badRequest } = require("./http-errors");
const { buildOverview } = require("./overview");
const { formatQuickTaskSummary, quickCreateTask } = require("./quick-task");
const { validateWorkspace } = require("./schema-validator");
const {
  appendTaskNote,
  listRuns,
  listTasks,
  recordActivity,
  recordRun,
  updateTaskMeta,
} = require("./task-service");
const { formatUndoSummary, undoLastOperation } = require("./undo");

const RUN_STATUSES = new Set(["passed", "failed", "draft"]);
const QUICK_MODES = new Set(["full", "lite"]);
const TASK_PRIORITIES = Object.freeze(["P0", "P1", "P2", "P3"]);
const TASK_STATUSES = Object.freeze(["todo", "in_progress", "blocked", "done"]);

const TOOL_DEFINITIONS = Object.freeze([
  {
    name: "workflow_quick",
    description: "Create a workflow task in full or lite mode using the same durable task flow as the CLI quick command.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        title: {
          type: "string",
          description: "Task title.",
        },
        taskId: {
          type: "string",
          description: "Optional explicit task id such as T-001.",
        },
        priority: {
          type: "string",
          enum: ["P0", "P1", "P2", "P3"],
          description: "Optional task priority.",
        },
        recipe: {
          type: "string",
          description: "Recipe id. Defaults to feature.",
        },
        recipeId: {
          type: "string",
          description: "Alias for recipe.",
        },
        agent: {
          type: "string",
          description: "Prompt target or adapter id. Built-ins: codex or claude.",
        },
        mode: {
          type: "string",
          enum: ["full", "lite"],
          description: "Scaffold mode. Defaults to full.",
        },
      },
      required: ["title"],
    },
  },
  {
    name: "workflow_done",
    description:
      "Record run evidence and refresh the checkpoint in one step, inferring proof paths from git diff by default and running matching test collectors unless you override that behavior.",
    inputSchema: buildManualRunInputSchema({
      includeComplete: true,
      includeEvidenceContext: true,
    }),
  },
  {
    name: "workflow_record_activity",
    description:
      "Record a timestamped activity breadcrumb for a task without refreshing its checkpoint or changing status.",
    inputSchema: buildActivityInputSchema(),
  },
  {
    name: "workflow_update_task",
    description: "Update a task title, priority, or status mid-execution and refresh its checkpoint.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        taskId: {
          type: "string",
          description: "Task id such as T-001.",
        },
        title: {
          type: "string",
          description: "Optional task title update.",
        },
        priority: {
          type: "string",
          enum: TASK_PRIORITIES,
          description: "Optional task priority update.",
        },
        status: {
          type: "string",
          enum: TASK_STATUSES,
          description: "Optional task status update.",
        },
      },
      required: ["taskId"],
    },
  },
  {
    name: "workflow_append_note",
    description: "Append a timestamped progress note to a task context and refresh its checkpoint.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        taskId: {
          type: "string",
          description: "Task id such as T-001.",
        },
        note: {
          type: "string",
          description: "Progress note text to append.",
        },
      },
      required: ["taskId", "note"],
    },
  },
  {
    name: "workflow_task_list",
    description: "List workflow tasks with status, priority, run counts, and latest run information.",
    inputSchema: emptyInputSchema(),
  },
  {
    name: "workflow_run_add",
    description:
      "Record a manual run with optional proof paths, checks, and artifacts, inferring proof paths from git diff by default and running matching test collectors unless you override that behavior.",
    inputSchema: buildManualRunInputSchema(),
  },
  {
    name: "workflow_checkpoint",
    description: "Refresh a task checkpoint from the current durable workflow state.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        taskId: {
          type: "string",
          description: "Task id such as T-001.",
        },
        strict: {
          type: "boolean",
          description: "Enable strict fingerprint-backed verification for this checkpoint refresh.",
        },
      },
      required: ["taskId"],
    },
  },
  {
    name: "workflow_undo",
    description: "Undo the most recent workflow-layer operation recorded in the undo log.",
    inputSchema: emptyInputSchema(),
  },
  {
    name: "workflow_validate",
    description: "Validate the current workspace workflow scaffold, adapters, tasks, and recorded runs.",
    inputSchema: {
      type: "object",
      additionalProperties: false,
      properties: {
        strict: {
          type: "boolean",
          description: "Report the effective strict verification mode alongside the validation result.",
        },
      },
    },
  },
  {
    name: "workflow_overview",
    description: "Return the current workspace overview, including tasks, risks, runs, memory freshness, and validation state.",
    inputSchema: emptyInputSchema(),
  },
]);

function createMcpToolRuntime(workspaceRoot) {
  return {
    workspaceRoot,
    listTools() {
      return TOOL_DEFINITIONS.map((tool) => ({
        ...tool,
        inputSchema: cloneJson(tool.inputSchema),
      }));
    },
    async invokeTool(name, argumentsValue) {
      const toolName = String(name || "").trim();
      const args = normalizeToolArguments(argumentsValue);

      switch (toolName) {
        case "workflow_quick":
          return runQuickTool(workspaceRoot, args);
        case "workflow_done":
          return runDoneTool(workspaceRoot, args);
        case "workflow_record_activity":
          return runRecordActivityTool(workspaceRoot, args);
        case "workflow_update_task":
          return runUpdateTaskTool(workspaceRoot, args);
        case "workflow_append_note":
          return runAppendNoteTool(workspaceRoot, args);
        case "workflow_task_list":
          return runTaskListTool(workspaceRoot, args);
        case "workflow_run_add":
          return runRunAddTool(workspaceRoot, args);
        case "workflow_checkpoint":
          return runCheckpointTool(workspaceRoot, args);
        case "workflow_undo":
          return runUndoTool(workspaceRoot, args);
        case "workflow_validate":
          return runValidateTool(workspaceRoot, args);
        case "workflow_overview":
          return runOverviewTool(workspaceRoot, args);
        default:
          throw badRequest(`Unknown MCP tool: ${toolName}`, "mcp_tool_not_found");
      }
    },
    async callTool(name, argumentsValue) {
      try {
        const payload = await this.invokeTool(name, argumentsValue);
        return buildToolCallResult(payload);
      } catch (error) {
        return buildToolErrorResult(error);
      }
    },
  };
}

async function executeMcpTool(workspaceRoot, name, argumentsValue) {
  return createMcpToolRuntime(workspaceRoot).invokeTool(name, argumentsValue);
}

async function callMcpTool(workspaceRoot, name, argumentsValue) {
  return createMcpToolRuntime(workspaceRoot).callTool(name, argumentsValue);
}

function buildToolCallResult(payload) {
  const normalizedPayload = decorateEvidenceVocabulary(payload);
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(normalizedPayload, null, 2),
      },
    ],
  };
}

function buildToolErrorResult(error) {
  const payload = buildToolErrorPayload(error);
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: JSON.stringify(payload, null, 2),
      },
    ],
  };
}

function runQuickTool(workspaceRoot, args) {
  assertKnownKeys(
    args,
    ["agent", "mode", "priority", "recipe", "recipeId", "taskId", "title"],
    "workflow_quick"
  );

  const title = requireNonEmptyString(args, "title", "workflow_quick");
  const mode = normalizeQuickMode(args.mode);
  const result = quickCreateTask(workspaceRoot, title, {
    taskId: optionalTrimmedString(args.taskId),
    priority: optionalTrimmedString(args.priority),
    recipe: optionalTrimmedString(args.recipeId) || optionalTrimmedString(args.recipe),
    agent: optionalTrimmedString(args.agent),
    mode,
  });

  return {
    ok: true,
    tool: "workflow_quick",
    workspaceRoot,
    taskId: result.taskId,
    title: result.title,
    priority: result.priority,
    recipeId: result.recipeId,
    mode: result.mode,
    agent: result.agent,
    adapterId: result.adapterId,
    taskPath: `.agent-workflow/tasks/${result.taskId}/task.md`,
    promptPath: result.prompt ? toWorkspaceRelativePath(workspaceRoot, result.prompt.outputPath) : null,
    runRequestPath: result.prepared ? toWorkspaceRelativePath(workspaceRoot, result.prepared.runRequestPath) : null,
    launchPackPath: result.prepared ? toWorkspaceRelativePath(workspaceRoot, result.prepared.launchPackPath) : null,
    checkpointPath:
      result.mode === "full" ? `.agent-workflow/tasks/${result.taskId}/checkpoint.md` : null,
    summary: formatQuickTaskSummary(result),
  };
}

function runDoneTool(workspaceRoot, args) {
  assertKnownKeys(
    args,
    [
      "agent",
      "artifacts",
      "checks",
      "complete",
      "evidenceContext",
      "inferScopeProofPaths",
      "inferTestStatus",
      "proofPaths",
      "scopeProofPaths",
      "skipTest",
      "skipInferTest",
      "status",
      "strict",
      "summary",
      "taskId",
      "verificationArtifacts",
      "verificationChecks",
    ],
    "workflow_done"
  );

  const taskId = requireNonEmptyString(args, "taskId", "workflow_done");
  const summary = requireNonEmptyString(args, "summary", "workflow_done");
  const result = recordDone(workspaceRoot, taskId, summary, {
    status: normalizeRunStatus(args.status),
    agent: normalizeAdapterId(optionalTrimmedString(args.agent) || "manual"),
    complete: optionalBoolean(args.complete, "complete"),
    strict: optionalBoolean(args.strict, "strict"),
    evidenceContext: args.evidenceContext,
    ...buildManualRunOptions(args, "workflow_done"),
  });

  return {
    ok: true,
    tool: "workflow_done",
    workspaceRoot,
    taskId,
    run: result.run,
    smartDefaultMessages: getSmartDefaultMessages(result.run),
    checkpoint: result.checkpoint,
    checkpointPath: `.agent-workflow/tasks/${taskId}/checkpoint.md`,
    task: result.task || null,
  };
}

function runRecordActivityTool(workspaceRoot, args) {
  assertKnownKeys(args, ["activity", "filesModified", "metadata", "taskId"], "workflow_record_activity");

  const taskId = requireNonEmptyString(args, "taskId", "workflow_record_activity");
  const activity = requireNonEmptyString(args, "activity", "workflow_record_activity");
  const activityRecord = recordActivity(workspaceRoot, taskId, activity, {
    filesModified: args.filesModified,
    metadata: args.metadata,
  });

  return {
    ok: true,
    tool: "workflow_record_activity",
    workspaceRoot,
    taskId,
    activityRecord,
    activityPath: `.agent-workflow/tasks/${taskId}/runs/${activityRecord.id}.json`,
  };
}

function runUpdateTaskTool(workspaceRoot, args) {
  assertKnownKeys(args, ["priority", "status", "taskId", "title"], "workflow_update_task");

  const taskId = requireNonEmptyString(args, "taskId", "workflow_update_task");
  const task = updateTaskMeta(workspaceRoot, taskId, {
    title: optionalTrimmedString(args.title) || undefined,
    priority: optionalTrimmedString(args.priority) || undefined,
    status: optionalTrimmedString(args.status) || undefined,
  });
  const checkpoint = buildCheckpoint(workspaceRoot, taskId);

  return {
    ok: true,
    tool: "workflow_update_task",
    workspaceRoot,
    taskId,
    task,
    checkpoint,
    checkpointPath: `.agent-workflow/tasks/${taskId}/checkpoint.md`,
  };
}

function runAppendNoteTool(workspaceRoot, args) {
  assertKnownKeys(args, ["note", "taskId"], "workflow_append_note");

  const taskId = requireNonEmptyString(args, "taskId", "workflow_append_note");
  const note = requireNonEmptyString(args, "note", "workflow_append_note");
  const appended = appendTaskNote(workspaceRoot, taskId, note);
  const checkpoint = buildCheckpoint(workspaceRoot, taskId);

  return {
    ok: true,
    tool: "workflow_append_note",
    workspaceRoot,
    taskId,
    note: appended.note,
    timestamp: appended.timestamp,
    contextPath: appended.contextPath,
    checkpoint,
    checkpointPath: `.agent-workflow/tasks/${taskId}/checkpoint.md`,
  };
}

function runTaskListTool(workspaceRoot, args) {
  assertKnownKeys(args, [], "workflow_task_list");

  const tasks = listTasks(workspaceRoot).map((task) => {
    const runs = listRuns(workspaceRoot, task.id);
    const latestRun = runs[runs.length - 1] || null;

    return {
      id: task.id,
      title: task.title,
      priority: task.priority,
      status: task.status,
      recipeId: task.recipeId || "feature",
      runCount: task.runCount,
      latestRunStatus: latestRun ? latestRun.status : "none",
      latestRunSummary: latestRun ? latestRun.summary : "No runs yet",
      updatedAt: task.updatedAt || null,
    };
  });

  return {
    ok: true,
    tool: "workflow_task_list",
    workspaceRoot,
    count: tasks.length,
    tasks,
  };
}

function runRunAddTool(workspaceRoot, args) {
  assertKnownKeys(
    args,
    [
      "agent",
      "artifacts",
      "checks",
      "inferScopeProofPaths",
      "inferTestStatus",
      "proofPaths",
      "scopeProofPaths",
      "skipTest",
      "skipInferTest",
      "status",
      "strict",
      "summary",
      "taskId",
      "verificationArtifacts",
      "verificationChecks",
    ],
    "workflow_run_add"
  );

  const taskId = requireNonEmptyString(args, "taskId", "workflow_run_add");
  const summary = requireNonEmptyString(args, "summary", "workflow_run_add");
  const run = recordRun(
    workspaceRoot,
    taskId,
    summary,
    normalizeRunStatus(args.status),
    normalizeAdapterId(optionalTrimmedString(args.agent) || "manual"),
    buildManualRunOptions(args, "workflow_run_add"),
    {
      undoType: "run:add",
      strict: optionalBoolean(args.strict, "strict"),
    }
  );
  const checkpoint = buildCheckpoint(workspaceRoot, taskId, {
    strict: optionalBoolean(args.strict, "strict"),
  });

  return {
    ok: true,
    tool: "workflow_run_add",
    workspaceRoot,
    taskId,
    run,
    smartDefaultMessages: getSmartDefaultMessages(run),
    checkpoint,
    checkpointPath: `.agent-workflow/tasks/${taskId}/checkpoint.md`,
  };
}

function runCheckpointTool(workspaceRoot, args) {
  assertKnownKeys(args, ["strict", "taskId"], "workflow_checkpoint");
  const taskId = requireNonEmptyString(args, "taskId", "workflow_checkpoint");
  const checkpoint = buildCheckpoint(workspaceRoot, taskId, {
    logUndo: true,
    strict: optionalBoolean(args.strict, "strict"),
  });

  return {
    ok: true,
    tool: "workflow_checkpoint",
    workspaceRoot,
    taskId,
    checkpoint,
    checkpointPath: `.agent-workflow/tasks/${taskId}/checkpoint.md`,
  };
}

function runUndoTool(workspaceRoot, args) {
  assertKnownKeys(args, [], "workflow_undo");
  const result = undoLastOperation(workspaceRoot);

  return {
    ok: result.undone === true,
    tool: "workflow_undo",
    workspaceRoot,
    undone: result.undone === true,
    target: result.target || null,
    files: Array.isArray(result.files) ? result.files.slice() : [],
    message: result.message,
    summary: formatUndoSummary(result),
  };
}

function runValidateTool(workspaceRoot, args) {
  assertKnownKeys(args, ["strict"], "workflow_validate");
  const report = validateWorkspace(workspaceRoot, {
    strict: optionalBoolean(args.strict, "strict"),
  });

  return {
    ok: report.ok === true,
    tool: "workflow_validate",
    workspaceRoot,
    summary: `ok=${report.ok} errors=${report.errorCount} warnings=${report.warningCount} strict=${report.strictVerification}`,
    ...report,
  };
}

function runOverviewTool(workspaceRoot, args) {
  assertKnownKeys(args, [], "workflow_overview");
  return {
    ok: true,
    tool: "workflow_overview",
    ...buildOverview(workspaceRoot),
  };
}

function buildManualRunOptions(args, toolName) {
  const proofPaths = mergeAliasedLists(args, ["proofPaths", "scopeProofPaths"], "string", toolName);
  const checks = mergeAliasedLists(
    args,
    ["checks", "verificationChecks"],
    "string-or-object",
    toolName
  );
  const artifacts = mergeAliasedLists(
    args,
    ["artifacts", "verificationArtifacts"],
    "string",
    toolName
  );
  const skipInferTest = resolveAliasedBoolean(args, ["skipTest", "skipInferTest"], toolName);

  return {
    scopeProofPaths: proofPaths.provided ? proofPaths.value : undefined,
    verificationChecks: checks.provided ? checks.value : undefined,
    verificationArtifacts: artifacts.provided ? artifacts.value : undefined,
    inferScopeProofPaths: inferBooleanArgument(
      args,
      "inferScopeProofPaths",
      proofPaths.provided ? false : true
    ),
    inferTestStatus: optionalBoolean(args.inferTestStatus, "inferTestStatus"),
    skipInferTest,
  };
}

function buildManualRunInputSchema(options = {}) {
  const includeComplete = options.includeComplete === true;
  const includeEvidenceContext = options.includeEvidenceContext === true;
  const properties = {
    taskId: {
      type: "string",
      description: "Task id such as T-001.",
    },
    summary: {
      type: "string",
      description: "Short evidence summary.",
    },
    status: {
      type: "string",
      enum: Array.from(RUN_STATUSES),
      description: "Run status. Defaults to draft unless inferred.",
    },
    agent: {
      type: "string",
      description: "Agent or adapter id. Defaults to manual.",
    },
    strict: {
      type: "boolean",
      description: "Enable strict fingerprint-backed verification instead of the default timestamp-based mode.",
    },
    proofPaths: {
      type: "array",
      description: "Optional repo-relative proof paths. Alias: scopeProofPaths. When omitted, the current git diff is used by default.",
      items: {
        type: "string",
      },
    },
    scopeProofPaths: {
      type: "array",
      description: "Alias for proofPaths. When omitted, the current git diff is used by default.",
      items: {
        type: "string",
      },
    },
    checks: {
      type: "array",
      description: "Optional verification checks. Each entry can be a string label or an object with label/status/details/artifacts.",
      items: {},
    },
    verificationChecks: {
      type: "array",
      description: "Alias for checks.",
      items: {},
    },
    artifacts: {
      type: "array",
      description: "Optional repo-relative artifact paths. Alias: verificationArtifacts.",
      items: {
        type: "string",
      },
    },
    verificationArtifacts: {
      type: "array",
      description: "Alias for artifacts.",
      items: {
        type: "string",
      },
    },
    inferScopeProofPaths: {
      type: "boolean",
      description: "Infer proof paths from the current repository snapshot when proof paths are not provided.",
    },
    inferTestStatus: {
      type: "boolean",
      description:
        "Optional per-call override for inferred test-collector execution. True forces it for this call; false disables it even if project.json autoInferTest is true.",
    },
    skipTest: {
      type: "boolean",
      description:
        "Preferred alias for skipInferTest. Skip inferred test collectors even if project.json autoInferTest or inferTestStatus would otherwise run.",
    },
    skipInferTest: {
      type: "boolean",
      description:
        "Legacy alias for skipTest. Skip inferred test collectors even if project.json autoInferTest or inferTestStatus would otherwise run.",
    },
  };

  if (includeComplete) {
    properties.complete = {
      type: "boolean",
      description: "When true, mark the task done after recording evidence.",
    };
  }

  if (includeEvidenceContext) {
    properties.evidenceContext = buildEvidenceContextInputSchema();
  }

  return {
    type: "object",
    additionalProperties: false,
    properties,
    required: ["taskId", "summary"],
  };
}

function buildActivityInputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      taskId: {
        type: "string",
        description: "Task id such as T-001.",
      },
      activity: {
        type: "string",
        description: "Short activity summary such as inspected code, updated tests, or verified behavior.",
      },
      filesModified: {
        type: "array",
        description: "Optional repo-relative files touched during this activity breadcrumb.",
        items: {
          type: "string",
        },
      },
      metadata: buildActivityMetadataSchema(),
    },
    required: ["taskId", "activity"],
  };
}

function buildEvidenceContextInputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    description:
      "Optional structured execution context that captures files changed, commands run, tool usage, and session duration.",
    properties: {
      filesModified: {
        type: "array",
        description: "Repo-relative files the agent changed during the session.",
        items: {
          type: "string",
        },
      },
      commandsRun: {
        type: "array",
        description: "Commands the agent executed during the session.",
        items: {
          type: "string",
        },
      },
      toolCallCount: {
        type: "integer",
        minimum: 0,
        description: "How many tool calls the agent made.",
      },
      sessionDurationMs: {
        type: "integer",
        minimum: 0,
        description: "How long the session lasted in milliseconds.",
      },
    },
  };
}

function buildActivityMetadataSchema() {
  const primitiveValueSchema = {
    anyOf: [
      { type: "string" },
      { type: "number" },
      { type: "boolean" },
      { type: "null" },
    ],
  };

  return {
    type: "object",
    description: "Optional flat metadata for the activity breadcrumb.",
    additionalProperties: {
      anyOf: [
        primitiveValueSchema,
        {
          type: "array",
          items: primitiveValueSchema,
        },
      ],
    },
  };
}

function emptyInputSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {},
  };
}

function normalizeToolArguments(argumentsValue) {
  if (argumentsValue === undefined || argumentsValue === null) {
    return {};
  }

  if (Array.isArray(argumentsValue) || typeof argumentsValue !== "object") {
    throw badRequest("MCP tool arguments must be a JSON object.", "mcp_arguments_invalid");
  }

  return argumentsValue;
}

function assertKnownKeys(args, allowedKeys, toolName) {
  const allowed = new Set(allowedKeys);
  const unknownKeys = Object.keys(args).filter((key) => !allowed.has(key));

  if (unknownKeys.length > 0) {
    throw badRequest(
      `${toolName} received unsupported argument(s): ${unknownKeys.join(", ")}.`,
      "mcp_arguments_unknown"
    );
  }
}

function requireNonEmptyString(args, key, toolName) {
  const value = optionalTrimmedString(args[key]);
  if (!value) {
    throw badRequest(`${toolName} requires a non-empty "${key}" string.`, "mcp_argument_required");
  }
  return value;
}

function optionalTrimmedString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function optionalBoolean(value, key) {
  if (value === undefined) {
    return undefined;
  }

  if (typeof value !== "boolean") {
    throw badRequest(`"${key}" must be a boolean.`, "mcp_argument_invalid");
  }

  return value;
}

function resolveAliasedBoolean(args, keys, toolName) {
  const presentKeys = keys.filter((key) => Object.prototype.hasOwnProperty.call(args, key));
  if (presentKeys.length === 0) {
    return undefined;
  }

  const values = presentKeys.map((key) => optionalBoolean(args[key], key));
  const firstValue = values[0];

  if (values.some((value) => value !== firstValue)) {
    throw badRequest(
      `${toolName} received conflicting values for ${presentKeys.join(", ")}.`,
      "mcp_argument_invalid"
    );
  }

  return firstValue;
}

function inferBooleanArgument(args, key, fallback) {
  const value = optionalBoolean(args[key], key);
  return value === undefined ? fallback : value;
}

function normalizeQuickMode(value) {
  const normalized = optionalTrimmedString(value).toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (!QUICK_MODES.has(normalized)) {
    throw badRequest(`Unsupported quick mode: ${value}`, "unsupported_quick_mode");
  }

  return normalized;
}

function normalizeRunStatus(value) {
  const normalized = optionalTrimmedString(value).toLowerCase();
  if (!normalized) {
    return undefined;
  }

  if (!RUN_STATUSES.has(normalized)) {
    throw badRequest(`Unsupported run status: ${value}`, "unsupported_run_status");
  }

  return normalized;
}

function mergeAliasedLists(args, keys, itemType, toolName) {
  const presentKeys = keys.filter((key) => Object.prototype.hasOwnProperty.call(args, key));
  if (presentKeys.length === 0) {
    return {
      provided: false,
      value: undefined,
    };
  }

  const values = presentKeys.flatMap((key) => toArray(args[key]));
  const normalized = values.map((value) => normalizeToolListItem(value, itemType, keys[0], toolName));

  return {
    provided: true,
    value: normalized,
  };
}

function normalizeToolListItem(value, itemType, key, toolName) {
  if (itemType === "string") {
    if (typeof value !== "string" || !value.trim()) {
      throw badRequest(
        `${toolName} expects "${key}" values to be non-empty strings.`,
        "mcp_argument_invalid"
      );
    }
    return value.trim();
  }

  if (itemType === "string-or-object") {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }

    if (value && typeof value === "object" && !Array.isArray(value)) {
      return value;
    }

    throw badRequest(
      `${toolName} expects "${key}" values to be strings or objects.`,
      "mcp_argument_invalid"
    );
  }

  throw badRequest(`Unsupported MCP tool item type: ${itemType}`, "mcp_argument_invalid");
}

function toArray(value) {
  if (value === undefined) {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function toWorkspaceRelativePath(workspaceRoot, filePath) {
  if (!filePath) {
    return null;
  }

  return path.relative(workspaceRoot, filePath).replace(/\\/g, "/");
}

function getSmartDefaultMessages(run) {
  return run && run.smartDefaults && Array.isArray(run.smartDefaults.messages)
    ? run.smartDefaults.messages.slice()
    : [];
}

function buildToolErrorPayload(error) {
  const payload = {
    ok: false,
    error: error && error.message ? error.message : "Unknown MCP tool error.",
  };

  if (error && typeof error.code === "string" && error.code.trim()) {
    payload.code = error.code.trim();
  }

  if (error && Number.isInteger(error.statusCode)) {
    payload.statusCode = error.statusCode;
  }

  if (error && typeof error.failureCategory === "string" && error.failureCategory.trim()) {
    payload.failureCategory = error.failureCategory.trim();
  }

  if (error && Array.isArray(error.blockingIssues) && error.blockingIssues.length > 0) {
    payload.blockingIssues = error.blockingIssues;
  }

  if (error && Array.isArray(error.advisories) && error.advisories.length > 0) {
    payload.advisories = error.advisories;
  }

  return payload;
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function decorateEvidenceVocabulary(value) {
  if (Array.isArray(value)) {
    return value.map((item) => decorateEvidenceVocabulary(item));
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const decorated = Object.fromEntries(
    Object.entries(value).map(([key, item]) => [key, decorateEvidenceVocabulary(item)])
  );

  if (typeof decorated.strong === "boolean" && decorated.verified === undefined) {
    decorated.verified = decorated.strong;
  }

  if (typeof decorated.strongProofCount === "number" && decorated.verifiedProofCount === undefined) {
    decorated.verifiedProofCount = decorated.strongProofCount;
  }

  if (typeof decorated.plannedVerificationCheckCount === "number" && decorated.draftCheckCount === undefined) {
    decorated.draftCheckCount = decorated.plannedVerificationCheckCount;
  }

  if (typeof decorated.anchorBackedStrongProofCount === "number" && decorated.currentVerifiedEvidenceCount === undefined) {
    decorated.currentVerifiedEvidenceCount = decorated.anchorBackedStrongProofCount;
  }

  if (
    typeof decorated.compatibilityStrongProofCount === "number" &&
    decorated.recordedVerifiedEvidenceCount === undefined
  ) {
    decorated.recordedVerifiedEvidenceCount = decorated.compatibilityStrongProofCount;
  }

  if (typeof decorated.weakProofCount === "number" && decorated.draftEvidenceCount === undefined) {
    decorated.draftEvidenceCount = decorated.weakProofCount;
  }

  if (typeof decorated.explicitProofCount === "number" && decorated.verifiedEvidenceCount === undefined) {
    decorated.verifiedEvidenceCount = decorated.explicitProofCount;
  }

  return decorated;
}

module.exports = {
  TOOL_DEFINITIONS,
  buildToolCallResult,
  buildToolErrorResult,
  callMcpTool,
  createMcpToolRuntime,
  executeMcpTool,
};
