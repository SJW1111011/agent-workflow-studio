export default function Header({ actionStatus, activeTab, initialized, pendingCount, workspaceRoot }) {
  const statusTone = actionStatus?.tone ? `badge badge-status badge-status-${actionStatus.tone}` : "badge badge-status";

  return (
    <header className="hero">
      <div className="hero-copy">
        <p className="eyebrow">Local-first control plane</p>
        <h1>Agent Workflow Studio</h1>
        <p className="lede">
          The Preact dashboard now reads the real workflow API, keeps task selection in reducer-backed state, and
          preserves the legacy dashboard as a truthful fallback.
        </p>
      </div>
      <div className="hero-meta">
        <div className="badge">
          <strong>Workspace</strong>
          <span>{workspaceRoot || "Loading workspace root..."}</span>
        </div>
        <div className="badge">
          <strong>Current tab</strong>
          <span>{activeTab}</span>
        </div>
        <div className="badge">
          <strong>Runtime</strong>
          <span>{initialized ? "modern dashboard active" : "awaiting workflow init"}</span>
        </div>
        <div className={statusTone}>
          <strong>{pendingCount > 0 ? "Working" : "Status"}</strong>
          <span>{pendingCount > 0 ? `${pendingCount} request(s) in flight` : actionStatus?.message || "Ready."}</span>
        </div>
      </div>
    </header>
  );
}
