const { getTaskDetail, listTasks } = require("./task-service");

const SIGNAL_SCORES = Object.freeze({
  draft: 25,
  none: 0,
  partial: 50,
  verified: 100,
});

const FRESHNESS_SCORES = Object.freeze({
  current: 100,
  recorded: 60,
  stale: 20,
});

const MAX_DIVERSITY_COLLECTORS = 4;

function buildTrustSummary(workspaceRoot) {
  const taskScores = listTasks(workspaceRoot)
    .map((task) => buildTaskTrustSummary(getTaskDetail(workspaceRoot, task.id)))
    .filter(Boolean)
    .sort((left, right) => left.taskId.localeCompare(right.taskId));

  const freshnessDistribution = taskScores.reduce(
    (distribution, taskScore) => {
      distribution[taskScore.freshness] += 1;
      return distribution;
    },
    {
      current: 0,
      recorded: 0,
      stale: 0,
    }
  );

  const aggregateTrustScore =
    taskScores.length > 0
      ? Math.round(
          taskScores.reduce((total, item) => total + item.trustScore, 0) /
            taskScores.length
        )
      : 0;

  return {
    aggregateTrustScore,
    taskScores,
    freshnessDistribution,
  };
}

function buildTaskTrustSummary(detail) {
  if (!detail || !detail.meta || !detail.meta.id) {
    return null;
  }

  const proofCoverage =
    detail.verificationGate && detail.verificationGate.proofCoverage
      ? detail.verificationGate.proofCoverage
      : {};
  const signal = deriveTrustSignal(detail);
  const freshness = deriveTrustFreshness(detail, proofCoverage);
  const collectorIds = collectCollectorIds(detail, proofCoverage);
  const coverage = normalizePercent(
    detail.verificationGate && detail.verificationGate.coveragePercent
  );
  const trustScore = calculateTrustScore({
    collectorCount: collectorIds.length,
    coverage,
    freshness,
    signal,
  });

  return {
    taskId: detail.meta.id,
    title: detail.meta.title || detail.meta.id,
    trustScore,
    coverage,
    signal,
    freshness,
    collectorCount: collectorIds.length,
    lastEvidenceAt:
      (detail.verificationGate &&
        detail.verificationGate.evidence &&
        detail.verificationGate.evidence.latestEvidenceAt) ||
      latestTimestamp(
        []
          .concat((detail.runs || []).map((run) => run.completedAt || run.createdAt))
          .concat(
            (detail.activityRecords || []).map((record) => record.createdAt)
          )
      ),
  };
}

function calculateTrustScore({ collectorCount, coverage, freshness, signal }) {
  const normalizedCoverage = normalizePercent(coverage);
  const normalizedSignal = normalizeTrustSignal(signal);
  const normalizedFreshness = normalizeTrustFreshness(freshness);
  const diversity = calculateCollectorDiversityScore(collectorCount);

  return Math.round(
    normalizedCoverage * 0.4 +
      SIGNAL_SCORES[normalizedSignal] * 0.25 +
      FRESHNESS_SCORES[normalizedFreshness] * 0.2 +
      diversity * 0.15
  );
}

function calculateCollectorDiversityScore(collectorCount) {
  const normalizedCount = Math.max(0, Math.round(Number(collectorCount) || 0));
  return Math.round(
    (Math.min(normalizedCount, MAX_DIVERSITY_COLLECTORS) /
      MAX_DIVERSITY_COLLECTORS) *
      100
  );
}

function deriveTrustSignal(detail) {
  const proofCoverage =
    detail && detail.verificationGate && detail.verificationGate.proofCoverage
      ? detail.verificationGate.proofCoverage
      : {};
  const items = Array.isArray(proofCoverage.items) ? proofCoverage.items : [];
  const verifiedCount = items.filter((item) => item && (item.verified || item.strong)).length;
  const draftCount = items.filter((item) => item && !(item.verified || item.strong)).length;
  const draftChecks = extractDraftChecks(detail ? detail.verificationText : "").length;

  if (verifiedCount > 0 && (draftCount > 0 || draftChecks > 0)) {
    return "partial";
  }

  if (verifiedCount > 0) {
    return "verified";
  }

  if (draftCount > 0 || draftChecks > 0) {
    return "draft";
  }

  return "none";
}

function deriveTrustFreshness(detail, proofCoverage = {}) {
  const items = Array.isArray(proofCoverage.items) ? proofCoverage.items : [];
  const verifiedCount = items.filter((item) => item && (item.verified || item.strong)).length;
  const currentVerifiedEvidenceCount = Number(
    proofCoverage.currentVerifiedEvidenceCount ||
      proofCoverage.anchoredStrongProofCount ||
      0
  );
  const recordedVerifiedEvidenceCount = Number(
    proofCoverage.recordedVerifiedEvidenceCount ||
      proofCoverage.compatibilityStrongProofCount ||
      0
  );
  const runCount = Array.isArray(detail && detail.runs) ? detail.runs.length : 0;

  if (currentVerifiedEvidenceCount > 0) {
    return "current";
  }

  if (recordedVerifiedEvidenceCount > 0 || verifiedCount > 0 || runCount > 0) {
    return "recorded";
  }

  return "stale";
}

function collectCollectorIds(detail, proofCoverage = {}) {
  const collectorIds = new Set();
  const proofItems = Array.isArray(proofCoverage.items) ? proofCoverage.items : [];

  proofItems.forEach((item) => {
    if (!item || (!item.verified && !item.strong)) {
      return;
    }

    const sourceType = String(item.sourceType || "").trim().toLowerCase();
    if (sourceType) {
      collectorIds.add(`source:${sourceType}`);
    }
  });

  (detail && Array.isArray(detail.runs) ? detail.runs : []).forEach((run) => {
    (Array.isArray(run.collectorResults) ? run.collectorResults : []).forEach(
      (collector) => {
        const collectorId = String(
          collector && collector.collectorId ? collector.collectorId : ""
        )
          .trim()
          .toLowerCase();
        if (collectorId) {
          collectorIds.add(`collector:${collectorId}`);
        }
      }
    );

    const evidenceCollectors =
      run &&
      run.evidence &&
      Array.isArray(run.evidence.collectors)
        ? run.evidence.collectors
        : [];
    evidenceCollectors.forEach((collector) => {
      const collectorId = String(
        collector && collector.collectorId ? collector.collectorId : ""
      )
        .trim()
        .toLowerCase();
      if (collectorId) {
        collectorIds.add(`collector:${collectorId}`);
      }
    });
  });

  return Array.from(collectorIds.values()).sort();
}

function extractDraftChecks(verificationText) {
  const draftSection =
    getMarkdownSection(verificationText, "Draft checks") ||
    getMarkdownSection(verificationText, "Planned checks");

  return String(draftSection || "")
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*[-*+]\s*/, "").trim())
    .filter(Boolean)
    .map((line) => {
      const labeled = line.match(/^(automated|manual)\s*:\s*(.*)$/i);
      if (!labeled) {
        return line;
      }
      return String(labeled[2] || "").trim();
    })
    .filter(Boolean);
}

function getMarkdownSection(text, title) {
  const normalized = String(text || "").replace(/\r\n/g, "\n");
  const pattern = new RegExp(
    `(?:^|\\n)## ${escapeRegex(title)}\\n([\\s\\S]*?)(?=\\n## |$)`
  );
  const match = normalized.match(pattern);
  return match ? match[1].trim() : "";
}

function latestTimestamp(values) {
  const latest = (Array.isArray(values) ? values : []).reduce((current, value) => {
    const next = new Date(value).getTime();
    if (!Number.isFinite(next)) {
      return current;
    }
    return current === null || next > current ? next : current;
  }, null);

  return latest === null ? null : new Date(latest).toISOString();
}

function normalizePercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeTrustSignal(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(SIGNAL_SCORES, normalized)
    ? normalized
    : "none";
}

function normalizeTrustFreshness(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(FRESHNESS_SCORES, normalized)
    ? normalized
    : "stale";
}

function escapeRegex(value) {
  return String(value || "").replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

module.exports = {
  buildTaskTrustSummary,
  buildTrustSummary,
  calculateCollectorDiversityScore,
  calculateTrustScore,
  deriveTrustFreshness,
  deriveTrustSignal,
};
