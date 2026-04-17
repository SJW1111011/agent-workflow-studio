import { useDashboardContext } from "../context/DashboardContext.jsx";
import { formatTimestampLabel } from "../utils/execution.js";
import {
  countTasksWithExecutorOutcome,
  countTasksWithVerificationSignals,
  normalizeStatCount,
} from "../utils/taskBoard.js";

function StatCard({ detail, title, value }) {
  return (
    <article className="stat-card">
      <p className="panel-eyebrow">{title}</p>
      <h3>{value}</h3>
      <p>{detail}</p>
    </article>
  );
}

export default function Overview({ hidden }) {
  const { state } = useDashboardContext();
  const overview = state.overview.data;

  if (!overview && state.overview.status === "loading") {
    return (
      <section className={hidden ? "panel panel-wide tab-hidden" : "panel panel-wide"} data-tab="overview">
        <div className="empty">Loading workspace overview...</div>
      </section>
    );
  }

  if (!overview) {
    return (
      <section className={hidden ? "panel panel-wide tab-hidden" : "panel panel-wide"} data-tab="overview">
        <div className="empty">{state.overview.error || "Overview data is unavailable."}</div>
      </section>
    );
  }

  const stats = overview.stats || {};
  const executorEvidenceCount = countTasksWithExecutorOutcome(stats.executorOutcomes || {});
  const verificationSignalCount = countTasksWithVerificationSignals(stats.verificationSignals || {});

  return (
    <>
      <section className={hidden ? "stats tab-hidden" : "stats"} data-tab="overview">
        <StatCard
          detail={`${normalizeStatCount(stats.memoryDocs)} memory docs currently tracked.`}
          title="Tasks"
          value={normalizeStatCount(stats.tasks)}
        />
        <StatCard
          detail={`${normalizeStatCount(stats.risks)} open risk item(s) need attention.`}
          title="Runs"
          value={normalizeStatCount(stats.runs)}
        />
        <StatCard
          detail={`${normalizeStatCount(stats.coveredScopedFiles)} of ${normalizeStatCount(
            stats.totalScopedFiles
          )} scoped files have proof.`}
          title="Coverage"
          value={`${normalizeStatCount(stats.coveragePercent)}%`}
        />
        <StatCard
          detail={`${executorEvidenceCount} task(s) have executor-backed outcomes.`}
          title="Executor"
          value={executorEvidenceCount}
        />
        <StatCard
          detail={`${verificationSignalCount} task(s) have recorded verification signals.`}
          title="Verification"
          value={verificationSignalCount}
        />
        <StatCard
          detail={
            overview.initialized
              ? "Workflow metadata and task bundles are present."
              : "Initialize workflow data to unlock the full control plane."
          }
          title="Workspace"
          value={overview.initialized ? "Ready" : "Empty"}
        />
      </section>

      <section className={hidden ? "panel panel-wide tab-hidden" : "panel panel-wide"} data-tab="overview">
        <div className="panel-head">
          <div>
            <h2>Adapters</h2>
            <p>The runtime contracts that bridge workflow state into Codex and Claude Code sessions.</p>
          </div>
        </div>
        <div className="list">
          {(overview.adapters || []).map((adapter) => (
            <article className="list-item" key={adapter.normalizedAdapterId || adapter.adapterId}>
              <h3>{adapter.displayName || adapter.adapterId}</h3>
              <p>{adapter.config?.notes?.[0] || "Adapter configuration is available for local execution."}</p>
              <div className="tag-row">
                <span className={adapter.exists ? "tag" : "tag warn"}>
                  {adapter.status || (adapter.exists ? "ready" : "missing")}
                </span>
                <span className="tag">{adapter.config?.stdioMode || "stdio unknown"}</span>
                <span className="tag">{adapter.config?.commandMode || "command mode unknown"}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={hidden ? "panel tab-hidden" : "panel"} data-tab="overview">
        <div className="panel-head">
          <div>
            <h2>Recipes</h2>
            <p>Structured task intents that keep prompts and durable task records aligned.</p>
          </div>
        </div>
        <div className="list">
          {(overview.recipes || []).map((recipe) => (
            <article className="list-item" key={recipe.id}>
              <h3>{recipe.id}</h3>
              <p>{recipe.summary || recipe.name}</p>
              <div className="tag-row">
                <span className="tag">{recipe.name}</span>
                <span className="tag">{(recipe.recommendedFor || []).length} use cases</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={hidden ? "panel tab-hidden" : "panel"} data-tab="overview">
        <div className="panel-head">
          <div>
            <h2>Schema</h2>
            <p>Structural checks for workflow trustworthiness.</p>
          </div>
        </div>
        <div className="list">
          {overview.validation?.issueCount ? (
            overview.validation.issues.map((issue, index) => (
              <article className="list-item" key={`${issue.code || "issue"}:${index}`}>
                <h3>
                  {String(issue.level || "info").toUpperCase()} - {issue.code || "validation"}
                </h3>
                <p>{issue.message || "Validation issue reported."}</p>
                <p className="subtle">{issue.target || "No specific target"}</p>
              </article>
            ))
          ) : (
            <article className="list-item">
              <h3>Workspace schema is clean</h3>
              <p>No structural issues are currently reported for the workflow files.</p>
              <div className="tag-row">
                <span className="tag">0 issues</span>
                <span className="tag">
                  {overview.validation?.strictVerification ? "strict verification" : "standard verification"}
                </span>
              </div>
            </article>
          )}
        </div>
      </section>

      <section className={hidden ? "panel tab-hidden" : "panel"} data-tab="overview">
        <div className="panel-head">
          <div>
            <h2>Memory</h2>
            <p>Stable docs that future agents should trust first.</p>
          </div>
        </div>
        <div className="list">
          {(overview.memory || []).map((item) => (
            <article className="list-item" key={item.relativePath}>
              <h3>{item.name}</h3>
              <p>{item.freshnessReason || "No freshness note available."}</p>
              <p className="subtle">{item.relativePath}</p>
              <div className="tag-row">
                <span className={item.freshnessStatus === "fresh" ? "tag" : "tag warn"}>
                  {item.freshnessStatus || "unknown"}
                </span>
                <span className="tag">{formatTimestampLabel(item.modifiedAt)}</span>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className={hidden ? "panel panel-wide tab-hidden" : "panel panel-wide"} data-tab="overview">
        <div className="panel-head">
          <div>
            <h2>Risk Queue</h2>
            <p>Things you should not ignore before trusting the current state.</p>
          </div>
        </div>
        <div className="list">
          {(overview.risks || []).length === 0 ? (
            <div className="empty">No current risks detected.</div>
          ) : (
            (overview.risks || []).map((risk, index) => (
              <article className="list-item" key={`${risk.level || "risk"}:${index}`}>
                <h3>{String(risk.level || "info").toUpperCase()}</h3>
                <p>{risk.message || "Risk entry recorded."}</p>
              </article>
            ))
          )}
        </div>
      </section>
    </>
  );
}
