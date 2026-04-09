const fs = require("fs");
const { fileExists, readJson, writeFile, writeJson } = require("./fs-utils");
const { badRequest, notFound } = require("./http-errors");
const { buildScopeProofAnchors, loadRepositorySnapshot } = require("./repository-snapshot");
const { getRecipe } = require("./recipes");
const {
  parseManagedManualProofAnchors,
  parseManualProofItems,
  renderManagedManualProofAnchorLines,
  VERIFICATION_MANUAL_PROOF_ANCHOR_BLOCK_ID,
} = require("./verification-proof");
const { taskFiles } = require("./workspace");

const EDITABLE_TASK_DOCUMENTS = {
  "task.md": {
    fileKey: "task",
  },
  "context.md": {
    fileKey: "context",
  },
  "verification.md": {
    fileKey: "verification",
  },
};

const MANAGED_BLOCKS = {
  taskRecipe: "task-recipe-meta",
  contextRecipe: "context-recipe-guidance",
  contextConstraints: "context-constraints-meta",
  verificationManualProofAnchors: VERIFICATION_MANUAL_PROOF_ANCHOR_BLOCK_ID,
};

function renderTaskMarkdown(taskMeta, recipe) {
  return ensureTrailingNewline(`# ${taskMeta.id} - ${taskMeta.title}

## Goal

State the user outcome in one paragraph.

${renderManagedSection(
  "Recipe",
  `- Recipe ID: ${taskMeta.recipeId}\n- Recipe summary: ${recipe ? recipe.summary : "Unknown recipe"}`,
  MANAGED_BLOCKS.taskRecipe
)}

## Scope

- In scope:
  - repo path:
- Out of scope:
  - repo path:

## Required docs

- .agent-workflow/project-profile.md
- .agent-workflow/memory/product.md
- .agent-workflow/memory/architecture.md

## Deliverables

- code or config changes
- updated docs
- verification evidence

## Risks

- contract mismatches
- fake implementations
- unverified assumptions
`);
}

function renderContextMarkdown(taskMeta, recipe) {
  return ensureTrailingNewline(`# ${taskMeta.id} Context

## Why now

Describe why this task matters.

${renderManagedSection(
  "Recipe guidance",
  `- Recipe ID: ${taskMeta.recipeId}\n- Recommended for: ${
    recipe && Array.isArray(recipe.recommendedFor) ? recipe.recommendedFor.join(", ") : "N/A"
  }`,
  MANAGED_BLOCKS.contextRecipe
)}

## Facts

- 

## Open questions

- 

## Constraints

${renderManagedLines(
  [`- Priority: ${taskMeta.priority}`, "- Keep the workflow docs current."],
  MANAGED_BLOCKS.contextConstraints
)}
`);
}

function renderVerificationMarkdown(taskMeta) {
  return ensureTrailingNewline(`# ${taskMeta.id} Verification

## Planned checks

- automated:
- manual:

## Proof links

### Proof 1

- Files:
- Check:
- Result:
- Artifact:

## Blocking gaps

- 
`);
}

function renderCheckpointSkeleton(taskMeta) {
  return ensureTrailingNewline(`# ${taskMeta.id} Checkpoint

## Completed

- Task created

## Confirmed facts

- Priority: ${taskMeta.priority}
- Status: ${taskMeta.status}

## Remaining work

- compile prompts
- execute
- record evidence

## Resume instructions

- start by reading task.md, context.md, and verification.md
`);
}

function syncManagedTaskDocs(files, taskMeta, recipe) {
  if (fileExists(files.task)) {
    writeFile(files.task, normalizeTaskMarkdown(taskMeta, recipe, readFileWithFallback(files.task)));
  }

  if (fileExists(files.context)) {
    writeFile(files.context, normalizeContextMarkdown(taskMeta, recipe, readFileWithFallback(files.context)));
  }

  if (fileExists(files.checkpoint)) {
    writeFile(files.checkpoint, normalizeCheckpointMarkdown(taskMeta, readFileWithFallback(files.checkpoint)));
  }
}

function saveTaskDocument(workspaceRoot, taskId, documentName, content) {
  const files = taskFiles(workspaceRoot, taskId);
  if (!fileExists(files.meta)) {
    throw notFound(`Task ${taskId} does not exist yet.`, "task_not_found");
  }

  const documentConfig = EDITABLE_TASK_DOCUMENTS[documentName];
  if (!documentConfig) {
    throw badRequest(`Unsupported task document: ${documentName}`, "unsupported_task_document");
  }

  const taskMeta = readJson(files.meta, {});
  const recipe = getRecipe(workspaceRoot, taskMeta.recipeId);
  const existingContent = readFileWithFallback(files[documentConfig.fileKey]);
  const normalizedContent = normalizeEditableDocument(documentName, taskMeta, recipe, content, existingContent);

  writeFile(files[documentConfig.fileKey], normalizedContent);
  taskMeta.updatedAt = new Date().toISOString();
  writeJson(files.meta, taskMeta);

  return {
    documentName,
    content: normalizedContent,
    updatedAt: taskMeta.updatedAt,
  };
}

function refreshManualProofAnchors(workspaceRoot, taskId) {
  const files = taskFiles(workspaceRoot, taskId);
  if (!fileExists(files.meta)) {
    throw notFound(`Task ${taskId} does not exist yet.`, "task_not_found");
  }

  const taskMeta = readJson(files.meta, {});
  const currentVerificationText = readFileWithFallback(files.verification);
  const verificationUpdatedAtMs = fileExists(files.verification) ? fs.statSync(files.verification).mtimeMs : null;
  const existingAnchorPayload = parseManagedManualProofAnchors(currentVerificationText);
  const manualProofItems = parseManualProofItems(currentVerificationText, verificationUpdatedAtMs).filter(isStrongManualProofItem);

  if (manualProofItems.length === 0 && !existingAnchorPayload.hasBlock) {
    throw badRequest(
      `verification.md has no strong manual proof items to anchor yet for task ${taskId}.`,
      "manual_proof_anchors_unavailable"
    );
  }

  const repositorySnapshot = loadRepositorySnapshot(workspaceRoot);
  const capturedAt = new Date().toISOString();
  const refreshedRecords = manualProofItems
    .map((item) => {
      const anchors = buildScopeProofAnchors(workspaceRoot, item.paths, repositorySnapshot);
      if (anchors.length === 0) {
        return null;
      }

      return {
        proofSignature: item.proofSignature,
        capturedAt,
        paths: item.paths,
        anchors,
      };
    })
    .filter(Boolean);

  const nextVerificationText =
    refreshedRecords.length > 0
      ? upsertVerificationManualProofAnchorSection(currentVerificationText, refreshedRecords)
      : existingAnchorPayload.hasBlock
        ? removeVerificationManualProofAnchorSection(currentVerificationText)
        : ensureTrailingNewline(currentVerificationText);

  const normalizedCurrentText = ensureTrailingNewline(currentVerificationText);
  const changed = nextVerificationText !== normalizedCurrentText;
  const existingSignatures = new Set(existingAnchorPayload.records.map((record) => record.proofSignature));
  const refreshedSignatures = new Set(refreshedRecords.map((record) => record.proofSignature));
  const clearedCount = Array.from(existingSignatures).filter((signature) => !refreshedSignatures.has(signature)).length;
  const skippedCount = Math.max(0, manualProofItems.length - refreshedRecords.length);

  if (changed) {
    writeFile(files.verification, nextVerificationText);
  }

  return {
    changed,
    strongProofCount: manualProofItems.length,
    refreshedCount: refreshedRecords.length,
    skippedCount,
    clearedCount,
    content: changed ? nextVerificationText : normalizedCurrentText,
    updatedAt: taskMeta.updatedAt || null,
  };
}

function normalizeEditableDocument(documentName, taskMeta, recipe, content, existingContent = "") {
  const text = typeof content === "string" ? content : "";

  if (documentName === "task.md") {
    return normalizeTaskMarkdown(taskMeta, recipe, text);
  }

  if (documentName === "context.md") {
    return normalizeContextMarkdown(taskMeta, recipe, text);
  }

  if (documentName === "verification.md") {
    return normalizeVerificationMarkdown(taskMeta, text, existingContent);
  }

  throw badRequest(`Unsupported task document: ${documentName}`, "unsupported_task_document");
}

function normalizeTaskMarkdown(taskMeta, recipe, content) {
  let nextContent = ensureHeading(content, `# ${taskMeta.id} - ${taskMeta.title}`);
  nextContent = upsertManagedSection(
    nextContent,
    "Recipe",
    MANAGED_BLOCKS.taskRecipe,
    `- Recipe ID: ${taskMeta.recipeId}\n- Recipe summary: ${recipe ? recipe.summary : "Unknown recipe"}`
  );
  return ensureTrailingNewline(nextContent);
}

function normalizeContextMarkdown(taskMeta, recipe, content) {
  let nextContent = ensureHeading(content, `# ${taskMeta.id} Context`);
  nextContent = upsertManagedSection(
    nextContent,
    "Recipe guidance",
    MANAGED_BLOCKS.contextRecipe,
    `- Recipe ID: ${taskMeta.recipeId}\n- Recommended for: ${
      recipe && Array.isArray(recipe.recommendedFor) ? recipe.recommendedFor.join(", ") : "N/A"
    }`
  );
  nextContent = upsertManagedLinesInSection(
    nextContent,
    "Constraints",
    MANAGED_BLOCKS.contextConstraints,
    [`- Priority: ${taskMeta.priority}`, "- Keep the workflow docs current."],
    {
      stripLinePrefixes: ["- Priority:"],
      stripExactLines: ["- Keep the workflow docs current."],
    }
  );
  return ensureTrailingNewline(nextContent);
}

function normalizeVerificationMarkdown(taskMeta, content, existingContent = "") {
  let nextContent = ensureHeading(content, `# ${taskMeta.id} Verification`);
  const existingAnchorPayload = parseManagedManualProofAnchors(existingContent);

  if (existingAnchorPayload.hasBlock) {
    nextContent = existingAnchorPayload.parseError
      ? upsertVerificationManualProofAnchorSection(nextContent, [], existingAnchorPayload.rawBlockBody)
      : upsertVerificationManualProofAnchorSection(nextContent, existingAnchorPayload.records);
  }

  return ensureTrailingNewline(nextContent);
}

function normalizeCheckpointMarkdown(taskMeta, content) {
  let nextContent = ensureHeading(content, `# ${taskMeta.id} Checkpoint`);
  nextContent = upsertLineInSection(
    nextContent,
    "Confirmed facts",
    "- Priority:",
    `- Priority: ${taskMeta.priority}`
  );
  nextContent = upsertLineInSection(
    nextContent,
    "Confirmed facts",
    "- Status:",
    `- Status: ${taskMeta.status}`
  );
  return ensureTrailingNewline(nextContent);
}

function ensureHeading(content, expectedHeading) {
  const normalized = normalizeText(content);
  if (!normalized) {
    return expectedHeading;
  }

  const lines = normalized.split("\n");
  if (lines[0].startsWith("# ")) {
    lines[0] = expectedHeading;
    return lines.join("\n");
  }

  return `${expectedHeading}\n\n${normalized}`;
}

function upsertSection(content, title, body, options = {}) {
  const section = getSection(content, title);
  const renderedSection = `## ${title}\n\n${normalizeText(body)}`;

  if (!section) {
    const normalized = normalizeText(content);
    if (!normalized) {
      return renderedSection;
    }

    const insertBeforePattern = options.insertBeforePattern instanceof RegExp ? options.insertBeforePattern : null;
    if (insertBeforePattern) {
      const matched = normalized.match(insertBeforePattern);
      if (matched && typeof matched.index === "number") {
        return [normalized.slice(0, matched.index).trimEnd(), renderedSection, normalized.slice(matched.index).trimStart()]
          .filter(Boolean)
          .join("\n\n");
      }
    }

    return `${normalized}\n\n${renderedSection}`;
  }

  return joinBlocks(section.before, renderedSection, section.after);
}

function upsertManagedSection(content, title, blockId, body) {
  const renderedBlock = renderManagedSection(title, body, blockId);
  const replaced = replaceManagedBlock(content, blockId, renderedBlock);
  if (replaced !== null) {
    return replaced;
  }

  const section = getSection(content, title);
  if (!section) {
    const normalized = normalizeText(content);
    return normalized ? `${normalized}\n\n${renderedBlock}` : renderedBlock;
  }

  return joinBlocks(section.before, renderedBlock, section.after);
}

function upsertManagedLinesInSection(content, title, blockId, lines, options = {}) {
  const section = getSection(content, title);
  const renderedBlock = renderManagedLines(lines, blockId);
  if (!section) {
    return upsertSection(content, title, renderedBlock, options);
  }

  const replacedBody = replaceManagedBlock(section.body, blockId, renderedBlock);
  if (replacedBody !== null) {
    return upsertSection(content, title, replacedBody);
  }

  const cleanedBody = stripLegacyManagedLines(section.body, options);
  return upsertSection(content, title, joinBlocks(renderedBlock, cleanedBody));
}

function removeManagedBlockInSection(content, title, blockId) {
  const section = getSection(content, title);
  if (!section) {
    return ensureTrailingNewline(normalizeText(content));
  }

  const replacedBody = replaceManagedBlock(section.body, blockId, "");
  if (replacedBody === null) {
    return ensureTrailingNewline(normalizeText(content));
  }

  const cleanedBody = normalizeText(replacedBody);
  if (!cleanedBody) {
    return ensureTrailingNewline(joinBlocks(section.before, section.after));
  }

  return ensureTrailingNewline(upsertSection(content, title, cleanedBody));
}

function upsertLineInSection(content, title, linePrefix, nextLine, fallbackLine) {
  const section = getSection(content, title);
  if (!section) {
    const bodyLines = [nextLine];
    if (fallbackLine) {
      bodyLines.push(fallbackLine);
    }
    return upsertSection(content, title, bodyLines.join("\n"));
  }

  const bodyLines = section.body ? section.body.split("\n") : [];
  const targetIndex = bodyLines.findIndex((line) => line.trim().startsWith(linePrefix));

  if (targetIndex >= 0) {
    bodyLines[targetIndex] = nextLine;
  } else {
    bodyLines.unshift(nextLine);
    if (fallbackLine && !bodyLines.some((line) => line.trim() === fallbackLine)) {
      bodyLines.push(fallbackLine);
    }
  }

  return upsertSection(content, title, bodyLines.join("\n"));
}

function getSection(content, title) {
  const normalized = normalizeText(content);
  if (!normalized) {
    return null;
  }

  const lines = normalized.split("\n");
  const headingLine = `## ${title}`;
  const startIndex = lines.findIndex((line) => line.trim() === headingLine);

  if (startIndex === -1) {
    return null;
  }

  let endIndex = startIndex + 1;
  while (endIndex < lines.length && !lines[endIndex].startsWith("## ")) {
    endIndex += 1;
  }

  return {
    before: lines.slice(0, startIndex).join("\n").trimEnd(),
    body: lines.slice(startIndex + 1, endIndex).join("\n").trim(),
    after: lines.slice(endIndex).join("\n").trimStart(),
  };
}

function joinBlocks(...blocks) {
  return blocks.filter(Boolean).join("\n\n");
}

function renderManagedSection(title, body, blockId) {
  return [
    managedBlockStart(blockId),
    `## ${title}`,
    "",
    normalizeText(body),
    managedBlockEnd(blockId),
  ].join("\n");
}

function renderManagedLines(lines, blockId) {
  return [managedBlockStart(blockId), ...lines, managedBlockEnd(blockId)].join("\n");
}

function upsertVerificationManualProofAnchorSection(content, records, rawBlockBody = "") {
  const managedLines =
    rawBlockBody && !records.length
      ? String(rawBlockBody).split("\n")
      : renderManagedManualProofAnchorLines(records);

  return ensureTrailingNewline(
    upsertManagedLinesInSection(content, "Evidence", MANAGED_BLOCKS.verificationManualProofAnchors, managedLines, {
      insertBeforePattern: /(?:^|\n)## Evidence /m,
    })
  );
}

function removeVerificationManualProofAnchorSection(content) {
  return removeManagedBlockInSection(content, "Evidence", MANAGED_BLOCKS.verificationManualProofAnchors);
}

function stripLegacyManagedLines(content, options = {}) {
  const stripLinePrefixes = Array.isArray(options.stripLinePrefixes) ? options.stripLinePrefixes : [];
  const stripExactLines = new Set(Array.isArray(options.stripExactLines) ? options.stripExactLines : []);

  return String(content || "")
    .split("\n")
    .filter((line) => {
      const trimmed = line.trim();
      if (!trimmed) {
        return true;
      }

      if (stripExactLines.has(trimmed)) {
        return false;
      }

      return !stripLinePrefixes.some((prefix) => trimmed.startsWith(prefix));
    })
    .join("\n")
    .trim();
}

function replaceManagedBlock(content, blockId, replacement) {
  const normalized = normalizeText(content);
  if (!normalized) {
    return null;
  }

  const pattern = new RegExp(
    `${escapeRegex(managedBlockStart(blockId))}[\\s\\S]*?${escapeRegex(managedBlockEnd(blockId))}`,
    "m"
  );

  if (!pattern.test(normalized)) {
    return null;
  }

  return normalized.replace(pattern, replacement);
}

function managedBlockStart(blockId) {
  return `<!-- agent-workflow:managed:${blockId}:start -->`;
}

function managedBlockEnd(blockId) {
  return `<!-- agent-workflow:managed:${blockId}:end -->`;
}

function normalizeText(content) {
  return String(content || "").replace(/\r\n/g, "\n").trim();
}

function ensureTrailingNewline(content) {
  return `${String(content || "").replace(/\r\n/g, "\n").replace(/\s+$/, "")}\n`;
}

function isStrongManualProofItem(item) {
  return Boolean(item && item.paths.length > 0 && (item.checks.length > 0 || item.artifacts.length > 0));
}

function readFileWithFallback(filePath) {
  return fileExists(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

function escapeRegex(value) {
  return String(value || "").replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

module.exports = {
  EDITABLE_TASK_DOCUMENTS,
  refreshManualProofAnchors,
  renderCheckpointSkeleton,
  renderContextMarkdown,
  renderTaskMarkdown,
  renderVerificationMarkdown,
  saveTaskDocument,
  syncManagedTaskDocs,
};
