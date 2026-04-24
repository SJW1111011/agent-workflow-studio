const { fileExists, readText } = require("./fs-utils");
const {
  normalizeProofCoverageSummary,
  normalizeVerificationGateStatus,
  normalizeVerificationSignalStatus,
} = require("./evidence-utils");
const { listAdapters } = require("./adapters");
const { buildTaskFreshness, loadMemoryFreshness } = require("./freshness");
const { hasMemoryPlaceholder } = require("./memory-placeholders");
const { listRecipes } = require("./recipes");
const { loadRepositorySnapshot } = require("./repository-snapshot");
const { validateWorkspace } = require("./schema-validator");
const { listRuns, listTasks } = require("./task-service");
const { buildTaskVerificationGate, normalizeTaskVerificationGate } = require("./verification-gates");
const {
  ensureWorkflowScaffold,
  projectConfigPath,
  projectProfilePath,
  readProjectConfig,
  resolveStrictVerification,
  taskFiles,
  workflowRoot,
} = require("./workspace");

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
  const strictVerification = resolveStrictVerification(workspaceRoot);
  const adapters = listAdapters(workspaceRoot);
  const recipes = listRecipes(workspaceRoot);
  const repositorySnapshot = loadRepositorySnapshot(workspaceRoot, {
    strict: strictVerification,
  });
  const tasks = listTasks(workspaceRoot).map((task) =>
    enrichTask(workspaceRoot, task, repositorySnapshot, {
      strict: strictVerification,
    })
  );
  const runs = tasks.flatMap((task) => listRuns(workspaceRoot, task.id));
  const memory = loadMemoryFreshness(workspaceRoot, hasMemoryPlaceholder);
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
    coveragePercent: 0,
    coveredScopedFiles: 0,
    totalScopedFiles: 0,
    executorOutcomes: emptyExecutorOutcomes(),
    humanReviews: emptyHumanReviews(),
    verificationSignals: emptyVerificationSignals(),
  };
}

function buildOverviewStats(tasks, runs, risks, memory) {
  const coverage = summarizeTaskCoverage(tasks);
  return {
    tasks: tasks.length,
    runs: runs.length,
    risks: risks.length,
    memoryDocs: memory.length,
    coveragePercent: coverage.coveragePercent,
    coveredScopedFiles: coverage.coveredScopedFiles,
    totalScopedFiles: coverage.totalScopedFiles,
    executorOutcomes: countLatestExecutorOutcomes(tasks),
    humanReviews: countHumanReviews(tasks),
    verificationSignals: countTaskVerificationSignals(tasks),
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

function emptyVerificationSignals() {
  return {
    verified: 0,
    partial: 0,
    draft: 0,
    none: 0,
    strong: 0,
    mixed: 0,
    planned: 0,
  };
}

function emptyHumanReviews() {
  return {
    approved: 0,
    rejected: 0,
    pending: 0,
  };
}

function countHumanReviews(tasks) {
  return (Array.isArray(tasks) ? tasks : []).reduce((counts, task) => {
    const reviewStatus = String((task && task.reviewStatus) || "").trim().toLowerCase();

    if (reviewStatus === "approved") {
      counts.approved += 1;
      return counts;
    }

    if (reviewStatus === "rejected") {
      counts.rejected += 1;
      return counts;
    }

    if (task && task.status === "done") {
      counts.pending += 1;
    }

    return counts;
  }, emptyHumanReviews());
}

function countTaskVerificationSignals(tasks) {
  return (Array.isArray(tasks) ? tasks : []).reduce((counts, task) => {
    const rawStatus = String((task && task.verificationSignalStatus) || "").trim().toLowerCase();
    const status = normalizeVerificationSignalStatus(rawStatus);

    if (status === "verified") {
      counts.verified += 1;
      counts.strong += 1;
      return counts;
    }

    if (status === "partial") {
      counts.partial += 1;
      counts.mixed += 1;
      return counts;
    }

    if (status === "draft") {
      counts.draft += 1;
      if (rawStatus === "planned") {
        counts.planned += 1;
      }
      return counts;
    }

    counts.none += 1;
    return counts;
  }, emptyVerificationSignals());
}

function enrichTask(workspaceRoot, task, repositorySnapshot, options = {}) {
  const files = taskFiles(workspaceRoot, task.id);
  const runs = listRuns(workspaceRoot, task.id);
  const latestRun = runs[runs.length - 1] || null;
  const latestExecutorRun = [...runs].reverse().find((run) => run && run.source === "executor") || null;
  const taskText = readText(files.task, "");
  const verificationText = readText(files.verification, "");
  const freshness = buildTaskFreshness(workspaceRoot, task, runs);
  const verificationGate = normalizeTaskVerificationGate(
    buildTaskVerificationGate(workspaceRoot, task, runs, repositorySnapshot, taskText, {
      strict: options.strict,
    })
  );
  const scopeCoverage = verificationGate.scopeCoverage || {};
  const scopeHintCount = normalizeNonNegativeInteger(
    scopeCoverage.hintCount !== undefined
      ? scopeCoverage.hintCount
      : Array.isArray(verificationGate.scopeHints)
        ? verificationGate.scopeHints.length
        : 0
  );
  const scopedFileCount = normalizeNonNegativeInteger(
    scopeCoverage.scopedFileCount !== undefined
      ? scopeCoverage.scopedFileCount
      : verificationGate.repository && verificationGate.repository.scopedFileCount !== undefined
        ? verificationGate.repository.scopedFileCount
        : 0
  );
  const coveredScopedFileCount = normalizeNonNegativeInteger(
    scopeCoverage.coveredFileCount !== undefined
      ? scopeCoverage.coveredFileCount
      : Array.isArray(verificationGate.coveredScopedFiles)
        ? verificationGate.coveredScopedFiles.length
        : 0
  );
  const verificationSignal = describeTaskVerificationSignal(verificationGate, verificationText);

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
    coveragePercent: normalizeCoveragePercent(verificationGate.coveragePercent),
    verificationGateStatus: normalizeVerificationGateStatus(verificationGate.summary.status) || verificationGate.summary.status,
    relevantChangeCount: verificationGate.summary.relevantChangeCount,
    scopeHintCount,
    scopedFileCount,
    coveredScopedFileCount,
    ambiguousScopeCount: normalizeNonNegativeInteger(scopeCoverage.ambiguousCount),
    verificationSignalStatus:
      normalizeVerificationSignalStatus(verificationSignal.status) || verificationSignal.status,
    verificationSignalSummary: verificationSignal.summary,
    draftCheckCount: verificationSignal.draftCheckCount,
    plannedVerificationCheckCount: verificationSignal.draftCheckCount,
    draftProofCount: verificationSignal.draftProofCount,
    verifiedProofCount: verificationSignal.verifiedProofCount,
    strongProofCount: verificationSignal.strongProofCount,
    currentVerifiedEvidenceCount: verificationSignal.currentVerifiedEvidenceCount,
    anchorBackedStrongProofCount: verificationSignal.anchorBackedStrongProofCount,
    recordedVerifiedEvidenceCount: verificationSignal.recordedVerifiedEvidenceCount,
    compatibilityStrongProofCount: verificationSignal.compatibilityStrongProofCount,
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

function describeTaskVerificationSignal(verificationGate, verificationText) {
  const normalizedVerificationGate = normalizeTaskVerificationGate(verificationGate);
  const proofCoverage = normalizeProofCoverageSummary(
    normalizedVerificationGate && normalizedVerificationGate.proofCoverage
      ? normalizedVerificationGate.proofCoverage
      : {}
  );
  const items = Array.isArray(proofCoverage.items) ? proofCoverage.items : [];
  const verifiedProofCount = items.filter((item) => item && (item.verified || item.strong)).length;
  const draftProofCount = items.filter((item) => item && !(item.verified || item.strong)).length;
  const draftCheckCount = extractVerificationDraftChecks(verificationText).length;
  const currentVerifiedEvidenceCount = Number(
    proofCoverage.currentVerifiedEvidenceCount || proofCoverage.anchoredStrongProofCount || 0
  );
  const recordedVerifiedEvidenceCount = Number(
    proofCoverage.recordedVerifiedEvidenceCount || proofCoverage.compatibilityStrongProofCount || 0
  );
  const remainingDraftItemCount = draftProofCount + draftCheckCount;

  if (verifiedProofCount > 0 && remainingDraftItemCount > 0) {
    return {
      status: "partial",
      summary: describeVerifiedEvidenceFreshnessSummary({
        verifiedProofCount,
        draftProofCount,
        draftCheckCount,
        currentVerifiedEvidenceCount,
        recordedVerifiedEvidenceCount,
        fallback: `${verifiedProofCount} verified item(s); ${buildDraftSummaryFragment(draftProofCount, draftCheckCount)} remain.`,
        suffix: ` ${buildDraftSummaryFragment(draftProofCount, draftCheckCount)} remain.`,
      }),
      draftCheckCount,
      verifiedProofCount,
      strongProofCount: verifiedProofCount,
      draftProofCount,
      plannedCheckCount: draftCheckCount,
      currentVerifiedEvidenceCount,
      anchorBackedStrongProofCount: currentVerifiedEvidenceCount,
      recordedVerifiedEvidenceCount,
      compatibilityStrongProofCount: recordedVerifiedEvidenceCount,
    };
  }

  if (remainingDraftItemCount > 0) {
    return {
      status: "draft",
      summary: describeDraftEvidenceSummary(draftProofCount, draftCheckCount),
      draftCheckCount,
      verifiedProofCount,
      strongProofCount: verifiedProofCount,
      draftProofCount,
      plannedCheckCount: draftCheckCount,
      currentVerifiedEvidenceCount,
      anchorBackedStrongProofCount: currentVerifiedEvidenceCount,
      recordedVerifiedEvidenceCount,
      compatibilityStrongProofCount: recordedVerifiedEvidenceCount,
    };
  }

  if (verifiedProofCount > 0) {
    return {
      status: "verified",
      summary: describeVerifiedEvidenceFreshnessSummary({
        verifiedProofCount,
        draftProofCount,
        draftCheckCount,
        currentVerifiedEvidenceCount,
        recordedVerifiedEvidenceCount,
        fallback: `${verifiedProofCount} verified item(s) recorded.`,
        suffix: "",
      }),
      draftCheckCount,
      verifiedProofCount,
      strongProofCount: verifiedProofCount,
      draftProofCount,
      plannedCheckCount: draftCheckCount,
      currentVerifiedEvidenceCount,
      anchorBackedStrongProofCount: currentVerifiedEvidenceCount,
      recordedVerifiedEvidenceCount,
      compatibilityStrongProofCount: recordedVerifiedEvidenceCount,
    };
  }

  return {
    status: "none",
    summary: "No draft checks or explicit evidence recorded.",
    draftCheckCount,
    verifiedProofCount,
    strongProofCount: verifiedProofCount,
    draftProofCount,
    plannedCheckCount: draftCheckCount,
    currentVerifiedEvidenceCount,
    anchorBackedStrongProofCount: currentVerifiedEvidenceCount,
    recordedVerifiedEvidenceCount,
    compatibilityStrongProofCount: recordedVerifiedEvidenceCount,
  };
}

function describeVerifiedEvidenceFreshnessSummary({
  verifiedProofCount,
  draftProofCount,
  draftCheckCount,
  currentVerifiedEvidenceCount,
  recordedVerifiedEvidenceCount,
  fallback,
  suffix = "",
}) {
  if (currentVerifiedEvidenceCount > 0 && recordedVerifiedEvidenceCount > 0) {
    return `${verifiedProofCount} verified item(s): ${currentVerifiedEvidenceCount} current, ${recordedVerifiedEvidenceCount} recorded-only.${suffix}`.trim();
  }

  if (currentVerifiedEvidenceCount > 0) {
    return `${verifiedProofCount} verified item(s), all current.${suffix}`.trim();
  }

  if (recordedVerifiedEvidenceCount > 0 && (draftProofCount >= 0 || draftCheckCount >= 0)) {
    return `${verifiedProofCount} verified item(s), recorded from earlier evidence.${suffix}`.trim();
  }

  return fallback;
}

function describeDraftEvidenceSummary(draftProofCount, draftCheckCount) {
  if (draftProofCount > 0 && draftCheckCount > 0) {
    return `${draftProofCount} draft evidence item(s) and ${draftCheckCount} draft check(s) still need verified detail.`;
  }

  if (draftProofCount > 0) {
    return `${draftProofCount} draft evidence item(s) still need checks or artifacts.`;
  }

  return `${draftCheckCount} draft check(s) recorded, but no verified evidence yet.`;
}

function buildDraftSummaryFragment(draftProofCount, draftCheckCount) {
  if (draftProofCount > 0 && draftCheckCount > 0) {
    return `${draftProofCount} draft evidence item(s) and ${draftCheckCount} draft check(s)`;
  }

  if (draftProofCount > 0) {
    return `${draftProofCount} draft evidence item(s)`;
  }

  return `${draftCheckCount} draft check(s)`;
}

function extractVerificationDraftChecks(verificationText) {
  const section = getMarkdownSection(verificationText, "Draft checks") || getMarkdownSection(verificationText, "Planned checks");
  return splitLineEntries(section)
    .map((line) => normalizePlannedCheckLine(line))
    .filter(Boolean);
}

function normalizePlannedCheckLine(line) {
  const normalized = String(line || "").replace(/^\s*[-*+]\s*/, "").trim();
  if (!normalized) {
    return "";
  }

  const labeledMatch = normalized.match(/^(automated|manual)\s*:\s*(.*)$/i);
  if (labeledMatch) {
    const value = String(labeledMatch[2] || "").trim();
    return value ? `${labeledMatch[1].toLowerCase()}: ${value}` : "";
  }

  return normalized;
}

function getMarkdownSection(text, title) {
  const normalized = String(text || "").replace(/\r\n/g, "\n");
  const pattern = new RegExp(`(?:^|\\n)## ${escapeRegex(title)}\\n([\\s\\S]*?)(?=\\n## |$)`);
  const match = normalized.match(pattern);
  return match ? match[1].trim() : "";
}

function splitLineEntries(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function escapeRegex(value) {
  return String(value || "").replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
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
    const verificationGateStatus = normalizeVerificationGateStatus(task.verificationGateStatus) || task.verificationGateStatus;

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

    if (verificationGateStatus === "action-required") {
      risks.push({
        level: "high",
        message: `${task.id} has scoped local changes that are newer than the latest verification evidence.`,
      });
    }

    if (verificationGateStatus === "incomplete") {
      risks.push({
        level: "high",
        message: `${task.id} has only partial explicit evidence for its scoped local changes.`,
      });
    }

    if (verificationGateStatus === "unconfigured") {
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

    if (
      task.verificationGate &&
      task.verificationGate.proofCoverage &&
      (task.verificationGate.proofCoverage.draftEvidenceCount > 0 || task.verificationGate.proofCoverage.weakProofCount > 0)
    ) {
      risks.push({
        level: "medium",
        message: `${task.id} has draft evidence that does not yet satisfy explicit scoped coverage.`,
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
    status: deriveVerificationStatus(task),
    summary:
      task.verificationGate && task.verificationGate.summary && task.verificationGate.summary.message
        ? task.verificationGate.summary.message
        : task.latestRunSummary,
    coveragePercent: normalizeCoveragePercent(task.coveragePercent),
    scopeHintCount: normalizeNonNegativeInteger(task.scopeHintCount),
    scopedFileCount: normalizeNonNegativeInteger(task.scopedFileCount),
    coveredScopedFileCount: normalizeNonNegativeInteger(task.coveredScopedFileCount),
    relevantChangeCount: task.relevantChangeCount || 0,
  }));
}

function deriveVerificationStatus(task) {
  const verificationGateStatus = normalizeVerificationGateStatus(task.verificationGateStatus) || task.verificationGateStatus;

  return task.latestRunStatus === "failed"
    ? "failed"
    : verificationGateStatus === "action-required"
      ? "action-required"
      : verificationGateStatus === "incomplete"
        ? "incomplete"
        : verificationGateStatus === "unconfigured"
          ? "unconfigured"
          : verificationGateStatus === "covered"
            ? "covered"
            : task.latestRunStatus === "passed"
              ? "evidence-recorded"
              : "pending";
}

function summarizeTaskCoverage(tasks) {
  const totals = (Array.isArray(tasks) ? tasks : []).reduce(
    (result, task) => {
      const scopedFileCount = normalizeNonNegativeInteger(task && task.scopedFileCount);
      const coveredScopedFileCount = normalizeNonNegativeInteger(task && task.coveredScopedFileCount);

      result.totalScopedFiles += scopedFileCount;
      result.coveredScopedFiles += Math.min(coveredScopedFileCount, scopedFileCount);
      return result;
    },
    {
      coveredScopedFiles: 0,
      totalScopedFiles: 0,
    }
  );

  return {
    ...totals,
    coveragePercent:
      totals.totalScopedFiles > 0 ? Math.round((totals.coveredScopedFiles / totals.totalScopedFiles) * 100) : 0,
  };
}

function normalizeCoveragePercent(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(numeric)));
}

function normalizeNonNegativeInteger(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) {
    return 0;
  }

  return Math.round(numeric);
}

module.exports = {
  buildOverview,
};

