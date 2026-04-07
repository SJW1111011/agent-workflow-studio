const assert = require("node:assert/strict");

const { createDashboardExecutionBridge } = require("../src/lib/dashboard-execution");
const { badRequest, getHttpStatusCode, notFound } = require("../src/lib/http-errors");
const { planRunExecution } = require("../src/lib/run-executor");
const { saveTaskDocument } = require("../src/lib/task-documents");
const { getRunLog, recordRun, updateTaskMeta } = require("../src/lib/task-service");
const { createTaskWorkspace } = require("./test-helpers");

function captureError(action) {
  try {
    action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected action to throw.");
}

async function captureErrorAsync(action) {
  try {
    await action();
  } catch (error) {
    return error;
  }

  throw new Error("Expected action to reject.");
}

const tests = [
  {
    name: "http error helpers keep explicit status codes and fallback defaults",
    run() {
      const explicit = badRequest("Bad input.", "bad_input");
      const missing = notFound("Missing item.", "missing_item");

      assert.equal(explicit.statusCode, 400);
      assert.equal(explicit.code, "bad_input");
      assert.equal(getHttpStatusCode(explicit), 400);
      assert.equal(missing.statusCode, 404);
      assert.equal(getHttpStatusCode(missing), 404);
      assert.equal(getHttpStatusCode(new Error("boom")), 500);
      assert.equal(getHttpStatusCode({ statusCode: 123 }), 500);
    },
  },
  {
    name: "task metadata and document mutations expose explicit 404 and 400 errors",
    run() {
      const { workspaceRoot } = createTaskWorkspace("http-errors-mutation");

      const missingTaskError = captureError(() => updateTaskMeta(workspaceRoot, "T-404", { title: "Missing" }));
      assert.equal(missingTaskError.statusCode, 404);
      assert.match(missingTaskError.message, /does not exist yet/);

      const unsupportedDocumentError = captureError(() =>
        saveTaskDocument(workspaceRoot, "T-001", "checkpoint.md", "# should fail\n")
      );
      assert.equal(unsupportedDocumentError.statusCode, 400);
      assert.match(unsupportedDocumentError.message, /Unsupported task document/);
    },
  },
  {
    name: "run log access exposes explicit 400 and 404 errors",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("http-errors-runs");
      const run = recordRun(workspaceRoot, taskId, "Recorded for error typing.", "draft", "manual");

      const missingRunError = captureError(() => getRunLog(workspaceRoot, taskId, "run-missing", "stdout"));
      assert.equal(missingRunError.statusCode, 404);
      assert.match(missingRunError.message, /does not exist for task/);

      const unsupportedStreamError = captureError(() => getRunLog(workspaceRoot, taskId, run.id, "sideways"));
      assert.equal(unsupportedStreamError.statusCode, 400);
      assert.match(unsupportedStreamError.message, /Unsupported log stream/);
    },
  },
  {
    name: "dashboard execution bridge exposes typed status codes for missing logs and cancel conflicts",
    async run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("http-errors-dashboard");
      const executionBridge = createDashboardExecutionBridge(workspaceRoot);

      const unsupportedStreamError = captureError(() => executionBridge.getTaskExecutionLog(taskId, "sideways"));
      assert.equal(unsupportedStreamError.statusCode, 400);
      assert.match(unsupportedStreamError.message, /Unsupported execution log stream/);

      const cancelConflictError = await captureErrorAsync(() => executionBridge.cancelTaskExecution(taskId));
      assert.equal(cancelConflictError.statusCode, 409);
      assert.match(cancelConflictError.message, /no active dashboard execution/);

      const missingTaskError = captureError(() => executionBridge.getTaskExecutionLog("T-404", "stdout"));
      assert.equal(missingTaskError.statusCode, 404);
      assert.match(missingTaskError.message, /does not exist yet/);
    },
  },
  {
    name: "run planning exposes exec-state conflicts with explicit status codes",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("http-errors-plan");

      const planError = captureError(() => planRunExecution(workspaceRoot, taskId, "codex"));
      assert.equal(planError.statusCode, 409);
      assert.match(planError.message, /manual handoff only/);
    },
  },
];

module.exports = {
  name: "http-errors",
  tests,
};
