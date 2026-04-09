#!/usr/bin/env node

const path = require("path");
const { buildCheckpoint } = require("./lib/checkpoint");
const { createAdapter, listAdapters, normalizeAdapterId } = require("./lib/adapters");
const { formatMemoryBootstrapSummary, generateMemoryBootstrapPrompt } = require("./lib/memory-bootstrap");
const { formatMemoryValidationSummary, validateMemoryDocs } = require("./lib/memory-validator");
const { buildOverview } = require("./lib/overview");
const { compilePrompt } = require("./lib/prompt-compiler");
const { formatQuickTaskSummary, quickCreateTask } = require("./lib/quick-task");
const { listRecipes } = require("./lib/recipes");
const { executeRun } = require("./lib/run-executor");
const { prepareRun } = require("./lib/run-preparer");
const { scanWorkspace } = require("./lib/scanner");
const { startDashboardServer } = require("./server");
const { validateWorkspace } = require("./lib/schema-validator");
const { createTask, listTasks, recordRun } = require("./lib/task-service");
const { ensureWorkflowScaffold, resolveWorkspaceRoot } = require("./lib/workspace");

function main(argv = process.argv.slice(2)) {
  const { command, positionals, options } = parseCommand(argv);
  const workspaceRoot = resolveWorkspaceRoot(options.root);

  try {
    switch (command) {
      case "init": {
        ensureWorkflowScaffold(workspaceRoot);
        print(`Initialized workflow scaffold at ${path.join(workspaceRoot, ".agent-workflow")}`);
        break;
      }
      case "scan": {
        const profile = scanWorkspace(workspaceRoot);
        print(`Scanned ${workspaceRoot}`);
        print(`Detected ${profile.topLevelDirectories.length} top-level directories and ${profile.docs.length} docs.`);
        break;
      }
      case "memory:bootstrap": {
        const result = generateMemoryBootstrapPrompt(workspaceRoot, {
          outputPath: options.output,
        });
        print(formatMemoryBootstrapSummary(result, workspaceRoot));
        break;
      }
      case "memory:validate": {
        const report = validateMemoryDocs(workspaceRoot);
        print(formatMemoryValidationSummary(report));
        report.issues.forEach((item) => {
          print(`${item.level.toUpperCase()} | ${item.code} | ${item.target} | ${item.message}`);
        });
        if (!report.ok) {
          process.exitCode = 1;
        }
        break;
      }
      case "dashboard": {
        startDashboardServer(workspaceRoot, {
          port: options.port,
        });
        return;
      }
      case "adapter:list": {
        ensureWorkflowScaffold(workspaceRoot);
        const adapters = listAdapters(workspaceRoot);
        adapters.forEach((adapter) => {
          const status = adapter.status || (adapter.exists ? "ready" : "missing");
          const runner = adapter.config && Array.isArray(adapter.config.runnerCommand)
            ? adapter.config.runnerCommand.join(" ")
            : "";
          print(`${adapter.adapterId} | ${status} | ${runner}`);
        });
        break;
      }
      case "adapter:create": {
        const [adapterId] = positionals;
        assert(
          adapterId,
          "Usage: adapter:create <adapterId> [--name \"My Agent\"] [--runner \"npx my-agent-cli\"] [--argv-template \"exec -\"] [--prompt-target codex|claude] [--command-mode manual|exec] [--cwd-mode workspaceRoot|taskRoot] [--stdio-mode inherit|pipe] [--stdin-mode none|promptFile] [--env KEY] [--root path]"
        );
        const result = createAdapter(workspaceRoot, adapterId, {
          name: options.name,
          runnerCommand: options.runner,
          argvTemplate: options["argv-template"],
          promptTarget: options["prompt-target"],
          promptFile: options["prompt-file"],
          runRequestFile: options["run-request-file"],
          launchPackFile: options["launch-pack-file"],
          commandMode: options["command-mode"],
          cwdMode: options["cwd-mode"],
          stdioMode: options["stdio-mode"],
          stdinMode: options["stdin-mode"],
          timeoutMs: options["timeout-ms"],
          envAllowlist: getOptionList(options, "env"),
          notes: getOptionList(options, "note"),
          successExitCodes: getOptionList(options, "success-exit-code"),
        });
        print(`Created adapter ${result.adapterId} at ${result.adapterPath}`);
        print(`- Prompt target: ${result.config.promptTarget}`);
        print(`- Runner command: ${result.config.runnerCommand.join(" ")}`);
        print(`- Command mode: ${result.config.commandMode}`);
        print(`- Stdio: ${result.config.stdioMode} | stdin: ${result.config.stdinMode}`);
        break;
      }
      case "recipe:list": {
        ensureWorkflowScaffold(workspaceRoot);
        const recipes = listRecipes(workspaceRoot);
        recipes.forEach((recipe) => {
          print(`${recipe.id} | ${recipe.name} | ${recipe.summary}`);
        });
        break;
      }
      case "task:new": {
        const [taskId, ...titleParts] = positionals;
        const title = titleParts.join(" ").trim();
        assert(taskId && title, "Usage: task:new <taskId> <title> [--priority P1] [--recipe feature] [--root path]");
        const task = createTask(workspaceRoot, taskId, title, {
          priority: options.priority,
          recipe: options.recipe,
        });
        print(`Created task ${task.id} at ${path.join(workspaceRoot, ".agent-workflow", "tasks", task.id)}`);
        break;
      }
      case "quick": {
        const title = positionals.join(" ").trim();
        assert(
          title,
          "Usage: quick <title> [--task-id T-001] [--priority P1] [--recipe feature] [--agent codex|claude] [--root path]"
        );
        const result = quickCreateTask(workspaceRoot, title, {
          taskId: options["task-id"],
          priority: options.priority,
          recipe: options.recipe,
          agent: options.agent,
        });
        print(formatQuickTaskSummary(result));
        break;
      }
      case "task:list": {
        const tasks = listTasks(workspaceRoot);
        tasks.forEach((task) => {
          print(`${task.id} | ${task.priority} | ${task.status} | recipe=${task.recipeId || "feature"} | runs=${task.runCount} | ${task.title}`);
        });
        if (tasks.length === 0) {
          print("No tasks found.");
        }
        break;
      }
      case "prompt:compile": {
        const [taskId] = positionals;
        const agent = normalizePromptAgent(options.agent || "codex");
        assert(taskId, "Usage: prompt:compile <taskId> [--agent codex|claude] [--root path]");
        const result = compilePrompt(workspaceRoot, taskId, agent);
        print(`Compiled ${agent} prompt at ${result.outputPath}`);
        break;
      }
      case "run:prepare": {
        const [taskId] = positionals;
        const adapterId = normalizeAdapterId(options.agent || options.adapter || "codex");
        assert(taskId, "Usage: run:prepare <taskId> [--adapter <adapterId>] [--agent <adapterId>] [--root path]");
        const result = prepareRun(workspaceRoot, taskId, adapterId);
        print(`Prepared ${adapterId} launch pack at ${result.launchPackPath}`);
        print(`Prepared ${adapterId} run request at ${result.runRequestPath}`);
        break;
      }
      case "run:execute": {
        const [taskId] = positionals;
        const adapterId = normalizeAdapterId(options.agent || options.adapter || "codex");
        assert(
          taskId,
          "Usage: run:execute <taskId> [--adapter <adapterId>] [--agent <adapterId>] [--timeout-ms 300000] [--root path]"
        );
        executeRun(workspaceRoot, taskId, adapterId, {
          timeoutMs: options["timeout-ms"],
        })
          .then((result) => {
            print(`Executed ${adapterId} for ${taskId} with status ${result.run.status}.`);
            print(`Recorded run ${result.run.id}.`);
            if (result.run.status !== "passed") {
              process.exitCode = 1;
            }
          })
          .catch((error) => {
            console.error(error.message);
            if (Array.isArray(error.blockingIssues) && error.blockingIssues.length > 0) {
              error.blockingIssues.forEach((issue) => {
                console.error(`- ${issue.message}`);
              });
            }
            if (Array.isArray(error.advisories) && error.advisories.length > 0) {
              error.advisories.forEach((advisory) => {
                console.error(`- note: ${advisory.message}`);
              });
            }
            process.exitCode = 1;
          });
        return;
      }
      case "checkpoint": {
        const [taskId] = positionals;
        assert(taskId, "Usage: checkpoint <taskId> [--root path]");
        const checkpoint = buildCheckpoint(workspaceRoot, taskId);
        print(`Checkpoint updated for ${taskId} with ${checkpoint.runCount} recorded run(s).`);
        break;
      }
      case "run:add": {
        const [taskId, ...summaryParts] = positionals;
        const summary = summaryParts.join(" ").trim();
        const status = options.status || "draft";
        const agent = normalizeAdapterId(options.agent || "manual");
        assert(
          taskId && summary,
          "Usage: run:add <taskId> <summary> [--status passed|failed|draft] [--proof-path path] [--check text] [--artifact path] [--root path]"
        );
        const run = recordRun(workspaceRoot, taskId, summary, status, agent, {
          scopeProofPaths: getOptionList(options, "proof-path"),
          verificationChecks: getOptionList(options, "check").map((label) => ({
            label,
            status: status === "passed" ? "passed" : status === "failed" ? "failed" : "recorded",
          })),
          verificationArtifacts: getOptionList(options, "artifact"),
        });
        buildCheckpoint(workspaceRoot, taskId);
        print(`Recorded run ${run.id} for ${taskId} with status ${run.status}.`);
        break;
      }
      case "overview": {
        const overview = buildOverview(workspaceRoot);
        print(JSON.stringify(overview, null, 2));
        break;
      }
      case "validate": {
        const report = validateWorkspace(workspaceRoot);
        print(`ok=${report.ok} errors=${report.errorCount} warnings=${report.warningCount}`);
        report.issues.forEach((item) => {
          print(`${item.level.toUpperCase()} | ${item.code} | ${item.target} | ${item.message}`);
        });
        break;
      }
      case "help":
      case undefined: {
        printUsage();
        break;
      }
      default:
        throw new Error(`Unknown command: ${command}`);
    }
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}

function parseCommand(argv) {
  const options = {};
  const positionals = [];

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value.startsWith("--")) {
      const key = value.slice(2);
      const nextValue = argv[index + 1];
      if (nextValue && !nextValue.startsWith("--")) {
        assignOption(options, key, nextValue);
        index += 1;
      } else {
        assignOption(options, key, true);
      }
      continue;
    }
    positionals.push(value);
  }

  return {
    command: positionals.shift(),
    positionals,
    options,
  };
}

function assignOption(options, key, value) {
  if (!Object.prototype.hasOwnProperty.call(options, key)) {
    options[key] = value;
    return;
  }

  options[key] = Array.isArray(options[key]) ? options[key].concat(value) : [options[key], value];
}

function getOptionList(options, key) {
  const value = options[key];
  if (value === undefined || value === true) {
    return [];
  }

  return (Array.isArray(value) ? value : [value]).map((item) => String(item).trim()).filter(Boolean);
}

function normalizePromptAgent(agent) {
  return normalizeAdapterId(agent) === "claude-code" ? "claude" : "codex";
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function print(message) {
  process.stdout.write(`${message}\n`);
}

function printUsage() {
  print(`Agent Workflow Studio CLI

Commands:
  init [--root path]
  scan [--root path]
  memory:bootstrap [--output .agent-workflow/handoffs/memory-bootstrap.md] [--root path]
  memory:validate [--root path]
  dashboard [--root path] [--port 4173]
  adapter:list [--root path]
  adapter:create <adapterId> [--name "My Agent"] [--runner "npx my-agent-cli"] [--argv-template "exec -"] [--prompt-target codex|claude] [--root path]
  recipe:list [--root path]
  quick <title> [--task-id T-001] [--priority P1] [--recipe feature] [--agent codex|claude] [--root path]
  task:new <taskId> <title> [--priority P1] [--recipe feature] [--root path]
  task:list [--root path]
  prompt:compile <taskId> [--agent codex|claude] [--root path]
  run:prepare <taskId> [--adapter <adapterId>] [--agent <adapterId>] [--root path]
  run:execute <taskId> [--adapter <adapterId>] [--agent <adapterId>] [--timeout-ms 300000] [--root path]
  run:add <taskId> <summary> [--status passed|failed|draft] [--proof-path path] [--check text] [--artifact path] [--root path]
  checkpoint <taskId> [--root path]
  overview [--root path]
  validate [--root path]
`);
}

module.exports = {
  main,
  parseCommand,
};

if (require.main === module) {
  main();
}

