const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { getAdapter, normalizeAdapterId } = require("./adapters");
const { buildCheckpoint } = require("./checkpoint");
const { readJson } = require("./fs-utils");
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

async function executeRun(workspaceRoot, taskId, adapterInput, options = {}) {
  const adapterId = normalizeAdapterId(adapterInput || "codex");
  const prepared = prepareRun(workspaceRoot, taskId, adapterId);
  const adapter = getAdapter(workspaceRoot, adapterId);
  const files = taskFiles(workspaceRoot, taskId);
  const runRequest = readJson(prepared.runRequestPath, null);

  if (!runRequest) {
    throw new Error(`Run request is missing or invalid for ${taskId} (${adapterId}).`);
  }

  if ((adapter.commandMode || "manual") !== "exec") {
    throw new Error(
      `Adapter ${adapterId} is configured for manual handoff only. Review ${toWorkspaceRelative(
        workspaceRoot,
        prepared.launchPackPath
      )} or switch commandMode to exec first.`
    );
  }

  const plan = buildExecutionPlan(workspaceRoot, taskId, adapter, files, prepared, runRequest, options);
  const runId = `run-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const execution = await spawnExecution(plan, runId, files.runs);
  const completedAt = new Date().toISOString();
  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const exitCode = typeof execution.exitCode === "number" ? execution.exitCode : null;
  const status = deriveRunStatus(plan.successExitCodes, exitCode, execution);

  const run = createRunRecord(taskId, {
    id: runId,
    agent: adapterId,
    adapterId,
    source: "executor",
    status,
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
    interruptionSignal: execution.interruptionSignal,
    terminationSignal: execution.terminationSignal,
    commandMode: plan.commandMode,
    promptFile: plan.promptFileRelative,
    runRequestFile: plan.runRequestFileRelative,
    launchPackFile: plan.launchPackFileRelative,
    stdoutFile: execution.stdoutPath ? toWorkspaceRelative(workspaceRoot, execution.stdoutPath) : undefined,
    stderrFile: execution.stderrPath ? toWorkspaceRelative(workspaceRoot, execution.stderrPath) : undefined,
    errorMessage: execution.errorMessage,
  });

  const persistedRun = persistRunRecord(workspaceRoot, taskId, run);
  const checkpoint = buildCheckpoint(workspaceRoot, taskId);

  return {
    adapterId,
    taskId,
    run: persistedRun,
    checkpoint,
  };
}

function buildExecutionPlan(workspaceRoot, taskId, adapter, files, prepared, runRequest, options = {}) {
  if (!Array.isArray(adapter.runnerCommand) || adapter.runnerCommand.length === 0) {
    throw new Error(`Adapter ${adapter.adapterId} must include a non-empty runnerCommand to support run:execute.`);
  }

  const promptFileAbsolute = path.resolve(
    workspaceRoot,
    runRequest.promptFile || toWorkspaceRelative(workspaceRoot, prepared.promptPath)
  );
  const launchPackAbsolute = path.resolve(
    workspaceRoot,
    runRequest.launchPackFile || toWorkspaceRelative(workspaceRoot, prepared.launchPackPath)
  );
  const runRequestAbsolute = prepared.runRequestPath;
  const tokenMap = {
    workspaceRoot,
    taskRoot: files.root,
    promptFile: promptFileAbsolute,
    launchPackFile: launchPackAbsolute,
    runRequestFile: runRequestAbsolute,
  };

  const resolvedRunnerCommand = resolveTemplateArray(adapter.runnerCommand, tokenMap);
  const resolvedArgvTemplate = resolveTemplateArray(adapter.argvTemplate || [], tokenMap);
  const cwdMode = adapter.cwdMode === "taskRoot" ? "taskRoot" : "workspaceRoot";
  const stdioMode = adapter.stdioMode === "pipe" ? "pipe" : "inherit";
  const successExitCodes =
    Array.isArray(adapter.successExitCodes) && adapter.successExitCodes.every((value) => Number.isInteger(value))
      ? adapter.successExitCodes
      : [0];
  const timeoutOverride = normalizePositiveInteger(options.timeoutMs);
  const timeoutConfigured = normalizePositiveInteger(adapter.timeoutMs);

  return {
    adapterId: adapter.adapterId,
    taskId,
    commandMode: adapter.commandMode || "manual",
    command: resolvedRunnerCommand[0],
    args: resolvedRunnerCommand.slice(1).concat(resolvedArgvTemplate),
    cwd: cwdMode === "taskRoot" ? files.root : workspaceRoot,
    stdioMode,
    successExitCodes,
    timeoutMs: timeoutOverride || timeoutConfigured || null,
    env: buildChildEnv(adapter.envAllowlist || []),
    promptFileRelative: runRequest.promptFile || toWorkspaceRelative(workspaceRoot, promptFileAbsolute),
    runRequestFileRelative: toWorkspaceRelative(workspaceRoot, runRequestAbsolute),
    launchPackFileRelative: runRequest.launchPackFile || toWorkspaceRelative(workspaceRoot, launchPackAbsolute),
  };
}

function resolveTemplateArray(values, tokenMap) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) => resolveTemplateValue(value, tokenMap));
}

function resolveTemplateValue(value, tokenMap) {
  return String(value).replace(/\{(workspaceRoot|taskRoot|promptFile|launchPackFile|runRequestFile)\}/g, (_, key) => {
    return tokenMap[key];
  });
}

async function spawnExecution(plan, runId, runsDirectory) {
  return new Promise((resolve, reject) => {
    let spawned = false;
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

    try {
      if (plan.stdioMode === "pipe") {
        fs.mkdirSync(runsDirectory, { recursive: true });
        stdoutPath = path.join(runsDirectory, `${runId}.stdout.log`);
        stderrPath = path.join(runsDirectory, `${runId}.stderr.log`);
        stdoutFd = fs.openSync(stdoutPath, "w");
        stderrFd = fs.openSync(stderrPath, "w");
      }
    } catch (error) {
      safeCloseFd(stdoutFd);
      safeCloseFd(stderrFd);
      reject(error);
      return;
    }

    const child = spawn(plan.command, plan.args, {
      cwd: plan.cwd,
      env: plan.env,
      stdio: plan.stdioMode === "pipe" ? ["ignore", stdoutFd, stderrFd] : "inherit",
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
      safeCloseFd(stdoutFd);
      safeCloseFd(stderrFd);
    };

    const requestTermination = (reason) => {
      if (!spawned || child.exitCode !== null || child.killed) {
        return;
      }

      if (reason.type === "timeout") {
        timedOut = true;
      } else if (reason.type === "signal") {
        interrupted = true;
        interruptionSignal = reason.signal;
      }

      const killSignal = reason.signal || "SIGTERM";
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
    });

    child.on("error", (error) => {
      if (!spawned) {
        cleanup();
        reject(new Error(`Failed to launch ${plan.adapterId}: ${error.message}`));
        return;
      }

      childErrorMessage = error.message;
    });

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
  const requested = new Set([...CORE_ENV_KEYS, ...(Array.isArray(envAllowlist) ? envAllowlist : [])]);

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

function normalizePositiveInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw new Error(`timeoutMs must be a positive integer, received: ${value}`);
  }

  return normalized;
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

module.exports = {
  executeRun,
};
