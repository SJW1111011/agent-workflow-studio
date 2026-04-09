const path = require("path");
const { fileExists } = require("./fs-utils");
const { badRequest, createHttpError } = require("./http-errors");

const CORE_ENV_KEYS = [
  "APPDATA",
  "ComSpec",
  "HOME",
  "HOMEDRIVE",
  "HOMEPATH",
  "LOCALAPPDATA",
  "PATH",
  "PATHEXT",
  "Path",
  "SHELL",
  "SystemDrive",
  "SystemRoot",
  "TEMP",
  "TERM",
  "TMP",
  "USERPROFILE",
];

const SUPPORTED_TEMPLATE_TOKENS = new Set([
  "workspaceRoot",
  "taskRoot",
  "promptFile",
  "launchPackFile",
  "runRequestFile",
]);

function buildExecutionPlan(workspaceRoot, taskId, adapter, files, prepared, runRequest, options = {}) {
  const runnerCommand = normalizeTemplateArray(adapter.runnerCommand, adapter.adapterId, "runnerCommand", false);
  const argvTemplate = normalizeTemplateArray(adapter.argvTemplate || [], adapter.adapterId, "argvTemplate", true);
  const promptFileRelative = normalizeArtifactReference(
    runRequest.promptFile || toWorkspaceRelative(workspaceRoot, prepared.promptPath),
    taskId,
    "promptFile",
    "prompt file"
  );
  const launchPackFileRelative = normalizeArtifactReference(
    runRequest.launchPackFile || toWorkspaceRelative(workspaceRoot, prepared.launchPackPath),
    taskId,
    "launchPackFile",
    "launch pack file"
  );
  const runRequestFileRelative = toWorkspaceRelative(workspaceRoot, prepared.runRequestPath);
  const promptFileAbsolute = resolveWorkspaceArtifactPath(workspaceRoot, promptFileRelative, taskId, "prompt file");
  const launchPackAbsolute = resolveWorkspaceArtifactPath(workspaceRoot, launchPackFileRelative, taskId, "launch pack file");
  const runRequestAbsolute = resolveWorkspaceArtifactPath(
    workspaceRoot,
    runRequestFileRelative,
    taskId,
    "run request file"
  );
  const tokenMap = {
    workspaceRoot,
    taskRoot: files.root,
    promptFile: promptFileAbsolute,
    launchPackFile: launchPackAbsolute,
    runRequestFile: runRequestAbsolute,
  };

  const resolvedRunnerCommand = resolveTemplateArray(runnerCommand, tokenMap, adapter.adapterId, "runnerCommand");
  const resolvedArgvTemplate = resolveTemplateArray(argvTemplate, tokenMap, adapter.adapterId, "argvTemplate");
  const cwdMode = normalizeCwdMode(adapter.cwdMode, adapter.adapterId);
  const stdioMode = normalizeStdioMode(adapter.stdioMode, adapter.adapterId);
  const stdinMode = normalizeStdinMode(adapter.stdinMode, adapter.adapterId);
  const successExitCodes = normalizeSuccessExitCodes(adapter.successExitCodes, adapter.adapterId);
  const envAllowlist = normalizeEnvAllowlist(adapter.envAllowlist, adapter.adapterId);
  const timeoutOverride = normalizePositiveInteger(options.timeoutMs);
  const timeoutConfigured = normalizePositiveInteger(adapter.timeoutMs);
  const cwd = cwdMode === "taskRoot" ? files.root : workspaceRoot;
  assertPathInsideRoot(workspaceRoot, cwd, "cwd", "plan-invalid");

  return {
    adapterId: adapter.adapterId,
    taskId,
    commandMode: adapter.commandMode || "manual",
    command: resolvedRunnerCommand[0],
    args: resolvedRunnerCommand.slice(1).concat(resolvedArgvTemplate),
    cwd,
    cwdMode,
    stdioMode,
    stdinMode,
    stdinPath: stdinMode === "promptFile" ? promptFileAbsolute : null,
    successExitCodes,
    timeoutMs: timeoutOverride || timeoutConfigured || null,
    env: buildChildEnv(envAllowlist),
    envAllowlist,
    promptFileRelative,
    runRequestFileRelative,
    launchPackFileRelative,
    runsDirectory: files.runs,
  };
}

function resolveTemplateArray(values, tokenMap, adapterId, fieldName) {
  return values.map((value) => resolveTemplateValue(value, tokenMap, adapterId, fieldName));
}

function resolveTemplateValue(value, tokenMap, adapterId, fieldName) {
  const template = String(value);
  const unsupportedTokens = Array.from(template.matchAll(/\{([^}]+)\}/g))
    .map((match) => match[1])
    .filter((token) => !SUPPORTED_TEMPLATE_TOKENS.has(token));

  if (unsupportedTokens.length > 0) {
    throw createExecutionPreflightError(
      409,
      `Adapter ${adapterId} ${fieldName} includes unsupported template token(s): ${unsupportedTokens.join(", ")}.`,
      "adapter_template_token_invalid",
      "plan-invalid",
      [createBlockingIssue(fieldName, `Unsupported template tokens: ${unsupportedTokens.join(", ")}.`)]
    );
  }

  return template.replace(/\{(workspaceRoot|taskRoot|promptFile|launchPackFile|runRequestFile)\}/g, (_, key) => {
    return tokenMap[key];
  });
}

function buildChildEnv(envAllowlist) {
  const childEnv = {};
  const requested = new Set([...CORE_ENV_KEYS, ...envAllowlist]);

  for (const requestedKey of requested) {
    const matchedKey = Object.keys(process.env).find(
      (existingKey) => existingKey.toLowerCase() === String(requestedKey).toLowerCase()
    );
    if (matchedKey) {
      childEnv[matchedKey] = process.env[matchedKey];
    }
  }

  return childEnv;
}

function normalizePositiveInteger(value) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized <= 0) {
    throw badRequest(`timeoutMs must be a positive integer, received: ${value}`, "invalid_timeout_ms");
  }

  return normalized;
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function normalizeTemplateArray(value, adapterId, fieldName, allowEmpty) {
  if (value === undefined) {
    return allowEmpty ? [] : throwMissingArrayValue(adapterId, fieldName);
  }

  if (!Array.isArray(value)) {
    throw createExecutionPreflightError(
      409,
      `Adapter ${adapterId} must use ${fieldName} as an array.`,
      `adapter_${fieldName}_invalid`,
      "adapter-invalid",
      [createBlockingIssue(fieldName, `${fieldName} must be an array of non-empty strings.`)]
    );
  }

  if (!allowEmpty && value.length === 0) {
    throwMissingArrayValue(adapterId, fieldName);
  }

  return value.map((entry, index) => {
    if (!isNonEmptyString(entry)) {
      throw createExecutionPreflightError(
        409,
        `Adapter ${adapterId} ${fieldName}[${index}] must be a non-empty string.`,
        `adapter_${fieldName}_entry_invalid`,
        "adapter-invalid",
        [createBlockingIssue(fieldName, `${fieldName}[${index}] must be a non-empty string.`)]
      );
    }

    return String(entry).trim();
  });
}

function throwMissingArrayValue(adapterId, fieldName) {
  throw createExecutionPreflightError(
    409,
    `Adapter ${adapterId} must include a non-empty ${fieldName} to support run:execute.`,
    fieldName === "runnerCommand" ? "adapter_runner_command_missing" : `adapter_${fieldName}_missing`,
    "adapter-invalid",
    [createBlockingIssue(fieldName, `${fieldName} must include at least one entry.`)]
  );
}

function normalizeCwdMode(value, adapterId) {
  if (value === undefined || value === null || value === "") {
    return "workspaceRoot";
  }

  if (value === "workspaceRoot" || value === "taskRoot") {
    return value;
  }

  throw createExecutionPreflightError(
    409,
    `Adapter ${adapterId} has unsupported cwdMode ${value}.`,
    "adapter_cwd_mode_invalid",
    "adapter-invalid",
    [createBlockingIssue("cwdMode", `Unsupported cwdMode: ${value}.`)]
  );
}

function normalizeStdioMode(value, adapterId) {
  if (value === undefined || value === null || value === "") {
    return "inherit";
  }

  if (value === "inherit" || value === "pipe") {
    return value;
  }

  throw createExecutionPreflightError(
    409,
    `Adapter ${adapterId} has unsupported stdioMode ${value}.`,
    "adapter_stdio_mode_invalid",
    "adapter-invalid",
    [createBlockingIssue("stdioMode", `Unsupported stdioMode: ${value}.`)]
  );
}

function normalizeStdinMode(value, adapterId) {
  if (value === undefined || value === null || value === "") {
    return "none";
  }

  if (value === "none" || value === "promptFile") {
    return value;
  }

  throw createExecutionPreflightError(
    409,
    `Adapter ${adapterId} has unsupported stdinMode ${value}.`,
    "adapter_stdin_mode_invalid",
    "adapter-invalid",
    [createBlockingIssue("stdinMode", `Unsupported stdinMode: ${value}.`)]
  );
}

function normalizeSuccessExitCodes(value, adapterId) {
  if (value === undefined) {
    return [0];
  }

  if (!Array.isArray(value) || value.length === 0 || !value.every((entry) => Number.isInteger(entry))) {
    throw createExecutionPreflightError(
      409,
      `Adapter ${adapterId} must use successExitCodes as a non-empty array of integers.`,
      "adapter_success_exit_codes_invalid",
      "plan-invalid",
      [createBlockingIssue("successExitCodes", "successExitCodes must be a non-empty array of integers.")]
    );
  }

  return value;
}

function normalizeEnvAllowlist(value, adapterId) {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value) || !value.every((entry) => isNonEmptyString(entry))) {
    throw createExecutionPreflightError(
      409,
      `Adapter ${adapterId} must use envAllowlist as an array of non-empty strings.`,
      "adapter_env_allowlist_invalid",
      "plan-invalid",
      [createBlockingIssue("envAllowlist", "envAllowlist must be an array of non-empty strings.")]
    );
  }

  return value.map((entry) => String(entry).trim());
}

function normalizeArtifactReference(value, taskId, fieldName, label) {
  if (!isNonEmptyString(value)) {
    throw createExecutionPreflightError(
      409,
      `Run request is missing ${label} reference for ${taskId}.`,
      `run_request_${fieldName}_missing`,
      "prepared-artifacts-missing",
      [createBlockingIssue(fieldName, `${label} reference is missing from run-request.`)]
    );
  }

  const normalized = String(value).trim();
  if (path.isAbsolute(normalized)) {
    throw createExecutionPreflightError(
      409,
      `Run request ${fieldName} must stay repository-relative for ${taskId}.`,
      `run_request_${fieldName}_absolute`,
      "plan-invalid",
      [createBlockingIssue(fieldName, `${label} must stay repository-relative.`)]
    );
  }

  return normalized.replace(/\\/g, "/");
}

function resolveWorkspaceArtifactPath(workspaceRoot, relativePath, taskId, label) {
  const absolutePath = path.resolve(workspaceRoot, relativePath);
  assertPathInsideRoot(workspaceRoot, absolutePath, label, "plan-invalid");

  if (!fileExists(absolutePath)) {
    throw createExecutionPreflightError(
      409,
      `Prepared ${label} is missing for ${taskId}: ${relativePath}.`,
      `prepared_${label.replace(/\s+/g, "_")}_missing`,
      "prepared-artifacts-missing",
      [createBlockingIssue(label, `${label} is missing at ${relativePath}.`)]
    );
  }

  return absolutePath;
}

function assertPathInsideRoot(workspaceRoot, absolutePath, label, failureCategory) {
  const root = path.resolve(workspaceRoot);
  const target = path.resolve(absolutePath);
  const normalizedRoot = `${root}${path.sep}`;

  if (target !== root && !target.startsWith(normalizedRoot)) {
    throw createExecutionPreflightError(
      409,
      `${label} resolves outside the workspace root and cannot be used for local execution.`,
      "execution_path_outside_workspace",
      failureCategory,
      [createBlockingIssue(label, `${label} resolves outside the workspace root.`)]
    );
  }
}

function createExecutionPreflightError(statusCode, message, code, failureCategory, blockingIssues, advisories) {
  return createHttpError(statusCode, message, {
    code,
    failureCategory,
    blockingIssues: normalizeBlockingIssues({ blockingIssues }),
    advisories: normalizeAdvisories({ advisories }),
  });
}

function createBlockingIssue(field, message) {
  return {
    field,
    message,
  };
}

function normalizeBlockingIssues(value) {
  const entries = Array.isArray(value && value.blockingIssues) ? value.blockingIssues : [];
  return entries
    .filter((entry) => entry && typeof entry === "object" && isNonEmptyString(entry.message))
    .map((entry) => ({
      field: isNonEmptyString(entry.field) ? String(entry.field).trim() : null,
      message: String(entry.message).trim(),
    }));
}

function normalizeAdvisories(value) {
  const entries = Array.isArray(value && value.advisories) ? value.advisories : [];
  return entries
    .map((entry) => {
      if (isNonEmptyString(entry)) {
        return {
          code: null,
          message: String(entry).trim(),
        };
      }

      if (!entry || typeof entry !== "object" || !isNonEmptyString(entry.message)) {
        return null;
      }

      return {
        code: isNonEmptyString(entry.code) ? String(entry.code).trim() : null,
        message: String(entry.message).trim(),
      };
    })
    .filter(Boolean);
}

function normalizeSnapshotPath(value) {
  return isNonEmptyString(value) ? String(value).trim().replace(/\\/g, "/") : "";
}

function toWorkspaceRelative(workspaceRoot, absolutePath) {
  return path.relative(workspaceRoot, absolutePath).replace(/\\/g, "/");
}

module.exports = {
  buildExecutionPlan,
  createBlockingIssue,
  createExecutionPreflightError,
  isNonEmptyString,
  normalizeAdvisories,
  normalizeBlockingIssues,
  normalizeSnapshotPath,
  toWorkspaceRelative,
};
