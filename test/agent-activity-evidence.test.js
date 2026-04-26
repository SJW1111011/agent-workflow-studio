const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");

const { createMcpToolRuntime, executeMcpTool } = require("../src/lib/mcp-tools");
const { getTaskDetail, listRuns } = require("../src/lib/task-service");
const { startDashboardServer } = require("../src/server");
const { createTaskWorkspace, readJsonFile, readTextFile } = require("./test-helpers");

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

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const requestBody = options.body === undefined ? null : JSON.stringify(options.body);
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
          resolve({
            statusCode: response.statusCode,
            json: body ? JSON.parse(body) : null,
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
  const server = startDashboardServer(workspaceRoot, { port });

  for (let index = 0; index < 40; index += 1) {
    try {
      const health = await request(`http://127.0.0.1:${port}/api/health`);
      if (health.statusCode === 200 && health.json && health.json.ok === true) {
        return {
          port,
          stop() {
            return new Promise((resolve, reject) => {
              server.close((error) => {
                if (error) {
                  reject(error);
                  return;
                }
                resolve();
              });
            });
          },
        };
      }
    } catch (error) {
      // Retry until the server becomes ready.
    }

    await delay(50);
  }

  await new Promise((resolve, reject) => {
    server.close((error) => {
      if (error) {
        reject(error);
        return;
      }
      resolve();
    });
  });
  throw new Error("Timed out waiting for agent activity evidence test server to become ready.");
}

const tests = [
  {
    name: "mcp tool list exposes agent activity and handoff workflow tools",
    run() {
      const { workspaceRoot } = createTaskWorkspace("agent-activity-tools");
      const toolNames = createMcpToolRuntime(workspaceRoot)
        .listTools()
        .map((tool) => tool.name)
        .sort();

      assert.equal(toolNames.length, 15);
      assert.ok(toolNames.includes("workflow_handoff"));
      assert.ok(toolNames.includes("workflow_pickup"));
      assert.ok(toolNames.includes("workflow_claim_task"));
      assert.ok(toolNames.includes("workflow_release_task"));
      assert.ok(toolNames.includes("workflow_record_activity"));
    },
  },
  {
    name: "workflow_done stores evidenceContext and auto-populates proof paths from filesModified",
    async run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("agent-activity-done");

      const result = await executeMcpTool(workspaceRoot, "workflow_done", {
        taskId,
        summary: "Recorded richer MCP evidence.",
        status: "passed",
        evidenceContext: {
          filesModified: ["src/lib/mcp-tools.js", "src/lib/task-service.js"],
          commandsRun: ["npm test -- agent-activity-evidence", "node src/cli.js checkpoint T-603"],
          toolCallCount: 9,
          sessionDurationMs: 3210,
        },
      });

      assert.equal(result.ok, true);
      assert.deepEqual(result.run.scopeProofPaths, ["src/lib/mcp-tools.js", "src/lib/task-service.js"]);
      assert.deepEqual(result.run.evidenceContext.filesModified, [
        "src/lib/mcp-tools.js",
        "src/lib/task-service.js",
      ]);
      assert.deepEqual(result.run.evidenceContext.commandsRun, [
        "npm test -- agent-activity-evidence",
        "node src/cli.js checkpoint T-603",
      ]);
      assert.equal(result.run.evidenceContext.toolCallCount, 9);
      assert.equal(result.run.evidenceContext.sessionDurationMs, 3210);

      const persistedRun = readJsonFile(path.join(files.runs, `${result.run.id}.json`));
      assert.deepEqual(persistedRun.evidenceContext, result.run.evidenceContext);
      assert.match(readTextFile(files.verification), /Evidence context tool call count: 9/);
      assert.match(readTextFile(files.verification), /Evidence context session duration ms: 3210/);
    },
  },
  {
    name: "workflow_record_activity creates timestamped activity breadcrumbs without affecting run status",
    async run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("agent-activity-record");

      const result = await executeMcpTool(workspaceRoot, "workflow_record_activity", {
        taskId,
        activity: "Inspected task-service run readers.",
        filesModified: ["src/lib/task-service.js", "src/lib/schema-validator.js"],
        metadata: {
          phase: "implementation",
          blocking: false,
          touchedAreas: ["mcp", "server", "tests"],
        },
      });

      assert.equal(result.ok, true);
      assert.equal(result.tool, "workflow_record_activity");
      assert.match(result.activityRecord.id, /^activity-\d+$/);
      assert.equal(result.activityRecord.activity, "Inspected task-service run readers.");
      assert.deepEqual(result.activityRecord.filesModified, [
        "src/lib/task-service.js",
        "src/lib/schema-validator.js",
      ]);
      assert.deepEqual(result.activityRecord.metadata, {
        phase: "implementation",
        blocking: false,
        touchedAreas: ["mcp", "server", "tests"],
      });

      assert.equal(listRuns(workspaceRoot, taskId).length, 0);
      assert.equal(readJsonFile(files.meta).status, "todo");

      const detail = getTaskDetail(workspaceRoot, taskId);
      assert.equal(detail.runs.length, 0);
      assert.equal(detail.activityRecords.length, 1);
      assert.equal(detail.activityRecords[0].activity, "Inspected task-service run readers.");
      assert.equal(fs.existsSync(path.join(workspaceRoot, result.activityPath)), true);
    },
  },
  {
    name: "task detail api returns activityRecords alongside runs",
    async run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("agent-activity-api");
      await executeMcpTool(workspaceRoot, "workflow_record_activity", {
        taskId,
        activity: "Verified API payload shape.",
        filesModified: ["src/server.js"],
      });
      await executeMcpTool(workspaceRoot, "workflow_run_add", {
        taskId,
        summary: "Recorded a conventional run.",
        status: "passed",
        proofPaths: ["src/server.js"],
      });

      const server = await startServer(workspaceRoot);

      try {
        const response = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}`);

        assert.equal(response.statusCode, 200);
        assert.equal(response.json.runs.length, 1);
        assert.equal(response.json.activityRecords.length, 1);
        assert.equal(response.json.activityRecords[0].activity, "Verified API payload shape.");
        assert.deepEqual(response.json.activityRecords[0].filesModified, ["src/server.js"]);
      } finally {
        await server.stop();
      }
    },
  },
];

const suite = {
  name: "agent-activity-evidence",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
