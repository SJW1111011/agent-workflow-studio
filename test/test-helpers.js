const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { createTask } = require("../src/lib/task-service");
const { ensureWorkflowScaffold, taskFiles } = require("../src/lib/workspace");

const REPO_ROOT = path.resolve(__dirname, "..");
const TEST_TMP_ROOT = path.join(REPO_ROOT, "tmp", "unit-tests");
const TEMP_DIRECTORIES = new Set();

afterEach(() => {
  TEMP_DIRECTORIES.forEach((dirPath) => {
    fs.rmSync(dirPath, { recursive: true, force: true });
  });
  TEMP_DIRECTORIES.clear();
});

function trackTempDirectory(dirPath) {
  TEMP_DIRECTORIES.add(dirPath);
  return dirPath;
}

function createTaskWorkspace(prefix, options = {}) {
  fs.mkdirSync(TEST_TMP_ROOT, { recursive: true });

  const workspaceRoot = trackTempDirectory(fs.mkdtempSync(path.join(TEST_TMP_ROOT, `${prefix}-`)));
  const taskId = options.taskId || "T-001";
  const title = options.title || "Test task";

  ensureWorkflowScaffold(workspaceRoot);
  createTask(workspaceRoot, taskId, title, {
    recipe: options.recipe || "feature",
    priority: options.priority || "P1",
    scaffoldMode: options.scaffoldMode || "full",
  });

  return {
    workspaceRoot,
    taskId,
    files: taskFiles(workspaceRoot, taskId),
  };
}

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function writeJsonFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function readTextFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function writeTextFile(filePath, value) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, value, "utf8");
}

function setFileModifiedAt(filePath, isoTimestamp) {
  const timestamp = new Date(isoTimestamp);
  fs.utimesSync(filePath, timestamp, timestamp);
}

function buildRepositoryDiff(entries) {
  const files = (Array.isArray(entries) ? entries : []).map((entry) => {
    const modifiedAt = String(entry.modifiedAt || "");
    return {
      path: entry.path,
      changeType: entry.changeType || "modified",
      gitState: entry.gitState || null,
      previousPath: entry.previousPath || null,
      exists: entry.exists !== undefined ? Boolean(entry.exists) : true,
      modifiedAt,
      modifiedAtMs: new Date(modifiedAt).getTime(),
      contentFingerprint: entry.contentFingerprint || null,
    };
  });

  return {
    mode: "test",
    available: true,
    headCommit: null,
    fileCount: files.length,
    files,
  };
}

function runCommand(command, args, cwd) {
  execFileSync(command, args, {
    cwd,
    stdio: "ignore",
  });
}

function runCommandOutput(command, args, cwd) {
  return execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "ignore"],
  });
}

function initializeGitRepository(workspaceRoot) {
  runCommand("git", ["init"], workspaceRoot);
  runCommand("git", ["config", "user.name", "Unit Test"], workspaceRoot);
  runCommand("git", ["config", "user.email", "unit@example.com"], workspaceRoot);
}

module.exports = {
  buildRepositoryDiff,
  createTaskWorkspace,
  initializeGitRepository,
  readJsonFile,
  readTextFile,
  runCommand,
  runCommandOutput,
  setFileModifiedAt,
  trackTempDirectory,
  writeJsonFile,
  writeTextFile,
};
