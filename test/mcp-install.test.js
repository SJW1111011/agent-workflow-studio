const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  buildMcpServerEntry,
  installMcpServer,
  uninstallMcpServer,
} = require("../src/lib/mcp-install");
const { createTaskWorkspace, readJsonFile, readTextFile, writeJsonFile, writeTextFile } = require("./test-helpers");

const tests = [
  {
    name: "buildMcpServerEntry falls back to the local node executable when no npm bin is discoverable",
    run() {
      const { workspaceRoot } = createTaskWorkspace("mcp-install-node-entry");
      const packageRoot = path.join(workspaceRoot, "package-root");
      const serverPath = path.join(packageRoot, "src", "mcp-server.js");

      writeTextFile(serverPath, "module.exports = {};\n");

      const entry = buildMcpServerEntry(workspaceRoot, {
        execPath: "/test/node",
        packageRoot,
      });

      assert.deepEqual(entry, {
        command: "/test/node",
        args: [serverPath, "--root", workspaceRoot],
        env: {},
      });
    },
  },
  {
    name: "buildMcpServerEntry uses npx when the local MCP bin can be found from the package install root",
    run() {
      const { workspaceRoot } = createTaskWorkspace("mcp-install-npx-entry");
      const helperRoot = path.join(workspaceRoot, "helper");
      const packageRoot = path.join(helperRoot, "node_modules", "agent-workflow-studio");
      const binName = process.platform === "win32" ? "agent-workflow-mcp.cmd" : "agent-workflow-mcp";

      writeTextFile(path.join(helperRoot, "node_modules", ".bin", binName), "");
      writeTextFile(path.join(packageRoot, "src", "mcp-server.js"), "module.exports = {};\n");

      const entry = buildMcpServerEntry(workspaceRoot, {
        packageRoot,
      });

      assert.deepEqual(entry, {
        command: "npx",
        args: ["agent-workflow-mcp", "--root", workspaceRoot],
        cwd: helperRoot,
        env: {},
      });
    },
  },
  {
    name: "mcp:install for Claude Code merges into settings.json without disturbing unrelated settings",
    run() {
      const { workspaceRoot } = createTaskWorkspace("mcp-install-claude-merge");
      const homeDir = path.join(workspaceRoot, "home");
      const settingsPath = path.join(homeDir, ".claude", "settings.json");
      const packageRoot = path.join(workspaceRoot, "package-root");

      writeTextFile(path.join(packageRoot, "src", "mcp-server.js"), "module.exports = {};\n");
      writeJsonFile(settingsPath, {
        theme: "dark",
        mcpServers: {
          existing: {
            command: "node",
            args: ["existing.js"],
          },
        },
      });

      const result = installMcpServer(workspaceRoot, {
        client: "claude",
        execPath: "/test/node",
        homeDir,
        packageRoot,
      });

      assert.equal(result.ok, true);
      assert.equal(result.results.length, 1);
      assert.equal(result.results[0].status, "updated");

      const config = readJsonFile(settingsPath);
      assert.equal(config.theme, "dark");
      assert.deepEqual(config.mcpServers.existing, {
        command: "node",
        args: ["existing.js"],
      });
      assert.deepEqual(config.mcpServers["agent-workflow"], buildMcpServerEntry(workspaceRoot, {
        execPath: "/test/node",
        homeDir,
        packageRoot,
      }));
    },
  },
  {
    name: "mcp:install for Cursor creates the workspace config and stays idempotent on repeat runs",
    run() {
      const { workspaceRoot } = createTaskWorkspace("mcp-install-cursor-idempotent");
      const homeDir = path.join(workspaceRoot, "home");
      const cursorConfigPath = path.join(workspaceRoot, ".cursor", "mcp.json");
      const packageRoot = path.join(workspaceRoot, "package-root");

      writeTextFile(path.join(packageRoot, "src", "mcp-server.js"), "module.exports = {};\n");

      const first = installMcpServer(workspaceRoot, {
        client: "cursor",
        execPath: "/test/node",
        homeDir,
        packageRoot,
      });
      const second = installMcpServer(workspaceRoot, {
        client: "cursor",
        execPath: "/test/node",
        homeDir,
        packageRoot,
      });

      assert.equal(first.ok, true);
      assert.equal(first.results[0].status, "created");
      assert.equal(second.ok, true);
      assert.equal(second.results[0].status, "unchanged");

      const config = readJsonFile(cursorConfigPath);
      assert.deepEqual(config.mcpServers["agent-workflow"], buildMcpServerEntry(workspaceRoot, {
        execPath: "/test/node",
        homeDir,
        packageRoot,
      }));
    },
  },
  {
    name: "mcp:install for Codex creates ~/.codex/config.toml and stays idempotent on repeat runs",
    run() {
      const { workspaceRoot } = createTaskWorkspace("mcp-install-codex-idempotent");
      const homeDir = path.join(workspaceRoot, "home");
      const codexConfigPath = path.join(homeDir, ".codex", "config.toml");
      const packageRoot = path.join(workspaceRoot, "package-root");

      writeTextFile(path.join(packageRoot, "src", "mcp-server.js"), "module.exports = {};\n");

      const first = installMcpServer(workspaceRoot, {
        client: "codex",
        execPath: "/test/node",
        homeDir,
        packageRoot,
      });
      const second = installMcpServer(workspaceRoot, {
        client: "codex",
        execPath: "/test/node",
        homeDir,
        packageRoot,
      });

      assert.equal(first.ok, true);
      assert.equal(first.results[0].status, "created");
      assert.equal(second.ok, true);
      assert.equal(second.results[0].status, "unchanged");

      const configText = readTextFile(codexConfigPath);
      assert.match(configText, /\[mcp_servers\.agent-workflow\]/);
      assert.match(configText, /command = "\/test\/node"/);
      assert.match(configText, /args = \[/);
      assert.match(configText, /mcp-server\.js/);
      assert.match(configText, /"--root"/);
      assert.doesNotMatch(configText, /^env =/m);
    },
  },
  {
    name: "mcp:install for Codex merges into config.toml without disturbing unrelated settings",
    run() {
      const { workspaceRoot } = createTaskWorkspace("mcp-install-codex-merge");
      const homeDir = path.join(workspaceRoot, "home");
      const codexConfigPath = path.join(homeDir, ".codex", "config.toml");
      const packageRoot = path.join(workspaceRoot, "package-root");

      writeTextFile(path.join(packageRoot, "src", "mcp-server.js"), "module.exports = {};\n");
      writeTextFile(codexConfigPath, [
        "approval_policy = \"trusted\"",
        "",
        "[mcp_servers.existing]",
        "command = \"uvx\"",
        "args = [\"existing-server\"]",
        "",
      ].join("\n"));

      const result = installMcpServer(workspaceRoot, {
        client: "codex",
        execPath: "/test/node",
        homeDir,
        packageRoot,
      });

      assert.equal(result.ok, true);
      assert.equal(result.results[0].status, "updated");

      const configText = readTextFile(codexConfigPath);
      assert.match(configText, /^approval_policy = "trusted"/);
      assert.match(configText, /\[mcp_servers\.existing\]\ncommand = "uvx"\nargs = \["existing-server"\]/);
      assert.match(configText, /\[mcp_servers\.agent-workflow\]/);
    },
  },
  {
    name: "mcp:install auto-detect updates every supported client config already present",
    run() {
      const { workspaceRoot } = createTaskWorkspace("mcp-install-autodetect");
      const homeDir = path.join(workspaceRoot, "home");
      const packageRoot = path.join(workspaceRoot, "package-root");
      const claudePath = path.join(homeDir, ".claude", "settings.json");
      const cursorPath = path.join(workspaceRoot, ".cursor", "mcp.json");
      const codexPath = path.join(homeDir, ".codex", "config.toml");

      writeTextFile(path.join(packageRoot, "src", "mcp-server.js"), "module.exports = {};\n");
      writeJsonFile(claudePath, {});
      writeJsonFile(cursorPath, {});
      writeTextFile(codexPath, "approval_policy = \"trusted\"\n");

      const result = installMcpServer(workspaceRoot, {
        execPath: "/test/node",
        homeDir,
        packageRoot,
      });

      assert.equal(result.ok, true);
      assert.equal(result.results.length, 3);
      assert.deepEqual(
        result.results.map((item) => item.clientId).sort(),
        ["claude", "codex", "cursor"]
      );
      assert.equal(readJsonFile(claudePath).mcpServers["agent-workflow"].command, "/test/node");
      assert.equal(readJsonFile(cursorPath).mcpServers["agent-workflow"].command, "/test/node");
      assert.match(readTextFile(codexPath), /\[mcp_servers\.agent-workflow\]/);
    },
  },
  {
    name: "mcp:install warns instead of overwriting an existing agent-workflow entry with different settings",
    run() {
      const { workspaceRoot } = createTaskWorkspace("mcp-install-conflict");
      const homeDir = path.join(workspaceRoot, "home");
      const cursorConfigPath = path.join(workspaceRoot, ".cursor", "mcp.json");
      const packageRoot = path.join(workspaceRoot, "package-root");

      writeTextFile(path.join(packageRoot, "src", "mcp-server.js"), "module.exports = {};\n");
      writeJsonFile(cursorConfigPath, {
        mcpServers: {
          "agent-workflow": {
            command: "node",
            args: ["custom-server.js"],
          },
        },
      });

      const before = readTextFile(cursorConfigPath);
      const result = installMcpServer(workspaceRoot, {
        client: "cursor",
        execPath: "/test/node",
        homeDir,
        packageRoot,
      });

      assert.equal(result.ok, false);
      assert.equal(result.results[0].status, "conflict");
      assert.equal(readTextFile(cursorConfigPath), before);
    },
  },
  {
    name: "mcp:install warns instead of overwriting an existing Codex entry with different settings",
    run() {
      const { workspaceRoot } = createTaskWorkspace("mcp-install-codex-conflict");
      const homeDir = path.join(workspaceRoot, "home");
      const codexConfigPath = path.join(homeDir, ".codex", "config.toml");
      const packageRoot = path.join(workspaceRoot, "package-root");

      writeTextFile(path.join(packageRoot, "src", "mcp-server.js"), "module.exports = {};\n");
      writeTextFile(codexConfigPath, [
        "[mcp_servers.agent-workflow]",
        "command = \"node\"",
        "args = [\"custom-server.js\"]",
        "",
      ].join("\n"));

      const before = readTextFile(codexConfigPath);
      const result = installMcpServer(workspaceRoot, {
        client: "codex",
        execPath: "/test/node",
        homeDir,
        packageRoot,
      });

      assert.equal(result.ok, false);
      assert.equal(result.results[0].status, "conflict");
      assert.equal(readTextFile(codexConfigPath), before);
    },
  },
  {
    name: "mcp:uninstall removes only the agent-workflow entry and keeps other MCP servers intact",
    run() {
      const { workspaceRoot } = createTaskWorkspace("mcp-uninstall");
      const homeDir = path.join(workspaceRoot, "home");
      const settingsPath = path.join(homeDir, ".claude", "settings.json");

      writeJsonFile(settingsPath, {
        editor: {
          fontSize: 14,
        },
        mcpServers: {
          "agent-workflow": {
            command: "node",
            args: ["server.js"],
          },
          other: {
            command: "node",
            args: ["other.js"],
          },
        },
      });

      const result = uninstallMcpServer(workspaceRoot, {
        client: "claude",
        homeDir,
      });

      assert.equal(result.ok, true);
      assert.equal(result.results[0].status, "removed");

      const config = readJsonFile(settingsPath);
      assert.deepEqual(config.editor, {
        fontSize: 14,
      });
      assert.equal(Object.prototype.hasOwnProperty.call(config.mcpServers, "agent-workflow"), false);
      assert.deepEqual(config.mcpServers.other, {
        command: "node",
        args: ["other.js"],
      });
    },
  },
  {
    name: "mcp:uninstall for Codex removes only the agent-workflow sections and keeps other config intact",
    run() {
      const { workspaceRoot } = createTaskWorkspace("mcp-uninstall-codex");
      const homeDir = path.join(workspaceRoot, "home");
      const codexConfigPath = path.join(homeDir, ".codex", "config.toml");

      writeTextFile(codexConfigPath, [
        "approval_policy = \"trusted\"",
        "",
        "[mcp_servers.agent-workflow]",
        "command = \"node\"",
        "args = [\"server.js\"]",
        "",
        "[mcp_servers.agent-workflow.env]",
        "TOKEN = \"secret\"",
        "",
        "[mcp_servers.other]",
        "command = \"node\"",
        "args = [\"other.js\"]",
        "",
      ].join("\n"));

      const result = uninstallMcpServer(workspaceRoot, {
        client: "codex",
        homeDir,
      });

      assert.equal(result.ok, true);
      assert.equal(result.results[0].status, "removed");

      const configText = readTextFile(codexConfigPath);
      assert.match(configText, /^approval_policy = "trusted"/);
      assert.doesNotMatch(configText, /\[mcp_servers\.agent-workflow/);
      assert.match(configText, /\[mcp_servers\.other\]\ncommand = "node"\nargs = \["other\.js"\]/);
    },
  },
];

const suite = {
  name: "mcp-install",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
