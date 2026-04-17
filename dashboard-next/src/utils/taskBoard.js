const EXECUTOR_OUTCOME_FILTERS = new Set(["all", "passed", "failed", "timed-out", "interrupted", "cancelled", "none"]);

export function normalizeExecutorOutcomeFilter(value) {
  const normalized = String(value || "all").trim().toLowerCase();
  return EXECUTOR_OUTCOME_FILTERS.has(normalized) ? normalized : "all";
}

export function matchesExecutorOutcomeFilter(task, filterValue) {
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

export function filterTasksByExecutorOutcome(tasks, filterValue) {
  return (Array.isArray(tasks) ? tasks : []).filter((task) => matchesExecutorOutcomeFilter(task, filterValue));
}

export function describeExecutorOutcomeFilter(filterValue) {
  const normalized = normalizeExecutorOutcomeFilter(filterValue);
  if (normalized === "all") {
    return "all tasks";
  }
  if (normalized === "none") {
    return "tasks without executor runs";
  }
  return `tasks with executor outcome ${normalized}`;
}

export function summarizeExecutorOutcomeFilter(totalCount, visibleCount, filterValue) {
  const filterLabel = describeExecutorOutcomeFilter(filterValue);
  return `Showing ${visibleCount} of ${totalCount} ${filterLabel}.`;
}

export function normalizeStatCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

export function normalizeExecutorOutcomeStats(value) {
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

export function normalizeVerificationSignalStats(value) {
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

export function countTasksWithExecutorOutcome(executorStats) {
  const normalized = normalizeExecutorOutcomeStats(executorStats);
  return normalized.passed + normalized.failed + normalized.timedOut + normalized.interrupted + normalized.cancelled;
}

export function countTasksWithVerificationSignals(verificationStats) {
  const normalized = normalizeVerificationSignalStats(verificationStats);
  return normalized.verified + normalized.partial + normalized.draft;
}

export function describeVerificationFreshnessLabel(currentVerifiedEvidenceCount, recordedVerifiedEvidenceCount) {
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

export function describeTaskVerificationSignal(task) {
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

export function getTaskCardToneClass(task) {
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

export function formatTaskVerificationFreshnessSummary(task) {
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

function sanitizeVerificationSummary(summary) {
  const normalized = String(summary || "").trim();
  if (!normalized) {
    return "";
  }

  return /(strong proof|weak proof|planned check|compatibility-only|anchor-backed)/i.test(normalized) ? "" : normalized;
}
