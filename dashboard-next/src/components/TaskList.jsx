import { useDashboardContext } from "../context/DashboardContext.jsx";
import {
  describeExecutorOutcome,
  formatTimestampLabel,
} from "../utils/execution.js";
import {
  describeTaskVerificationSignal,
  filterTasksByExecutorOutcome,
  formatTaskVerificationFreshnessSummary,
  getTaskCardToneClass,
  normalizeExecutorOutcomeFilter,
  summarizeExecutorOutcomeFilter,
} from "../utils/taskBoard.js";

export default function TaskList({ hidden }) {
  const { selectTask, setActiveExecutorOutcomeFilter, state } =
    useDashboardContext();
  const tasks = state.overview.data?.tasks || [];
  const normalizedFilter = normalizeExecutorOutcomeFilter(
    state.activeExecutorOutcomeFilter,
  );
  const visibleTasks = filterTasksByExecutorOutcome(tasks, normalizedFilter);
  const summaryText = summarizeExecutorOutcomeFilter(
    tasks.length,
    visibleTasks.length,
    normalizedFilter,
  );

  return (
    <section
      className={hidden ? "panel panel-wide tab-hidden" : "panel panel-wide"}
      data-tab="tasks"
    >
      <div className="panel-head">
        <div>
          <h2>Tasks</h2>
          <p>
            What the agents are supposed to do and whether enough trustworthy
            evidence exists behind each task.
          </p>
        </div>
        <div className="panel-head-controls">
          <label className="panel-filter">
            <span>Executor Outcome</span>
            <select
              id="task-executor-filter"
              onChange={(event) =>
                setActiveExecutorOutcomeFilter(event.currentTarget.value)
              }
              value={normalizedFilter}
            >
              <option value="all">All tasks</option>
              <option value="passed">Executor passed</option>
              <option value="failed">Executor failed</option>
              <option value="timed-out">Executor timed out</option>
              <option value="interrupted">Executor interrupted</option>
              <option value="cancelled">Executor cancelled</option>
              <option value="none">No executor run</option>
            </select>
          </label>
          <p className="subtle panel-filter-summary">{summaryText}</p>
        </div>
      </div>

      <div className="task-grid">
        {visibleTasks.length === 0 ? (
          <div className="empty">No tasks match the current filter.</div>
        ) : (
          visibleTasks.map((task) => {
            const verificationSignal = describeTaskVerificationSignal(task);
            const executorOutcome = describeExecutorOutcome(
              task.latestExecutorOutcome,
              task.latestExecutorSummary,
            );
            const freshnessSummary =
              formatTaskVerificationFreshnessSummary(task);
            const toneClass = getTaskCardToneClass(
              task,
              task.latestExecutorOutcome,
            );
            const activeClass = task.id === state.activeTaskId ? " active" : "";

            return (
              <button
                aria-pressed={task.id === state.activeTaskId}
                className={`task-card ${toneClass}${activeClass}`}
                data-task-id={task.id}
                key={task.id}
                onClick={() => selectTask(task.id)}
                type="button"
              >
                <span className="task-card-title">
                  {task.id} - {task.title}
                </span>
                <span className="task-card-meta subtle">
                  Priority {task.priority || "P2"} | Status{" "}
                  {task.status || "todo"}
                </span>
                <span className="task-card-summary">
                  {task.latestRunSummary ||
                    verificationSignal.summary ||
                    task.goal ||
                    "No summary recorded yet."}
                </span>
                <span className="tag-row">
                  <span className="tag">{task.recipeId || "feature"}</span>
                  <span
                    className={verificationSignal.warn ? "tag warn" : "tag"}
                  >
                    {verificationSignal.label}
                  </span>
                  {executorOutcome?.label ? (
                    <span className={executorOutcome.warn ? "tag warn" : "tag"}>
                      {executorOutcome.label}
                    </span>
                  ) : null}
                  {freshnessSummary ? (
                    <span className="tag">{freshnessSummary}</span>
                  ) : null}
                </span>
                <span className="task-card-footnote subtle">
                  Coverage {task.coveragePercent || 0}% |{" "}
                  {task.relevantChangeCount || 0} relevant change(s) | Updated{" "}
                  {formatTimestampLabel(task.updatedAt)}
                </span>
              </button>
            );
          })
        )}
      </div>
    </section>
  );
}
