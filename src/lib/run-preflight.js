const fs = require("fs");
const path = require("path");
const { getAdapter, normalizeAdapterId } = require("./adapters");
const { fileExists, readJson, readText } = require("./fs-utils");
const { createHttpError, getHttpStatusCode } = require("./http-errors");
const { loadGitRepositorySnapshot } = require("./repository-snapshot");
const { prepareRun } = require("./run-preparer");
const {
  buildExecutionPlan,
  createBlockingIssue,
  createExecutionPreflightError,
  isNonEmptyString,
  normalizeAdvisories,
  normalizeBlockingIssues,
  normalizeSnapshotPath,
  toWorkspaceRelative,
} = require("./run-plan");
const { buildTaskVerificationGate } = require("./verification-gates");
const { taskFiles } = require("./workspace");

const EXECUTION_CALLERS = {
  cli: {
    label: "CLI",
    supportedStdioModes: new Set(["inherit", "pipe"]),
  },
  dashboard: {
    label: "dashboard",
    supportedStdioModes: new Set(["pipe"]),
  },
};

function planRunExecution(workspaceRoot, taskId, adapterInput, options = {}) {
  const readiness = preflightRunExecution(workspaceRoot, taskId, adapterInput, options);
  if (!readiness.ready) {
    throw createRunExecutionPreflightError(readiness);
  }

  return readiness.executionPlan;
}

function preflightRunExecution(workspaceRoot, taskId, adapterInput, options = {}) {
  const adapterId = normalizeAdapterId(adapterInput || "codex");
  const caller = normalizeExecutionCaller(options.caller);
  let advisories = [];

  try {
    const prepared = prepareRun(workspaceRoot, taskId, adapterId);
    const adapter = getAdapter(workspaceRoot, adapterId);
    const files = taskFiles(workspaceRoot, taskId);
    const runRequest = readJson(prepared.runRequestPath, null);
    advisories = collectAdapterExecutionAdvisories(adapter);

    if (!runRequest) {
      throw createExecutionPreflightError(
        409,
        `Run request is missing or invalid for ${taskId} (${adapterId}).`,
        "run_request_missing",
        "prepared-artifacts-missing",
        [createBlockingIssue("runRequestFile", "Run request is missing or invalid.")],
        advisories
      );
    }

    if ((adapter.commandMode || "manual") !== "exec") {
      throw createExecutionPreflightError(
        409,
        `Adapter ${adapterId} is configured for manual handoff only. Review ${toWorkspaceRelative(
          workspaceRoot,
          prepared.launchPackPath
        )} or switch commandMode to exec first.`,
        "adapter_manual_handoff_only",
        "adapter-manual-only",
        [createBlockingIssue("commandMode", `Adapter ${adapterId} is still configured for manual handoff.`)],
        advisories
      );
    }

    const plan = buildExecutionPlan(workspaceRoot, taskId, adapter, files, prepared, runRequest, options);
    const runnerAvailability = inspectRunnerCommandAvailability(plan.command, plan.cwd);
    advisories = advisories.concat(buildRunnerAvailabilityAdvisories(plan.adapterId, runnerAvailability));
    advisories = advisories.concat(buildMissingEnvAdvisories(plan.adapterId, plan.envAllowlist, plan.env));
    advisories = advisories.concat(buildDirtyRepositoryAdvisories(workspaceRoot, taskId));
    if (!runnerAvailability.available) {
      throw createExecutionPreflightError(
        409,
        buildRunnerUnavailableMessage(plan.adapterId, runnerAvailability),
        "runner_command_unavailable",
        "runtime-unavailable",
        [createBlockingIssue("runnerCommand", buildRunnerUnavailableBlockingMessage(runnerAvailability))],
        advisories
      );
    }
    assertExecutionPlanSupportedForCaller(plan, caller, advisories);

    return {
      ready: true,
      taskId,
      adapterId: plan.adapterId,
      caller,
      stdioMode: plan.stdioMode,
      stdinMode: plan.stdinMode,
      cwdMode: plan.cwdMode,
      failureCategory: null,
      blockingIssues: [],
      advisories,
      message: `Ready to execute ${plan.adapterId} for ${taskId}.`,
      statusCode: 200,
      code: null,
      executionPlan: plan,
    };
  } catch (error) {
    const statusCode = getHttpStatusCode(error, 409);
    const normalizedErrorAdvisories = normalizeAdvisories(error);
    return {
      ready: false,
      taskId,
      adapterId,
      caller,
      stdioMode: null,
      stdinMode: null,
      cwdMode: null,
      failureCategory: normalizeExecutionFailureCategory(error, statusCode),
      blockingIssues: normalizeBlockingIssues(error),
      advisories: normalizedErrorAdvisories.length > 0 ? normalizedErrorAdvisories : advisories,
      message: error.message,
      statusCode,
      code: typeof error.code === "string" ? error.code : null,
      executionPlan: null,
    };
  }
}

function normalizeExecutionCaller(value) {
  return Object.prototype.hasOwnProperty.call(EXECUTION_CALLERS, value) ? value : "cli";
}

function assertExecutionPlanSupportedForCaller(plan, caller, advisories = []) {
  const capabilities = EXECUTION_CALLERS[caller] || EXECUTION_CALLERS.cli;
  if (capabilities.supportedStdioModes.has(plan.stdioMode)) {
    return;
  }

  throw createExecutionPreflightError(
    400,
    `Unsupported ${capabilities.label} execution for ${plan.adapterId}: resolved stdioMode is ${plan.stdioMode}. Use the CLI for interactive execution.`,
    caller === "dashboard" ? "unsupported_dashboard_stdio_mode" : "unsupported_execution_stdio_mode",
    "caller-not-supported",
    [createBlockingIssue("stdioMode", `${capabilities.label} does not support stdioMode ${plan.stdioMode}.`)],
    advisories
  );
}

function createRunExecutionPreflightError(readiness) {
  return createHttpError(readiness.statusCode || 409, readiness.message || "Execution preflight failed.", {
    code: readiness.code || "execution_preflight_failed",
    failureCategory: readiness.failureCategory || "plan-invalid",
    blockingIssues: normalizeBlockingIssues(readiness),
    advisories: normalizeAdvisories(readiness),
  });
}

function collectAdapterExecutionAdvisories(adapter) {
  const notes = Array.isArray(adapter && adapter.notes) ? adapter.notes : [];
  return normalizeAdvisories({
    advisories: notes.map((note) => ({
      code: "adapter-note",
      message: note,
    })),
  });
}

function inspectRunnerCommandAvailability(command, cwd) {
  const configuredCommand = String(command || "").trim();
  if (!configuredCommand) {
    return {
      available: false,
      configuredCommand,
      lookupMode: "missing",
      resolvedPath: null,
    };
  }

  if (path.isAbsolute(configuredCommand)) {
    return {
      available: isExecutableFile(configuredCommand),
      configuredCommand,
      lookupMode: "absolute",
      resolvedPath: configuredCommand,
    };
  }

  if (configuredCommand.includes("/") || configuredCommand.includes("\\")) {
    const resolvedPath = path.resolve(cwd || process.cwd(), configuredCommand);
    return {
      available: isExecutableFile(resolvedPath),
      configuredCommand,
      lookupMode: "relative",
      resolvedPath,
    };
  }

  const resolvedPath = resolveCommandFromPath(configuredCommand);
  return {
    available: isNonEmptyString(resolvedPath),
    configuredCommand,
    lookupMode: "path",
    resolvedPath,
  };
}

function resolveCommandFromPath(command) {
  const pathValue = getEnvironmentValueCaseInsensitive("PATH");
  if (!isNonEmptyString(pathValue)) {
    return null;
  }

  const directories = pathValue
    .split(path.delimiter)
    .map((entry) => stripWrappedQuotes(entry))
    .filter(isNonEmptyString);
  const candidates = buildPathCommandCandidates(command);

  for (const directory of directories) {
    for (const candidate of candidates) {
      const absolutePath = path.join(directory, candidate);
      if (isExecutableFile(absolutePath)) {
        return absolutePath;
      }
    }
  }

  return null;
}

function buildPathCommandCandidates(command) {
  if (process.platform !== "win32") {
    return [command];
  }

  if (path.extname(command)) {
    return [command];
  }

  const pathExt = getEnvironmentValueCaseInsensitive("PATHEXT") || ".COM;.EXE;.BAT;.CMD";
  const extensions = pathExt
    .split(";")
    .map((entry) => entry.trim())
    .filter(Boolean);
  return extensions.length > 0 ? extensions.map((extension) => `${command}${extension}`) : [command];
}

function getEnvironmentValueCaseInsensitive(key) {
  const matchedKey = Object.keys(process.env).find(
    (existingKey) => existingKey.toLowerCase() === String(key || "").toLowerCase()
  );
  return matchedKey ? process.env[matchedKey] : null;
}

function stripWrappedQuotes(value) {
  return String(value || "").replace(/^"(.*)"$/, "$1");
}

function isExecutableFile(filePath) {
  try {
    const stats = fs.statSync(filePath);
    if (!stats.isFile()) {
      return false;
    }
    fs.accessSync(filePath, fs.constants.X_OK);
    return true;
  } catch (error) {
    return false;
  }
}

function buildRunnerAvailabilityAdvisories(adapterId, runnerAvailability) {
  if (!runnerAvailability || !isNonEmptyString(runnerAvailability.configuredCommand)) {
    return [];
  }

  if (runnerAvailability.available && isNonEmptyString(runnerAvailability.resolvedPath)) {
    return normalizeAdvisories({
      advisories: [
        {
          code: "runner-command-resolved",
          message: `Runner command for ${adapterId} resolves locally: ${runnerAvailability.resolvedPath}`,
        },
      ],
    });
  }

  return normalizeAdvisories({
    advisories: [
      {
        code: "runner-command-missing",
        message: buildRunnerUnavailableBlockingMessage(runnerAvailability),
      },
    ],
  });
}

function buildRunnerUnavailableMessage(adapterId, runnerAvailability) {
  return `Runner command for ${adapterId} is unavailable on this machine. ${buildRunnerUnavailableBlockingMessage(
    runnerAvailability
  )}`;
}

function buildRunnerUnavailableBlockingMessage(runnerAvailability) {
  if (!runnerAvailability || !isNonEmptyString(runnerAvailability.configuredCommand)) {
    return "runnerCommand is missing or empty.";
  }

  if (runnerAvailability.lookupMode === "absolute") {
    return `Configured runner path does not exist or is not executable: ${runnerAvailability.resolvedPath}`;
  }

  if (runnerAvailability.lookupMode === "relative") {
    return `Configured runner path did not resolve to an executable from the local cwd: ${runnerAvailability.configuredCommand}`;
  }

  return `Runner command "${runnerAvailability.configuredCommand}" was not found on PATH for the current process.`;
}

function buildMissingEnvAdvisories(adapterId, envAllowlist, childEnv) {
  const requestedKeys = Array.isArray(envAllowlist) ? envAllowlist.filter(isNonEmptyString) : [];
  if (requestedKeys.length === 0) {
    return [];
  }

  const availableKeys = Object.keys(childEnv || {});
  const missingKeys = requestedKeys.filter(
    (requestedKey) => !availableKeys.some((availableKey) => availableKey.toLowerCase() === requestedKey.toLowerCase())
  );

  if (missingKeys.length === 0) {
    return [];
  }

  return normalizeAdvisories({
    advisories: [
      {
        code: "env-allowlist-missing",
        message: `Allowed env vars for ${adapterId} are missing from the current process: ${missingKeys.join(
          ", "
        )}. Real local execution may still fail until they are exported.`,
      },
    ],
  });
}

function buildDirtyRepositoryAdvisories(workspaceRoot, taskId = null) {
  try {
    const snapshot = loadGitRepositorySnapshot(workspaceRoot);
    if (!snapshot || !Array.isArray(snapshot.files) || snapshot.files.length === 0) {
      return [];
    }

    const changedPaths = snapshot.files.map((entry) => normalizeSnapshotPath(entry.path)).filter(isNonEmptyString);
    const taskContext = buildTaskDirtyRepositoryContext(workspaceRoot, taskId, snapshot);
    const message = taskContext
      ? buildTaskAwareDirtyRepositoryMessage(changedPaths, taskContext)
      : buildGenericDirtyRepositoryMessage(changedPaths);

    return normalizeAdvisories({
      advisories: [
        {
          code: "repository-dirty-state",
          message,
        },
      ],
    });
  } catch (error) {
    return [];
  }
}

function buildTaskDirtyRepositoryContext(workspaceRoot, taskId, snapshot) {
  if (!isNonEmptyString(taskId)) {
    return null;
  }

  const files = taskFiles(workspaceRoot, taskId);
  if (!fileExists(files.meta)) {
    return null;
  }

  const taskMeta = readJson(files.meta, {});
  const taskText = readText(files.task, "");
  const verificationGate = buildTaskVerificationGate(workspaceRoot, taskMeta, [], snapshot, taskText);
  const scopedPaths = uniqueNormalizedPaths(
    []
      .concat((verificationGate.relevantChangedFiles || []).map((entry) => entry.path))
      .concat((verificationGate.coveredScopedFiles || []).map((entry) => entry.path))
  );
  const workflowPaths = uniqueNormalizedPaths(
    (Array.isArray(snapshot.files) ? snapshot.files : [])
      .map((entry) => entry.path)
      .filter((entry) => isWorkflowInternalPath(entry))
  );
  const taskScopedPaths = uniqueNormalizedPaths(scopedPaths.filter((entry) => !isWorkflowInternalPath(entry)));
  const outsideTaskPaths = uniqueNormalizedPaths(
    (Array.isArray(snapshot.files) ? snapshot.files : [])
      .map((entry) => entry.path)
      .filter((entry) => !isWorkflowInternalPath(entry))
      .filter((entry) => !taskScopedPaths.includes(normalizeSnapshotPath(entry)))
  );

  return {
    taskId,
    workflowPaths,
    taskScopedPaths,
    outsideTaskPaths,
    scopeHintCount: Array.isArray(verificationGate.scopeHints) ? verificationGate.scopeHints.length : 0,
  };
}

function buildGenericDirtyRepositoryMessage(changedPaths) {
  return (
    `Repository currently has ${changedPaths.length} changed path(s) in Git mode; a real agent may stop on a dirty worktree or limit edits.` +
    buildPathSampleSentence("Example path", changedPaths)
  );
}

function buildTaskAwareDirtyRepositoryMessage(changedPaths, taskContext) {
  const messageParts = [
    `Repository currently has ${changedPaths.length} changed path(s) in Git mode; a real agent may stop on a dirty worktree or limit edits.`,
    `Task-aware breakdown for ${taskContext.taskId}: ${taskContext.taskScopedPaths.length} task-scoped, ${taskContext.workflowPaths.length} workflow bookkeeping, ${taskContext.outsideTaskPaths.length} outside current task scope.`,
  ];

  const taskScopedSentence = buildPathSampleSentence("Task-scoped example", taskContext.taskScopedPaths);
  if (taskScopedSentence) {
    messageParts.push(taskScopedSentence.trim());
  }

  const outsideScopeSentence = buildPathSampleSentence("Outside-scope example", taskContext.outsideTaskPaths);
  if (outsideScopeSentence) {
    messageParts.push(outsideScopeSentence.trim());
  }

  const workflowSentence = buildPathSampleSentence("Workflow example", taskContext.workflowPaths);
  if (workflowSentence) {
    messageParts.push(workflowSentence.trim());
  }

  if (
    taskContext.outsideTaskPaths.length === 0 &&
    taskContext.taskScopedPaths.length === 0 &&
    taskContext.workflowPaths.length > 0
  ) {
    messageParts.push("This dirty state currently looks like workflow bookkeeping only.");
  } else if (taskContext.outsideTaskPaths.length === 0 && taskContext.taskScopedPaths.length > 0) {
    messageParts.push("The dirty state is limited to the current task scope plus workflow bookkeeping.");
  } else if (taskContext.outsideTaskPaths.length > 0) {
    messageParts.push("Changes outside the current task scope may cause a cautious real agent to stop before editing.");
  }

  if (taskContext.scopeHintCount === 0 && taskContext.outsideTaskPaths.length > 0) {
    messageParts.push(
      `Current task scope still lacks explicit repo-relative matches, so non-workflow changes cannot be confidently tied to ${taskContext.taskId}.`
    );
  }

  return messageParts.join(" ");
}

function buildPathSampleSentence(label, paths) {
  const normalizedPaths = uniqueNormalizedPaths(paths);
  const samplePaths = normalizedPaths.slice(0, 3);
  if (samplePaths.length === 0) {
    return "";
  }

  const remainingCount = Math.max(normalizedPaths.length - samplePaths.length, 0);
  return ` ${label}${samplePaths.length === 1 ? "" : "s"}: ${samplePaths.join(", ")}${
    remainingCount > 0 ? ` (+${remainingCount} more)` : ""
  }.`;
}

function isWorkflowInternalPath(value) {
  return normalizeSnapshotPath(value).startsWith(".agent-workflow/");
}

function uniqueNormalizedPaths(values) {
  return Array.from(
    new Set((Array.isArray(values) ? values : []).map((value) => normalizeSnapshotPath(value)).filter(isNonEmptyString))
  );
}

function normalizeExecutionFailureCategory(error, statusCode) {
  if (isNonEmptyString(error && error.failureCategory)) {
    return String(error.failureCategory).trim();
  }

  if (error && error.code === "task_not_found") {
    return "task-missing";
  }

  if (error && error.code === "adapter_not_configured") {
    return "adapter-invalid";
  }

  if (statusCode === 404) {
    return "task-missing";
  }

  if (statusCode === 400) {
    return "plan-invalid";
  }

  return "plan-invalid";
}

module.exports = {
  createRunExecutionPreflightError,
  planRunExecution,
  preflightRunExecution,
};
