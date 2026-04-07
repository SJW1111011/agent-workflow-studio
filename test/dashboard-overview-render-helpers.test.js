const assert = require("node:assert/strict");

const {
  renderMemoryMarkup,
  renderRunsMarkup,
  renderStatsMarkup,
  renderValidationMarkup,
  renderVerificationMarkup,
} = require("../dashboard/overview-render-helpers.js");

const tests = [
  {
    name: "renderStatsMarkup includes base stats plus executor and verification breakdown cards",
    run() {
      const markup = renderStatsMarkup(
        {
          tasks: 4,
          runs: 9,
          risks: 2,
          memoryDocs: 5,
          executorOutcomes: {
            passed: 1,
            failed: 1,
            timedOut: 0,
            interrupted: 0,
            cancelled: 1,
            none: 1,
          },
          verificationSignals: {
            strong: 1,
            mixed: 1,
            draft: 0,
            planned: 1,
            none: 1,
          },
        },
        {
          escapeHtml(value) {
            return String(value);
          },
          normalizeStatCount(value) {
            return Number(value) || 0;
          },
          renderExecutorOutcomeStatCard(totalTasks) {
            return `<article class="stat-card helper-card">executor ${totalTasks}</article>`;
          },
          renderVerificationSignalStatCard(totalTasks) {
            return `<article class="stat-card helper-card">verification ${totalTasks}</article>`;
          },
        }
      );

      assert.match(markup, /<h3>Tasks<\/h3>/);
      assert.match(markup, /<strong>4<\/strong>/);
      assert.match(markup, /executor 4/);
      assert.match(markup, /verification 4/);
    },
  },
  {
    name: "render section markups keep warning and outcome labels visible",
    run() {
      const memoryMarkup = renderMemoryMarkup(
        [
          {
            name: "architecture.md",
            relativePath: ".agent-workflow/memory/architecture.md",
            freshnessReason: "Older than the latest run evidence.",
            freshnessStatus: "stale",
            size: 120,
            modifiedAt: "2026-04-07T13:00:00.000Z",
          },
        ],
        (value) => `Updated ${value}`
      );
      const verificationMarkup = renderVerificationMarkup(
        [
          {
            taskId: "T-001",
            summary: "One scoped file still needs proof.",
            status: "needs-proof",
            relevantChangeCount: 1,
          },
        ],
        (status) => status === "needs-proof"
      );
      const runsMarkup = renderRunsMarkup(
        [
          {
            taskId: "T-001",
            agent: "codex",
            createdAt: "2026-04-07T13:10:00.000Z",
            source: "executor",
            adapterId: "codex",
            exitCode: 1,
          },
        ],
        () => ({
          label: "failed",
          warn: true,
          summary: "Execution failed.",
          detail: "Exit code 1.",
        })
      );
      const validationMarkup = renderValidationMarkup({
        ok: false,
        errorCount: 1,
        warningCount: 2,
        issues: [
          {
            level: "error",
            code: "task-invalid",
            message: "Task metadata is malformed.",
            target: ".agent-workflow/tasks/T-001/task.json",
          },
        ],
      });

      assert.match(memoryMarkup, /architecture\.md/);
      assert.match(memoryMarkup, /Updated 2026-04-07T13:00:00.000Z/);
      assert.match(verificationMarkup, /needs-proof/);
      assert.match(verificationMarkup, /1 changed file\(s\)/);
      assert.match(runsMarkup, /failed/);
      assert.match(runsMarkup, /Exit code 1\./);
      assert.match(validationMarkup, /Schema issues detected/);
      assert.match(validationMarkup, /task-invalid/);
    },
  },
];

module.exports = {
  name: "dashboard-overview-render-helpers",
  tests,
};
