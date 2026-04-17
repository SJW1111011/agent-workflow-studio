(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory({
      executionHelpers: require("./execution-detail-helpers.js"),
      taskBoardHelpers: require("./task-board-helpers.js"),
    });
    return;
  }

  root.AgentWorkflowDashboardTaskListRenderHelpers = factory({
    executionHelpers: root.AgentWorkflowDashboardExecutionDetailHelpers,
    taskBoardHelpers: root.AgentWorkflowDashboardTaskBoardHelpers,
  });
})(typeof globalThis !== "undefined" ? globalThis : this, ({ executionHelpers = {}, taskBoardHelpers = {} } = {}) => {
  const describeExecutorOutcome =
    typeof executionHelpers.describeExecutorOutcome === "function" ? executionHelpers.describeExecutorOutcome : () => null;
  const formatTimestampLabel =
    typeof executionHelpers.formatTimestampLabel === "function"
      ? executionHelpers.formatTimestampLabel
      : (value) => String(value || "No timestamp");
  const describeTaskVerificationSignal =
    typeof taskBoardHelpers.describeTaskVerificationSignal === "function"
      ? taskBoardHelpers.describeTaskVerificationSignal
      : () => ({ label: "no proof notes", warn: false, summary: "No verification summary available." });
  const filterTasksByExecutorOutcome =
    typeof taskBoardHelpers.filterTasksByExecutorOutcome === "function"
      ? taskBoardHelpers.filterTasksByExecutorOutcome
      : (tasks) => (Array.isArray(tasks) ? tasks : []);
  const normalizeExecutorOutcomeFilter =
    typeof taskBoardHelpers.normalizeExecutorOutcomeFilter === "function"
      ? taskBoardHelpers.normalizeExecutorOutcomeFilter
      : (value) => String(value || "all").trim().toLowerCase() || "all";
  const summarizeExecutorOutcomeFilter =
    typeof taskBoardHelpers.summarizeExecutorOutcomeFilter === "function"
      ? taskBoardHelpers.summarizeExecutorOutcomeFilter
      : (totalCount, visibleCount, filterValue) =>
          `Showing ${visibleCount} of ${totalCount} tasks for filter ${String(filterValue || "all")}.`;

  function renderTaskBoardMarkup(tasks, options = {}) {
    const allTasks = Array.isArray(tasks) ? tasks : [];
    const normalizedFilter = normalizeExecutorOutcomeFilter(options.filterValue);
    const visibleTasks = filterTasksByExecutorOutcome(allTasks, normalizedFilter);
    const summaryText = summarizeExecutorOutcomeFilter(allTasks.length, visibleTasks.length, normalizedFilter);
    const activeTaskId = options.activeTaskId || null;

    if (!visibleTasks.length) {
      return {
        normalizedFilter,
        summaryText,
        visibleCount: 0,
        totalCount: allTasks.length,
        markup:
          allTasks.length === 0
            ? '<div class="empty">Nothing here yet.</div>'
            : '<div class="empty">No tasks match the current executor outcome filter.</div>',
      };
    }

    return {
      normalizedFilter,
      summaryText,
      visibleCount: visibleTasks.length,
      totalCount: allTasks.length,
      markup: visibleTasks.map((task) => renderTaskCard(task, activeTaskId)).join(""),
    };
  }

  function renderTaskCard(task, activeTaskId) {
    const executorOutcome = describeExecutorOutcome(task && task.latestExecutorOutcome, task && task.latestExecutorSummary);
    const verificationSignal = describeTaskVerificationSignal(task);
    const coverageView = describeTaskCoverage(task);
    const freshnessSummary = formatTaskVerificationFreshnessSummary(task);
    const cardToneClass = getTaskCardToneClass(task, executorOutcome);

    return `
      <article class="task-card ${cardToneClass} ${task.id === activeTaskId ? "active" : ""}" data-task-id="${escapeHtml(task.id)}">
        <h3>${task.id} - ${escapeHtml(task.title || "Untitled task")}</h3>
        <p class="task-meta">Priority ${escapeHtml(task.priority || "P2")} | ${escapeHtml(task.status || "todo")} | Recipe ${escapeHtml(task.recipeId || "feature")}</p>
        <p>${escapeHtml(task.latestRunSummary || "No runs yet")}</p>
        ${renderTaskCoverageMarkup(coverageView)}
        <p class="subtle">Verification: ${escapeHtml(verificationSignal.summary)}</p>
        ${freshnessSummary ? `<p class="subtle">Proof freshness: ${escapeHtml(freshnessSummary)}</p>` : ""}
        ${
          executorOutcome
            ? `<p class="subtle">Latest executor: ${escapeHtml(executorOutcome.summary)}${
                task.latestExecutorAt ? ` (${escapeHtml(formatTimestampLabel(task.latestExecutorAt))})` : ""
              }</p>`
            : ""
        }
        <div class="tag-row">
          <span class="tag">${task.hasCodexPrompt ? "Codex prompt" : "No Codex prompt"}</span>
          <span class="tag">${task.hasClaudePrompt ? "Claude prompt" : "No Claude prompt"}</span>
          <span class="tag ${task.freshnessStatus === "stale" ? "warn" : ""}">${escapeHtml(task.freshnessStatus === "stale" ? `Docs stale (${task.staleDocCount || 0})` : "Docs fresh")}</span>
          <span class="tag ${coverageView.warn ? "warn" : ""}">${escapeHtml(coverageView.tag)}</span>
          <span class="tag ${verificationSignal.warn ? "warn" : ""}">${escapeHtml(verificationSignal.label)}</span>
          ${renderVerificationFreshnessTag(task)}
          <span class="tag ${task.latestRunStatus === "failed" ? "warn" : ""}">${escapeHtml(task.latestRunStatus)}</span>
          ${
            executorOutcome
              ? `<span class="tag ${executorOutcome.warn ? "warn" : ""}">${escapeHtml(executorOutcome.label)}</span>`
              : '<span class="tag">no executor run</span>'
          }
        </div>
      </article>
    `;
  }

  function describeTaskCoverage(task) {
    const scopeHintCount = normalizeNonNegativeInteger(task && task.scopeHintCount);
    const scopedFileCount = normalizeNonNegativeInteger(task && task.scopedFileCount);
    const coveredScopedFileCount = normalizeNonNegativeInteger(task && task.coveredScopedFileCount);
    const coveragePercent = normalizeCoveragePercent(task && task.coveragePercent);

    if (scopeHintCount === 0) {
      return {
        summary: "Coverage: no scope defined.",
        tag: "no scope defined",
        fillPercent: 0,
        scopedFileCount,
        coveredScopedFileCount,
        showBar: false,
        warn: true,
      };
    }

    if (scopedFileCount === 0) {
      return {
        summary: "Coverage: no scoped files matched yet.",
        tag: "no scoped files matched",
        fillPercent: 0,
        scopedFileCount,
        coveredScopedFileCount,
        showBar: false,
        warn: false,
      };
    }

    return {
      summary: `Coverage: ${coveragePercent}% (${coveredScopedFileCount}/${scopedFileCount} scoped files)`,
      tag: `${coveragePercent}% covered`,
      fillPercent: coveragePercent,
      scopedFileCount,
      coveredScopedFileCount,
      showBar: true,
      warn: coveragePercent < 100,
    };
  }

  function renderTaskCoverageMarkup(coverageView) {
    if (!coverageView) {
      return "";
    }

    return `
      <div class="task-coverage">
        <p class="subtle">${escapeHtml(coverageView.summary)}</p>
        ${
          coverageView.showBar
            ? `<div class="coverage-bar coverage-bar-compact" aria-hidden="true"><span class="coverage-bar-fill ${coverageView.warn ? "coverage-bar-fill-warn" : ""}" style="width: ${escapeHtml(coverageView.fillPercent)}%"></span></div>`
            : ""
        }
      </div>
    `;
  }

  function getTaskCardToneClass(task, executorOutcome) {
    if (!executorOutcome) {
      return "";
    }

    const normalized = normalizeExecutorOutcomeFilter(task && task.latestExecutorOutcome);
    if (normalized === "passed") {
      return "task-card-executor-ok";
    }
    if (normalized === "cancelled") {
      return "task-card-executor-cancelled";
    }
    if (normalized === "timed-out" || normalized === "interrupted" || normalized === "failed") {
      return "task-card-executor-warn";
    }

    return "";
  }

  function formatTaskVerificationFreshnessSummary(task) {
    const verifiedProofCount = Number((task && (task.verifiedProofCount || task.strongProofCount)) || 0);
    if (verifiedProofCount <= 0) {
      return "";
    }

    const currentVerifiedEvidenceCount = Number(
      (task && (task.currentVerifiedEvidenceCount || task.anchorBackedStrongProofCount)) || 0
    );
    const recordedVerifiedEvidenceCount = Number(
      (task && (task.recordedVerifiedEvidenceCount || task.compatibilityStrongProofCount)) || 0
    );

    if (currentVerifiedEvidenceCount > 0 && recordedVerifiedEvidenceCount > 0) {
      return `${currentVerifiedEvidenceCount} current, ${recordedVerifiedEvidenceCount} recorded-only`;
    }

    if (currentVerifiedEvidenceCount > 0) {
      return `${currentVerifiedEvidenceCount} current`;
    }

    if (recordedVerifiedEvidenceCount > 0) {
      return `${recordedVerifiedEvidenceCount} recorded-only`;
    }

    return "";
  }

  function renderVerificationFreshnessTag(task) {
    const summary = formatTaskVerificationFreshnessSummary(task);
    if (!summary) {
      return "";
    }

    const recordedVerifiedEvidenceCount = Number(
      (task && (task.recordedVerifiedEvidenceCount || task.compatibilityStrongProofCount)) || 0
    );
    return `<span class="tag ${recordedVerifiedEvidenceCount > 0 ? "warn" : ""}">${escapeHtml(summary)}</span>`;
  }

  function normalizeCoveragePercent(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.round(numeric)));
  }

  function normalizeNonNegativeInteger(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      return 0;
    }

    return Math.round(numeric);
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
    getTaskCardToneClass,
    renderTaskBoardMarkup,
  };
});
