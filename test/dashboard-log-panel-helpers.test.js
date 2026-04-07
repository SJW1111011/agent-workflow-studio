const assert = require("node:assert/strict");

const {
  clearExecutionLogState,
  createExecutionLogState,
  ensureExecutionLogTaskState,
  hasOpenExecutionLogStreams,
  isExecutionLogStreamOpen,
  loadResolvedExecutionLog,
  renderExecutionLogView,
  renderRunLogView,
  toggleExecutionLogStreamState,
} = require("../dashboard/log-panel-helpers.js");

const tests = [
  {
    name: "execution log state resets streams when the selected task changes",
    run() {
      let state = createExecutionLogState("T-001", ["stdout"]);

      assert.equal(hasOpenExecutionLogStreams(state, "T-001"), true);
      assert.equal(isExecutionLogStreamOpen(state, "T-001", "stdout"), true);

      state = ensureExecutionLogTaskState(state, "T-002");

      assert.equal(state.taskId, "T-002");
      assert.equal(state.openStreams.size, 0);
      assert.equal(hasOpenExecutionLogStreams(state, "T-001"), false);
    },
  },
  {
    name: "toggleExecutionLogStreamState adds and removes streams for the active task",
    run() {
      let state = clearExecutionLogState("T-003");

      state = toggleExecutionLogStreamState(state, "T-003", "stdout");
      assert.equal(isExecutionLogStreamOpen(state, "T-003", "stdout"), true);

      state = toggleExecutionLogStreamState(state, "T-003", "stderr");
      assert.equal(isExecutionLogStreamOpen(state, "T-003", "stderr"), true);

      state = toggleExecutionLogStreamState(state, "T-003", "stdout");
      assert.equal(isExecutionLogStreamOpen(state, "T-003", "stdout"), false);
      assert.equal(isExecutionLogStreamOpen(state, "T-003", "stderr"), true);
    },
  },
  {
    name: "loadResolvedExecutionLog normalizes run and active execution sources",
    async run() {
      const runLog = await loadResolvedExecutionLog(
        {
          kind: "run",
          taskId: "T-001",
          runId: "run-1",
          stream: "stdout",
        },
        {
          loadRunLog(taskId, runId, stream) {
            return Promise.resolve({
              taskId,
              runId,
              stream,
              path: `.agent-workflow/tasks/${taskId}/runs/${runId}.${stream}.log`,
              content: "persisted output",
            });
          },
        }
      );

      assert.equal(runLog.source, "run");
      assert.equal(runLog.active, false);
      assert.equal(runLog.pending, false);

      const executionLog = await loadResolvedExecutionLog(
        {
          kind: "execution",
          taskId: "T-001",
          stream: "stderr",
        },
        {
          loadTaskExecutionLog(taskId, stream) {
            return Promise.resolve({
              taskId,
              stream,
              path: `.agent-workflow/tasks/${taskId}/execution.${stream}.log`,
              content: "live output",
              active: true,
            });
          },
        }
      );

      assert.equal(executionLog.source, "execution");
      assert.equal(executionLog.active, true);
      assert.equal(executionLog.content, "live output");
    },
  },
  {
    name: "renderExecutionLogView and renderRunLogView keep log messaging explicit",
    run() {
      const executionMarkup = renderExecutionLogView(
        {
          source: "execution",
          path: ".agent-workflow/tasks/T-001/execution.stdout.log",
          content: "hello world",
          active: true,
          updatedAt: "2026-04-07T12:00:00.000Z",
        },
        "stdout",
        (value) => `Updated ${value}`
      );
      const runMarkup = renderRunLogView({
        path: ".agent-workflow/tasks/T-001/runs/run-1.stdout.log",
        content: "persisted output",
        truncated: true,
        size: 120,
      });

      assert.match(executionMarkup, /Reading live stdout output from the active local execution/);
      assert.match(executionMarkup, /Auto-refreshing Updated 2026-04-07T12:00:00.000Z/);
      assert.match(runMarkup, /Showing last 16 of 120 chars/);
      assert.match(runMarkup, /persisted output/);
    },
  },
];

module.exports = {
  name: "dashboard-log-panel-helpers",
  tests,
};
