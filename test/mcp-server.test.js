const assert = require("node:assert/strict");
const path = require("path");
const { spawn } = require("child_process");

const { createTaskWorkspace } = require("./test-helpers");

const CLI_PATH = path.join(__dirname, "..", "src", "cli.js");
const REPO_ROOT = path.join(__dirname, "..");
const PROTOCOL_VERSION = "2024-11-05";

const tests = [
  {
    name: "cli mcp:serve exposes workflow tools over stdio MCP",
    async run() {
      const { workspaceRoot } = createTaskWorkspace("mcp-server-cli");
      const server = startMcpCli(workspaceRoot);

      try {
        const initialize = await server.request("initialize", {
          protocolVersion: PROTOCOL_VERSION,
          capabilities: {},
          clientInfo: {
            name: "vitest",
            version: "1.0.0",
          },
        });

        assert.equal(initialize.protocolVersion, PROTOCOL_VERSION);
        assert.ok(initialize.capabilities);
        assert.ok(initialize.capabilities.prompts);
        assert.ok(initialize.capabilities.resources);
        assert.ok(initialize.capabilities.tools);

        server.notify("notifications/initialized");

        const listedResources = await server.request("resources/list", {});
        assert.deepEqual(
          listedResources.resources.map((resource) => resource.uri).sort(),
          ["workflow://overview", "workflow://tasks"]
        );

        const listedResourceTemplates = await server.request("resources/templates/list", {});
        assert.deepEqual(
          listedResourceTemplates.resourceTemplates.map((template) => template.uriTemplate).sort(),
          ["workflow://memory/{docName}", "workflow://tasks/{taskId}"]
        );

        const listedPrompts = await server.request("prompts/list", {});
        assert.deepEqual(
          listedPrompts.prompts.map((prompt) => prompt.name).sort(),
          ["workflow-handoff", "workflow-resume", "workflow-verify"]
        );

        const listedTools = await server.request("tools/list", {});
        const toolNames = listedTools.tools.map((tool) => tool.name).sort();
        assert.deepEqual(toolNames, [
          "workflow_append_note",
          "workflow_checkpoint",
          "workflow_done",
          "workflow_handoff",
          "workflow_overview",
          "workflow_pickup",
          "workflow_quick",
          "workflow_record_activity",
          "workflow_run_add",
          "workflow_task_list",
          "workflow_undo",
          "workflow_update_task",
          "workflow_validate",
        ]);

        const quick = await server.request("tools/call", {
          name: "workflow_quick",
          arguments: {
            title: "Create a task from MCP",
            taskId: "T-002",
            mode: "lite",
          },
        });
        const quickPayload = parseToolPayload(quick);

        assert.equal(quick.isError, undefined);
        assert.equal(quickPayload.ok, true);
        assert.equal(quickPayload.taskId, "T-002");
        assert.equal(quickPayload.mode, "lite");

        const note = await server.request("tools/call", {
          name: "workflow_append_note",
          arguments: {
            taskId: "T-002",
            note: "MCP server note coverage.",
          },
        });
        const notePayload = parseToolPayload(note);

        assert.equal(notePayload.ok, true);
        assert.equal(notePayload.tool, "workflow_append_note");
        assert.equal(notePayload.taskId, "T-002");

        const taskResource = await server.request("resources/read", {
          uri: "workflow://tasks/T-002",
        });
        const taskPayload = parseResourcePayload(taskResource);

        assert.equal(taskPayload.task.id, "T-002");
        assert.match(taskPayload.contextText, /MCP server note coverage\./);

        const resumePrompt = await server.request("prompts/get", {
          name: "workflow-resume",
          arguments: {
            taskId: "T-002",
          },
        });

        assert.equal(resumePrompt.messages[0].content.type, "text");
        assert.match(resumePrompt.messages[0].content.text, /Resume workflow task T-002/);
        assert.equal(resumePrompt.messages[1].content.type, "resource");
        assert.equal(resumePrompt.messages[1].content.resource.uri, "workflow://tasks/T-002");

        const taskList = await server.request("tools/call", {
          name: "workflow_task_list",
          arguments: {},
        });
        const taskListPayload = parseToolPayload(taskList);

        assert.equal(taskListPayload.ok, true);
        assert.ok(taskListPayload.tasks.some((task) => task.id === "T-002"));
      } finally {
        await server.close();
      }
    },
  },
];

function startMcpCli(workspaceRoot) {
  const child = spawn(process.execPath, [CLI_PATH, "mcp:serve", "--root", workspaceRoot], {
    cwd: REPO_ROOT,
    stdio: ["pipe", "pipe", "pipe"],
  });

  let nextId = 1;
  let stdoutBuffer = "";
  let stderr = "";
  const pending = new Map();

  child.stdout.on("data", (chunk) => {
    stdoutBuffer += String(chunk);
    processStdoutBuffer();
  });

  child.stderr.on("data", (chunk) => {
    stderr += String(chunk);
  });

  child.on("exit", (code, signal) => {
    const error = new Error(
      `MCP server exited early with code ${code} signal ${signal}. stderr: ${stderr || "(empty)"}`
    );
    pending.forEach(({ reject }) => reject(error));
    pending.clear();
  });

  function processStdoutBuffer() {
    for (;;) {
      const lineEnd = stdoutBuffer.indexOf("\n");
      if (lineEnd === -1) {
        return;
      }

      const line = stdoutBuffer.slice(0, lineEnd).trim();
      stdoutBuffer = stdoutBuffer.slice(lineEnd + 1);

      if (!line) {
        continue;
      }

      const message = JSON.parse(line);
      if (message.id === undefined) {
        continue;
      }

      const pendingRequest = pending.get(message.id);
      if (!pendingRequest) {
        continue;
      }

      pending.delete(message.id);

      if (message.error) {
        const error = new Error(message.error.message || "MCP request failed.");
        error.payload = message.error;
        pendingRequest.reject(error);
        continue;
      }

      pendingRequest.resolve(message.result);
    }
  }

  function writeMessage(message) {
    child.stdin.write(`${JSON.stringify(message)}\n`);
  }

  return {
    request(method, params) {
      const id = nextId;
      nextId += 1;

      return new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          pending.delete(id);
          reject(new Error(`Timed out waiting for MCP response to ${method}. stderr: ${stderr || "(empty)"}`));
        }, 10000);

        pending.set(id, {
          resolve(value) {
            clearTimeout(timeout);
            resolve(value);
          },
          reject(error) {
            clearTimeout(timeout);
            reject(error);
          },
        });

        writeMessage({
          jsonrpc: "2.0",
          id,
          method,
          params,
        });
      });
    },
    notify(method, params) {
      writeMessage({
        jsonrpc: "2.0",
        method,
        params,
      });
    },
    async close() {
      if (child.exitCode !== null) {
        return;
      }

      child.kill();
      await waitForExit(child);
    },
  };
}

function parseToolPayload(result) {
  assert.ok(result);
  assert.ok(Array.isArray(result.content));
  assert.equal(result.content[0].type, "text");
  return JSON.parse(result.content[0].text);
}

function parseResourcePayload(result) {
  assert.ok(result);
  assert.ok(Array.isArray(result.contents));
  assert.equal(result.contents[0].mimeType, "application/json");
  return JSON.parse(result.contents[0].text);
}

function waitForExit(child) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) {
      resolve();
      return;
    }

    child.once("exit", () => resolve());
    setTimeout(() => {
      if (child.exitCode === null) {
        child.kill("SIGKILL");
      }
    }, 1000);
  });
}

const suite = {
  name: "mcp-server",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run, 15000);
  });
});
