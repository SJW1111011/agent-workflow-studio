const path = require("path");

const VALID_CHECK_STATUSES = ["passed", "failed", "recorded", "info"];
const CHECK_STATUS_ALIASES = Object.freeze({
  verified: "passed",
  strong: "passed",
  weak: "recorded",
  draft: "recorded",
  planned: "recorded",
});
const VALID_RUN_STATUSES = ["passed", "failed", "draft"];
const RUN_STATUS_ALIASES = Object.freeze({
  verified: "passed",
  strong: "passed",
  weak: "draft",
  recorded: "draft",
  planned: "draft",
  info: "draft",
});

function normalizeProofPath(value) {
  return normalizeRelativePath(value);
}

function normalizeArtifactRef(value) {
  return normalizeRelativePath(value);
}

function normalizeProofPaths(values) {
  return uniqueStrings(toArray(values).map(normalizeProofPath).filter(Boolean));
}

function normalizeProofAnchors(values, options = {}) {
  const anchorsByPath = new Map();

  toArray(values)
    .map((value) => normalizeProofAnchor(value, options))
    .filter(Boolean)
    .forEach((anchor) => {
      const existing = anchorsByPath.get(anchor.path);
      if (!existing || countDefinedProofAnchorFields(anchor) >= countDefinedProofAnchorFields(existing)) {
        anchorsByPath.set(anchor.path, anchor);
      }
    });

  return Array.from(anchorsByPath.values());
}

function normalizeProofAnchor(value, options = {}) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const path = normalizeProofPath(value.path || value.file || value.proofPath);
  if (!path) {
    return null;
  }

  const anchor = { path };
  const gitState = firstNonEmptyString([value.gitState, value.state]);
  const previousPath = normalizeProofPath(value.previousPath || value.fromPath || value.oldPath);
  const contentFingerprint =
    options.strict === false
      ? ""
      : firstNonEmptyString([
          value.contentFingerprint,
          value.fingerprint,
          value.hash,
        ]);

  if (gitState) {
    anchor.gitState = gitState;
  }

  if (previousPath) {
    anchor.previousPath = previousPath;
  }

  if (value.exists !== undefined) {
    anchor.exists = Boolean(value.exists);
  }

  if (contentFingerprint) {
    anchor.contentFingerprint = contentFingerprint;
  }

  return anchor;
}

function normalizeArtifactRefs(values) {
  return uniqueStrings(toArray(values).map(normalizeArtifactRef).filter(Boolean));
}

function normalizeVerificationChecks(values, fallbackStatus = "recorded") {
  return toArray(values)
    .map((value) => normalizeVerificationCheck(value, fallbackStatus))
    .filter(Boolean);
}

function normalizeVerificationCheck(value, fallbackStatus = "recorded") {
  if (typeof value === "string") {
    const label = value.trim();
    if (!label) {
      return null;
    }

    return {
      label,
      status: normalizeCheckStatus(null, fallbackStatus),
      details: undefined,
      artifacts: [],
    };
  }

  if (!value || typeof value !== "object") {
    return null;
  }

  const label = firstNonEmptyString([value.label, value.name, value.check, value.command, value.title]);
  if (!label) {
    return null;
  }

  return {
    label,
    status: normalizeCheckStatus(value.status || value.result || value.outcome, fallbackStatus),
    details: firstNonEmptyString([value.details, value.detail, value.note, value.summary]) || undefined,
    artifacts: normalizeArtifactRefs(
      []
        .concat(toArray(value.artifacts))
        .concat(toArray(value.artifactRefs))
        .concat(toArray(value.files))
        .concat(toArray(value.file))
    ),
  };
}

function formatVerificationCheck(check) {
  if (!check || !check.label) {
    return "";
  }

  const statusPrefix = check.status ? `[${check.status}] ` : "";
  const detailsSuffix = check.details ? ` - ${check.details}` : "";
  return `${statusPrefix}${check.label}${detailsSuffix}`;
}

function summarizeVerificationChecks(values, fallbackStatus = "recorded") {
  return normalizeVerificationChecks(values, fallbackStatus)
    .map((item) => formatVerificationCheck(item))
    .filter(Boolean);
}

function defaultCheckStatusForRunStatus(status) {
  const normalized = String(status || "").trim().toLowerCase();
  if (normalized === "passed") {
    return "passed";
  }
  if (normalized === "failed") {
    return "failed";
  }
  return "recorded";
}

function normalizeCheckStatus(status, fallbackStatus = "recorded") {
  const normalized = String(status || "").trim().toLowerCase();
  const aliased = CHECK_STATUS_ALIASES[normalized] || normalized;
  if (VALID_CHECK_STATUSES.includes(aliased)) {
    return aliased;
  }

  return VALID_CHECK_STATUSES.includes(fallbackStatus) ? fallbackStatus : "recorded";
}

function normalizeRunStatus(status, fallbackStatus = "draft") {
  const normalized = String(status || "").trim().toLowerCase();
  const aliased = RUN_STATUS_ALIASES[normalized] || normalized;
  if (VALID_RUN_STATUSES.includes(aliased)) {
    return aliased;
  }

  return VALID_RUN_STATUSES.includes(fallbackStatus) ? fallbackStatus : "draft";
}

function normalizeVerificationTier(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (normalized === "verified" || normalized === "strong") {
    return "verified";
  }

  if (normalized === "partial" || normalized === "mixed") {
    return "partial";
  }

  if (normalized === "draft" || normalized === "weak" || normalized === "planned") {
    return "draft";
  }

  if (normalized === "none") {
    return "none";
  }

  return "";
}

function normalizeVerificationSignalStatus(value) {
  const normalized = normalizeVerificationTier(value);
  return normalized && normalized !== "partial" ? normalized : normalized === "partial" ? "partial" : "";
}

function normalizeVerificationGateStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (normalized === "action-required" || normalized === "needs-proof") {
    return "action-required";
  }

  if (normalized === "incomplete" || normalized === "partially-covered") {
    return "incomplete";
  }

  if (normalized === "unconfigured" || normalized === "scope-missing") {
    return "unconfigured";
  }

  if (normalized === "covered" || normalized === "ready") {
    return normalized;
  }

  return "";
}

function normalizeEvidenceFreshnessStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (normalized === "current" || normalized === "anchor-backed") {
    return "current";
  }

  if (normalized === "recorded" || normalized === "compatibility-only") {
    return "recorded";
  }

  if (normalized === "outdated" || normalized === "anchor-stale") {
    return "outdated";
  }

  return "";
}

function normalizeProofCoverageItem(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const normalized = { ...value };
  if (typeof normalized.strong === "boolean" && normalized.verified === undefined) {
    normalized.verified = normalized.strong;
  }
  if (typeof normalized.verified === "boolean" && normalized.strong === undefined) {
    normalized.strong = normalized.verified;
  }
  return normalized;
}

function normalizeProofCoverageSummary(value) {
  if (!value || typeof value !== "object") {
    return {};
  }

  const normalized = { ...value };
  copyNumericAlias(normalized, "verifiedEvidenceCount", "explicitProofCount");
  copyNumericAlias(normalized, "draftEvidenceCount", "weakProofCount");
  copyNumericAlias(normalized, "currentVerifiedEvidenceCount", "anchoredStrongProofCount");
  copyNumericAlias(normalized, "recordedVerifiedEvidenceCount", "compatibilityStrongProofCount");

  if (Array.isArray(normalized.items)) {
    normalized.items = normalized.items.map((item) => normalizeProofCoverageItem(item));
  }

  return normalized;
}

function normalizeRunRecordForRead(value) {
  if (!value || typeof value !== "object") {
    return value;
  }

  const normalized = { ...value };
  const runStatus = normalizeRunStatus(value.status, "draft");
  const scopeProofPathSource = firstDefinedValue([
    value.scopeProofPaths,
    value.proofPaths,
    value.proofPath,
    value.paths,
    value.files,
  ]);
  const verificationCheckSource = firstDefinedValue([value.verificationChecks, value.checks]);
  const verificationArtifactSource = firstDefinedValue([
    value.verificationArtifacts,
    value.artifacts,
  ]);
  const scopeProofAnchorSource = firstDefinedValue([
    value.scopeProofAnchors,
    value.proofAnchors,
    value.anchors,
  ]);

  if (value.status !== undefined) {
    normalized.status = runStatus;
  }

  if (scopeProofPathSource !== undefined) {
    normalized.scopeProofPaths = normalizeProofPaths(scopeProofPathSource);
  }

  if (verificationCheckSource !== undefined) {
    normalized.verificationChecks = normalizeVerificationChecks(
      verificationCheckSource,
      defaultCheckStatusForRunStatus(runStatus)
    );
  }

  if (verificationArtifactSource !== undefined) {
    normalized.verificationArtifacts = normalizeArtifactRefs(verificationArtifactSource);
  }

  if (scopeProofAnchorSource !== undefined) {
    normalized.scopeProofAnchors = normalizeProofAnchors(scopeProofAnchorSource);
  }

  copyNumericAlias(normalized, "verifiedProofCount", "strongProofCount");
  copyNumericAlias(normalized, "draftEvidenceCount", "draftProofCount");
  copyNumericAlias(normalized, "draftCheckCount", "plannedVerificationCheckCount");
  copyNumericAlias(normalized, "currentVerifiedEvidenceCount", "anchorBackedStrongProofCount");
  copyNumericAlias(normalized, "recordedVerifiedEvidenceCount", "compatibilityStrongProofCount");

  return normalized;
}

function isVerifiedEvidence(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (typeof value.verified === "boolean") {
    return value.verified;
  }

  if (typeof value.strong === "boolean") {
    return value.strong;
  }

  const normalizedTier = normalizeVerificationTier(
    firstNonEmptyString([value.tier, value.status, value.quality, value.proofTier])
  );
  if (normalizedTier === "verified") {
    return true;
  }
  if (normalizedTier === "draft") {
    return false;
  }

  const proofPaths = normalizeProofPaths(value.paths || value.scopeProofPaths);
  const checks = uniqueStrings(
    []
      .concat(toArray(value.checks))
      .concat(toArray(value.verificationChecks))
      .filter(Boolean)
  );
  const artifacts = normalizeArtifactRefs(value.artifacts || value.verificationArtifacts);

  return proofPaths.length > 0 && (checks.length > 0 || artifacts.length > 0);
}

function normalizeRelativePath(value) {
  if (typeof value !== "string") {
    return null;
  }

  let normalized = String(value || "")
    .replace(/[`"']/g, "")
    .replace(/[),.;:]+$/, "")
    .replace(/\\/g, "/")
    .trim();

  if (!normalized) {
    return null;
  }

  if (path.isAbsolute(normalized) || /^[A-Za-z]:/.test(normalized)) {
    return null;
  }

  normalized = normalized.replace(/^\.\//, "");
  return normalized || null;
}

function toArray(value) {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function uniqueStrings(values) {
  return Array.from(
    new Set(
      toArray(values)
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function firstNonEmptyString(values) {
  return toArray(values).find((value) => typeof value === "string" && value.trim().length > 0) || "";
}

function countDefinedProofAnchorFields(anchor) {
  return ["gitState", "previousPath", "exists", "contentFingerprint"].reduce((count, key) => {
    return anchor && anchor[key] !== undefined ? count + 1 : count;
  }, 0);
}

function firstDefinedValue(values) {
  return toArray(values).find((value) => value !== undefined);
}

function copyNumericAlias(target, canonicalKey, aliasKey) {
  if (!target || typeof target !== "object") {
    return;
  }

  if (typeof target[canonicalKey] === "number" && target[aliasKey] === undefined) {
    target[aliasKey] = target[canonicalKey];
  }

  if (typeof target[aliasKey] === "number" && target[canonicalKey] === undefined) {
    target[canonicalKey] = target[aliasKey];
  }
}

module.exports = {
  VALID_CHECK_STATUSES,
  defaultCheckStatusForRunStatus,
  formatVerificationCheck,
  isVerifiedEvidence,
  normalizeCheckStatus,
  normalizeEvidenceFreshnessStatus,
  normalizeArtifactRef,
  normalizeArtifactRefs,
  normalizeProofCoverageItem,
  normalizeProofCoverageSummary,
  normalizeVerificationGateStatus,
  normalizeProofAnchors,
  normalizeProofPath,
  normalizeProofPaths,
  normalizeRunRecordForRead,
  normalizeRunStatus,
  normalizeVerificationSignalStatus,
  normalizeVerificationTier,
  normalizeVerificationChecks,
  summarizeVerificationChecks,
};
