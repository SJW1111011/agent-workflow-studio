const assert = require("node:assert/strict");

const {
  getEditableDocumentContent,
  hasManagedVerificationAnchorBlock,
  stripManagedVerificationAnchorBlock,
} = require("../dashboard/document-helpers.js");

const tests = [
  {
    name: "verification editor content strips managed manual proof anchor blocks while keeping human proof text",
    run() {
      const verificationText = [
        "# T-001 Verification",
        "",
        "## Proof links",
        "",
        "### Proof 1",
        "",
        "- Files: src/app.js",
        "- Check: npm test",
        "- Artifact: logs/test.txt",
        "",
        "## Evidence",
        "",
        "<!-- agent-workflow:managed:verification-manual-proof-anchors:start -->",
        "### Manual proof anchors",
        "",
        "```json",
        JSON.stringify(
          {
            version: 1,
            manualProofAnchors: [
              {
                proofSignature: "sha1:test",
                capturedAt: "2026-04-08T12:00:00.000Z",
                paths: ["src/app.js"],
                anchors: [{ path: "src/app.js", exists: true, contentFingerprint: "sha1:same" }],
              },
            ],
          },
          null,
          2
        ),
        "```",
        "<!-- agent-workflow:managed:verification-manual-proof-anchors:end -->",
        "",
      ].join("\n");

      const editableText = getEditableDocumentContent("verification.md", verificationText);

      assert.equal(hasManagedVerificationAnchorBlock(verificationText), true);
      assert.doesNotMatch(editableText, /verification-manual-proof-anchors:start/);
      assert.doesNotMatch(editableText, /## Evidence/);
      assert.match(editableText, /## Proof links/);
      assert.match(editableText, /- Files: src\/app\.js/);
      assert.equal(stripManagedVerificationAnchorBlock(verificationText), editableText);
    },
  },
  {
    name: "non-verification editor content stays unchanged",
    run() {
      const taskText = "# T-001 - Test task\n\n## Goal\n\nKeep it local.\n";

      assert.equal(getEditableDocumentContent("task.md", taskText), taskText.replace(/\r\n/g, "\n"));
    },
  },
];

const suite = {
  name: "dashboard-document-helpers",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
