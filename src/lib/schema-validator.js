const fs = require("fs");
const path = require("path");
const { VALID_CHECK_STATUSES, normalizeProofAnchors } = require("./evidence-utils");
const { fileExists, readJson } = require("./fs-utils");
const { listAdapters } = require("./adapters");
const { listRecipes } = require("./recipes");
const { listTasks } = require("./task-service");
const {
  getEvidenceCollectorConfigIssues,
  projectConfigPath,
  resolveStrictVerification,
  taskRoot,
} = require("./workspace");

const RUN_OUTCOMES = new Set(["passed", "failed", "timed-out", "interrupted", "cancelled"]);
const RUN_FAILURE_CATEGORIES = new Set(["non-zero-exit", "timeout", "interrupted", "launch-error"]);
const VALID_LEGACY_CHECK_STATUSES = new Set(VALID_CHECK_STATUSES.concat(["verified", "strong", "weak", "draft", "planned"]));

function validateWorkspace(workspaceRoot, options = {}) {
  const issues = [];
  const strictVerification = resolveStrictVerification(workspaceRoot, options.strict);

  validateProjectConfig(workspaceRoot, issues);
  validateRecipes(workspaceRoot, issues);
  validateAdapters(workspaceRoot, issues);
  validateTasks(workspaceRoot, issues);

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    errorCount: issues.filter((issue) => issue.level === "error").length,
    warningCount: issues.filter((issue) => issue.level === "warning").length,
    strictVerification,
    issues,
  };
}

function validateProjectConfig(workspaceRoot, issues) {
  const configPath = projectConfigPath(workspaceRoot);
  const config = readJson(configPath, null);

  if (!config) {
    issues.push(issue("error", "project.missing", "Missing or invalid project.json", configPath));
    return;
  }

  if (typeof config.schemaVersion !== "number") {
    issues.push(issue("error", "project.schemaVersion", "project.json must contain a numeric schemaVersion", configPath));
  }

  if (!isNonEmptyString(config.repositoryName)) {
    issues.push(issue("error", "project.repositoryName", "project.json must contain repositoryName", configPath));
  }

  if (!Array.isArray(config.adapters)) {
    issues.push(issue("warning", "project.adapters", "project.json should declare supported adapters", configPath));
  }

  if (config.strictVerification !== undefined && typeof config.strictVerification !== "boolean") {
    issues.push(
      issue(
        "error",
        "project.strictVerification",
        "project.json strictVerification must be a boolean when present",
        configPath
      )
    );
  }

  if (config.autoInferTest !== undefined && typeof config.autoInferTest !== "boolean") {
    issues.push(
      issue(
        "error",
        "project.autoInferTest",
        "project.json autoInferTest must be a boolean when present",
        configPath
      )
    );
  }

  if (config.evidenceCollectors !== undefined) {
    if (!Array.isArray(config.evidenceCollectors)) {
      issues.push(
        issue(
          "error",
          "project.evidenceCollectors",
          "project.json evidenceCollectors must be an array when present",
          configPath
        )
      );
    } else {
      config.evidenceCollectors.forEach((collector, index) => {
        const collectorIssues = getEvidenceCollectorConfigIssues(collector);
        collectorIssues.forEach((message) => {
          issues.push(
            issue(
              "error",
              "project.evidenceCollectors.entry",
              `project.json evidenceCollectors[${index}] ${message}`,
              configPath
            )
          );
        });
      });
    }
  }
}

function validateRecipes(workspaceRoot, issues) {
  const recipes = listRecipes(workspaceRoot);

  if (recipes.length === 0) {
    issues.push(issue("warning", "recipes.empty", "Recipe registry is missing or empty", ".agent-workflow/recipes/index.json"));
    return;
  }

  recipes.forEach((recipe) => {
    const recipePath = path.join(".agent-workflow", "recipes", recipe.fileName || "");
    if (!isNonEmptyString(recipe.id)) {
      issues.push(issue("error", "recipe.id", "Recipe entry is missing id", recipePath));
    }
    if (!isNonEmptyString(recipe.fileName)) {
      issues.push(issue("error", "recipe.fileName", `Recipe ${recipe.id || "(unknown)"} is missing fileName`, recipePath));
    }
    if (!isNonEmptyString(recipe.summary)) {
      issues.push(issue("warning", "recipe.summary", `Recipe ${recipe.id || "(unknown)"} is missing summary`, recipePath));
    }
  });
}

function validateAdapters(workspaceRoot, issues) {
  listAdapters(workspaceRoot).forEach((adapter) => {
    if (!adapter.exists || !adapter.config) {
      issues.push(
        issue(
          "error",
          "adapter.missing",
          `${adapter.exists ? "Adapter config is invalid" : "Adapter config missing"}: ${adapter.adapterId}`,
          adapter.adapterPath
        )
      );
      return;
    }

    const config = adapter.config;
    if (!isNonEmptyString(config.adapterId)) {
      issues.push(issue("error", "adapter.adapterId", "Adapter config must include adapterId", adapter.adapterPath));
    }
    if (!isNonEmptyString(config.promptFile)) {
      issues.push(issue("error", "adapter.promptFile", `Adapter ${adapter.adapterId} must include promptFile`, adapter.adapterPath));
    }
    if (config.promptTarget !== undefined && !["codex", "claude"].includes(String(config.promptTarget || "").trim())) {
      issues.push(
        issue(
          "error",
          "adapter.promptTarget",
          `Adapter ${adapter.adapterId} has unsupported promptTarget ${config.promptTarget}`,
          adapter.adapterPath
        )
      );
    }
    if (!Array.isArray(config.runnerCommand)) {
      issues.push(issue("warning", "adapter.runnerCommand", `Adapter ${adapter.adapterId} should include runnerCommand array`, adapter.adapterPath));
    } else if ((config.commandMode || "manual") === "exec" && config.runnerCommand.length === 0) {
      issues.push(issue("error", "adapter.runnerCommand.empty", `Adapter ${adapter.adapterId} cannot use exec mode with an empty runnerCommand`, adapter.adapterPath));
    }
    if (config.commandMode !== undefined && !["manual", "exec"].includes(config.commandMode)) {
      issues.push(issue("error", "adapter.commandMode", `Adapter ${adapter.adapterId} has unsupported commandMode ${config.commandMode}`, adapter.adapterPath));
    }
    if (config.argvTemplate !== undefined && !Array.isArray(config.argvTemplate)) {
      issues.push(issue("error", "adapter.argvTemplate", `Adapter ${adapter.adapterId} must use argvTemplate array when present`, adapter.adapterPath));
    }
    if (config.cwdMode !== undefined && !["workspaceRoot", "taskRoot"].includes(config.cwdMode)) {
      issues.push(issue("error", "adapter.cwdMode", `Adapter ${adapter.adapterId} has unsupported cwdMode ${config.cwdMode}`, adapter.adapterPath));
    }
    if (config.stdioMode !== undefined && !["inherit", "pipe"].includes(config.stdioMode)) {
      issues.push(issue("error", "adapter.stdioMode", `Adapter ${adapter.adapterId} has unsupported stdioMode ${config.stdioMode}`, adapter.adapterPath));
    }
    if (config.stdinMode !== undefined && !["none", "promptFile"].includes(config.stdinMode)) {
      issues.push(issue("error", "adapter.stdinMode", `Adapter ${adapter.adapterId} has unsupported stdinMode ${config.stdinMode}`, adapter.adapterPath));
    }
    if (
      config.successExitCodes !== undefined &&
      (!Array.isArray(config.successExitCodes) || !config.successExitCodes.every((value) => Number.isInteger(value)))
    ) {
      issues.push(issue("error", "adapter.successExitCodes", `Adapter ${adapter.adapterId} must use numeric successExitCodes`, adapter.adapterPath));
    }
    if (
      config.timeoutMs !== undefined &&
      (!Number.isInteger(config.timeoutMs) || config.timeoutMs <= 0)
    ) {
      issues.push(issue("error", "adapter.timeoutMs", `Adapter ${adapter.adapterId} must use a positive integer timeoutMs when present`, adapter.adapterPath));
    }
    if (
      config.envAllowlist !== undefined &&
      (!Array.isArray(config.envAllowlist) || !config.envAllowlist.every((value) => isNonEmptyString(value)))
    ) {
      issues.push(issue("error", "adapter.envAllowlist", `Adapter ${adapter.adapterId} must use string envAllowlist entries`, adapter.adapterPath));
    }
  });
}

function validateTasks(workspaceRoot, issues) {
  const knownRecipeIds = new Set(listRecipes(workspaceRoot).map((recipe) => recipe.id));

  listTasks(workspaceRoot).forEach((task) => {
    const currentTaskRoot = taskRoot(workspaceRoot, task.id);
    const metaPath = path.join(currentTaskRoot, "task.json");
    if (!isNonEmptyString(task.id)) {
      issues.push(issue("error", "task.id", "Task entry is missing id", metaPath));
    }
    if (!isNonEmptyString(task.title)) {
      issues.push(issue("error", "task.title", `Task ${task.id || "(unknown)"} is missing title`, metaPath));
    }
    if (!isNonEmptyString(task.priority)) {
      issues.push(issue("warning", "task.priority", `Task ${task.id} should include priority`, metaPath));
    }
    if (!isNonEmptyString(task.recipeId)) {
      issues.push(issue("warning", "task.recipeId", `Task ${task.id} should declare recipeId`, metaPath));
    } else if (!knownRecipeIds.has(task.recipeId)) {
      issues.push(issue("error", "task.recipeId.unknown", `Task ${task.id} references unknown recipeId ${task.recipeId}`, metaPath));
    }

    listRawRuns(currentTaskRoot).forEach(({ run, runPath }) => {
      if (!isNonEmptyString(run.id)) {
        issues.push(issue("error", "run.id", `Task ${task.id} has a run without id`, runPath));
      }
      if (!isNonEmptyString(run.status)) {
        issues.push(issue("error", "run.status", `Task ${task.id} has a run without status`, runPath));
      }
      if (!isNonEmptyString(run.summary)) {
        issues.push(issue("warning", "run.summary", `Task ${task.id} has a run without summary`, runPath));
      }
      if (run.source !== undefined && !["manual", "executor"].includes(run.source)) {
        issues.push(issue("warning", "run.source", `Task ${task.id} has a run with unsupported source ${run.source}`, runPath));
      }
      if (run.outcome !== undefined && !RUN_OUTCOMES.has(String(run.outcome || "").trim().toLowerCase())) {
        issues.push(issue("warning", "run.outcome", `Task ${task.id} has a run with unsupported outcome ${run.outcome}`, runPath));
      }
      if (
        run.failureCategory !== undefined &&
        !RUN_FAILURE_CATEGORIES.has(String(run.failureCategory || "").trim().toLowerCase())
      ) {
        issues.push(
          issue(
            "warning",
            "run.failureCategory",
            `Task ${task.id} has a run with unsupported failureCategory ${run.failureCategory}`,
            runPath
          )
        );
      }
      if (run.exitCode !== undefined && run.exitCode !== null && !Number.isInteger(run.exitCode)) {
        issues.push(issue("warning", "run.exitCode", `Task ${task.id} has a run with non-numeric exitCode`, runPath));
      }
      if (run.promptFile !== undefined && !isNonEmptyString(run.promptFile)) {
        issues.push(issue("warning", "run.promptFile", `Task ${task.id} has a run with invalid promptFile`, runPath));
      }
      if (run.runRequestFile !== undefined && !isNonEmptyString(run.runRequestFile)) {
        issues.push(issue("warning", "run.runRequestFile", `Task ${task.id} has a run with invalid runRequestFile`, runPath));
      }
      if (run.stdoutFile !== undefined && !isNonEmptyString(run.stdoutFile)) {
        issues.push(issue("warning", "run.stdoutFile", `Task ${task.id} has a run with invalid stdoutFile`, runPath));
      }
      if (run.stderrFile !== undefined && !isNonEmptyString(run.stderrFile)) {
        issues.push(issue("warning", "run.stderrFile", `Task ${task.id} has a run with invalid stderrFile`, runPath));
      }
      if (
        run.scopeProofPaths !== undefined &&
        (!Array.isArray(run.scopeProofPaths) || !run.scopeProofPaths.every((value) => isNonEmptyString(value)))
      ) {
        issues.push(issue("warning", "run.scopeProofPaths", `Task ${task.id} has a run with invalid scopeProofPaths`, runPath));
      }
      if (
        run.scopeProofAnchors !== undefined &&
        (!Array.isArray(run.scopeProofAnchors) || !run.scopeProofAnchors.every((value) => isValidProofAnchor(value)))
      ) {
        issues.push(issue("warning", "run.scopeProofAnchors", `Task ${task.id} has a run with invalid scopeProofAnchors`, runPath));
      }
      if (
        run.verificationArtifacts !== undefined &&
        (!Array.isArray(run.verificationArtifacts) || !run.verificationArtifacts.every((value) => isNonEmptyString(value)))
      ) {
        issues.push(issue("warning", "run.verificationArtifacts", `Task ${task.id} has a run with invalid verificationArtifacts`, runPath));
      }
      if (
        run.verificationChecks !== undefined &&
        (!Array.isArray(run.verificationChecks) || !run.verificationChecks.every((value) => isValidVerificationCheck(value)))
      ) {
        issues.push(issue("warning", "run.verificationChecks", `Task ${task.id} has a run with invalid verificationChecks`, runPath));
      }
      if (run.evidenceContext !== undefined && !isValidEvidenceContext(run.evidenceContext)) {
        issues.push(issue("warning", "run.evidenceContext", `Task ${task.id} has a run with invalid evidenceContext`, runPath));
      }
      if (run.timedOut !== undefined && typeof run.timedOut !== "boolean") {
        issues.push(issue("warning", "run.timedOut", `Task ${task.id} has a run with invalid timedOut flag`, runPath));
      }
      if (run.timeoutMs !== undefined && (!Number.isInteger(run.timeoutMs) || run.timeoutMs <= 0)) {
        issues.push(issue("warning", "run.timeoutMs", `Task ${task.id} has a run with invalid timeoutMs`, runPath));
      }
      if (run.interrupted !== undefined && typeof run.interrupted !== "boolean") {
        issues.push(issue("warning", "run.interrupted", `Task ${task.id} has a run with invalid interrupted flag`, runPath));
      }
      if (run.interruptionSignal !== undefined && !isNonEmptyString(run.interruptionSignal)) {
        issues.push(issue("warning", "run.interruptionSignal", `Task ${task.id} has a run with invalid interruptionSignal`, runPath));
      }
      if (run.terminationSignal !== undefined && !isNonEmptyString(run.terminationSignal)) {
        issues.push(issue("warning", "run.terminationSignal", `Task ${task.id} has a run with invalid terminationSignal`, runPath));
      }
    });
  });
}

function listRawRuns(currentTaskRoot) {
  const runsDir = path.join(currentTaskRoot, "runs");
  if (!fs.existsSync(runsDir)) {
    return [];
  }

  return fs
    .readdirSync(runsDir, { withFileTypes: true })
    .filter((entry) => entry.isFile() && entry.name.startsWith("run-") && entry.name.endsWith(".json"))
    .map((entry) => {
      const runPath = path.join(runsDir, entry.name);
      return {
        run: readJson(runPath, null),
        runPath,
      };
    })
    .filter((entry) => entry.run);
}

function issue(level, code, message, target) {
  return {
    level,
    code,
    message,
    target,
  };
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isValidVerificationCheck(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  if (!isNonEmptyString(value.label)) {
    return false;
  }

  if (
    value.status !== undefined &&
    !VALID_LEGACY_CHECK_STATUSES.has(String(value.status || "").trim().toLowerCase())
  ) {
    return false;
  }

  if (value.details !== undefined && !isNonEmptyString(value.details)) {
    return false;
  }

  if (
    value.artifacts !== undefined &&
    (!Array.isArray(value.artifacts) || !value.artifacts.every((entry) => isNonEmptyString(entry)))
  ) {
    return false;
  }

  return true;
}

function isValidProofAnchor(value) {
  if (!value || typeof value !== "object") {
    return false;
  }

  const normalized = normalizeProofAnchors([value]);
  if (normalized.length !== 1) {
    return false;
  }

  const anchor = normalized[0];
  if (!isNonEmptyString(anchor.path)) {
    return false;
  }

  if (anchor.gitState !== undefined && !isNonEmptyString(anchor.gitState)) {
    return false;
  }

  if (anchor.previousPath !== undefined && !isNonEmptyString(anchor.previousPath)) {
    return false;
  }

  if (anchor.exists !== undefined && typeof anchor.exists !== "boolean") {
    return false;
  }

  if (anchor.contentFingerprint !== undefined && !isNonEmptyString(anchor.contentFingerprint)) {
    return false;
  }

  return true;
}

function isValidEvidenceContext(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }

  const allowedKeys = new Set(["commandsRun", "filesModified", "sessionDurationMs", "toolCallCount"]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) {
    return false;
  }

  if (
    value.filesModified !== undefined &&
    (!Array.isArray(value.filesModified) || !value.filesModified.every((entry) => isNonEmptyString(entry)))
  ) {
    return false;
  }

  if (
    value.commandsRun !== undefined &&
    (!Array.isArray(value.commandsRun) || !value.commandsRun.every((entry) => isNonEmptyString(entry)))
  ) {
    return false;
  }

  if (
    value.toolCallCount !== undefined &&
    (!Number.isInteger(value.toolCallCount) || value.toolCallCount < 0)
  ) {
    return false;
  }

  if (
    value.sessionDurationMs !== undefined &&
    (!Number.isInteger(value.sessionDurationMs) || value.sessionDurationMs < 0)
  ) {
    return false;
  }

  return true;
}

module.exports = {
  validateWorkspace,
};
