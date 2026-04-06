const path = require("path");

const VALID_CHECK_STATUSES = ["passed", "failed", "recorded", "info"];

function normalizeProofPath(value) {
  return normalizeRelativePath(value);
}

function normalizeArtifactRef(value) {
  return normalizeRelativePath(value);
}

function normalizeProofPaths(values) {
  return uniqueStrings(toArray(values).map(normalizeProofPath).filter(Boolean));
}

function normalizeProofAnchors(values) {
  const anchorsByPath = new Map();

  toArray(values)
    .map((value) => normalizeProofAnchor(value))
    .filter(Boolean)
    .forEach((anchor) => {
      const existing = anchorsByPath.get(anchor.path);
      if (!existing || countDefinedProofAnchorFields(anchor) >= countDefinedProofAnchorFields(existing)) {
        anchorsByPath.set(anchor.path, anchor);
      }
    });

  return Array.from(anchorsByPath.values());
}

function normalizeProofAnchor(value) {
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
  const contentFingerprint = firstNonEmptyString([
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
  if (VALID_CHECK_STATUSES.includes(normalized)) {
    return normalized;
  }

  return VALID_CHECK_STATUSES.includes(fallbackStatus) ? fallbackStatus : "recorded";
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

module.exports = {
  VALID_CHECK_STATUSES,
  defaultCheckStatusForRunStatus,
  formatVerificationCheck,
  normalizeArtifactRef,
  normalizeArtifactRefs,
  normalizeProofAnchors,
  normalizeProofPath,
  normalizeProofPaths,
  normalizeVerificationChecks,
  summarizeVerificationChecks,
};
