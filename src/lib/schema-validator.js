const path = require("path");
const { fileExists, readJson } = require("./fs-utils");
const { listAdapters } = require("./adapters");
const { listRecipes } = require("./recipes");
const { listRuns, listTasks } = require("./task-service");
const { projectConfigPath, taskRoot } = require("./workspace");

function validateWorkspace(workspaceRoot) {
  const issues = [];

  validateProjectConfig(workspaceRoot, issues);
  validateRecipes(workspaceRoot, issues);
  validateAdapters(workspaceRoot, issues);
  validateTasks(workspaceRoot, issues);

  return {
    ok: issues.length === 0,
    issueCount: issues.length,
    errorCount: issues.filter((issue) => issue.level === "error").length,
    warningCount: issues.filter((issue) => issue.level === "warning").length,
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
      issues.push(issue("error", "adapter.missing", `Adapter config missing: ${adapter.adapterId}`, adapter.adapterPath));
      return;
    }

    const config = adapter.config;
    if (!isNonEmptyString(config.adapterId)) {
      issues.push(issue("error", "adapter.adapterId", "Adapter config must include adapterId", adapter.adapterPath));
    }
    if (!isNonEmptyString(config.promptFile)) {
      issues.push(issue("error", "adapter.promptFile", `Adapter ${adapter.adapterId} must include promptFile`, adapter.adapterPath));
    }
    if (!Array.isArray(config.runnerCommand)) {
      issues.push(issue("warning", "adapter.runnerCommand", `Adapter ${adapter.adapterId} should include runnerCommand array`, adapter.adapterPath));
    }
  });
}

function validateTasks(workspaceRoot, issues) {
  const knownRecipeIds = new Set(listRecipes(workspaceRoot).map((recipe) => recipe.id));

  listTasks(workspaceRoot).forEach((task) => {
    const metaPath = path.join(taskRoot(workspaceRoot, task.id), "task.json");
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

    listRuns(workspaceRoot, task.id).forEach((run) => {
      const runPath = path.join(taskRoot(workspaceRoot, task.id), "runs", `${run.id}.json`);
      if (!isNonEmptyString(run.id)) {
        issues.push(issue("error", "run.id", `Task ${task.id} has a run without id`, runPath));
      }
      if (!isNonEmptyString(run.status)) {
        issues.push(issue("error", "run.status", `Task ${task.id} has a run without status`, runPath));
      }
      if (!isNonEmptyString(run.summary)) {
        issues.push(issue("warning", "run.summary", `Task ${task.id} has a run without summary`, runPath));
      }
    });
  });
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

module.exports = {
  validateWorkspace,
};
