const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { buildCheckpoint } = require("../src/lib/checkpoint");
const { compilePrompt } = require("../src/lib/prompt-compiler");
const { buildNextTaskId, formatQuickTaskSummary, quickCreateTask } = require("../src/lib/quick-task");
const { prepareRun } = require("../src/lib/run-preparer");
const { createTask, recordRun } = require("../src/lib/task-service");
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
    name: "quickCreateTask full mode refreshes project profile and creates prompt, run-request, launch pack, and checkpoint",
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
      assert.equal(result.mode, "full");
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
      assert.match(readTextFile(result.prompt.outputPath), /Deprecated: `prompt:compile` will be removed in 0\.3\.0\./);
      assert.match(readTextFile(result.prepared.launchPackPath), /Launch Pack - T-002/);

      const summary = formatQuickTaskSummary(result);
      assert.match(summary, /Quick task ready: T-002/);
      assert.match(summary, /Mode: full/);
      assert.match(summary, /prompt\.claude\.md/);
      assert.match(summary, /run-request\.claude-code\.json/);
      assert.match(summary, /Review \.agent-workflow\/tasks\/T-002\/task\.md/);
    },
  },
  {
    name: "quickCreateTask lite mode creates only task.json and task.md in the task folder",
    run() {
      const { workspaceRoot } = createTaskWorkspace("quick-task-lite");
      const taskId = "T-002";

      const result = quickCreateTask(workspaceRoot, "Capture a lightweight task", {
        taskId,
        priority: "P1",
        recipe: "feature",
        mode: "lite",
      });

      const taskRoot = path.join(workspaceRoot, ".agent-workflow", "tasks", taskId);
      assert.equal(result.mode, "lite");
      assert.equal(result.prompt, null);
      assert.equal(result.prepared, null);
      assert.equal(result.checkpoint, null);
      assert.deepEqual(fs.readdirSync(taskRoot).sort(), ["task.json", "task.md"]);

      const summary = formatQuickTaskSummary(result);
      assert.match(summary, /Mode: lite/);
      assert.match(summary, /task\.md/);
      assert.match(summary, /materialize the rest on demand/);
      assert.doesNotMatch(summary, /Prompt \(/);
    },
  },
  {
    name: "compilePrompt and prepareRun materialize missing lite task docs and run-prep artifacts on demand",
    run() {
      const { workspaceRoot } = createTaskWorkspace("quick-task-lite-prepare");
      const taskId = "T-002";

      quickCreateTask(workspaceRoot, "Prepare a lite task later", {
        taskId,
        mode: "lite",
      });

      const taskRoot = path.join(workspaceRoot, ".agent-workflow", "tasks", taskId);
      const prompt = compilePrompt(workspaceRoot, taskId, "codex");
      assert.ok(fs.existsSync(prompt.outputPath));
      assert.ok(fs.existsSync(path.join(taskRoot, "context.md")));
      assert.ok(fs.existsSync(path.join(taskRoot, "verification.md")));
      assert.equal(fs.existsSync(path.join(taskRoot, "run-request.codex.json")), false);
      assert.equal(fs.existsSync(path.join(taskRoot, "launch.codex.md")), false);

      const prepared = prepareRun(workspaceRoot, taskId, "codex");
      assert.ok(fs.existsSync(prepared.runRequestPath));
      assert.ok(fs.existsSync(prepared.launchPackPath));
    },
  },
  {
    name: "buildCheckpoint materializes verification and checkpoint files for lite tasks",
    run() {
      const { workspaceRoot } = createTaskWorkspace("quick-task-lite-checkpoint");
      const taskId = "T-002";

      quickCreateTask(workspaceRoot, "Checkpoint a lite task", {
        taskId,
        mode: "lite",
      });

      const taskRoot = path.join(workspaceRoot, ".agent-workflow", "tasks", taskId);
      const checkpoint = buildCheckpoint(workspaceRoot, taskId);

      assert.equal(checkpoint.taskId, taskId);
      assert.ok(fs.existsSync(path.join(taskRoot, "context.md")));
      assert.ok(fs.existsSync(path.join(taskRoot, "verification.md")));
      assert.ok(fs.existsSync(path.join(taskRoot, "checkpoint.md")));
      assert.ok(fs.existsSync(path.join(taskRoot, "checkpoint.json")));
    },
  },
  {
    name: "recordRun materializes lite task context, verification, and runs before writing evidence",
    run() {
      const { workspaceRoot } = createTaskWorkspace("quick-task-lite-run");
      const taskId = "T-002";

      quickCreateTask(workspaceRoot, "Record evidence for a lite task", {
        taskId,
        mode: "lite",
      });

      const taskRoot = path.join(workspaceRoot, ".agent-workflow", "tasks", taskId);
      const run = recordRun(workspaceRoot, taskId, "Lite proof recorded.", "passed", "manual", {
        verificationChecks: [{ label: "manual verification", status: "passed" }],
      });

      assert.equal(run.taskId, taskId);
      assert.ok(fs.existsSync(path.join(taskRoot, "context.md")));
      assert.ok(fs.existsSync(path.join(taskRoot, "verification.md")));
      assert.ok(fs.existsSync(path.join(taskRoot, "runs")));
      assert.match(readTextFile(path.join(taskRoot, "verification.md")), /Lite proof recorded\./);
      assert.ok(fs.readdirSync(path.join(taskRoot, "runs")).some((fileName) => fileName.endsWith(".json")));
    },
  },
];

const suite = {
  name: "quick-task",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
