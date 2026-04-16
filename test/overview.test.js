const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { buildOverview } = require("../src/lib/overview");
const { createRunRecord, createTask, persistRunRecord } = require("../src/lib/task-service");
const { taskFiles } = require("../src/lib/workspace");
const { createTaskWorkspace, readTextFile, setProjectStrictVerification, writeTextFile } = require("./test-helpers");

const REPO_ROOT = path.resolve(__dirname, "..");
const TEST_TMP_ROOT = path.join(REPO_ROOT, "tmp", "unit-tests");

function createBareWorkspace(prefix) {
  fs.mkdirSync(TEST_TMP_ROOT, { recursive: true });
  return fs.mkdtempSync(path.join(TEST_TMP_ROOT, `${prefix}-`));
}

function persistSyntheticRun(workspaceRoot, taskId, fields, options = {}) {
  const run = createRunRecord(taskId, fields);
  return persistRunRecord(workspaceRoot, taskId, run, options);
}

function setVerificationText(workspaceRoot, taskId, content) {
  writeTextFile(taskFiles(workspaceRoot, taskId).verification, content);
}

const tests = [
  {
    name: "buildOverview returns an uninitialized overview shape for a bare workspace",
    run() {
      const workspaceRoot = createBareWorkspace("overview-empty");
      const overview = buildOverview(workspaceRoot);

      assert.equal(overview.initialized, false);
      assert.equal(overview.tasks.length, 0);
      assert.equal(overview.runs.length, 0);
      assert.equal(overview.stats.tasks, 0);
      assert.equal(overview.stats.runs, 0);
      assert.equal(overview.stats.executorOutcomes.none, 0);
      assert.equal(overview.stats.verificationSignals.none, 0);
      assert.match(overview.risks[0].message, /Workflow is not initialized yet/);
    },
  },
  {
    name: "buildOverview aggregates executor outcomes and verification signals while keeping latest executor details separate",
    run() {
      const { workspaceRoot } = createTaskWorkspace("overview-aggregate");
      setProjectStrictVerification(workspaceRoot, true);

      createTask(workspaceRoot, "T-002", "Timed-out executor task", { recipe: "feature", priority: "P1" });
      createTask(workspaceRoot, "T-003", "Cancelled executor task", { recipe: "feature", priority: "P1" });
      createTask(workspaceRoot, "T-004", "Interrupted executor task", { recipe: "feature", priority: "P1" });
      createTask(workspaceRoot, "T-005", "No executor evidence yet", { recipe: "feature", priority: "P1" });

      writeTextFile(path.join(workspaceRoot, "src", "passed.js"), "module.exports = 'passed';\n");
      writeTextFile(path.join(workspaceRoot, "src", "draft.js"), "module.exports = 'draft';\n");
      writeTextFile(path.join(workspaceRoot, "src", "planned.js"), "module.exports = 'planned';\n");
      writeTextFile(path.join(workspaceRoot, "src", "mixed-strong.js"), "module.exports = 'mixed-strong';\n");
      writeTextFile(path.join(workspaceRoot, "src", "mixed-draft.js"), "module.exports = 'mixed-draft';\n");

      const passedExecutorRun = persistSyntheticRun(workspaceRoot, "T-001", {
        id: "run-executor-passed",
        agent: "codex",
        adapterId: "codex",
        source: "executor",
        status: "passed",
        summary: "Executor completed with exit code 0.",
        createdAt: "2026-01-02T00:00:00.000Z",
        completedAt: "2026-01-02T00:00:00.000Z",
        scopeProofPaths: ["src/passed.js"],
        verificationChecks: [{ label: "npm test", status: "passed", details: "passed scope ok" }],
        verificationArtifacts: [".agent-workflow/tasks/T-001/runs/run-executor-passed.stdout.log"],
      }, {
        strict: true,
      });
      persistSyntheticRun(workspaceRoot, "T-001", {
        id: "run-manual-followup",
        agent: "manual",
        source: "manual",
        status: "passed",
        summary: "Manual verification notes refreshed after the executor run.",
        createdAt: "2026-01-03T00:00:00.000Z",
        completedAt: "2026-01-03T00:00:00.000Z",
      });

      persistSyntheticRun(workspaceRoot, "T-002", {
        id: "run-executor-timeout",
        agent: "codex",
        adapterId: "codex",
        source: "executor",
        status: "failed",
        summary: "Executor timed out after 50 ms.",
        createdAt: "2026-01-02T01:00:00.000Z",
        completedAt: "2026-01-02T01:00:00.000Z",
        timedOut: true,
        timeoutMs: 50,
      });
      setVerificationText(
        workspaceRoot,
        "T-002",
        [
          "# T-002 Verification",
          "",
          "## Proof links",
          "",
          "### Proof 1",
          "",
          "- Files: src/draft.js",
          "",
        ].join("\n")
      );

      persistSyntheticRun(workspaceRoot, "T-003", {
        id: "run-executor-cancelled",
        agent: "codex",
        adapterId: "codex",
        source: "executor",
        status: "failed",
        summary: "Executor interrupted by dashboard-cancel.",
        createdAt: "2026-01-02T02:00:00.000Z",
        completedAt: "2026-01-02T02:00:00.000Z",
        interrupted: true,
        interruptionSignal: "dashboard-cancel",
      });
      setVerificationText(
        workspaceRoot,
        "T-003",
        [
          "# T-003 Verification",
          "",
          "## Planned checks",
          "",
          "- manual: Review src/planned.js diff",
          "",
        ].join("\n")
      );

      persistSyntheticRun(workspaceRoot, "T-004", {
        id: "run-executor-interrupted",
        agent: "codex",
        adapterId: "codex",
        source: "executor",
        status: "failed",
        summary: "Executor interrupted by SIGTERM.",
        createdAt: "2026-01-02T03:00:00.000Z",
        completedAt: "2026-01-02T03:00:00.000Z",
        interrupted: true,
        interruptionSignal: "SIGTERM",
      });
      setVerificationText(
        workspaceRoot,
        "T-004",
        [
          "# T-004 Verification",
          "",
          "## Proof links",
          "",
          "### Proof 1",
          "",
          "- Files: src/mixed-strong.js",
          "- Check: npm test",
          "- Artifact: logs/mixed.txt",
          "",
          "### Proof 2",
          "",
          "- Files: src/mixed-draft.js",
          "",
        ].join("\n")
      );

      const overview = buildOverview(workspaceRoot);
      const t001 = overview.tasks.find((task) => task.id === "T-001");
      const t002 = overview.tasks.find((task) => task.id === "T-002");
      const t003 = overview.tasks.find((task) => task.id === "T-003");
      const t004 = overview.tasks.find((task) => task.id === "T-004");
      const t005 = overview.tasks.find((task) => task.id === "T-005");

      assert.equal(overview.initialized, true);
      assert.equal(overview.stats.tasks, 5);
      assert.equal(overview.stats.runs, 5);
      assert.deepEqual(overview.stats.executorOutcomes, {
        passed: 1,
        failed: 0,
        timedOut: 1,
        interrupted: 1,
        cancelled: 1,
        none: 1,
      });
      assert.deepEqual(overview.stats.verificationSignals, {
        verified: 1,
        partial: 1,
        strong: 1,
        mixed: 1,
        draft: 2,
        planned: 0,
        none: 1,
      });

      assert.equal(t001.latestRunSummary, "Manual verification notes refreshed after the executor run.");
      assert.equal(t001.latestExecutorOutcome, "passed");
      assert.equal(t001.latestExecutorSummary, "Executor completed with exit code 0.");
      assert.equal(t001.latestExecutorAt, "2026-01-02T00:00:00.000Z");
      assert.equal(t001.verificationSignalStatus, "verified");
      assert.equal(t001.strongProofCount, 1);
      assert.equal(t001.anchorBackedStrongProofCount, 1);
      assert.equal(t001.compatibilityStrongProofCount, 0);
      assert.match(t001.verificationSignalSummary, /all current/i);
      assert.ok(readTextFile(taskFiles(workspaceRoot, "T-001").verification).includes(passedExecutorRun.summary));

      assert.equal(t002.latestExecutorOutcome, "timed-out");
      assert.equal(t002.verificationSignalStatus, "draft");
      assert.equal(t002.draftProofCount, 1);

      assert.equal(t003.latestExecutorOutcome, "cancelled");
      assert.equal(t003.verificationSignalStatus, "draft");
      assert.equal(t003.draftCheckCount, 1);

      assert.equal(t004.latestExecutorOutcome, "interrupted");
      assert.equal(t004.verificationSignalStatus, "partial");
      assert.equal(t004.strongProofCount, 1);
      assert.equal(t004.draftProofCount, 1);
      assert.equal(t004.compatibilityStrongProofCount, 1);
      assert.match(t004.verificationSignalSummary, /recorded from earlier evidence/i);

      assert.equal(t005.latestExecutorOutcome, null);
      assert.equal(t005.verificationSignalStatus, "none");
      assert.equal(t005.latestRunStatus, "none");
      assert.equal(t005.latestRunSummary, "No runs yet");
    },
  },
];

const suite = {
  name: "overview",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
