const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { executeMcpTool } = require("../src/lib/mcp-tools");
const { createTaskWorkspace, readJsonFile, readTextFile, writeJsonFile, writeTextFile } = require("./test-helpers");

function setTaskScope(files, scope, createdAt = "2026-01-01T00:00:00.000Z") {
  const meta = readJsonFile(files.meta);
  meta.scope = scope;
  meta.status = "in_progress";
  meta.createdAt = createdAt;
  meta.updatedAt = createdAt;
  writeJsonFile(files.meta, meta);
}

const tests = [
  {
    name: "workflow_quick returns repo-relative artifacts for a full task bundle",
    async run() {
      const { workspaceRoot } = createTaskWorkspace("mcp-tool-quick");

      writeTextFile(
        path.join(workspaceRoot, "package.json"),
        `${JSON.stringify(
          {
            name: "mcp-tool-quick",
            version: "0.0.1",
          },
          null,
          2
        )}\n`
      );
      writeTextFile(path.join(workspaceRoot, "README.md"), "# MCP quick\n");

      const result = await executeMcpTool(workspaceRoot, "workflow_quick", {
        title: "Expose the MCP quick flow",
        taskId: "T-002",
        priority: "P0",
        recipe: "feature",
        agent: "codex",
        mode: "full",
      });

      assert.equal(result.ok, true);
      assert.equal(result.tool, "workflow_quick");
      assert.equal(result.taskId, "T-002");
      assert.equal(result.priority, "P0");
      assert.equal(result.mode, "full");
      assert.equal(result.promptPath, ".agent-workflow/tasks/T-002/prompt.codex.md");
      assert.equal(result.runRequestPath, ".agent-workflow/tasks/T-002/run-request.codex.json");
      assert.equal(result.launchPackPath, ".agent-workflow/tasks/T-002/launch.codex.md");
      assert.equal(result.checkpointPath, ".agent-workflow/tasks/T-002/checkpoint.md");
      assert.match(result.summary, /Quick task ready: T-002/);
    },
  },
  {
    name: "workflow_done records evidence, refreshes the checkpoint, and can mark the task done",
    async run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("mcp-tool-done");

      writeTextFile(path.join(workspaceRoot, "README.md"), "# MCP done\n");
      setTaskScope(files, ["README.md"]);

      const result = await executeMcpTool(workspaceRoot, "workflow_done", {
        taskId,
        summary: "Recorded through MCP.",
        status: "passed",
        complete: true,
        proofPaths: ["README.md"],
        checks: ["Reviewed README.md diff"],
        artifacts: [".agent-workflow/tasks/T-001/checkpoint.md"],
      });

      assert.equal(result.ok, true);
      assert.equal(result.tool, "workflow_done");
      assert.equal(result.run.status, "passed");
      assert.equal(result.task.status, "done");
      assert.equal(result.checkpointPath, `.agent-workflow/tasks/${taskId}/checkpoint.md`);
      assert.ok(Array.isArray(result.run.scopeProofPaths));
      assert.ok(result.run.scopeProofPaths.includes("README.md"));
      assert.ok(Array.isArray(result.run.verificationChecks));
      assert.ok(result.run.verificationChecks.some((check) => check.label === "Reviewed README.md diff"));
      assert.ok(Array.isArray(result.run.verificationArtifacts));
      assert.ok(result.run.verificationArtifacts.includes(".agent-workflow/tasks/T-001/checkpoint.md"));
      assert.equal(readJsonFile(files.meta).status, "done");
      assert.equal(result.checkpoint.verificationGate.coveragePercent, 100);
      assert.match(readTextFile(files.checkpoint), /Evidence coverage: 100% \(1\/1 scoped files\)/);
      assert.match(readTextFile(files.checkpoint), /Latest run status: passed/);
    },
  },
  {
    name: "workflow_update_task updates metadata and refreshes checkpoint state",
    async run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("mcp-tool-update-task");

      const result = await executeMcpTool(workspaceRoot, "workflow_update_task", {
        taskId,
        priority: "P0",
        status: "blocked",
        title: "Updated through MCP",
      });

      assert.equal(result.ok, true);
      assert.equal(result.tool, "workflow_update_task");
      assert.equal(result.task.id, taskId);
      assert.equal(result.task.title, "Updated through MCP");
      assert.equal(result.task.priority, "P0");
      assert.equal(result.task.status, "blocked");
      assert.equal(result.checkpointPath, `.agent-workflow/tasks/${taskId}/checkpoint.md`);
      assert.equal(readJsonFile(files.meta).status, "blocked");
      assert.match(readTextFile(files.checkpoint), /- Status: blocked/);
    },
  },
  {
    name: "workflow_append_note appends a timestamped progress note and refreshes checkpoint state",
    async run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("mcp-tool-append-note");

      const result = await executeMcpTool(workspaceRoot, "workflow_append_note", {
        taskId,
        note: "Found a race condition in auth.",
      });

      assert.equal(result.ok, true);
      assert.equal(result.tool, "workflow_append_note");
      assert.equal(result.taskId, taskId);
      assert.equal(result.contextPath, `.agent-workflow/tasks/${taskId}/context.md`);
      assert.match(result.timestamp, /^\d{4}-\d{2}-\d{2}T/);
      assert.match(readTextFile(files.context), /## Progress notes/);
      assert.match(readTextFile(files.context), /Found a race condition in auth\./);
      assert.ok(fs.existsSync(path.join(workspaceRoot, result.checkpointPath)));
    },
  },
  {
    name: "workflow_task_list returns task status, priority, run counts, and latest run details",
    async run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("mcp-tool-task-list");

      await executeMcpTool(workspaceRoot, "workflow_run_add", {
        taskId,
        summary: "Started through MCP.",
      });

      const result = await executeMcpTool(workspaceRoot, "workflow_task_list", {});
      const listedTask = result.tasks.find((item) => item.id === taskId);

      assert.equal(result.ok, true);
      assert.equal(result.tool, "workflow_task_list");
      assert.ok(listedTask);
      assert.equal(listedTask.status, "in_progress");
      assert.equal(listedTask.priority, "P1");
      assert.equal(listedTask.runCount, 1);
      assert.equal(listedTask.latestRunSummary, "Started through MCP.");
    },
  },
  {
    name: "workflow_run_add records a run, returns smart-default messages, and refreshes checkpoint state",
    async run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("mcp-tool-run-add");

      writeTextFile(path.join(workspaceRoot, "README.md"), "# MCP run:add\n");

      const result = await executeMcpTool(workspaceRoot, "workflow_run_add", {
        taskId,
        summary: "Manual run captured through MCP.",
        status: "passed",
        strict: true,
        proofPaths: ["README.md"],
        checks: [
          {
            label: "Reviewed README.md diff",
            status: "passed",
          },
        ],
      });

      assert.equal(result.ok, true);
      assert.equal(result.tool, "workflow_run_add");
      assert.equal(result.run.status, "passed");
      assert.ok(Array.isArray(result.run.scopeProofPaths));
      assert.ok(result.run.scopeProofPaths.includes("README.md"));
      assert.ok(Array.isArray(result.run.scopeProofAnchors));
      assert.equal(result.run.scopeProofAnchors.length, 1);
      assert.equal(result.checkpointPath, `.agent-workflow/tasks/${taskId}/checkpoint.md`);
      assert.ok(fs.existsSync(path.join(workspaceRoot, result.checkpointPath)));
    },
  },
  {
    name: "workflow_checkpoint refreshes checkpoint files for an existing task",
    async run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("mcp-tool-checkpoint");

      const result = await executeMcpTool(workspaceRoot, "workflow_checkpoint", {
        taskId,
      });

      assert.equal(result.ok, true);
      assert.equal(result.tool, "workflow_checkpoint");
      assert.equal(result.taskId, taskId);
      assert.equal(result.checkpoint.taskId, taskId);
      assert.ok(fs.existsSync(path.join(workspaceRoot, result.checkpointPath)));
    },
  },
  {
    name: "workflow_undo reverses the latest workflow-layer operation",
    async run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("mcp-tool-undo");

      await executeMcpTool(workspaceRoot, "workflow_run_add", {
        taskId,
        summary: "This run should be undone.",
      });

      const result = await executeMcpTool(workspaceRoot, "workflow_undo", {});

      assert.equal(result.ok, true);
      assert.equal(result.tool, "workflow_undo");
      assert.equal(result.undone, true);
      assert.equal(result.target, `run:add for ${taskId}`);
      assert.match(result.summary, /Undo target: run:add for T-001/);
    },
  },
  {
    name: "workflow_validate returns the shared schema validation report",
    async run() {
      const { workspaceRoot } = createTaskWorkspace("mcp-tool-validate");

      const result = await executeMcpTool(workspaceRoot, "workflow_validate", {
        strict: true,
      });

      assert.equal(result.tool, "workflow_validate");
      assert.equal(result.ok, true);
      assert.equal(result.errorCount, 0);
      assert.equal(result.strictVerification, true);
      assert.match(result.summary, /ok=true/);
    },
  },
  {
    name: "workflow_overview returns the shared workspace summary payload",
    async run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("mcp-tool-overview");
      writeTextFile(path.join(workspaceRoot, "README.md"), "# MCP overview\n");
      setTaskScope(files, ["README.md"]);

      await executeMcpTool(workspaceRoot, "workflow_run_add", {
        taskId,
        summary: "Overview proof captured.",
        status: "passed",
        proofPaths: ["README.md"],
        checks: ["Reviewed README.md diff"],
      });

      const result = await executeMcpTool(workspaceRoot, "workflow_overview", {});
      const task = result.tasks.find((item) => item.id === taskId);

      assert.equal(result.ok, true);
      assert.equal(result.tool, "workflow_overview");
      assert.equal(result.initialized, true);
      assert.ok(Array.isArray(result.tasks));
      assert.ok(task);
      assert.equal(task.coveragePercent, 100);
      assert.equal(result.stats.coveragePercent, 100);
      assert.ok(result.stats);
    },
  },
];

const suite = {
  name: "mcp-tools",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
