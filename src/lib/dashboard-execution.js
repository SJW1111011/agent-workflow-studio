const fs = require("fs");
const path = require("path");
const { executeRun, planRunExecution } = require("./run-executor");
const { fileExists } = require("./fs-utils");
const { taskFiles } = require("./workspace");

function createDashboardExecutionBridge(workspaceRoot) {
  const taskStates = new Map();
  const taskControllers = new Map();

  function getTaskExecution(taskId) {
    return cloneExecutionState(taskStates.get(taskId) || buildIdleExecutionState(taskId));
  }

  function getTaskExecutionLog(taskId, streamName, maxChars = 12000) {
    const files = taskFiles(workspaceRoot, taskId);
    if (!fileExists(files.meta)) {
      throw new Error(`Task ${taskId} does not exist yet.`);
    }

    const state = taskStates.get(taskId) || buildIdleExecutionState(taskId);
    const fieldName = streamName === "stderr" ? "stderrFile" : streamName === "stdout" ? "stdoutFile" : null;
    if (!fieldName) {
      throw new Error(`Unsupported execution log stream: ${streamName}`);
    }

    const relativePath = state[fieldName];
    if (!isNonEmptyString(relativePath)) {
      throw new Error(`Task ${taskId} has no ${streamName} execution log available.`);
    }

    const absolutePath = path.resolve(workspaceRoot, relativePath);
    const allowedRoot = path.resolve(files.runs);
    const normalizedAllowedRoot = `${allowedRoot}${path.sep}`;
    if (absolutePath !== allowedRoot && !absolutePath.startsWith(normalizedAllowedRoot)) {
      throw new Error(`Execution log path is outside the task run ledger for ${taskId} (${streamName}).`);
    }

    if (!fileExists(absolutePath)) {
      if (isActiveExecutionStatus(state.status)) {
        return {
          taskId,
          runId: state.runId || null,
          stream: streamName,
          path: relativePath,
          size: 0,
          truncated: false,
          active: true,
          pending: true,
          content: "",
          updatedAt: state.updatedAt || state.startedAt || null,
        };
      }

      throw new Error(`Execution log file is missing for task ${taskId} (${streamName}).`);
    }

    const content = fs.readFileSync(absolutePath, "utf8");
    const limit = Number.isInteger(maxChars) && maxChars > 0 ? maxChars : 12000;
    const truncated = content.length > limit;

    return {
      taskId,
      runId: state.runId || null,
      stream: streamName,
      path: relativePath,
      size: content.length,
      truncated,
      active: isActiveExecutionStatus(state.status),
      pending: false,
      content: truncated ? content.slice(-limit) : content,
      updatedAt: state.updatedAt || state.startedAt || null,
    };
  }

  async function startTaskExecution(taskId, adapterInput, options = {}) {
    const existingState = taskStates.get(taskId);
    if (existingState && isActiveExecutionStatus(existingState.status)) {
      const error = new Error(`Task ${taskId} already has an active dashboard execution.`);
      error.statusCode = 409;
      throw error;
    }

    const plan = planRunExecution(workspaceRoot, taskId, adapterInput || "codex", options);
    if (plan.stdioMode !== "pipe") {
      const error = new Error(
        `Unsupported dashboard execution for ${plan.adapterId}: resolved stdioMode is ${plan.stdioMode}. Use the CLI for interactive execution.`
      );
      error.statusCode = 400;
      throw error;
    }

    const runId = `run-${Date.now()}`;
    const executionLogPaths = buildExecutionLogPaths(workspaceRoot, taskId, runId, plan.stdioMode);
    const startedAt = new Date().toISOString();
    const nextState = {
      taskId,
      adapterId: plan.adapterId,
      runId,
      status: "starting",
      stdioMode: plan.stdioMode,
      startedAt,
      updatedAt: startedAt,
      completedAt: null,
      cancelRequestedAt: null,
      outcome: null,
      runStatus: null,
      summary: null,
      exitCode: null,
      stdoutFile: executionLogPaths.stdoutFile,
      stderrFile: executionLogPaths.stderrFile,
      error: null,
    };
    taskStates.set(taskId, nextState);

    const abortController = new AbortController();
    taskControllers.set(taskId, abortController);

    Promise.resolve().then(async () => {
      updateExecutionState(taskStates, taskId, {
        status: "running",
      });

      try {
        const result = await executeRun(workspaceRoot, taskId, plan.adapterId, {
          ...options,
          abortSignal: abortController.signal,
          executionPlan: plan,
          runId,
        });

        updateExecutionState(taskStates, taskId, {
          status: "completed",
          completedAt: new Date().toISOString(),
          outcome: deriveExecutionOutcome(result.run),
          runId: result.run && result.run.id ? result.run.id : null,
          runStatus: result.run && result.run.status ? result.run.status : null,
          summary: result.run && result.run.summary ? result.run.summary : null,
          exitCode:
            result.run && typeof result.run.exitCode === "number"
              ? result.run.exitCode
              : result.run && result.run.exitCode === null
                ? null
                : null,
          stdoutFile: result.run && result.run.stdoutFile ? result.run.stdoutFile : nextState.stdoutFile,
          stderrFile: result.run && result.run.stderrFile ? result.run.stderrFile : nextState.stderrFile,
          error: null,
        });
      } catch (error) {
        updateExecutionState(taskStates, taskId, {
          status: "failed-to-start",
          completedAt: new Date().toISOString(),
          outcome: "failed-to-start",
          error: error.message,
        });
      } finally {
        taskControllers.delete(taskId);
      }
    });

    return cloneExecutionState(nextState);
  }

  async function cancelTaskExecution(taskId) {
    const existingState = taskStates.get(taskId);
    const controller = taskControllers.get(taskId);

    if (!existingState || !controller || !isActiveExecutionStatus(existingState.status)) {
      const error = new Error(`Task ${taskId} has no active dashboard execution to cancel.`);
      error.statusCode = 409;
      throw error;
    }

    updateExecutionState(taskStates, taskId, {
      status: "cancel-requested",
      cancelRequestedAt: new Date().toISOString(),
      outcome: null,
      summary: "Cancellation requested from the local dashboard.",
      error: null,
    });
    controller.abort("dashboard-cancel");
    return getTaskExecution(taskId);
  }

  return {
    cancelTaskExecution,
    getTaskExecution,
    getTaskExecutionLog,
    startTaskExecution,
  };
}

function updateExecutionState(taskStates, taskId, patch) {
  const current = taskStates.get(taskId) || buildIdleExecutionState(taskId);
  taskStates.set(taskId, {
    ...current,
    ...patch,
    taskId,
    updatedAt: new Date().toISOString(),
  });
}

function buildIdleExecutionState(taskId) {
  return {
    taskId,
    adapterId: null,
    status: "idle",
    stdioMode: null,
    startedAt: null,
    updatedAt: null,
    completedAt: null,
    cancelRequestedAt: null,
    outcome: null,
    runId: null,
    runStatus: null,
    summary: null,
    exitCode: null,
    stdoutFile: null,
    stderrFile: null,
    error: null,
  };
}

function cloneExecutionState(state) {
  return JSON.parse(JSON.stringify(state));
}

function isActiveExecutionStatus(status) {
  return status === "starting" || status === "running" || status === "cancel-requested";
}

function deriveExecutionOutcome(run) {
  if (!run || typeof run !== "object") {
    return "failed";
  }

  if (run.interrupted && isDashboardCancelSignal(run.interruptionSignal)) {
    return "cancelled";
  }

  if (run.timedOut) {
    return "timed-out";
  }

  if (run.interrupted) {
    return "interrupted";
  }

  if (run.status === "passed") {
    return "passed";
  }

  return "failed";
}

function isDashboardCancelSignal(signal) {
  return String(signal || "").trim().toLowerCase() === "dashboard-cancel";
}

function buildExecutionLogPaths(workspaceRoot, taskId, runId, stdioMode) {
  if (stdioMode !== "pipe") {
    return {
      stdoutFile: null,
      stderrFile: null,
    };
  }

  const files = taskFiles(workspaceRoot, taskId);
  return {
    stdoutFile: toWorkspaceRelative(workspaceRoot, path.join(files.runs, `${runId}.stdout.log`)),
    stderrFile: toWorkspaceRelative(workspaceRoot, path.join(files.runs, `${runId}.stderr.log`)),
  };
}

function toWorkspaceRelative(workspaceRoot, absolutePath) {
  return path.relative(workspaceRoot, absolutePath).split(path.sep).join("/");
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

module.exports = {
  createDashboardExecutionBridge,
};
