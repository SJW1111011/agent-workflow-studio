const assert = require("node:assert/strict");

const {
  buildExecutionCompletionStatus,
  buildExecutionUiView,
  resolveNextActiveTaskId,
  resolveSelectedExecutionContext,
} = require("../dashboard/orchestration-state-helpers.js");

const tests = [
  {
    name: "resolveSelectedExecutionContext prefers the incoming state, then task detail state, then idle fallback",
    run() {
      const activeTaskDetail = {
        meta: { id: "T-001" },
        executionState: {
          taskId: "T-001",
          status: "running",
        },
      };

      const direct = resolveSelectedExecutionContext(activeTaskDetail, {
        taskId: "T-001",
        status: "completed",
      });
      assert.equal(direct.selectedTaskId, "T-001");
      assert.equal(direct.state.status, "completed");

      const fallback = resolveSelectedExecutionContext(activeTaskDetail, {
        taskId: "T-002",
        status: "completed",
      });
      assert.equal(fallback.state.status, "running");

      const idle = resolveSelectedExecutionContext({ meta: { id: "T-003" } }, null);
      assert.equal(idle.state.status, "idle");
    },
  },
  {
    name: "buildExecutionUiView derives status text and button disabled states",
    run() {
      const runningView = buildExecutionUiView({
        selectedTaskId: "T-001",
        state: { status: "running" },
        renderExecutionStateSummary() {
          return "Execution is running.";
        },
        isActiveExecutionState(value) {
          return value && value.status === "running";
        },
      });

      assert.equal(runningView.statusText, "Execution is running.");
      assert.equal(runningView.executeDisabled, true);
      assert.equal(runningView.cancelDisabled, false);

      const emptyView = buildExecutionUiView({
        selectedTaskId: "",
        state: null,
      });

      assert.match(emptyView.statusText, /Select a task/);
      assert.equal(emptyView.executeDisabled, true);
      assert.equal(emptyView.cancelDisabled, true);
    },
  },
  {
    name: "resolveNextActiveTaskId prefers requested, then current, then the first task",
    run() {
      const tasks = [{ id: "T-001" }, { id: "T-002" }, { id: "T-003" }];

      assert.equal(resolveNextActiveTaskId(tasks, "T-002", "T-001"), "T-002");
      assert.equal(resolveNextActiveTaskId(tasks, "T-999", "T-003"), "T-003");
      assert.equal(resolveNextActiveTaskId(tasks, "", ""), "T-001");
      assert.equal(resolveNextActiveTaskId([], "T-001", "T-002"), null);
    },
  },
  {
    name: "buildExecutionCompletionStatus maps completed and failed-to-start states into action messages",
    run() {
      const passed = buildExecutionCompletionStatus(
        {
          status: "completed",
          summary: "Execution completed successfully.",
        },
        "T-001",
        () => ({
          summary: "Execution completed successfully.",
          statusLabel: "passed",
        })
      );
      const cancelled = buildExecutionCompletionStatus(
        {
          status: "completed",
          summary: "Cancelled from dashboard.",
        },
        "T-002",
        () => ({
          summary: "Cancelled from dashboard.",
          statusLabel: "cancelled",
        })
      );
      const failedToStart = buildExecutionCompletionStatus(
        {
          status: "failed-to-start",
          error: "Adapter command is missing.",
        },
        "T-003"
      );

      assert.equal(passed.tone, "success");
      assert.match(passed.message, /T-001/);
      assert.equal(cancelled.tone, "");
      assert.match(cancelled.message, /Cancelled from dashboard for T-002\./);
      assert.equal(failedToStart.tone, "error");
      assert.match(failedToStart.message, /Adapter command is missing\./);
    },
  },
];

module.exports = {
  name: "dashboard-orchestration-state-helpers",
  tests,
};
