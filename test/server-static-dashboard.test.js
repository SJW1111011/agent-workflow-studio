const assert = require("node:assert/strict");
const http = require("http");
const net = require("net");
const path = require("path");

const { startDashboardServer } = require("../src/server");
const { createTaskWorkspace, trackTempDirectory, writeTextFile } = require("./test-helpers");

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

function requestText(url) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, { method: "GET" }, (response) => {
      let body = "";
      response.on("data", (chunk) => {
        body += chunk;
      });
      response.on("end", () => {
        resolve({
          body,
          statusCode: response.statusCode,
        });
      });
    });

    req.on("error", reject);
    req.end();
  });
}

async function startServer(workspaceRoot, options = {}) {
  const port = await getFreePort();
  const server = startDashboardServer(workspaceRoot, {
    ...options,
    port,
  });

  for (let index = 0; index < 40; index += 1) {
    const response = await requestText(`http://127.0.0.1:${port}/api/health`).catch(() => null);
    if (response && response.statusCode === 200) {
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

    await delay(25);
  }

  throw new Error("Timed out waiting for dashboard server.");
}

function createStaticDashboardRoot(prefix, indexText) {
  const root = trackTempDirectory(path.join(__dirname, "..", "tmp", "unit-tests", `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`));
  writeTextFile(path.join(root, "index.html"), indexText);
  return root;
}

const tests = [
  {
    name: "server prefers the built dashboard shell when dist is available",
    async run() {
      const { workspaceRoot } = createTaskWorkspace("server-static-modern");
      const modernRoot = createStaticDashboardRoot("modern-dashboard", "<!doctype html><title>Modern</title><div>Modern dashboard shell</div>");
      const legacyRoot = createStaticDashboardRoot("legacy-dashboard", "<!doctype html><title>Legacy</title><div>Legacy dashboard</div>");
      const server = await startServer(workspaceRoot, {
        legacyDashboardRoot: legacyRoot,
        modernDashboardRoot: modernRoot,
      });

      try {
        const response = await requestText(`http://127.0.0.1:${server.port}/`);
        assert.equal(response.statusCode, 200);
        assert.match(response.body, /Modern dashboard shell/);
      } finally {
        await server.stop();
      }
    },
  },
  {
    name: "server uses the legacy dashboard when explicitly requested",
    async run() {
      const { workspaceRoot } = createTaskWorkspace("server-static-legacy");
      const modernRoot = createStaticDashboardRoot("modern-dashboard", "<!doctype html><title>Modern</title><div>Modern dashboard shell</div>");
      const legacyRoot = createStaticDashboardRoot("legacy-dashboard", "<!doctype html><title>Legacy</title><div>Legacy dashboard</div>");
      const server = await startServer(workspaceRoot, {
        legacyDashboard: true,
        legacyDashboardRoot: legacyRoot,
        modernDashboardRoot: modernRoot,
      });

      try {
        const response = await requestText(`http://127.0.0.1:${server.port}/`);
        assert.equal(response.statusCode, 200);
        assert.match(response.body, /Legacy dashboard/);
      } finally {
        await server.stop();
      }
    },
  },
];

const suite = {
  name: "server-static-dashboard",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
