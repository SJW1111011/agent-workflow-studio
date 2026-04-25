const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { badRequest, createHttpError, notFound } = require("./http-errors");
const { fileExists, readJson, writeJson } = require("./fs-utils");
const { taskFiles } = require("./workspace");

const CI_EVIDENCE_FILE_PREFIX = "ci-evidence-";
const CI_EVIDENCE_TYPE = "ci-evidence";
const SIGNATURE_HEADER = "x-workflow-signature";
const WEBHOOK_SECRET_ENV = "WORKFLOW_WEBHOOK_SECRET";

function recordWebhookEvidence(workspaceRoot, payload, options = {}) {
  const secret = getWebhookSecret(options);
  const rawBody = String(options.rawBody || "");
  const signatureHeader = getSignatureHeader(options);

  validateWebhookSignature(rawBody, signatureHeader, secret);

  const evidence = createCiEvidenceRecord(normalizeCiEvidencePayload(payload), options);
  const files = taskFiles(workspaceRoot, evidence.taskId);
  if (!fileExists(files.meta)) {
    throw notFound(`Task not found: ${evidence.taskId}`, "task_not_found");
  }

  const persistedEvidence = persistCiEvidenceRecord(workspaceRoot, evidence.taskId, evidence);
  return {
    evidence: persistedEvidence,
    signatureVerified: Boolean(secret),
  };
}

function listCiEvidenceRecords(workspaceRoot, taskId) {
  const files = taskFiles(workspaceRoot, taskId);
  if (!fs.existsSync(files.runs)) {
    return [];
  }

  return fs
    .readdirSync(files.runs, { withFileTypes: true })
    .filter(
      (entry) =>
        entry.isFile() &&
        entry.name.startsWith(CI_EVIDENCE_FILE_PREFIX) &&
        entry.name.endsWith(".json")
    )
    .map((entry) => normalizeCiEvidenceRecordForRead(readJson(path.join(files.runs, entry.name), null), entry.name))
    .filter(Boolean)
    .sort((left, right) => String(left.createdAt || "").localeCompare(String(right.createdAt || "")));
}

function validateWebhookSignature(rawBody, signatureHeader, secret) {
  if (!secret) {
    return true;
  }

  const signature = normalizeSignatureHeader(signatureHeader);
  if (!signature) {
    throw unauthorized("Missing or invalid workflow signature.");
  }

  const expected = `sha256=${crypto.createHmac("sha256", secret).update(rawBody, "utf8").digest("hex")}`;
  if (!timingSafeSignatureEqual(signature, expected)) {
    throw unauthorized("Workflow signature mismatch.");
  }

  return true;
}

function createCiEvidenceRecord(payload, options = {}) {
  const createdAt = isNonEmptyString(options.createdAt) ? options.createdAt.trim() : new Date().toISOString();
  const baseId = isNonEmptyString(options.id) ? options.id.trim() : `${CI_EVIDENCE_FILE_PREFIX}${Date.now()}`;

  return {
    id: baseId,
    type: CI_EVIDENCE_TYPE,
    taskId: payload.taskId,
    source: payload.source,
    status: payload.status,
    checks: payload.checks,
    metadata: payload.metadata,
    createdAt,
  };
}

function persistCiEvidenceRecord(workspaceRoot, taskId, evidence) {
  const files = taskFiles(workspaceRoot, taskId);
  fs.mkdirSync(files.runs, { recursive: true });

  const persistedEvidence = {
    ...evidence,
    id: buildUniqueCiEvidenceId(files.runs, evidence.id),
  };
  writeJson(path.join(files.runs, `${persistedEvidence.id}.json`), persistedEvidence);

  const taskMeta = readJson(files.meta, {});
  writeJson(files.meta, {
    ...taskMeta,
    updatedAt: persistedEvidence.createdAt,
  });

  return persistedEvidence;
}

function normalizeCiEvidencePayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw badRequest("CI evidence payload must be a JSON object.", "ci_evidence_payload_invalid");
  }

  const taskId = normalizeRequiredString(payload.taskId, "taskId");
  const source = normalizeRequiredString(payload.source, "source");
  const status = normalizeCiEvidenceStatus(payload.status);
  const checks = normalizeCiChecks(payload.checks);
  const metadata = normalizeCiMetadata(payload.metadata);

  return {
    taskId,
    source,
    status,
    checks,
    metadata,
  };
}

function normalizeCiEvidenceRecordForRead(value, fileName = "") {
  if (!value || typeof value !== "object") {
    return null;
  }

  try {
    const normalized = normalizeCiEvidencePayload(value);
    const id = isNonEmptyString(value.id) ? value.id.trim() : String(fileName || "").replace(/\.json$/i, "");
    const createdAt = isNonEmptyString(value.createdAt) ? value.createdAt.trim() : "";

    if (!id || !createdAt || !Number.isFinite(Date.parse(createdAt))) {
      return null;
    }

    return {
      id,
      type: CI_EVIDENCE_TYPE,
      taskId: normalized.taskId,
      source: normalized.source,
      status: normalized.status,
      checks: normalized.checks,
      metadata: normalized.metadata,
      createdAt,
    };
  } catch (error) {
    return null;
  }
}

function normalizeCiEvidenceStatus(value) {
  const normalized = String(value || "").trim().toLowerCase();
  const aliases = {
    cancelled: "failed",
    canceled: "failed",
    error: "failed",
    failure: "failed",
    in_progress: "pending",
    queued: "pending",
    skipped: "pending",
    success: "passed",
    successful: "passed",
  };
  const status = aliases[normalized] || normalized;

  if (status === "passed" || status === "failed" || status === "pending") {
    return status;
  }

  throw badRequest('CI evidence "status" must be passed, failed, or pending.', "ci_evidence_status_invalid");
}

function normalizeCiChecks(value) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw badRequest('CI evidence "checks" must be an array.', "ci_evidence_checks_invalid");
  }

  return value.map((entry, index) => {
    if (isNonEmptyString(entry)) {
      return entry.trim();
    }

    if (entry && typeof entry === "object" && !Array.isArray(entry)) {
      const label = [entry.label, entry.name, entry.check, entry.command, entry.title]
        .find((candidate) => isNonEmptyString(candidate));
      const status = isNonEmptyString(entry.status) ? entry.status.trim() : "";
      const details = isNonEmptyString(entry.details || entry.summary || entry.note)
        ? String(entry.details || entry.summary || entry.note).trim()
        : "";

      if (label) {
        return [status ? `[${status}]` : "", String(label).trim(), details ? `- ${details}` : ""]
          .filter(Boolean)
          .join(" ");
      }
    }

    throw badRequest(`CI evidence checks[${index}] must be a non-empty string or check object.`, "ci_evidence_checks_invalid");
  });
}

function normalizeCiMetadata(value) {
  if (value === undefined) {
    return {};
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw badRequest('CI evidence "metadata" must be an object.', "ci_evidence_metadata_invalid");
  }

  return normalizeJsonObject(value, "metadata");
}

function normalizeJsonObject(value, fieldPath) {
  return Object.fromEntries(
    Object.entries(value).map(([key, entryValue]) => [
      String(key).trim(),
      normalizeJsonValue(entryValue, `${fieldPath}.${key}`),
    ]).filter(([key]) => key)
  );
}

function normalizeJsonValue(value, fieldPath) {
  if (value === null) {
    return null;
  }

  if (typeof value === "string") {
    return value.trim();
  }

  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item, index) => normalizeJsonValue(item, `${fieldPath}[${index}]`));
  }

  if (value && typeof value === "object") {
    return normalizeJsonObject(value, fieldPath);
  }

  throw badRequest(`${fieldPath} must be JSON-serializable.`, "ci_evidence_metadata_invalid");
}

function getWebhookSecret(options = {}) {
  if (options.secret !== undefined) {
    return String(options.secret || "");
  }

  return String(process.env[WEBHOOK_SECRET_ENV] || "");
}

function getSignatureHeader(options = {}) {
  if (options.signatureHeader !== undefined) {
    return options.signatureHeader;
  }

  const headers = options.headers || {};
  const headerName = Object.keys(headers).find((key) => key.toLowerCase() === SIGNATURE_HEADER);
  return headerName ? headers[headerName] : undefined;
}

function normalizeSignatureHeader(value) {
  const signature = Array.isArray(value) ? value[0] : value;
  const normalized = String(signature || "").trim();
  return /^sha256=[a-f0-9]{64}$/i.test(normalized) ? normalized.toLowerCase() : "";
}

function timingSafeSignatureEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  const candidateBuffer = leftBuffer.length === rightBuffer.length ? leftBuffer : Buffer.alloc(rightBuffer.length);

  return crypto.timingSafeEqual(candidateBuffer, rightBuffer) && leftBuffer.length === rightBuffer.length;
}

function buildUniqueCiEvidenceId(recordsRoot, requestedId) {
  const baseId = isNonEmptyString(requestedId) ? requestedId.trim() : `${CI_EVIDENCE_FILE_PREFIX}${Date.now()}`;
  const baseCandidate = baseId.startsWith(CI_EVIDENCE_FILE_PREFIX) ? baseId : `${CI_EVIDENCE_FILE_PREFIX}${baseId}`;
  let candidate = baseCandidate;
  let suffix = 1;

  while (fileExists(path.join(recordsRoot, `${candidate}.json`))) {
    candidate = `${baseCandidate}-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function normalizeRequiredString(value, fieldName) {
  if (!isNonEmptyString(value)) {
    throw badRequest(`CI evidence requires a non-empty "${fieldName}" string.`, "ci_evidence_payload_invalid");
  }

  return value.trim();
}

function unauthorized(message) {
  return createHttpError(401, message, { code: "webhook_signature_invalid" });
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

module.exports = {
  CI_EVIDENCE_FILE_PREFIX,
  CI_EVIDENCE_TYPE,
  SIGNATURE_HEADER,
  WEBHOOK_SECRET_ENV,
  createCiEvidenceRecord,
  listCiEvidenceRecords,
  normalizeCiEvidencePayload,
  normalizeCiEvidenceRecordForRead,
  normalizeCiEvidenceStatus,
  recordWebhookEvidence,
  validateWebhookSignature,
};
