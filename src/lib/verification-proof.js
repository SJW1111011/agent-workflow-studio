const crypto = require("crypto");

const {
  normalizeArtifactRef,
  normalizeProofAnchors,
  normalizeProofPath,
  normalizeProofPaths,
} = require("./evidence-utils");

const VERIFICATION_MANUAL_PROOF_ANCHOR_BLOCK_ID = "verification-manual-proof-anchors";

function parseManualProofItems(verificationText, verificationUpdatedAtMs) {
  if (!verificationUpdatedAtMs) {
    return [];
  }

  const proofSection =
    getMarkdownSection(stripEvidenceBlocks(verificationText), "Proof links") ||
    getMarkdownSection(stripEvidenceBlocks(verificationText), "Proof Links");
  if (!proofSection) {
    return [];
  }

  const manualAnchorPayload = parseManagedManualProofAnchors(verificationText);
  const manualAnchorRecordsBySignature = new Map(
    manualAnchorPayload.records.map((record) => [record.proofSignature, record])
  );

  return splitProofBlocks(proofSection)
    .map((block, index) => parseProofBlock(block, {
      sourceType: "manual",
      sourceLabel: `verification.md#proof-${index + 1}`,
      recordedAtMs: verificationUpdatedAtMs,
      manualAnchorRecordsBySignature,
    }))
    .filter(hasAnyProofData);
}

function parseManagedManualProofAnchors(verificationText) {
  const rawBlockBody = extractManagedBlockBody(verificationText, VERIFICATION_MANUAL_PROOF_ANCHOR_BLOCK_ID);
  if (!rawBlockBody) {
    return {
      version: 1,
      hasBlock: false,
      rawBlockBody: "",
      records: [],
      parseError: null,
    };
  }

  const payloadText = extractJsonCodeFence(rawBlockBody) || rawBlockBody;

  try {
    const payload = JSON.parse(payloadText);
    return {
      version: Number.isInteger(payload && payload.version) ? payload.version : 1,
      hasBlock: true,
      rawBlockBody,
      records: normalizeManualProofAnchorRecords(payload && payload.manualProofAnchors),
      parseError: null,
    };
  } catch (error) {
    return {
      version: 1,
      hasBlock: true,
      rawBlockBody,
      records: [],
      parseError: error,
    };
  }
}

function renderManagedManualProofAnchorLines(records) {
  const payload = {
    version: 1,
    manualProofAnchors: normalizeManualProofAnchorRecords(records).map((record) => ({
      proofSignature: record.proofSignature,
      capturedAt: record.capturedAt,
      paths: record.paths,
      anchors: record.anchors,
    })),
  };

  return ["### Manual proof anchors", "", "```json"]
    .concat(JSON.stringify(payload, null, 2).split("\n"))
    .concat(["```"]);
}

function buildManualProofSignature(item) {
  const normalized = {
    paths: normalizeProofPaths(item && item.paths).slice().sort(),
    checks: uniqueStrings(item && item.checks).slice().sort(),
    artifacts: uniqueStrings(item && item.artifacts).map(normalizeArtifactRef).filter(Boolean).sort(),
  };

  return `sha1:${crypto.createHash("sha1").update(JSON.stringify(normalized)).digest("hex")}`;
}

function stripManagedVerificationAnchorBlock(verificationText) {
  const normalized = normalizeText(verificationText);
  if (!normalized) {
    return "";
  }

  const stripped = normalized
    .replace(
      new RegExp(
        `(?:\\n)?${escapeRegex(managedBlockStart(VERIFICATION_MANUAL_PROOF_ANCHOR_BLOCK_ID))}[\\s\\S]*?${escapeRegex(
          managedBlockEnd(VERIFICATION_MANUAL_PROOF_ANCHOR_BLOCK_ID)
        )}(?:\\n)?`,
        "m"
      ),
      "\n"
    )
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const evidenceSection = getMarkdownSection(stripped, "Evidence");
  if (!evidenceSection) {
    return stripped;
  }

  const evidenceRange = findMarkdownSectionRange(stripped, "Evidence");
  if (!evidenceRange || evidenceSection.trim()) {
    return stripped;
  }

  return [stripped.slice(0, evidenceRange.start).trimEnd(), stripped.slice(evidenceRange.end).trimStart()]
    .filter(Boolean)
    .join("\n\n");
}

function parseProofBlock(blockText, options = {}) {
  const item = {
    sourceType: options.sourceType,
    sourceLabel: options.sourceLabel,
    recordedAtMs: options.recordedAtMs,
    paths: [],
    checks: [],
    artifacts: [],
  };
  let lastCheckIndex = -1;

  String(blockText || "")
    .split(/\r?\n/)
    .map((line) => stripMarkdownDecorators(line))
    .filter(Boolean)
    .forEach((line) => {
      const normalized = String(line).trim();
      const lower = normalized.toLowerCase();

      if (/^(?:files?|paths?)\s*:/.test(lower)) {
        extractProofPaths(normalized).forEach((proofPath) => {
          item.paths.push(proofPath);
        });
        return;
      }

      if (/^(?:check|checks|command|commands)\s*:/.test(lower)) {
        const value = normalized.slice(normalized.indexOf(":") + 1).trim();
        if (value) {
          item.checks.push(value);
          lastCheckIndex = item.checks.length - 1;
        }
        return;
      }

      if (/^(?:result|results?|status|outcome)\s*:/.test(lower)) {
        const value = normalized.slice(normalized.indexOf(":") + 1).trim();
        if (value) {
          if (lastCheckIndex >= 0) {
            item.checks[lastCheckIndex] = `${item.checks[lastCheckIndex]} (result: ${value})`;
          } else {
            item.checks.push(`result: ${value}`);
            lastCheckIndex = item.checks.length - 1;
          }
        }
        return;
      }

      if (/^(?:artifact|artifacts)\s*:/.test(lower)) {
        extractArtifactRefs(normalized.slice(normalized.indexOf(":") + 1).trim()).forEach((artifact) => {
          item.artifacts.push(artifact);
        });
      }
    });

  item.paths = uniqueStrings(item.paths);
  item.checks = uniqueStrings(item.checks);
  item.artifacts = uniqueStrings(item.artifacts);
  item.proofSignature = buildManualProofSignature(item);

  if (isStrongProofCandidate(item) && options.manualAnchorRecordsBySignature instanceof Map) {
    const attachedAnchorRecord = options.manualAnchorRecordsBySignature.get(item.proofSignature);
    if (attachedAnchorRecord) {
      item.anchors = attachedAnchorRecord.anchors;
      item.recordedAtMs =
        Number.isFinite(attachedAnchorRecord.capturedAtMs) ? attachedAnchorRecord.capturedAtMs : item.recordedAtMs;
    }
  }

  return item;
}

function splitProofBlocks(sectionText) {
  const normalized = normalizeText(sectionText);
  if (!normalized) {
    return [];
  }

  if (/^### /m.test(normalized)) {
    return normalized
      .split(/^### .+$/m)
      .map((block) => block.trim())
      .filter(Boolean);
  }

  return [normalized];
}

function stripEvidenceBlocks(verificationText) {
  const normalized = String(verificationText || "").replace(/\r\n/g, "\n");
  const markerIndex = normalized.search(/(?:^|\n)## Evidence(?: |$)/m);
  return markerIndex >= 0 ? normalized.slice(0, markerIndex).trim() : normalized.trim();
}

function normalizeVerificationMarkdownForFingerprint(verificationText) {
  return normalizeText(stripEvidenceBlocks(verificationText));
}

function extractManagedBlockBody(content, blockId) {
  const normalized = String(content || "").replace(/\r\n/g, "\n");
  const matched = normalized.match(
    new RegExp(
      `${escapeRegex(managedBlockStart(blockId))}\\n?([\\s\\S]*?)\\n?${escapeRegex(managedBlockEnd(blockId))}`,
      "m"
    )
  );

  return matched ? String(matched[1] || "").trim() : "";
}

function extractJsonCodeFence(content) {
  const matched = String(content || "").match(/```(?:json)?\n([\s\S]*?)\n```/i);
  return matched ? String(matched[1] || "").trim() : "";
}

function normalizeManualProofAnchorRecords(records) {
  return Array.from(
    new Map(
      toArray(records)
        .map((record) => normalizeManualProofAnchorRecord(record))
        .filter(Boolean)
        .map((record) => [record.proofSignature, record])
    ).values()
  );
}

function normalizeManualProofAnchorRecord(value) {
  if (!value || typeof value !== "object") {
    return null;
  }

  const proofSignature = firstNonEmptyString([value.proofSignature, value.signature]);
  const anchors = normalizeProofAnchors(value.anchors || value.scopeProofAnchors);
  if (!proofSignature || anchors.length === 0) {
    return null;
  }

  const capturedAtMs = parseTime(value.capturedAt || value.recordedAt);
  const capturedAt = capturedAtMs ? new Date(capturedAtMs).toISOString() : null;

  return {
    proofSignature,
    capturedAt,
    capturedAtMs,
    paths: normalizeProofPaths(value.paths || value.scopeProofPaths),
    anchors,
  };
}

function getMarkdownSection(content, title) {
  const range = findMarkdownSectionRange(content, title);
  if (!range) {
    return "";
  }

  return String(content || "").replace(/\r\n/g, "\n").slice(range.bodyStart, range.end).trim();
}

function findMarkdownSectionRange(content, title) {
  const normalized = String(content || "").replace(/\r\n/g, "\n");
  if (!normalized.trim()) {
    return null;
  }

  const lines = normalized.split("\n");
  const headingLine = `## ${title}`;
  const lineOffsets = [];
  let offset = 0;

  lines.forEach((line) => {
    lineOffsets.push(offset);
    offset += line.length + 1;
  });

  const startLine = lines.findIndex((line) => line.trim() === headingLine);
  if (startLine === -1) {
    return null;
  }

  let endLine = lines.length;
  for (let index = startLine + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      endLine = index;
      break;
    }
  }

  const start = lineOffsets[startLine];
  const bodyStart = start + lines[startLine].length + 1;
  const end = endLine < lines.length ? lineOffsets[endLine] - 1 : normalized.length;

  return {
    title,
    start,
    bodyStart: Math.min(bodyStart, normalized.length),
    end: Math.max(bodyStart, end),
  };
}

function extractProofPaths(text) {
  const directiveValues = extractDirectiveValues(text);
  const backtickValues = Array.from(String(text || "").matchAll(/`([^`]+)`/g)).map((match) => match[1]);
  const regexValues = String(text || "").match(/(?:\.{0,2}\/)?[A-Za-z0-9_.*-]+(?:[\\/][A-Za-z0-9_.*\-]+)+\/?/g) || [];

  return uniqueStrings(
    directiveValues
      .concat(backtickValues)
      .concat(regexValues)
      .map(normalizeProofPath)
      .filter(Boolean)
  );
}

function extractArtifactRefs(text) {
  const backtickValues = Array.from(String(text || "").matchAll(/`([^`]+)`/g)).map((match) => match[1]);
  const regexValues = String(text || "").match(/(?:\.{0,2}\/)?[A-Za-z0-9_.*-]+(?:[\\/][A-Za-z0-9_.*\-]+)+\/?/g) || [];
  const values = backtickValues.length > 0 ? backtickValues : regexValues.length > 0 ? regexValues : splitLooseValues(text);
  return uniqueStrings(values.map(normalizeArtifactRef).filter(Boolean));
}

function extractDirectiveValues(text) {
  const directiveMatch = String(text || "").match(/^(?:repo\s+)?(?:path|paths|file|files|dir|dirs|directory|directories)\s*:\s*(.+)$/i);
  if (!directiveMatch) {
    return [];
  }

  return directiveMatch[1]
    .split(/[;,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function splitLooseValues(text) {
  return String(text || "")
    .split(/[;,]/)
    .map((value) => value.trim())
    .filter(Boolean);
}

function stripMarkdownDecorators(line) {
  return String(line || "")
    .replace(/^\s*[-*+]\s*/, "")
    .replace(/^\s*\d+\.\s*/, "")
    .trim();
}

function normalizeText(content) {
  return String(content || "").replace(/\r\n/g, "\n").trim();
}

function uniqueStrings(values) {
  return Array.from(new Set(toArray(values).filter(Boolean).map((value) => String(value).trim()).filter(Boolean)));
}

function toArray(value) {
  if (value === undefined || value === null || value === "") {
    return [];
  }

  return Array.isArray(value) ? value : [value];
}

function hasAnyProofData(item) {
  return item && (item.paths.length > 0 || item.checks.length > 0 || item.artifacts.length > 0);
}

function isStrongProofCandidate(item) {
  return Boolean(item && item.paths.length > 0 && (item.checks.length > 0 || item.artifacts.length > 0));
}

function firstNonEmptyString(values) {
  return toArray(values).find((value) => typeof value === "string" && value.trim().length > 0) || "";
}

function parseTime(value) {
  if (!value) {
    return null;
  }

  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

function managedBlockStart(blockId) {
  return `<!-- agent-workflow:managed:${blockId}:start -->`;
}

function managedBlockEnd(blockId) {
  return `<!-- agent-workflow:managed:${blockId}:end -->`;
}

function escapeRegex(value) {
  return String(value || "").replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

module.exports = {
  VERIFICATION_MANUAL_PROOF_ANCHOR_BLOCK_ID,
  buildManualProofSignature,
  findMarkdownSectionRange,
  getMarkdownSection,
  normalizeVerificationMarkdownForFingerprint,
  parseManagedManualProofAnchors,
  parseManualProofItems,
  renderManagedManualProofAnchorLines,
  stripManagedVerificationAnchorBlock,
};
