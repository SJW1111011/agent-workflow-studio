const assert = require("node:assert/strict");
const path = require("path");

const { main } = require("../src/cli");
const { formatMemoryValidationSummary, validateMemoryDocs } = require("../src/lib/memory-validator");
const { createTaskWorkspace, writeTextFile } = require("./test-helpers");

const tests = [
  {
    name: "validateMemoryDocs flags untouched scaffold placeholders as blocking errors",
    run() {
      const { workspaceRoot } = createTaskWorkspace("memory-validate-scaffold");

      const report = validateMemoryDocs(workspaceRoot);

      assert.equal(report.ok, false);
      assert.equal(report.placeholderDocCount, 4);
      assert.equal(report.errorCount, 4);
      assert.match(formatMemoryValidationSummary(report), /Memory docs still need cleanup/);
      assert.equal(
        report.issues.filter((issue) => issue.code === "memory.placeholder").length,
        4
      );
    },
  },
  {
    name: "validateMemoryDocs warns about empty sections and machine-specific absolute paths in grounded docs",
    run() {
      const { workspaceRoot } = createTaskWorkspace("memory-validate-warnings");
      const memoryDir = path.join(workspaceRoot, ".agent-workflow", "memory");

      writeTextFile(
        path.join(memoryDir, "product.md"),
        `# Product Memory

## Product truth

- We help maintainers audit agent output before shipping.

## Current constraints

- Technical constraints: keep the workflow state file-based and portable.

## Known gaps

- 

## Notes

- Local debugging often happens under C:\\Users\\lenovo\\Desktop\\agent-workflow-studio.
`
      );
      writeTextFile(
        path.join(memoryDir, "architecture.md"),
        `# Architecture Memory

## Current architecture

- Core workflow state lives under .agent-workflow/.
- The dashboard reads files directly from the workspace root.

## Fragile areas

- Real CLI adapter invocation differs by platform.

## Invariants

- Generated workflow files must stay relocatable.
`
      );
      writeTextFile(
        path.join(memoryDir, "domain-rules.md"),
        `# Domain Rules

## Rules that must stay true

- Verification must cite repo-relative evidence.

## Contract assumptions

- Git-backed repos provide the strongest freshness signals.

## Forbidden shortcuts

- Never fake proof or fabricated test outcomes.
`
      );
      writeTextFile(
        path.join(memoryDir, "runbook.md"),
        `# Runbook

## Standard loops

1. scan
2. create or update task
3. compile prompt
4. execute
5. record evidence
6. checkpoint

## Verification expectations

- Every shipped change should leave durable proof.
`
      );

      const report = validateMemoryDocs(workspaceRoot);

      assert.equal(report.ok, true);
      assert.equal(report.errorCount, 0);
      assert.equal(report.warningCount, 2);
      assert.ok(report.issues.some((issue) => issue.code === "memory.section.incomplete"));
      assert.ok(report.issues.some((issue) => issue.code === "memory.absolutePath"));
    },
  },
  {
    name: "validateMemoryDocs accepts grounded memory docs without warnings",
    run() {
      const { workspaceRoot } = createTaskWorkspace("memory-validate-clean");
      const memoryDir = path.join(workspaceRoot, ".agent-workflow", "memory");

      writeTextFile(
        path.join(memoryDir, "product.md"),
        `# Product Memory

## Product truth

- This tool turns task context, run evidence, and checkpoints into durable local workflow state.

## Current constraints

- Technical constraints: stay zero-dependency and file-based.
- Operational constraints: preserve repo-relative artifacts.

## Open questions

- 
`
      );
      writeTextFile(
        path.join(memoryDir, "architecture.md"),
        `# Architecture Memory

## Current architecture

- The CLI and dashboard both operate against the same .agent-workflow files.

## Fragile areas

- Real adapter execution varies across shells and operating systems.

## Invariants

- The dashboard must stay a thin control plane over shared workflow logic.
`
      );
      writeTextFile(
        path.join(memoryDir, "domain-rules.md"),
        `# Domain Rules

## Rules that must stay true

- Proof should stay repo-relative and auditable.

## Contract assumptions

- Git metadata may be unavailable, so filesystem fallback must stay portable.

## Forbidden shortcuts

- Never mark verification passed without evidence.
`
      );
      writeTextFile(
        path.join(memoryDir, "runbook.md"),
        `# Runbook

## Standard loops

1. Scan the repo before long-lived work.
2. Refresh task docs before execution.
3. Record evidence and refresh checkpoints after the run.

## Verification expectations

- Prefer automated checks when the repo exposes them.
- Keep manual proof explicit when automation is not available.
`
      );

      const report = validateMemoryDocs(workspaceRoot);

      assert.equal(report.ok, true);
      assert.equal(report.clean, true);
      assert.equal(report.errorCount, 0);
      assert.equal(report.warningCount, 0);
      assert.match(formatMemoryValidationSummary(report), /Memory docs look grounded and reusable/);
    },
  },
  {
    name: "memory:validate command returns a failing exit code for blocking memory issues",
    run() {
      const { workspaceRoot } = createTaskWorkspace("memory-validate-cli");
      let stdout = "";
      const originalWrite = process.stdout.write;
      const originalExitCode = process.exitCode;

      process.exitCode = 0;
      process.stdout.write = (chunk, encoding, callback) => {
        stdout += String(chunk);
        if (typeof callback === "function") {
          callback();
        }
        return true;
      };

      try {
        main(["memory:validate", "--root", workspaceRoot]);
      } finally {
        process.stdout.write = originalWrite;
      }

      try {
        assert.equal(process.exitCode, 1);
        assert.match(stdout, /ok=false errors=4 warnings=0 docs=4 placeholderDocs=4/);
        assert.match(stdout, /ERROR \| memory\.placeholder \|/);
      } finally {
        process.exitCode = originalExitCode;
      }
    },
  },
];

module.exports = {
  name: "memory-validator",
  tests,
};
