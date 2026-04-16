const assert = require("node:assert/strict");
const http = require("http");
const net = require("net");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const { createTaskWorkspace, setProjectStrictVerification, writeTextFile } = require("./test-helpers");

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

function writeDashboardSseRunner(workspaceRoot) {
  writeTextFile(
    path.join(workspaceRoot, "fake-sse-runner.js"),
    `const fs = require("fs");

async function main() {
  const promptPath = process.argv[2];
  const runRequestPath = process.argv[3];

  if (!promptPath || !runRequestPath) {
    console.error("missing args");
    process.exit(2);
  }

  const prompt = fs.readFileSync(promptPath, "utf8");
  const runRequest = JSON.parse(fs.readFileSync(runRequestPath, "utf8"));

  if (!prompt.includes("# " + runRequest.taskId + " Prompt")) {
    console.error("prompt header missing");
    process.exit(3);
  }

  process.stdout.write("stdout " + runRequest.taskId + " " + runRequest.adapterId + "\\n");
  await new Promise((resolve) => setTimeout(resolve, 60));
  process.stderr.write("stderr " + runRequest.taskId + " " + runRequest.adapterId + "\\n");
  await new Promise((resolve) => setTimeout(resolve, 60));
  process.stdout.write("stdout done\\n");
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
`,
    "utf8"
  );
}

function parseSseEvent(rawEvent) {
  if (!rawEvent || rawEvent.startsWith(":")) {
    return null;
  }

  const event = {
    data: null,
    event: "message",
  };
  const dataLines = [];

  rawEvent.split("\n").forEach((line) => {
    if (!line) {
      return;
    }

    if (line.startsWith(":")) {
      return;
    }

    if (line.startsWith("event:")) {
      event.event = line.slice("event:".length).trim();
      return;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  });

  if (dataLines.length === 0) {
    return null;
  }

  event.data = JSON.parse(dataLines.join("\n"));
  return event;
}

function connectSse(url) {
  return new Promise((resolve, reject) => {
    let responseRef = null;
    let buffer = "";
    const events = [];
    const req = http.request(
      url,
      {
        headers: {
          Accept: "text/event-stream",
        },
      },
      (response) => {
        responseRef = response;
        response.setEncoding("utf8");
        response.on("data", (chunk) => {
          buffer += chunk.replace(/\r\n/g, "\n");

          let boundary = buffer.indexOf("\n\n");
          while (boundary >= 0) {
            const rawEvent = buffer.slice(0, boundary);
            buffer = buffer.slice(boundary + 2);
            const parsed = parseSseEvent(rawEvent);
            if (parsed) {
              events.push(parsed);
            }
            boundary = buffer.indexOf("\n\n");
          }
        });
        response.on("error", reject);

        resolve({
          close: async () => {
            if (responseRef && !responseRef.destroyed) {
              responseRef.destroy();
            }
            if (!req.destroyed) {
              req.destroy();
            }
            await delay(10);
          },
          events,
          headers: response.headers,
          statusCode: response.statusCode,
        });
      }
    );

    req.on("error", reject);
    req.end();
  });
}

async function waitForSseEvent(connection, predicate, timeoutMs = 4000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const found = connection.events.find(predicate);
    if (found) {
      return found;
    }
    await delay(25);
  }

  throw new Error(`Timed out waiting for SSE event after ${timeoutMs} ms.`);
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
    name: "server api quick route reuses the shared quick task flow and materializes generated artifacts",
    async run() {
      const { workspaceRoot } = createTaskWorkspace("server-api-quick");
      writeTextFile(
        path.join(workspaceRoot, "package.json"),
        `${JSON.stringify(
          {
            name: "server-api-quick",
            version: "0.0.1",
            scripts: {
              test: "node -e \"console.log('ok')\"",
            },
          },
          null,
          2
        )}\n`
      );
      writeTextFile(path.join(workspaceRoot, "README.md"), "# Server quick\n");
      const server = await startServer(workspaceRoot);

      try {
        const quick = await request(`http://127.0.0.1:${server.port}/api/quick`, {
          method: "POST",
          body: {
            title: "Ship dashboard quick entrypoint",
            priority: "P0",
            recipeId: "review",
            agent: "claude-code",
          },
        });
        assert.equal(quick.statusCode, 201);
        assert.equal(quick.json.taskId, "T-002");
        assert.equal(quick.json.adapterId, "claude-code");
        assert.equal(quick.json.priority, "P0");
        assert.equal(quick.json.recipeId, "review");
        assert.match(quick.json.promptPath, /prompt\.claude\.md$/);
        assert.match(quick.json.runRequestPath, /run-request\.claude-code\.json$/);
        assert.match(quick.json.launchPackPath, /launch\.claude-code\.md$/);
        assert.ok(fs.existsSync(path.join(workspaceRoot, quick.json.promptPath)));
        assert.ok(fs.existsSync(path.join(workspaceRoot, quick.json.runRequestPath)));
        assert.ok(fs.existsSync(path.join(workspaceRoot, quick.json.launchPackPath)));
        assert.ok(fs.existsSync(path.join(workspaceRoot, quick.json.checkpointPath)));

        const task = await request(`http://127.0.0.1:${server.port}/api/tasks/T-002`);
        assert.equal(task.statusCode, 200);
        assert.equal(task.json.meta.id, "T-002");
        assert.equal(task.json.meta.recipeId, "review");
      } finally {
        await server.stop();
      }
    },
  },
  {
    name: "server api run recording auto-advances status and preserves manual patch overrides",
    async run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("server-api-run-status");
      const server = await startServer(workspaceRoot);

      try {
        const firstRun = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}/runs`, {
          method: "POST",
          body: {
            summary: "Started via API.",
          },
        });
        assert.equal(firstRun.statusCode, 201);
        assert.equal(firstRun.json.status, "draft");

        const afterFirstRun = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}`);
        assert.equal(afterFirstRun.statusCode, 200);
        assert.equal(afterFirstRun.json.meta.status, "in_progress");

        const patched = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}`, {
          method: "PATCH",
          body: {
            status: "done",
          },
        });
        assert.equal(patched.statusCode, 200);
        assert.equal(patched.json.status, "done");

        const lateRun = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}/runs`, {
          method: "POST",
          body: {
            summary: "Late note after manual override.",
          },
        });
        assert.equal(lateRun.statusCode, 201);

        const afterLateRun = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}`);
        assert.equal(afterLateRun.statusCode, 200);
        assert.equal(afterLateRun.json.meta.status, "done");
        assert.equal(afterLateRun.json.runs.length, 2);
      } finally {
        await server.stop();
      }
    },
  },
  {
    name: "server api appends task notes and rejects done to in_progress regressions",
    async run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("server-api-task-notes");
      const server = await startServer(workspaceRoot);

      try {
        const appended = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}/notes`, {
          method: "POST",
          body: {
            note: "Found a race condition in auth.",
          },
        });
        assert.equal(appended.statusCode, 201);
        assert.equal(appended.json.note.taskId, taskId);
        assert.match(appended.json.note.contextText, /## Progress notes/);
        assert.match(appended.json.note.contextText, /Found a race condition in auth\./);
        assert.equal(appended.json.task.meta.id, taskId);

        const missingNote = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}/notes`, {
          method: "POST",
          body: {},
        });
        assert.equal(missingNote.statusCode, 400);
        assert.equal(missingNote.json.error, "note is required.");

        const done = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}`, {
          method: "PATCH",
          body: {
            status: "done",
          },
        });
        assert.equal(done.statusCode, 200);

        const regressed = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}`, {
          method: "PATCH",
          body: {
            status: "in_progress",
          },
        });
        assert.equal(regressed.statusCode, 409);
        assert.equal(regressed.json.code, "task_status_regression");
        assert.match(regressed.json.error, /cannot regress to in_progress/);
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
    name: "server api refreshes verification records and returns typed validation errors when evidence is not ready",
    async run() {
      const { workspaceRoot, files } = createTaskWorkspace("server-api-manual-proof-anchors");
      setProjectStrictVerification(workspaceRoot, true);
      fs.mkdirSync(path.join(workspaceRoot, "src"), { recursive: true });
      fs.writeFileSync(path.join(workspaceRoot, "src", "app.js"), "module.exports = 'server';\n", "utf8");
      fs.writeFileSync(
        files.verification,
        [
          "# T-001 Verification",
          "",
          "## Verification records",
          "",
          "### Record 1",
          "",
          "- Files: src/app.js",
          "- Check: npm test",
          "- Result: passed",
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
            "## Draft checks",
            "",
            "- manual: review src/app.js",
            "",
          ].join("\n"),
          "utf8"
        );

        const noVerifiedEvidence = await request(
          `http://127.0.0.1:${server.port}/api/tasks/T-001/verification/anchors/refresh`,
          {
            method: "POST",
            body: {},
          }
        );
        assert.equal(noVerifiedEvidence.statusCode, 400);
        assert.match(noVerifiedEvidence.json.error, /no verified manual evidence to refresh yet/i);
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
    name: "server api streams execution state and stdout lines over sse without breaking snapshot log reads",
    timeout: 15000,
    async run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("server-api-execution-sse");
      writeDashboardSseRunner(workspaceRoot);
      updateCodexAdapter(workspaceRoot, {
        commandMode: "exec",
        runnerCommand: [process.execPath],
        argvTemplate: ["fake-sse-runner.js", "{promptFile}", "{runRequestFile}"],
        stdioMode: "pipe",
      });

      const server = await startServer(workspaceRoot);
      let stateStream = null;
      let stdoutStream = null;

      try {
        stateStream = await connectSse(`http://127.0.0.1:${server.port}/api/tasks/${taskId}/execution/events`);
        stdoutStream = await connectSse(
          `http://127.0.0.1:${server.port}/api/tasks/${taskId}/execution/logs/stdout/stream`
        );

        assert.equal(stateStream.statusCode, 200);
        assert.equal(stdoutStream.statusCode, 200);
        assert.match(String(stateStream.headers["content-type"] || ""), /text\/event-stream/i);
        assert.match(String(stdoutStream.headers["content-type"] || ""), /text\/event-stream/i);

        const initialState = await waitForSseEvent(stateStream, (event) => event.event === "state");
        assert.equal(initialState.data.status, "idle");

        const execute = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}/execute`, {
          method: "POST",
          body: {},
        });
        assert.equal(execute.statusCode, 202);
        assert.equal(execute.json.status, "starting");

        const runningState = await waitForSseEvent(
          stateStream,
          (event) => event.event === "state" && event.data.status === "running"
        );
        const completedState = await waitForSseEvent(
          stateStream,
          (event) => event.event === "state" && event.data.status === "completed"
        );
        const stdoutEvent = await waitForSseEvent(
          stdoutStream,
          (event) => event.event === "log" && /stdout T-001 codex/.test(event.data.line)
        );

        assert.equal(runningState.data.taskId, taskId);
        assert.equal(completedState.data.outcome, "passed");
        assert.equal(stdoutEvent.data.stream, "stdout");
        assert.equal(stdoutEvent.data.taskId, taskId);
        assert.ok(typeof stdoutEvent.data.receivedAt === "string");

        const snapshotLog = await request(
          `http://127.0.0.1:${server.port}/api/tasks/${taskId}/execution/logs/stdout?maxChars=2048`
        );
        assert.equal(snapshotLog.statusCode, 200);
        assert.match(snapshotLog.json.content, /stdout T-001 codex/);
        assert.match(snapshotLog.json.content, /stdout done/);
      } finally {
        if (stateStream) {
          await stateStream.close();
        }
        if (stdoutStream) {
          await stdoutStream.close();
        }
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

const suite = {
  name: "server-api",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run, testCase.timeout);
  });
});
