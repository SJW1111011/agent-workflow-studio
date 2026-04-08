const fs = require("fs");
const path = require("path");
const { readJson, writeFile, writeJson } = require("./fs-utils");
const {
  ensureWorkflowScaffold,
  projectProfileMarkdownPath,
  projectProfilePath,
} = require("./workspace");

const KNOWN_DOCS = ["README.md", "AGENTS.md", "CLAUDE.md"];
const KNOWN_LOCKFILES = [
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "bun.lockb",
];
const IGNORED_DIRS = new Set([".git", "node_modules", ".next", "dist", "build", "coverage"]);

function scanWorkspace(workspaceRoot) {
  ensureWorkflowScaffold(workspaceRoot);

  const topEntries = fs
    .readdirSync(workspaceRoot, { withFileTypes: true })
    .filter((entry) => !entry.name.startsWith(".agent-workflow"));

  const directories = topEntries
    .filter((entry) => entry.isDirectory() && !IGNORED_DIRS.has(entry.name))
    .map((entry) => entry.name)
    .sort((left, right) => left.localeCompare(right));

  const docs = KNOWN_DOCS.filter((fileName) => fs.existsSync(path.join(workspaceRoot, fileName)));
  const docsDir = path.join(workspaceRoot, "docs");
  const docsInDocsDir = fs.existsSync(docsDir)
    ? fs
        .readdirSync(docsDir, { withFileTypes: true })
        .filter((entry) => entry.isFile())
        .map((entry) => path.join("docs", entry.name).replace(/\\/g, "/"))
        .sort((left, right) => left.localeCompare(right))
    : [];

  const lockfiles = KNOWN_LOCKFILES.filter((fileName) =>
    fs.existsSync(path.join(workspaceRoot, fileName))
  );

  const packageJson = readJson(path.join(workspaceRoot, "package.json"), {});
  const scripts = packageJson && packageJson.scripts ? packageJson.scripts : {};

  const recommendations = [];

  if (!docs.includes("AGENTS.md") && !docs.includes("CLAUDE.md")) {
    recommendations.push("Add an agent-facing root document such as AGENTS.md or CLAUDE.md.");
  }

  if (Object.keys(scripts).length === 0) {
    recommendations.push("No package.json scripts detected. Add verification commands.");
  }

  if (!fs.existsSync(docsDir)) {
    recommendations.push("No docs directory detected. Create stable project memory.");
  }

  const profile = {
    generatedAt: new Date().toISOString(),
    repositoryName: path.basename(workspaceRoot),
    topLevelDirectories: directories,
    docs: [...docs, ...docsInDocsDir],
    packageManagers: lockfiles,
    scripts,
    recommendations,
  };

  writeJson(projectProfilePath(workspaceRoot), profile);
  writeFile(projectProfileMarkdownPath(workspaceRoot), renderProjectProfileMarkdown(profile));

  return profile;
}

function renderProjectProfileMarkdown(profile) {
  const directoryLines = profile.topLevelDirectories.map((dirName) => `- ${dirName}`).join("\n") || "- None";
  const docLines = profile.docs.map((docPath) => `- ${docPath}`).join("\n") || "- None";
  const scriptLines =
    Object.entries(profile.scripts)
      .map(([name, command]) => `- \`${name}\`: \`${command}\``)
      .join("\n") || "- None";
  const recommendationLines =
    profile.recommendations.map((item) => `- ${item}`).join("\n") || "- None";

  return `# Project Profile

Generated at: ${profile.generatedAt}

## Repository

- Name: ${profile.repositoryName}

## Top-level directories

${directoryLines}

## Docs

${docLines}

## Scripts

${scriptLines}

## Recommendations

${recommendationLines}
`;
}

module.exports = {
  scanWorkspace,
};

