const { fileExists, readText } = require("./fs-utils");
const { listAdapters } = require("./adapters");
const { buildTaskFreshness, loadMemoryFreshness } = require("./freshness");
const { listRecipes } = require("./recipes");
const { validateWorkspace } = require("./schema-validator");
const { listRuns, listTasks } = require("./task-service");
const { buildTaskVerificationGate, loadRepositoryDiff } = require("./verification-gates");
const {
  ensureWorkflowScaffold,
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
  const repositoryDiff = loadRepositoryDiff(workspaceRoot);
  const tasks = listTasks(workspaceRoot).map((task) => enrichTask(workspaceRoot, task, repositoryDiff));
  const runs = tasks.flatMap((task) => listRuns(workspaceRoot, task.id));
  const memory = loadMemoryFreshness(workspaceRoot, MEMORY_PLACEHOLDERS);
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
    stats: buildOverviewStats(tasks, runs, risks, memory),
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
    executorOutcomes: emptyExecutorOutcomes(),
  };
}

function buildOverviewStats(tasks, runs, risks, memory) {
  return {
    tasks: tasks.length,
    runs: runs.length,
    risks: risks.length,
    memoryDocs: memory.length,
    executorOutcomes: countLatestExecutorOutcomes(tasks),
  };
}

function emptyExecutorOutcomes() {
  return {
    passed: 0,
    failed: 0,
    timedOut: 0,
    interrupted: 0,
    cancelled: 0,
    none: 0,
  };
}

function countLatestExecutorOutcomes(tasks) {
  return (Array.isArray(tasks) ? tasks : []).reduce((counts, task) => {
    const outcome = String((task && task.latestExecutorOutcome) || "").trim().toLowerCase();

    if (outcome === "passed") {
      counts.passed += 1;
      return counts;
    }

    if (outcome === "timed-out") {
      counts.timedOut += 1;
      return counts;
    }

    if (outcome === "interrupted") {
      counts.interrupted += 1;
      return counts;
    }

    if (outcome === "cancelled") {
      counts.cancelled += 1;
      return counts;
    }

    if (outcome === "failed") {
      counts.failed += 1;
      return counts;
    }

    counts.none += 1;
    return counts;
  }, emptyExecutorOutcomes());
}

function enrichTask(workspaceRoot, task, repositoryDiff) {
  const files = taskFiles(workspaceRoot, task.id);
  const runs = listRuns(workspaceRoot, task.id);
  const latestRun = runs[runs.length - 1] || null;
  const latestExecutorRun = [...runs].reverse().find((run) => run && run.source === "executor") || null;
  const taskText = readText(files.task, "");
  const freshness = buildTaskFreshness(workspaceRoot, task, runs);
  const verificationGate = buildTaskVerificationGate(workspaceRoot, task, runs, repositoryDiff, taskText);

  return {
    ...task,
    hasCodexPrompt: fileExists(files.promptCodex),
    hasClaudePrompt: fileExists(files.promptClaude),
    latestRunStatus: latestRun ? latestRun.status : "none",
    latestRunSummary: latestRun ? latestRun.summary : "No runs yet",
    latestExecutorOutcome: latestExecutorRun ? deriveExecutorOutcome(latestExecutorRun) : null,
    latestExecutorSummary: latestExecutorRun ? latestExecutorRun.summary || null : null,
    latestExecutorAt: latestExecutorRun ? latestExecutorRun.createdAt || null : null,
    freshnessStatus: freshness.summary.status,
    staleDocCount: freshness.summary.staleCount,
    verificationGate,
    verificationGateStatus: verificationGate.summary.status,
    relevantChangeCount: verificationGate.summary.relevantChangeCount,
    ambiguousScopeCount: verificationGate.scopeCoverage ? verificationGate.scopeCoverage.ambiguousCount : 0,
  };
}

function deriveExecutorOutcome(run) {
  if (!run || typeof run !== "object") {
    return "failed";
  }

  if (run.interrupted && String(run.interruptionSignal || "").trim().toLowerCase() === "dashboard-cancel") {
    return "cancelled";
  }

  if (run.timedOut) {
    return "timed-out";
  }

  if (run.interrupted) {
    return "interrupted";
  }

  return run.status === "passed" ? "passed" : "failed";
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

  memory
    .filter((item) => item.freshnessStatus === "stale")
    .forEach((item) => {
      risks.push({
        level: "medium",
        message: `Memory doc may be stale: ${item.relativePath}`,
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

    if (task.freshnessStatus === "stale") {
      risks.push({
        level: "medium",
        message: `${task.id} has stale task docs that may need refresh.`,
      });
    }

    if (task.verificationGateStatus === "needs-proof") {
      risks.push({
        level: "high",
        message: `${task.id} has scoped local changes that are newer than the latest verification evidence.`,
      });
    }

    if (task.verificationGateStatus === "partially-covered") {
      risks.push({
        level: "high",
        message: `${task.id} has only partial explicit proof for its scoped local changes.`,
      });
    }

    if (task.verificationGateStatus === "scope-missing") {
      risks.push({
        level: "medium",
        message: `${task.id} has active local changes but no repo-relative scope hints for diff-aware verification.`,
      });
    }

    if (task.ambiguousScopeCount > 0) {
      risks.push({
        level: "medium",
        message: `${task.id} still has ambiguous scope entries that weaken diff-aware verification.`,
      });
    }

    if (task.verificationGate && task.verificationGate.proofCoverage && task.verificationGate.proofCoverage.weakProofCount > 0) {
      risks.push({
        level: "medium",
        message: `${task.id} has weak proof items that do not yet satisfy explicit scoped coverage.`,
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
      task.latestRunStatus === "failed"
        ? "failed"
        : task.verificationGateStatus === "needs-proof"
          ? "needs-proof"
          : task.verificationGateStatus === "partially-covered"
            ? "partially-covered"
          : task.verificationGateStatus === "scope-missing"
            ? "scope-missing"
            : task.verificationGateStatus === "covered"
              ? "covered"
              : task.latestRunStatus === "passed"
                ? "evidence-recorded"
                : "pending",
    summary:
      task.verificationGate && task.verificationGate.summary && task.verificationGate.summary.message
        ? task.verificationGate.summary.message
        : task.latestRunSummary,
    relevantChangeCount: task.relevantChangeCount || 0,
  }));
}

module.exports = {
  buildOverview,
};

