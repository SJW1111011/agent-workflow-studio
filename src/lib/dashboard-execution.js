const { executeRun, planRunExecution } = require("./run-executor");

function createDashboardExecutionBridge(workspaceRoot) {
  const taskStates = new Map();
  const taskControllers = new Map();

  function getTaskExecution(taskId) {
    return cloneExecutionState(taskStates.get(taskId) || buildIdleExecutionState(taskId));
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

    const startedAt = new Date().toISOString();
    const nextState = {
      taskId,
      adapterId: plan.adapterId,
      status: "starting",
      stdioMode: plan.stdioMode,
      startedAt,
      updatedAt: startedAt,
      completedAt: null,
      cancelRequestedAt: null,
      outcome: null,
      runId: null,
      runStatus: null,
      summary: null,
      exitCode: null,
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

module.exports = {
  createDashboardExecutionBridge,
};
