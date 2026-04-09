const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { buildCheckpoint } = require("./checkpoint");
const { createRunExecutionPreflightError, planRunExecution, preflightRunExecution } = require("./run-preflight");
const { isNonEmptyString, toWorkspaceRelative } = require("./run-plan");
const { createRunRecord, persistRunRecord } = require("./task-service");
const { taskFiles } = require("./workspace");

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

function isDashboardCancelSignal(signal) {
  return String(signal || "").trim().toLowerCase() === "dashboard-cancel";
}

module.exports = {
  createRunExecutionPreflightError,
  executeRun,
  preflightRunExecution,
  planRunExecution,
};
