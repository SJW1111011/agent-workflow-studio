const { badRequest, notFound } = require("./http-errors");
const { createResourceHandlers } = require("./mcp-resources");

const PROMPT_DEFINITIONS = Object.freeze([
  {
    name: "workflow-resume",
    description: "Return full task context for resuming work without compiled prompt-file truncation.",
    arguments: [
      {
        name: "taskId",
        description: "Task id such as T-001.",
        required: true,
      },
    ],
  },
  {
    name: "workflow-verify",
    description: "Return verification context, evidence coverage, and missing scoped proof for a task.",
    arguments: [
      {
        name: "taskId",
        description: "Task id such as T-001.",
        required: true,
      },
    ],
  },
  {
    name: "workflow-handoff",
    description: "Return cross-agent handoff context with checkpoint and evidence state.",
    arguments: [
      {
        name: "taskId",
        description: "Task id such as T-001.",
        required: true,
      },
    ],
  },
]);

function createPromptHandlers(workspaceRoot) {
  const resourceHandlers = createResourceHandlers(workspaceRoot);

  return {
    workspaceRoot,
    listPrompts() {
      return cloneJson(PROMPT_DEFINITIONS);
    },
    getPrompt(name, args) {
      return getWorkflowPrompt(resourceHandlers, name, args);
    },
  };
}

function getWorkflowPrompt(resourceHandlers, name, args) {
  const promptName = String(name || "").trim();
  const promptArgs = normalizePromptArguments(args);
  const taskId = requireTaskId(promptArgs, promptName || "workflow prompt");
  const taskResource = getTextResource(resourceHandlers, `workflow://tasks/${encodeURIComponent(taskId)}`);
  const taskPayload = parseTaskResource(taskResource, taskId);

  switch (promptName) {
    case "workflow-resume":
      return buildResumePrompt(resourceHandlers, taskId, taskPayload, taskResource);
    case "workflow-verify":
      return buildVerifyPrompt(taskId, taskPayload, taskResource);
    case "workflow-handoff":
      return buildHandoffPrompt(taskId, taskPayload, taskResource);
    default:
      throw notFound(`Unknown workflow prompt: ${promptName}`, "mcp_prompt_not_found");
  }
}

function buildResumePrompt(resourceHandlers, taskId, taskPayload, taskResource) {
  const productResource = getTextResource(resourceHandlers, "workflow://memory/product");
  const architectureResource = getTextResource(resourceHandlers, "workflow://memory/architecture");
  const domainRulesResource = getTextResource(resourceHandlers, "workflow://memory/domain-rules");
  const gate = getVerificationGate(taskPayload);
  const scopeCoverage = gate.scopeCoverage || {};

  return {
    description: `Resume task ${taskId} with full task, checkpoint, and workflow memory context.`,
    messages: [
      buildTextMessage(`Resume workflow task ${taskId}.

Current task status: ${taskPayload.task.status}
Latest run: ${describeLatestRun(taskPayload.latestRunSummary)}
Verification gate: ${describeGate(gate)}
Evidence coverage: ${describeCoverage(taskPayload.coveragePercent, scopeCoverage)}

Use the embedded task resource as the source of truth for task.md, context.md, verification.md, checkpoint.md, and recorded runs. Product, architecture, and domain-rules memory documents are embedded as additional read-only context.`),
      buildResourceMessage(taskResource),
      buildResourceMessage(productResource),
      buildResourceMessage(architectureResource),
      buildResourceMessage(domainRulesResource),
    ],
  };
}

function buildVerifyPrompt(taskId, taskPayload, taskResource) {
  const gate = getVerificationGate(taskPayload);
  const proofCoverage = gate.proofCoverage || {};
  const missingFiles = listPaths(gate.relevantChangedFiles);

  return {
    description: `Verify task ${taskId} using its recorded verification doc, gate state, and scoped evidence coverage.`,
    messages: [
      buildTextMessage(`Verify workflow task ${taskId}.

Coverage: ${describeCoverage(taskPayload.coveragePercent, gate.scopeCoverage || {})}
Verification gate: ${describeGate(gate)}
Verified evidence items: ${normalizeCount(proofCoverage.verifiedEvidenceCount)}
Draft evidence items: ${normalizeCount(proofCoverage.draftEvidenceCount)}
Missing scoped files: ${missingFiles.length > 0 ? missingFiles.join(", ") : "none"}

Use the embedded task resource for the full verification.md contents, checkpoint state, proof coverage details, and recorded runs.`),
      buildResourceMessage(taskResource),
    ],
  };
}

function buildHandoffPrompt(taskId, taskPayload, taskResource) {
  const gate = getVerificationGate(taskPayload);
  const missingFiles = listPaths(gate.relevantChangedFiles);
  const checkpointState = taskPayload.checkpointText && taskPayload.checkpointText.trim() ? "present" : "missing";

  return {
    description: `Hand off task ${taskId} with current checkpoint, evidence status, and remaining work.`,
    messages: [
      buildTextMessage(`Hand off workflow task ${taskId}.

What was done: ${describeCompletedWork(taskPayload)}
What is left: ${describeRemainingWork(taskPayload, missingFiles)}
Evidence status: ${describeGate(gate)}
Checkpoint state: ${checkpointState}
Task status: ${taskPayload.task.status}

Use the embedded task resource for full task, context, verification, checkpoint, and run details before continuing.`),
      buildResourceMessage(taskResource),
    ],
  };
}

function normalizePromptArguments(args) {
  if (args === undefined || args === null) {
    return {};
  }

  if (Array.isArray(args) || typeof args !== "object") {
    throw badRequest("Prompt arguments must be an object.", "mcp_prompt_arguments_invalid");
  }

  return args;
}

function requireTaskId(args, promptName) {
  const taskId = String(args.taskId || "").trim();
  if (!taskId) {
    throw badRequest(`${promptName} requires a non-empty "taskId" string.`, "mcp_prompt_task_required");
  }
  return taskId;
}

function getTextResource(resourceHandlers, uri) {
  const result = resourceHandlers.readResource(uri);
  const content = result && Array.isArray(result.contents) ? result.contents[0] : null;

  if (!content || typeof content.text !== "string") {
    throw notFound(`Workflow resource is unavailable: ${uri}`, "mcp_resource_not_found");
  }

  return cloneJson(content);
}

function parseTaskResource(resource, taskId) {
  try {
    return JSON.parse(resource.text);
  } catch (error) {
    throw badRequest(`Task resource for ${taskId} is not valid JSON.`, "mcp_task_resource_invalid");
  }
}

function getVerificationGate(taskPayload) {
  return taskPayload && taskPayload.verificationGate ? taskPayload.verificationGate : {};
}

function describeLatestRun(latestRunSummary) {
  if (!latestRunSummary) {
    return "none recorded";
  }

  const summary = String(latestRunSummary.summary || "").trim();
  return summary ? `${latestRunSummary.status}: ${summary}` : latestRunSummary.status || "recorded";
}

function describeGate(gate) {
  const status = gate && gate.summary && gate.summary.status ? gate.summary.status : "unknown";
  const message = gate && gate.summary && gate.summary.message ? gate.summary.message : "No verification summary available.";
  return `${status} - ${message}`;
}

function describeCoverage(coveragePercent, scopeCoverage) {
  const scopedFileCount = normalizeCount(scopeCoverage && scopeCoverage.scopedFileCount);
  const coveredFileCount = normalizeCount(scopeCoverage && scopeCoverage.coveredFileCount);

  if (scopedFileCount === 0) {
    return `${normalizeCount(coveragePercent)}% (no scoped files matched)`;
  }

  return `${normalizeCount(coveragePercent)}% (${coveredFileCount}/${scopedFileCount} scoped files)`;
}

function describeCompletedWork(taskPayload) {
  if (taskPayload.latestRunSummary && taskPayload.latestRunSummary.summary) {
    return taskPayload.latestRunSummary.summary;
  }

  if (taskPayload.runCount > 0) {
    return `${taskPayload.runCount} run(s) recorded without a summary.`;
  }

  return "No execution evidence recorded yet.";
}

function describeRemainingWork(taskPayload, missingFiles) {
  if (missingFiles.length > 0) {
    return `Add or refresh verified evidence for ${missingFiles.join(", ")}.`;
  }

  if (taskPayload.task && taskPayload.task.status !== "done") {
    return `Continue the task until it is ready to move beyond ${taskPayload.task.status}.`;
  }

  return "No remaining scoped verification gaps are currently reported.";
}

function listPaths(items) {
  return (Array.isArray(items) ? items : [])
    .map((item) => (item && item.path ? item.path : ""))
    .filter(Boolean);
}

function buildTextMessage(text) {
  return {
    role: "user",
    content: {
      type: "text",
      text,
    },
  };
}

function buildResourceMessage(resource) {
  return {
    role: "user",
    content: {
      type: "resource",
      resource: cloneJson(resource),
    },
  };
}

function normalizeCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }

  return Math.round(numeric);
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

module.exports = {
  createPromptHandlers,
};
