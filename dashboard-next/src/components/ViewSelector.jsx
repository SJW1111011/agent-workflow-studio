import {
  TASK_VIEW_OPTIONS,
  normalizeTaskView,
} from "../utils/taskViews.js";

export default function ViewSelector({ activeView, onChange }) {
  const normalizedView = normalizeTaskView(activeView);

  return (
    <div className="task-view-selector" role="group" aria-label="Task view">
      {TASK_VIEW_OPTIONS.map((option) => {
        const active = normalizedView === option.id;

        return (
          <button
            aria-pressed={active}
            className={active ? "task-view-button active" : "task-view-button"}
            key={option.id}
            onClick={() => onChange(option.id)}
            title={option.description}
            type="button"
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
