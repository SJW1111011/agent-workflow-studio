(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  root.AgentWorkflowDashboardLogPanelHelpers = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function createExecutionLogState(taskId = null, openStreams = []) {
    return {
      taskId: taskId || null,
      openStreams: normalizeOpenStreams(openStreams),
    };
  }

  function clearExecutionLogState(nextTaskId = null) {
    return createExecutionLogState(nextTaskId, []);
  }

  function ensureExecutionLogTaskState(state, taskId) {
    const current = normalizeExecutionLogState(state);
    return current.taskId === taskId ? current : createExecutionLogState(taskId, []);
  }

  function toggleExecutionLogStreamState(state, taskId, stream) {
    const current = ensureExecutionLogTaskState(state, taskId);
    const openStreams = new Set(current.openStreams);

    if (openStreams.has(stream)) {
      openStreams.delete(stream);
    } else {
      openStreams.add(stream);
    }

    return createExecutionLogState(taskId, openStreams);
  }

  function hasOpenExecutionLogStreams(state, taskId) {
    const current = normalizeExecutionLogState(state);
    return Boolean(taskId) && current.taskId === taskId && current.openStreams.size > 0;
  }

  function isExecutionLogStreamOpen(state, taskId, stream) {
    const current = normalizeExecutionLogState(state);
    return Boolean(taskId) && current.taskId === taskId && current.openStreams.has(stream);
  }

  async function loadResolvedExecutionLog(logSource, loaders = {}) {
    if (!logSource || !logSource.kind) {
      throw new Error("Execution log source is unavailable.");
    }

    if (logSource.kind === "run") {
      if (typeof loaders.loadRunLog !== "function") {
        throw new Error("Run log loader is unavailable.");
      }

      const log = await loaders.loadRunLog(logSource.taskId, logSource.runId, logSource.stream);
      return {
        ...log,
        source: "run",
        active: false,
        pending: false,
      };
    }

    if (typeof loaders.loadTaskExecutionLog !== "function") {
      throw new Error("Execution log loader is unavailable.");
    }

    const log = await loaders.loadTaskExecutionLog(logSource.taskId, logSource.stream);
    return {
      ...log,
      source: "execution",
    };
  }

  function renderExecutionLogLoading(stream) {
    return `<p class="subtle">${escapeHtml(`Loading ${stream}...`)}</p>`;
  }

  function renderExecutionLogUnavailable(stream) {
    return `<div class="empty">${escapeHtml(`No ${stream} log is available for this execution state.`)}</div>`;
  }

  function renderExecutionLogError(message) {
    return `<div class="empty">${escapeHtml(message || "Unable to load log output.")}</div>`;
  }

  function renderExecutionLogView(log, stream, formatTimestampLabel) {
    const formatTimestamp = typeof formatTimestampLabel === "function" ? formatTimestampLabel : defaultTimestampLabel;

    return `
      <p class="subtle">${escapeHtml(
        log.source === "run"
          ? `Showing persisted ${stream} from run ${log.runId}.`
          : `Reading live ${stream} output from the active local execution.`
      )}</p>
      <p class="subtle">Log path: ${escapeHtml(log.path)}</p>
      ${
        log.pending
          ? `<p class="subtle">${escapeHtml(`Waiting for ${stream} output to appear...`)}</p>`
          : log.truncated
            ? `<p class="subtle">${escapeHtml(`Showing last ${log.content.length} of ${log.size} chars.`)}</p>`
            : ""
      }
      ${
        log.updatedAt
          ? `<p class="subtle">${escapeHtml(`${log.active ? "Auto-refreshing" : "Last updated"} ${formatTimestamp(log.updatedAt)}`)}</p>`
          : log.source === "run"
            ? `<p class="subtle">${escapeHtml("Persisted run log ready for durable inspection.")}</p>`
            : ""
      }
      <pre class="detail-pre">${escapeHtml(log.content || (log.pending ? "" : "(empty log)"))}</pre>
    `;
  }

  function renderRunLogView(log) {
    return `
      <p class="subtle">Log path: ${escapeHtml(log.path)}</p>
      ${log.truncated ? `<p class="subtle">Showing last ${escapeHtml(log.content.length)} of ${escapeHtml(log.size)} chars.</p>` : ""}
      <pre class="detail-pre">${escapeHtml(log.content || "(empty log)")}</pre>
    `;
  }

  function normalizeExecutionLogState(state) {
    if (!state || typeof state !== "object") {
      return createExecutionLogState();
    }

    return {
      taskId: state.taskId || null,
      openStreams: normalizeOpenStreams(state.openStreams),
    };
  }

  function normalizeOpenStreams(value) {
    if (value instanceof Set) {
      return new Set(value);
    }

    return new Set(Array.isArray(value) ? value : []);
  }

  function defaultTimestampLabel(value) {
    if (!value) {
      return "No timestamp";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return `Updated ${date.toLocaleString()}`;
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
    clearExecutionLogState,
    createExecutionLogState,
    ensureExecutionLogTaskState,
    hasOpenExecutionLogStreams,
    isExecutionLogStreamOpen,
    loadResolvedExecutionLog,
    renderExecutionLogError,
    renderExecutionLogLoading,
    renderExecutionLogUnavailable,
    renderExecutionLogView,
    renderRunLogView,
    toggleExecutionLogStreamState,
  };
});
