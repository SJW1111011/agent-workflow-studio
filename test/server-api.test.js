const assert = require("node:assert/strict");
const http = require("http");
const net = require("net");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const { createTaskWorkspace } = require("./test-helpers");

const SERVER_PATH = path.join(__dirname, "..", "src", "server.js");

function getFreePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      const port = address && address.port;
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve(port);
      });
    });
    server.on("error", reject);
  });
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function updateCodexAdapter(workspaceRoot, patch) {
  const adapterPath = path.join(workspaceRoot, ".agent-workflow", "adapters", "codex.json");
  const adapter = JSON.parse(fs.readFileSync(adapterPath, "utf8"));
  Object.assign(adapter, patch || {});
  fs.writeFileSync(adapterPath, `${JSON.stringify(adapter, null, 2)}\n`, "utf8");
}

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const requestBody =
      typeof options.rawBody === "string"
        ? options.rawBody
        : options.body === undefined
          ? null
          : JSON.stringify(options.body);

    const headers = {
      ...(options.headers || {}),
    };

    if (requestBody !== null && headers["Content-Type"] === undefined) {
      headers["Content-Type"] = "application/json";
    }

    const req = http.request(
      url,
      {
        method: options.method || "GET",
        headers,
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          let json = null;
          try {
            json = body ? JSON.parse(body) : null;
          } catch (error) {
            json = null;
          }

          resolve({
            statusCode: response.statusCode,
            headers: response.headers,
            body,
            json,
          });
        });
      }
    );

    req.on("error", reject);

    if (requestBody !== null) {
      req.write(requestBody);
    }

    req.end();
  });
}

async function startServer(workspaceRoot) {
  const port = await getFreePort();
  const child = spawn(process.execPath, [SERVER_PATH, "--root", workspaceRoot, "--port", String(port)], {
    cwd: path.join(__dirname, ".."),
    stdio: "ignore",
  });

  const stop = async () => {
    if (child.exitCode !== null) {
      return;
    }

    child.kill();
    for (let index = 0; index < 20; index += 1) {
      if (child.exitCode !== null) {
        return;
      }
      await delay(50);
    }

    if (child.exitCode === null) {
      child.kill("SIGKILL");
    }
  };

  for (let index = 0; index < 40; index += 1) {
    if (child.exitCode !== null) {
      throw new Error(`Server exited early with code ${child.exitCode}.`);
    }

    try {
      const response = await request(`http://127.0.0.1:${port}/api/health`);
      if (response.statusCode === 200 && response.json && response.json.ok === true) {
        return {
          port,
          stop,
        };
      }
    } catch (error) {
      // Retry until the server becomes ready.
    }

    await delay(50);
  }

  await stop();
  throw new Error("Timed out waiting for local server to become ready.");
}

const tests = [
  {
    name: "server api exposes health plus task creation validation and duplicate conflicts",
    async run() {
      const { workspaceRoot } = createTaskWorkspace("server-api-health");
      const server = await startServer(workspaceRoot);

      try {
        const health = await request(`http://127.0.0.1:${server.port}/api/health`);
        assert.equal(health.statusCode, 200);
        assert.deepEqual(health.json, { ok: true });

        const missingFields = await request(`http://127.0.0.1:${server.port}/api/tasks`, {
          method: "POST",
          body: { taskId: "   ", title: "" },
        });
        assert.equal(missingFields.statusCode, 400);
        assert.equal(missingFields.json.error, "taskId and title are required.");

        const created = await request(`http://127.0.0.1:${server.port}/api/tasks`, {
          method: "POST",
          body: { taskId: "T-002", title: "Created through focused API test", recipeId: "feature" },
        });
        assert.equal(created.statusCode, 201);
        assert.equal(created.json.id, "T-002");

        const duplicate = await request(`http://127.0.0.1:${server.port}/api/tasks`, {
          method: "POST",
          body: { taskId: "T-002", title: "Duplicate task" },
        });
        assert.equal(duplicate.statusCode, 409);
        assert.match(duplicate.json.error, /Task already exists: T-002/);
      } finally {
        await server.stop();
      }
    },
  },
  {
    name: "server api returns 400 for invalid json, oversized bodies, invalid document payloads, and unsupported editable docs",
    async run() {
      const { workspaceRoot } = createTaskWorkspace("server-api-bad-request");
      const server = await startServer(workspaceRoot);

      try {
        const invalidJson = await request(`http://127.0.0.1:${server.port}/api/tasks`, {
          method: "POST",
          rawBody: "{",
          headers: { "Content-Type": "application/json" },
        });
        assert.equal(invalidJson.statusCode, 400);
        assert.equal(invalidJson.json.error, "Invalid JSON body.");

        const oversizedBody = await request(`http://127.0.0.1:${server.port}/api/tasks`, {
          method: "POST",
          rawBody: `{"blob":"${"x".repeat(1024 * 1024)}"}`,
          headers: { "Content-Type": "application/json" },
        });
        assert.equal(oversizedBody.statusCode, 400);
        assert.equal(oversizedBody.json.error, "Request body too large.");

        const invalidContent = await request(
          `http://127.0.0.1:${server.port}/api/tasks/T-001/documents/task.md`,
          {
            method: "PUT",
            body: { content: 42 },
          }
        );
        assert.equal(invalidContent.statusCode, 400);
        assert.equal(invalidContent.json.error, "content must be a string.");

        const unsupportedDocument = await request(
          `http://127.0.0.1:${server.port}/api/tasks/T-001/documents/checkpoint.md`,
          {
            method: "PUT",
            body: { content: "# should fail\n" },
          }
        );
        assert.equal(unsupportedDocument.statusCode, 400);
        assert.match(unsupportedDocument.json.error, /Unsupported task document: checkpoint\.md/);
      } finally {
        await server.stop();
      }
    },
  },
  {
    name: "server api returns 404 and 409 for missing resources and inactive execution conflicts",
    async run() {
      const { workspaceRoot } = createTaskWorkspace("server-api-not-found");
      const server = await startServer(workspaceRoot);

      try {
        const missingTask = await request(`http://127.0.0.1:${server.port}/api/tasks/T-404`);
        assert.equal(missingTask.statusCode, 404);
        assert.match(missingTask.json.error, /Task not found: T-404/);

        const missingRunLog = await request(
          `http://127.0.0.1:${server.port}/api/tasks/T-001/runs/run-missing/logs/stdout`
        );
        assert.equal(missingRunLog.statusCode, 404);
        assert.match(missingRunLog.json.error, /Run run-missing does not exist for task T-001\./);

        const inactiveCancel = await request(
          `http://127.0.0.1:${server.port}/api/tasks/T-001/execution/cancel`,
          {
            method: "POST",
            body: {},
          }
        );
        assert.equal(inactiveCancel.statusCode, 409);
        assert.match(inactiveCancel.json.error, /no active dashboard execution to cancel/);

        const missingExecutionState = await request(
          `http://127.0.0.1:${server.port}/api/tasks/T-404/execution`
        );
        assert.equal(missingExecutionState.statusCode, 404);
        assert.match(missingExecutionState.json.error, /Task not found: T-404/);
      } finally {
        await server.stop();
      }
    },
  },
  {
    name: "server api refreshes manual proof anchors and returns typed validation errors when proof is not ready",
    async run() {
      const { workspaceRoot, files } = createTaskWorkspace("server-api-manual-proof-anchors");
      fs.mkdirSync(path.join(workspaceRoot, "src"), { recursive: true });
      fs.writeFileSync(path.join(workspaceRoot, "src", "app.js"), "module.exports = 'server';\n", "utf8");
      fs.writeFileSync(
        files.verification,
        [
          "# T-001 Verification",
          "",
          "## Proof links",
          "",
          "### Proof 1",
          "",
          "- Files: src/app.js",
          "- Check: npm test",
          "- Artifact: logs/test.txt",
          "",
        ].join("\n"),
        "utf8"
      );

      const server = await startServer(workspaceRoot);

      try {
        const refreshed = await request(
          `http://127.0.0.1:${server.port}/api/tasks/T-001/verification/anchors/refresh`,
          {
            method: "POST",
            body: {},
          }
        );
        assert.equal(refreshed.statusCode, 200);
        assert.equal(refreshed.json.manualProofAnchorRefresh.refreshedCount, 1);
        assert.match(refreshed.json.verificationText, /verification-manual-proof-anchors:start/);

        fs.writeFileSync(
          files.verification,
          [
            "# T-001 Verification",
            "",
            "## Planned checks",
            "",
            "- manual: review src/app.js",
            "",
          ].join("\n"),
          "utf8"
        );

        const noStrongProof = await request(
          `http://127.0.0.1:${server.port}/api/tasks/T-001/verification/anchors/refresh`,
          {
            method: "POST",
            body: {},
          }
        );
        assert.equal(noStrongProof.statusCode, 400);
        assert.match(noStrongProof.json.error, /no strong manual proof items to anchor/i);
      } finally {
        await server.stop();
      }
    },
  },
  {
    name: "server api exposes typed execution preflight failures and keeps dashboard state local-only",
    async run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("server-api-execution-preflight");
      updateCodexAdapter(workspaceRoot, {
        commandMode: "exec",
        runnerCommand: [process.execPath],
        argvTemplate: ["-e", "console.log('noop')"],
        stdioMode: "inherit",
      });

      const server = await startServer(workspaceRoot);

      try {
        const execute = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}/execute`, {
          method: "POST",
          body: {},
        });
        assert.equal(execute.statusCode, 400);
        assert.equal(execute.json.code, "unsupported_dashboard_stdio_mode");
        assert.equal(execute.json.failureCategory, "caller-not-supported");
        assert.ok(Array.isArray(execute.json.blockingIssues));
        assert.ok(Array.isArray(execute.json.advisories));
        assert.equal(execute.json.blockingIssues[0].field, "stdioMode");

        const executionState = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}/execution`);
        assert.equal(executionState.statusCode, 200);
        assert.equal(executionState.json.status, "preflight-failed");
        assert.equal(executionState.json.failureCategory, "caller-not-supported");
        assert.ok(Array.isArray(executionState.json.blockingIssues));
        assert.ok(Array.isArray(executionState.json.advisories));
        assert.equal(executionState.json.blockingIssues[0].field, "stdioMode");
      } finally {
        await server.stop();
      }
    },
  },
  {
    name: "server api exposes runner readiness failures with advisories when the local executable is unavailable",
    async run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("server-api-execution-runner-missing");
      updateCodexAdapter(workspaceRoot, {
        commandMode: "exec",
        runnerCommand: ["agent-workflow-runner-that-should-not-exist"],
        argvTemplate: [],
        stdioMode: "pipe",
      });

      const server = await startServer(workspaceRoot);

      try {
        const execute = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}/execute`, {
          method: "POST",
          body: {},
        });
        assert.equal(execute.statusCode, 409);
        assert.equal(execute.json.code, "runner_command_unavailable");
        assert.equal(execute.json.failureCategory, "runtime-unavailable");
        assert.ok(Array.isArray(execute.json.blockingIssues));
        assert.equal(execute.json.blockingIssues[0].field, "runnerCommand");
        assert.ok(Array.isArray(execute.json.advisories));
        assert.ok(execute.json.advisories.some((entry) => /not found on PATH/i.test(entry.message)));

        const executionState = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}/execution`);
        assert.equal(executionState.statusCode, 200);
        assert.equal(executionState.json.status, "preflight-failed");
        assert.equal(executionState.json.failureCategory, "runtime-unavailable");
        assert.ok(Array.isArray(executionState.json.advisories));
        assert.ok(executionState.json.advisories.some((entry) => /not found on PATH/i.test(entry.message)));
      } finally {
        await server.stop();
      }
    },
  },
];

module.exports = {
  name: "server-api",
  tests,
};
