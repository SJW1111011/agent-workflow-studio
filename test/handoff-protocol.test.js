const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { createResourceHandlers } = require("../src/lib/mcp-resources");
const { executeMcpTool } = require("../src/lib/mcp-tools");
const { getTaskDetail, listHandoffRecords } = require("../src/lib/task-service");
const {
  createTaskWorkspace,
  readJsonFile,
  readTextFile,
  writeJsonFile,
  writeTextFile,
} = require("./test-helpers");

function setTaskMeta(files, changes) {
  const meta = readJsonFile(files.meta);
  writeJsonFile(files.meta, {
    ...meta,
    ...changes,
  });
}

function parseTaskResource(workspaceRoot, taskId) {
  const handlers = createResourceHandlers(workspaceRoot);
  const result = handlers.readResource(`workflow://tasks/${taskId}`);
  assert.ok(Array.isArray(result.contents));
  return JSON.parse(result.contents[0].text);
}

const tests = [
  {
    name: "workflow_handoff writes an append-only record, refreshes checkpoint, and releases the task",
    async run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("handoff-protocol-record");
      setTaskMeta(files, {
        status: "in_progress",
        claimedBy: "claude-code",
      });

      const result = await executeMcpTool(workspaceRoot, "workflow_handoff", {
        taskId,
        agent: "claude",
        summary: "Completed the task-service storage path.",
        remaining: "Wire the MCP tool response and dashboard history.",
        filesModified: ["src/lib/task-service.js"],
      });

      assert.equal(result.ok, true);
      assert.equal(result.tool, "workflow_handoff");
      assert.equal(result.claimedBy, null);
      assert.equal(result.released, true);
      assert.match(result.handoff.id, /^handoff-\d+/);
      assert.equal(result.handoff.agent, "claude-code");
      assert.deepEqual(result.handoff.filesModified, ["src/lib/task-service.js"]);

      const persistedRecord = readJsonFile(path.join(workspaceRoot, result.handoffPath));
      assert.equal(persistedRecord.summary, "Completed the task-service storage path.");
      assert.equal(persistedRecord.remaining, "Wire the MCP tool response and dashboard history.");

      const meta = readJsonFile(files.meta);
      assert.equal(meta.status, "in_progress");
      assert.equal(meta.claimedBy, null);

      assert.match(readTextFile(files.checkpoint), /## Latest handoff/);
      assert.match(readTextFile(files.checkpoint), /Completed the task-service storage path\./);

      const detail = getTaskDetail(workspaceRoot, taskId);
      assert.equal(detail.handoffRecords.length, 1);
      assert.equal(detail.handoffRecords[0].agent, "claude-code");
    },
  },
  {
    name: "workflow_pickup claims a handed-off task and returns context plus evidence counts",
    async run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("handoff-protocol-pickup");
      writeTextFile(path.join(workspaceRoot, "README.md"), "# Pickup evidence\n");
      setTaskMeta(files, {
        status: "in_progress",
        scope: ["README.md"],
        claimedBy: "claude-code",
      });

      await executeMcpTool(workspaceRoot, "workflow_run_add", {
        taskId,
        agent: "claude",
        summary: "Verified README changes before handoff.",
        status: "passed",
        proofPaths: ["README.md"],
        checks: ["Reviewed README.md diff"],
      });

      await executeMcpTool(workspaceRoot, "workflow_handoff", {
        taskId,
        agent: "claude",
        summary: "README evidence is in place.",
        remaining: "Continue the dashboard handoff history.",
        filesModified: ["README.md"],
      });

      const result = await executeMcpTool(workspaceRoot, "workflow_pickup", {
        taskId,
        agent: "codex",
      });

      assert.equal(result.ok, true);
      assert.equal(result.tool, "workflow_pickup");
      assert.equal(result.agent, "codex");
      assert.equal(result.claimedBy, "codex");
      assert.equal(result.task.claimedBy, "codex");
      assert.equal(result.handoff.summary, "README evidence is in place.");
      assert.equal(result.handoff.remaining, "Continue the dashboard handoff history.");
      assert.match(result.taskText, /# T-001 - Test task/);
      assert.match(result.checkpointText, /README evidence is in place\./);
      assert.equal(result.evidenceSoFar.runs, 1);
      assert.equal(result.evidenceSoFar.handoffRecords, 1);
      assert.equal(result.evidenceSoFar.coveragePercent, 100);
      assert.equal(result.checkpoint.claimedBy, "codex");
      assert.equal(result.checkpoint.latestHandoff.summary, "README evidence is in place.");
      assert.equal(readJsonFile(files.meta).claimedBy, "codex");

      const resourcePayload = parseTaskResource(workspaceRoot, taskId);
      assert.equal(resourcePayload.claimedBy, "codex");
      assert.equal(resourcePayload.task.claimedBy, "codex");
      assert.equal(resourcePayload.handoffRecords.length, 1);
      assert.equal(resourcePayload.handoffRecords[0].remaining, "Continue the dashboard handoff history.");
    },
  },
  {
    name: "workflow_pickup can claim a fresh todo task without a prior handoff",
    async run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("handoff-protocol-fresh");

      const result = await executeMcpTool(workspaceRoot, "workflow_pickup", {
        taskId,
        agent: "codex",
      });

      assert.equal(result.ok, true);
      assert.equal(result.handoff, null);
      assert.equal(result.checkpoint.claimedBy, "codex");
      assert.equal(result.evidenceSoFar.runs, 0);
      assert.equal(result.evidenceSoFar.handoffRecords, 0);
      assert.equal(readJsonFile(files.meta).status, "todo");
      assert.equal(readJsonFile(files.meta).claimedBy, "codex");
    },
  },
  {
    name: "multiple rapid handoffs are stored as separate records",
    async run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("handoff-protocol-rapid");
      setTaskMeta(files, {
        status: "in_progress",
        claimedBy: "claude-code",
      });

      const originalNow = Date.now;
      Date.now = () => 1776000000000;
      try {
        await executeMcpTool(workspaceRoot, "workflow_handoff", {
          taskId,
          agent: "claude",
          summary: "First handoff.",
          remaining: "Pick up first remaining item.",
        });
        await executeMcpTool(workspaceRoot, "workflow_handoff", {
          taskId,
          agent: "claude",
          summary: "Second handoff.",
          remaining: "Pick up second remaining item.",
        });
      } finally {
        Date.now = originalNow;
      }

      const handoffFiles = fs
        .readdirSync(files.runs)
        .filter((fileName) => fileName.startsWith("handoff-") && fileName.endsWith(".json"))
        .sort();
      assert.deepEqual(handoffFiles, [
        "handoff-1776000000000-1.json",
        "handoff-1776000000000.json",
      ]);

      const records = listHandoffRecords(workspaceRoot, taskId);
      assert.equal(records.length, 2);
      assert.deepEqual(
        records.map((record) => record.summary).sort(),
        ["First handoff.", "Second handoff."]
      );
    },
  },
];

const suite = {
  name: "handoff-protocol",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
