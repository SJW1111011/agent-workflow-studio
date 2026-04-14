#!/usr/bin/env node

const fs = require("fs");
const http = require("http");
const path = require("path");
const { buildCheckpoint } = require("./lib/checkpoint");
const { createDashboardExecutionBridge } = require("./lib/dashboard-execution");
const { recordDone } = require("./lib/done");
const { badRequest, getHttpStatusCode } = require("./lib/http-errors");
const { buildOverview } = require("./lib/overview");
const { quickCreateTask } = require("./lib/quick-task");
const { listRecipes } = require("./lib/recipes");
const { validateWorkspace } = require("./lib/schema-validator");
const { refreshManualProofAnchors, saveTaskDocument } = require("./lib/task-documents");
const { createTask, getRunLog, getTaskDetail, recordRun, updateTaskMeta } = require("./lib/task-service");
const { resolveWorkspaceRoot } = require("./lib/workspace");

const MIME_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

function main(argv = process.argv.slice(2)) {
  const { options } = parseArgs(argv);
  const workspaceRoot = resolveWorkspaceRoot(options.root);
  return startDashboardServer(workspaceRoot, {
    port: options.port,
  });
}

function startDashboardServer(workspaceRoot, options = {}) {
  const port = normalizeServerPort(options.port);
  const dashboardRoot = path.join(__dirname, "..", "dashboard");
  const executionBridge = createDashboardExecutionBridge(workspaceRoot);

  const server = http.createServer((request, response) => {
    const requestUrl = new URL(request.url, `http://${request.headers.host}`);

    Promise.resolve()
      .then(async () => {
        if (requestUrl.pathname === "/api/health") {
          return sendJson(response, 200, { ok: true });
        }

        if (requestUrl.pathname === "/api/overview") {
          return sendJson(response, 200, buildOverview(workspaceRoot));
        }

        if (requestUrl.pathname === "/api/tasks" && request.method === "GET") {
          return sendJson(response, 200, buildOverview(workspaceRoot).tasks);
        }

        if (requestUrl.pathname === "/api/tasks" && request.method === "POST") {
          const body = await readJsonBody(request);
          if (!isNonEmptyString(body.taskId) || !isNonEmptyString(body.title)) {
            return sendJson(response, 400, { error: "taskId and title are required." });
          }
          if (getTaskDetail(workspaceRoot, body.taskId)) {
            return sendJson(response, 409, { error: `Task already exists: ${body.taskId}` });
          }

          const task = createTask(workspaceRoot, body.taskId, body.title, {
            priority: body.priority,
            recipe: body.recipeId || body.recipe,
          });
          return sendJson(response, 201, task);
        }

        if (requestUrl.pathname === "/api/quick" && request.method === "POST") {
          const body = await readJsonBody(request);
          const quickResult = quickCreateTask(workspaceRoot, body.title, {
            taskId: body.taskId,
            priority: body.priority,
            recipe: body.recipeId || body.recipe,
            agent: body.agent || body.adapterId,
          });
          return sendJson(response, 201, {
            taskId: quickResult.taskId,
            title: quickResult.title,
            priority: quickResult.priority,
            recipeId: quickResult.recipeId,
            agent: quickResult.agent,
            adapterId: quickResult.adapterId,
            promptPath: toRepositoryRelativePath(workspaceRoot, quickResult.prompt.outputPath),
            runRequestPath: toRepositoryRelativePath(workspaceRoot, quickResult.prepared.runRequestPath),
            launchPackPath: toRepositoryRelativePath(workspaceRoot, quickResult.prepared.launchPackPath),
            checkpointPath: toRepositoryRelativePath(
              workspaceRoot,
              path.join(quickResult.workflowRoot, "tasks", quickResult.taskId, "checkpoint.md")
            ),
          });
        }

        if (requestUrl.pathname.startsWith("/api/tasks/") && request.method === "POST" && requestUrl.pathname.endsWith("/runs")) {
          const taskId = decodeURIComponent(
            requestUrl.pathname.slice("/api/tasks/".length, -"/runs".length)
          );
          const body = await readJsonBody(request);
          if (!isNonEmptyString(body.summary)) {
            return sendJson(response, 400, { error: "summary is required." });
          }
          const run = recordRun(
            workspaceRoot,
            taskId,
            body.summary,
            body.status || "draft",
            body.agent || "manual",
            buildManualRunFieldsFromBody(body),
            {
              undoType: "run:add",
            }
          );
          buildCheckpoint(workspaceRoot, taskId);
          return sendJson(response, 201, run);
        }

        const taskDoneRoute = parseTaskDoneRoute(requestUrl.pathname);
        if (taskDoneRoute && request.method === "POST") {
          const body = await readJsonBody(request);
          if (!isNonEmptyString(body.summary)) {
            return sendJson(response, 400, { error: "summary is required." });
          }

          const result = recordDone(workspaceRoot, taskDoneRoute.taskId, body.summary, {
            status: body.status || "draft",
            agent: body.agent || "manual",
            complete: body.complete,
            ...buildManualRunFieldsFromBody(body),
          });

          return sendJson(response, 201, {
            run: result.run,
            checkpoint: result.checkpoint,
            task: buildTaskResponse(workspaceRoot, taskDoneRoute.taskId, executionBridge),
          });
        }

        if (requestUrl.pathname.startsWith("/api/tasks/") && request.method === "PATCH") {
          const taskId = decodeURIComponent(requestUrl.pathname.slice("/api/tasks/".length));
          const body = await readJsonBody(request);
          const updated = updateTaskMeta(workspaceRoot, taskId, body);
          buildCheckpoint(workspaceRoot, taskId);
          return sendJson(response, 200, updated);
        }

        const documentRoute = parseTaskDocumentRoute(requestUrl.pathname);
        if (documentRoute && request.method === "PUT") {
          const body = await readJsonBody(request);
          if (typeof body.content !== "string") {
            return sendJson(response, 400, { error: "content must be a string." });
          }

          saveTaskDocument(workspaceRoot, documentRoute.taskId, documentRoute.documentName, body.content);
          buildCheckpoint(workspaceRoot, documentRoute.taskId);
          return sendJson(response, 200, buildTaskResponse(workspaceRoot, documentRoute.taskId, executionBridge));
        }

        const manualProofAnchorRefreshRoute = parseTaskVerificationAnchorRefreshRoute(requestUrl.pathname);
        if (manualProofAnchorRefreshRoute && request.method === "POST") {
          const refreshSummary = refreshManualProofAnchors(workspaceRoot, manualProofAnchorRefreshRoute.taskId);
          if (refreshSummary.changed) {
            buildCheckpoint(workspaceRoot, manualProofAnchorRefreshRoute.taskId);
          }
          return sendJson(response, 200, {
            ...buildTaskResponse(workspaceRoot, manualProofAnchorRefreshRoute.taskId, executionBridge),
            manualProofAnchorRefresh: refreshSummary,
          });
        }

        const taskExecuteRoute = parseTaskExecuteRoute(requestUrl.pathname);
        if (taskExecuteRoute && request.method === "POST") {
          const body = await readJsonBody(request);
          const state = await executionBridge.startTaskExecution(taskExecuteRoute.taskId, body.agent || body.adapterId, {
            timeoutMs: body.timeoutMs,
          });
          return sendJson(response, 202, state);
        }

        const taskExecutionRoute = parseTaskExecutionRoute(requestUrl.pathname);
        if (taskExecutionRoute && request.method === "GET") {
          if (!getTaskDetail(workspaceRoot, taskExecutionRoute.taskId)) {
            return sendJson(response, 404, { error: `Task not found: ${taskExecutionRoute.taskId}` });
          }
          return sendJson(response, 200, executionBridge.getTaskExecution(taskExecutionRoute.taskId));
        }

        const taskExecutionLogRoute = parseTaskExecutionLogRoute(requestUrl.pathname);
        if (taskExecutionLogRoute && request.method === "GET") {
          if (!getTaskDetail(workspaceRoot, taskExecutionLogRoute.taskId)) {
            return sendJson(response, 404, { error: `Task not found: ${taskExecutionLogRoute.taskId}` });
          }
          return sendJson(
            response,
            200,
            executionBridge.getTaskExecutionLog(
              taskExecutionLogRoute.taskId,
              taskExecutionLogRoute.stream,
              normalizePositiveInteger(requestUrl.searchParams.get("maxChars")) || undefined
            )
          );
        }

        const taskExecutionCancelRoute = parseTaskExecutionCancelRoute(requestUrl.pathname);
        if (taskExecutionCancelRoute && request.method === "POST") {
          if (!getTaskDetail(workspaceRoot, taskExecutionCancelRoute.taskId)) {
            return sendJson(response, 404, { error: `Task not found: ${taskExecutionCancelRoute.taskId}` });
          }
          return sendJson(response, 202, await executionBridge.cancelTaskExecution(taskExecutionCancelRoute.taskId));
        }

        const runLogRoute = parseTaskRunLogRoute(requestUrl.pathname);
        if (runLogRoute && request.method === "GET") {
          return sendJson(
            response,
            200,
            getRunLog(workspaceRoot, runLogRoute.taskId, runLogRoute.runId, runLogRoute.stream)
          );
        }

        if (requestUrl.pathname.startsWith("/api/tasks/") && request.method === "GET") {
          const taskId = decodeURIComponent(requestUrl.pathname.slice("/api/tasks/".length));
          const detail = buildTaskResponse(workspaceRoot, taskId, executionBridge);
          if (!detail) {
            return sendJson(response, 404, { error: `Task not found: ${taskId}` });
          }
          return sendJson(response, 200, detail);
        }

        if (requestUrl.pathname === "/api/runs") {
          return sendJson(response, 200, buildOverview(workspaceRoot).runs);
        }

        if (requestUrl.pathname === "/api/recipes") {
          return sendJson(response, 200, listRecipes(workspaceRoot));
        }

        if (requestUrl.pathname === "/api/validate") {
          return sendJson(response, 200, validateWorkspace(workspaceRoot));
        }

        return serveStatic(dashboardRoot, requestUrl.pathname, response);
      })
      .catch((error) => {
        sendJson(response, getHttpStatusCode(error), buildErrorPayload(error));
      });
  });

  server.listen(port, () => {
    process.stdout.write(
      `Agent Workflow Studio dashboard is running at http://localhost:${port}\nTarget repository: ${workspaceRoot}\n`
    );
  });

  return server;
}

function parseArgs(argv) {
  const options = {};

  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (value.startsWith("--")) {
      const key = value.slice(2);
      const nextValue = argv[index + 1];
      if (nextValue && !nextValue.startsWith("--")) {
        options[key] = nextValue;
        index += 1;
      } else {
        options[key] = true;
      }
    }
  }

  return { options };
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, { "Content-Type": MIME_TYPES[".json"] });
  response.end(`${JSON.stringify(payload, null, 2)}\n`);
}

function buildErrorPayload(error) {
  const payload = {
    error: error.message,
  };

  if (typeof error.code === "string" && error.code.trim()) {
    payload.code = error.code.trim();
  }

  if (typeof error.failureCategory === "string" && error.failureCategory.trim()) {
    payload.failureCategory = error.failureCategory.trim();
  }

  if (Array.isArray(error.blockingIssues) && error.blockingIssues.length > 0) {
    payload.blockingIssues = error.blockingIssues;
  }

  if (Array.isArray(error.advisories) && error.advisories.length > 0) {
    payload.advisories = error.advisories;
  }

  return payload;
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";

    request.on("data", (chunk) => {
      body += chunk;
      if (body.length > 1024 * 1024) {
        reject(badRequest("Request body too large.", "request_body_too_large"));
      }
    });

    request.on("end", () => {
      if (!body.trim()) {
        resolve({});
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch (error) {
        reject(badRequest("Invalid JSON body.", "invalid_json_body"));
      }
    });

    request.on("error", reject);
  });
}

function serveStatic(dashboardRoot, pathname, response) {
  const relativePath = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const safePath = path.normalize(relativePath).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(dashboardRoot, safePath);

  if (!filePath.startsWith(dashboardRoot) || !fs.existsSync(filePath)) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
    return;
  }

  const extension = path.extname(filePath);
  const contentType = MIME_TYPES[extension] || "application/octet-stream";
  response.writeHead(200, { "Content-Type": contentType });
  response.end(fs.readFileSync(filePath));
}

function buildTaskResponse(workspaceRoot, taskId, executionBridge) {
  const detail = getTaskDetail(workspaceRoot, taskId);
  if (!detail) {
    return null;
  }

  const validation = validateWorkspace(workspaceRoot);
  const taskTarget = `.agent-workflow/tasks/${taskId}`;
  return {
    ...detail,
    executionState: executionBridge ? executionBridge.getTaskExecution(taskId) : undefined,
    schemaIssues: validation.issues.filter((item) => String(item.target).includes(taskTarget)),
  };
}

function toRepositoryRelativePath(workspaceRoot, value) {
  return path.relative(workspaceRoot, value).replace(/\\/g, "/");
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizePositiveInteger(value) {
  const numeric = Number(value);
  return Number.isInteger(numeric) && numeric > 0 ? numeric : null;
}

function buildManualRunFieldsFromBody(body = {}) {
  return {
    scopeProofPaths: body.scopeProofPaths || body.proofPaths,
    verificationChecks: body.verificationChecks || body.checks,
    verificationArtifacts: body.verificationArtifacts || body.artifacts,
  };
}

function normalizeServerPort(value) {
  if (value === undefined || value === null || value === "") {
    return 4173;
  }

  const numeric = Number(value);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new Error("Usage: dashboard [--root path] [--port 4173]");
  }

  return numeric;
}

function parseTaskDocumentRoute(pathname) {
  const matched = pathname.match(/^\/api\/tasks\/([^/]+)\/documents\/([^/]+)$/);
  if (!matched) {
    return null;
  }

  return {
    taskId: decodeURIComponent(matched[1]),
    documentName: decodeURIComponent(matched[2]),
  };
}

function parseTaskRunLogRoute(pathname) {
  const matched = pathname.match(/^\/api\/tasks\/([^/]+)\/runs\/([^/]+)\/logs\/([^/]+)$/);
  if (!matched) {
    return null;
  }

  return {
    taskId: decodeURIComponent(matched[1]),
    runId: decodeURIComponent(matched[2]),
    stream: decodeURIComponent(matched[3]),
  };
}

function parseTaskDoneRoute(pathname) {
  const matched = pathname.match(/^\/api\/tasks\/([^/]+)\/done$/);
  if (!matched) {
    return null;
  }

  return {
    taskId: decodeURIComponent(matched[1]),
  };
}

function parseTaskVerificationAnchorRefreshRoute(pathname) {
  const matched = pathname.match(/^\/api\/tasks\/([^/]+)\/verification\/anchors\/refresh$/);
  if (!matched) {
    return null;
  }

  return {
    taskId: decodeURIComponent(matched[1]),
  };
}

function parseTaskExecuteRoute(pathname) {
  const matched = pathname.match(/^\/api\/tasks\/([^/]+)\/execute$/);
  if (!matched) {
    return null;
  }

  return {
    taskId: decodeURIComponent(matched[1]),
  };
}

function parseTaskExecutionRoute(pathname) {
  const matched = pathname.match(/^\/api\/tasks\/([^/]+)\/execution$/);
  if (!matched) {
    return null;
  }

  return {
    taskId: decodeURIComponent(matched[1]),
  };
}

function parseTaskExecutionLogRoute(pathname) {
  const matched = pathname.match(/^\/api\/tasks\/([^/]+)\/execution\/logs\/([^/]+)$/);
  if (!matched) {
    return null;
  }

  return {
    taskId: decodeURIComponent(matched[1]),
    stream: decodeURIComponent(matched[2]),
  };
}

function parseTaskExecutionCancelRoute(pathname) {
  const matched = pathname.match(/^\/api\/tasks\/([^/]+)\/execution\/cancel$/);
  if (!matched) {
    return null;
  }

  return {
    taskId: decodeURIComponent(matched[1]),
  };
}

module.exports = {
  main,
  parseArgs,
  startDashboardServer,
};

if (require.main === module) {
  main();
}

