import { useEffect, useState } from "preact/hooks";
import TaskKanban from "./TaskKanban.jsx";
import TaskTimeline from "./TaskTimeline.jsx";
import ViewSelector from "./ViewSelector.jsx";
import { useDashboardContext } from "../context/DashboardContext.jsx";
import {
  describeExecutorOutcome,
  formatTimestampLabel,
} from "../utils/execution.js";
import {
  describeTaskVerificationSignal,
  describeTaskReviewStatus,
  filterTasksByExecutorOutcome,
  formatTaskVerificationFreshnessSummary,
  getTaskCardToneClass,
  normalizeExecutorOutcomeFilter,
  summarizeExecutorOutcomeFilter,
} from "../utils/taskBoard.js";
import {
  normalizeTaskView,
  TASK_VIEW_STORAGE_KEY,
} from "../utils/taskViews.js";

function getInitialTaskView() {
  if (typeof window === "undefined") {
    return "list";
  }

  try {
    return normalizeTaskView(
      window.localStorage.getItem(TASK_VIEW_STORAGE_KEY),
    );
  } catch {
    return "list";
  }
}

function TaskListGrid({ activeTaskId, onSelectTask, tasks }) {
  return (
    <div className="task-grid">
      {tasks.map((task) => {
        const verificationSignal = describeTaskVerificationSignal(task);
        const executorOutcome = describeExecutorOutcome(
          task.latestExecutorOutcome,
          task.latestExecutorSummary,
        );
        const reviewStatus = describeTaskReviewStatus(task);
        const freshnessSummary = formatTaskVerificationFreshnessSummary(task);
        const toneClass = getTaskCardToneClass(task, task.latestExecutorOutcome);
        const activeClass = task.id === activeTaskId ? " active" : "";

        return (
          <button
            aria-pressed={task.id === activeTaskId}
            className={`task-card ${toneClass}${activeClass}`}
            data-task-id={task.id}
            key={task.id}
            onClick={() => onSelectTask(task.id)}
            type="button"
          >
            <span className="task-card-title">
              {task.id} - {task.title}
            </span>
            <span className="task-card-meta subtle">
              Priority {task.priority || "P2"} | Status {task.status || "todo"}
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
              {freshnessSummary ? (
                <span className="tag">{freshnessSummary}</span>
              ) : null}
              {reviewStatus ? (
                <span className={reviewStatus.warn ? "tag warn" : "tag"}>
                  {reviewStatus.label}
                </span>
              ) : null}
            </span>
            <span className="task-card-footnote subtle">
              Coverage {task.coveragePercent || 0}% |{" "}
              {task.relevantChangeCount || 0} relevant change(s) |{" "}
              {formatTimestampLabel(task.updatedAt)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export default function TaskList({ hidden }) {
  const { selectTask, setActiveExecutorOutcomeFilter, state } =
    useDashboardContext();
  const tasks = state.overview.data?.tasks || [];
  const runs = state.overview.data?.runs || [];
  const normalizedFilter = normalizeExecutorOutcomeFilter(
    state.activeExecutorOutcomeFilter,
  );
  const visibleTasks = filterTasksByExecutorOutcome(tasks, normalizedFilter);
  const summaryText = summarizeExecutorOutcomeFilter(
    tasks.length,
    visibleTasks.length,
    normalizedFilter,
  );
  const [activeView, setActiveView] = useState(getInitialTaskView);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    try {
      window.localStorage.setItem(TASK_VIEW_STORAGE_KEY, activeView);
    } catch {
      // Ignore storage failures so view switching still works in-memory.
    }
  }, [activeView]);

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
          <ViewSelector activeView={activeView} onChange={setActiveView} />
          <p className="subtle panel-filter-summary">{summaryText}</p>
        </div>
      </div>

      {visibleTasks.length === 0 ? (
        <div className="empty">No tasks match the current filter.</div>
      ) : activeView === "kanban" ? (
        <TaskKanban
          activeTaskId={state.activeTaskId}
          onSelectTask={selectTask}
          tasks={visibleTasks}
        />
      ) : activeView === "timeline" ? (
        <TaskTimeline
          activeTaskId={state.activeTaskId}
          onSelectTask={selectTask}
          runs={runs}
          tasks={visibleTasks}
        />
      ) : (
        <TaskListGrid
          activeTaskId={state.activeTaskId}
          onSelectTask={selectTask}
          tasks={visibleTasks}
        />
      )}
    </section>
  );
}
