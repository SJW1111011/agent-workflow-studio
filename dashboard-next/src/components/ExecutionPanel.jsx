import { useDashboardContext } from "../context/DashboardContext.jsx";
import useLogSSE from "../hooks/useLogSSE.js";
import {
  describeExecutionPresentation,
  describeExecutionState,
  formatTimestampLabel,
  isActiveExecutionState,
  resolveExecutionLogSource,
} from "../utils/execution.js";

function describeExecutionConnectionLabel(status) {
  if (status === "open") {
    return "live sse";
  }
  if (status === "connecting") {
    return "sse reconnecting";
  }
  return "snapshot polling";
}

function describeLogStatus(log, stream, liveConnectionStatus) {
  if (log.source !== "execution") {
    return `Reading ${stream} output from recorded run ${log.runId || "log"}.`;
  }

  if (liveConnectionStatus === "open") {
    return `Streaming live ${stream} output from the active local execution.`;
  }

  if (liveConnectionStatus === "connecting") {
    return `Reconnecting live ${stream} output. Snapshot fallback remains active until SSE resumes.`;
  }

  if (liveConnectionStatus === "error" || liveConnectionStatus === "unsupported") {
    return `Polling ${stream} output because the live SSE stream is unavailable.`;
  }

  return log.active
    ? `Reading live ${stream} output from the active local execution.`
    : `Reading ${stream} output captured for the latest dashboard execution.`;
}

function LogPanel({ entry, liveConnectionStatus = "idle", stream }) {
  if (!entry || entry.status === "loading") {
    return <p className="subtle">{`Loading ${stream}...`}</p>;
  }

  if (entry.status === "unavailable") {
    return <div className="empty">{`No ${stream} log is available for this execution state.`}</div>;
  }

  if (entry.status === "error") {
    return <div className="empty">{entry.error || "Unable to load log output."}</div>;
  }

  const log = entry.data;
  if (!log) {
    return <div className="empty">Log output is unavailable.</div>;
  }

  return (
    <>
      <p className="subtle">{describeLogStatus(log, stream, liveConnectionStatus)}</p>
      {log.path ? <p className="subtle">Log path: {log.path}</p> : null}
      {log.truncated ? <p className="subtle">{`Showing last ${log.content.length} of ${log.size} chars.`}</p> : null}
      {log.updatedAt ? (
        <p className="subtle">{`${log.active ? "Auto-refreshing" : "Last updated"} ${formatTimestampLabel(log.updatedAt)}`}</p>
      ) : null}
      <pre className="detail-pre">{log.content || "(empty log)"}</pre>
    </>
  );
}

export default function ExecutionPanel({ detail }) {
  const { api, executionConnectionStatus, state, toggleExecutionStream } = useDashboardContext();
  const taskId = detail?.meta?.id;
  const executionState = detail?.executionState || state.executionState;
  const executionLogs = state.logState.taskId === taskId ? state.logState.executionLogs : {};
  const openStreams = state.logState.taskId === taskId ? state.logState.openStreams : [];
  const streamSources = {
    stdout: resolveExecutionLogSource(taskId, executionState, "stdout"),
    stderr: resolveExecutionLogSource(taskId, executionState, "stderr"),
  };
  const stdoutLog = useLogSSE(taskId, "stdout", {
    enabled: openStreams.includes("stdout") && streamSources.stdout?.kind === "execution",
    initialEntry: executionLogs.stdout,
    loadSnapshot: api.loadTaskExecutionLog,
  });
  const stderrLog = useLogSSE(taskId, "stderr", {
    enabled: openStreams.includes("stderr") && streamSources.stderr?.kind === "execution",
    initialEntry: executionLogs.stderr,
    loadSnapshot: api.loadTaskExecutionLog,
  });
  const liveLogs = {
    stderr: stderrLog,
    stdout: stdoutLog,
  };

  if (!taskId) {
    return <div className="empty">Select a task to view local execution status.</div>;
  }

  const presentation = describeExecutionPresentation(executionState);
  const description = describeExecutionState(executionState);
  const streams = ["stdout", "stderr"].filter(
    (stream) => streamSources[stream] || openStreams.includes(stream)
  );

  return (
    <div className="list">
      <article className={`list-item execution-state-card execution-tone-${presentation.tone}`}>
        <h3>{presentation.headline}</h3>
        <p>{presentation.summary}</p>
        <div className="tag-row">
          <span className={description.warn ? "tag warn" : "tag"}>{description.statusLabel}</span>
          {executionState?.adapterId ? <span className="tag">{executionState.adapterId}</span> : null}
          {executionState?.runId ? <span className="tag">{executionState.runId}</span> : null}
          {isActiveExecutionState(executionState) ? (
            <span className="tag">{describeExecutionConnectionLabel(executionConnectionStatus)}</span>
          ) : null}
          {executionState?.updatedAt ? <span className="tag">{formatTimestampLabel(executionState.updatedAt)}</span> : null}
        </div>
        {Array.isArray(executionState?.blockingIssues) && executionState.blockingIssues.length > 0 ? (
          <ul className="editor-guidance-list">
            {executionState.blockingIssues.map((issue, index) => (
              <li key={`${issue.field || "blocking"}:${index}`}>
                {issue.message || issue.field || "Blocking issue reported."}
              </li>
            ))}
          </ul>
        ) : null}
        {Array.isArray(executionState?.advisories) && executionState.advisories.length > 0 ? (
          <ul className="editor-guidance-list">
            {executionState.advisories.map((issue, index) => (
              <li key={`${issue.field || "advisory"}:${index}`}>
                {issue.message || issue.field || "Advisory reported."}
              </li>
            ))}
          </ul>
        ) : null}
      </article>

      {streams.length > 0 ? (
        <article className="list-item">
          <h3>Execution Logs</h3>
          <div className="form-inline-actions">
            {streams.map((stream) => {
              const isOpen = openStreams.includes(stream);
              const source = streamSources[stream];
              const label = isOpen ? `Hide ${stream}` : source?.kind === "execution" ? `Tail ${stream}` : `View ${stream}`;

              return (
                <button
                  className="secondary-button log-button execution-log-button"
                  key={stream}
                  onClick={() => toggleExecutionStream(taskId, stream)}
                  type="button"
                >
                  {label}
                </button>
              );
            })}
          </div>

          {streams.map((stream) =>
            openStreams.includes(stream) ? (
              <div className="run-log-panel" id={`execution-log-${stream}`} key={`panel:${stream}`}>
                <LogPanel
                  entry={
                    streamSources[stream]?.kind === "execution"
                      ? liveLogs[stream].entry || executionLogs[stream]
                      : executionLogs[stream]
                  }
                  liveConnectionStatus={
                    streamSources[stream]?.kind === "execution" ? liveLogs[stream].connectionStatus : "idle"
                  }
                  stream={stream}
                />
              </div>
            ) : null
          )}
        </article>
      ) : null}
    </div>
  );
}
