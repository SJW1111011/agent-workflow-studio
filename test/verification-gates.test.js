const assert = require("node:assert/strict");

const { buildTaskVerificationGate } = require("../src/lib/verification-gates");
const { buildManualProofSignature } = require("../src/lib/verification-proof");
const {
  buildRepositoryDiff,
  createTaskWorkspace,
  readJsonFile,
  setFileModifiedAt,
  writeJsonFile,
  writeTextFile,
} = require("./test-helpers");

function prepareScopedTask(files, scope, createdAt = "2026-01-01T00:00:00.000Z") {
  const meta = readJsonFile(files.meta);
  meta.scope = scope;
  meta.status = "in_progress";
  meta.createdAt = createdAt;
  meta.updatedAt = createdAt;
  writeJsonFile(files.meta, meta);
  return meta;
}

const tests = [
  {
    name: "manual proof covers scoped changes when strong proof is newer than the file",
    run() {
      const { workspaceRoot, files } = createTaskWorkspace("verification-covered");
      writeTextFile(`${workspaceRoot}/src/app.js`, "module.exports = 'app';\n");

      const meta = prepareScopedTask(files, ["src/app.js"]);

      writeTextFile(
        files.verification,
        [
          "# T-001 Verification",
          "",
          "## Proof links",
          "",
          "### Proof 1",
          "",
          "- Files: src/app.js",
          "- Check: npm test",
          "- Artifact: logs/app-proof.txt",
          "",
        ].join("\n")
      );
      setFileModifiedAt(files.verification, "2026-01-03T00:00:00.000Z");

      const gate = buildTaskVerificationGate(
        workspaceRoot,
        meta,
        [],
        buildRepositoryDiff([{ path: "src/app.js", modifiedAt: "2026-01-02T00:00:00.000Z" }])
      );

      assert.equal(gate.summary.status, "covered");
      assert.equal(gate.summary.relevantChangeCount, 0);
      assert.equal(gate.coveredScopedFiles.length, 1);
      assert.equal(gate.coveredScopedFiles[0].path, "src/app.js");
      assert.equal(gate.coveredScopedFiles[0].proofFreshnessSource, "recorded");
      assert.equal(gate.proofCoverage.explicitProofCount, 1);
      assert.equal(gate.proofCoverage.weakProofCount, 0);
      assert.equal(gate.proofCoverage.compatibilityStrongProofCount, 1);
      assert.equal(gate.proofCoverage.anchoredStrongProofCount, 0);
      assert.equal(gate.coveredScopedFiles[0].proofItems[0].strong, true);
    },
  },
  {
    name: "partial coverage keeps uncovered scoped files in needs-proof state",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("verification-partial");
      writeTextFile(`${workspaceRoot}/src/app.js`, "module.exports = 'app';\n");
      writeTextFile(`${workspaceRoot}/src/lib/util.js`, "module.exports = 'util';\n");

      const meta = prepareScopedTask(files, ["src/app.js", "src/lib/util.js"]);
      const runs = [
        {
          id: "run-001",
          taskId,
          status: "passed",
          summary: "Scoped tests passed.",
          createdAt: "2026-01-03T00:00:00.000Z",
          completedAt: "2026-01-03T00:00:00.000Z",
          scopeProofPaths: ["src/app.js"],
          verificationChecks: [{ label: "npm test", status: "passed", details: "targeted scope ok" }],
          verificationArtifacts: ["artifacts/npm-test.txt"],
        },
      ];

      const gate = buildTaskVerificationGate(
        workspaceRoot,
        meta,
        runs,
        buildRepositoryDiff([
          { path: "src/app.js", modifiedAt: "2026-01-02T00:00:00.000Z" },
          { path: "src/lib/util.js", modifiedAt: "2026-01-02T00:00:00.000Z" },
        ])
      );

      assert.equal(gate.summary.status, "incomplete");
      assert.equal(gate.summary.relevantChangeCount, 1);
      assert.equal(gate.coveredScopedFiles.length, 1);
      assert.equal(gate.coveredScopedFiles[0].path, "src/app.js");
      assert.equal(gate.relevantChangedFiles.length, 1);
      assert.equal(gate.relevantChangedFiles[0].path, "src/lib/util.js");
      assert.equal(gate.proofCoverage.explicitProofCount, 1);
    },
  },
  {
    name: "anchor-matched proof stays covered even when mtimes would otherwise look stale",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("verification-anchors-covered");
      const meta = prepareScopedTask(files, ["src/app.js"]);
      const runs = [
        {
          id: "run-anchors-001",
          taskId,
          status: "passed",
          summary: "Scoped proof recorded with anchors.",
          createdAt: "2026-01-03T00:00:00.000Z",
          completedAt: "2026-01-03T00:00:00.000Z",
          scopeProofPaths: ["src/app.js"],
          scopeProofAnchors: [
            {
              path: "src/app.js",
              exists: true,
              contentFingerprint: "sha1:same-fingerprint",
            },
          ],
          verificationChecks: [{ label: "npm test", status: "passed", details: "anchored scope ok" }],
          verificationArtifacts: ["artifacts/npm-test.txt"],
        },
      ];

      const gate = buildTaskVerificationGate(
        workspaceRoot,
        meta,
        runs,
        buildRepositoryDiff([
          {
            path: "src/app.js",
            modifiedAt: "2026-01-04T00:00:00.000Z",
            contentFingerprint: "sha1:same-fingerprint",
          },
        ])
      );

      assert.equal(gate.summary.status, "covered");
      assert.equal(gate.summary.relevantChangeCount, 0);
      assert.equal(gate.coveredScopedFiles.length, 1);
      assert.equal(gate.coveredScopedFiles[0].path, "src/app.js");
      assert.equal(gate.proofCoverage.items[0].anchorCount, 1);
    },
  },
  {
    name: "manual proof anchors keep coverage even when verification timestamps would otherwise be stale",
    run() {
      const { workspaceRoot, files } = createTaskWorkspace("verification-manual-anchors-covered");
      const meta = prepareScopedTask(files, ["src/app.js"]);
      const proofSignature = buildManualProofSignature({
        paths: ["src/app.js"],
        checks: ["npm test"],
        artifacts: ["logs/app-proof.txt"],
      });

      writeTextFile(
        files.verification,
        [
          "# T-001 Verification",
          "",
          "## Proof links",
          "",
          "### Proof 1",
          "",
          "- Files: src/app.js",
          "- Check: npm test",
          "- Artifact: logs/app-proof.txt",
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
                  proofSignature,
                  capturedAt: "2026-01-02T00:00:00.000Z",
                  paths: ["src/app.js"],
                  anchors: [
                    {
                      path: "src/app.js",
                      exists: true,
                      contentFingerprint: "sha1:manual-same",
                    },
                  ],
                },
              ],
            },
            null,
            2
          ),
          "```",
          "<!-- agent-workflow:managed:verification-manual-proof-anchors:end -->",
          "",
        ].join("\n")
      );
      setFileModifiedAt(files.verification, "2026-01-01T00:00:00.000Z");

      const gate = buildTaskVerificationGate(
        workspaceRoot,
        meta,
        [],
        buildRepositoryDiff([
          {
            path: "src/app.js",
            modifiedAt: "2026-01-03T00:00:00.000Z",
            contentFingerprint: "sha1:manual-same",
          },
        ])
      );

      assert.equal(gate.summary.status, "covered");
      assert.equal(gate.summary.relevantChangeCount, 0);
      assert.equal(gate.coveredScopedFiles.length, 1);
      assert.equal(gate.coveredScopedFiles[0].path, "src/app.js");
      assert.equal(gate.coveredScopedFiles[0].proofFreshnessSource, "current");
      assert.equal(gate.proofCoverage.items[0].sourceType, "manual");
      assert.equal(gate.proofCoverage.items[0].anchorCount, 1);
      assert.equal(gate.proofCoverage.anchoredStrongProofCount, 1);
    },
  },
  {
    name: "stale manual anchor metadata is ignored when the proof block signature changes",
    run() {
      const { workspaceRoot, files } = createTaskWorkspace("verification-manual-anchors-stale");
      const meta = prepareScopedTask(files, ["src/app.js"]);
      const staleProofSignature = buildManualProofSignature({
        paths: ["src/app.js"],
        checks: ["npm test"],
        artifacts: ["logs/app-proof.txt"],
      });

      writeTextFile(
        files.verification,
        [
          "# T-001 Verification",
          "",
          "## Proof links",
          "",
          "### Proof 1",
          "",
          "- Files: src/app.js",
          "- Check: npm test --updated",
          "- Artifact: logs/app-proof.txt",
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
                  proofSignature: staleProofSignature,
                  capturedAt: "2026-01-02T00:00:00.000Z",
                  paths: ["src/app.js"],
                  anchors: [
                    {
                      path: "src/app.js",
                      exists: true,
                      contentFingerprint: "sha1:manual-old",
                    },
                  ],
                },
              ],
            },
            null,
            2
          ),
          "```",
          "<!-- agent-workflow:managed:verification-manual-proof-anchors:end -->",
          "",
        ].join("\n")
      );
      setFileModifiedAt(files.verification, "2026-01-03T00:00:00.000Z");

      const gate = buildTaskVerificationGate(
        workspaceRoot,
        meta,
        [],
        buildRepositoryDiff([
          {
            path: "src/app.js",
            modifiedAt: "2026-01-02T00:00:00.000Z",
            contentFingerprint: "sha1:manual-new",
          },
        ])
      );

      assert.equal(gate.summary.status, "covered");
      assert.equal(gate.proofCoverage.items[0].sourceType, "manual");
      assert.equal(gate.proofCoverage.items[0].anchorCount, 0);
    },
  },
  {
    name: "anchor mismatch reopens needs-proof even when timestamps would otherwise pass",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("verification-anchors-mismatch");
      const meta = prepareScopedTask(files, ["src/app.js"]);
      const runs = [
        {
          id: "run-anchors-002",
          taskId,
          status: "passed",
          summary: "Scoped proof recorded with anchors.",
          createdAt: "2026-01-03T00:00:00.000Z",
          completedAt: "2026-01-05T00:00:00.000Z",
          scopeProofPaths: ["src/app.js"],
          scopeProofAnchors: [
            {
              path: "src/app.js",
              exists: true,
              contentFingerprint: "sha1:old-fingerprint",
            },
          ],
          verificationChecks: [{ label: "npm test", status: "passed", details: "anchored scope ok" }],
          verificationArtifacts: ["artifacts/npm-test.txt"],
        },
      ];

      const gate = buildTaskVerificationGate(
        workspaceRoot,
        meta,
        runs,
        buildRepositoryDiff([
          {
            path: "src/app.js",
            modifiedAt: "2026-01-02T00:00:00.000Z",
            contentFingerprint: "sha1:new-fingerprint",
          },
        ])
      );

      assert.equal(gate.summary.status, "action-required");
      assert.equal(gate.summary.relevantChangeCount, 1);
      assert.equal(gate.coveredScopedFiles.length, 0);
      assert.equal(gate.relevantChangedFiles[0].path, "src/app.js");
      assert.equal(gate.relevantChangedFiles[0].proofFreshnessSource, "outdated");
    },
  },
  {
    name: "file-only manual proof stays weak instead of counting as coverage",
    run() {
      const { workspaceRoot, files } = createTaskWorkspace("verification-weak");
      writeTextFile(`${workspaceRoot}/src/app.js`, "module.exports = 'app';\n");

      const meta = prepareScopedTask(files, ["src/app.js"]);

      writeTextFile(
        files.verification,
        [
          "# T-001 Verification",
          "",
          "## Proof links",
          "",
          "### Proof 1",
          "",
          "- Files: src/app.js",
          "",
        ].join("\n")
      );
      setFileModifiedAt(files.verification, "2026-01-03T00:00:00.000Z");

      const gate = buildTaskVerificationGate(
        workspaceRoot,
        meta,
        [],
        buildRepositoryDiff([{ path: "src/app.js", modifiedAt: "2026-01-02T00:00:00.000Z" }])
      );

      assert.equal(gate.summary.status, "action-required");
      assert.equal(gate.summary.relevantChangeCount, 1);
      assert.equal(gate.proofCoverage.explicitProofCount, 0);
      assert.equal(gate.proofCoverage.weakProofCount, 1);
      assert.equal(gate.proofCoverage.items[0].strong, false);
    },
  },
  {
    name: "missing scope hints surface scope-missing for active work",
    run() {
      const { workspaceRoot, files } = createTaskWorkspace("verification-scope-missing");
      writeTextFile(`${workspaceRoot}/src/app.js`, "module.exports = 'app';\n");

      const meta = readJsonFile(files.meta);
      meta.status = "in_progress";
      meta.createdAt = "2026-01-01T00:00:00.000Z";
      meta.updatedAt = "2026-01-01T00:00:00.000Z";
      writeJsonFile(files.meta, meta);

      const gate = buildTaskVerificationGate(
        workspaceRoot,
        meta,
        [],
        buildRepositoryDiff([{ path: "src/app.js", modifiedAt: "2026-01-02T00:00:00.000Z" }])
      );

      assert.equal(gate.summary.status, "unconfigured");
      assert.equal(gate.scopeCoverage.hintCount, 0);
      assert.ok(gate.scopeCoverage.ambiguousCount >= 1);
      assert.match(gate.summary.message, /no repo-relative scope/i);
    },
  },
];

const suite = {
  name: "verification-gates",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
