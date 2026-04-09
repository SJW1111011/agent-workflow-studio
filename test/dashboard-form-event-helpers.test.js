const assert = require("node:assert/strict");

const {
  buildManualProofAnchorRefreshMessage,
  buildDocumentSavePayload,
  buildQuickCreatePayload,
  buildRunCreatePayload,
  buildTaskCreatePayload,
  buildTaskUpdatePayload,
  hasUnsavedVerificationEditorChanges,
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
      const quickPayload = buildQuickCreatePayload(
        createFormData({
          taskId: " ",
          title: " Ship onboarding ",
          priority: " P2 ",
          recipeId: " feature ",
          agent: " claude-code ",
        })
      );
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
      assert.deepEqual(quickPayload, {
        taskId: "",
        title: "Ship onboarding",
        priority: "P2",
        recipeId: "feature",
        agent: "claude-code",
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
  {
    name: "manual proof anchor refresh helpers guard unsaved verification edits and summarize outcomes",
    run() {
      assert.equal(
        hasUnsavedVerificationEditorChanges(
          "verification.md",
          "# T-001 Verification\n\n## Proof links\n\n- Files: src/app.js",
          {
            verificationText:
              "# T-001 Verification\n\n## Proof links\n\n- Files: src/app.js\n\n## Evidence\n\n<!-- agent-workflow:managed:verification-manual-proof-anchors:start -->\n### Manual proof anchors\n\n```json\n{\"version\":1,\"manualProofAnchors\":[]}\n```\n<!-- agent-workflow:managed:verification-manual-proof-anchors:end -->\n",
          },
          (documentName, content) =>
            documentName === "verification.md"
              ? "# T-001 Verification\n\n## Proof links\n\n- Files: src/app.js"
              : content
        ),
        false
      );
      assert.equal(
        hasUnsavedVerificationEditorChanges(
          "verification.md",
          "# T-001 Verification\n\n## Proof links\n\n- Files: src/app.js\n- Check: npm test",
          {
            verificationText: "# T-001 Verification\n\n## Proof links\n\n- Files: src/app.js",
          },
          (documentName, content) => content
        ),
        true
      );

      assert.match(
        buildManualProofAnchorRefreshMessage("T-001", {
          changed: true,
          refreshedCount: 2,
          skippedCount: 1,
          strongProofCount: 3,
          clearedCount: 0,
        }),
        /Refreshed 2 manual proof anchor record\(s\)/
      );
      assert.match(
        buildManualProofAnchorRefreshMessage("T-001", {
          changed: true,
          refreshedCount: 0,
          skippedCount: 0,
          strongProofCount: 0,
          clearedCount: 1,
        }),
        /Cleared 1 stale manual proof anchor record\(s\)/
      );
    },
  },
];

module.exports = {
  name: "dashboard-form-event-helpers",
  tests,
};
