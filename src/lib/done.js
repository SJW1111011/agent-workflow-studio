const { buildCheckpoint } = require("./checkpoint");
const { recordRun, updateTaskMeta } = require("./task-service");
const { appendUndoEntry, buildUndoFileList, captureTaskRestoreSnapshots } = require("./undo-log");

function recordDone(workspaceRoot, taskId, summary, options = {}) {
  const restoreSnapshots = captureTaskRestoreSnapshots(workspaceRoot, taskId);
  const run = recordRun(
    workspaceRoot,
    taskId,
    summary,
    options.status,
    options.agent || "manual",
    {
      scopeProofPaths: options.scopeProofPaths,
      verificationChecks: options.verificationChecks,
      verificationArtifacts: options.verificationArtifacts,
      inferScopeProofPaths: options.inferScopeProofPaths !== false,
      inferTestStatus: options.inferTestStatus === true,
      skipInferTest: options.skipInferTest === true,
    },
    {
      undoType: null,
    }
  );

  const task = shouldMarkTaskDone(options.complete)
    ? updateTaskMeta(workspaceRoot, taskId, { status: "done" })
    : null;
  const checkpoint = buildCheckpoint(workspaceRoot, taskId);
  const runFile = `.agent-workflow/tasks/${taskId}/runs/${run.id}.json`;
  const undoRestoreSnapshots = restoreSnapshots.concat([
    {
      path: runFile,
      kind: "file",
      existed: false,
    },
  ]);

  appendUndoEntry(workspaceRoot, {
    type: "done",
    taskId,
    files: buildUndoFileList(undoRestoreSnapshots),
    metadata: {
      restore: undoRestoreSnapshots,
      runFile,
      runId: run.id,
    },
  });

  return {
    run,
    checkpoint,
    task,
  };
}

function shouldMarkTaskDone(value) {
  if (value === true) {
    return true;
  }

  if (typeof value !== "string") {
    return false;
  }

  return ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

module.exports = {
  recordDone,
};
