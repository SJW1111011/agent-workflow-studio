const assert = require("node:assert/strict");

const { getTaskCardToneClass, renderTaskBoardMarkup } = require("../dashboard/task-list-render-helpers.js");

const tests = [
  {
    name: "getTaskCardToneClass highlights passed, cancelled, and warning executor outcomes",
    run() {
      assert.equal(
        getTaskCardToneClass({ latestExecutorOutcome: "passed" }, { label: "executor passed", warn: false }),
        "task-card-executor-ok"
      );
      assert.equal(
        getTaskCardToneClass({ latestExecutorOutcome: "cancelled" }, { label: "executor cancelled", warn: false }),
        "task-card-executor-cancelled"
      );
      assert.equal(
        getTaskCardToneClass({ latestExecutorOutcome: "failed" }, { label: "executor failed", warn: true }),
        "task-card-executor-warn"
      );
      assert.equal(getTaskCardToneClass({ latestExecutorOutcome: "" }, null), "");
    },
  },
  {
    name: "renderTaskBoardMarkup filters tasks and keeps verification/executor summaries visible",
    run() {
      const view = renderTaskBoardMarkup(
        [
          {
            id: "T-001",
            title: "Passed task",
            priority: "P1",
            status: "in_progress",
            recipeId: "feature",
            latestRunSummary: "Latest run passed.",
            latestRunStatus: "passed",
            latestExecutorOutcome: "passed",
            latestExecutorSummary: "Executor completed with exit code 0.",
            latestExecutorAt: "2026-04-07T14:00:00.000Z",
            freshnessStatus: "fresh",
            staleDocCount: 0,
            verificationGateStatus: "covered",
            relevantChangeCount: 0,
            verificationSignalStatus: "strong",
            verificationSignalSummary: "Strong proof recorded.",
            hasCodexPrompt: true,
            hasClaudePrompt: false,
          },
          {
            id: "T-002",
            title: "Cancelled task",
            priority: "P2",
            status: "blocked",
            recipeId: "feature",
            latestRunSummary: "No runs yet",
            latestRunStatus: "draft",
            latestExecutorOutcome: "cancelled",
            latestExecutorSummary: "Cancelled from dashboard.",
            freshnessStatus: "stale",
            staleDocCount: 2,
            verificationGateStatus: "needs-proof",
            relevantChangeCount: 1,
            verificationSignalStatus: "draft",
            verificationSignalSummary: "Draft proof exists.",
            hasCodexPrompt: false,
            hasClaudePrompt: true,
          },
        ],
        {
          activeTaskId: "T-002",
          filterValue: "cancelled",
        }
      );

      assert.equal(view.normalizedFilter, "cancelled");
      assert.equal(view.visibleCount, 1);
      assert.match(view.summaryText, /Showing 1 of 2 tasks with executor outcome cancelled\./);
      assert.match(view.markup, /task-card-executor-cancelled/);
      assert.match(view.markup, /task-card .*active/);
      assert.match(view.markup, /Cancelled from dashboard\./);
      assert.match(view.markup, /Proof needed \(1\)/);
      assert.doesNotMatch(view.markup, /T-001 - Passed task/);
    },
  },
  {
    name: "renderTaskBoardMarkup returns the empty filtered state when nothing matches",
    run() {
      const view = renderTaskBoardMarkup(
        [
          {
            id: "T-001",
            title: "Only passed task",
            latestExecutorOutcome: "passed",
          },
        ],
        {
          activeTaskId: "T-001",
          filterValue: "failed",
        }
      );

      assert.equal(view.visibleCount, 0);
      assert.match(view.summaryText, /Showing 0 of 1 tasks with executor outcome failed\./);
      assert.match(view.markup, /No tasks match the current executor outcome filter\./);
    },
  },
];

module.exports = {
  name: "dashboard-task-list-render-helpers",
  tests,
};
