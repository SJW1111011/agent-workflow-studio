import ThemeToggle from "./ThemeToggle.jsx";

function describeThemeCopy(theme, resolvedTheme) {
  if (theme === "system") {
    return `Following your OS preference. The current system theme resolves to ${resolvedTheme}.`;
  }

  return `Pinned to ${resolvedTheme} mode until you switch back to system.`;
}

export default function Header({
  actionStatus,
  activeTab,
  initialized,
  onCreateTask,
  onThemeChange,
  pendingCount,
  resolvedTheme,
  theme,
  workspaceRoot,
}) {
  const statusTone = actionStatus?.tone
    ? `badge badge-status badge-status-${actionStatus.tone}`
    : "badge badge-status";

  return (
    <header className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Local-first control plane</p>
        <h1>Agent Workflow Studio</h1>
        <p className="lede">
          A workbench for human-agent collaboration on projects.
        </p>
        {onCreateTask && (
          <button
            className="button button-primary create-task-button"
            onClick={onCreateTask}
            type="button"
          >
            + Create Task
          </button>
        )}
      </div>
      <div className="hero-meta">
        <div className="theme-card">
          <p className="panel-eyebrow">Appearance</p>
          <ThemeToggle onChange={onThemeChange} theme={theme} />
          <p className="subtle theme-toggle-caption">
            {describeThemeCopy(theme, resolvedTheme)}
          </p>
        </div>
        <div className="badge">
          <strong>Workspace</strong>
          <span title={workspaceRoot || "Loading workspace root..."}>
            {workspaceRoot || "Loading workspace root..."}
          </span>
        </div>
        <div className="badge">
          <strong>Current tab</strong>
          <span>{activeTab}</span>
        </div>
        <div className="badge">
          <strong>Runtime</strong>
          <span>
            {initialized ? "modern dashboard active" : "awaiting workflow init"}
          </span>
        </div>
        <div className={statusTone}>
          <strong>{pendingCount > 0 ? "Working" : "Status"}</strong>
          <span>
            {pendingCount > 0
              ? `${pendingCount} request(s) in flight`
              : actionStatus?.message || "Ready."}
          </span>
        </div>
      </div>
    </header>
  );
}
