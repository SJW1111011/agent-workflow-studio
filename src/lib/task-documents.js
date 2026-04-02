const fs = require("fs");
const { fileExists, readJson, writeFile, writeJson } = require("./fs-utils");
const { getRecipe } = require("./recipes");
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

function renderTaskMarkdown(taskMeta, recipe) {
  return ensureTrailingNewline(`# ${taskMeta.id} - ${taskMeta.title}

## Goal

State the user outcome in one paragraph.

## Recipe

- Recipe ID: ${taskMeta.recipeId}
- Recipe summary: ${recipe ? recipe.summary : "Unknown recipe"}

## Scope

- In scope:
- Out of scope:

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

## Recipe guidance

- Recipe ID: ${taskMeta.recipeId}
- Recommended for: ${recipe && Array.isArray(recipe.recommendedFor) ? recipe.recommendedFor.join(", ") : "N/A"}

## Facts

- 

## Open questions

- 

## Constraints

- Priority: ${taskMeta.priority}
- Keep the workflow docs current.
`);
}

function renderVerificationMarkdown(taskMeta) {
  return ensureTrailingNewline(`# ${taskMeta.id} Verification

## Planned checks

- automated:
- manual:

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
    throw new Error(`Task ${taskId} does not exist yet.`);
  }

  const documentConfig = EDITABLE_TASK_DOCUMENTS[documentName];
  if (!documentConfig) {
    throw new Error(`Unsupported task document: ${documentName}`);
  }

  const taskMeta = readJson(files.meta, {});
  const recipe = getRecipe(workspaceRoot, taskMeta.recipeId);
  const normalizedContent = normalizeEditableDocument(documentName, taskMeta, recipe, content);

  writeFile(files[documentConfig.fileKey], normalizedContent);
  taskMeta.updatedAt = new Date().toISOString();
  writeJson(files.meta, taskMeta);

  return {
    documentName,
    content: normalizedContent,
    updatedAt: taskMeta.updatedAt,
  };
}

function normalizeEditableDocument(documentName, taskMeta, recipe, content) {
  const text = typeof content === "string" ? content : "";

  if (documentName === "task.md") {
    return normalizeTaskMarkdown(taskMeta, recipe, text);
  }

  if (documentName === "context.md") {
    return normalizeContextMarkdown(taskMeta, recipe, text);
  }

  if (documentName === "verification.md") {
    return normalizeVerificationMarkdown(taskMeta, text);
  }

  throw new Error(`Unsupported task document: ${documentName}`);
}

function normalizeTaskMarkdown(taskMeta, recipe, content) {
  let nextContent = ensureHeading(content, `# ${taskMeta.id} - ${taskMeta.title}`);
  nextContent = upsertSection(
    nextContent,
    "Recipe",
    `- Recipe ID: ${taskMeta.recipeId}\n- Recipe summary: ${recipe ? recipe.summary : "Unknown recipe"}`
  );
  return ensureTrailingNewline(nextContent);
}

function normalizeContextMarkdown(taskMeta, recipe, content) {
  let nextContent = ensureHeading(content, `# ${taskMeta.id} Context`);
  nextContent = upsertSection(
    nextContent,
    "Recipe guidance",
    `- Recipe ID: ${taskMeta.recipeId}\n- Recommended for: ${
      recipe && Array.isArray(recipe.recommendedFor) ? recipe.recommendedFor.join(", ") : "N/A"
    }`
  );
  nextContent = upsertLineInSection(
    nextContent,
    "Constraints",
    "- Priority:",
    `- Priority: ${taskMeta.priority}`,
    "- Keep the workflow docs current."
  );
  return ensureTrailingNewline(nextContent);
}

function normalizeVerificationMarkdown(taskMeta, content) {
  return ensureTrailingNewline(ensureHeading(content, `# ${taskMeta.id} Verification`));
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

function upsertSection(content, title, body) {
  const section = getSection(content, title);
  const renderedSection = `## ${title}\n\n${normalizeText(body)}`;

  if (!section) {
    const normalized = normalizeText(content);
    return normalized ? `${normalized}\n\n${renderedSection}` : renderedSection;
  }

  return joinBlocks(section.before, renderedSection, section.after);
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

function normalizeText(content) {
  return String(content || "").replace(/\r\n/g, "\n").trim();
}

function ensureTrailingNewline(content) {
  return `${String(content || "").replace(/\r\n/g, "\n").replace(/\s+$/, "")}\n`;
}

function readFileWithFallback(filePath) {
  return fileExists(filePath) ? fs.readFileSync(filePath, "utf8") : "";
}

module.exports = {
  EDITABLE_TASK_DOCUMENTS,
  renderCheckpointSkeleton,
  renderContextMarkdown,
  renderTaskMarkdown,
  renderVerificationMarkdown,
  saveTaskDocument,
  syncManagedTaskDocs,
};
