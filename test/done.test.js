const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");

const { main } = require("../src/cli");
const { recordDone } = require("../src/lib/done");
const { listRuns } = require("../src/lib/task-service");
const { startDashboardServer } = require("../src/server");
const { createTaskWorkspace, readJsonFile, readTextFile, writeTextFile } = require("./test-helpers");

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
          let json = null;
          try {
            json = body ? JSON.parse(body) : null;
          } catch (error) {
            json = null;
          }

          resolve({
            statusCode: response.statusCode,
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
  throw new Error("Timed out waiting for local done test server to become ready.");
}

function captureCliOutput(callback) {
  let output = "";
  const originalWrite = process.stdout.write;

  process.stdout.write = (chunk, encoding, done) => {
    output += String(chunk);
    if (typeof done === "function") {
      done();
    }
    return true;
  };

  try {
    callback();
  } finally {
    process.stdout.write = originalWrite;
  }

  return output;
}

const tests = [
  {
    name: "recordDone records a draft run and refreshes checkpoint without extra flags",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("done-basic");

      const result = recordDone(workspaceRoot, taskId, "Implemented the one-step done flow.");

      assert.equal(result.run.status, "draft");
      assert.equal(result.checkpoint.taskId, taskId);
      assert.equal(result.checkpoint.latestRunStatus, "draft");
      assert.equal(result.checkpoint.runCount, 1);
      assert.equal(result.task, null);
      assert.equal(readJsonFile(files.meta).status, "in_progress");
      assert.match(readTextFile(files.verification), /Implemented the one-step done flow\./);
      assert.match(readTextFile(files.checkpoint), /- Status: in_progress/);
      assert.match(readTextFile(files.checkpoint), /Latest run status: draft/);
      assert.equal(listRuns(workspaceRoot, taskId).length, 1);
    },
  },
  {
    name: "recordDone can mark a task done after recording passed evidence",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("done-complete");

      const result = recordDone(workspaceRoot, taskId, "Completed the done command.", {
        status: "passed",
        complete: true,
        scopeProofPaths: ["src/cli.js"],
        verificationChecks: ["npm test"],
      });

      assert.equal(result.run.status, "passed");
      assert.equal(result.task.status, "done");
      assert.equal(readJsonFile(files.meta).status, "done");
      assert.match(readTextFile(files.checkpoint), /- Status: done/);
      assert.match(readTextFile(files.checkpoint), /Latest run status: passed/);
    },
  },
  {
    name: "recordDone materializes lite task docs, checkpoint, and run storage on demand",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("done-lite", {
        scaffoldMode: "lite",
      });
      const taskRoot = path.join(workspaceRoot, ".agent-workflow", "tasks", taskId);

      assert.deepEqual(fs.readdirSync(taskRoot).sort(), ["task.json", "task.md"]);

      const result = recordDone(workspaceRoot, taskId, "Recorded lite done evidence.");

      assert.equal(result.checkpoint.runCount, 1);
      assert.ok(fs.existsSync(path.join(taskRoot, "context.md")));
      assert.ok(fs.existsSync(path.join(taskRoot, "verification.md")));
      assert.ok(fs.existsSync(path.join(taskRoot, "checkpoint.md")));
      assert.ok(fs.existsSync(path.join(taskRoot, "checkpoint.json")));
      assert.ok(fs.existsSync(path.join(taskRoot, "runs")));
    },
  },
  {
    name: "cli done command forwards proof, check, artifact, and complete options",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("done-cli");
      writeTextFile(path.join(workspaceRoot, "src", "cli.js"), "module.exports = 'cli';\n");
      writeTextFile(path.join(workspaceRoot, "README.md"), "# Done CLI\n");

      const output = captureCliOutput(() => {
        main([
          "done",
          taskId,
          "CLI done recording.",
          "--status",
          "passed",
          "--proof-path",
          "src/cli.js",
          "--proof-path",
          "README.md",
          "--check",
          "npm test",
          "--artifact",
          `.agent-workflow/tasks/${taskId}/checkpoint.md`,
          "--strict",
          "--complete",
          "--root",
          workspaceRoot,
        ]);
      });

      const run = listRuns(workspaceRoot, taskId)[0];
      assert.equal(run.status, "passed");
      assert.deepEqual(run.scopeProofPaths, ["src/cli.js", "README.md"]);
      assert.equal(run.verificationChecks[0].label, "npm test");
      assert.equal(run.verificationChecks[0].status, "passed");
      assert.deepEqual(run.verificationArtifacts, [`.agent-workflow/tasks/${taskId}/checkpoint.md`]);
      assert.ok(Array.isArray(run.scopeProofAnchors));
      assert.equal(run.scopeProofAnchors.length, 2);
      assert.equal(readJsonFile(files.meta).status, "done");
      assert.match(output, /Recorded run run-/);
      assert.match(output, /Checkpoint updated for T-001 with 1 recorded run\(s\)\./);
      assert.match(output, /Task T-001 marked done\./);
    },
  },
  {
    name: "server done endpoint records evidence, refreshes the checkpoint, and returns refreshed task detail",
    async run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("done-server");
      const server = await startServer(workspaceRoot);

      try {
        const response = await request(`http://127.0.0.1:${server.port}/api/tasks/${taskId}/done`, {
          method: "POST",
          body: {
            summary: "Server done recording.",
            status: "passed",
            proofPaths: ["src/server.js"],
            checks: ["npm run smoke"],
            complete: true,
          },
        });

        assert.equal(response.statusCode, 201);
        assert.equal(response.json.run.status, "passed");
        assert.equal(response.json.checkpoint.latestRunStatus, "passed");
        assert.equal(response.json.task.meta.status, "done");
        assert.equal(response.json.task.runs.length, 1);
        assert.equal(response.json.task.runs[0].scopeProofPaths[0], "src/server.js");
      } finally {
        await server.stop();
      }
    },
  },
];

const suite = {
  name: "done",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
