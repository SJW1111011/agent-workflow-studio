const assert = require("node:assert/strict");
const path = require("path");

const { validateWorkspace } = require("../src/lib/schema-validator");
const { createRunRecord, persistRunRecord } = require("../src/lib/task-service");
const {
  createTaskWorkspace,
  initializeGitRepository,
  readJsonFile,
  runCommand,
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
    name: "persistRunRecord captures scopeProofAnchors for passed scoped proof",
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
      assert.ok(Array.isArray(persistedRun.scopeProofAnchors));
      assert.equal(persistedRun.scopeProofAnchors.length, 1);
      assert.equal(persistedRun.scopeProofAnchors[0].path, "src/app.js");
      assert.equal(persistedRun.scopeProofAnchors[0].exists, true);
      assert.match(String(persistedRun.scopeProofAnchors[0].contentFingerprint || ""), /^sha1:/);

      const storedRun = readJsonFile(path.join(files.runs, `${persistedRun.id}.json`));
      assert.deepEqual(storedRun.scopeProofAnchors, persistedRun.scopeProofAnchors);
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
        })
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

module.exports = {
  name: "proof-anchors",
  tests,
};
