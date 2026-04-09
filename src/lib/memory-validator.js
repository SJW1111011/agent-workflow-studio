const fs = require("fs");
const path = require("path");
const { MEMORY_DOC_ORDER } = require("./memory-bootstrap");
const { hasMemoryPlaceholder } = require("./memory-placeholders");
const { readText } = require("./fs-utils");
const { memoryRoot } = require("./workspace");

const BARE_LIST_LINE_PATTERN = /^([-*]|\d+\.)\s*$/;
const GENERIC_LINE_PATTERNS = [
  /^[-*]\s+placeholder APIs\s*$/i,
  /^[-*]\s+fake verification\s*$/i,
  /^[-*]\s+hidden production toggles\s*$/i,
];
const LABEL_ONLY_LINE_PATTERN = /^[-*]\s+[^:]+:\s*$/;
const OPTIONAL_EMPTY_SECTION_TITLES = new Set(["open questions"]);
const QUESTION_ONLY_LINE_PATTERN = /^[-*]\s+.+[?？]\s*$/;
const SECTION_HEADING_PATTERN = /^##\s+(.+?)\s*$/;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /(?:^|[\s("'`])([A-Za-z]:[\\/][^\s"'`)]+)/g;
const WINDOWS_UNC_PATH_PATTERN = /(?:^|[\s("'`])(\\\\[^\s"'`)]+(?:\\[^\s"'`)]+)+)/g;
const POSIX_MACHINE_PATH_PATTERN = /(?:^|[\s("'`])(\/(?:Users|home|var|tmp|private|Volumes|opt|root|srv|mnt)(?:\/[^\s"'`)]+)+)/g;

function validateMemoryDocs(workspaceRoot, options = {}) {
  const expectedDocNames = Array.isArray(options.expectedDocNames) && options.expectedDocNames.length > 0
    ? options.expectedDocNames.slice()
    : MEMORY_DOC_ORDER.slice();
  const docs = loadMemoryValidationDocs(workspaceRoot, expectedDocNames);
  const knownDocNames = new Set(docs.map((doc) => doc.name));
  const issues = [];

  expectedDocNames.forEach((name) => {
    if (knownDocNames.has(name)) {
      return;
    }

    issues.push(
      issue(
        "error",
        "memory.doc.missing",
        `Missing required memory doc ${relativeMemoryPath(name)}.`,
        relativeMemoryPath(name)
      )
    );
  });

  docs.forEach((doc) => {
    if (doc.placeholder) {
      issues.push(
        issue(
          "error",
          "memory.placeholder",
          `Memory doc still contains scaffold placeholders: ${doc.relativePath}`,
          doc.relativePath
        )
      );
    } else if (doc.substantiveSectionCount === 0) {
      issues.push(
        issue(
          "error",
          "memory.doc.empty",
          `Memory doc still lacks grounded section content: ${doc.relativePath}`,
          doc.relativePath
        )
      );
    } else if (doc.emptySectionTitles.length > 0) {
      issues.push(
        issue(
          "warning",
          "memory.section.incomplete",
          `Memory doc still has empty sections: ${doc.emptySectionTitles.join(", ")}`,
          doc.relativePath
        )
      );
    }

    if (doc.absolutePathMatches.length > 0) {
      issues.push(
        issue(
          "warning",
          "memory.absolutePath",
          `Memory doc contains machine-specific absolute paths: ${doc.absolutePathMatches.join(", ")}`,
          doc.relativePath
        )
      );
    }
  });

  const errorCount = issues.filter((item) => item.level === "error").length;
  const warningCount = issues.filter((item) => item.level === "warning").length;

  return {
    ok: errorCount === 0,
    clean: issues.length === 0,
    issueCount: issues.length,
    errorCount,
    warningCount,
    docCount: docs.length,
    expectedDocCount: expectedDocNames.length,
    placeholderDocCount: docs.filter((doc) => doc.placeholder).length,
    docs,
    issues,
  };
}

function loadMemoryValidationDocs(workspaceRoot, expectedDocNames = MEMORY_DOC_ORDER) {
  const root = memoryRoot(workspaceRoot);
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => inspectMemoryDoc(path.join(root, entry.name), workspaceRoot))
    .sort((left, right) => compareMemoryDocNames(left.name, right.name, expectedDocNames));
}

function inspectMemoryDoc(absolutePath, workspaceRoot) {
  const content = readText(absolutePath, "");
  const normalized = normalizeMarkdown(content);
  const sections = parseSections(normalized);
  const emptySectionTitles = sections
    .filter((section) => !sectionHasSubstantiveContent(section) && !isOptionalEmptySection(section.title))
    .map((section) => section.title);

  return {
    name: path.basename(absolutePath),
    relativePath: toWorkspaceRelative(workspaceRoot, absolutePath),
    placeholder: hasMemoryPlaceholder(normalized),
    sectionCount: sections.length,
    substantiveSectionCount: sections.filter(sectionHasSubstantiveContent).length,
    emptySectionTitles,
    absolutePathMatches: findAbsolutePathMatches(normalized),
  };
}

function parseSections(text) {
  const lines = normalizeMarkdown(text).split("\n");
  const sections = [];
  let currentSection = {
    title: "(document body)",
    lines: [],
    explicitHeading: false,
  };

  lines.forEach((line) => {
    const headingMatch = line.match(SECTION_HEADING_PATTERN);
    if (headingMatch) {
      if (currentSection.explicitHeading || sectionHasSubstantiveContent(currentSection)) {
        sections.push(currentSection);
      }

      currentSection = {
        title: headingMatch[1].trim(),
        lines: [],
        explicitHeading: true,
      };
      return;
    }

    currentSection.lines.push(line);
  });

  if (currentSection.explicitHeading || sectionHasSubstantiveContent(currentSection)) {
    sections.push(currentSection);
  }

  return sections;
}

function sectionHasSubstantiveContent(section) {
  return section.lines.some(isSubstantiveLine);
}

function isSubstantiveLine(line) {
  const trimmed = String(line || "").trim();
  if (!trimmed || trimmed.startsWith("#")) {
    return false;
  }

  if (BARE_LIST_LINE_PATTERN.test(trimmed) || LABEL_ONLY_LINE_PATTERN.test(trimmed) || QUESTION_ONLY_LINE_PATTERN.test(trimmed)) {
    return false;
  }

  return !GENERIC_LINE_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function isOptionalEmptySection(title) {
  return OPTIONAL_EMPTY_SECTION_TITLES.has(String(title || "").trim().toLowerCase());
}

function findAbsolutePathMatches(text) {
  const matches = [];
  collectPatternMatches(matches, WINDOWS_ABSOLUTE_PATH_PATTERN, text);
  collectPatternMatches(matches, WINDOWS_UNC_PATH_PATTERN, text);
  collectPatternMatches(matches, POSIX_MACHINE_PATH_PATTERN, text);
  return matches;
}

function collectPatternMatches(target, pattern, text) {
  pattern.lastIndex = 0;
  let match = pattern.exec(text);

  while (match) {
    const value = String(match[1] || "").trim();
    if (value && !target.includes(value)) {
      target.push(value);
    }
    match = pattern.exec(text);
  }
}

function compareMemoryDocNames(left, right, expectedDocNames) {
  const leftIndex = expectedDocNames.indexOf(left);
  const rightIndex = expectedDocNames.indexOf(right);

  if (leftIndex !== -1 || rightIndex !== -1) {
    return normalizeOrderIndex(leftIndex) - normalizeOrderIndex(rightIndex) || left.localeCompare(right);
  }

  return left.localeCompare(right);
}

function normalizeOrderIndex(index) {
  return index === -1 ? Number.MAX_SAFE_INTEGER : index;
}

function formatMemoryValidationSummary(report) {
  const summaryLine = `ok=${report.ok} errors=${report.errorCount} warnings=${report.warningCount} docs=${report.docCount} placeholderDocs=${report.placeholderDocCount}`;
  const statusLine = report.ok
    ? report.warningCount > 0
      ? "Memory docs are reusable, but some warnings should be reviewed."
      : "Memory docs look grounded and reusable."
    : "Memory docs still need cleanup before they become durable project memory.";

  return [summaryLine, statusLine].join("\n");
}

function normalizeMarkdown(text) {
  return String(text || "").replace(/\r\n/g, "\n");
}

function relativeMemoryPath(fileName) {
  return path.join(".agent-workflow", "memory", fileName).replace(/\\/g, "/");
}

function toWorkspaceRelative(workspaceRoot, absolutePath) {
  return path.relative(workspaceRoot, absolutePath).replace(/\\/g, "/");
}

function issue(level, code, message, target) {
  return {
    level,
    code,
    message,
    target,
  };
}

module.exports = {
  formatMemoryValidationSummary,
  loadMemoryValidationDocs,
  validateMemoryDocs,
};
