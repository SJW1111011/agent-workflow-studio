const fs = require("fs");
const path = require("path");
const { readJson, writeJson } = require("./fs-utils");
const { ensureWorkflowScaffold, taskFiles, workflowRoot } = require("./workspace");

const MAX_UNDO_ENTRIES = 20;
const SNAPSHOT_KIND_DIRECTORY = "directory";
const SNAPSHOT_KIND_FILE = "file";

function undoLogPath(workspaceRoot) {
  return path.join(workspaceRoot, ".agent-workflow", "undo-log.json");
}

function readUndoLog(workspaceRoot) {
  ensureWorkflowScaffold(workspaceRoot);
  const entries = readJson(undoLogPath(workspaceRoot), []);
  return Array.isArray(entries) ? entries.filter(isUndoEntry) : [];
}

function appendUndoEntry(workspaceRoot, entry) {
  const entries = readUndoLog(workspaceRoot);
  const normalizedEntry = normalizeUndoEntry(entry);
  const nextEntries = entries.concat(normalizedEntry).slice(-MAX_UNDO_ENTRIES);
  writeJson(undoLogPath(workspaceRoot), nextEntries);
  return normalizedEntry;
}

function peekUndoEntry(workspaceRoot) {
  const entries = readUndoLog(workspaceRoot);
  return entries.length > 0 ? entries[entries.length - 1] : null;
}

function removeLastUndoEntry(workspaceRoot) {
  const entries = readUndoLog(workspaceRoot);
  if (entries.length === 0) {
    return null;
  }

  const removed = entries.pop();
  writeJson(undoLogPath(workspaceRoot), entries);
  return removed;
}

function capturePathSnapshot(workspaceRoot, relativePath, kind = SNAPSHOT_KIND_FILE) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const resolvedPath = resolveWorkflowPath(workspaceRoot, normalizedPath);
  const exists = fs.existsSync(resolvedPath);

  if (kind === SNAPSHOT_KIND_DIRECTORY) {
    return {
      path: normalizedPath,
      kind,
      existed: exists && fs.statSync(resolvedPath).isDirectory(),
    };
  }

  return {
    path: normalizedPath,
    kind: SNAPSHOT_KIND_FILE,
    existed: exists && fs.statSync(resolvedPath).isFile(),
    content: exists && fs.statSync(resolvedPath).isFile() ? fs.readFileSync(resolvedPath, "utf8") : undefined,
  };
}

function captureTaskRestoreSnapshots(workspaceRoot, taskId, options = {}) {
  const files = taskFiles(workspaceRoot, taskId);
  const relativeFiles = [];

  if (options.includeTaskMeta !== false) {
    relativeFiles.push({ path: toWorkspaceRelativePath(workspaceRoot, files.meta) });
  }

  if (options.includeContext !== false) {
    relativeFiles.push({ path: toWorkspaceRelativePath(workspaceRoot, files.context) });
  }

  if (options.includeVerification !== false) {
    relativeFiles.push({ path: toWorkspaceRelativePath(workspaceRoot, files.verification) });
  }

  if (options.includeCheckpoint !== false) {
    relativeFiles.push({ path: toWorkspaceRelativePath(workspaceRoot, path.join(files.root, "checkpoint.json")) });
    relativeFiles.push({ path: toWorkspaceRelativePath(workspaceRoot, files.checkpoint) });
  }

  if (options.includeRunsDirectory !== false) {
    relativeFiles.push({
      path: toWorkspaceRelativePath(workspaceRoot, files.runs),
      kind: SNAPSHOT_KIND_DIRECTORY,
    });
  }

  return relativeFiles.map((item) => capturePathSnapshot(workspaceRoot, item.path, item.kind));
}

function buildUndoFileList(snapshots = [], extraPaths = []) {
  return Array.from(
    new Set(
      snapshots
        .map((snapshot) => snapshot && snapshot.path)
        .concat(Array.isArray(extraPaths) ? extraPaths : [])
        .map((entry) => normalizeRelativePath(entry))
        .filter(Boolean)
    )
  ).sort((left, right) => left.localeCompare(right));
}

function listWorkflowPaths(workspaceRoot, relativePath) {
  const normalizedPath = normalizeRelativePath(relativePath);
  if (!normalizedPath) {
    return [];
  }

  const resolvedPath = resolveWorkflowPath(workspaceRoot, normalizedPath);
  if (!fs.existsSync(resolvedPath)) {
    return [];
  }

  if (fs.statSync(resolvedPath).isFile()) {
    return [normalizedPath];
  }

  const results = [normalizedPath];
  const entries = fs.readdirSync(resolvedPath, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name));
  entries.forEach((entry) => {
    const childRelativePath = normalizeRelativePath(path.join(normalizedPath, entry.name));
    results.push(...listWorkflowPaths(workspaceRoot, childRelativePath));
  });
  return results;
}

function resolveWorkflowPath(workspaceRoot, relativePath) {
  const normalizedPath = normalizeRelativePath(relativePath);
  const resolvedPath = path.resolve(workspaceRoot, normalizedPath);
  const allowedRoot = path.resolve(workflowRoot(workspaceRoot));
  const allowedPrefix = `${allowedRoot}${path.sep}`;

  if (resolvedPath !== allowedRoot && !resolvedPath.startsWith(allowedPrefix)) {
    throw new Error(`Undo paths must stay inside .agent-workflow: ${normalizedPath}`);
  }

  return resolvedPath;
}

function toWorkspaceRelativePath(workspaceRoot, absolutePath) {
  return normalizeRelativePath(path.relative(workspaceRoot, absolutePath));
}

function normalizeUndoEntry(entry = {}) {
  const restoreSnapshots = Array.isArray(entry.metadata && entry.metadata.restore)
    ? entry.metadata.restore.map(normalizeSnapshot).filter(Boolean)
    : [];
  const metadata = {
    ...(entry.metadata && typeof entry.metadata === "object" ? entry.metadata : {}),
    restore: restoreSnapshots,
  };

  if (typeof metadata.taskRoot === "string") {
    metadata.taskRoot = normalizeRelativePath(metadata.taskRoot);
  }

  if (typeof metadata.runFile === "string") {
    metadata.runFile = normalizeRelativePath(metadata.runFile);
  }

  return {
    type: String(entry.type || "").trim(),
    taskId: isNonEmptyString(entry.taskId) ? String(entry.taskId).trim() : undefined,
    timestamp: isNonEmptyString(entry.timestamp) ? String(entry.timestamp).trim() : new Date().toISOString(),
    files: buildUndoFileList(restoreSnapshots, entry.files),
    metadata,
  };
}

function normalizeSnapshot(snapshot) {
  if (!snapshot || !isNonEmptyString(snapshot.path)) {
    return null;
  }

  const kind = snapshot.kind === SNAPSHOT_KIND_DIRECTORY ? SNAPSHOT_KIND_DIRECTORY : SNAPSHOT_KIND_FILE;
  const normalizedSnapshot = {
    path: normalizeRelativePath(snapshot.path),
    kind,
    existed: snapshot.existed === true,
  };

  if (kind === SNAPSHOT_KIND_FILE && snapshot.existed === true) {
    normalizedSnapshot.content = typeof snapshot.content === "string" ? snapshot.content : "";
  }

  return normalizedSnapshot;
}

function normalizeRelativePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .replace(/^\.\/+/, "")
    .trim();
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isUndoEntry(entry) {
  return Boolean(entry && typeof entry === "object" && isNonEmptyString(entry.type));
}

module.exports = {
  MAX_UNDO_ENTRIES,
  SNAPSHOT_KIND_DIRECTORY,
  SNAPSHOT_KIND_FILE,
  appendUndoEntry,
  buildUndoFileList,
  capturePathSnapshot,
  captureTaskRestoreSnapshots,
  listWorkflowPaths,
  peekUndoEntry,
  readUndoLog,
  removeLastUndoEntry,
  resolveWorkflowPath,
  undoLogPath,
};
