const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { finished } = require("stream/promises");
const { getAdapter, normalizeAdapterId } = require("./adapters");
const { buildCheckpoint } = require("./checkpoint");
const { readJson } = require("./fs-utils");
const { prepareRun } = require("./run-preparer");
const { createRunRecord, persistRunRecord } = require("./task-service");
const { taskFiles } = require("./workspace");

async function executeRun(workspaceRoot, taskId, adapterInput) {
  const adapterId = normalizeAdapterId(adapterInput || "codex");
  const prepared = prepareRun(workspaceRoot, taskId, adapterId);
  const adapter = getAdapter(workspaceRoot, adapterId);
  const files = taskFiles(workspaceRoot, taskId);
  const runRequest = readJson(prepared.runRequestPath, null);

  if (!runRequest) {
    throw new Error(`Run request is missing or invalid for ${taskId} (${adapterId}).`);
  }

  if ((adapter.commandMode || "manual") !== "exec") {
    throw new Error(
      `Adapter ${adapterId} is configured for manual handoff only. Review ${toWorkspaceRelative(
        workspaceRoot,
        prepared.launchPackPath
      )} or switch commandMode to exec first.`
    );
  }

  const plan = buildExecutionPlan(workspaceRoot, taskId, adapter, files, prepared, runRequest);
  const runId = `run-${Date.now()}`;
  const startedAt = new Date().toISOString();
  const execution = await spawnExecution(plan, runId, files.runs);
  const completedAt = new Date().toISOString();
  const durationMs = new Date(completedAt).getTime() - new Date(startedAt).getTime();
  const exitCode = typeof execution.exitCode === "number" ? execution.exitCode : null;
  const status = plan.successExitCodes.includes(exitCode) ? "passed" : "failed";

  const run = createRunRecord(taskId, {
    id: runId,
    agent: adapterId,
    adapterId,
    source: "executor",
    status,
    summary: buildExecutionSummary(status, exitCode, execution.signal, execution.errorMessage),
    createdAt: startedAt,
    startedAt,
    completedAt,
    durationMs,
    exitCode,
    timedOut: execution.timedOut || undefined,
    commandMode: plan.commandMode,
    promptFile: plan.promptFileRelative,
    runRequestFile: plan.runRequestFileRelative,
    launchPackFile: plan.launchPackFileRelative,
    stdoutFile: execution.stdoutPath ? toWorkspaceRelative(workspaceRoot, execution.stdoutPath) : undefined,
    stderrFile: execution.stderrPath ? toWorkspaceRelative(workspaceRoot, execution.stderrPath) : undefined,
    errorMessage: execution.errorMessage,
  });

  const persistedRun = persistRunRecord(workspaceRoot, taskId, run);
  const checkpoint = buildCheckpoint(workspaceRoot, taskId);

  return {
    adapterId,
    taskId,
    run: persistedRun,
    checkpoint,
  };
}

function buildExecutionPlan(workspaceRoot, taskId, adapter, files, prepared, runRequest) {
  if (!Array.isArray(adapter.runnerCommand) || adapter.runnerCommand.length === 0) {
    throw new Error(`Adapter ${adapter.adapterId} must include a non-empty runnerCommand to support run:execute.`);
  }

  const promptFileAbsolute = path.resolve(workspaceRoot, runRequest.promptFile || toWorkspaceRelative(workspaceRoot, prepared.promptPath));
  const launchPackAbsolute = path.resolve(
    workspaceRoot,
    runRequest.launchPackFile || toWorkspaceRelative(workspaceRoot, prepared.launchPackPath)
  );
  const runRequestAbsolute = prepared.runRequestPath;
  const tokenMap = {
    workspaceRoot,
    taskRoot: files.root,
    promptFile: promptFileAbsolute,
    launchPackFile: launchPackAbsolute,
    runRequestFile: runRequestAbsolute,
  };

  const resolvedRunnerCommand = resolveTemplateArray(adapter.runnerCommand, tokenMap);
  const resolvedArgvTemplate = resolveTemplateArray(adapter.argvTemplate || [], tokenMap);
  const cwdMode = adapter.cwdMode === "taskRoot" ? "taskRoot" : "workspaceRoot";
  const stdioMode = adapter.stdioMode === "pipe" ? "pipe" : "inherit";
  const successExitCodes =
    Array.isArray(adapter.successExitCodes) && adapter.successExitCodes.every((value) => Number.isInteger(value))
      ? adapter.successExitCodes
      : [0];

  if (stdioMode === "pipe") {
    throw new Error(
      `Adapter ${adapter.adapterId} requests stdioMode=pipe, but the first run:execute pass only supports inherit mode.`
    );
  }

  return {
    adapterId: adapter.adapterId,
    taskId,
    commandMode: adapter.commandMode || "manual",
    command: resolvedRunnerCommand[0],
    args: resolvedRunnerCommand.slice(1).concat(resolvedArgvTemplate),
    cwd: cwdMode === "taskRoot" ? files.root : workspaceRoot,
    stdioMode,
    successExitCodes,
    env: process.env,
    promptFileRelative: runRequest.promptFile || toWorkspaceRelative(workspaceRoot, promptFileAbsolute),
    runRequestFileRelative: toWorkspaceRelative(workspaceRoot, runRequestAbsolute),
    launchPackFileRelative: runRequest.launchPackFile || toWorkspaceRelative(workspaceRoot, launchPackAbsolute),
  };
}

function resolveTemplateArray(values, tokenMap) {
  if (!Array.isArray(values)) {
    return [];
  }

  return values.map((value) => resolveTemplateValue(value, tokenMap));
}

function resolveTemplateValue(value, tokenMap) {
  return String(value).replace(/\{(workspaceRoot|taskRoot|promptFile|launchPackFile|runRequestFile)\}/g, (_, key) => {
    return tokenMap[key];
  });
}

async function spawnExecution(plan, runId, runsDirectory) {
  return new Promise((resolve, reject) => {
    let spawned = false;
    let stdoutPath = null;
    let stderrPath = null;
    let stdoutDone = Promise.resolve();
    let stderrDone = Promise.resolve();
    let childErrorMessage = null;

    const child = spawn(plan.command, plan.args, {
      cwd: plan.cwd,
      env: plan.env,
      stdio: plan.stdioMode === "pipe" ? ["ignore", "pipe", "pipe"] : "inherit",
    });

    child.on("spawn", () => {
      spawned = true;

      if (plan.stdioMode === "pipe") {
        fs.mkdirSync(runsDirectory, { recursive: true });
        stdoutPath = path.join(runsDirectory, `${runId}.stdout.log`);
        stderrPath = path.join(runsDirectory, `${runId}.stderr.log`);

        const stdoutStream = fs.createWriteStream(stdoutPath);
        const stderrStream = fs.createWriteStream(stderrPath);
        stdoutDone = finished(stdoutStream);
        stderrDone = finished(stderrStream);

        if (child.stdout) {
          child.stdout.pipe(stdoutStream);
        } else {
          stdoutStream.end();
        }

        if (child.stderr) {
          child.stderr.pipe(stderrStream);
        } else {
          stderrStream.end();
        }
      }
    });

    child.on("error", (error) => {
      if (!spawned) {
        reject(new Error(`Failed to launch ${plan.adapterId}: ${error.message}`));
        return;
      }

      childErrorMessage = error.message;
    });

    child.on("close", async (code, signal) => {
      try {
        await Promise.allSettled([stdoutDone, stderrDone]);
        resolve({
          exitCode: typeof code === "number" ? code : null,
          signal: signal || null,
          stdoutPath,
          stderrPath,
          errorMessage: childErrorMessage || (signal ? `Process exited due to signal ${signal}.` : undefined),
        });
      } catch (error) {
        reject(error);
      }
    });
  });
}

function buildExecutionSummary(status, exitCode, signal, errorMessage) {
  if (errorMessage) {
    return `Executor failed: ${errorMessage}`;
  }

  if (signal) {
    return `Executor exited due to signal ${signal}.`;
  }

  if (status === "passed") {
    return `Executor completed with exit code ${exitCode}.`;
  }

  return `Executor failed with exit code ${exitCode}.`;
}

function toWorkspaceRelative(workspaceRoot, absolutePath) {
  return path.relative(workspaceRoot, absolutePath).replace(/\\/g, "/");
}

module.exports = {
  executeRun,
};
