const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { buildNextTaskId, formatQuickTaskSummary, quickCreateTask } = require("../src/lib/quick-task");
const { createTask } = require("../src/lib/task-service");
const { createTaskWorkspace, readJsonFile, readTextFile, writeTextFile } = require("./test-helpers");

const tests = [
  {
    name: "buildNextTaskId uses the next numeric T-id while ignoring non-numeric task ids",
    run() {
      const { workspaceRoot } = createTaskWorkspace("quick-task-id");

      createTask(workspaceRoot, "T-003", "Third task", {
        recipe: "feature",
        priority: "P2",
      });
      createTask(workspaceRoot, "spike-auth", "Non numeric task", {
        recipe: "feature",
        priority: "P2",
      });

      assert.equal(buildNextTaskId(workspaceRoot), "T-004");
    },
  },
  {
    name: "quickCreateTask refreshes project profile and creates prompt, run-request, launch pack, and checkpoint",
    run() {
      const { workspaceRoot } = createTaskWorkspace("quick-task-create");

      writeTextFile(
        path.join(workspaceRoot, "package.json"),
        `${JSON.stringify(
          {
            name: "quick-task-create",
            version: "0.0.1",
            scripts: {
              test: "node -e \"console.log('ok')\"",
            },
          },
          null,
          2
        )}\n`
      );
      writeTextFile(path.join(workspaceRoot, "README.md"), "# Quick task workspace\n");
      fs.mkdirSync(path.join(workspaceRoot, "docs"), { recursive: true });
      writeTextFile(path.join(workspaceRoot, "docs", "notes.md"), "# Notes\n");

      const result = quickCreateTask(workspaceRoot, "Draft quickstart flow", {
        taskId: "T-002",
        priority: "P0",
        recipe: "review",
        agent: "claude",
      });

      assert.equal(result.taskId, "T-002");
      assert.equal(result.priority, "P0");
      assert.equal(result.recipeId, "review");
      assert.equal(result.agent, "claude");
      assert.equal(result.adapterId, "claude-code");
      assert.equal(result.profile.repositoryName, path.basename(workspaceRoot));
      assert.ok(result.profile.docs.includes("README.md"));
      assert.ok(result.profile.docs.includes("docs/notes.md"));
      assert.ok(Object.prototype.hasOwnProperty.call(result.profile.scripts, "test"));
      assert.ok(fs.existsSync(result.prompt.outputPath));
      assert.ok(fs.existsSync(result.prepared.runRequestPath));
      assert.ok(fs.existsSync(result.prepared.launchPackPath));
      assert.ok(fs.existsSync(path.join(workspaceRoot, ".agent-workflow", "tasks", "T-002", "checkpoint.md")));

      const runRequest = readJsonFile(result.prepared.runRequestPath);
      assert.equal(runRequest.adapterId, "claude-code");
      assert.equal(runRequest.taskId, "T-002");
      assert.match(readTextFile(result.prompt.outputPath), /# T-002 Prompt for Claude Code/);
      assert.match(readTextFile(result.prepared.launchPackPath), /Launch Pack - T-002/);

      const summary = formatQuickTaskSummary(result);
      assert.match(summary, /Quick task ready: T-002/);
      assert.match(summary, /prompt\.claude\.md/);
      assert.match(summary, /run-request\.claude-code\.json/);
      assert.match(summary, /Review \.agent-workflow\/tasks\/T-002\/task\.md/);
    },
  },
];

module.exports = {
  name: "quick-task",
  tests,
};
