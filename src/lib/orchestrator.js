const { spawn } = require("child_process");
const { StringDecoder } = require("string_decoder");
const { tokenizeCommandString } = require("./adapters");
const { createResourceHandlers } = require("./mcp-resources");

const DEFAULT_AGENT = "claude";
const DEFAULT_INTERVAL_SECONDS = 300;
const DEFAULT_MAX_CONCURRENT = 1;
const DEFAULT_SUCCESS_EXIT_CODES = Object.freeze([0]);
const BUILTIN_AGENT_COMMANDS = Object.freeze({
  claude: {
    command: "claude",
    argsBeforePrompt: ["--print"],
  },
  "claude-code": {
    command: "claude",
    argsBeforePrompt: ["--print"],
  },
  codex: {
    command: "codex",
    argsBeforePrompt: ["exec"],
  },
});

function createOrchestratorPrompt(workspaceRoot, agent) {
  return [
    "Read workflow://queue, claim the highest priority task with workflow_claim_task, work on it, and record evidence with workflow_done.",
    "When done, check workflow://queue again and continue until it is empty.",
    "If you must stop before completion, call workflow_handoff with the remaining work.",
    `Target workspace root: ${workspaceRoot}`,
    `Agent: ${agent}`,
  ].join(" ");
}

async function runOrchestrator(workspaceRoot, options = {}) {
  const config = normalizeOrchestratorOptions(options);
  const logger = normalizeLogger(config.logger);
  const activeSessions = new Set();
  const reservedTaskIds = new Set();
  const state = {
    shuttingDown: false,
    sessionsStarted: 0,
    checks: 0,
  };
  const shutdown = createDeferred();
  const signalCleanup = installSignalHandlers(config.signals, (signal) => {
    if (state.shuttingDown) {
      return;
    }
    state.shuttingDown = true;
    logger.log(`[orchestrator] Received ${signal}, waiting for current agent session(s) to finish...`);
    shutdown.resolve(signal);
  });

  try {
    logger.log(
      `[orchestrator] Starting daemon for ${workspaceRoot} with agent=${config.agent}, interval=${config.intervalSeconds}s, maxConcurrent=${config.maxConcurrent}`
    );

    while (!state.shuttingDown) {
      if (activeSessions.size >= config.maxConcurrent) {
        await waitForSessionOrShutdown(activeSessions, shutdown.promise);
        continue;
      }

      let queue;
      try {
        logger.log("[orchestrator] Checking queue...");
        state.checks += 1;
        queue = await config.readQueue(workspaceRoot);
      } catch (error) {
        logger.error(`[orchestrator] Queue read failed: ${formatErrorMessage(error)}`);
        await waitForDelayOrShutdown(config.sleep, config.intervalMs, shutdown.promise);
        continue;
      }

      if (state.shuttingDown) {
        break;
      }

      const availableTasks = filterReservedTasks(queue.tasks, reservedTaskIds);
      logger.log(`[orchestrator] Found ${availableTasks.length} task(s) in queue`);

      if (availableTasks.length === 0) {
        if (config.stopWhenEmpty && activeSessions.size === 0) {
          logger.log("[orchestrator] Queue empty, exiting");
          return {
            reason: "empty",
            checks: state.checks,
            sessionsStarted: state.sessionsStarted,
          };
        }

        logger.log(`[orchestrator] Queue empty, sleeping ${config.intervalSeconds}s`);
        await waitForDelayOrShutdown(config.sleep, config.intervalMs, shutdown.promise);
        continue;
      }

      const capacity = config.maxConcurrent - activeSessions.size;
      const tasksToLaunch = availableTasks.slice(0, capacity);
      tasksToLaunch.forEach((task) => {
        const taskId = String(task.id || "").trim();
        if (taskId) {
          reservedTaskIds.add(taskId);
        }
        state.sessionsStarted += 1;
        logger.log(`[orchestrator] Spawning ${config.agent} session for ${taskId || "next task"}`);
        const session = startAgentSession(workspaceRoot, taskId, config, logger);
        activeSessions.add(session);
        session.promise.finally(() => {
          activeSessions.delete(session);
          if (taskId) {
            reservedTaskIds.delete(taskId);
          }
        });
      });

      if (activeSessions.size > 0) {
        await waitForDelaySessionOrShutdown(config.sleep, config.intervalMs, activeSessions, shutdown.promise);
      }
    }

    if (activeSessions.size > 0) {
      logger.log(`[orchestrator] Waiting for ${activeSessions.size} active agent session(s) before shutdown`);
      await Promise.all(Array.from(activeSessions).map((session) => session.promise));
    }

    logger.log("[orchestrator] Shutdown complete");
    return {
      reason: "shutdown",
      checks: state.checks,
      sessionsStarted: state.sessionsStarted,
    };
  } finally {
    signalCleanup();
  }
}

function startAgentSession(workspaceRoot, expectedTaskId, config, logger) {
  const prompt = config.buildPrompt(workspaceRoot, config.agent);
  const startedAt = Date.now();
  const promise = Promise.resolve()
    .then(() =>
      config.spawnAgent({
        agent: config.agent,
        agentCommand: config.agentCommand,
        cwd: workspaceRoot,
        expectedTaskId,
        prompt,
        onOutput(event) {
          logger.log(`[${config.agent}:${event.stream}] ${event.line}`);
        },
      })
    )
    .then((result) => {
      const exitCode = typeof result.exitCode === "number" ? result.exitCode : null;
      const durationMs = Date.now() - startedAt;
      if (config.successExitCodes.includes(exitCode)) {
        logger.log(`[orchestrator] Agent session completed (exit code ${exitCode}, ${durationMs}ms)`);
      } else {
        const detail = result.errorMessage ? `: ${result.errorMessage}` : "";
        logger.error(`[orchestrator] Agent session failed (exit code ${exitCode})${detail}`);
      }
      return result;
    })
    .catch((error) => {
      logger.error(`[orchestrator] Agent session failed: ${formatErrorMessage(error)}`);
      return {
        exitCode: null,
        errorMessage: formatErrorMessage(error),
      };
    });

  return {
    expectedTaskId,
    promise,
  };
}

function readWorkflowQueue(workspaceRoot) {
  const result = createResourceHandlers(workspaceRoot).readResource("workflow://queue");
  const text = result && result.contents && result.contents[0] ? result.contents[0].text : "";
  const payload = JSON.parse(text);
  return {
    tasks: Array.isArray(payload.tasks) ? payload.tasks : [],
  };
}

function spawnAgentSession(options = {}) {
  const plan = buildAgentCommand(options.agent, options.prompt, {
    agentCommand: options.agentCommand,
  });

  return spawnCommand(plan.command, plan.args, {
    cwd: options.cwd,
    onOutput: options.onOutput,
  });
}

function spawnCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    let spawned = false;
    let settled = false;
    let errorMessage = null;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: process.env,
      stdio: ["ignore", "pipe", "pipe"],
      shell: process.platform === "win32",
    });

    const stdoutForwarder = createLineForwarder("stdout", options.onOutput);
    const stderrForwarder = createLineForwarder("stderr", options.onOutput);

    if (child.stdout) {
      child.stdout.on("data", stdoutForwarder.handleChunk);
      child.stdout.on("end", stdoutForwarder.flushRemainder);
    }

    if (child.stderr) {
      child.stderr.on("data", stderrForwarder.handleChunk);
      child.stderr.on("end", stderrForwarder.flushRemainder);
    }

    child.on("spawn", () => {
      spawned = true;
    });

    child.on("error", (error) => {
      errorMessage = error.message;
      if (!spawned && !settled) {
        settled = true;
        resolve({
          exitCode: null,
          errorMessage: `Failed to launch ${command}: ${error.message}`,
        });
      }
    });

    child.on("close", (code, signal) => {
      stdoutForwarder.flushRemainder();
      stderrForwarder.flushRemainder();
      if (settled) {
        return;
      }
      settled = true;
      resolve({
        exitCode: typeof code === "number" ? code : null,
        signal: signal || null,
        errorMessage: errorMessage || (signal ? `Process exited due to signal ${signal}.` : undefined),
      });
    });
  });
}

function buildAgentCommand(agentInput, prompt, options = {}) {
  const agent = normalizeAgentName(agentInput);
  const commandPrompt = String(prompt || "");

  if (isNonEmptyString(options.agentCommand)) {
    const tokens = tokenizeCommandString(options.agentCommand);
    if (tokens.length === 0) {
      throw new Error("--agent-command must include at least one command token.");
    }
    const replaced = tokens.map((token) => token.split("{prompt}").join(commandPrompt));
    if (!tokens.some((token) => token.includes("{prompt}"))) {
      replaced.push(commandPrompt);
    }
    return {
      command: replaced[0],
      args: replaced.slice(1),
      agent,
    };
  }

  const builtin = BUILTIN_AGENT_COMMANDS[agent];
  if (builtin) {
    return {
      command: builtin.command,
      args: builtin.argsBeforePrompt.concat(commandPrompt),
      agent,
    };
  }

  return {
    command: agent,
    args: [commandPrompt],
    agent,
  };
}

function normalizeOrchestratorOptions(options = {}) {
  const intervalSeconds = normalizePositiveInteger(
    options.intervalSeconds !== undefined ? options.intervalSeconds : options.interval,
    DEFAULT_INTERVAL_SECONDS,
    "interval"
  );
  const maxConcurrent = normalizePositiveInteger(
    options.maxConcurrent !== undefined ? options.maxConcurrent : options["max-concurrent"],
    DEFAULT_MAX_CONCURRENT,
    "max-concurrent"
  );
  const agent = normalizeAgentName(options.agent || DEFAULT_AGENT);

  return {
    agent,
    agentCommand: isNonEmptyString(options.agentCommand || options["agent-command"])
      ? String(options.agentCommand || options["agent-command"]).trim()
      : undefined,
    buildPrompt: typeof options.buildPrompt === "function" ? options.buildPrompt : createOrchestratorPrompt,
    intervalSeconds,
    intervalMs: intervalSeconds * 1000,
    logger: options.logger,
    maxConcurrent,
    readQueue: typeof options.readQueue === "function" ? options.readQueue : readWorkflowQueue,
    signals: options.signals === false ? [] : options.signals || ["SIGINT", "SIGTERM"],
    sleep: typeof options.sleep === "function" ? options.sleep : sleep,
    spawnAgent: typeof options.spawnAgent === "function" ? options.spawnAgent : spawnAgentSession,
    stopWhenEmpty: options.stopWhenEmpty === true || options["stop-when-empty"] === true,
    successExitCodes: normalizeSuccessExitCodes(options.successExitCodes),
  };
}

function normalizeAgentName(value) {
  const normalized = String(value || DEFAULT_AGENT).trim().toLowerCase();
  return normalized || DEFAULT_AGENT;
}

function normalizePositiveInteger(value, fallback, fieldName) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw new Error(`--${fieldName} must be a positive integer.`);
  }
  return number;
}

function normalizeSuccessExitCodes(value) {
  const list = Array.isArray(value) && value.length > 0 ? value : DEFAULT_SUCCESS_EXIT_CODES;
  return Array.from(new Set(list.map((entry) => Number(entry)).filter((entry) => Number.isInteger(entry))));
}

function normalizeLogger(logger) {
  return {
    log(message) {
      if (logger && typeof logger.log === "function") {
        logger.log(message);
        return;
      }
      process.stdout.write(`${message}\n`);
    },
    error(message) {
      if (logger && typeof logger.error === "function") {
        logger.error(message);
        return;
      }
      process.stderr.write(`${message}\n`);
    },
  };
}

function filterReservedTasks(tasks, reservedTaskIds) {
  return (Array.isArray(tasks) ? tasks : []).filter((task) => {
    const taskId = String((task && task.id) || "").trim();
    return !taskId || !reservedTaskIds.has(taskId);
  });
}

function installSignalHandlers(signals, onSignal) {
  const installed = [];
  (Array.isArray(signals) ? signals : []).forEach((signal) => {
    const listener = () => onSignal(signal);
    process.on(signal, listener);
    installed.push([signal, listener]);
  });

  return () => {
    installed.forEach(([signal, listener]) => {
      process.off(signal, listener);
    });
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

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

async function waitForDelayOrShutdown(sleepFn, intervalMs, shutdownPromise) {
  await Promise.race([sleepFn(intervalMs), shutdownPromise]);
}

async function waitForSessionOrShutdown(activeSessions, shutdownPromise) {
  await Promise.race([firstActiveSession(activeSessions), shutdownPromise]);
}

async function waitForDelaySessionOrShutdown(sleepFn, intervalMs, activeSessions, shutdownPromise) {
  await Promise.race([sleepFn(intervalMs), firstActiveSession(activeSessions), shutdownPromise]);
}

function firstActiveSession(activeSessions) {
  const sessions = Array.from(activeSessions);
  if (sessions.length === 0) {
    return Promise.resolve();
  }
  return Promise.race(sessions.map((session) => session.promise));
}

function createLineForwarder(stream, onOutput) {
  const decoder = new StringDecoder("utf8");
  let remainder = "";

  return {
    flushRemainder() {
      const tail = decoder.end();
      if (tail) {
        remainder += tail;
      }
      if (remainder) {
        emitOutputLine(onOutput, stream, remainder);
        remainder = "";
      }
    },
    handleChunk(chunk) {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), "utf8");
      if (buffer.length === 0) {
        return;
      }
      remainder += decoder.write(buffer);
      const lines = remainder.split(/\r?\n/);
      remainder = lines.pop() || "";
      lines.forEach((line) => emitOutputLine(onOutput, stream, line));
    },
  };
}

function emitOutputLine(onOutput, stream, line) {
  if (typeof onOutput === "function") {
    onOutput({
      stream,
      line,
    });
  }
}

function formatErrorMessage(error) {
  return error && error.message ? error.message : String(error);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

module.exports = {
  buildAgentCommand,
  createOrchestratorPrompt,
  normalizeOrchestratorOptions,
  readWorkflowQueue,
  runOrchestrator,
  spawnAgentSession,
};
