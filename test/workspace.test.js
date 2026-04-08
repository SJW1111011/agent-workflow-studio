const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { ensureWorkflowScaffold } = require("../src/lib/workspace");
const { readJsonFile } = require("./test-helpers");

const REPO_ROOT = path.resolve(__dirname, "..");
const TEST_TMP_ROOT = path.join(REPO_ROOT, "tmp", "unit-tests");

const tests = [
  {
    name: "ensureWorkflowScaffold keeps the built-in Codex exec template opt-in and stdin-friendly",
    run() {
      fs.mkdirSync(TEST_TMP_ROOT, { recursive: true });
      const workspaceRoot = fs.mkdtempSync(path.join(TEST_TMP_ROOT, "workspace-scaffold-"));

      ensureWorkflowScaffold(workspaceRoot);

      const codexAdapter = readJsonFile(path.join(workspaceRoot, ".agent-workflow", "adapters", "codex.json"));

      assert.equal(codexAdapter.commandMode, "manual");
      assert.equal(codexAdapter.stdinMode, "promptFile");
      assert.deepEqual(codexAdapter.runnerCommand, ["codex"]);
      assert.deepEqual(codexAdapter.argvTemplate, ["exec", "--sandbox", "workspace-write", "-"]);
      assert.equal(codexAdapter.argvTemplate.includes("--ask-for-approval"), false);
    },
  },
];

module.exports = {
  name: "workspace",
  tests,
};
