const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const { createAdapter, listAdapters } = require("../src/lib/adapters");
const { prepareRun } = require("../src/lib/run-preparer");
const { createTaskWorkspace, readJsonFile, readTextFile } = require("./test-helpers");

const tests = [
  {
    name: "listAdapters keeps built-ins and dynamically discovers custom adapter configs",
    run() {
      const { workspaceRoot } = createTaskWorkspace("adapters-discovery");
      const customAdapterPath = path.join(workspaceRoot, ".agent-workflow", "adapters", "aider.json");
      fs.writeFileSync(
        customAdapterPath,
        `${JSON.stringify(
          {
            schemaVersion: 1,
            adapterId: "aider",
            name: "Aider",
            promptTarget: "codex",
            promptFile: "prompt.aider.md",
            runRequestFile: "run-request.aider.json",
            launchPackFile: "launch.aider.md",
            runnerCommand: ["aider"],
            argvTemplate: [],
            commandMode: "manual",
            cwdMode: "workspaceRoot",
            stdioMode: "pipe",
            stdinMode: "none",
            successExitCodes: [0],
            envAllowlist: [],
            capabilities: {
              interactive: false,
              multiAgent: false,
              resumable: false,
            },
            notes: ["Custom adapter for tests."],
          },
          null,
          2
        )}\n`,
        "utf8"
      );

      const adapters = listAdapters(workspaceRoot);

      assert.deepEqual(adapters.map((adapter) => adapter.adapterId), ["codex", "claude-code", "aider"]);
      assert.equal(adapters[0].builtin, true);
      assert.equal(adapters[1].builtin, true);
      assert.equal(adapters[2].adapterId, "aider");
      assert.equal(adapters[2].status, "ready");
    },
  },
  {
    name: "createAdapter writes a portable config and records it in project.json",
    run() {
      const { workspaceRoot } = createTaskWorkspace("adapters-create");

      const result = createAdapter(workspaceRoot, "demo-agent", {
        name: "Demo Agent",
        runnerCommand: "npx demo-agent-cli",
        argvTemplate: "exec --json",
        promptTarget: "claude",
        stdinMode: "promptFile",
        envAllowlist: ["OPENAI_API_KEY", "DEMO_AGENT_TOKEN"],
      });

      assert.equal(path.basename(result.adapterPath), "demo-agent.json");
      assert.deepEqual(result.config.runnerCommand, ["npx", "demo-agent-cli"]);
      assert.deepEqual(result.config.argvTemplate, ["exec", "--json"]);
      assert.equal(result.config.promptTarget, "claude");
      assert.equal(result.config.promptFile, "prompt.demo-agent.md");
      assert.equal(result.config.stdinMode, "promptFile");
      assert.deepEqual(result.config.envAllowlist, ["OPENAI_API_KEY", "DEMO_AGENT_TOKEN"]);

      const projectConfig = readJsonFile(path.join(workspaceRoot, ".agent-workflow", "project.json"));
      assert.ok(projectConfig.adapters.includes("demo-agent"));
    },
  },
  {
    name: "prepareRun can materialize a custom adapter prompt file from the configured prompt target",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("adapters-prepare-custom");

      createAdapter(workspaceRoot, "demo-agent", {
        name: "Demo Agent",
        runnerCommand: "demo-agent",
        promptTarget: "claude",
        promptFile: "prompt.demo-agent.md",
        runRequestFile: "run-request.demo-agent.json",
        launchPackFile: "launch.demo-agent.md",
      });

      const result = prepareRun(workspaceRoot, taskId, "demo-agent");
      const promptPath = path.join(workspaceRoot, ".agent-workflow", "tasks", taskId, "prompt.demo-agent.md");
      const runRequest = readJsonFile(result.runRequestPath);
      const promptText = readTextFile(promptPath);

      assert.equal(path.basename(result.promptPath), "prompt.demo-agent.md");
      assert.equal(runRequest.promptFile, `.agent-workflow/tasks/${taskId}/prompt.demo-agent.md`);
      assert.match(promptText, /Prompt for Claude Code/);
      assert.ok(fs.existsSync(path.join(workspaceRoot, ".agent-workflow", "tasks", taskId, "launch.demo-agent.md")));
    },
  },
];

module.exports = {
  name: "adapters",
  tests,
};
