const assert = require("node:assert/strict");

const {
  renderTaskDetailMarkup,
  renderVerificationGate,
} = require("../dashboard/task-detail-helpers.js");

const tests = [
  {
    name: "renderVerificationGate separates planned, weak, and strong proof signals",
    run() {
      const markup = renderVerificationGate(
        {
          summary: {
            status: "needs-proof",
            message: "One scoped change still needs explicit proof.",
            relevantChangeCount: 1,
          },
          repository: {
            scopedFileCount: 2,
          },
          evidence: {
            latestRunAt: "2026-04-07T10:00:00.000Z",
            verificationUpdatedAt: "2026-04-07T10:05:00.000Z",
            latestEvidenceAt: "2026-04-07T10:10:00.000Z",
          },
          scopeHints: [{ pattern: "docs/notes.md", source: "task.md#scope" }],
          scopeCoverage: {
            hintCount: 1,
            ambiguousCount: 1,
            ambiguousEntries: [{ value: "notes", source: "task.md#scope" }],
          },
          relevantChangedFiles: [
            {
              path: "docs/notes.md",
              changeType: "modified",
              gitState: "M",
              modifiedAt: "2026-04-07T10:15:00.000Z",
              matchedBy: [{ pattern: "docs/notes.md", source: "task.md#scope" }],
            },
          ],
          coveredScopedFiles: [
            {
              path: "README.md",
              proofUpdatedAt: "2026-04-07T10:20:00.000Z",
              matchedBy: [{ pattern: "README.md", source: "task.md#scope" }],
            },
          ],
          proofCoverage: {
            explicitProofCount: 2,
            weakProofCount: 1,
            anchoredStrongProofCount: 1,
            compatibilityStrongProofCount: 0,
            items: [
              {
                sourceType: "manual",
                sourceLabel: "verification.md#proof-1",
                recordedAt: "2026-04-07T10:30:00.000Z",
                paths: ["docs/notes.md"],
                checks: [],
                artifacts: [],
                strong: false,
              },
              {
                sourceType: "run",
                sourceLabel: "run-1",
                recordedAt: "2026-04-07T10:40:00.000Z",
                paths: ["README.md"],
                anchorCount: 1,
                checks: ["[passed] Reviewed README.md diff"],
                artifacts: [".agent-workflow/tasks/T-001/runs/run-1.stdout.log"],
                strong: true,
              },
            ],
          },
        },
        [
          "# T-001 Verification",
          "",
          "## Planned checks",
          "",
          "- manual: Review docs/notes.md diff",
          "",
        ].join("\n")
      );

      assert.match(markup, /Explicit proof needed/);
      assert.match(markup, /1 planned check\(s\)/);
      assert.match(markup, /1 draft proof item\(s\)/);
      assert.match(markup, /1 strong proof item\(s\)/);
      assert.match(markup, /1 anchor-backed strong proof item\(s\)/);
      assert.match(markup, /Proof freshness/);
      assert.match(markup, /docs\/notes\.md/);
      assert.match(markup, /README\.md/);
      assert.match(markup, /Scope Entries To Tighten/);
      assert.match(markup, /notes/);
    },
  },
  {
    name: "renderTaskDetailMarkup keeps task detail sections and execution ui wiring intact",
    run() {
      const markup = renderTaskDetailMarkup(
        {
          meta: {
            id: "T-001",
            title: "Refactor dashboard task detail",
            priority: "P1",
            status: "in_progress",
            recipeId: "feature",
          },
          recipe: {
            id: "feature",
            name: "Feature",
            summary: "Deliver value without breaking the workflow contract.",
          },
          generatedFiles: [
            { name: "prompt.codex.md", exists: true },
            { name: "launch.codex.md", exists: false },
          ],
          taskText: "# T-001 - Refactor dashboard task detail",
          contextText: "# T-001 Context",
          verificationText: "# T-001 Verification\n\n## Planned checks\n\n- manual: Review dashboard diff",
          checkpointText: "# T-001 Checkpoint",
          runs: [
            {
              id: "run-1",
              agent: "codex",
              status: "passed",
              source: "executor",
              adapterId: "codex",
              createdAt: "2026-04-07T11:00:00.000Z",
              completedAt: "2026-04-07T11:01:00.000Z",
              summary: "Execution completed successfully.",
              stdoutFile: ".agent-workflow/tasks/T-001/runs/run-1.stdout.log",
            },
          ],
          executionState: {
            taskId: "T-001",
            status: "running",
            adapterId: "codex",
            activity: "streaming-output",
            totalOutputBytes: 512,
            runId: "run-2",
            advisories: [
              {
                code: "runner-command-resolved",
                message: "Runner command for codex resolves locally: C:/tools/codex.cmd",
              },
            ],
            stdoutFile: ".agent-workflow/tasks/T-001/runs/run-2.stdout.log",
            streams: {
              stdout: {
                stream: "stdout",
                exists: true,
                size: 512,
                updatedAt: "2026-04-07T11:02:00.000Z",
              },
            },
          },
          schemaIssues: [
            {
              level: "warn",
              code: "task-missing-proof",
              message: "Scoped changes still need proof.",
              target: ".agent-workflow/tasks/T-001/verification.md",
            },
          ],
          freshness: {
            summary: {
              status: "stale",
              message: "verification.md is older than the latest evidence.",
              staleCount: 1,
            },
            docs: [
              {
                name: "verification.md",
                status: "stale",
                reason: "Older than latest run evidence.",
                relativePath: ".agent-workflow/tasks/T-001/verification.md",
                modifiedAt: "2026-04-07T10:00:00.000Z",
              },
            ],
          },
          verificationGate: {
            summary: {
              status: "covered",
              message: "Scoped changes are covered.",
              relevantChangeCount: 1,
            },
            repository: {
              scopedFileCount: 1,
            },
            scopeCoverage: {
              hintCount: 1,
              ambiguousCount: 0,
              ambiguousEntries: [],
            },
            scopeHints: [{ pattern: "dashboard/app.js", source: "task.md#scope" }],
            relevantChangedFiles: [
              {
                path: "dashboard/app.js",
                changeType: "modified",
                gitState: "M",
                modifiedAt: "2026-04-07T11:05:00.000Z",
                matchedBy: [{ pattern: "dashboard/app.js", source: "task.md#scope" }],
              },
            ],
            coveredScopedFiles: [
              {
                path: "dashboard/app.js",
                proofUpdatedAt: "2026-04-07T11:06:00.000Z",
                proofFreshnessSource: "compatibility-only",
                matchedBy: [{ pattern: "dashboard/app.js", source: "task.md#scope" }],
              },
            ],
            proofCoverage: {
              explicitProofCount: 1,
              weakProofCount: 0,
              anchoredStrongProofCount: 0,
              compatibilityStrongProofCount: 1,
              items: [
                {
                  sourceType: "run",
                  sourceLabel: "run-1",
                  recordedAt: "2026-04-07T11:06:00.000Z",
                  paths: ["dashboard/app.js"],
                  anchorCount: 0,
                  checks: ["[passed] Reviewed dashboard/app.js diff"],
                  artifacts: [".agent-workflow/tasks/T-001/runs/run-1.stdout.log"],
                  strong: true,
                },
              ],
            },
            evidence: {
              latestRunAt: "2026-04-07T11:01:00.000Z",
              verificationUpdatedAt: "2026-04-07T11:06:00.000Z",
              latestEvidenceAt: "2026-04-07T11:06:00.000Z",
            },
          },
        },
        {
          executionLogTaskId: "T-001",
          executionLogOpenStreams: new Set(["stdout"]),
        }
      );

      assert.match(markup, /Task Brief/);
      assert.match(markup, /Execution Bridge/);
      assert.match(markup, /Hide stdout/);
      assert.match(markup, /id="execution-log-stdout"/);
      assert.match(markup, /View stdout/);
      assert.match(markup, /Freshness/);
      assert.match(markup, /Verification Gate/);
      assert.match(markup, /Scoped diff is covered/);
      assert.match(markup, /compatibility-only/);
      assert.match(markup, /task-missing-proof/);
      assert.match(markup, /Runner command for codex resolves locally/);
    },
  },
];

const suite = {
  name: "dashboard-task-detail-helpers",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
