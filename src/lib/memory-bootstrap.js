const fs = require("fs");
const path = require("path");
const { readText, writeFile } = require("./fs-utils");
const { hasMemoryPlaceholder } = require("./memory-placeholders");
const { scanWorkspace } = require("./scanner");
const { ensureWorkflowScaffold, handoffsRoot, memoryRoot, projectConfigPath, projectProfileMarkdownPath } = require("./workspace");

const MEMORY_DOC_ORDER = ["product.md", "architecture.md", "domain-rules.md", "runbook.md"];

function generateMemoryBootstrapPrompt(workspaceRoot, options = {}) {
  ensureWorkflowScaffold(workspaceRoot);

  const profile = scanWorkspace(workspaceRoot);
  const memoryDocs = loadMemoryBootstrapDocs(workspaceRoot);
  const outputPath = isNonEmptyString(options.outputPath)
    ? path.resolve(workspaceRoot, String(options.outputPath).trim())
    : path.join(handoffsRoot(workspaceRoot), "memory-bootstrap.md");
  const prompt = renderMemoryBootstrapPrompt({
    workspaceRoot,
    profile,
    memoryDocs,
  });

  writeFile(outputPath, prompt);

  return {
    outputPath,
    profile,
    memoryDocs,
    placeholderDocCount: memoryDocs.filter((doc) => doc.placeholder).length,
    prompt,
  };
}

function loadMemoryBootstrapDocs(workspaceRoot) {
  const root = memoryRoot(workspaceRoot);
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => {
      const absolutePath = path.join(root, entry.name);
      const content = readText(absolutePath, "");
      return {
        name: entry.name,
        relativePath: path.join(".agent-workflow", "memory", entry.name).replace(/\\/g, "/"),
        placeholder: hasMemoryPlaceholder(content),
        excerpt: excerptMarkdown(content),
      };
    })
    .sort(compareMemoryDocs);
}

function renderMemoryBootstrapPrompt({ workspaceRoot, profile, memoryDocs }) {
  const projectConfigRelative = toWorkspaceRelative(workspaceRoot, projectConfigPath(workspaceRoot));
  const projectProfileRelative = toWorkspaceRelative(workspaceRoot, projectProfileMarkdownPath(workspaceRoot));
  const memoryDocLines = memoryDocs.map((doc) => `- ${doc.relativePath}${doc.placeholder ? " (still scaffold-like)" : ""}`).join("\n");
  const recommendationLines = (profile.recommendations || []).map((item) => `- ${item}`).join("\n") || "- None";
  const directoryLines = (profile.topLevelDirectories || []).map((item) => `- ${item}`).join("\n") || "- None";
  const docLines = (profile.docs || []).map((item) => `- ${item}`).join("\n") || "- None";
  const scriptLines =
    Object.entries(profile.scripts || {})
      .map(([name, command]) => `- \`${name}\`: \`${command}\``)
      .join("\n") || "- None";
  const memorySections = memoryDocs
    .map((doc) => {
      return `## ${doc.relativePath}

- Placeholder-like: ${doc.placeholder ? "yes" : "no"}

\`\`\`md
${doc.excerpt}
\`\`\``;
    })
    .join("\n\n");

  return `# Memory Bootstrap Prompt

## Mission

Bootstrap the repository memory docs so future agent runs start from grounded project context instead of scaffold placeholders.

## Read first

- ${projectConfigRelative}
- ${projectProfileRelative}
${memoryDocLines}

## What to do

1. Inspect the repository shape, docs, and scripts described below.
2. Update the memory docs in place under \`.agent-workflow/memory/\`.
3. Replace scaffold placeholders with repo-specific notes.
4. Preserve anything that is already true and useful.
5. If something is unknown, write it under open questions instead of inventing facts.

## Hard rules

- Stay local-first and file-based.
- Do not add absolute machine paths.
- Do not fake verification, production state, or business context.
- Keep notes concise, durable, and handoff-friendly.
- Prefer explicit unknowns over confident guesses.

## Repository profile snapshot

### Top-level directories

${directoryLines}

### Docs

${docLines}

### Scripts

${scriptLines}

### Scanner recommendations

${recommendationLines}

## Memory docs to update

${memoryDocLines}

## Current memory excerpts

${memorySections}

## Expected output

- updated \`product.md\`, \`architecture.md\`, \`domain-rules.md\`, and \`runbook.md\`
- repo-grounded constraints and invariants
- explicit open questions where the repository does not provide enough evidence
- no fake certainty
`;
}

function formatMemoryBootstrapSummary(result, workspaceRoot) {
  const relativeOutputPath = toWorkspaceRelative(workspaceRoot, result.outputPath);
  return [
    `Memory bootstrap prompt ready: ${relativeOutputPath}`,
    `- Placeholder-like memory docs: ${result.placeholderDocCount}`,
    `- Project profile refreshed: ${toWorkspaceRelative(workspaceRoot, projectProfileMarkdownPath(workspaceRoot))}`,
    "Next steps:",
    `1. Give ${relativeOutputPath} to Codex or Claude Code.`,
    "2. Review the updated memory docs under .agent-workflow/memory/.",
    "3. Re-run memory:bootstrap after major repo changes or before a new long-lived workflow.",
  ].join("\n");
}

function excerptMarkdown(text, maxLength = 1000) {
  const normalized = String(text || "").replace(/\r\n/g, "\n").trim();
  if (!normalized) {
    return "# Empty\n";
  }

  return normalized.length <= maxLength ? normalized : `${normalized.slice(0, maxLength)}...`;
}

function compareMemoryDocs(left, right) {
  const leftIndex = MEMORY_DOC_ORDER.indexOf(left.name);
  const rightIndex = MEMORY_DOC_ORDER.indexOf(right.name);

  if (leftIndex !== -1 || rightIndex !== -1) {
    return normalizeOrderIndex(leftIndex) - normalizeOrderIndex(rightIndex) || left.name.localeCompare(right.name);
  }

  return left.name.localeCompare(right.name);
}

function normalizeOrderIndex(index) {
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function toWorkspaceRelative(workspaceRoot, absolutePath) {
  return path.relative(workspaceRoot, absolutePath).replace(/\\/g, "/");
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

module.exports = {
  MEMORY_DOC_ORDER,
  formatMemoryBootstrapSummary,
  generateMemoryBootstrapPrompt,
  loadMemoryBootstrapDocs,
};
