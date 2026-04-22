import { extractVerificationPlannedChecks } from "./document.js";

export const TRUST_SIGNAL_SCORES = Object.freeze({
  draft: 25,
  none: 0,
  partial: 50,
  verified: 100,
});

export const TRUST_FRESHNESS_SCORES = Object.freeze({
  current: 100,
  recorded: 60,
  stale: 20,
});

export const TRUST_HEATMAP_BUCKETS = Object.freeze([
  { id: "day-1", label: "0-1d", maxAgeMs: 24 * 60 * 60 * 1000 },
  { id: "day-3", label: "1-3d", maxAgeMs: 3 * 24 * 60 * 60 * 1000 },
  { id: "day-7", label: "3-7d", maxAgeMs: 7 * 24 * 60 * 60 * 1000 },
  { id: "older", label: "7d+", maxAgeMs: Number.POSITIVE_INFINITY },
]);

const MAX_DIVERSITY_COLLECTORS = 4;

export function calculateTrustScore({
  collectorCount = 0,
  coverage = 0,
  freshness = "stale",
  signal = "none",
} = {}) {
  const normalizedCoverage = normalizeTrustPercent(coverage);
  const normalizedSignal = normalizeTrustSignal(signal);
  const normalizedFreshness = normalizeTrustFreshness(freshness);
  const diversity = calculateCollectorDiversityScore(collectorCount);

  return Math.round(
    normalizedCoverage * 0.4 +
      TRUST_SIGNAL_SCORES[normalizedSignal] * 0.25 +
      TRUST_FRESHNESS_SCORES[normalizedFreshness] * 0.2 +
      diversity * 0.15,
  );
}

export function calculateCollectorDiversityScore(collectorCount = 0) {
  const normalizedCount = Math.max(0, Math.round(Number(collectorCount) || 0));
  return Math.round(
    (Math.min(normalizedCount, MAX_DIVERSITY_COLLECTORS) /
      MAX_DIVERSITY_COLLECTORS) *
      100,
  );
}

export function normalizeTrustSignal(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(TRUST_SIGNAL_SCORES, normalized)
    ? normalized
    : "none";
}

export function normalizeTrustFreshness(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return Object.prototype.hasOwnProperty.call(TRUST_FRESHNESS_SCORES, normalized)
    ? normalized
    : "stale";
}

export function normalizeTrustPercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

export function deriveTrustSignal(detail = {}) {
  const proofCoverage =
    detail.verificationGate && detail.verificationGate.proofCoverage
      ? detail.verificationGate.proofCoverage
      : {};
  const items = Array.isArray(proofCoverage.items) ? proofCoverage.items : [];
  const verifiedCount = items.filter(
    (item) => item && (item.verified || item.strong),
  ).length;
  const draftCount = items.filter(
    (item) => item && !(item.verified || item.strong),
  ).length;
  const draftChecks = extractVerificationPlannedChecks(
    detail.verificationText || "",
  ).length;

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

export function deriveTrustFreshness(detail = {}) {
  const proofCoverage =
    detail.verificationGate && detail.verificationGate.proofCoverage
      ? detail.verificationGate.proofCoverage
      : {};
  const items = Array.isArray(proofCoverage.items) ? proofCoverage.items : [];
  const verifiedCount = items.filter(
    (item) => item && (item.verified || item.strong),
  ).length;
  const currentVerifiedEvidenceCount = Number(
    proofCoverage.currentVerifiedEvidenceCount ||
      proofCoverage.anchoredStrongProofCount ||
      0,
  );
  const recordedVerifiedEvidenceCount = Number(
    proofCoverage.recordedVerifiedEvidenceCount ||
      proofCoverage.compatibilityStrongProofCount ||
      0,
  );
  const runCount = Array.isArray(detail.runs) ? detail.runs.length : 0;

  if (currentVerifiedEvidenceCount > 0) {
    return "current";
  }
  if (recordedVerifiedEvidenceCount > 0 || verifiedCount > 0 || runCount > 0) {
    return "recorded";
  }
  return "stale";
}

export function collectTrustCollectors(detail = {}) {
  const collectorIds = new Set();
  const proofCoverage =
    detail.verificationGate && detail.verificationGate.proofCoverage
      ? detail.verificationGate.proofCoverage
      : {};

  (Array.isArray(proofCoverage.items) ? proofCoverage.items : []).forEach(
    (item) => {
      if (!item || (!item.verified && !item.strong)) {
        return;
      }

      const sourceType = String(item.sourceType || "").trim().toLowerCase();
      if (sourceType) {
        collectorIds.add(`source:${sourceType}`);
      }
    },
  );

  (Array.isArray(detail.runs) ? detail.runs : []).forEach((run) => {
    (Array.isArray(run.collectorResults) ? run.collectorResults : []).forEach(
      (collector) => {
        const collectorId = String(
          collector && collector.collectorId ? collector.collectorId : "",
        )
          .trim()
          .toLowerCase();
        if (collectorId) {
          collectorIds.add(`collector:${collectorId}`);
        }
      },
    );

    const evidenceCollectors =
      run && run.evidence && Array.isArray(run.evidence.collectors)
        ? run.evidence.collectors
        : [];
    evidenceCollectors.forEach((collector) => {
      const collectorId = String(
        collector && collector.collectorId ? collector.collectorId : "",
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

export function buildTaskTrustSnapshot(detail = {}) {
  const coverage = normalizeTrustPercent(
    detail.verificationGate && detail.verificationGate.coveragePercent,
  );
  const signal = deriveTrustSignal(detail);
  const freshness = deriveTrustFreshness(detail);
  const collectorIds = collectTrustCollectors(detail);
  const trustScore = calculateTrustScore({
    collectorCount: collectorIds.length,
    coverage,
    freshness,
    signal,
  });

  return {
    trustScore,
    coverage,
    signal,
    freshness,
    collectorCount: collectorIds.length,
    collectorIds,
    lastEvidenceAt:
      (detail.verificationGate &&
        detail.verificationGate.evidence &&
        detail.verificationGate.evidence.latestEvidenceAt) ||
      latestTimestamp(
        []
          .concat((detail.runs || []).map((run) => run.completedAt || run.createdAt))
          .concat(
            (detail.activityRecords || []).map((record) => record.createdAt),
          ),
      ),
  };
}

export function resolveTrustTone(score = 0) {
  const normalizedScore = normalizeTrustPercent(score);
  if (normalizedScore >= 80) {
    return "high";
  }
  if (normalizedScore >= 50) {
    return "medium";
  }
  return "low";
}

export function resolveHeatmapBucket(timestamp, now = Date.now()) {
  const value = new Date(timestamp).getTime();
  if (!Number.isFinite(value)) {
    return TRUST_HEATMAP_BUCKETS[TRUST_HEATMAP_BUCKETS.length - 1].id;
  }

  const ageMs = Math.max(0, now - value);
  const matchedBucket = TRUST_HEATMAP_BUCKETS.find(
    (bucket) => ageMs <= bucket.maxAgeMs,
  );

  return matchedBucket
    ? matchedBucket.id
    : TRUST_HEATMAP_BUCKETS[TRUST_HEATMAP_BUCKETS.length - 1].id;
}

function latestTimestamp(values) {
  const latest = (Array.isArray(values) ? values : []).reduce(
    (current, value) => {
      const next = new Date(value).getTime();
      if (!Number.isFinite(next)) {
        return current;
      }

      return current === null || next > current ? next : current;
    },
    null,
  );

  return latest === null ? null : new Date(latest).toISOString();
}
