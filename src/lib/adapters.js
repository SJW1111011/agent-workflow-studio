const fs = require("fs");
const path = require("path");
const { fileExists, readJson, writeJson } = require("./fs-utils");
const { badRequest, conflict } = require("./http-errors");
const { adaptersRoot, ensureWorkflowScaffold, projectConfigPath } = require("./workspace");

const BUILTIN_ADAPTERS = [
  {
    adapterId: "codex",
    fileName: "codex.json",
    displayName: "Codex",
  },
  {
    adapterId: "claude-code",
    fileName: "claude-code.json",
    displayName: "Claude Code",
  },
];

const SUPPORTED_PROMPT_TARGETS = new Set(["codex", "claude"]);
const SUPPORTED_COMMAND_MODES = new Set(["manual", "exec"]);
const SUPPORTED_CWD_MODES = new Set(["workspaceRoot", "taskRoot"]);
const SUPPORTED_STDIO_MODES = new Set(["inherit", "pipe"]);
const SUPPORTED_STDIN_MODES = new Set(["none", "promptFile"]);
const ADAPTER_ID_PATTERN = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

function listAdapters(workspaceRoot) {
  const root = adaptersRoot(workspaceRoot);
  const builtinByFileName = new Map(BUILTIN_ADAPTERS.map((adapter) => [adapter.fileName, adapter]));
  const discoveredFileNames = fs.existsSync(root)
    ? fs
        .readdirSync(root, { withFileTypes: true })
        .filter((entry) => entry.isFile() && entry.name.endsWith(".json"))
        .map((entry) => entry.name)
    : [];
  const fileNames = Array.from(
    new Set(BUILTIN_ADAPTERS.map((adapter) => adapter.fileName).concat(discoveredFileNames))
  );

  return fileNames
    .map((fileName) => buildAdapterEntry(workspaceRoot, fileName, builtinByFileName.get(fileName) || null))
    .sort(compareAdapterEntries);
}

function getAdapter(workspaceRoot, adapterId) {
  const normalizedAdapterId = normalizeAdapterId(adapterId);
  const match = listAdapters(workspaceRoot).find((adapter) => adapter.normalizedAdapterId === normalizedAdapterId);
  if (!match || !match.exists || !match.config) {
    throw badRequest(`Adapter ${adapterId} is not configured yet.`, "adapter_not_configured");
  }
  return match.config;
}

function createAdapter(workspaceRoot, adapterIdInput, options = {}) {
  ensureWorkflowScaffold(workspaceRoot);

  const adapterId = normalizeCreatedAdapterId(adapterIdInput);
  if (!adapterId) {
    throw badRequest("adapterId is required.", "adapter_id_required");
  }
  if (!ADAPTER_ID_PATTERN.test(adapterId)) {
    throw badRequest(
      "adapterId must use lowercase letters, numbers, dots, or hyphens.",
      "invalid_adapter_id"
    );
  }

  const existingAdapter = listAdapters(workspaceRoot).find((adapter) => adapter.normalizedAdapterId === adapterId);
  if (existingAdapter && existingAdapter.exists) {
    throw conflict(`Adapter already exists: ${adapterId}`, "adapter_already_exists");
  }

  const config = buildAdapterConfig(adapterId, options);
  const adapterPath = path.join(adaptersRoot(workspaceRoot), `${adapterId}.json`);
  writeJson(adapterPath, config);
  updateProjectConfigAdapters(workspaceRoot, adapterId);

  return {
    adapterId,
    adapterPath,
    config,
  };
}

function buildAdapterConfig(adapterId, options = {}) {
  const promptTarget = normalizePromptTarget(options.promptTarget || options.promptAgent || "codex");
  const displayName = isNonEmptyString(options.name) ? String(options.name).trim() : toDisplayName(adapterId);
  const runnerCommand = normalizeCommandTokens(options.runnerCommand, [adapterId], "runner");
  const argvTemplate = normalizeCommandTokens(options.argvTemplate, [], "argvTemplate");
  const commandMode = normalizeEnumValue(
    options.commandMode || "manual",
    SUPPORTED_COMMAND_MODES,
    "commandMode"
  );
  const cwdMode = normalizeEnumValue(options.cwdMode || "workspaceRoot", SUPPORTED_CWD_MODES, "cwdMode");
  const stdioMode = normalizeEnumValue(options.stdioMode || "pipe", SUPPORTED_STDIO_MODES, "stdioMode");
  const stdinMode = normalizeEnumValue(options.stdinMode || "none", SUPPORTED_STDIN_MODES, "stdinMode");
  const successExitCodes = normalizeSuccessExitCodes(options.successExitCodes);
  const timeoutMs = normalizeOptionalPositiveInteger(options.timeoutMs, "timeoutMs");
  const envAllowlist = normalizeStringList(options.envAllowlist);
  const notes = normalizeNotes(options.notes, adapterId);

  return {
    schemaVersion: 1,
    adapterId,
    name: displayName,
    promptTarget,
    promptFile: normalizeRelativeFileName(options.promptFile, `prompt.${adapterId}.md`, "promptFile"),
    runRequestFile: normalizeRelativeFileName(
      options.runRequestFile,
      `run-request.${adapterId}.json`,
      "runRequestFile"
    ),
    launchPackFile: normalizeRelativeFileName(options.launchPackFile, `launch.${adapterId}.md`, "launchPackFile"),
    runnerCommand,
    argvTemplate,
    commandMode,
    cwdMode,
    stdioMode,
    stdinMode,
    successExitCodes,
    timeoutMs,
    envAllowlist,
    capabilities: {
      interactive: false,
      multiAgent: false,
      resumable: false,
    },
    notes,
  };
}

function resolvePromptTargetForAdapter(adapter) {
  const configuredTarget = normalizePromptTargetValue(adapter && adapter.promptTarget);
  if (configuredTarget) {
    return configuredTarget;
  }

  const promptFile = String((adapter && adapter.promptFile) || "").trim().toLowerCase();
  return promptFile.includes("claude") ? "claude" : "codex";
}

function normalizeAdapterId(input) {
  const normalized = normalizeCreatedAdapterId(input);
  if (!normalized) {
    return "codex";
  }
  if (normalized === "claude") {
    return "claude-code";
  }
  return normalized;
}

function normalizeCreatedAdapterId(input) {
  return String(input || "").trim().toLowerCase();
}

function buildAdapterEntry(workspaceRoot, fileName, builtinSpec) {
  const adapterPath = path.join(adaptersRoot(workspaceRoot), fileName);
  const exists = fileExists(adapterPath);
  const config = readJson(adapterPath, null);
  const fallbackAdapterId = builtinSpec ? builtinSpec.adapterId : path.basename(fileName, ".json");
  const adapterId =
    config && isNonEmptyString(config.adapterId) ? String(config.adapterId).trim() : fallbackAdapterId;
  const displayName =
    config && isNonEmptyString(config.name)
      ? String(config.name).trim()
      : builtinSpec
        ? builtinSpec.displayName
        : toDisplayName(adapterId);

  return {
    adapterId,
    normalizedAdapterId: normalizeAdapterId(adapterId),
    displayName,
    exists,
    config,
    adapterPath,
    fileName,
    builtin: Boolean(builtinSpec),
    status: !exists ? "missing" : config ? "ready" : "invalid",
  };
}

function compareAdapterEntries(left, right) {
  if (left.builtin !== right.builtin) {
    return left.builtin ? -1 : 1;
  }

  if (left.builtin && right.builtin) {
    const leftIndex = BUILTIN_ADAPTERS.findIndex((adapter) => adapter.adapterId === left.adapterId);
    const rightIndex = BUILTIN_ADAPTERS.findIndex((adapter) => adapter.adapterId === right.adapterId);
    return leftIndex - rightIndex;
  }

  return left.adapterId.localeCompare(right.adapterId);
}

function normalizePromptTarget(input) {
  const normalized = normalizePromptTargetValue(input);
  if (!normalized) {
    throw badRequest(`Unsupported promptTarget: ${input}`, "unsupported_prompt_target");
  }
  return normalized;
}

function normalizePromptTargetValue(input) {
  const normalized = String(input || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }
  if (normalized === "claude-code") {
    return "claude";
  }
  return SUPPORTED_PROMPT_TARGETS.has(normalized) ? normalized : "";
}

function normalizeEnumValue(value, allowedValues, fieldName) {
  const normalized = String(value || "").trim();
  if (!allowedValues.has(normalized)) {
    throw badRequest(`Unsupported ${fieldName}: ${value}`, `unsupported_${fieldName}`);
  }
  return normalized;
}

function normalizeCommandTokens(value, fallback, fieldName) {
  if (!isNonEmptyString(value)) {
    return Array.isArray(fallback) ? fallback.slice() : [];
  }

  const tokens = tokenizeCommandString(value);
  if (tokens.length === 0) {
    throw badRequest(`${fieldName} must include at least one token.`, `invalid_${fieldName}`);
  }
  return tokens;
}

function tokenizeCommandString(value) {
  const input = String(value || "").trim();
  const tokens = [];
  let current = "";
  let quote = "";

  for (let index = 0; index < input.length; index += 1) {
    const character = input[index];

    if (quote) {
      if (character === quote) {
        quote = "";
      } else if (character === "\\" && index + 1 < input.length) {
        current += input[index + 1];
        index += 1;
      } else {
        current += character;
      }
      continue;
    }

    if (character === "'" || character === "\"") {
      quote = character;
      continue;
    }

    if (/\s/.test(character)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += character;
  }

  if (quote) {
    throw badRequest("Command string has an unmatched quote.", "invalid_command_string");
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function normalizeSuccessExitCodes(values) {
  const list =
    Array.isArray(values) && values.length > 0
      ? values
      : values === undefined || (Array.isArray(values) && values.length === 0)
        ? [0]
        : [values];
  const normalized = list.map((value) => Number(value));

  if (normalized.length === 0 || !normalized.every((value) => Number.isInteger(value))) {
    throw badRequest("successExitCodes must use integer values.", "invalid_success_exit_codes");
  }

  return Array.from(new Set(normalized));
}

function normalizeOptionalPositiveInteger(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return undefined;
  }

  const number = Number(value);
  if (!Number.isInteger(number) || number <= 0) {
    throw badRequest(`${fieldName} must be a positive integer.`, `invalid_${fieldName}`);
  }

  return number;
}

function normalizeRelativeFileName(value, fallback, fieldName) {
  const target = isNonEmptyString(value) ? String(value).trim() : fallback;
  if (!target || path.isAbsolute(target) || target.includes("\\") || target.includes("/")) {
    throw badRequest(`${fieldName} must be a task-local file name.`, `invalid_${fieldName}`);
  }
  return target;
}

function normalizeStringList(values) {
  const list = Array.isArray(values) ? values : values === undefined ? [] : [values];
  return Array.from(
    new Set(
      list
        .map((value) => String(value || "").trim())
        .filter(Boolean)
    )
  );
}

function normalizeNotes(values, adapterId) {
  const normalized = normalizeStringList(values);
  if (normalized.length > 0) {
    return normalized;
  }

  return [
    `This adapter was generated locally for ${adapterId}.`,
    "Review runnerCommand, argvTemplate, and stdio settings before switching commandMode to exec.",
  ];
}

function updateProjectConfigAdapters(workspaceRoot, adapterId) {
  const config = readJson(projectConfigPath(workspaceRoot), null);
  if (!config || typeof config !== "object") {
    return;
  }

  const adapters = Array.isArray(config.adapters) ? config.adapters.slice() : [];
  if (!adapters.includes(adapterId)) {
    adapters.push(adapterId);
    config.adapters = adapters;
    writeJson(projectConfigPath(workspaceRoot), config);
  }
}

function toDisplayName(adapterId) {
  return String(adapterId || "")
    .split(/[.-]/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

module.exports = {
  BUILTIN_ADAPTERS,
  createAdapter,
  getAdapter,
  listAdapters,
  normalizeAdapterId,
  normalizePromptTarget,
  resolvePromptTargetForAdapter,
  tokenizeCommandString,
};
