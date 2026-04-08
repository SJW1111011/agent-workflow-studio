(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  root.AgentWorkflowDashboardTaskBoardHelpers = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const EXECUTOR_OUTCOME_FILTERS = new Set(["all", "passed", "failed", "timed-out", "interrupted", "cancelled", "none"]);

  function normalizeExecutorOutcomeFilter(value) {
    const normalized = String(value || "all").trim().toLowerCase();
    return EXECUTOR_OUTCOME_FILTERS.has(normalized) ? normalized : "all";
  }

  function matchesExecutorOutcomeFilter(task, filterValue) {
    const normalized = normalizeExecutorOutcomeFilter(filterValue);
    const outcome = String((task && task.latestExecutorOutcome) || "").trim().toLowerCase();

    if (normalized === "all") {
      return true;
    }

    if (normalized === "none") {
      return !outcome;
    }

    return outcome === normalized;
  }

  function filterTasksByExecutorOutcome(tasks, filterValue) {
    return (Array.isArray(tasks) ? tasks : []).filter((task) => matchesExecutorOutcomeFilter(task, filterValue));
  }

  function describeExecutorOutcomeFilter(filterValue) {
    const normalized = normalizeExecutorOutcomeFilter(filterValue);
    if (normalized === "all") {
      return "all tasks";
    }
    if (normalized === "none") {
      return "tasks without executor runs";
    }
    return `tasks with executor outcome ${normalized}`;
  }

  function summarizeExecutorOutcomeFilter(totalCount, visibleCount, filterValue) {
    const filterLabel = describeExecutorOutcomeFilter(filterValue);
    return `Showing ${visibleCount} of ${totalCount} ${filterLabel}.`;
  }

  function normalizeStatCount(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
  }

  function normalizeExecutorOutcomeStats(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      passed: normalizeStatCount(source.passed),
      failed: normalizeStatCount(source.failed),
      timedOut: normalizeStatCount(source.timedOut),
      interrupted: normalizeStatCount(source.interrupted),
      cancelled: normalizeStatCount(source.cancelled),
      none: normalizeStatCount(source.none),
    };
  }

  function normalizeVerificationSignalStats(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      strong: normalizeStatCount(source.strong),
      mixed: normalizeStatCount(source.mixed),
      draft: normalizeStatCount(source.draft),
      planned: normalizeStatCount(source.planned),
      none: normalizeStatCount(source.none),
    };
  }

  function countTasksWithExecutorOutcome(executorStats) {
    const normalized = normalizeExecutorOutcomeStats(executorStats);
    return (
      normalized.passed +
      normalized.failed +
      normalized.timedOut +
      normalized.interrupted +
      normalized.cancelled
    );
  }

  function countTasksWithVerificationSignals(verificationStats) {
    const normalized = normalizeVerificationSignalStats(verificationStats);
    return normalized.strong + normalized.mixed + normalized.draft + normalized.planned;
  }

  function renderExecutorOutcomeStatCard(totalTasks, executorStats, escapeHtml) {
    const normalized = normalizeExecutorOutcomeStats(executorStats);
    const executedTasks = countTasksWithExecutorOutcome(normalized);
    const breakdown = [
      ["Passed", normalized.passed, false],
      ["Failed", normalized.failed, true],
      ["Timed out", normalized.timedOut, true],
      ["Interrupted", normalized.interrupted, true],
      ["Cancelled", normalized.cancelled, false],
      ["No run", normalized.none, false],
    ];
    const summary =
      totalTasks > 0
        ? `${executedTasks} of ${totalTasks} tasks have local executor evidence.`
        : "No tasks yet.";

    return `
      <article class="stat-card stat-card-breakdown">
        <h3>Executor Outcomes</h3>
        <strong>${escapeHtml(executedTasks)}</strong>
        <p class="stat-caption">${escapeHtml(summary)}</p>
        <dl class="stat-breakdown">
          ${breakdown
            .map(
              ([label, value, warn]) => `
                <div class="stat-breakdown-item ${warn ? "warn" : ""}">
                  <dt>${escapeHtml(label)}</dt>
                  <dd>${escapeHtml(value)}</dd>
                </div>
              `
            )
            .join("")}
        </dl>
      </article>
    `;
  }

  function renderVerificationSignalStatCard(totalTasks, verificationStats, escapeHtml) {
    const normalized = normalizeVerificationSignalStats(verificationStats);
    const annotatedTasks = countTasksWithVerificationSignals(normalized);
    const summary =
      totalTasks > 0
        ? `${annotatedTasks} of ${totalTasks} tasks have planned or explicit verification signals.`
        : "No tasks yet.";
    const breakdown = [
      ["Strong", normalized.strong, false],
      ["Mixed", normalized.mixed, true],
      ["Draft", normalized.draft, true],
      ["Planned", normalized.planned, false],
      ["None", normalized.none, false],
    ];

    return `
      <article class="stat-card stat-card-breakdown">
        <h3>Verification Signals</h3>
        <strong>${escapeHtml(annotatedTasks)}</strong>
        <p class="stat-caption">${escapeHtml(summary)}</p>
        <dl class="stat-breakdown">
          ${breakdown
            .map(
              ([label, value, warn]) => `
                <div class="stat-breakdown-item ${warn ? "warn" : ""}">
                  <dt>${escapeHtml(label)}</dt>
                  <dd>${escapeHtml(value)}</dd>
                </div>
              `
            )
            .join("")}
        </dl>
      </article>
    `;
  }

function describeTaskVerificationSignal(task) {
  const status = String((task && task.verificationSignalStatus) || "").trim().toLowerCase();
  const summary = String((task && task.verificationSignalSummary) || "").trim();
  const anchorBackedStrongProofCount = Number((task && task.anchorBackedStrongProofCount) || 0);
  const compatibilityStrongProofCount = Number((task && task.compatibilityStrongProofCount) || 0);
  const freshnessLabel = describeVerificationFreshnessLabel(anchorBackedStrongProofCount, compatibilityStrongProofCount);

  if (status === "strong") {
    return {
      label:
        freshnessLabel === "anchor-backed"
          ? "anchor-backed proof"
          : freshnessLabel === "compatibility-only"
            ? "compatibility proof"
            : freshnessLabel === "mixed freshness"
              ? "mixed freshness"
              : "strong proof",
      warn: freshnessLabel === "compatibility-only" || freshnessLabel === "mixed freshness",
      summary: summary || "Strong proof is recorded.",
    };
  }

  if (status === "mixed") {
    return {
      label: "strong + draft",
        warn: true,
        summary: summary || "Some proof is strong, but draft placeholders remain.",
      };
    }

    if (status === "draft") {
      return {
        label: "draft proof",
        warn: true,
        summary: summary || "Draft proof exists, but it does not satisfy the gate yet.",
      };
    }

    if (status === "planned") {
      return {
        label: "planned checks",
        warn: false,
        summary: summary || "Planned checks are recorded, but no strong proof exists yet.",
      };
    }

  return {
    label: "no proof notes",
    warn: false,
    summary: summary || "No planned checks or explicit proof items are recorded.",
  };
}

function describeVerificationFreshnessLabel(anchorBackedStrongProofCount, compatibilityStrongProofCount) {
  if (anchorBackedStrongProofCount > 0 && compatibilityStrongProofCount > 0) {
    return "mixed freshness";
  }

  if (anchorBackedStrongProofCount > 0) {
    return "anchor-backed";
  }

  if (compatibilityStrongProofCount > 0) {
    return "compatibility-only";
  }

  return "";
}

  return {
    countTasksWithExecutorOutcome,
    countTasksWithVerificationSignals,
    describeExecutorOutcomeFilter,
    describeVerificationFreshnessLabel,
    describeTaskVerificationSignal,
    filterTasksByExecutorOutcome,
    matchesExecutorOutcomeFilter,
    normalizeExecutorOutcomeFilter,
    normalizeExecutorOutcomeStats,
    normalizeStatCount,
    normalizeVerificationSignalStats,
    renderExecutorOutcomeStatCard,
    renderVerificationSignalStatCard,
    summarizeExecutorOutcomeFilter,
  };
});
