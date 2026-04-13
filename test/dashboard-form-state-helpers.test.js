const assert = require("node:assert/strict");

const { getEditableDocumentContent } = require("../dashboard/document-helpers.js");
const {
  buildDocumentEditorView,
  buildRunProofNoteView,
  buildTaskFormView,
  getVerificationEditorBaseText,
  normalizeOptionalPositiveInteger,
} = require("../dashboard/form-state-helpers.js");

const tests = [
  {
    name: "buildDocumentEditorView preserves managed/free guidance and verification draft affordance",
    run() {
      const view = buildDocumentEditorView({
        detail: {
          meta: { id: "T-001" },
          verificationText: "# T-001 Verification",
        },
        activeDocumentName: "verification.md",
        editableConfig: {
          detailField: "verificationText",
          note: "Use proof links for explicit coverage.",
          managedSections: ["Heading from task id"],
          freeSections: ["Planned checks", "Proof links"],
        },
        pendingPaths: ["docs/notes.md", "README.md"],
      });

      assert.equal(view.taskId, "T-001");
      assert.equal(view.content, "# T-001 Verification");
      assert.equal(view.draftProofButtonDisabled, false);
      assert.match(view.draftProofButtonText, /2/);
      assert.equal(view.refreshProofAnchorsButtonDisabled, false);
      assert.equal(view.refreshProofAnchorsButtonText, "Refresh Proof Anchors");
      assert.match(view.managedMarkup, /Heading from task id/);
      assert.match(view.freeMarkup, /Proof links/);
      assert.match(view.guardrailNote, /Save first before refreshing proof anchors/);
    },
  },
  {
    name: "buildTaskFormView and buildRunProofNoteView keep task and pending-proof state explicit",
    run() {
      const formView = buildTaskFormView(
        {
          meta: {
            id: "T-002",
            title: "Wire dashboard forms",
            status: "in_progress",
            priority: "P1",
            recipeId: "feature",
          },
        },
        "T-001"
      );
      const noteView = buildRunProofNoteView(["docs/notes.md"]);

      assert.equal(formView.selectedTaskId, "T-002");
      assert.equal(formView.selectedTaskTitle, "Wire dashboard forms");
      assert.equal(formView.shouldClearRunEvidenceDraft, true);
      assert.equal(noteView.fillPathsButtonDisabled, false);
      assert.match(noteView.fillPathsButtonText, /1/);
      assert.match(noteView.noteText, /Pending scoped files: docs\/notes\.md/);
    },
  },
  {
    name: "getVerificationEditorBaseText and normalizeOptionalPositiveInteger preserve current editor draft rules",
    run() {
      assert.equal(
        getVerificationEditorBaseText({
          activeDocumentName: "verification.md",
          currentEditorText: "draft content",
          detail: { verificationText: "saved verification" },
        }),
        "draft content"
      );
      assert.equal(
        getVerificationEditorBaseText({
          activeDocumentName: "task.md",
          currentEditorText: "ignored",
          detail: {
            verificationText: [
              "# T-001 Verification",
              "",
              "## Proof links",
              "",
              "### Proof 1",
              "",
              "- Files: src/app.js",
              "",
              "## Evidence",
              "",
              "<!-- agent-workflow:managed:verification-manual-proof-anchors:start -->",
              "### Manual proof anchors",
              "",
              "```json",
              "{\"version\":1,\"manualProofAnchors\":[]}",
              "```",
              "<!-- agent-workflow:managed:verification-manual-proof-anchors:end -->",
              "",
            ].join("\n"),
          },
          getEditableDocumentContent,
        }),
        "# T-001 Verification\n\n## Proof links\n\n### Proof 1\n\n- Files: src/app.js"
      );
      assert.equal(normalizeOptionalPositiveInteger("250", "Execution timeout"), 250);
      assert.equal(normalizeOptionalPositiveInteger("", "Execution timeout"), undefined);
      assert.throws(
        () => normalizeOptionalPositiveInteger("0", "Execution timeout"),
        /Execution timeout must be a positive integer\./
      );
    },
  },
];

const suite = {
  name: "dashboard-form-state-helpers",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
