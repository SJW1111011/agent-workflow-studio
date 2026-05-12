const assert = require("node:assert/strict");
const http = require("http");
const net = require("net");

const { createResourceHandlers } = require("../src/lib/mcp-resources");
const { listTasks, updateTaskMeta } = require("../src/lib/task-service");
const { startDashboardServer } = require("../src/server");
const { taskFiles } = require("../src/lib/workspace");
const { createTaskWorkspace, readJsonFile, readTextFile, writeJsonFile } = require("./test-helpers");

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

function request(url, options = {}) {
  return new Promise((resolve, reject) => {
    const requestBody = options.body === undefined ? null : JSON.stringify(options.body);
    const req = http.request(
      url,
      {
        method: options.method || "GET",
        headers: requestBody === null ? {} : { "Content-Type": "application/json" },
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
            body,
            json,
            statusCode: response.statusCode,
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

async function startTestServer(workspaceRoot) {
  const port = await getFreePort();
  const server = startDashboardServer(workspaceRoot, { port });

  for (let index = 0; index < 40; index += 1) {
    try {
      const health = await request(`http://127.0.0.1:${port}/api/health`);
      if (health.statusCode === 200 && health.json && health.json.ok) {
        return {
          port,
          stop: () => new Promise((resolve) => server.close(resolve)),
        };
      }
    } catch (error) {
      // Retry until the server starts listening.
    }

    await new Promise((resolve) => setTimeout(resolve, 25));
  }

  await new Promise((resolve) => server.close(resolve));
  throw new Error("Timed out waiting for test server.");
}

function readTaskResource(workspaceRoot, taskId) {
  const handlers = createResourceHandlers(workspaceRoot);
  const resource = handlers.readResource(`workflow://tasks/${taskId}`);
  return JSON.parse(resource.contents[0].text);
}

const tests = [
  {
    name: "approval endpoint marks a done task human verified and exposes review state in MCP resources",
    async run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("approval-loop-approve");
      updateTaskMeta(workspaceRoot, taskId, { status: "done" });
      const server = await startTestServer(workspaceRoot);

      try {
        const approved = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}/approve`, {
          method: "POST",
          body: {},
        });
        assert.equal(approved.statusCode, 200);
        assert.equal(approved.json.reviewStatus, "approved");
        assert.equal(typeof approved.json.reviewedAt, "string");
        assert.equal(readJsonFile(files.meta).reviewStatus, "approved");

        const approvedAgain = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}/approve`, {
          method: "POST",
          body: {},
        });
        assert.equal(approvedAgain.statusCode, 200);
        assert.equal(approvedAgain.json.reviewedAt, approved.json.reviewedAt);

        const taskResource = readTaskResource(workspaceRoot, taskId);
        assert.equal(taskResource.task.reviewStatus, "approved");
        assert.equal(taskResource.reviewStatus, "approved");
        assert.equal(taskResource.reviewedAt, approved.json.reviewedAt);
      } finally {
        await server.stop();
      }
    },
  },
  {
    name: "rejection endpoint requires feedback and creates one linked correction task",
    async run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("approval-loop-reject", {
        title: "Original dashboard task",
      });
      const meta = readJsonFile(files.meta);
      writeJsonFile(files.meta, {
        ...meta,
        scope: ["src/server.js", "dashboard-next/src/components/TaskDetail.jsx"],
        status: "done",
        updatedAt: "2026-04-24T00:00:00.000Z",
      });
      const server = await startTestServer(workspaceRoot);

      try {
        const missingFeedback = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}/reject`, {
          method: "POST",
          body: {},
        });
        assert.equal(missingFeedback.statusCode, 400);
        assert.equal(missingFeedback.json.code, "rejection_feedback_required");

        const rejected = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}/reject`, {
          method: "POST",
          body: {
            feedback: "Please fix the missing approval controls before handoff.",
          },
        });
        assert.equal(rejected.statusCode, 200);
        assert.equal(rejected.json.task.reviewStatus, "rejected");
        assert.equal(rejected.json.task.rejectionFeedback, "Please fix the missing approval controls before handoff.");
        assert.equal(rejected.json.correctionTask.id, "T-002");
        assert.equal(rejected.json.correctionTask.parentTaskId, taskId);
        assert.equal(rejected.json.correctionTask.status, "todo");
        assert.equal(rejected.json.correctionTask.recipeId, meta.recipeId);
        assert.deepEqual(rejected.json.correctionTask.scope, [
          "src/server.js",
          "dashboard-next/src/components/TaskDetail.jsx",
        ]);

        const originalMeta = readJsonFile(files.meta);
        assert.equal(originalMeta.correctionTaskId, "T-002");
        assert.equal(originalMeta.reviewStatus, "rejected");

        const correctionFiles = taskFiles(workspaceRoot, "T-002");
        assert.match(readTextFile(correctionFiles.context), /Please fix the missing approval controls/);
        assert.match(readTextFile(correctionFiles.task), /Correction Source/);

        const rejectedAgain = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}/reject`, {
          method: "POST",
          body: {
            feedback: "A second click should not create another task.",
          },
        });
        assert.equal(rejectedAgain.statusCode, 200);
        assert.equal(rejectedAgain.json.correctionTask.id, "T-002");
        assert.deepEqual(
          listTasks(workspaceRoot).map((task) => task.id),
          ["T-001", "T-002"]
        );

        const taskResource = readTaskResource(workspaceRoot, taskId);
        assert.equal(taskResource.reviewStatus, "rejected");
        assert.equal(taskResource.correctionTaskId, "T-002");
        assert.match(taskResource.rejectionFeedback, /missing approval controls/);
      } finally {
        await server.stop();
      }
    },
  },
  {
    name: "review endpoints reject tasks that are not done",
    async run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("approval-loop-not-done");
      const server = await startTestServer(workspaceRoot);

      try {
        const approved = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}/approve`, {
          method: "POST",
          body: {},
        });
        assert.equal(approved.statusCode, 409);
        assert.equal(approved.json.code, "task_not_reviewable");
      } finally {
        await server.stop();
      }
    },
  },
];

const suite = {
  name: "approval-loop",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
