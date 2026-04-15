const assert = require("node:assert/strict");

const { appendTaskNote, listTasks, recordRun, updateTaskMeta } = require("../src/lib/task-service");
const { createTaskWorkspace, readJsonFile, readTextFile } = require("./test-helpers");

const tests = [
  {
    name: "recordRun auto-advances todo tasks to in_progress on the first recorded run",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("task-service-first-run");

      const run = recordRun(workspaceRoot, taskId, "Started work.", "draft", "manual");
      const listedTask = listTasks(workspaceRoot)[0];

      assert.equal(run.status, "draft");
      assert.equal(readJsonFile(files.meta).status, "in_progress");
      assert.equal(listedTask.status, "in_progress");
      assert.equal(listedTask.runCount, 1);
      assert.match(readTextFile(files.checkpoint), /- Status: in_progress/);
    },
  },
  {
    name: "recordRun keeps in_progress after later runs",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("task-service-repeat-run");

      recordRun(workspaceRoot, taskId, "Started work.", "draft", "manual");
      const secondRun = recordRun(workspaceRoot, taskId, "Captured a follow-up.", "failed", "manual");
      const listedTask = listTasks(workspaceRoot)[0];

      assert.equal(secondRun.status, "failed");
      assert.equal(readJsonFile(files.meta).status, "in_progress");
      assert.equal(listedTask.status, "in_progress");
      assert.equal(listedTask.runCount, 2);
    },
  },
  {
    name: "recordRun does not regress a manual done override after later evidence is recorded",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("task-service-manual-override");

      updateTaskMeta(workspaceRoot, taskId, { status: "done" });
      const run = recordRun(workspaceRoot, taskId, "Late follow-up note.", "draft", "manual");
      const listedTask = listTasks(workspaceRoot)[0];

      assert.equal(run.status, "draft");
      assert.equal(readJsonFile(files.meta).status, "done");
      assert.equal(listedTask.status, "done");
      assert.match(readTextFile(files.checkpoint), /- Status: done/);
    },
  },
  {
    name: "appendTaskNote appends timestamped notes under a dedicated progress notes section",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("task-service-progress-note");

      const result = appendTaskNote(workspaceRoot, taskId, "Found a race condition in auth.", {
        timestamp: "2026-04-15T08:00:00.000Z",
      });
      const contextText = readTextFile(files.context);

      assert.equal(result.taskId, taskId);
      assert.equal(result.timestamp, "2026-04-15T08:00:00.000Z");
      assert.match(contextText, /## Progress notes/);
      assert.match(contextText, /### 2026-04-15T08:00:00\.000Z/);
      assert.match(contextText, /Found a race condition in auth\./);
      assert.match(contextText, /## Constraints/);
      assert.ok(contextText.indexOf("## Progress notes") < contextText.indexOf("## Constraints"));
      assert.equal(readJsonFile(files.meta).updatedAt, "2026-04-15T08:00:00.000Z");
    },
  },
  {
    name: "updateTaskMeta rejects status regressions once a task is done",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("task-service-status-regression");

      updateTaskMeta(workspaceRoot, taskId, { status: "done" });

      assert.throws(
        () => updateTaskMeta(workspaceRoot, taskId, { status: "in_progress" }),
        (error) => {
          assert.equal(error.statusCode, 409);
          assert.equal(error.code, "task_status_regression");
          assert.match(error.message, /cannot regress to in_progress/);
          return true;
        }
      );
    },
  },
];

const suite = {
  name: "task-service",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
