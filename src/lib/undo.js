const fs = require("fs");
const path = require("path");
const { conflict } = require("./http-errors");
const { listRuns } = require("./task-service");
const { removeLastUndoEntry, peekUndoEntry, resolveWorkflowPath, SNAPSHOT_KIND_DIRECTORY } = require("./undo-log");

function undoLastOperation(workspaceRoot) {
  const entry = peekUndoEntry(workspaceRoot);
  if (!entry) {
    return {
      undone: false,
      message: "Nothing to undo",
      files: [],
      target: null,
    };
  }

  const target = describeUndoTarget(entry);
  if (entry.type === "quick") {
    undoQuickEntry(workspaceRoot, entry);
  } else if (entry.type === "run:add" || entry.type === "done" || entry.type === "checkpoint") {
    restoreUndoEntry(workspaceRoot, entry);
  } else {
    throw new Error(`Unsupported undo operation: ${entry.type}`);
  }

  removeLastUndoEntry(workspaceRoot);

  return {
    undone: true,
    entry,
    files: Array.isArray(entry.files) ? entry.files.slice() : [],
    target,
    message: `Undid ${target}.`,
  };
}

function formatUndoSummary(result) {
  if (!result || result.undone !== true) {
    return result && typeof result.message === "string" ? result.message : "Nothing to undo";
  }

  const lines = [`Undo target: ${result.target}`];
  if (Array.isArray(result.files) && result.files.length > 0) {
    lines.push("Affected workflow paths:");
    result.files.forEach((filePath) => {
      lines.push(`- ${filePath}`);
    });
  }
  lines.push(result.message);
  return lines.join("\n");
}

function describeUndoTarget(entry) {
  const taskSuffix = entry && entry.taskId ? ` for ${entry.taskId}` : "";

  if (!entry || !entry.type) {
    return "the latest workflow operation";
  }

  if (entry.type === "run:add") {
    return `run:add${taskSuffix}`;
  }

  return `${entry.type}${taskSuffix}`;
}

function undoQuickEntry(workspaceRoot, entry) {
  const taskId = entry && entry.taskId ? entry.taskId : "";
  const taskRoot = entry && entry.metadata && typeof entry.metadata.taskRoot === "string"
    ? entry.metadata.taskRoot
    : taskId
      ? `.agent-workflow/tasks/${taskId}`
      : "";

  if (!taskRoot) {
    throw new Error("Quick undo metadata is missing the task root.");
  }

  const resolvedTaskRoot = resolveWorkflowPath(workspaceRoot, taskRoot);
  if (!fs.existsSync(resolvedTaskRoot)) {
    return;
  }

  if (taskId && listRuns(workspaceRoot, taskId).length > 0) {
    throw conflict(
      `Refusing to undo quick for ${taskId} because the task already has recorded runs.`,
      "undo_quick_has_runs"
    );
  }

  fs.rmSync(resolvedTaskRoot, { recursive: true, force: true });
}

function restoreUndoEntry(workspaceRoot, entry) {
  const snapshots = Array.isArray(entry && entry.metadata && entry.metadata.restore) ? entry.metadata.restore : [];
  if (snapshots.length === 0) {
    throw new Error(`Undo metadata is missing restore snapshots for ${entry.type}.`);
  }

  const directorySnapshots = snapshots.filter((snapshot) => snapshot.kind === SNAPSHOT_KIND_DIRECTORY);
  const fileSnapshots = snapshots.filter((snapshot) => snapshot.kind !== SNAPSHOT_KIND_DIRECTORY);

  directorySnapshots
    .filter((snapshot) => snapshot.existed === true)
    .sort((left, right) => left.path.localeCompare(right.path))
    .forEach((snapshot) => {
      fs.mkdirSync(resolveWorkflowPath(workspaceRoot, snapshot.path), { recursive: true });
    });

  fileSnapshots
    .filter((snapshot) => snapshot.existed === true)
    .forEach((snapshot) => {
      const resolvedPath = resolveWorkflowPath(workspaceRoot, snapshot.path);
      fs.mkdirSync(path.dirname(resolvedPath), { recursive: true });
      fs.writeFileSync(resolvedPath, typeof snapshot.content === "string" ? snapshot.content : "", "utf8");
    });

  fileSnapshots
    .filter((snapshot) => snapshot.existed !== true)
    .forEach((snapshot) => {
      const resolvedPath = resolveWorkflowPath(workspaceRoot, snapshot.path);
      if (fs.existsSync(resolvedPath)) {
        fs.rmSync(resolvedPath, { recursive: true, force: true });
      }
    });

  directorySnapshots
    .filter((snapshot) => snapshot.existed !== true)
    .sort((left, right) => right.path.localeCompare(left.path))
    .forEach((snapshot) => {
      const resolvedPath = resolveWorkflowPath(workspaceRoot, snapshot.path);
      if (fs.existsSync(resolvedPath)) {
        fs.rmSync(resolvedPath, { recursive: true, force: true });
      }
    });
}

module.exports = {
  formatUndoSummary,
  undoLastOperation,
};
