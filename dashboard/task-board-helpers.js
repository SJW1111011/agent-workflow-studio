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
    const verified = normalizeStatCount(source.verified !== undefined ? source.verified : source.strong);
    const partial = normalizeStatCount(source.partial !== undefined ? source.partial : source.mixed);
    const draft = normalizeStatCount(source.draft) + normalizeStatCount(source.planned);
    return {
      verified,
      partial,
      draft,
      none: normalizeStatCount(source.none),
      strong: verified,
      mixed: partial,
      planned: 0,
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
    return normalized.verified + normalized.partial + normalized.draft;
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
        ? `${annotatedTasks} of ${totalTasks} tasks have draft or verified verification signals.`
        : "No tasks yet.";
    const breakdown = [
      ["Verified", normalized.verified, false],
      ["Partial", normalized.partial, true],
      ["Draft", normalized.draft, true],
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
  const summary = sanitizeVerificationSummary(String((task && task.verificationSignalSummary) || "").trim());
  const currentVerifiedEvidenceCount = Number(
    (task && (task.currentVerifiedEvidenceCount || task.anchorBackedStrongProofCount)) || 0
  );
  const recordedVerifiedEvidenceCount = Number(
    (task && (task.recordedVerifiedEvidenceCount || task.compatibilityStrongProofCount)) || 0
  );
  const freshnessLabel = describeVerificationFreshnessLabel(currentVerifiedEvidenceCount, recordedVerifiedEvidenceCount);

  if (status === "verified" || status === "strong") {
    return {
      label:
        freshnessLabel === "current"
          ? "verified evidence"
          : freshnessLabel === "recorded"
            ? "verified evidence (recorded)"
            : freshnessLabel === "mixed"
              ? "verified evidence (mixed freshness)"
              : "verified evidence",
      warn: freshnessLabel === "recorded" || freshnessLabel === "mixed",
      summary: summary || "Verified evidence is recorded.",
    };
  }

  if (status === "partial" || status === "mixed") {
    return {
      label: "verified + draft",
      warn: true,
      summary: summary || "Verified evidence exists, but draft items remain.",
    };
  }

  if (status === "draft" || status === "planned") {
    return {
      label: "draft evidence",
      warn: true,
      summary: summary || "Draft evidence exists, but it does not satisfy the gate yet.",
    };
  }

  return {
    label: "no evidence notes",
    warn: false,
    summary: summary || "No draft checks or explicit evidence are recorded.",
  };
}

function sanitizeVerificationSummary(summary) {
  const normalized = String(summary || "").trim();
  if (!normalized) {
    return "";
  }

  return /(strong proof|weak proof|planned check|compatibility-only|anchor-backed)/i.test(normalized) ? "" : normalized;
}

function describeVerificationFreshnessLabel(currentVerifiedEvidenceCount, recordedVerifiedEvidenceCount) {
  if (currentVerifiedEvidenceCount > 0 && recordedVerifiedEvidenceCount > 0) {
    return "mixed";
  }

  if (currentVerifiedEvidenceCount > 0) {
    return "current";
  }

  if (recordedVerifiedEvidenceCount > 0) {
    return "recorded";
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
