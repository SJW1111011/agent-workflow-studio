(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  root.AgentWorkflowDashboardExecutionDetailHelpers = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function isDashboardCancelSignal(signal) {
    return String(signal || "").trim().toLowerCase() === "dashboard-cancel";
  }

  function isDashboardCancelledRun(run) {
    return Boolean(run && run.interrupted && isDashboardCancelSignal(run.interruptionSignal));
  }

  function normalizeExecutionOutcome(executionState) {
    const state = executionState && typeof executionState === "object" ? executionState : {};
    if (typeof state.outcome === "string" && state.outcome.trim()) {
      return state.outcome.trim().toLowerCase();
    }

    if (state.status !== "completed") {
      return state.status === "failed-to-start" ? "failed-to-start" : "";
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

  function describeRunOutcome(run) {
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

  function describeRunPresentation(run) {
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

  function describeExecutionState(executionState) {
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

  function describeExecutionPresentation(executionState) {
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

  function normalizePresentationTone(value) {
    const normalized = String(value || "").trim().toLowerCase();
    if (normalized === "timed out") {
      return "timed-out";
    }
    if (normalized === "cancel requested") {
      return "cancel-requested";
    }
    if (normalized === "failed to start") {
      return "failed";
    }
    if (["cancelled", "timed-out", "interrupted", "failed", "passed", "running", "pending", "idle"].includes(normalized)) {
      return normalized;
    }
    return normalized || "idle";
  }

  function describeExecutorOutcome(outcome, summary) {
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

  function formatByteCount(value) {
    const bytes = Number(value);
    if (!Number.isFinite(bytes) || bytes <= 0) {
      return "0 B";
    }
    if (bytes < 1024) {
      return `${bytes} B`;
    }
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(bytes >= 10 * 1024 ? 0 : 1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function formatTimestampLabel(value) {
    if (!value) {
      return "No timestamp";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return `Updated ${date.toLocaleString()}`;
  }

  function renderStatusBanner(label, presentation) {
    const view = presentation && typeof presentation === "object" ? presentation : {};
    const tone = normalizePresentationTone(view.tone);
    const headline = view.headline || "Recorded";
    const summary = view.summary || "";

    return `
      <div class="status-banner status-banner-${escapeHtml(tone)}">
        <p class="status-banner-label">${escapeHtml(label)}</p>
        <h4>${escapeHtml(headline)}</h4>
        ${summary ? `<p>${escapeHtml(summary)}</p>` : ""}
      </div>
    `;
  }

  function describeExecutionActivity(executionState) {
    const state = executionState && typeof executionState === "object" ? executionState : {};
    const activity = String(state.activity || "").trim().toLowerCase();

    if (!activity || activity === "idle" || activity === "completed" || activity === "failed-to-start") {
      return null;
    }
    if (activity === "awaiting-output") {
      return { label: "awaiting output", warn: false };
    }
    if (activity === "streaming-output") {
      return { label: "streaming output", warn: false };
    }
    if (activity === "shutting-down") {
      return { label: "shutting down", warn: true };
    }

    return { label: activity, warn: false };
  }

  function renderExecutionStreamDetail(stream) {
    if (!stream || !stream.stream) {
      return "";
    }
    if (stream.exists) {
      const updated = stream.updatedAt ? `, updated ${formatTimestampLabel(stream.updatedAt)}` : "";
      return `<p class="subtle">${escapeHtml(`${stream.stream}: ${formatByteCount(stream.size)}${updated}`)}</p>`;
    }
    if (stream.pending) {
      return `<p class="subtle">${escapeHtml(`${stream.stream}: waiting for output file`)}</p>`;
    }
    if (stream.path) {
      return `<p class="subtle">${escapeHtml(`${stream.stream}: log path reserved but file is not available`)}</p>`;
    }
    return "";
  }

  function isActiveExecutionState(executionState) {
    return Boolean(
      executionState &&
        (executionState.status === "starting" ||
          executionState.status === "running" ||
          executionState.status === "cancel-requested")
    );
  }

  function renderExecutionStateMarkup(executionState, uiState = {}) {
    const state = executionState && typeof executionState === "object" ? executionState : { status: "idle" };
    const taskId = state.taskId || "";
    const adapterLabel = state.adapterId || "adapter";
    const description = describeExecutionState(state);
    const presentation = describeExecutionPresentation(state);
    const activityTag = describeExecutionActivity(state);
    const tags = [
      createTag(description.statusLabel, description.warn),
      activityTag ? createTag(activityTag.label, activityTag.warn) : "",
      state.runStatus ? createTag(state.runStatus, state.runStatus === "failed") : "",
      state.stdioMode ? createTag(`stdio ${state.stdioMode}`, false) : "",
      typeof state.exitCode === "number" ? createTag(`exit ${state.exitCode}`, state.runStatus === "failed") : "",
    ]
      .filter(Boolean)
      .join("");

    if ((state.status || "idle") === "idle") {
      return '<div class="empty">No dashboard-triggered execution for this task yet.</div>';
    }

    const detailLines = [
      renderStatusBanner("Execution state", presentation),
      state.startedAt ? `<p class="subtle">Started ${escapeHtml(formatTimestampLabel(state.startedAt))}</p>` : "",
      state.cancelRequestedAt ? `<p class="subtle">Cancel requested ${escapeHtml(formatTimestampLabel(state.cancelRequestedAt))}</p>` : "",
      state.completedAt ? `<p class="subtle">Completed ${escapeHtml(formatTimestampLabel(state.completedAt))}</p>` : "",
      state.runId ? `<p class="subtle">Run id: ${escapeHtml(state.runId)}</p>` : "",
      state.lastOutputAt ? `<p class="subtle">Latest output ${escapeHtml(formatTimestampLabel(state.lastOutputAt))}</p>` : "",
      state.totalOutputBytes > 0 ? `<p class="subtle">Captured ${escapeHtml(formatByteCount(state.totalOutputBytes))} so far.</p>` : "",
      renderExecutionStreamDetail(state.streams && state.streams.stdout),
      renderExecutionStreamDetail(state.streams && state.streams.stderr),
      state.stdoutFile ? `<p class="subtle">stdout: ${escapeHtml(state.stdoutFile)}</p>` : "",
      state.stderrFile ? `<p class="subtle">stderr: ${escapeHtml(state.stderrFile)}</p>` : "",
      state.status === "completed" && state.summary && state.summary !== description.summary
        ? `<p class="subtle">${escapeHtml(state.summary)}</p>`
        : "",
      state.error ? `<p class="subtle run-error">${escapeHtml(state.error)}</p>` : "",
    ]
      .filter(Boolean)
      .join("");

    return `
      <article class="list-item execution-state-card execution-tone-${escapeHtml(presentation.tone)}">
        <h3>${escapeHtml(adapterLabel)}</h3>
        ${detailLines}
        <div class="tag-row">${tags}</div>
        ${renderExecutionLogActions(taskId, state, uiState)}
      </article>
    `;
  }

  function renderExecutionStateSummary(executionState) {
    const state = executionState && typeof executionState === "object" ? executionState : { status: "idle" };
    const description = describeExecutionState(state);

    if (state.status === "running") {
      return `${description.summary}${state.totalOutputBytes > 0 ? ` Captured ${formatByteCount(state.totalOutputBytes)} so far.` : ""}`;
    }
    if (state.status === "cancel-requested") {
      return `${description.summary} Waiting for the shared executor to exit cleanly.`;
    }
    if (state.status === "completed") {
      return `${description.summary}${state.runId ? ` (${state.runId})` : ""}`;
    }

    return description.summary;
  }

  function getExecutionLogPanelId(stream) {
    return `execution-log-${String(stream || "").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  }

  function resolveExecutionLogSource(taskId, executionState, stream) {
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

  function buildExecutionLogPanelMarkup(taskId, state, stream, uiState = {}) {
    const logSource = resolveExecutionLogSource(taskId, state, stream);
    const isOpen = uiState.executionLogTaskId === taskId && normalizeOpenStreams(uiState.executionLogOpenStreams).has(stream);

    if (!logSource) {
      return "";
    }

    return `
      <div class="run-log-panel ${isOpen ? "" : "hidden"}" id="${getExecutionLogPanelId(stream)}">
        <p class="subtle">${escapeHtml(
          logSource.kind === "run"
            ? `View the persisted ${stream} log from run ${logSource.runId}.`
            : `Tail ${stream} from the active local execution.`
        )}</p>
      </div>
    `;
  }

  function renderExecutionLogActions(taskId, state, uiState = {}) {
    const openStreams = normalizeOpenStreams(uiState.executionLogOpenStreams);
    const buttons = ["stdout", "stderr"]
      .map((stream) => {
        const logSource = resolveExecutionLogSource(taskId, state, stream);
        if (!logSource) {
          return "";
        }

        const isOpen = uiState.executionLogTaskId === taskId && openStreams.has(stream);
        const label = isOpen
          ? `Hide ${stream}`
          : logSource.kind === "run"
            ? `View persisted ${stream}`
            : `Tail ${stream}`;
        return `<button type="button" class="log-button execution-log-button" data-task-id="${escapeHtml(taskId)}" data-execution-stream="${stream}">${escapeHtml(label)}</button>`;
      })
      .filter(Boolean);

    if (buttons.length === 0) {
      return "";
    }

    return `
      <div class="log-actions">${buttons.join("")}</div>
      ${buildExecutionLogPanelMarkup(taskId, state, "stdout", uiState)}
      ${buildExecutionLogPanelMarkup(taskId, state, "stderr", uiState)}
    `;
  }

  function renderTaskRun(run, taskId) {
    const outcome = describeRunOutcome(run);
    const presentation = describeRunPresentation(run);
    const tags = [
      createTag(outcome.label, outcome.warn),
      createTag(run.source || "manual", false),
      run.adapterId ? createTag(run.adapterId, false) : "",
      run.exitCode === undefined || run.exitCode === null ? "" : createTag(`exit ${run.exitCode}`, outcome.warn),
      run.timedOut ? createTag("timed out", true) : "",
      run.interrupted && !isDashboardCancelledRun(run) ? createTag("interrupted", true) : "",
    ]
      .filter(Boolean)
      .join("");

    const metaLines = [
      renderStatusBanner("Run outcome", presentation),
      outcome.detail ? `<p>${escapeHtml(outcome.detail)}</p>` : "",
      run.createdAt ? `<p class="subtle">Started ${escapeHtml(run.createdAt)}</p>` : "",
      run.completedAt ? `<p class="subtle">Completed ${escapeHtml(run.completedAt)}</p>` : "",
      run.durationMs !== undefined ? `<p class="subtle">Duration ${escapeHtml(run.durationMs)} ms</p>` : "",
      run.timeoutMs !== undefined ? `<p class="subtle">Timeout ${escapeHtml(run.timeoutMs)} ms</p>` : "",
      run.interruptionSignal ? `<p class="subtle">Interrupted by ${escapeHtml(run.interruptionSignal)}</p>` : "",
      run.terminationSignal ? `<p class="subtle">Termination signal ${escapeHtml(run.terminationSignal)}</p>` : "",
      Array.isArray(run.scopeProofPaths) && run.scopeProofPaths.length > 0
        ? `<p class="subtle">Proof paths: ${escapeHtml(run.scopeProofPaths.join(", "))}</p>`
        : "",
      Array.isArray(run.verificationChecks) && run.verificationChecks.length > 0
        ? run.verificationChecks
            .map((check) => `<p class="subtle">Check: ${escapeHtml(formatRunVerificationCheck(check))}</p>`)
            .join("")
        : "",
      Array.isArray(run.verificationArtifacts) && run.verificationArtifacts.length > 0
        ? `<p class="subtle">Verification artifacts: ${escapeHtml(run.verificationArtifacts.join(", "))}</p>`
        : "",
      run.stdoutFile ? `<p class="subtle">stdout: ${escapeHtml(run.stdoutFile)}</p>` : "",
      run.stderrFile ? `<p class="subtle">stderr: ${escapeHtml(run.stderrFile)}</p>` : "",
      run.errorMessage ? `<p class="subtle run-error">${escapeHtml(run.errorMessage)}</p>` : "",
    ]
      .filter(Boolean)
      .join("");

    const logActions = [
      run.stdoutFile
        ? `<button type="button" class="log-button" data-task-id="${escapeHtml(taskId)}" data-run-id="${escapeHtml(run.id)}" data-stream="stdout">View stdout</button>`
        : "",
      run.stderrFile
        ? `<button type="button" class="log-button" data-task-id="${escapeHtml(taskId)}" data-run-id="${escapeHtml(run.id)}" data-stream="stderr">View stderr</button>`
        : "",
    ]
      .filter(Boolean)
      .join("");

    return `
      <article class="list-item run-item run-tone-${escapeHtml(presentation.tone)}">
        <h3>${escapeHtml(run.agent || "manual")} - ${escapeHtml(outcome.label)}</h3>
        <div class="tag-row">${tags}</div>
        <div class="run-meta">${metaLines}</div>
        ${
          logActions
            ? `<div class="log-actions">${logActions}</div><div class="run-log-panel hidden" id="${getRunLogPanelId(run.id)}"></div>`
            : ""
        }
      </article>
    `;
  }

  function formatRunVerificationCheck(check) {
    if (!check || !check.label) {
      return "Recorded verification check";
    }

    const statusPrefix = check.status ? `[${check.status}] ` : "";
    const detailsSuffix = check.details ? ` - ${check.details}` : "";
    const artifactSuffix =
      Array.isArray(check.artifacts) && check.artifacts.length > 0 ? ` | artifacts: ${check.artifacts.join(", ")}` : "";
    return `${statusPrefix}${check.label}${detailsSuffix}${artifactSuffix}`;
  }

  function getRunLogPanelId(runId) {
    return `run-log-${String(runId).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  }

  function formatVerificationGateLabel(status, relevantChangeCount) {
    if (status === "needs-proof") {
      return `Proof needed (${relevantChangeCount})`;
    }
    if (status === "partially-covered") {
      return `Partial proof (${relevantChangeCount})`;
    }
    if (status === "covered") {
      return `Proof covered (${relevantChangeCount})`;
    }
    if (status === "scope-missing") {
      return "Scope hint needed";
    }
    if (status === "unavailable") {
      return "Diff unavailable";
    }
    return relevantChangeCount > 0 ? `Proof ready (${relevantChangeCount})` : "Proof ready";
  }

  function isVerificationGateWarning(status) {
    return status === "needs-proof" || status === "partially-covered" || status === "scope-missing";
  }

  function normalizeOpenStreams(value) {
    if (value instanceof Set) {
      return value;
    }
    return new Set(Array.isArray(value) ? value : []);
  }

  function createTag(label, warn) {
    return `<span class="tag ${warn ? "warn" : ""}">${escapeHtml(label)}</span>`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  return {
    describeExecutionPresentation,
    describeExecutionState,
    describeExecutorOutcome,
    describeRunOutcome,
    describeRunPresentation,
    formatTimestampLabel,
    formatVerificationGateLabel,
    getExecutionLogPanelId,
    getRunLogPanelId,
    isActiveExecutionState,
    isVerificationGateWarning,
    normalizePresentationTone,
    normalizeExecutionOutcome,
    renderExecutionStateMarkup,
    renderExecutionStateSummary,
    renderStatusBanner,
    renderTaskRun,
    resolveExecutionLogSource,
  };
});
