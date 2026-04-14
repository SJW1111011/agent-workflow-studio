const assert = require("node:assert/strict");

const { listTasks, recordRun, updateTaskMeta } = require("../src/lib/task-service");
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
