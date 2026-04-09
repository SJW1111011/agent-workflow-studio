const fs = require("fs");
const http = require("http");
const net = require("net");
const path = require("path");
const { spawn, spawnSync } = require("child_process");

const PROJECT_ROOT = path.resolve(__dirname, "..");
const TMP_ROOT = path.join(PROJECT_ROOT, "tmp");
const PACKAGE_NAME = JSON.parse(fs.readFileSync(path.join(PROJECT_ROOT, "package.json"), "utf8")).name;
let localNpmCacheRoot = null;

async function main() {
  fs.mkdirSync(TMP_ROOT, { recursive: true });

  const tempRoot = fs.mkdtempSync(path.join(TMP_ROOT, "npm-onboarding-"));
  const packRoot = path.join(tempRoot, "pack");
  const demoRepoRoot = path.join(tempRoot, "demo-repo");
  const toolRoot = path.join(tempRoot, "workflow-cli");
  localNpmCacheRoot = path.join(tempRoot, ".npm-cache");
  fs.mkdirSync(packRoot, { recursive: true });
  fs.mkdirSync(demoRepoRoot, { recursive: true });
  fs.mkdirSync(toolRoot, { recursive: true });
  fs.mkdirSync(localNpmCacheRoot, { recursive: true });

  let dashboardProcess = null;
  let keepArtifacts = false;

  try {
    log(`Using temp root: ${tempRoot}`);
    const tarballPath = packLocalPackage(packRoot);
    const installedCliPath = initializeToolRoot(toolRoot, tarballPath);

    initializeDemoRepo(demoRepoRoot);

    runInstalledCli(installedCliPath, ["--help"], toolRoot);
    runInstalledCli(installedCliPath, ["init", "--root", demoRepoRoot], toolRoot);
    runInstalledCli(installedCliPath, ["scan", "--root", demoRepoRoot], toolRoot);
    runInstalledCli(installedCliPath, ["memory:bootstrap", "--root", demoRepoRoot], toolRoot);
    runInstalledCli(
      installedCliPath,
      [
        "quick",
        "Ship the onboarding slice",
        "--task-id",
        "T-001",
        "--priority",
        "P1",
        "--recipe",
        "feature",
        "--agent",
        "codex",
        "--root",
        demoRepoRoot,
      ],
      toolRoot
    );
    runInstalledCli(installedCliPath, ["validate", "--root", demoRepoRoot], toolRoot);

    assertFile(path.join(demoRepoRoot, ".agent-workflow", "handoffs", "memory-bootstrap.md"));
    assertFile(path.join(demoRepoRoot, ".agent-workflow", "tasks", "T-001", "prompt.codex.md"));
    assertFile(path.join(demoRepoRoot, ".agent-workflow", "tasks", "T-001", "run-request.codex.json"));
    assertFile(path.join(demoRepoRoot, ".agent-workflow", "tasks", "T-001", "launch.codex.md"));
    assertFile(path.join(demoRepoRoot, ".agent-workflow", "tasks", "T-001", "checkpoint.md"));

    const port = await getFreePort();
    dashboardProcess = startDashboard(installedCliPath, toolRoot, demoRepoRoot, port);
    await waitForDashboard(port, dashboardProcess);

    const dashboardHtml = await requestText(`http://127.0.0.1:${port}/`);
    if (!dashboardHtml.includes("Quick Create") || !dashboardHtml.includes("task-quick-form")) {
      throw new Error("Published dashboard did not expose the quick-create UI.");
    }

    const health = await requestJson(`http://127.0.0.1:${port}/api/health`);
    if (!health || health.ok !== true) {
      throw new Error("Dashboard health endpoint did not return ok=true.");
    }

    const overview = await requestJson(`http://127.0.0.1:${port}/api/overview`);
    if (!overview || !Array.isArray(overview.tasks) || !overview.tasks.some((task) => task.id === "T-001")) {
      throw new Error("Published dashboard overview did not include the quick-created task.");
    }

    const dashboardQuick = await requestJson(`http://127.0.0.1:${port}/api/quick`, {
      method: "POST",
      body: {
        taskId: "T-002",
        title: "Drive quick creation from the dashboard",
        priority: "P2",
        recipeId: "review",
        agent: "claude-code",
      },
    });

    if (
      !dashboardQuick ||
      dashboardQuick.taskId !== "T-002" ||
      dashboardQuick.adapterId !== "claude-code" ||
      !String(dashboardQuick.promptPath || "").endsWith("prompt.claude.md") ||
      !String(dashboardQuick.runRequestPath || "").endsWith("run-request.claude-code.json") ||
      !String(dashboardQuick.launchPackPath || "").endsWith("launch.claude-code.md")
    ) {
      throw new Error("Dashboard quick API did not materialize the expected durable artifacts.");
    }

    assertFile(path.join(demoRepoRoot, dashboardQuick.promptPath));
    assertFile(path.join(demoRepoRoot, dashboardQuick.runRequestPath));
    assertFile(path.join(demoRepoRoot, dashboardQuick.launchPackPath));
    assertFile(path.join(demoRepoRoot, dashboardQuick.checkpointPath));

    const quickTaskDetail = await requestJson(`http://127.0.0.1:${port}/api/tasks/T-002`);
    if (!quickTaskDetail || !quickTaskDetail.meta || quickTaskDetail.meta.id !== "T-002") {
      throw new Error("Dashboard quick-created task detail did not load correctly.");
    }

    log("npm-first onboarding check passed.");
  } catch (error) {
    keepArtifacts = true;
    console.error(error && error.stack ? error.stack : error);
    console.error(`Temporary artifacts kept at ${tempRoot}`);
    process.exitCode = 1;
  } finally {
    await stopChild(dashboardProcess);
    if (!keepArtifacts) {
      fs.rmSync(tempRoot, { recursive: true, force: true });
    }
  }
}

function packLocalPackage(packRoot) {
  const stdout = runNpmCommand(["pack", PROJECT_ROOT, "--json"], {
    cwd: packRoot,
  });

  let payload;
  try {
    payload = JSON.parse(stdout);
  } catch (error) {
    throw new Error(`Failed to parse npm pack output as JSON.\n${stdout}`);
  }

  const fileName =
    Array.isArray(payload) && payload[0] && typeof payload[0].filename === "string"
      ? payload[0].filename
      : null;
  if (!fileName) {
    throw new Error(`npm pack did not report a tarball filename.\n${stdout}`);
  }

  const tarballPath = path.join(packRoot, fileName);
  assertFile(tarballPath);
  return tarballPath;
}

function initializeDemoRepo(demoRepoRoot) {
  runNpmCommand(["init", "-y"], { cwd: demoRepoRoot });
  fs.writeFileSync(path.join(demoRepoRoot, "README.md"), "# Demo repo\n", "utf8");
}

function initializeToolRoot(toolRoot, tarballPath) {
  runNpmCommand(["init", "-y"], { cwd: toolRoot });
  runNpmCommand(["install", "--no-audit", "--no-fund", tarballPath], {
    cwd: toolRoot,
  });

  const installedCliPath = path.join(toolRoot, "node_modules", PACKAGE_NAME, "src", "cli.js");
  const installedBinPath = path.join(
    toolRoot,
    "node_modules",
    ".bin",
    process.platform === "win32" ? "agent-workflow.cmd" : "agent-workflow"
  );
  assertFile(installedCliPath);
  assertFile(installedBinPath);
  return installedCliPath;
}

function runInstalledCli(installedCliPath, args, cwd) {
  return runCommand(process.execPath, [installedCliPath].concat(args), { cwd });
}

function startDashboard(installedCliPath, cwd, workspaceRoot, port) {
  const child = spawn(
    process.execPath,
    [
      installedCliPath,
      "dashboard",
      "--root",
      workspaceRoot,
      "--port",
      String(port),
    ],
    {
      cwd,
      env: buildCommandEnv(),
      stdio: ["ignore", "pipe", "pipe"],
    }
  );

  child.stdoutText = "";
  child.stderrText = "";
  child.stdout.on("data", (chunk) => {
    child.stdoutText += String(chunk || "");
  });
  child.stderr.on("data", (chunk) => {
    child.stderrText += String(chunk || "");
  });

  return child;
}

async function waitForDashboard(port, child) {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    if (child && child.exitCode !== null) {
      throw new Error(
        `Dashboard exited early with code ${child.exitCode}.\nstdout:\n${child.stdoutText || ""}\nstderr:\n${child.stderrText || ""}`
      );
    }

    try {
      const payload = await requestJson(`http://127.0.0.1:${port}/api/health`);
      if (payload && payload.ok === true) {
        return;
      }
    } catch (error) {
      // Keep polling until the dashboard responds or exits.
    }

    await delay(250);
  }

  throw new Error(
    `Timed out waiting for dashboard startup.\nstdout:\n${child && child.stdoutText ? child.stdoutText : ""}\nstderr:\n${
      child && child.stderrText ? child.stderrText : ""
    }`
  );
}

function requestJson(url, options = {}) {
  return new Promise((resolve, reject) => {
    const body = options.body === undefined ? null : JSON.stringify(options.body);
    const headers = {
      ...(options.headers || {}),
    };
    if (body !== null) {
      headers["Content-Type"] = "application/json";
    }

    const request = http.request(
      url,
      {
        method: options.method || "GET",
        headers,
      },
      (response) => {
        let text = "";
        response.on("data", (chunk) => {
          text += chunk;
        });
        response.on("end", () => {
          if ((response.statusCode || 500) >= 400) {
            reject(new Error(`Request failed (${response.statusCode}) for ${url}\n${text}`));
            return;
          }
          try {
            resolve(text ? JSON.parse(text) : null);
          } catch (error) {
            reject(new Error(`Failed to parse JSON from ${url}\n${text}`));
          }
        });
      }
    );

    request.on("error", reject);
    if (body !== null) {
      request.write(body);
    }
    request.end();
  });
}

function requestText(url, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      url,
      {
        method: options.method || "GET",
        headers: options.headers || {},
      },
      (response) => {
        let text = "";
        response.on("data", (chunk) => {
          text += chunk;
        });
        response.on("end", () => {
          if ((response.statusCode || 500) >= 400) {
            reject(new Error(`Request failed (${response.statusCode}) for ${url}\n${text}`));
            return;
          }
          resolve(text);
        });
      }
    );

    request.on("error", reject);
    request.end();
  });
}

function runNpmCommand(args, options = {}) {
  return runCommand(process.execPath, [resolveNpmCliPath()].concat(args), options);
}

function runCommand(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd || PROJECT_ROOT,
    env: {
      ...buildCommandEnv(),
      ...(options.env || {}),
    },
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });

  if (result.status !== 0) {
    throw new Error(
      [
        `Command failed: ${command} ${args.join(" ")}`,
        `cwd: ${options.cwd || PROJECT_ROOT}`,
        `exit: ${result.status}`,
        result.error ? `error: ${result.error.message}` : "",
        result.stdout ? `stdout:\n${result.stdout}` : "",
        result.stderr ? `stderr:\n${result.stderr}` : "",
      ]
        .filter(Boolean)
        .join("\n")
    );
  }

  return result.stdout || "";
}

function buildCommandEnv() {
  return {
    ...process.env,
    npm_config_cache: localNpmCacheRoot || path.join(PROJECT_ROOT, ".npm-cache-tmp"),
  };
}

function resolveNpmCliPath() {
  const candidates = [
    process.env.npm_execpath,
    path.join(path.dirname(process.execPath), "node_modules", "npm", "bin", "npm-cli.js"),
    path.join(path.dirname(path.dirname(process.execPath)), "lib", "node_modules", "npm", "bin", "npm-cli.js"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (candidate && fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error("Unable to locate npm-cli.js for onboarding verification.");
}

async function stopChild(child) {
  if (!child || child.exitCode !== null) {
    return;
  }

  child.kill();
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (child.exitCode !== null) {
      return;
    }
    await delay(100);
  }

  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
}

function assertFile(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expected file to exist: ${filePath}`);
  }
}

function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

function log(message) {
  process.stdout.write(`${message}\n`);
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : error);
  process.exitCode = 1;
});
