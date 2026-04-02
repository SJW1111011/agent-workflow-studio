const fs = require("fs");
const path = require("path");
const { fileExists, readText } = require("./fs-utils");
const { listAdapters } = require("./adapters");
const { listRecipes } = require("./recipes");
const { validateWorkspace } = require("./schema-validator");
const { listRuns, listTasks } = require("./task-service");
const {
  ensureWorkflowScaffold,
  memoryRoot,
  projectConfigPath,
  projectProfilePath,
  readProjectConfig,
  taskFiles,
  workflowRoot,
} = require("./workspace");

const MEMORY_PLACEHOLDERS = [
  "What user problem are we solving?",
  "Core modules:",
  "Rules that must stay true",
  "what must be tested?",
];

function buildOverview(workspaceRoot) {
  const workflowDir = workflowRoot(workspaceRoot);
  const initialized = fileExists(projectConfigPath(workspaceRoot));

  if (!fileExists(workflowDir)) {
    return {
      initialized: false,
      workspaceRoot,
      project: null,
      stats: emptyStats(),
      tasks: [],
      runs: [],
      memory: [],
      risks: [
        {
          level: "high",
          message: "Workflow is not initialized yet.",
        },
      ],
      verification: [],
    };
  }

  ensureWorkflowScaffold(workspaceRoot);

  const project = readProjectConfig(workspaceRoot);
  const adapters = listAdapters(workspaceRoot);
  const recipes = listRecipes(workspaceRoot);
  const tasks = listTasks(workspaceRoot).map((task) => enrichTask(workspaceRoot, task));
  const runs = tasks.flatMap((task) => listRuns(workspaceRoot, task.id));
  const memory = loadMemory(workspaceRoot);
  const validation = validateWorkspace(workspaceRoot);
  const risks = deriveOverviewRisks(workspaceRoot, tasks, memory, validation);
  const verification = deriveVerification(tasks);

  return {
    initialized,
    workspaceRoot,
    project,
    adapters,
    recipes,
    validation,
    stats: {
      tasks: tasks.length,
      runs: runs.length,
      risks: risks.length,
      memoryDocs: memory.length,
    },
    tasks,
    runs: runs.sort((left, right) => right.createdAt.localeCompare(left.createdAt)),
    memory,
    risks,
    verification,
  };
}

function emptyStats() {
  return {
    tasks: 0,
    runs: 0,
    risks: 0,
    memoryDocs: 0,
  };
}

function enrichTask(workspaceRoot, task) {
  const files = taskFiles(workspaceRoot, task.id);
  const runs = listRuns(workspaceRoot, task.id);
  const latestRun = runs[runs.length - 1] || null;

  return {
    ...task,
    hasCodexPrompt: fileExists(files.promptCodex),
    hasClaudePrompt: fileExists(files.promptClaude),
    latestRunStatus: latestRun ? latestRun.status : "none",
    latestRunSummary: latestRun ? latestRun.summary : "No runs yet",
  };
}

function loadMemory(workspaceRoot) {
  const root = memoryRoot(workspaceRoot);
  if (!fs.existsSync(root)) {
    return [];
  }

  return fs
    .readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .map((entry) => {
      const absolutePath = path.join(root, entry.name);
      const content = readText(absolutePath, "");
      const placeholder = MEMORY_PLACEHOLDERS.some((marker) => content.includes(marker));
      return {
        name: entry.name,
        relativePath: path.join(".agent-workflow", "memory", entry.name).replace(/\\/g, "/"),
        placeholder,
        size: content.length,
      };
    })
    .sort((left, right) => left.name.localeCompare(right.name));
}

function deriveOverviewRisks(workspaceRoot, tasks, memory, validation) {
  const risks = [];

  if (!fileExists(projectProfilePath(workspaceRoot))) {
    risks.push({
      level: "high",
      message: "Project profile missing. Run scan before assigning major tasks.",
    });
  }

  memory
    .filter((item) => item.placeholder)
    .forEach((item) => {
      risks.push({
        level: "medium",
        message: `Memory doc still looks like a placeholder: ${item.relativePath}`,
      });
    });

  tasks.forEach((task) => {
    if (!task.hasCodexPrompt && !task.hasClaudePrompt) {
      risks.push({
        level: "high",
        message: `${task.id} has no compiled prompt yet.`,
      });
    }

    if (task.runCount === 0) {
      risks.push({
        level: "high",
        message: `${task.id} has no execution evidence yet.`,
      });
    }

    if (task.latestRunStatus === "failed") {
      risks.push({
        level: "high",
        message: `${task.id} has a failed latest run.`,
      });
    }
  });

  listAdapters(workspaceRoot)
    .filter((adapter) => !adapter.exists || !adapter.config)
    .forEach((adapter) => {
      risks.push({
        level: "medium",
        message: `Adapter config missing: ${adapter.adapterId}`,
      });
    });

  (validation && validation.issues ? validation.issues : []).forEach((validationIssue) => {
    risks.push({
      level: validationIssue.level === "error" ? "high" : "medium",
      message: `${validationIssue.message} (${validationIssue.target})`,
    });
  });

  return risks;
}

function deriveVerification(tasks) {
  return tasks.map((task) => ({
    taskId: task.id,
    status:
      task.latestRunStatus === "passed"
        ? "evidence-recorded"
        : task.latestRunStatus === "failed"
          ? "failed"
          : "pending",
    summary: task.latestRunSummary,
  }));
}

module.exports = {
  buildOverview,
};

