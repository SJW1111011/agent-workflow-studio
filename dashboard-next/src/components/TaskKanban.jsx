import { describeExecutorOutcome, formatTimestampLabel } from "../utils/execution.js";
import {
  describeTaskVerificationSignal,
  formatTaskVerificationFreshnessSummary,
  getTaskCardToneClass,
} from "../utils/taskBoard.js";
import { groupTasksByStatus } from "../utils/taskViews.js";

const EMPTY_COLUMN_COPY = {
  done: "Completed work will collect here.",
  in_progress: "Tasks with active momentum show up here.",
  todo: "Queued tasks show up here.",
};

function CoverageMeter({ coveragePercent, warn }) {
  return (
    <span className="task-card-coverage">
      <span className="subtle task-card-coverage-copy">
        Coverage {coveragePercent || 0}%
      </span>
      <span className="coverage-bar coverage-bar-compact" aria-hidden="true">
        <span
          className={
            warn ? "coverage-bar-fill coverage-bar-fill-warn" : "coverage-bar-fill"
          }
          style={{ width: `${Math.max(0, Math.min(100, coveragePercent || 0))}%` }}
        />
      </span>
    </span>
  );
}

function KanbanCard({ activeTaskId, onSelectTask, task }) {
  const verificationSignal = describeTaskVerificationSignal(task);
  const executorOutcome = describeExecutorOutcome(
    task.latestExecutorOutcome,
    task.latestExecutorSummary,
  );
  const freshnessSummary = formatTaskVerificationFreshnessSummary(task);
  const toneClass = getTaskCardToneClass(task);
  const activeClass = task.id === activeTaskId ? " active" : "";

  return (
    <button
      aria-pressed={task.id === activeTaskId}
      className={`task-card kanban-card ${toneClass}${activeClass}`}
      data-task-id={task.id}
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
      <CoverageMeter
        coveragePercent={task.coveragePercent || 0}
        warn={verificationSignal.warn || (task.coveragePercent || 0) < 100}
      />
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
        {freshnessSummary ? <span className="tag">{freshnessSummary}</span> : null}
      </span>
      <span className="task-card-footnote subtle">
        {task.relevantChangeCount || 0} relevant change(s) | {formatTimestampLabel(task.updatedAt)}
      </span>
    </button>
  );
}

export default function TaskKanban({ activeTaskId, onSelectTask, tasks }) {
  const columns = groupTasksByStatus(tasks);

  return (
    <div className="kanban-board">
      {columns.map((column) => (
        <section className="kanban-column" key={column.id}>
          <div className="kanban-column-head">
            <div>
              <h3>{column.label}</h3>
              <p>{column.description}</p>
            </div>
            <span className="kanban-column-count">{column.count}</span>
          </div>
          <div className="kanban-column-list">
            {column.tasks.length === 0 ? (
              <div className="empty">
                {EMPTY_COLUMN_COPY[column.id] || "No tasks in this column."}
              </div>
            ) : (
              column.tasks.map((task) => (
                <KanbanCard
                  activeTaskId={activeTaskId}
                  key={task.id}
                  onSelectTask={onSelectTask}
                  task={task}
                />
              ))
            )}
          </div>
        </section>
      ))}
    </div>
  );
}
