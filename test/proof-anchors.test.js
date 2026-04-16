const assert = require("node:assert/strict");
const path = require("path");

const { validateWorkspace } = require("../src/lib/schema-validator");
const { createRunRecord, persistRunRecord } = require("../src/lib/task-service");
const {
  createTaskWorkspace,
  initializeGitRepository,
  readJsonFile,
  runCommand,
  setProjectStrictVerification,
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
    name: "persistRunRecord skips scopeProofAnchors by default for passed scoped proof",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("proof-anchors-persist");
      prepareScopedTask(files, ["src/app.js"]);
      initializeGitRepository(workspaceRoot);
      runCommand("git", ["add", "."], workspaceRoot);
      runCommand("git", ["commit", "-m", "initial"], workspaceRoot);
      writeTextFile(path.join(workspaceRoot, "src", "app.js"), "module.exports = 'app';\n");

      const persistedRun = persistRunRecord(
        workspaceRoot,
        taskId,
        createRunRecord(taskId, {
          status: "passed",
          summary: "Anchored scoped proof recorded.",
          agent: "manual",
          createdAt: "2026-01-03T00:00:00.000Z",
          completedAt: "2026-01-03T00:00:00.000Z",
        })
      );

      assert.deepEqual(persistedRun.scopeProofPaths, ["src/app.js"]);
      assert.equal(persistedRun.scopeProofAnchors, undefined);

      const storedRun = readJsonFile(path.join(files.runs, `${persistedRun.id}.json`));
      assert.deepEqual(storedRun.scopeProofAnchors, persistedRun.scopeProofAnchors);
    },
  },
  {
    name: "persistRunRecord captures scopeProofAnchors when strict mode is enabled explicitly",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("proof-anchors-strict-flag");
      prepareScopedTask(files, ["src/app.js"]);
      initializeGitRepository(workspaceRoot);
      runCommand("git", ["add", "."], workspaceRoot);
      runCommand("git", ["commit", "-m", "initial"], workspaceRoot);
      writeTextFile(path.join(workspaceRoot, "src", "app.js"), "module.exports = 'app';\n");

      const persistedRun = persistRunRecord(
        workspaceRoot,
        taskId,
        createRunRecord(taskId, {
          status: "passed",
          summary: "Anchored scoped proof recorded.",
          agent: "manual",
          createdAt: "2026-01-03T00:00:00.000Z",
          completedAt: "2026-01-03T00:00:00.000Z",
        }),
        {
          strict: true,
        }
      );

      assert.deepEqual(persistedRun.scopeProofPaths, ["src/app.js"]);
      assert.ok(Array.isArray(persistedRun.scopeProofAnchors));
      assert.equal(persistedRun.scopeProofAnchors.length, 1);
      assert.equal(persistedRun.scopeProofAnchors[0].path, "src/app.js");
      assert.equal(persistedRun.scopeProofAnchors[0].exists, true);
      assert.match(String(persistedRun.scopeProofAnchors[0].contentFingerprint || ""), /^sha1:/);
    },
  },
  {
    name: "project strictVerification=true enables scopeProofAnchors without per-run flags",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("proof-anchors-project-default");
      prepareScopedTask(files, ["src/app.js"]);
      setProjectStrictVerification(workspaceRoot, true);
      initializeGitRepository(workspaceRoot);
      runCommand("git", ["add", "."], workspaceRoot);
      runCommand("git", ["commit", "-m", "initial"], workspaceRoot);
      writeTextFile(path.join(workspaceRoot, "src", "app.js"), "module.exports = 'app';\n");

      const persistedRun = persistRunRecord(
        workspaceRoot,
        taskId,
        createRunRecord(taskId, {
          status: "passed",
          summary: "Anchored scoped proof recorded.",
          agent: "manual",
          createdAt: "2026-01-03T00:00:00.000Z",
          completedAt: "2026-01-03T00:00:00.000Z",
        })
      );

      assert.ok(Array.isArray(persistedRun.scopeProofAnchors));
      assert.equal(persistedRun.scopeProofAnchors.length, 1);
      assert.match(String(persistedRun.scopeProofAnchors[0].contentFingerprint || ""), /^sha1:/);
    },
  },
  {
    name: "schema validator flags malformed scopeProofAnchors",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("proof-anchors-validate");
      prepareScopedTask(files, ["src/app.js"]);
      initializeGitRepository(workspaceRoot);
      runCommand("git", ["add", "."], workspaceRoot);
      runCommand("git", ["commit", "-m", "initial"], workspaceRoot);
      writeTextFile(path.join(workspaceRoot, "src", "app.js"), "module.exports = 'app';\n");

      const persistedRun = persistRunRecord(
        workspaceRoot,
        taskId,
        createRunRecord(taskId, {
          status: "passed",
          summary: "Anchored scoped proof recorded.",
          agent: "manual",
          createdAt: "2026-01-03T00:00:00.000Z",
          completedAt: "2026-01-03T00:00:00.000Z",
        }),
        {
          strict: true,
        }
      );
      const runPath = path.join(files.runs, `${persistedRun.id}.json`);
      const invalidRun = readJsonFile(runPath);
      invalidRun.scopeProofAnchors = [{ path: "", exists: "yes" }];
      writeJsonFile(runPath, invalidRun);

      const validation = validateWorkspace(workspaceRoot);
      const scopeProofAnchorIssue = validation.issues.find((issue) => issue.code === "run.scopeProofAnchors");

      assert.ok(scopeProofAnchorIssue);
      assert.match(scopeProofAnchorIssue.message, /invalid scopeProofAnchors/i);
    },
  },
];

const suite = {
  name: "proof-anchors",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
