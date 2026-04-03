const fs = require("fs");
const http = require("http");
const path = require("path");
const { spawn, execFileSync } = require("child_process");

async function main() {
  const projectRoot = path.resolve(__dirname, "..");
  const cliPath = path.join(projectRoot, "src", "cli.js");
  const serverPath = path.join(projectRoot, "src", "server.js");
  const tempRoot = path.join(projectRoot, "tmp", "smoke-workspace");

  fs.rmSync(tempRoot, { recursive: true, force: true });
  fs.mkdirSync(path.join(tempRoot, "docs"), { recursive: true });

  fs.writeFileSync(
    path.join(tempRoot, "README.md"),
    "# Smoke Workspace\n\nThis repo exists to validate Agent Workflow Studio.\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(tempRoot, "package.json"),
    `${JSON.stringify(
      {
        name: "smoke-workspace",
        version: "0.0.1",
        scripts: {
          test: "node -e \"console.log('ok')\"",
        },
      },
      null,
      2
    )}\n`,
    "utf8"
  );
  fs.writeFileSync(
    path.join(tempRoot, "docs", "notes.md"),
    "# Notes\n\nThe scanner should discover this file.\n",
    "utf8"
  );
  fs.writeFileSync(
    path.join(tempRoot, "fake-runner.js"),
    `const fs = require("fs");
const path = require("path");

const promptPath = process.argv[2];
const runRequestPath = process.argv[3];

if (!promptPath || !runRequestPath) {
  console.error("missing args");
  process.exit(2);
}

const prompt = fs.readFileSync(promptPath, "utf8");
const runRequest = JSON.parse(fs.readFileSync(runRequestPath, "utf8"));
const markerPath = path.join(process.cwd(), "executor-marker.txt");

fs.writeFileSync(markerPath, prompt.includes("# T-001 Prompt") ? "executor-ok\\n" : "executor-bad\\n", "utf8");
console.log("executed", runRequest.taskId, runRequest.adapterId);
`,
    "utf8"
  );

  runNode(cliPath, ["init", "--root", tempRoot]);
  runNode(cliPath, ["scan", "--root", tempRoot]);
  runNode(cliPath, ["adapter:list", "--root", tempRoot]);
  runNode(cliPath, ["recipe:list", "--root", tempRoot]);
  runNode(cliPath, ["task:new", "T-001", "Build scanner foundation", "--priority", "P1", "--recipe", "feature", "--root", tempRoot]);
  runNode(cliPath, ["prompt:compile", "T-001", "--agent", "codex", "--root", tempRoot]);
  runNode(cliPath, ["run:prepare", "T-001", "--agent", "codex", "--root", tempRoot]);
  runNode(cliPath, ["run:add", "T-001", "Smoke run completed.", "--status", "passed", "--agent", "codex", "--root", tempRoot]);
  runNode(cliPath, ["checkpoint", "T-001", "--root", tempRoot]);
  runNode(cliPath, ["validate", "--root", tempRoot]);

  const codexAdapterPath = path.join(tempRoot, ".agent-workflow", "adapters", "codex.json");
  const codexAdapter = JSON.parse(fs.readFileSync(codexAdapterPath, "utf8"));
  codexAdapter.commandMode = "exec";
  codexAdapter.runnerCommand = ["node"];
  codexAdapter.argvTemplate = ["fake-runner.js", "{promptFile}", "{runRequestFile}"];
  codexAdapter.cwdMode = "workspaceRoot";
  codexAdapter.stdioMode = "inherit";
  codexAdapter.successExitCodes = [0];
  codexAdapter.envAllowlist = [];
  fs.writeFileSync(codexAdapterPath, `${JSON.stringify(codexAdapter, null, 2)}\n`, "utf8");

  runNode(cliPath, ["run:execute", "T-001", "--agent", "codex", "--root", tempRoot]);
  runNode(cliPath, ["validate", "--root", tempRoot]);

  assertExists(path.join(tempRoot, ".agent-workflow", "adapters", "codex.json"));
  assertExists(path.join(tempRoot, ".agent-workflow", "recipes", "index.json"));
  assertExists(path.join(tempRoot, ".agent-workflow", "project-profile.json"));
  assertExists(path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "prompt.codex.md"));
  assertExists(path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "run-request.codex.json"));
  assertExists(path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "launch.codex.md"));
  assertExists(path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "checkpoint.md"));
  assertExists(path.join(tempRoot, "executor-marker.txt"));

  const t001Runs = loadRunRecords(path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "runs"));
  const executorRun = t001Runs.find((run) => run.source === "executor");
  if (!executorRun || executorRun.status !== "passed") {
    throw new Error("run:execute did not persist a passed executor run.");
  }
  if (!fs.readFileSync(path.join(tempRoot, "executor-marker.txt"), "utf8").includes("executor-ok")) {
    throw new Error("Fake executor did not observe the prepared prompt.");
  }
  if (!fs.readFileSync(path.join(tempRoot, ".agent-workflow", "tasks", "T-001", "verification.md"), "utf8").includes("Source: executor")) {
    throw new Error("Executor evidence was not appended to verification.md.");
  }

  const port = 4317;
  const server = spawn(process.execPath, [serverPath, "--root", tempRoot, "--port", String(port)], {
    cwd: projectRoot,
    stdio: "ignore",
  });

  try {
    await wait(800);
    const overview = await fetchJson(`http://127.0.0.1:${port}/api/overview`);
    if (!overview.initialized || overview.tasks.length !== 1) {
      throw new Error("Unexpected overview payload.");
    }

    await requestJson(`http://127.0.0.1:${port}/api/tasks`, "POST", {
      taskId: "T-002",
      title: "Create from dashboard api",
      priority: "P2",
      recipeId: "review",
    });
    await requestJson(`http://127.0.0.1:${port}/api/tasks/T-002`, "PATCH", {
      status: "in_progress",
      priority: "P1",
      recipeId: "audit",
      title: "Create from dashboard api updated",
    });
    await requestJson(`http://127.0.0.1:${port}/api/tasks/T-002/runs`, "POST", {
      agent: "manual",
      status: "draft",
      summary: "Dashboard mutation test.",
    });
    await requestJson(`http://127.0.0.1:${port}/api/tasks/T-002/documents/task.md`, "PUT", {
      content: `# Temporary heading

## Goal

Ship a dashboard markdown editor.

## Scope

- support task.md edits from the dashboard
`,
    });

    const detail = await fetchJson(`http://127.0.0.1:${port}/api/tasks/T-001`);
    if (!detail.meta || detail.meta.recipeId !== "feature") {
      throw new Error("Task detail payload is missing recipe information.");
    }

    const detail2 = await fetchJson(`http://127.0.0.1:${port}/api/tasks/T-002`);
    if (!detail2.meta || detail2.meta.recipeId !== "audit" || detail2.meta.status !== "in_progress") {
      throw new Error("Task mutation endpoints did not persist task metadata.");
    }
    if (!Array.isArray(detail2.runs) || detail2.runs.length !== 1) {
      throw new Error("Run creation endpoint did not persist evidence.");
    }
    if (!detail2.taskText.includes("Ship a dashboard markdown editor.")) {
      throw new Error("Document editor endpoint did not persist custom task.md content.");
    }
    if (!detail2.taskText.includes("# T-002 - Create from dashboard api updated")) {
      throw new Error("Document editor endpoint did not keep the managed task heading in sync.");
    }
    if (!detail2.taskText.includes("- Recipe ID: audit")) {
      throw new Error("Document editor endpoint did not keep recipe metadata in sync.");
    }

    const overview2 = await fetchJson(`http://127.0.0.1:${port}/api/overview`);
    if (overview2.tasks.length !== 2) {
      throw new Error("Overview did not reflect created task.");
    }
  } finally {
    server.kill();
    fs.rmSync(tempRoot, { recursive: true, force: true });
  }

  process.stdout.write("Smoke test passed.\n");
}

function runNode(scriptPath, args) {
  execFileSync(process.execPath, [scriptPath, ...args], {
    stdio: "ignore",
  });
}

function assertExists(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Expected file to exist: ${filePath}`);
  }
}

function loadRunRecords(runsRoot) {
  return fs
    .readdirSync(runsRoot, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
    .map((entry) => JSON.parse(fs.readFileSync(path.join(runsRoot, entry.name), "utf8")));
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function fetchJson(url) {
  return requestJson(url, "GET");
}

function requestJson(url, method, payload) {
  return new Promise((resolve, reject) => {
    const request = http.request(
      url,
      {
        method,
        headers: payload
          ? {
              "Content-Type": "application/json",
            }
          : {},
      },
      (response) => {
        let body = "";
        response.on("data", (chunk) => {
          body += chunk;
        });
        response.on("end", () => {
          try {
            const parsed = body ? JSON.parse(body) : {};
            if (response.statusCode >= 400) {
              reject(new Error(parsed.error || `HTTP ${response.statusCode}`));
              return;
            }
            resolve(parsed);
          } catch (error) {
            reject(error);
          }
        });
      }
    );

    request.on("error", reject);

    if (payload) {
      request.write(JSON.stringify(payload));
    }

    request.end();
  });
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});

