function isDashboardCancelSignal(signal) {
  return String(signal || "").trim().toLowerCase() === "dashboard-cancel";
}

function isDashboardCancelledRun(run) {
  return Boolean(run && run.interrupted && isDashboardCancelSignal(run.interruptionSignal));
}

export function normalizeExecutionOutcome(executionState) {
  const state = executionState && typeof executionState === "object" ? executionState : {};
  if (typeof state.outcome === "string" && state.outcome.trim()) {
    return state.outcome.trim().toLowerCase();
  }
  if (state.status !== "completed") {
    return state.status === "failed-to-start" || state.status === "preflight-failed" ? state.status : "";
  }
  if (String(state.summary || "").includes("dashboard-cancel")) {
    return "cancelled";
  }
  if (String(state.summary || "").includes("timed out")) {
    return "timed-out";
  }
  if (String(state.summary || "").includes("interrupted")) {
    return "interrupted";
  }
  if (state.runStatus === "passed") {
    return "passed";
  }
  if (state.runStatus === "failed") {
    return "failed";
  }
  return "";
}

export function describeRunOutcome(run) {
  if (isDashboardCancelledRun(run)) {
    return {
      label: "cancelled",
      warn: false,
      summary: "Cancelled from dashboard.",
      detail: "The shared executor stopped after a local dashboard cancel request.",
    };
  }
  if (run && run.timedOut) {
    return {
      label: "timed out",
      warn: true,
      summary: run.summary || "Execution hit its configured timeout.",
      detail: run.timeoutMs ? `Timeout configured at ${run.timeoutMs} ms.` : "Execution hit its configured timeout.",
    };
  }
  if (run && run.interrupted) {
    return {
      label: "interrupted",
      warn: true,
      summary: run.summary || "Execution was interrupted before completion.",
      detail: run.interruptionSignal ? `Interrupted by ${run.interruptionSignal}.` : "Execution was interrupted before completion.",
    };
  }
  if (run && run.status === "failed") {
    return {
      label: "failed",
      warn: true,
      summary: run.summary || "Execution failed.",
      detail:
        run.errorMessage ||
        (run.exitCode === undefined || run.exitCode === null ? "Execution failed." : `Exit code ${run.exitCode}.`),
    };
  }
  if (run && run.status === "passed") {
    return {
      label: "passed",
      warn: false,
      summary: run.summary || "Execution completed successfully.",
      detail: run.exitCode === undefined || run.exitCode === null ? "Evidence recorded." : `Exit code ${run.exitCode}.`,
    };
  }
  return {
    label: run && run.status ? run.status : "pending",
    warn: false,
    summary: run && run.summary ? run.summary : "No summary recorded.",
    detail: "",
  };
}

export function describeRunPresentation(run) {
  const outcome = describeRunOutcome(run);
  const normalized = normalizePresentationTone(outcome.label);

  return {
    tone: normalized,
    headline:
      normalized === "cancelled"
        ? "Cancelled from dashboard"
        : normalized === "timed-out"
          ? "Timed out"
          : normalized === "interrupted"
            ? "Interrupted"
            : normalized === "failed"
              ? "Failed"
              : normalized === "passed"
                ? "Passed"
                : "Recorded",
    summary: outcome.summary,
    detail: outcome.detail,
    warn: outcome.warn,
  };
}

export function describeExecutionState(executionState) {
  const state = executionState && typeof executionState === "object" ? executionState : { status: "idle" };
  const adapterLabel = state.adapterId || "adapter";
  const outcome = normalizeExecutionOutcome(state);

  if (state.status === "starting") {
    return {
      statusLabel: "starting",
      warn: false,
      summary: `Starting local ${adapterLabel} execution.`,
    };
  }
  if (state.status === "running") {
    return {
      statusLabel: "running",
      warn: false,
      summary:
        state.activity === "streaming-output"
          ? `Local ${adapterLabel} execution is running and streaming local output.`
          : `Local ${adapterLabel} execution is running and waiting for first output.`,
    };
  }
  if (state.status === "cancel-requested") {
    return {
      statusLabel: "cancel requested",
      warn: true,
      summary: `Cancellation requested for local ${adapterLabel} execution.`,
    };
  }
  if (state.status === "failed-to-start") {
    return {
      statusLabel: "failed to start",
      warn: true,
      summary: state.error || `Local ${adapterLabel} execution failed to start.`,
    };
  }
  if (state.status === "preflight-failed") {
    return {
      statusLabel: "preflight failed",
      warn: true,
      summary: state.error || `Local ${adapterLabel} execution is blocked by preflight.`,
    };
  }
  if (state.status === "completed") {
    const resolvedOutcome =
      outcome === "cancelled"
        ? { label: "cancelled", warn: false, summary: "Cancelled from dashboard." }
        : outcome === "timed-out"
          ? { label: "timed out", warn: true, summary: state.summary || "Execution hit its configured timeout." }
          : outcome === "interrupted"
            ? { label: "interrupted", warn: true, summary: state.summary || "Execution was interrupted before completion." }
            : outcome === "passed"
              ? { label: "passed", warn: false, summary: state.summary || "Execution completed successfully." }
              : { label: "failed", warn: true, summary: state.summary || "Execution failed." };

    return {
      statusLabel: resolvedOutcome.label,
      warn: resolvedOutcome.warn,
      summary:
        resolvedOutcome.label === "cancelled"
          ? `Local ${adapterLabel} execution was cancelled from dashboard.`
          : resolvedOutcome.label === "passed"
            ? `Local ${adapterLabel} execution completed successfully.`
            : state.summary || resolvedOutcome.summary,
    };
  }
  return {
    statusLabel: "idle",
    warn: false,
    summary: "No dashboard-triggered execution for the selected task yet.",
  };
}

export function describeExecutionPresentation(executionState) {
  const state = executionState && typeof executionState === "object" ? executionState : { status: "idle" };
  const description = describeExecutionState(state);
  const outcome = normalizeExecutionOutcome(state);

  if (state.status === "starting") {
    return { tone: "running", headline: "Starting local execution", summary: description.summary, warn: false };
  }
  if (state.status === "running") {
    return {
      tone: state.activity === "streaming-output" ? "running" : "pending",
      headline: state.activity === "streaming-output" ? "Streaming local output" : "Awaiting first output",
      summary: description.summary,
      warn: false,
    };
  }
  if (state.status === "cancel-requested") {
    return { tone: "cancel-requested", headline: "Cancellation requested", summary: description.summary, warn: true };
  }
  if (state.status === "failed-to-start") {
    return { tone: "failed", headline: "Failed to start", summary: description.summary, warn: true };
  }
  if (state.status === "preflight-failed") {
    return { tone: "failed", headline: "Preflight blocked", summary: description.summary, warn: true };
  }
  if (state.status === "completed") {
    const normalized = normalizePresentationTone(outcome || description.statusLabel);
    return {
      tone: normalized,
      headline:
        normalized === "cancelled"
          ? "Cancelled from dashboard"
          : normalized === "timed-out"
            ? "Timed out"
            : normalized === "interrupted"
              ? "Interrupted"
              : normalized === "passed"
                ? "Completed successfully"
                : "Execution failed",
      summary: description.summary,
      warn: description.warn,
    };
  }
  return { tone: "idle", headline: "No execution yet", summary: description.summary, warn: false };
}

export function normalizePresentationTone(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "timed out") {
    return "timed-out";
  }
  if (normalized === "cancel requested") {
    return "cancel-requested";
  }
  if (normalized === "failed to start" || normalized === "preflight failed") {
    return "failed";
  }
  if (["cancelled", "timed-out", "interrupted", "failed", "passed", "running", "pending", "idle"].includes(normalized)) {
    return normalized;
  }
  return normalized || "idle";
}

export function describeExecutorOutcome(outcome, summary) {
  const normalized = String(outcome || "").trim().toLowerCase();

  if (normalized === "cancelled") {
    return { label: "executor cancelled", warn: false, summary: summary || "Latest local executor run was cancelled from dashboard." };
  }
  if (normalized === "timed-out") {
    return { label: "executor timed out", warn: true, summary: summary || "Latest local executor run timed out." };
  }
  if (normalized === "interrupted") {
    return { label: "executor interrupted", warn: true, summary: summary || "Latest local executor run was interrupted." };
  }
  if (normalized === "passed") {
    return { label: "executor passed", warn: false, summary: summary || "Latest local executor run completed successfully." };
  }
  if (normalized === "failed") {
    return { label: "executor failed", warn: true, summary: summary || "Latest local executor run failed." };
  }
  return null;
}

export function formatTimestampLabel(value) {
  if (!value) {
    return "No timestamp";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return `Updated ${date.toLocaleString()}`;
}

export function isActiveExecutionState(executionState) {
  return Boolean(
    executionState &&
      (executionState.status === "starting" ||
        executionState.status === "running" ||
        executionState.status === "cancel-requested")
  );
}

export function resolveExecutionLogSource(taskId, executionState, stream) {
  const state = executionState && typeof executionState === "object" ? executionState : {};
  const fieldName = stream === "stderr" ? "stderrFile" : stream === "stdout" ? "stdoutFile" : null;
  if (!fieldName || !state[fieldName]) {
    return null;
  }

  if (!isActiveExecutionState(state) && state.status === "completed" && state.runId) {
    return {
      kind: "run",
      taskId,
      stream,
      runId: state.runId,
      path: state[fieldName],
    };
  }

  return {
    kind: "execution",
    taskId,
    stream,
    runId: state.runId || null,
    path: state[fieldName],
  };
}

export function formatVerificationGateLabel(status, relevantChangeCount) {
  if (status === "action-required" || status === "needs-proof") {
    return `Action required (${relevantChangeCount})`;
  }
  if (status === "incomplete" || status === "partially-covered") {
    return `Incomplete (${relevantChangeCount})`;
  }
  if (status === "covered") {
    return relevantChangeCount > 0 ? `Covered (${relevantChangeCount})` : "Covered";
  }
  if (status === "unconfigured" || status === "scope-missing") {
    return "Scope not set";
  }
  if (status === "unavailable") {
    return "Diff unavailable";
  }
  return relevantChangeCount > 0 ? `Ready (${relevantChangeCount})` : "Ready";
}

export function isVerificationGateWarning(status) {
  return (
    status === "action-required" ||
    status === "needs-proof" ||
    status === "incomplete" ||
    status === "partially-covered" ||
    status === "unconfigured" ||
    status === "scope-missing"
  );
}

export function getExecutionLogPanelId(stream) {
  return `execution-log-${String(stream || "").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

export function getRunLogPanelId(runId) {
  return `run-log-${String(runId).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}
