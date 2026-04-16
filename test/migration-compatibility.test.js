const assert = require("node:assert/strict");
const path = require("path");

const { buildCheckpoint } = require("../src/lib/checkpoint");
const { buildOverview } = require("../src/lib/overview");
const { validateWorkspace } = require("../src/lib/schema-validator");
const { refreshManualProofAnchors } = require("../src/lib/task-documents");
const { getTaskDetail, listRuns } = require("../src/lib/task-service");
const { buildTaskVerificationGate } = require("../src/lib/verification-gates");
const {
  buildRepositoryDiff,
  createTaskWorkspace,
  readJsonFile,
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

function buildLegacyRun(taskId) {
  return {
    id: "run-legacy-001",
    taskId,
    agent: "manual",
    status: "strong",
    summary: "Legacy evidence before the Phase 3 rename.",
    createdAt: "2026-01-03T00:00:00.000Z",
    completedAt: "2026-01-03T00:00:00.000Z",
    proofPaths: ["src/app.js"],
    checks: [
      {
        name: "npm test",
        status: "strong",
        summary: "legacy scope ok",
        files: ["artifacts/npm-test.txt"],
      },
    ],
    artifacts: ["artifacts/npm-test.txt"],
    proofAnchors: [
      {
        file: "src/app.js",
        exists: true,
      },
    ],
  };
}

const tests = [
  {
    name: "listRuns and buildOverview normalize legacy run vocabulary on read",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("migration-legacy-runs");
      writeTextFile(path.join(workspaceRoot, "src", "app.js"), "module.exports = 'legacy';\n");
      prepareScopedTask(files, ["src/app.js"]);
      writeJsonFile(path.join(files.runs, "run-legacy-001.json"), buildLegacyRun(taskId));

      const runs = listRuns(workspaceRoot, taskId);
      const overview = buildOverview(workspaceRoot);
      const task = overview.tasks.find((item) => item.id === taskId);

      assert.equal(runs.length, 1);
      assert.equal(runs[0].status, "passed");
      assert.deepEqual(runs[0].scopeProofPaths, ["src/app.js"]);
      assert.deepEqual(runs[0].verificationArtifacts, ["artifacts/npm-test.txt"]);
      assert.equal(runs[0].verificationChecks[0].status, "passed");
      assert.equal(runs[0].verificationChecks[0].label, "npm test");
      assert.equal(runs[0].scopeProofAnchors[0].path, "src/app.js");

      assert.equal(task.verificationSignalStatus, "verified");
      assert.equal(overview.stats.verificationSignals.verified, 1);
      assert.equal(overview.runs[0].verificationChecks[0].status, "passed");
    },
  },
  {
    name: "buildTaskVerificationGate accepts legacy run field names and statuses passed directly",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("migration-legacy-gate");
      writeTextFile(path.join(workspaceRoot, "src", "app.js"), "module.exports = 'gate';\n");
      const meta = prepareScopedTask(files, ["src/app.js"]);

      const gate = buildTaskVerificationGate(
        workspaceRoot,
        meta,
        [buildLegacyRun(taskId)],
        buildRepositoryDiff([
          {
            path: "src/app.js",
            modifiedAt: "2026-01-02T00:00:00.000Z",
          },
        ])
      );

      assert.equal(gate.summary.status, "covered");
      assert.equal(gate.proofCoverage.verifiedEvidenceCount, 1);
      assert.equal(gate.proofCoverage.items[0].verified, true);
      assert.equal(gate.coveredScopedFiles[0].path, "src/app.js");
    },
  },
  {
    name: "validateWorkspace accepts legacy verification check statuses and proof anchor aliases",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("migration-legacy-validate");
      writeJsonFile(path.join(files.runs, "run-legacy-validate.json"), {
        id: "run-legacy-validate",
        taskId,
        agent: "manual",
        status: "passed",
        summary: "Legacy validator fixture.",
        createdAt: "2026-01-03T00:00:00.000Z",
        scopeProofPaths: ["src/app.js"],
        scopeProofAnchors: [
          {
            file: "src/app.js",
            exists: true,
          },
        ],
        verificationChecks: [
          {
            label: "legacy manual review",
            status: "strong",
          },
        ],
      });

      const report = validateWorkspace(workspaceRoot);

      assert.equal(report.ok, true);
      assert.equal(report.issueCount, 0);
    },
  },
  {
    name: "legacy checkpoint text still renders and managed manual anchors stay preserved when strict mode is off",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("migration-legacy-docs");
      writeTextFile(
        files.checkpoint,
        [
          "# T-001 Checkpoint",
          "",
          "## Verification gate",
          "",
          "- Status: partially-covered",
          "- Summary: Some scoped files are explicitly covered, but newer scoped changes still need proof.",
          "",
        ].join("\n")
      );
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
          "- Artifact: logs/app.txt",
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
                  proofSignature: "sha1:legacy-proof",
                  capturedAt: "2026-01-02T00:00:00.000Z",
                  paths: ["src/app.js"],
                  anchors: [
                    {
                      file: "src/app.js",
                      exists: true,
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

      const refreshSummary = refreshManualProofAnchors(workspaceRoot, taskId);
      const detail = getTaskDetail(workspaceRoot, taskId);

      assert.equal(refreshSummary.changed, false);
      assert.equal(refreshSummary.blockedByStrictMode, true);
      assert.match(refreshSummary.content, /verification-manual-proof-anchors:start/);
      assert.match(refreshSummary.content, /manualProofAnchors/);
      assert.match(detail.checkpointText, /partially-covered/);
    },
  },
  {
    name: "buildCheckpoint rewrites legacy checkpoint wording into the new verification gate vocabulary",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("migration-legacy-checkpoint");
      writeTextFile(path.join(workspaceRoot, "src", "app.js"), "module.exports = 'checkpoint';\n");
      prepareScopedTask(files, ["src/app.js"], "2020-01-01T00:00:00.000Z");
      writeTextFile(
        files.checkpoint,
        [
          "# T-001 Checkpoint",
          "",
          "## Verification gate",
          "",
          "- Status: needs-proof",
          "- Summary: Legacy wording before the rename.",
          "",
        ].join("\n")
      );

      const checkpoint = buildCheckpoint(workspaceRoot, taskId);
      const checkpointText = getTaskDetail(workspaceRoot, taskId).checkpointText;

      assert.ok(["ready", "covered", "action-required", "incomplete", "unconfigured"].includes(checkpoint.verificationGate.status));
      assert.match(checkpointText, new RegExp(`- Status: ${checkpoint.verificationGate.status}`));
      assert.doesNotMatch(checkpointText, /needs-proof/);
      assert.doesNotMatch(checkpointText, /partially-covered/);
    },
  },
];

const suite = {
  name: "migration-compatibility",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
