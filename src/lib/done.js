const { buildCheckpoint } = require("./checkpoint");
const { recordRun, updateTaskMeta } = require("./task-service");

function recordDone(workspaceRoot, taskId, summary, options = {}) {
  const run = recordRun(
    workspaceRoot,
    taskId,
    summary,
    options.status || "draft",
    options.agent || "manual",
    {
      scopeProofPaths: options.scopeProofPaths,
      verificationChecks: options.verificationChecks,
      verificationArtifacts: options.verificationArtifacts,
    }
  );

  const task = shouldMarkTaskDone(options.complete)
    ? updateTaskMeta(workspaceRoot, taskId, { status: "done" })
    : null;
  const checkpoint = buildCheckpoint(workspaceRoot, taskId);

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
