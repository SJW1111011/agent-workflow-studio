const path = require("path");
const { fileExists, readText } = require("./fs-utils");
const { badRequest, notFound } = require("./http-errors");
const { buildOverview } = require("./overview");
const { getTaskDetail } = require("./task-service");
const { memoryRoot } = require("./workspace");

const RESOURCE_DEFINITIONS = Object.freeze([
  {
    uri: "workflow://overview",
    name: "Workflow overview",
    description: "Full workspace overview JSON, including tasks, runs, risks, and verification state.",
    mimeType: "application/json",
  },
  {
    uri: "workflow://tasks",
    name: "Workflow tasks",
    description: "Task list with status, coverage, and verification signal summaries.",
    mimeType: "application/json",
  },
]);

const RESOURCE_TEMPLATE_DEFINITIONS = Object.freeze([
  {
    uriTemplate: "workflow://tasks/{taskId}",
    name: "Workflow task detail",
    description: "Task detail JSON with task, context, verification, checkpoint, runs, handoff records, and verification gate state.",
    mimeType: "application/json",
  },
  {
    uriTemplate: "workflow://memory/{docName}",
    name: "Workflow memory document",
    description: "Workflow memory markdown for product, architecture, domain rules, or runbook context.",
    mimeType: "text/markdown",
  },
]);

const MEMORY_DOCUMENTS = Object.freeze({
  product: "product.md",
  architecture: "architecture.md",
  "domain-rules": "domain-rules.md",
  runbook: "runbook.md",
});

function createResourceHandlers(workspaceRoot) {
  return {
    workspaceRoot,
    listResources() {
      return cloneJson(RESOURCE_DEFINITIONS);
    },
    listResourceTemplates() {
      return cloneJson(RESOURCE_TEMPLATE_DEFINITIONS);
    },
    readResource(uri) {
      return readWorkflowResource(workspaceRoot, uri);
    },
  };
}

function readWorkflowResource(workspaceRoot, uri) {
  const parsed = parseWorkflowUri(uri);

  if (parsed.host === "overview" && parsed.segments.length === 0) {
    return buildJsonResource(uri, buildOverview(workspaceRoot));
  }

  if (parsed.host === "tasks" && parsed.segments.length === 0) {
    return buildJsonResource(uri, buildTaskListPayload(workspaceRoot));
  }

  if (parsed.host === "tasks" && parsed.segments.length === 1) {
    return buildJsonResource(uri, buildTaskResourcePayload(workspaceRoot, parsed.segments[0]));
  }

  if (parsed.host === "memory" && parsed.segments.length === 1) {
    return buildTextResource(uri, "text/markdown", readMemoryDocument(workspaceRoot, parsed.segments[0]));
  }

  throw notFound(`Unknown workflow resource: ${uri}`, "mcp_resource_not_found");
}

function buildTaskListPayload(workspaceRoot) {
  const overview = buildOverview(workspaceRoot);

  return {
    count: overview.tasks.length,
    tasks: overview.tasks.map((task) => ({
      id: task.id,
      title: task.title,
      priority: task.priority,
      status: task.status,
      claimedBy: task.claimedBy || null,
      recipeId: task.recipeId || "feature",
      reviewStatus: task.reviewStatus || null,
      reviewedAt: task.reviewedAt || null,
      correctionTaskId: task.correctionTaskId || null,
      runCount: task.runCount,
      latestRunStatus: task.latestRunStatus,
      latestRunSummary: task.latestRunSummary,
      coveragePercent: task.coveragePercent,
      verificationGateStatus: task.verificationGateStatus,
      verificationSignalStatus: task.verificationSignalStatus,
      verificationSignalSummary: task.verificationSignalSummary,
      updatedAt: task.updatedAt || null,
    })),
  };
}

function buildTaskResourcePayload(workspaceRoot, taskId) {
  const detail = getTaskDetail(workspaceRoot, taskId);
  if (!detail) {
    throw notFound(`Task ${taskId} does not exist yet.`, "task_not_found");
  }

  const overview = buildOverview(workspaceRoot);
  const overviewTask = overview.tasks.find((task) => task.id === taskId) || null;
  const latestRun = detail.runs[detail.runs.length - 1] || null;
  const verificationGate = overviewTask && overviewTask.verificationGate ? overviewTask.verificationGate : detail.verificationGate;

  return {
    task: detail.meta,
    claimedBy: detail.meta.claimedBy || null,
    recipe: detail.recipe,
    taskText: detail.taskText,
    contextText: detail.contextText,
    verificationText: detail.verificationText,
    checkpointText: detail.checkpointText,
    runs: detail.runs,
    handoffRecords: detail.handoffRecords,
    runCount: detail.runs.length,
    latestRun,
    latestRunSummary: latestRun
      ? {
          id: latestRun.id,
          status: latestRun.status,
          summary: latestRun.summary,
          createdAt: latestRun.createdAt || null,
          completedAt: latestRun.completedAt || null,
          agent: latestRun.agent || null,
          source: latestRun.source || null,
        }
      : null,
    freshness: detail.freshness,
    verificationGate,
    coveragePercent: overviewTask ? overviewTask.coveragePercent : verificationGate.coveragePercent || 0,
    verificationGateStatus:
      (overviewTask && overviewTask.verificationGateStatus) ||
      (verificationGate && verificationGate.summary ? verificationGate.summary.status : null),
    verificationSignalStatus: overviewTask ? overviewTask.verificationSignalStatus : null,
    verificationSignalSummary: overviewTask ? overviewTask.verificationSignalSummary : null,
    reviewStatus: detail.meta.reviewStatus || null,
    reviewedAt: detail.meta.reviewedAt || null,
    rejectionFeedback: detail.meta.rejectionFeedback || null,
    correctionTaskId: detail.meta.correctionTaskId || null,
    generatedFiles: detail.generatedFiles,
  };
}

function readMemoryDocument(workspaceRoot, docName) {
  const normalizedName = normalizeMemoryDocName(docName);
  const fileName = MEMORY_DOCUMENTS[normalizedName];

  if (!fileName) {
    throw notFound(`Unknown workflow memory document: ${docName}`, "mcp_memory_doc_not_found");
  }

  const filePath = path.join(memoryRoot(workspaceRoot), fileName);
  if (!fileExists(filePath)) {
    throw notFound(`Workflow memory document is missing: ${fileName}`, "mcp_memory_doc_missing");
  }

  return readText(filePath, "");
}

function normalizeMemoryDocName(value) {
  const trimmed = String(value || "").trim().toLowerCase();
  if (!trimmed) {
    return "";
  }

  return trimmed.endsWith(".md") ? trimmed.slice(0, -3) : trimmed;
}

function parseWorkflowUri(uri) {
  const value = String(uri || "").trim();
  if (!value) {
    throw badRequest("Resource URI must be a non-empty string.", "mcp_resource_uri_required");
  }

  let parsed;
  try {
    parsed = new URL(value);
  } catch (error) {
    throw badRequest(`Invalid workflow resource URI: ${value}`, "mcp_resource_uri_invalid");
  }

  if (parsed.protocol !== "workflow:") {
    throw badRequest(`Unsupported workflow resource URI: ${value}`, "mcp_resource_uri_invalid");
  }

  return {
    host: parsed.host,
    segments: parsed.pathname
      .split("/")
      .map((segment) => segment.trim())
      .filter(Boolean)
      .map((segment) => decodeURIComponent(segment)),
  };
}

function buildJsonResource(uri, payload) {
  return buildTextResource(uri, "application/json", `${JSON.stringify(payload, null, 2)}\n`);
}

function buildTextResource(uri, mimeType, text) {
  return {
    contents: [
      {
        uri,
        mimeType,
        text,
      },
    ],
  };
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  createResourceHandlers,
};
