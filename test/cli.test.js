const assert = require("node:assert/strict");
const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

const { createTaskWorkspace } = require("./test-helpers");
const { main } = require("../src/cli");

const CLI_PATH = path.join(__dirname, "..", "src", "cli.js");
const REPO_ROOT = path.join(__dirname, "..");

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

function request(url) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "GET" }, (response) => {
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
    });

    req.on("error", reject);
    req.end();
  });
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

function captureCliStreams(callback) {
  let stdout = "";
  let stderr = "";
  const originalStdoutWrite = process.stdout.write;
  const originalStderrWrite = process.stderr.write;

  process.stdout.write = (chunk, encoding, done) => {
    stdout += String(chunk);
    if (typeof done === "function") {
      done();
    }
    return true;
  };

  process.stderr.write = (chunk, encoding, done) => {
    stderr += String(chunk);
    if (typeof done === "function") {
      done();
    }
    return true;
  };

  try {
    callback();
  } finally {
    process.stdout.write = originalStdoutWrite;
    process.stderr.write = originalStderrWrite;
  }

  return {
    stdout,
    stderr,
  };
}

async function startDashboardFromCli(workspaceRoot) {
  const port = await getFreePort();
  const child = spawn(process.execPath, [CLI_PATH, "dashboard", "--root", workspaceRoot, "--port", String(port)], {
    cwd: REPO_ROOT,
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
      throw new Error(`CLI dashboard exited early with code ${child.exitCode}.`);
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
  throw new Error("Timed out waiting for CLI dashboard command to become ready.");
}

const tests = [
  {
    name: "help lists dashboard command for published-package workflows",
    run() {
      let output = "";
      const originalWrite = process.stdout.write;

      process.stdout.write = (chunk, encoding, callback) => {
        output += String(chunk);
        if (typeof callback === "function") {
          callback();
        }
        return true;
      };

      try {
        main(["help"]);
      } finally {
        process.stdout.write = originalWrite;
      }

      assert.match(output, /memory:validate \[--root path\]/);
      assert.match(output, /adapter:create <adapterId>/);
      assert.match(output, /dashboard \[--root path\] \[--port 4173\] \[--legacy-dashboard\]/);
      assert.match(output, /mcp:install \[--client claude\|cursor\|codex\] \[--root path\]/);
      assert.match(output, /mcp:uninstall \[--client claude\|cursor\|codex\] \[--root path\]/);
      assert.match(output, /undo \[--root path\]/);
    },
  },
  {
    name: "task:list reflects the auto-transitioned status after run:add",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("cli-task-list-status");

      captureCliOutput(() => {
        main(["run:add", taskId, "Started work from the CLI.", "--root", workspaceRoot]);
      });

      const output = captureCliOutput(() => {
        main(["task:list", "--root", workspaceRoot]);
      });

      assert.match(output, /T-001 \| P1 \| in_progress \| recipe=feature \| runs=1 \| Test task/);
    },
  },
  {
    name: "prompt:compile prints its deprecation warning to stderr while keeping stdout for command output",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("cli-prompt-compile");

      const result = captureCliStreams(() => {
        main(["prompt:compile", taskId, "--root", workspaceRoot]);
      });

      assert.match(
        result.stderr,
        /Deprecated: use MCP resource workflow:\/\/tasks\/\{taskId\} or prompt workflow-resume instead\. prompt:compile will be removed in 0\.3\.0\./
      );
      assert.doesNotMatch(result.stdout, /Deprecated:/);
      assert.match(result.stdout, /Compiled codex prompt at /);
      assert.match(
        fs.readFileSync(files.promptCodex, "utf8"),
        /Deprecated: `prompt:compile` will be removed in 0\.3\.0\./
      );
    },
  },
  {
    name: "skills:generate creates CLAUDE.md with workflow rules and AGENTS.md",
    run() {
      const { workspaceRoot } = createTaskWorkspace("cli-skills-generate");

      const result = captureCliStreams(() => {
        main(["skills:generate", "--root", workspaceRoot]);
      });

      assert.doesNotMatch(result.stderr, /Deprecated:/);
      assert.match(result.stdout, /Skills generated: \d+ created, \d+ already existed/);
      assert.equal(fs.existsSync(path.join(workspaceRoot, "AGENTS.md")), true);
      assert.equal(fs.existsSync(path.join(workspaceRoot, "CLAUDE.md")), true);

      const claudeMd = fs.readFileSync(path.join(workspaceRoot, "CLAUDE.md"), "utf8");
      assert.match(claudeMd, /Two task systems, two purposes/);
      assert.match(claudeMd, /workflow_quick/);
    },
  },
  {
    name: "dashboard command starts the local server for a chosen workspace",
    async run() {
      const { workspaceRoot } = createTaskWorkspace("cli-dashboard");
      const server = await startDashboardFromCli(workspaceRoot);

      try {
        const health = await request(`http://127.0.0.1:${server.port}/api/health`);
        assert.equal(health.statusCode, 200);
        assert.deepEqual(health.json, { ok: true });

        const overview = await request(`http://127.0.0.1:${server.port}/api/overview`);
        assert.equal(overview.statusCode, 200);
        assert.equal(overview.json.initialized, true);
        assert.equal(overview.json.workspaceRoot, workspaceRoot);
      } finally {
        await server.stop();
      }
    },
  },
];

const suite = {
  name: "cli",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
