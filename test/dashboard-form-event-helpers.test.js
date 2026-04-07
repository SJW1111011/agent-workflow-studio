const assert = require("node:assert/strict");

const {
  buildDocumentSavePayload,
  buildRunCreatePayload,
  buildTaskCreatePayload,
  buildTaskUpdatePayload,
  requireActiveTaskId,
  resolveExecutionRequest,
} = require("../dashboard/form-event-helpers.js");

function createFormData(values) {
  return {
    get(key) {
      return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : "";
    },
  };
}

const tests = [
  {
    name: "build task payload helpers trim values consistently",
    run() {
      const createPayload = buildTaskCreatePayload(
        createFormData({
          taskId: " T-001 ",
          title: " Refactor dashboard ",
          priority: " P1 ",
          recipeId: " feature ",
        })
      );
      const updatePayload = buildTaskUpdatePayload(
        createFormData({
          taskId: " T-002 ",
          title: " Update title ",
          status: " in_progress ",
          priority: " P2 ",
          recipeId: " bugfix ",
        })
      );

      assert.deepEqual(createPayload, {
        taskId: "T-001",
        title: "Refactor dashboard",
        priority: "P1",
        recipeId: "feature",
      });
      assert.deepEqual(updatePayload, {
        taskId: "T-002",
        payload: {
          title: "Update title",
          status: "in_progress",
          priority: "P2",
          recipeId: "bugfix",
        },
      });
    },
  },
  {
    name: "buildRunCreatePayload delegates structured evidence parsing",
    run() {
      let capturedInput = null;
      const request = buildRunCreatePayload(
        createFormData({
          taskId: "T-003",
          agent: "codex",
          status: "passed",
          summary: "Completed",
          scopeProofPaths: "docs/notes.md",
          verificationChecks: "passed | npm test",
          verificationArtifacts: ".agent-workflow/tasks/T-003/checkpoint.md",
        }),
        (input) => {
          capturedInput = input;
          return {
            scopeProofPaths: ["docs/notes.md"],
          };
        }
      );

      assert.equal(request.taskId, "T-003");
      assert.equal(request.payload.agent, "codex");
      assert.equal(request.payload.status, "passed");
      assert.deepEqual(request.payload.scopeProofPaths, ["docs/notes.md"]);
      assert.deepEqual(capturedInput, {
        status: "passed",
        scopeProofPaths: "docs/notes.md",
        verificationChecks: "passed | npm test",
        verificationArtifacts: ".agent-workflow/tasks/T-003/checkpoint.md",
      });
    },
  },
  {
    name: "document save and execution request helpers preserve defaults and validation",
    run() {
      const documentRequest = buildDocumentSavePayload(
        createFormData({
          taskId: "T-004",
          documentName: "",
          content: "# Updated markdown",
        })
      );
      const executionRequest = resolveExecutionRequest({
        activeTaskDetail: {
          meta: {
            id: "T-004",
          },
        },
        agentValue: " claude-code ",
        timeoutValue: "250",
        normalizeOptionalPositiveInteger(value) {
          return Number(String(value).trim());
        },
      });

      assert.deepEqual(documentRequest, {
        taskId: "T-004",
        documentName: "task.md",
        content: "# Updated markdown",
      });
      assert.deepEqual(executionRequest, {
        taskId: "T-004",
        agent: "claude-code",
        timeoutMs: 250,
      });
      assert.equal(requireActiveTaskId({ meta: { id: "T-005" } }, "missing"), "T-005");
      assert.throws(
        () => requireActiveTaskId(null, "Select a task first."),
        /Select a task first\./
      );
    },
  },
];

module.exports = {
  name: "dashboard-form-event-helpers",
  tests,
};
