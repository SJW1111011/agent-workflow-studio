const fs = require("fs");
const path = require("path");
const { createTask } = require("../src/lib/task-service");
const { ensureWorkflowScaffold, taskFiles } = require("../src/lib/workspace");

const REPO_ROOT = path.resolve(__dirname, "..");
const TEST_TMP_ROOT = path.join(REPO_ROOT, "tmp", "unit-tests");

function createTaskWorkspace(prefix, options = {}) {
  fs.mkdirSync(TEST_TMP_ROOT, { recursive: true });

  const workspaceRoot = fs.mkdtempSync(path.join(TEST_TMP_ROOT, `${prefix}-`));
  const taskId = options.taskId || "T-001";
  const title = options.title || "Test task";

  ensureWorkflowScaffold(workspaceRoot);
  createTask(workspaceRoot, taskId, title, {
    recipe: options.recipe || "feature",
    priority: options.priority || "P1",
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
      modifiedAt,
      modifiedAtMs: new Date(modifiedAt).getTime(),
    };
  });

  return {
    available: true,
    fileCount: files.length,
    files,
  };
}

module.exports = {
  buildRepositoryDiff,
  createTaskWorkspace,
  readJsonFile,
  readTextFile,
  setFileModifiedAt,
  writeJsonFile,
  writeTextFile,
};
