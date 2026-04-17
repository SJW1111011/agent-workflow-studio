import { useDashboardContext } from "../context/DashboardContext.jsx";
import {
  describeExecutionPresentation,
  describeExecutionState,
  formatTimestampLabel,
  resolveExecutionLogSource,
} from "../utils/execution.js";

function LogPanel({ entry, stream }) {
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
      <p className="subtle">
        {log.source === "execution"
          ? log.active
            ? `Reading live ${stream} output from the active local execution.`
            : `Reading ${stream} output captured for the latest dashboard execution.`
          : `Reading ${stream} output from recorded run ${log.runId || "log"}.`}
      </p>
      <p className="subtle">Log path: {log.path}</p>
      {log.truncated ? <p className="subtle">{`Showing last ${log.content.length} of ${log.size} chars.`}</p> : null}
      {log.updatedAt ? (
        <p className="subtle">{`${log.active ? "Auto-refreshing" : "Last updated"} ${formatTimestampLabel(log.updatedAt)}`}</p>
      ) : null}
      <pre className="detail-pre">{log.content || "(empty log)"}</pre>
    </>
  );
}

export default function ExecutionPanel({ detail }) {
  const { state, toggleExecutionStream } = useDashboardContext();
  const taskId = detail?.meta?.id;
  const executionState = detail?.executionState || state.executionState;

  if (!taskId) {
    return <div className="empty">Select a task to view local execution status.</div>;
  }

  const presentation = describeExecutionPresentation(executionState);
  const description = describeExecutionState(executionState);
  const openStreams = state.logState.taskId === taskId ? state.logState.openStreams : [];
  const streams = ["stdout", "stderr"].filter(
    (stream) => resolveExecutionLogSource(taskId, executionState, stream) || openStreams.includes(stream)
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
              const source = resolveExecutionLogSource(taskId, executionState, stream);
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
                <LogPanel entry={state.logState.executionLogs[stream]} stream={stream} />
              </div>
            ) : null
          )}
        </article>
      ) : null}
    </div>
  );
}
