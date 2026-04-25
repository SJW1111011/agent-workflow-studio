const assert = require("node:assert/strict");

const {
  buildAgentCommand,
  createOrchestratorPrompt,
  normalizeOrchestratorOptions,
  runOrchestrator,
} = require("../src/lib/orchestrator");
const { createTaskWorkspace } = require("./test-helpers");

function createLogger() {
  const lines = [];
  const errors = [];
  return {
    lines,
    errors,
    logger: {
      log(message) {
        lines.push(message);
      },
      error(message) {
        errors.push(message);
      },
    },
  };
}

function createDeferred() {
  let resolve;
  const promise = new Promise((innerResolve) => {
    resolve = innerResolve;
  });
  return {
    promise,
    resolve,
  };
}

const neverSleep = () => new Promise(() => {});

const tests = [
  {
    name: "buildAgentCommand creates built-in claude and codex invocations",
    run() {
      assert.deepEqual(buildAgentCommand("claude", "do work"), {
        command: "claude",
        args: ["--print", "do work"],
        agent: "claude",
      });

      assert.deepEqual(buildAgentCommand("codex", "do work"), {
        command: "codex",
        args: ["exec", "do work"],
        agent: "codex",
      });
    },
  },
  {
    name: "buildAgentCommand supports custom command templates",
    run() {
      assert.deepEqual(
        buildAgentCommand("custom", "do work", {
          agentCommand: "custom-agent run --prompt {prompt}",
        }),
        {
          command: "custom-agent",
          args: ["run", "--prompt", "do work"],
          agent: "custom",
        }
      );

      assert.deepEqual(
        buildAgentCommand("custom", "do work", {
          agentCommand: "custom-agent run",
        }),
        {
          command: "custom-agent",
          args: ["run", "do work"],
          agent: "custom",
        }
      );
    },
  },
  {
    name: "normalizeOrchestratorOptions applies daemon defaults",
    run() {
      const options = normalizeOrchestratorOptions({
        signals: false,
      });

      assert.equal(options.agent, "claude");
      assert.equal(options.intervalSeconds, 300);
      assert.equal(options.intervalMs, 300000);
      assert.equal(options.maxConcurrent, 1);
      assert.equal(options.stopWhenEmpty, false);
      assert.deepEqual(options.signals, []);
    },
  },
  {
    name: "runOrchestrator exits immediately when stopWhenEmpty sees an empty queue",
    async run() {
      const { workspaceRoot } = createTaskWorkspace("orchestrator-empty");
      const { logger, lines } = createLogger();
      const spawned = [];

      const result = await runOrchestrator(workspaceRoot, {
        logger,
        readQueue: () => ({ tasks: [] }),
        signals: false,
        sleep: neverSleep,
        spawnAgent: (request) => {
          spawned.push(request);
          return { exitCode: 0 };
        },
        stopWhenEmpty: true,
      });

      assert.equal(result.reason, "empty");
      assert.equal(result.sessionsStarted, 0);
      assert.equal(spawned.length, 0);
      assert.ok(lines.some((line) => /Queue empty, exiting/.test(line)));
    },
  },
  {
    name: "runOrchestrator launches only up to maxConcurrent sessions from the queue",
    async run() {
      const { workspaceRoot } = createTaskWorkspace("orchestrator-max-concurrent");
      const { logger } = createLogger();
      const spawned = [];
      let readCount = 0;

      const result = await runOrchestrator(workspaceRoot, {
        intervalSeconds: 1,
        logger,
        maxConcurrent: 2,
        readQueue() {
          readCount += 1;
          return readCount === 1
            ? {
                tasks: [
                  { id: "T-001", priority: "P0" },
                  { id: "T-002", priority: "P1" },
                  { id: "T-003", priority: "P2" },
                ],
              }
            : { tasks: [] };
        },
        signals: false,
        sleep: () => Promise.resolve(),
        spawnAgent(request) {
          spawned.push(request);
          return { exitCode: 0 };
        },
        stopWhenEmpty: true,
      });

      assert.equal(result.reason, "empty");
      assert.equal(result.sessionsStarted, 2);
      assert.deepEqual(
        spawned.map((request) => request.expectedTaskId),
        ["T-001", "T-002"]
      );
      assert.ok(spawned.every((request) => request.prompt.includes("workflow_claim_task")));
    },
  },
  {
    name: "runOrchestrator logs non-zero agent exits and continues checking the queue",
    async run() {
      const { workspaceRoot } = createTaskWorkspace("orchestrator-nonzero");
      const { logger, errors } = createLogger();
      let readCount = 0;

      const result = await runOrchestrator(workspaceRoot, {
        intervalSeconds: 1,
        logger,
        readQueue() {
          readCount += 1;
          return readCount === 1 ? { tasks: [{ id: "T-001", priority: "P0" }] } : { tasks: [] };
        },
        signals: false,
        sleep: () => Promise.resolve(),
        spawnAgent() {
          return {
            exitCode: 7,
            errorMessage: "runner failed",
          };
        },
        stopWhenEmpty: true,
      });

      assert.equal(result.reason, "empty");
      assert.equal(result.sessionsStarted, 1);
      assert.equal(readCount, 2);
      assert.ok(errors.some((line) => /Agent session failed \(exit code 7\): runner failed/.test(line)));
    },
  },
  {
    name: "runOrchestrator waits for the active session during graceful shutdown",
    async run() {
      const { workspaceRoot } = createTaskWorkspace("orchestrator-shutdown");
      const { logger, lines } = createLogger();
      const started = createDeferred();
      const session = createDeferred();

      const run = runOrchestrator(workspaceRoot, {
        logger,
        readQueue: () => ({ tasks: [{ id: "T-001", priority: "P0" }] }),
        signals: ["orchestrator-test-shutdown"],
        sleep: neverSleep,
        spawnAgent() {
          started.resolve();
          return session.promise;
        },
      });

      await started.promise;
      process.emit("orchestrator-test-shutdown");
      await Promise.resolve();
      session.resolve({ exitCode: 0 });
      const result = await run;

      assert.equal(result.reason, "shutdown");
      assert.equal(result.sessionsStarted, 1);
      assert.ok(lines.some((line) => /Received orchestrator-test-shutdown/.test(line)));
      assert.ok(lines.some((line) => /Shutdown complete/.test(line)));
    },
  },
  {
    name: "createOrchestratorPrompt points agents at the queue and workflow_done",
    run() {
      const prompt = createOrchestratorPrompt("C:\\repo", "codex");

      assert.match(prompt, /workflow:\/\/queue/);
      assert.match(prompt, /workflow_claim_task/);
      assert.match(prompt, /workflow_done/);
      assert.match(prompt, /C:\\repo/);
    },
  },
];

const suite = {
  name: "orchestrator",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
