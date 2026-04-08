const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { getAdapter, normalizeAdapterId } = require("./adapters");
const { buildCheckpoint } = require("./checkpoint");
const { fileExists, readJson } = require("./fs-utils");
const { badRequest, conflict, createHttpError, getHttpStatusCode } = require("./http-errors");
const { loadGitRepositorySnapshot } = require("./repository-snapshot");
const { prepareRun } = require("./run-preparer");
const { createRunRecord, persistRunRecord } = require("./task-service");
const { taskFiles } = require("./workspace");

const CORE_ENV_KEYS = [
  "APPDATA",
  "ComSpec",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "LOCALAPPDATA",
  "PATH",
  "PATHEXT",
  "Path",
  "SHELL",
  "SystemDrive",
  "SystemRoot",
  "TEMP",
  "TERM",
  "TMP",
  "USERPROFILE",
];

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

const SUPPORTED_TEMPLATE_TOKENS = new Set([
  "workspaceRoot",
  "taskRoot",
  "promptFile",
  "launchPackFile",
  "runRequestFile",
]);

async function executeRun(workspaceRoot, taskId, adapterInput, options = {}) {
  const plan = options.executionPlan || planRunExecution(workspaceRoot, taskId, adapterInput, options);
  const files = taskFiles(workspaceRoot, taskId);
  const runId = isNonEmptyString(options.runId) ? String(options.runId).trim() : `run-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const execution = await spawnExecution(plan, runId, plan.runsDirectory || files.runs, options.abortSignal);
  const completedAt = new Date().toISOString();
  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const exitCode = typeof execution.exitCode === "number" ? execution.exitCode : null;
  const status = deriveRunStatus(plan.successExitCodes, exitCode, execution);
  const outcome = deriveExecutionOutcome(status, execution);
  const failureCategory = deriveExecutionFailureCategory(status, execution);

  const run = createRunRecord(taskId, {
    id: runId,
    agent: plan.adapterId,
    adapterId: plan.adapterId,
    source: "executor",
    status,
    outcome,
    summary: buildExecutionSummary(status, exitCode, {
      ...execution,
      timeoutMs: plan.timeoutMs,
    }),
    createdAt: startedAt,
    startedAt,
    completedAt,
    durationMs,
    exitCode,
    timedOut: execution.timedOut || undefined,
    timeoutMs: plan.timeoutMs || undefined,
    interrupted: execution.interrupted || undefined,
    interruptionSignal: isNonEmptyString(execution.interruptionSignal) ? execution.interruptionSignal : undefined,
    terminationSignal: isNonEmptyString(execution.terminationSignal) ? execution.terminationSignal : undefined,
    commandMode: plan.commandMode,
    promptFile: plan.promptFileRelative,
    runRequestFile: plan.runRequestFileRelative,
    launchPackFile: plan.launchPackFileRelative,
    stdoutFile: execution.stdoutPath ? toWorkspaceRelative(workspaceRoot, execution.stdoutPath) : undefined,
    stderrFile: execution.stderrPath ? toWorkspaceRelative(workspaceRoot, execution.stderrPath) : undefined,
    failureCategory,
    verificationChecks: buildExecutionVerificationChecks(workspaceRoot, plan, status, exitCode, execution),
    verificationArtifacts: collectExecutionArtifactRefs(workspaceRoot, plan, execution),
    errorMessage: execution.errorMessage,
  });

  const persistedRun = persistRunRecord(workspaceRoot, taskId, run);
  const checkpoint = buildCheckpoint(workspaceRoot, taskId);

  return {
    adapterId: plan.adapterId,
    taskId,
    run: persistedRun,
    checkpoint,
  };
}

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
    advisories = advisories.concat(buildDirtyRepositoryAdvisories(workspaceRoot));
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
      advisories: normalizeAdvisories(error).length > 0 ? normalizeAdvisories(error) : advisories,
      message: error.message,
      statusCode,
      code: typeof error.code === "string" ? error.code : null,
      executionPlan: null,
    };
  }
}

function buildExecutionPlan(workspaceRoot, taskId, adapter, files, prepared, runRequest, options = {}) {
  const runnerCommand = normalizeTemplateArray(adapter.runnerCommand, adapter.adapterId, "runnerCommand", false);
  const argvTemplate = normalizeTemplateArray(adapter.argvTemplate || [], adapter.adapterId, "argvTemplate", true);
  const promptFileRelative = normalizeArtifactReference(
    runRequest.promptFile || toWorkspaceRelative(workspaceRoot, prepared.promptPath),
    taskId,
    "promptFile",
    "prompt file"
  );
  const launchPackFileRelative = normalizeArtifactReference(
    runRequest.launchPackFile || toWorkspaceRelative(workspaceRoot, prepared.launchPackPath),
    taskId,
    "launchPackFile",
    "launch pack file"
  );
  const runRequestFileRelative = toWorkspaceRelative(workspaceRoot, prepared.runRequestPath);
  const promptFileAbsolute = resolveWorkspaceArtifactPath(workspaceRoot, promptFileRelative, taskId, "prompt file");
  const launchPackAbsolute = resolveWorkspaceArtifactPath(workspaceRoot, launchPackFileRelative, taskId, "launch pack file");
  const runRequestAbsolute = resolveWorkspaceArtifactPath(
    workspaceRoot,
    runRequestFileRelative,
    taskId,
    "run request file"
  );
  const tokenMap = {
    workspaceRoot,
    taskRoot: files.root,
    promptFile: promptFileAbsolute,
    launchPackFile: launchPackAbsolute,
    runRequestFile: runRequestAbsolute,
  };

  const resolvedRunnerCommand = resolveTemplateArray(runnerCommand, tokenMap, adapter.adapterId, "runnerCommand");
  const resolvedArgvTemplate = resolveTemplateArray(argvTemplate, tokenMap, adapter.adapterId, "argvTemplate");
  const cwdMode = normalizeCwdMode(adapter.cwdMode, adapter.adapterId);
  const stdioMode = normalizeStdioMode(adapter.stdioMode, adapter.adapterId);
  const stdinMode = normalizeStdinMode(adapter.stdinMode, adapter.adapterId);
  const successExitCodes = normalizeSuccessExitCodes(adapter.successExitCodes, adapter.adapterId);
  const envAllowlist = normalizeEnvAllowlist(adapter.envAllowlist, adapter.adapterId);
  const timeoutOverride = normalizePositiveInteger(options.timeoutMs);
  const timeoutConfigured = normalizePositiveInteger(adapter.timeoutMs);
  const cwd = cwdMode === "taskRoot" ? files.root : workspaceRoot;
  assertPathInsideRoot(workspaceRoot, cwd, "cwd", "plan-invalid");

  return {
    adapterId: adapter.adapterId,
    taskId,
    commandMode: adapter.commandMode || "manual",
    command: resolvedRunnerCommand[0],
    args: resolvedRunnerCommand.slice(1).concat(resolvedArgvTemplate),
    cwd,
    cwdMode,
    stdioMode,
    stdinMode,
    stdinPath: stdinMode === "promptFile" ? promptFileAbsolute : null,
    successExitCodes,
    timeoutMs: timeoutOverride || timeoutConfigured || null,
    env: buildChildEnv(envAllowlist),
    envAllowlist,
    promptFileRelative,
    runRequestFileRelative,
    launchPackFileRelative,
    runsDirectory: files.runs,
  };
}

function resolveTemplateArray(values, tokenMap, adapterId, fieldName) {
  return values.map((value) => resolveTemplateValue(value, tokenMap, adapterId, fieldName));
}

function resolveTemplateValue(value, tokenMap, adapterId, fieldName) {
  const template = String(value);
  const unsupportedTokens = Array.from(template.matchAll(/\{([^}]+)\}/g))
    .map((match) => match[1])
    .filter((token) => !SUPPORTED_TEMPLATE_TOKENS.has(token));

  if (unsupportedTokens.length > 0) {
    throw createExecutionPreflightError(
      409,
      `Adapter ${adapterId} ${fieldName} includes unsupported template token(s): ${unsupportedTokens.join(", ")}.`,
      "adapter_template_token_invalid",
      "plan-invalid",
      [createBlockingIssue(fieldName, `Unsupported template tokens: ${unsupportedTokens.join(", ")}.`)]
    );
  }

  return template.replace(/\{(workspaceRoot|taskRoot|promptFile|launchPackFile|runRequestFile)\}/g, (_, key) => {
    return tokenMap[key];
  });
}

async function spawnExecution(plan, runId, runsDirectory, abortSignal) {
  return new Promise((resolve, reject) => {
    let spawned = false;
    let stdinFd = null;
    let stdoutPath;
    let stderrPath;
    let stdoutFd = null;
    let stderrFd = null;
    let childErrorMessage = null;
    let timedOut = false;
    let interrupted = false;
    let interruptionSignal = null;
    let terminationSignal = null;
    let timeoutHandle = null;
    let forceKillHandle = null;
    let pendingTerminationReason = null;
    let abortListener = null;

    try {
      if (plan.stdinMode === "promptFile" && isNonEmptyString(plan.stdinPath)) {
        stdinFd = fs.openSync(plan.stdinPath, "r");
      }
      if (plan.stdioMode === "pipe") {
        fs.mkdirSync(runsDirectory, { recursive: true });
        stdoutPath = path.join(runsDirectory, `${runId}.stdout.log`);
        stderrPath = path.join(runsDirectory, `${runId}.stderr.log`);
        stdoutFd = fs.openSync(stdoutPath, "w");
        stderrFd = fs.openSync(stderrPath, "w");
      }
    } catch (error) {
      safeCloseFd(stdinFd);
      safeCloseFd(stdoutFd);
      safeCloseFd(stderrFd);
      reject(error);
      return;
    }

    const stdinHandle = typeof stdinFd === "number" ? stdinFd : "ignore";
    const child = spawn(plan.command, plan.args, {
      cwd: plan.cwd,
      env: plan.env,
      stdio: plan.stdioMode === "pipe" ? [stdinHandle, stdoutFd, stderrFd] : [stdinHandle, "inherit", "inherit"],
    });

    const signalListeners = new Map();

    const cleanup = () => {
      if (timeoutHandle) {
        clearTimeout(timeoutHandle);
      }
      if (forceKillHandle) {
        clearTimeout(forceKillHandle);
      }
      for (const [signal, listener] of signalListeners.entries()) {
        process.off(signal, listener);
      }
      if (abortSignal && abortListener) {
        abortSignal.removeEventListener("abort", abortListener);
      }
      safeCloseFd(stdinFd);
      safeCloseFd(stdoutFd);
      safeCloseFd(stderrFd);
    };

    const requestTermination = (reason) => {
      if (!spawned) {
        pendingTerminationReason = reason;
        return;
      }

      if (child.exitCode !== null || child.killed) {
        return;
      }

      if (reason.type === "timeout") {
        timedOut = true;
      } else if (reason.type === "signal") {
        interrupted = true;
        interruptionSignal = reason.signal || "SIGTERM";
      }

      const killSignal = reason.killSignal || "SIGTERM";
      child.kill(killSignal);
      forceKillHandle = setTimeout(() => {
        if (child.exitCode === null) {
          child.kill("SIGKILL");
        }
      }, 1000);
    };

    child.on("spawn", () => {
      spawned = true;

      if (plan.timeoutMs) {
        timeoutHandle = setTimeout(() => {
          requestTermination({ type: "timeout" });
        }, plan.timeoutMs);
      }

      ["SIGINT", "SIGTERM"].forEach((signal) => {
        const listener = () => {
          requestTermination({ type: "signal", signal });
        };
        signalListeners.set(signal, listener);
        process.on(signal, listener);
      });

      if (pendingTerminationReason) {
        requestTermination(pendingTerminationReason);
      }
    });

    child.on("error", (error) => {
      if (!spawned) {
        cleanup();
        reject(new Error(`Failed to launch ${plan.adapterId}: ${error.message}`));
        return;
      }

      childErrorMessage = error.message;
    });

    if (abortSignal) {
      if (abortSignal.aborted) {
        requestTermination({
          type: "signal",
          signal: normalizeAbortReason(abortSignal.reason),
          killSignal: "SIGTERM",
        });
      } else {
        abortListener = () => {
          requestTermination({
            type: "signal",
            signal: normalizeAbortReason(abortSignal.reason),
            killSignal: "SIGTERM",
          });
        };
        abortSignal.addEventListener("abort", abortListener, { once: true });
      }
    }

    child.on("close", (code, signal) => {
      cleanup();
      terminationSignal = signal || (timedOut ? "SIGTERM" : null);

      resolve({
        exitCode: typeof code === "number" ? code : null,
        stdoutPath,
        stderrPath,
        timedOut,
        interrupted,
        interruptionSignal,
        terminationSignal,
        errorMessage: childErrorMessage || (signal ? `Process exited due to signal ${signal}.` : undefined),
      });
    });
  });
}

function buildChildEnv(envAllowlist) {
  const childEnv = {};
  const requested = new Set([...CORE_ENV_KEYS, ...envAllowlist]);

  for (const requestedKey of requested) {
    const matchedKey = Object.keys(process.env).find(
      (existingKey) => existingKey.toLowerCase() === String(requestedKey).toLowerCase()
    );
    if (matchedKey) {
      childEnv[matchedKey] = process.env[matchedKey];
    }
  }

  return childEnv;
}

function deriveRunStatus(successExitCodes, exitCode, execution) {
  if (execution.timedOut || execution.interrupted || execution.errorMessage) {
    return "failed";
  }

  return successExitCodes.includes(exitCode) ? "passed" : "failed";
}

function deriveExecutionOutcome(status, execution) {
  if (execution.interrupted && isDashboardCancelSignal(execution.interruptionSignal)) {
    return "cancelled";
  }

  if (execution.timedOut) {
    return "timed-out";
  }

  if (execution.interrupted) {
    return "interrupted";
  }

  return status === "passed" ? "passed" : "failed";
}

function deriveExecutionFailureCategory(status, execution) {
  if (execution.timedOut) {
    return "timeout";
  }

  if (execution.interrupted) {
    return "interrupted";
  }

  if (execution.errorMessage) {
    return "launch-error";
  }

  return status === "passed" ? undefined : "non-zero-exit";
}

function buildExecutionSummary(status, exitCode, execution) {
  if (execution.timedOut) {
    return `Executor timed out after ${execution.timeoutMs || "configured limit"} ms.`;
  }

  if (execution.interrupted && execution.interruptionSignal) {
    return `Executor interrupted by ${execution.interruptionSignal}.`;
  }

  if (execution.errorMessage) {
    return `Executor failed: ${execution.errorMessage}`;
  }

  if (execution.terminationSignal) {
    return `Executor exited due to signal ${execution.terminationSignal}.`;
  }

  if (status === "passed") {
    return `Executor completed with exit code ${exitCode}.`;
  }

  return `Executor failed with exit code ${exitCode}.`;
}

function buildExecutionVerificationChecks(workspaceRoot, plan, status, exitCode, execution) {
  const detailParts = [];
  if (typeof exitCode === "number") {
    detailParts.push(`exitCode=${exitCode}`);
  }
  detailParts.push(`stdio=${plan.stdioMode}`);
  if (plan.stdinMode && plan.stdinMode !== "none") {
    detailParts.push(`stdin=${plan.stdinMode}`);
  }
  if (execution.timedOut && plan.timeoutMs) {
    detailParts.push(`timedOut after ${plan.timeoutMs} ms`);
  }
  if (execution.interrupted && execution.interruptionSignal) {
    detailParts.push(`interrupted via ${execution.interruptionSignal}`);
  }
  if (execution.terminationSignal) {
    detailParts.push(`signal=${execution.terminationSignal}`);
  }
  if (execution.errorMessage) {
    detailParts.push(execution.errorMessage);
  }

  return [
    {
      label: `Local ${plan.adapterId} executor result`,
      status: status === "passed" ? "passed" : "failed",
      details: detailParts.join("; "),
      artifacts: collectExecutionArtifactRefs(workspaceRoot, plan, execution),
    },
  ];
}

function collectExecutionArtifactRefs(workspaceRoot, plan, execution) {
  return [
    plan.promptFileRelative,
    plan.runRequestFileRelative,
    plan.launchPackFileRelative,
    execution.stdoutPath ? toWorkspaceRelative(workspaceRoot, execution.stdoutPath) : undefined,
    execution.stderrPath ? toWorkspaceRelative(workspaceRoot, execution.stderrPath) : undefined,
  ].filter(Boolean);
}

function normalizePositiveInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw badRequest(`timeoutMs must be a positive integer, received: ${value}`, "invalid_timeout_ms");
  }

  return normalized;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeTemplateArray(value, adapterId, fieldName, allowEmpty) {
  if (value === undefined) {
    return allowEmpty ? [] : throwMissingArrayValue(adapterId, fieldName);
  }

  if (!Array.isArray(value)) {
    throw createExecutionPreflightError(
      409,
      `Adapter ${adapterId} must use ${fieldName} as an array.`,
      `adapter_${fieldName}_invalid`,
      "adapter-invalid",
      [createBlockingIssue(fieldName, `${fieldName} must be an array of non-empty strings.`)]
    );
  }

  if (!allowEmpty && value.length === 0) {
    throwMissingArrayValue(adapterId, fieldName);
  }

  return value.map((entry, index) => {
    if (!isNonEmptyString(entry)) {
      throw createExecutionPreflightError(
        409,
        `Adapter ${adapterId} ${fieldName}[${index}] must be a non-empty string.`,
        `adapter_${fieldName}_entry_invalid`,
        "adapter-invalid",
        [createBlockingIssue(fieldName, `${fieldName}[${index}] must be a non-empty string.`)]
      );
    }

    return String(entry).trim();
  });
}

function throwMissingArrayValue(adapterId, fieldName) {
  throw createExecutionPreflightError(
    409,
    `Adapter ${adapterId} must include a non-empty ${fieldName} to support run:execute.`,
    fieldName === "runnerCommand" ? "adapter_runner_command_missing" : `adapter_${fieldName}_missing`,
    "adapter-invalid",
    [createBlockingIssue(fieldName, `${fieldName} must include at least one entry.`)]
  );
}

function normalizeCwdMode(value, adapterId) {
  if (value === undefined || value === null || value === "") {
    return "workspaceRoot";
  }

  if (value === "workspaceRoot" || value === "taskRoot") {
    return value;
  }

  throw createExecutionPreflightError(
    409,
    `Adapter ${adapterId} has unsupported cwdMode ${value}.`,
    "adapter_cwd_mode_invalid",
    "adapter-invalid",
    [createBlockingIssue("cwdMode", `Unsupported cwdMode: ${value}.`)]
  );
}

function normalizeStdioMode(value, adapterId) {
  if (value === undefined || value === null || value === "") {
    return "inherit";
  }

  if (value === "inherit" || value === "pipe") {
    return value;
  }

  throw createExecutionPreflightError(
    409,
    `Adapter ${adapterId} has unsupported stdioMode ${value}.`,
    "adapter_stdio_mode_invalid",
    "adapter-invalid",
    [createBlockingIssue("stdioMode", `Unsupported stdioMode: ${value}.`)]
  );
}

function normalizeStdinMode(value, adapterId) {
  if (value === undefined || value === null || value === "") {
    return "none";
  }

  if (value === "none" || value === "promptFile") {
    return value;
  }

  throw createExecutionPreflightError(
    409,
    `Adapter ${adapterId} has unsupported stdinMode ${value}.`,
    "adapter_stdin_mode_invalid",
    "adapter-invalid",
    [createBlockingIssue("stdinMode", `Unsupported stdinMode: ${value}.`)]
  );
}

function normalizeSuccessExitCodes(value, adapterId) {
  if (value === undefined) {
    return [0];
  }

  if (!Array.isArray(value) || value.length === 0 || !value.every((entry) => Number.isInteger(entry))) {
    throw createExecutionPreflightError(
      409,
      `Adapter ${adapterId} must use successExitCodes as a non-empty array of integers.`,
      "adapter_success_exit_codes_invalid",
      "plan-invalid",
      [createBlockingIssue("successExitCodes", "successExitCodes must be a non-empty array of integers.")]
    );
  }

  return value;
}

function normalizeEnvAllowlist(value, adapterId) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || !value.every((entry) => isNonEmptyString(entry))) {
    throw createExecutionPreflightError(
      409,
      `Adapter ${adapterId} must use envAllowlist as an array of non-empty strings.`,
      "adapter_env_allowlist_invalid",
      "plan-invalid",
      [createBlockingIssue("envAllowlist", "envAllowlist must be an array of non-empty strings.")]
    );
  }

  return value.map((entry) => String(entry).trim());
}

function normalizeArtifactReference(value, taskId, fieldName, label) {
  if (!isNonEmptyString(value)) {
    throw createExecutionPreflightError(
      409,
      `Run request is missing ${label} reference for ${taskId}.`,
      `run_request_${fieldName}_missing`,
      "prepared-artifacts-missing",
      [createBlockingIssue(fieldName, `${label} reference is missing from run-request.`)]
    );
  }

  const normalized = String(value).trim();
  if (path.isAbsolute(normalized)) {
    throw createExecutionPreflightError(
      409,
      `Run request ${fieldName} must stay repository-relative for ${taskId}.`,
      `run_request_${fieldName}_absolute`,
      "plan-invalid",
      [createBlockingIssue(fieldName, `${label} must stay repository-relative.`)]
    );
  }

  return normalized.replace(/\\/g, "/");
}

function resolveWorkspaceArtifactPath(workspaceRoot, relativePath, taskId, label) {
  const absolutePath = path.resolve(workspaceRoot, relativePath);
  assertPathInsideRoot(workspaceRoot, absolutePath, label, "plan-invalid");

  if (!fileExists(absolutePath)) {
    throw createExecutionPreflightError(
      409,
      `Prepared ${label} is missing for ${taskId}: ${relativePath}.`,
      `prepared_${label.replace(/\s+/g, "_")}_missing`,
      "prepared-artifacts-missing",
      [createBlockingIssue(label, `${label} is missing at ${relativePath}.`)]
    );
  }

  return absolutePath;
}

function assertPathInsideRoot(workspaceRoot, absolutePath, label, failureCategory) {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(absolutePath);
  const normalizedRoot = `${root}${path.sep}`;

  if (target !== root && !target.startsWith(normalizedRoot)) {
    throw createExecutionPreflightError(
      409,
      `${label} resolves outside the workspace root and cannot be used for local execution.`,
      "execution_path_outside_workspace",
      failureCategory,
      [createBlockingIssue(label, `${label} resolves outside the workspace root.`)]
    );
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

function createExecutionPreflightError(statusCode, message, code, failureCategory, blockingIssues, advisories) {
  return createHttpError(statusCode, message, {
    code,
    failureCategory,
    blockingIssues: normalizeBlockingIssues({ blockingIssues }),
    advisories: normalizeAdvisories({ advisories }),
  });
}

function createRunExecutionPreflightError(readiness) {
  return createHttpError(readiness.statusCode || 409, readiness.message || "Execution preflight failed.", {
    code: readiness.code || "execution_preflight_failed",
    failureCategory: readiness.failureCategory || "plan-invalid",
    blockingIssues: normalizeBlockingIssues(readiness),
    advisories: normalizeAdvisories(readiness),
  });
}

function createBlockingIssue(field, message) {
  return {
    field,
    message,
  };
}

function normalizeBlockingIssues(value) {
  const entries = Array.isArray(value && value.blockingIssues) ? value.blockingIssues : [];
  return entries
    .filter((entry) => entry && typeof entry === "object" && isNonEmptyString(entry.message))
    .map((entry) => ({
      field: isNonEmptyString(entry.field) ? String(entry.field).trim() : null,
      message: String(entry.message).trim(),
    }));
}

function normalizeAdvisories(value) {
  const entries = Array.isArray(value && value.advisories) ? value.advisories : [];
  return entries
    .map((entry) => {
      if (isNonEmptyString(entry)) {
        return {
          code: null,
          message: String(entry).trim(),
        };
      }

      if (!entry || typeof entry !== "object" || !isNonEmptyString(entry.message)) {
        return null;
      }

      return {
        code: isNonEmptyString(entry.code) ? String(entry.code).trim() : null,
        message: String(entry.message).trim(),
      };
    })
    .filter(Boolean);
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

function normalizeSnapshotPath(value) {
  return isNonEmptyString(value) ? String(value).trim().replace(/\\/g, "/") : "";
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

function buildDirtyRepositoryAdvisories(workspaceRoot) {
  try {
    const snapshot = loadGitRepositorySnapshot(workspaceRoot);
    if (!snapshot || !Array.isArray(snapshot.files) || snapshot.files.length === 0) {
      return [];
    }

    const samplePaths = snapshot.files
      .map((entry) => normalizeSnapshotPath(entry.path))
      .filter(isNonEmptyString)
      .slice(0, 3);
    const remainingCount = Math.max(snapshot.files.length - samplePaths.length, 0);
    const sampleSuffix =
      samplePaths.length === 0
        ? ""
        : ` Example path${samplePaths.length === 1 ? "" : "s"}: ${samplePaths.join(", ")}${
            remainingCount > 0 ? ` (+${remainingCount} more)` : ""
          }.`;

    return normalizeAdvisories({
      advisories: [
        {
          code: "repository-dirty-state",
          message: `Repository currently has ${snapshot.files.length} changed path(s) in Git mode; a real agent may stop on a dirty worktree or limit edits.${sampleSuffix}`,
        },
      ],
    });
  } catch (error) {
    return [];
  }
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

function normalizeAbortReason(reason) {
  if (typeof reason === "string" && reason.trim()) {
    return reason.trim();
  }

  return "dashboard-cancel";
}

function safeCloseFd(fd) {
  if (typeof fd === "number") {
    try {
      fs.closeSync(fd);
    } catch (error) {
      // Ignore close failures during cleanup.
    }
  }
}

function toWorkspaceRelative(workspaceRoot, absolutePath) {
  return path.relative(workspaceRoot, absolutePath).replace(/\\/g, "/");
}

function isDashboardCancelSignal(signal) {
  return String(signal || "").trim().toLowerCase() === "dashboard-cancel";
}

module.exports = {
  createRunExecutionPreflightError,
  executeRun,
  preflightRunExecution,
  planRunExecution,
};
