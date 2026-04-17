export function resolveSelectedExecutionContext(activeTaskDetail, incomingExecutionState) {
  const selectedTaskId = activeTaskDetail && activeTaskDetail.meta ? activeTaskDetail.meta.id : "";
  const detailExecutionState =
    activeTaskDetail && activeTaskDetail.executionState && activeTaskDetail.executionState.taskId === selectedTaskId
      ? activeTaskDetail.executionState
      : null;

  const state =
    incomingExecutionState && incomingExecutionState.taskId === selectedTaskId
      ? incomingExecutionState
      : detailExecutionState
        ? detailExecutionState
        : selectedTaskId
          ? { taskId: selectedTaskId, status: "idle" }
          : null;

  return {
    selectedTaskId,
    state,
  };
}

export function buildExecutionUiView({ selectedTaskId, state, renderExecutionStateSummary, isActiveExecutionState }) {
  const renderSummary =
    typeof renderExecutionStateSummary === "function"
      ? renderExecutionStateSummary
      : (value) => String((value && value.summary) || "No execution yet.");
  const isActive = typeof isActiveExecutionState === "function" ? isActiveExecutionState : () => false;
  const canCancel = Boolean(state && (state.status === "starting" || state.status === "running"));

  return {
    statusText: selectedTaskId ? renderSummary(state) : "Select a task to view local execution status.",
    executeDisabled: !selectedTaskId || isActive(state),
    cancelDisabled: !selectedTaskId || !canCancel,
  };
}

export function resolveNextActiveTaskId(tasks, requestedTaskId, currentActiveTaskId) {
  const entries = Array.isArray(tasks) ? tasks : [];
  if (entries.length === 0) {
    return null;
  }

  if (requestedTaskId && entries.some((task) => task && task.id === requestedTaskId)) {
    return requestedTaskId;
  }

  if (currentActiveTaskId && entries.some((task) => task && task.id === currentActiveTaskId)) {
    return currentActiveTaskId;
  }

  return entries[0] && entries[0].id ? entries[0].id : null;
}

export function buildExecutionCompletionStatus(state, taskId, describeExecutionState) {
  if (!state || !taskId) {
    return null;
  }

  if (state.status === "completed") {
    const describeState =
      typeof describeExecutionState === "function"
        ? describeExecutionState
        : (value) => ({
            summary: String((value && value.summary) || "Execution completed."),
            statusLabel: String((value && value.status) || "completed"),
          });
    const description = describeState(state);

    return {
      message: `${String(description.summary || "").replace(/\.$/, "")} for ${taskId}.`,
      tone: description.statusLabel === "passed" ? "success" : description.statusLabel === "cancelled" ? "" : "error",
    };
  }

  if (state.status === "failed-to-start" || state.status === "preflight-failed") {
    return {
      message:
        state.error ||
        (state.status === "preflight-failed"
          ? `Local execution preflight failed for ${taskId}.`
          : `Local execution failed to start for ${taskId}.`),
      tone: "error",
    };
  }

  return null;
}
