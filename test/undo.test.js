const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { main } = require("../src/cli");
const { createRunRecord, listRuns, persistRunRecord } = require("../src/lib/task-service");
const { quickCreateTask } = require("../src/lib/quick-task");
const { appendUndoEntry, readUndoLog } = require("../src/lib/undo-log");
const {
  createTaskWorkspace,
  readJsonFile,
  readTextFile,
  writeJsonFile,
  writeTextFile,
} = require("./test-helpers");

function captureCliIo(callback) {
  let stdout = "";
  let stderr = "";
  const originalStdoutWrite = process.stdout.write;
  const originalConsoleError = console.error;
  const originalExitCode = process.exitCode;

  process.stdout.write = (chunk, encoding, done) => {
    stdout += String(chunk);
    if (typeof done === "function") {
      done();
    }
    return true;
  };

  console.error = (...args) => {
    stderr += `${args.map((item) => String(item)).join(" ")}\n`;
  };

  process.exitCode = 0;

  try {
    callback();
    return {
      stdout,
      stderr,
      exitCode: process.exitCode || 0,
    };
  } finally {
    process.stdout.write = originalStdoutWrite;
    console.error = originalConsoleError;
    process.exitCode = originalExitCode;
  }
}

const tests = [
  {
    name: "cli undo removes the latest lite quick task directory",
    run() {
      const { workspaceRoot } = createTaskWorkspace("undo-quick");
      const taskRoot = path.join(workspaceRoot, ".agent-workflow", "tasks", "T-002");

      quickCreateTask(workspaceRoot, "Undo the latest quick task", {
        taskId: "T-002",
        mode: "lite",
      });

      assert.equal(fs.existsSync(taskRoot), true);

      const result = captureCliIo(() => {
        main(["undo", "--root", workspaceRoot]);
      });

      assert.equal(fs.existsSync(taskRoot), false);
      assert.match(result.stdout, /Undo target: quick for T-002/);
      assert.match(result.stdout, /Undid quick for T-002\./);
      assert.equal(readUndoLog(workspaceRoot).length, 0);
    },
  },
  {
    name: "cli undo removes the latest run:add record and restores prior workflow files",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("undo-run-add");
      const checkpointJsonPath = path.join(workspaceRoot, ".agent-workflow", "tasks", taskId, "checkpoint.json");
      const originalTaskMeta = readTextFile(files.meta);
      const originalVerification = readTextFile(files.verification);
      const originalCheckpoint = readTextFile(files.checkpoint);

      assert.equal(fs.existsSync(checkpointJsonPath), false);

      captureCliIo(() => {
        main(["run:add", taskId, "Recorded a run that should be undone.", "--root", workspaceRoot]);
      });

      assert.equal(listRuns(workspaceRoot, taskId).length, 1);
      assert.equal(readJsonFile(files.meta).status, "in_progress");
      assert.equal(fs.existsSync(checkpointJsonPath), true);

      const undoResult = captureCliIo(() => {
        main(["undo", "--root", workspaceRoot]);
      });

      assert.equal(listRuns(workspaceRoot, taskId).length, 0);
      assert.equal(readTextFile(files.meta), originalTaskMeta);
      assert.equal(readTextFile(files.verification), originalVerification);
      assert.equal(readTextFile(files.checkpoint), originalCheckpoint);
      assert.equal(fs.existsSync(checkpointJsonPath), false);
      assert.match(undoResult.stdout, /Undo target: run:add for T-001/);
    },
  },
  {
    name: "cli undo removes the latest done record and restores the previous task status and checkpoint",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("undo-done");
      const checkpointJsonPath = path.join(workspaceRoot, ".agent-workflow", "tasks", taskId, "checkpoint.json");
      const originalTaskMeta = readTextFile(files.meta);
      const originalVerification = readTextFile(files.verification);
      const originalCheckpoint = readTextFile(files.checkpoint);

      captureCliIo(() => {
        main(["done", taskId, "Completed and should be undone.", "--status", "passed", "--complete", "--root", workspaceRoot]);
      });

      assert.equal(listRuns(workspaceRoot, taskId).length, 1);
      assert.equal(readJsonFile(files.meta).status, "done");
      assert.equal(fs.existsSync(checkpointJsonPath), true);

      const undoResult = captureCliIo(() => {
        main(["undo", "--root", workspaceRoot]);
      });

      assert.equal(listRuns(workspaceRoot, taskId).length, 0);
      assert.equal(readTextFile(files.meta), originalTaskMeta);
      assert.equal(readTextFile(files.verification), originalVerification);
      assert.equal(readTextFile(files.checkpoint), originalCheckpoint);
      assert.equal(fs.existsSync(checkpointJsonPath), false);
      assert.match(undoResult.stdout, /Undo target: done for T-001/);
    },
  },
  {
    name: "cli undo restores the previous checkpoint files after an explicit checkpoint command",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("undo-checkpoint");
      const checkpointRoot = path.join(workspaceRoot, ".agent-workflow", "tasks", taskId);
      const checkpointMarkdownPath = path.join(checkpointRoot, "checkpoint.md");
      const checkpointJsonPath = path.join(checkpointRoot, "checkpoint.json");
      const originalCheckpointMarkdown = "# Restored checkpoint\n";
      const originalCheckpointJson = {
        taskId,
        generatedAt: "2026-04-14T00:00:00.000Z",
        latestRunStatus: "none",
        runCount: 0,
      };

      writeTextFile(checkpointMarkdownPath, originalCheckpointMarkdown);
      writeJsonFile(checkpointJsonPath, originalCheckpointJson);

      captureCliIo(() => {
        main(["checkpoint", taskId, "--root", workspaceRoot]);
      });

      assert.notEqual(readTextFile(checkpointMarkdownPath), originalCheckpointMarkdown);
      assert.notDeepEqual(readJsonFile(checkpointJsonPath), originalCheckpointJson);

      const undoResult = captureCliIo(() => {
        main(["undo", "--root", workspaceRoot]);
      });

      assert.equal(readTextFile(checkpointMarkdownPath), originalCheckpointMarkdown);
      assert.deepEqual(readJsonFile(checkpointJsonPath), originalCheckpointJson);
      assert.match(undoResult.stdout, /Undo target: checkpoint for T-001/);
    },
  },
  {
    name: "cli undo prints Nothing to undo when the log is empty",
    run() {
      const { workspaceRoot } = createTaskWorkspace("undo-empty-log");

      const result = captureCliIo(() => {
        main(["undo", "--root", workspaceRoot]);
      });

      assert.equal(result.stdout.trim(), "Nothing to undo");
      assert.equal(result.exitCode, 0);
    },
  },
  {
    name: "cli undo refuses to delete a quick-created task that already has runs",
    run() {
      const { workspaceRoot } = createTaskWorkspace("undo-quick-runs");

      quickCreateTask(workspaceRoot, "Quick task with later runs", {
        taskId: "T-002",
        mode: "lite",
      });

      persistRunRecord(
        workspaceRoot,
        "T-002",
        createRunRecord("T-002", {
          status: "draft",
          summary: "Manual run persisted without a new undo entry.",
        })
      );

      const result = captureCliIo(() => {
        main(["undo", "--root", workspaceRoot]);
      });

      assert.equal(result.exitCode, 1);
      assert.match(result.stderr, /Refusing to undo quick for T-002 because the task already has recorded runs\./);
      assert.equal(fs.existsSync(path.join(workspaceRoot, ".agent-workflow", "tasks", "T-002")), true);
      assert.equal(readUndoLog(workspaceRoot).slice(-1)[0].type, "quick");
    },
  },
  {
    name: "undo log keeps only the latest 20 entries",
    run() {
      const { workspaceRoot } = createTaskWorkspace("undo-log-cap");

      for (let index = 0; index < 25; index += 1) {
        appendUndoEntry(workspaceRoot, {
          type: "checkpoint",
          taskId: "T-001",
          timestamp: `2026-04-14T00:00:${String(index).padStart(2, "0")}.000Z`,
          files: [".agent-workflow/tasks/T-001/checkpoint.md"],
          metadata: {
            restore: [],
          },
        });
      }

      const entries = readUndoLog(workspaceRoot);
      assert.equal(entries.length, 20);
      assert.equal(entries[0].timestamp, "2026-04-14T00:00:05.000Z");
      assert.equal(entries[19].timestamp, "2026-04-14T00:00:24.000Z");
    },
  },
];

const suite = {
  name: "undo",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
