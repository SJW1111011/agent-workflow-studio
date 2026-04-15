#!/usr/bin/env node

const packageJson = require("../package.json");
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");
const { createMcpToolRuntime } = require("./lib/mcp-tools");
const { resolveWorkspaceRoot } = require("./lib/workspace");

function createMcpServer(workspaceRoot) {
  const runtime = createMcpToolRuntime(workspaceRoot);
  const server = new Server(
    {
      name: "agent-workflow-studio",
      version: packageJson.version || "0.0.0",
    },
    {
      capabilities: {
        tools: {
          listChanged: false,
        },
      },
      instructions:
        "Use the workflow_* tools to create tasks, record evidence, refresh checkpoints, inspect workspace state, and undo the latest workflow-layer operation.",
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: runtime.listTools(),
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const params = request && request.params ? request.params : {};
    return runtime.callTool(params.name, params.arguments || {});
  });

  return {
    server,
    runtime,
    workspaceRoot,
  };
}

async function startMcpServer(workspaceRoot, options = {}) {
  const instance = createMcpServer(workspaceRoot);
  const transport = new StdioServerTransport(options.stdin, options.stdout);

  await instance.server.connect(transport);

  return {
    ...instance,
    transport,
    async close() {
      await instance.server.close();
    },
  };
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value === "-h") {
      options.help = true;
      continue;
    }

    if (!value.startsWith("--")) {
      continue;
    }

    const key = value.slice(2);
    const nextValue = argv[index + 1];
    if (nextValue && !nextValue.startsWith("--")) {
      options[key] = nextValue;
      index += 1;
      continue;
    }

    options[key] = true;
  }

  return { options };
}

function printUsage() {
  process.stdout.write(`Agent Workflow Studio MCP Server

Usage:
  agent-workflow-mcp [--root path]
  node src/mcp-server.js [--root path]

Options:
  --root path   Target repository root. Defaults to the current working directory.
  --help        Show this message.
`);
}

function installSignalHandlers(instance) {
  const signals = ["SIGINT", "SIGTERM"];
  const listeners = [];

  async function handleSignal(signal) {
    try {
      await instance.close();
      process.exit(0);
    } catch (error) {
      process.stderr.write(`${signal} shutdown failed: ${error.message}\n`);
      process.exit(1);
    }
  }

  signals.forEach((signal) => {
    const listener = () => {
      handleSignal(signal);
    };
    listeners.push({ signal, listener });
    process.once(signal, listener);
  });

  return () => {
    listeners.forEach(({ signal, listener }) => {
      process.removeListener(signal, listener);
    });
  };
}

async function main(argv = process.argv.slice(2)) {
  const { options } = parseArgs(argv);
  if (options.help === true) {
    printUsage();
    return null;
  }

  const workspaceRoot = resolveWorkspaceRoot(options.root);
  const instance = await startMcpServer(workspaceRoot);
  instance.removeSignalHandlers = installSignalHandlers(instance);
  return instance;
}

module.exports = {
  createMcpServer,
  main,
  parseArgs,
  printUsage,
  startMcpServer,
};

if (require.main === module) {
  main().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
