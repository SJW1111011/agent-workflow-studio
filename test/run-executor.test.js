const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { executeRun, planRunExecution, preflightRunExecution } = require("../src/lib/run-executor");
const { validateWorkspace } = require("../src/lib/schema-validator");
const { listRuns } = require("../src/lib/task-service");
const { adaptersRoot, taskFiles } = require("../src/lib/workspace");
const { createTaskWorkspace, readJsonFile, readTextFile, writeJsonFile, writeTextFile } = require("./test-helpers");

function writeFakeRunner(workspaceRoot) {
  writeTextFile(
    path.join(workspaceRoot, "fake-runner.js"),
    `const fs = require("fs");
const path = require("path");

async function main() {
  const promptPath = process.argv[2];
  const runRequestPath = process.argv[3];
  const extras = process.argv.slice(4);

  if (!promptPath || !runRequestPath) {
    console.error("missing args");
    process.exit(2);
  }

  let sleepMs = 0;
  let exitCode = 0;

  for (let index = 0; index < extras.length; index += 1) {
    if (extras[index] === "--sleep-ms") {
      sleepMs = Number(extras[index + 1] || 0);
      index += 1;
    } else if (extras[index] === "--exit-code") {
      exitCode = Number(extras[index + 1] || 0);
      index += 1;
    }
  }

  const prompt = fs.readFileSync(promptPath, "utf8");
  const runRequest = JSON.parse(fs.readFileSync(runRequestPath, "utf8"));
  const cwdMarkerPath = path.join(process.cwd(), runRequest.taskId + ".cwd.txt");
  const envMarkerPath = path.join(process.cwd(), runRequest.taskId + ".env.txt");

  fs.writeFileSync(cwdMarkerPath, process.cwd() + "\\n", "utf8");
  fs.writeFileSync(envMarkerPath, String(process.env.RUN_EXECUTOR_TEST_FLAG || "") + "\\n", "utf8");

  if (!prompt.includes("# " + runRequest.taskId + " Prompt")) {
    console.error("prompt header missing");
    process.exit(3);
  }

  console.log("stdout", runRequest.taskId, runRequest.adapterId);
  console.error("stderr", runRequest.taskId, runRequest.adapterId);

  if (sleepMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, sleepMs));
  }

  process.exit(exitCode);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
`,
    "utf8"
  );
}

function configureCodexExecutor(workspaceRoot, overrides = {}) {
  const adapterPath = path.join(adaptersRoot(workspaceRoot), "codex.json");
  const adapter = readJsonFile(adapterPath);

  Object.assign(adapter, {
    commandMode: "exec",
    runnerCommand: [process.execPath],
    argvTemplate: ["fake-runner.js", "{promptFile}", "{runRequestFile}"],
    cwdMode: "workspaceRoot",
    stdioMode: "pipe",
    successExitCodes: [0],
    envAllowlist: [],
  });

  Object.assign(adapter, overrides);
  writeJsonFile(adapterPath, adapter);
}

function assertFileExists(filePath) {
  assert.equal(fs.existsSync(filePath), true, `Expected file to exist: ${filePath}`);
}

const tests = [
  {
    name: "planRunExecution resolves adapter tokens, cwd, timeout override, and allowed env keys",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("run-executor-plan");
      const previousEnv = process.env.RUN_EXECUTOR_TEST_FLAG;
      process.env.RUN_EXECUTOR_TEST_FLAG = "allowed-for-plan";

      try {
        writeFakeRunner(workspaceRoot);
        configureCodexExecutor(workspaceRoot, {
          argvTemplate: [
            "{workspaceRoot}/fake-runner.js",
            "{promptFile}",
            "{runRequestFile}",
            "{launchPackFile}",
            "{workspaceRoot}",
            "{taskRoot}",
          ],
          cwdMode: "taskRoot",
          timeoutMs: 333,
          envAllowlist: ["RUN_EXECUTOR_TEST_FLAG"],
        });

        const plan = planRunExecution(workspaceRoot, taskId, "codex", { timeoutMs: 500 });

        assert.equal(plan.command, process.execPath);
        assert.equal(plan.cwd, files.root);
        assert.equal(plan.stdioMode, "pipe");
        assert.equal(plan.timeoutMs, 500);
        assert.equal(path.normalize(plan.args[0]), path.join(workspaceRoot, "fake-runner.js"));
        assert.equal(path.normalize(plan.args[1]), files.promptCodex);
        assert.equal(path.normalize(plan.args[2]), path.join(files.root, "run-request.codex.json"));
        assert.equal(path.normalize(plan.args[3]), path.join(files.root, "launch.codex.md"));
        assert.equal(path.normalize(plan.args[4]), path.normalize(workspaceRoot));
        assert.equal(path.normalize(plan.args[5]), files.root);
        assert.equal(plan.promptFileRelative, ".agent-workflow/tasks/T-001/prompt.codex.md");
        assert.equal(plan.runRequestFileRelative, ".agent-workflow/tasks/T-001/run-request.codex.json");
        assert.equal(plan.launchPackFileRelative, ".agent-workflow/tasks/T-001/launch.codex.md");
        assert.equal(plan.env.RUN_EXECUTOR_TEST_FLAG, "allowed-for-plan");
        assertFileExists(files.promptCodex);
        assertFileExists(path.join(files.root, "run-request.codex.json"));
        assertFileExists(path.join(files.root, "launch.codex.md"));
      } finally {
        if (previousEnv === undefined) {
          delete process.env.RUN_EXECUTOR_TEST_FLAG;
        } else {
          process.env.RUN_EXECUTOR_TEST_FLAG = previousEnv;
        }
      }
    },
  },
  {
    name: "preflightRunExecution returns caller-specific readiness for dashboard launches",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("run-executor-preflight-dashboard");

      writeFakeRunner(workspaceRoot);
      configureCodexExecutor(workspaceRoot, {
        stdioMode: "inherit",
      });

      const readiness = preflightRunExecution(workspaceRoot, taskId, "codex", {
        caller: "dashboard",
      });

      assert.equal(readiness.ready, false);
      assert.equal(readiness.failureCategory, "caller-not-supported");
      assert.equal(readiness.code, "unsupported_dashboard_stdio_mode");
      assert.ok(Array.isArray(readiness.blockingIssues));
      assert.ok(Array.isArray(readiness.advisories));
      assert.ok(readiness.advisories.some((entry) => /resolves locally/i.test(entry.message)));
      assert.match(readiness.message, /Use the CLI for interactive execution/);
      assert.equal(readiness.blockingIssues[0].field, "stdioMode");
    },
  },
  {
    name: "preflightRunExecution keeps adapter notes visible while an adapter stays manual-only",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("run-executor-preflight-manual-note");

      const readiness = preflightRunExecution(workspaceRoot, taskId, "codex");

      assert.equal(readiness.ready, false);
      assert.equal(readiness.failureCategory, "adapter-manual-only");
      assert.equal(readiness.code, "adapter_manual_handoff_only");
      assert.ok(Array.isArray(readiness.advisories));
      assert.match(readiness.advisories[0].message, /Confirm the local Codex CLI invocation/i);
    },
  },
  {
    name: "preflightRunExecution rejects unsupported adapter template tokens before launch",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("run-executor-preflight-template");

      writeFakeRunner(workspaceRoot);
      configureCodexExecutor(workspaceRoot, {
        argvTemplate: ["fake-runner.js", "{promptFile}", "{unknownToken}"],
      });

      const readiness = preflightRunExecution(workspaceRoot, taskId, "codex");

      assert.equal(readiness.ready, false);
      assert.equal(readiness.failureCategory, "plan-invalid");
      assert.equal(readiness.code, "adapter_template_token_invalid");
      assert.match(readiness.message, /unsupported template token/i);
      assert.equal(readiness.blockingIssues[0].field, "argvTemplate");
    },
  },
  {
    name: "preflightRunExecution reports missing local runner commands before spawn",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("run-executor-preflight-runner-missing");

      configureCodexExecutor(workspaceRoot, {
        runnerCommand: ["agent-workflow-runner-that-should-not-exist"],
      });

      const readiness = preflightRunExecution(workspaceRoot, taskId, "codex");

      assert.equal(readiness.ready, false);
      assert.equal(readiness.failureCategory, "runtime-unavailable");
      assert.equal(readiness.code, "runner_command_unavailable");
      assert.equal(readiness.blockingIssues[0].field, "runnerCommand");
      assert.match(readiness.message, /unavailable on this machine/i);
      assert.ok(Array.isArray(readiness.advisories));
      assert.ok(readiness.advisories.some((entry) => /not found on PATH/i.test(entry.message)));
    },
  },
  {
    name: "executeRun persists a passed executor run with logs, artifacts, and checkpoint refresh",
    async run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("run-executor-success");

      writeFakeRunner(workspaceRoot);
      configureCodexExecutor(workspaceRoot);

      const result = await executeRun(workspaceRoot, taskId, "codex");
      const persistedRuns = listRuns(workspaceRoot, taskId);

      assert.equal(result.taskId, taskId);
      assert.equal(result.adapterId, "codex");
      assert.equal(result.run.source, "executor");
      assert.equal(result.run.status, "passed");
      assert.equal(result.run.outcome, "passed");
      assert.equal(result.run.commandMode, "exec");
      assert.equal(result.run.exitCode, 0);
      assert.equal(result.checkpoint.latestRunStatus, "passed");
      assert.equal(persistedRuns.length, 1);
      assert.equal(persistedRuns[0].id, result.run.id);
      assert.ok(Array.isArray(result.run.verificationArtifacts));
      assert.ok(result.run.verificationArtifacts.includes(result.run.stdoutFile));
      assert.ok(result.run.verificationArtifacts.includes(result.run.stderrFile));
      assert.ok(Array.isArray(result.run.verificationChecks));
      assert.equal(result.run.verificationChecks[0].status, "passed");

      assertFileExists(path.join(workspaceRoot, result.run.stdoutFile));
      assertFileExists(path.join(workspaceRoot, result.run.stderrFile));
      assert.match(readTextFile(path.join(workspaceRoot, result.run.stdoutFile)), /stdout T-001 codex/);
      assert.match(readTextFile(path.join(workspaceRoot, result.run.stderrFile)), /stderr T-001 codex/);
      assert.match(readTextFile(files.verification), /Source: executor/);
      assert.match(readTextFile(files.verification), /Outcome: passed/);
      assert.match(readTextFile(files.checkpoint), /Latest run status: passed/);
      assertFileExists(path.join(workspaceRoot, "T-001.cwd.txt"));

      const validation = validateWorkspace(workspaceRoot);
      assert.equal(validation.issues.some((issue) => issue.code === "run.outcome"), false);
      assert.equal(validation.issues.some((issue) => issue.code === "run.failureCategory"), false);
    },
  },
  {
    name: "executeRun persists timeout metadata and failed verification details when the process exceeds timeout",
    async run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("run-executor-timeout");

      writeFakeRunner(workspaceRoot);
      configureCodexExecutor(workspaceRoot, {
        argvTemplate: ["fake-runner.js", "{promptFile}", "{runRequestFile}", "--sleep-ms", "250"],
      });

      const result = await executeRun(workspaceRoot, taskId, "codex", { timeoutMs: 50 });

      assert.equal(result.run.status, "failed");
      assert.equal(result.run.outcome, "timed-out");
      assert.equal(result.run.failureCategory, "timeout");
      assert.equal(result.run.timedOut, true);
      assert.equal(result.run.timeoutMs, 50);
      assert.match(result.run.summary, /timed out/i);
      assert.equal(result.run.verificationChecks[0].status, "failed");
      assert.match(result.run.verificationChecks[0].details, /timedOut after 50 ms/);
      assertFileExists(path.join(workspaceRoot, result.run.stdoutFile));
      assertFileExists(path.join(workspaceRoot, result.run.stderrFile));
    },
  },
  {
    name: "executeRun records interruption metadata when the caller aborts a running execution",
    async run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("run-executor-abort");

      writeFakeRunner(workspaceRoot);
      configureCodexExecutor(workspaceRoot, {
        argvTemplate: ["fake-runner.js", "{promptFile}", "{runRequestFile}", "--sleep-ms", "500"],
      });

      const abortController = new AbortController();
      setTimeout(() => abortController.abort("unit-cancel"), 50);

      const result = await executeRun(workspaceRoot, taskId, "codex", {
        abortSignal: abortController.signal,
      });

      assert.equal(result.run.status, "failed");
      assert.equal(result.run.outcome, "interrupted");
      assert.equal(result.run.failureCategory, "interrupted");
      assert.equal(result.run.interrupted, true);
      assert.equal(result.run.interruptionSignal, "unit-cancel");
      assert.match(result.run.summary, /unit-cancel/);
      assert.equal(result.run.verificationChecks[0].status, "failed");
      assert.match(result.run.verificationChecks[0].details, /interrupted via unit-cancel/);
      assertFileExists(path.join(workspaceRoot, result.run.stdoutFile));
      assertFileExists(path.join(workspaceRoot, result.run.stderrFile));
    },
  },
];

module.exports = {
  name: "run-executor",
  tests,
};
