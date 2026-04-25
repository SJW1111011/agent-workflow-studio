const assert = require("node:assert/strict");

const { createResourceHandlers } = require("../src/lib/mcp-resources");
const { executeMcpTool } = require("../src/lib/mcp-tools");
const { createTask } = require("../src/lib/task-service");
const { taskFiles } = require("../src/lib/workspace");
const { createTaskWorkspace, readJsonFile, writeJsonFile } = require("./test-helpers");

function setTaskMeta(workspaceRoot, taskId, changes) {
  const files = taskFiles(workspaceRoot, taskId);
  const meta = readJsonFile(files.meta);
  writeJsonFile(files.meta, {
    ...meta,
    ...changes,
  });
  return files;
}

function createAdditionalTask(workspaceRoot, taskId, title, changes = {}) {
  createTask(workspaceRoot, taskId, title, {
    priority: changes.priority || "P2",
    recipe: "feature",
  });
  return setTaskMeta(workspaceRoot, taskId, changes);
}

function readJsonResource(workspaceRoot, uri) {
  const result = createResourceHandlers(workspaceRoot).readResource(uri);
  assert.ok(Array.isArray(result.contents));
  return JSON.parse(result.contents[0].text);
}

const tests = [
  {
    name: "workflow://queue returns available tasks sorted by priority and age",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("task-queue-sort");

      setTaskMeta(workspaceRoot, taskId, {
        title: "P2 unclaimed",
        priority: "P2",
        status: "todo",
        createdAt: "2026-01-03T00:00:00.000Z",
        claimedBy: null,
        claimExpiry: null,
      });
      createAdditionalTask(workspaceRoot, "T-002", "P0 newer", {
        priority: "P0",
        status: "todo",
        createdAt: "2026-01-02T00:00:00.000Z",
      });
      createAdditionalTask(workspaceRoot, "T-003", "P0 expired", {
        priority: "P0",
        status: "in_progress",
        createdAt: "2026-01-01T00:00:00.000Z",
        claimedBy: "claude-code",
        claimExpiry: "2000-01-01T00:00:00.000Z",
      });
      createAdditionalTask(workspaceRoot, "T-004", "P1 active claim", {
        priority: "P1",
        status: "in_progress",
        createdAt: "2026-01-01T00:00:00.000Z",
        claimedBy: "codex",
        claimExpiry: "2999-01-01T00:00:00.000Z",
      });
      createAdditionalTask(workspaceRoot, "T-005", "Done task", {
        priority: "P0",
        status: "done",
        createdAt: "2026-01-01T00:00:00.000Z",
      });

      const queue = readJsonResource(workspaceRoot, "workflow://queue");

      assert.deepEqual(
        queue.tasks.map((task) => task.id),
        ["T-003", "T-002", "T-001"]
      );
      assert.equal(queue.tasks[0].claimedBy, null);
      assert.equal(queue.tasks[0].trustScore, 0);
      assert.equal(queue.tasks[0].status, "in_progress");
      assert.equal(queue.tasks[1].priority, "P0");
    },
  },
  {
    name: "workflow_claim_task locks a task and workflow_release_task clears the claim",
    async run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("task-queue-claim-release");
      const beforeClaim = Date.now();

      const claim = await executeMcpTool(workspaceRoot, "workflow_claim_task", {
        taskId,
        agent: "codex",
        claimDuration: 60,
      });

      assert.equal(claim.ok, true);
      assert.equal(claim.tool, "workflow_claim_task");
      assert.equal(claim.claimedBy, "codex");
      assert.equal(claim.task.status, "in_progress");
      assert.equal(readJsonFile(files.meta).claimedBy, "codex");
      assert.ok(Date.parse(claim.claimExpiry) >= beforeClaim + 59000);

      await assert.rejects(
        () =>
          executeMcpTool(workspaceRoot, "workflow_claim_task", {
            taskId,
            agent: "claude",
          }),
        {
          code: "task_already_claimed",
          statusCode: 409,
        }
      );

      await assert.rejects(
        () =>
          executeMcpTool(workspaceRoot, "workflow_release_task", {
            taskId,
            agent: "claude",
          }),
        {
          code: "task_claimed_by_other_agent",
          statusCode: 409,
        }
      );

      const release = await executeMcpTool(workspaceRoot, "workflow_release_task", {
        taskId,
        agent: "codex",
      });

      assert.equal(release.ok, true);
      assert.equal(release.released, true);
      assert.equal(release.claimedBy, null);
      assert.equal(readJsonFile(files.meta).claimedBy, null);
      assert.equal(readJsonFile(files.meta).claimExpiry, null);

      const noopRelease = await executeMcpTool(workspaceRoot, "workflow_release_task", {
        taskId,
        agent: "codex",
      });
      assert.equal(noopRelease.ok, true);
      assert.equal(noopRelease.released, false);
    },
  },
  {
    name: "expired claims are treated as unclaimed and can be reclaimed",
    async run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("task-queue-expired-claim");
      setTaskMeta(workspaceRoot, taskId, {
        status: "in_progress",
        claimedBy: "claude-code",
        claimExpiry: "2000-01-01T00:00:00.000Z",
      });

      const detail = readJsonResource(workspaceRoot, `workflow://tasks/${taskId}`);
      assert.equal(detail.claimedBy, null);
      assert.equal(detail.claimExpired, true);
      assert.equal(detail.task.claimedBy, null);
      assert.equal(readJsonFile(files.meta).claimedBy, "claude-code");

      const claim = await executeMcpTool(workspaceRoot, "workflow_claim_task", {
        taskId,
        agent: "codex",
      });

      assert.equal(claim.ok, true);
      assert.equal(claim.claimedBy, "codex");
      assert.equal(readJsonFile(files.meta).claimedBy, "codex");
      assert.ok(Date.parse(readJsonFile(files.meta).claimExpiry) > Date.now());

      const queue = readJsonResource(workspaceRoot, "workflow://queue");
      assert.deepEqual(queue.tasks, []);
    },
  },
  {
    name: "workflow_pickup sets claimExpiry while preserving existing pickup status behavior",
    async run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("task-queue-pickup-expiry");

      const pickup = await executeMcpTool(workspaceRoot, "workflow_pickup", {
        taskId,
        agent: "codex",
      });
      const meta = readJsonFile(files.meta);

      assert.equal(pickup.ok, true);
      assert.equal(pickup.claimedBy, "codex");
      assert.equal(meta.status, "todo");
      assert.equal(meta.claimedBy, "codex");
      assert.ok(Date.parse(meta.claimExpiry) > Date.now());
    },
  },
];

const suite = {
  name: "task-queue",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
