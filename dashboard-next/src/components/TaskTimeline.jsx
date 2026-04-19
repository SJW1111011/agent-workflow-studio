import {
  describeExecutorOutcome,
  describeRunPresentation,
} from "../utils/execution.js";
import {
  describeTaskVerificationSignal,
  formatTaskVerificationFreshnessSummary,
  getTaskCardToneClass,
} from "../utils/taskBoard.js";
import {
  buildTimelineAxis,
  buildTimelineBounds,
  getTimelinePosition,
  groupRunsByTaskId,
  parseTimestamp,
  sortTasksByCreatedAt,
} from "../utils/taskViews.js";

function formatTimelineLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown time";
  }

  return date.toLocaleString(undefined, {
    day: "numeric",
    hour: "numeric",
    month: "short",
  });
}

function formatDateLabel(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "Unknown date";
  }

  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function getMarkerToneClass(tone) {
  if (tone === "passed" || tone === "running") {
    return "timeline-marker-ok";
  }
  if (tone === "cancelled") {
    return "timeline-marker-cancelled";
  }
  if (tone === "timed-out" || tone === "interrupted" || tone === "failed") {
    return "timeline-marker-warn";
  }
  return "timeline-marker-neutral";
}

export default function TaskTimeline({
  activeTaskId,
  onSelectTask,
  runs,
  tasks,
}) {
  const sortedTasks = sortTasksByCreatedAt(tasks);
  const runsByTaskId = groupRunsByTaskId(runs);
  const bounds = buildTimelineBounds(sortedTasks, runs);
  const axis = buildTimelineAxis(bounds, 5);

  return (
    <div className="timeline-scroll">
      <div className="timeline-surface">
        <div className="timeline-legend subtle">
          The large ring marks when a task was created. Smaller dots show
          recorded runs on the same project timeline.
        </div>
        <div className="timeline-axis" aria-hidden="true">
          <span className="timeline-axis-track" />
          {axis.map((marker) => (
            <span
              className="timeline-axis-marker"
              key={marker.timestamp}
              style={{ left: `${marker.position}%` }}
            >
              <span className="timeline-axis-tick" />
              <span className="timeline-axis-label">
                {formatTimelineLabel(marker.timestamp)}
              </span>
            </span>
          ))}
        </div>

        <div className="timeline-list">
          {sortedTasks.map((task) => {
            const taskRuns = runsByTaskId.get(task.id) || [];
            const createdAt =
              parseTimestamp(task.createdAt) ?? parseTimestamp(task.updatedAt);
            const verificationSignal = describeTaskVerificationSignal(task);
            const executorOutcome = describeExecutorOutcome(
              task.latestExecutorOutcome,
              task.latestExecutorSummary,
            );
            const freshnessSummary = formatTaskVerificationFreshnessSummary(task);
            const toneClass = getTaskCardToneClass(task);
            const activeClass = task.id === activeTaskId ? " active" : "";
            const createdPosition = getTimelinePosition(createdAt, bounds);

            return (
              <button
                aria-pressed={task.id === activeTaskId}
                className={`task-card timeline-card ${toneClass}${activeClass}`}
                data-task-id={task.id}
                key={task.id}
                onClick={() => onSelectTask(task.id)}
                type="button"
              >
                <span className="timeline-card-head">
                  <span className="task-card-title">
                    {task.id} - {task.title}
                  </span>
                  <span className="task-card-meta subtle">
                    Created {formatDateLabel(task.createdAt || task.updatedAt)} |{" "}
                    {taskRuns.length} run(s)
                  </span>
                </span>

                <span className="timeline-track-wrap" aria-hidden="true">
                  <span className="timeline-track" />
                  <span
                    className="timeline-point timeline-point-created"
                    style={{ left: `${createdPosition}%` }}
                  />
                  {taskRuns.map((run) => {
                    const presentation = describeRunPresentation(run);
                    const position = getTimelinePosition(
                      run.completedAt || run.createdAt,
                      bounds,
                    );

                    return (
                      <span
                        className={`timeline-point ${getMarkerToneClass(
                          presentation.tone,
                        )}`}
                        key={run.id}
                        style={{ left: `${position}%` }}
                        title={`${run.id}: ${presentation.headline}`}
                      />
                    );
                  })}
                </span>

                <span className="task-card-summary">
                  {task.latestRunSummary ||
                    verificationSignal.summary ||
                    task.goal ||
                    "No summary recorded yet."}
                </span>
                <span className="tag-row">
                  <span className="tag">{task.recipeId || "feature"}</span>
                  <span className={verificationSignal.warn ? "tag warn" : "tag"}>
                    {verificationSignal.label}
                  </span>
                  {executorOutcome?.label ? (
                    <span className={executorOutcome.warn ? "tag warn" : "tag"}>
                      {executorOutcome.label}
                    </span>
                  ) : null}
                  <span className="tag">{task.coveragePercent || 0}% coverage</span>
                  {freshnessSummary ? (
                    <span className="tag">{freshnessSummary}</span>
                  ) : null}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
