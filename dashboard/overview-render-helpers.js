(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  root.AgentWorkflowDashboardOverviewRenderHelpers = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function renderStatsMarkup(stats = {}, helpers = {}) {
    const escape = typeof helpers.escapeHtml === "function" ? helpers.escapeHtml : escapeHtml;
    const normalizeCount = typeof helpers.normalizeStatCount === "function" ? helpers.normalizeStatCount : normalizeStatCount;
    const renderExecutorCard =
      typeof helpers.renderExecutorOutcomeStatCard === "function" ? helpers.renderExecutorOutcomeStatCard : null;
    const renderVerificationCard =
      typeof helpers.renderVerificationSignalStatCard === "function" ? helpers.renderVerificationSignalStatCard : null;
    const totalTasks = normalizeCount(stats.tasks);
    const entries = [
      ["Tasks", stats.tasks],
      ["Runs", stats.runs],
      ["Risks", stats.risks],
      ["Memory Docs", stats.memoryDocs],
    ];

    return entries
      .map(
        ([label, value]) => `
          <article class="stat-card">
            <h3>${label}</h3>
            <strong>${escape(value)}</strong>
          </article>
        `
      )
      .concat(renderExecutorCard ? [renderExecutorCard(totalTasks, stats.executorOutcomes, escape)] : [])
      .concat(renderVerificationCard ? [renderVerificationCard(totalTasks, stats.verificationSignals, escape)] : [])
      .join("");
  }

  function renderAdaptersMarkup(adapters) {
    return renderCollectionMarkup(adapters, (adapter) => `
      <article class="list-item">
        <h3>${escapeHtml(adapter.displayName || adapter.adapterId)}</h3>
        <p class="subtle">${escapeHtml(adapter.adapterId)}</p>
        <div class="tag-row">
          <span class="tag ${adapter.exists ? "" : "warn"}">${adapter.exists ? "Configured" : "Missing"}</span>
          <span class="tag">${escapeHtml((((adapter.config && adapter.config.runnerCommand) || [])).join(" ") || "No runner hint")}</span>
        </div>
      </article>
    `);
  }

  function renderRecipesMarkup(recipes) {
    return renderCollectionMarkup(recipes, (recipe) => `
      <article class="list-item">
        <h3>${escapeHtml(recipe.name)}</h3>
        <p>${escapeHtml(recipe.summary)}</p>
        <div class="tag-row">
          <span class="tag">${escapeHtml(recipe.id)}</span>
          <span class="tag">${escapeHtml((recipe.recommendedFor || []).join(", ") || "General")}</span>
        </div>
      </article>
    `);
  }

  function renderValidationMarkup(report = {}) {
    const items = [
      {
        title: report.ok ? "Workspace schema looks coherent" : "Schema issues detected",
        body: `Errors: ${report.errorCount}, warnings: ${report.warningCount}`,
        warn: !report.ok,
      },
    ];

    (report.issues || []).slice(0, 5).forEach((issue) => {
      items.push({
        title: `${String(issue.level || "").toUpperCase()} - ${issue.code}`,
        body: `${issue.message} (${issue.target})`,
        warn: issue.level === "error",
      });
    });

    return renderCollectionMarkup(items, (item) => `
      <article class="list-item">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.body)}</p>
        <div class="tag-row">
          <span class="tag ${item.warn ? "warn" : ""}">${item.warn ? "Needs attention" : "Healthy"}</span>
        </div>
      </article>
    `);
  }

  function renderMemoryMarkup(memory, formatTimestampLabel) {
    const formatTimestamp = typeof formatTimestampLabel === "function" ? formatTimestampLabel : defaultTimestampLabel;

    return renderCollectionMarkup(memory, (item) => `
      <article class="list-item">
        <h3>${escapeHtml(item.name)}</h3>
        <p class="subtle">${escapeHtml(item.relativePath)}</p>
        <p class="subtle">${escapeHtml(item.freshnessReason || "")}</p>
        <div class="tag-row">
          <span class="tag ${item.placeholder || item.freshnessStatus === "stale" ? "warn" : ""}">${escapeHtml(item.freshnessStatus || (item.placeholder ? "placeholder" : "fresh"))}</span>
          <span class="tag">${escapeHtml(item.size)} chars</span>
          <span class="tag">${escapeHtml(formatTimestamp(item.modifiedAt))}</span>
        </div>
      </article>
    `);
  }

  function renderVerificationMarkup(items, isVerificationGateWarning) {
    const isWarning = typeof isVerificationGateWarning === "function" ? isVerificationGateWarning : () => false;

    return renderCollectionMarkup(items, (item) => `
      <article class="list-item">
        <h3>${escapeHtml(item.taskId)}</h3>
        <p>${escapeHtml(item.summary)}</p>
        <div class="tag-row">
          <span class="tag ${item.status === "failed" || isWarning(item.status) ? "warn" : ""}">${escapeHtml(item.status)}</span>
          ${item.relevantChangeCount ? `<span class="tag">${escapeHtml(`${item.relevantChangeCount} changed file(s)`)}</span>` : ""}
        </div>
      </article>
    `);
  }

  function renderRisksMarkup(risks) {
    return renderCollectionMarkup(risks, (risk) => `
      <article class="list-item">
        <h3>${escapeHtml(String(risk.level || "").toUpperCase())}</h3>
        <p>${escapeHtml(risk.message)}</p>
      </article>
    `);
  }

  function renderRunsMarkup(runs, describeRunOutcome) {
    const describeOutcome =
      typeof describeRunOutcome === "function"
        ? describeRunOutcome
        : (run) => ({
            label: String((run && run.status) || "unknown"),
            warn: run && run.status === "failed",
            summary: String((run && run.summary) || "No summary recorded."),
            detail: "",
          });

    return renderCollectionMarkup(runs, (run) => {
      const outcome = describeOutcome(run);
      return `
        <article class="list-item">
          <h3>${escapeHtml(run.taskId)} - ${escapeHtml(outcome.label)}</h3>
          <p>${escapeHtml(outcome.summary)}</p>
          ${outcome.detail ? `<p class="subtle">${escapeHtml(outcome.detail)}</p>` : ""}
          <p class="subtle">${escapeHtml(run.agent || "manual")} | ${escapeHtml(run.createdAt)}</p>
          <div class="tag-row">
            <span class="tag ${outcome.warn ? "warn" : ""}">${escapeHtml(outcome.label)}</span>
            <span class="tag">${escapeHtml(run.source || "manual")}</span>
            ${run.adapterId ? `<span class="tag">${escapeHtml(run.adapterId)}</span>` : ""}
            ${
              run.exitCode === undefined || run.exitCode === null
                ? ""
                : `<span class="tag ${outcome.warn ? "warn" : ""}">exit ${escapeHtml(run.exitCode)}</span>`
            }
          </div>
        </article>
      `;
    });
  }

  function renderCollectionMarkup(items, renderItem, emptyMessage = "Nothing here yet.") {
    if (!items || items.length === 0) {
      return `<div class="empty">${escapeHtml(emptyMessage)}</div>`;
    }

    return items.map(renderItem).join("");
  }

  function normalizeStatCount(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
  }

  function defaultTimestampLabel(value) {
    if (!value) {
      return "No timestamp";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return `Updated ${date.toLocaleString()}`;
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  return {
    renderAdaptersMarkup,
    renderCollectionMarkup,
    renderMemoryMarkup,
    renderRecipesMarkup,
    renderRisksMarkup,
    renderRunsMarkup,
    renderStatsMarkup,
    renderValidationMarkup,
    renderVerificationMarkup,
  };
});
