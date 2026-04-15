const fs = require("fs");
const os = require("os");
const path = require("path");
const { isDeepStrictEqual } = require("util");

const { ensureDir, fileExists } = require("./fs-utils");

const MCP_SERVER_NAME = "agent-workflow";
const MCP_SERVER_TABLE = "mcp_servers";

const CLIENT_SPECS = [
  {
    id: "claude",
    displayName: "Claude Code",
    aliases: ["claude", "claude-code"],
    detectTargets(workspaceRoot, environment) {
      return [
        {
          clientId: "claude",
          displayName: "Claude Code",
          configPath: path.join(environment.homeDir, ".claude", "settings.json"),
          createIfMissing: false,
          configFormat: "json",
        },
      ];
    },
    installTarget(workspaceRoot, environment) {
      return {
        clientId: "claude",
        displayName: "Claude Code",
        configPath: path.join(environment.homeDir, ".claude", "settings.json"),
        createIfMissing: true,
        configFormat: "json",
      };
    },
  },
  {
    id: "cursor",
    displayName: "Cursor",
    aliases: ["cursor"],
    detectTargets(workspaceRoot) {
      return [
        {
          clientId: "cursor",
          displayName: "Cursor",
          configPath: path.join(workspaceRoot, ".cursor", "mcp.json"),
          createIfMissing: false,
          configFormat: "json",
        },
      ];
    },
    installTarget(workspaceRoot) {
      return {
        clientId: "cursor",
        displayName: "Cursor",
        configPath: path.join(workspaceRoot, ".cursor", "mcp.json"),
        createIfMissing: true,
        configFormat: "json",
      };
    },
  },
  {
    id: "codex",
    displayName: "Codex",
    aliases: ["codex"],
    detectTargets(workspaceRoot, environment) {
      return [
        {
          clientId: "codex",
          displayName: "Codex",
          configPath: path.join(environment.homeDir, ".codex", "config.toml"),
          createIfMissing: false,
          configFormat: "toml",
        },
      ];
    },
    installTarget(workspaceRoot, environment) {
      return {
        clientId: "codex",
        displayName: "Codex",
        configPath: path.join(environment.homeDir, ".codex", "config.toml"),
        createIfMissing: true,
        configFormat: "toml",
      };
    },
  },
];

function installMcpServer(workspaceRoot, options = {}) {
  return mutateMcpConfig("install", workspaceRoot, options);
}

function uninstallMcpServer(workspaceRoot, options = {}) {
  return mutateMcpConfig("uninstall", workspaceRoot, options);
}

function mutateMcpConfig(action, workspaceRoot, options = {}) {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const environment = buildEnvironment(options);
  const requestedClients = normalizeRequestedClientIds(options.client);
  const targets = requestedClients
    ? requestedClients.map((clientId) => resolveInstallTarget(clientId, resolvedWorkspaceRoot, environment))
    : detectMcpClientTargets(resolvedWorkspaceRoot, environment);

  if (targets.length === 0) {
    return {
      ok: false,
      action,
      workspaceRoot: resolvedWorkspaceRoot,
      requestedClients: [],
      results: [],
      message:
        "No supported MCP client config files were detected. Pass --client claude, --client cursor, or --client codex to create one explicitly.",
    };
  }

  const desiredEntry = action === "install" ? buildMcpServerEntry(resolvedWorkspaceRoot, environment) : null;
  const results = targets.map((target) => {
    try {
      return action === "install" ? installIntoTarget(target, desiredEntry) : uninstallFromTarget(target);
    } catch (error) {
      return {
        ...target,
        status: "error",
        message: error.message,
      };
    }
  });

  const successfulStatuses = new Set(action === "install" ? ["created", "updated", "unchanged"] : ["removed", "unchanged"]);

  return {
    ok: results.length > 0 && results.every((item) => successfulStatuses.has(item.status)),
    action,
    workspaceRoot: resolvedWorkspaceRoot,
    requestedClients: requestedClients || targets.map((target) => target.clientId),
    results,
    message: null,
  };
}

function installIntoTarget(target, desiredEntry) {
  if (target.configFormat === "toml") {
    return installIntoTomlTarget(target, desiredEntry);
  }

  return installIntoJsonTarget(target, desiredEntry);
}

function installIntoJsonTarget(target, desiredEntry) {
  const loaded = readJsonConfig(target.configPath, {
    createIfMissing: target.createIfMissing,
  });
  const nextConfig = cloneJsonObject(loaded.config);
  const mcpServers = normalizeObject(nextConfig.mcpServers, `${target.displayName} mcpServers`);
  const existingEntry = Object.prototype.hasOwnProperty.call(mcpServers, MCP_SERVER_NAME)
    ? mcpServers[MCP_SERVER_NAME]
    : undefined;

  if (existingEntry !== undefined) {
    if (isDeepStrictEqual(existingEntry, desiredEntry)) {
      return {
        ...target,
        status: "unchanged",
        message: `${target.displayName} already has the expected ${MCP_SERVER_NAME} MCP server entry.`,
      };
    }

    return {
      ...target,
      status: "conflict",
      message: `${target.displayName} already has an ${MCP_SERVER_NAME} MCP server entry. Left it unchanged.`,
    };
  }

  nextConfig.mcpServers = {
    ...mcpServers,
    [MCP_SERVER_NAME]: desiredEntry,
  };

  writeJsonConfig(target.configPath, nextConfig, loaded.newline);

  return {
    ...target,
    status: loaded.existed ? "updated" : "created",
    message: `${target.displayName} now includes the ${MCP_SERVER_NAME} MCP server entry.`,
  };
}

function uninstallFromTarget(target) {
  if (target.configFormat === "toml") {
    return uninstallFromTomlTarget(target);
  }

  return uninstallFromJsonTarget(target);
}

function uninstallFromJsonTarget(target) {
  const loaded = readJsonConfig(target.configPath, {
    createIfMissing: false,
  });

  if (!loaded.existed) {
    return {
      ...target,
      status: "missing",
      message: `${target.displayName} config file was not found.`,
    };
  }

  const nextConfig = cloneJsonObject(loaded.config);
  const mcpServers = normalizeObject(nextConfig.mcpServers, `${target.displayName} mcpServers`);

  if (!Object.prototype.hasOwnProperty.call(mcpServers, MCP_SERVER_NAME)) {
    return {
      ...target,
      status: "unchanged",
      message: `${target.displayName} does not currently define the ${MCP_SERVER_NAME} MCP server entry.`,
    };
  }

  delete mcpServers[MCP_SERVER_NAME];

  if (Object.keys(mcpServers).length === 0) {
    delete nextConfig.mcpServers;
  } else {
    nextConfig.mcpServers = mcpServers;
  }

  writeJsonConfig(target.configPath, nextConfig, loaded.newline);

  return {
    ...target,
    status: "removed",
    message: `${target.displayName} no longer includes the ${MCP_SERVER_NAME} MCP server entry.`,
  };
}

function installIntoTomlTarget(target, desiredEntry) {
  const loaded = readTextConfig(target.configPath, {
    createIfMissing: target.createIfMissing,
  });
  const existingEntry = readTomlMcpServerEntry(loaded.content, MCP_SERVER_NAME);
  const normalizedDesiredEntry = normalizeTomlMcpServerEntry(desiredEntry);

  if (existingEntry) {
    if (!existingEntry.hasUnknownContent && isDeepStrictEqual(existingEntry.entry, normalizedDesiredEntry)) {
      return {
        ...target,
        status: "unchanged",
        message: `${target.displayName} already has the expected ${MCP_SERVER_NAME} MCP server entry.`,
      };
    }

    return {
      ...target,
      status: "conflict",
      message: `${target.displayName} already has an ${MCP_SERVER_NAME} MCP server entry. Left it unchanged.`,
    };
  }

  const nextContent = appendTomlMcpServerEntry(loaded.content, normalizedDesiredEntry, loaded.newline);
  writeTextConfig(target.configPath, nextContent);

  return {
    ...target,
    status: loaded.existed ? "updated" : "created",
    message: `${target.displayName} now includes the ${MCP_SERVER_NAME} MCP server entry.`,
  };
}

function uninstallFromTomlTarget(target) {
  const loaded = readTextConfig(target.configPath, {
    createIfMissing: false,
  });

  if (!loaded.existed) {
    return {
      ...target,
      status: "missing",
      message: `${target.displayName} config file was not found.`,
    };
  }

  const existingEntry = readTomlMcpServerEntry(loaded.content, MCP_SERVER_NAME);

  if (!existingEntry) {
    return {
      ...target,
      status: "unchanged",
      message: `${target.displayName} does not currently define the ${MCP_SERVER_NAME} MCP server entry.`,
    };
  }

  const nextContent = removeTomlMcpServerEntry(loaded.content, existingEntry.sections);
  writeTextConfig(target.configPath, nextContent);

  return {
    ...target,
    status: "removed",
    message: `${target.displayName} no longer includes the ${MCP_SERVER_NAME} MCP server entry.`,
  };
}

function detectMcpClientTargets(workspaceRoot, options = {}) {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const environment = buildEnvironment(options);
  const targets = [];

  CLIENT_SPECS.forEach((spec) => {
    const detected = spec
      .detectTargets(resolvedWorkspaceRoot, environment)
      .find((candidate) => fileExists(candidate.configPath));

    if (detected) {
      targets.push(detected);
    }
  });

  return targets;
}

function resolveInstallTarget(clientId, workspaceRoot, environment) {
  const spec = getClientSpec(clientId);
  return spec.installTarget(workspaceRoot, environment);
}

function buildMcpServerEntry(workspaceRoot, options = {}) {
  const resolvedWorkspaceRoot = path.resolve(workspaceRoot);
  const environment = buildEnvironment(options);
  const launchStrategy = resolveLaunchStrategy(environment);

  if (launchStrategy.kind === "npx") {
    return {
      command: "npx",
      args: ["agent-workflow-mcp", "--root", resolvedWorkspaceRoot],
      cwd: launchStrategy.cwd,
      env: {},
    };
  }

  return {
    command: environment.execPath,
    args: [launchStrategy.serverPath, "--root", resolvedWorkspaceRoot],
    env: {},
  };
}

function resolveLaunchStrategy(environment) {
  const npxCwd = findNpxInstallRoot(environment.packageRoot, environment.platform);
  if (npxCwd) {
    return {
      kind: "npx",
      cwd: npxCwd,
    };
  }

  return {
    kind: "node",
    serverPath: path.join(environment.packageRoot, "src", "mcp-server.js"),
  };
}

function findNpxInstallRoot(packageRoot, platform) {
  let current = path.resolve(packageRoot);

  for (;;) {
    if (hasLocalBin(current, "agent-workflow-mcp", platform)) {
      return current;
    }

    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }

    current = parent;
  }
}

function hasLocalBin(rootPath, binaryName, platform) {
  return getLocalBinCandidates(rootPath, binaryName, platform).some((candidatePath) => fileExists(candidatePath));
}

function getLocalBinCandidates(rootPath, binaryName, platform) {
  const binRoot = path.join(rootPath, "node_modules", ".bin");
  if (platform === "win32") {
    return [
      path.join(binRoot, `${binaryName}.cmd`),
      path.join(binRoot, `${binaryName}.ps1`),
      path.join(binRoot, binaryName),
    ];
  }

  return [path.join(binRoot, binaryName)];
}

function normalizeRequestedClientIds(value) {
  if (value === undefined) {
    return null;
  }

  if (value === true) {
    throw new Error("Usage: [--client claude|cursor|codex] [--root path]");
  }

  const seen = new Set();

  return toArray(value)
    .flatMap((item) => String(item).split(","))
    .map((item) => normalizeMcpClientId(item))
    .filter((item) => {
      if (seen.has(item)) {
        return false;
      }
      seen.add(item);
      return true;
    });
}

function normalizeMcpClientId(value) {
  const token = String(value || "").trim().toLowerCase();
  const spec = CLIENT_SPECS.find((item) => item.aliases.includes(token));
  if (!spec) {
    throw new Error(`Unsupported MCP client: ${value}`);
  }
  return spec.id;
}

function getClientSpec(clientId) {
  const normalized = normalizeMcpClientId(clientId);
  const spec = CLIENT_SPECS.find((item) => item.id === normalized);
  if (!spec) {
    throw new Error(`Unsupported MCP client: ${clientId}`);
  }
  return spec;
}

function formatMcpConfigSummary(result) {
  const lines = [];
  lines.push(`MCP ${result.action} summary:`);

  if (result.message) {
    lines.push(result.message);
  }

  result.results.forEach((item) => {
    lines.push(`- ${item.displayName}: ${item.status} (${item.configPath})`);
    lines.push(`  ${item.message}`);
  });

  return lines.join("\n");
}

function readJsonConfig(filePath, options = {}) {
  const existed = fileExists(filePath);
  if (!existed) {
    if (!options.createIfMissing) {
      return {
        config: {},
        existed: false,
        newline: os.EOL,
      };
    }

    ensureDir(path.dirname(filePath));
    return {
      config: {},
      existed: false,
      newline: os.EOL,
    };
  }

  const raw = fs.readFileSync(filePath, "utf8");
  const newline = raw.includes("\r\n") ? "\r\n" : "\n";

  if (!raw.trim()) {
    return {
      config: {},
      existed: true,
      newline,
    };
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error(`Could not parse JSON config at ${filePath}: ${error.message}`);
  }

  return {
    config: normalizeObject(parsed, `top-level JSON object in ${filePath}`),
    existed: true,
    newline,
  };
}

function writeJsonConfig(filePath, value, newline = "\n") {
  ensureDir(path.dirname(filePath));
  const nextContent = `${JSON.stringify(value, null, 2)}${newline}`;
  writeTextConfig(filePath, nextContent);
}

function readTextConfig(filePath, options = {}) {
  const existed = fileExists(filePath);

  if (!existed) {
    if (options.createIfMissing) {
      ensureDir(path.dirname(filePath));
    }

    return {
      content: "",
      existed: false,
      newline: os.EOL,
    };
  }

  const raw = fs.readFileSync(filePath, "utf8");
  return {
    content: raw,
    existed: true,
    newline: raw.includes("\r\n") ? "\r\n" : "\n",
  };
}

function writeTextConfig(filePath, nextContent) {
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );

  ensureDir(path.dirname(filePath));
  fs.writeFileSync(tempPath, nextContent, "utf8");

  try {
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    if (fileExists(filePath)) {
      fs.rmSync(filePath, { force: true });
      fs.renameSync(tempPath, filePath);
      return;
    }

    throw error;
  }
}

function readTomlMcpServerEntry(content, serverName) {
  const sections = parseTomlSections(content);
  const sectionName = `${MCP_SERVER_TABLE}.${serverName}`;
  const relevantSections = sections.filter((section) => {
    return section.name === sectionName || section.name.startsWith(`${sectionName}.`);
  });

  if (relevantSections.length === 0) {
    return null;
  }

  const entry = {};
  let hasUnknownContent = false;

  relevantSections.forEach((section) => {
    const childPath = section.name === sectionName ? "" : section.name.slice(sectionName.length + 1);

    if (!childPath) {
      const parsed = parseTomlMcpEntryBody(section.lines.slice(1));
      Object.assign(entry, parsed.entry);
      hasUnknownContent = hasUnknownContent || parsed.hasUnknownContent;
      return;
    }

    if (childPath === "env") {
      const parsed = parseTomlStringMapBody(section.lines.slice(1));
      entry.env = parsed.value;
      hasUnknownContent = hasUnknownContent || parsed.hasUnknownContent;
      return;
    }

    hasUnknownContent = true;
  });

  return {
    entry: normalizeTomlMcpServerEntry(entry),
    hasUnknownContent,
    sections: relevantSections,
  };
}

function parseTomlSections(content) {
  const lines = splitTextIntoLines(content);
  const sections = [];

  lines.forEach((line, index) => {
    const name = parseTomlSectionHeader(line);
    if (name) {
      sections.push({
        name,
        startLine: index,
      });
    }
  });

  return sections.map((section, index) => {
    const endLine = index + 1 < sections.length ? sections[index + 1].startLine : lines.length;
    return {
      ...section,
      endLine,
      lines: lines.slice(section.startLine, endLine),
    };
  });
}

function splitTextIntoLines(content) {
  if (!content) {
    return [];
  }

  return (content.match(/[^\r\n]*(?:\r\n|\n|$)/g) || []).filter((line) => line.length > 0);
}

function parseTomlSectionHeader(line) {
  const normalizedLine = stripLineEnding(line).replace(/^\uFEFF/, "");
  const match = normalizedLine.match(/^\s*\[([A-Za-z0-9_.-]+)\]\s*(?:#.*)?$/);
  return match ? match[1] : null;
}

function parseTomlMcpEntryBody(lines) {
  const entry = {};
  let hasUnknownContent = false;

  lines.forEach((line) => {
    const parsedLine = parseTomlKeyValueLine(line);
    if (!parsedLine) {
      return;
    }

    if (parsedLine.key === "command" || parsedLine.key === "cwd") {
      const value = parseTomlString(parsedLine.value);
      if (value === undefined) {
        hasUnknownContent = true;
        return;
      }
      entry[parsedLine.key] = value;
      return;
    }

    if (parsedLine.key === "args") {
      const value = parseTomlStringArray(parsedLine.value);
      if (value === undefined) {
        hasUnknownContent = true;
        return;
      }
      entry.args = value;
      return;
    }

    if (parsedLine.key === "env") {
      const value = parseTomlInlineStringMap(parsedLine.value);
      if (value === undefined) {
        hasUnknownContent = true;
        return;
      }
      entry.env = value;
      return;
    }

    hasUnknownContent = true;
  });

  return {
    entry,
    hasUnknownContent,
  };
}

function parseTomlStringMapBody(lines) {
  const value = {};
  let hasUnknownContent = false;

  lines.forEach((line) => {
    const parsedLine = parseTomlKeyValueLine(line, {
      allowQuotedKeys: true,
    });
    if (!parsedLine) {
      return;
    }

    const parsedValue = parseTomlString(parsedLine.value);
    if (parsedValue === undefined) {
      hasUnknownContent = true;
      return;
    }

    value[parsedLine.key] = parsedValue;
  });

  return {
    value,
    hasUnknownContent,
  };
}

function parseTomlKeyValueLine(line, options = {}) {
  const withoutLineEnding = stripLineEnding(line);
  const withoutComment = stripTomlComment(withoutLineEnding).trim();

  if (!withoutComment) {
    return null;
  }

  const keyPattern = options.allowQuotedKeys
    ? /^(?:"((?:[^"\\]|\\.)+)"|'([^']+)'|([A-Za-z0-9_-]+))\s*=\s*(.+)$/
    : /^([A-Za-z0-9_-]+)\s*=\s*(.+)$/;
  const match = withoutComment.match(keyPattern);

  if (!match) {
    return {
      key: null,
      value: null,
      invalid: true,
    };
  }

  return {
    key: match[1] || match[2] || match[3],
    value: match[4] || match[2],
    invalid: false,
  };
}

function stripTomlComment(line) {
  let quote = null;
  let escaped = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];

    if (quote === "\"") {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === "\\") {
        escaped = true;
        continue;
      }
      if (char === "\"") {
        quote = null;
      }
      continue;
    }

    if (quote === "'") {
      if (char === "'") {
        quote = null;
      }
      continue;
    }

    if (char === "\"" || char === "'") {
      quote = char;
      continue;
    }

    if (char === "#") {
      return line.slice(0, index);
    }
  }

  return line;
}

function parseTomlString(value) {
  const trimmed = String(value || "").trim();

  if (trimmed.length < 2) {
    return undefined;
  }

  if (trimmed.startsWith("\"") && trimmed.endsWith("\"")) {
    try {
      return JSON.parse(trimmed);
    } catch (error) {
      return undefined;
    }
  }

  if (trimmed.startsWith("'") && trimmed.endsWith("'")) {
    return trimmed.slice(1, -1);
  }

  return undefined;
}

function parseTomlStringArray(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed.startsWith("[") || !trimmed.endsWith("]")) {
    return undefined;
  }

  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return [];
  }

  const items = [];
  let index = 0;

  while (index < inner.length) {
    while (index < inner.length && /[\s,]/.test(inner[index])) {
      index += 1;
    }

    if (index >= inner.length) {
      break;
    }

    const token = readTomlStringToken(inner, index);
    if (!token) {
      return undefined;
    }

    items.push(token.value);
    index = token.nextIndex;

    while (index < inner.length && /\s/.test(inner[index])) {
      index += 1;
    }

    if (index >= inner.length) {
      break;
    }

    if (inner[index] !== ",") {
      return undefined;
    }

    index += 1;
  }

  return items;
}

function parseTomlInlineStringMap(value) {
  const trimmed = String(value || "").trim();

  if (!trimmed.startsWith("{") || !trimmed.endsWith("}")) {
    return undefined;
  }

  const inner = trimmed.slice(1, -1).trim();
  if (!inner) {
    return {};
  }

  const result = {};
  let index = 0;

  while (index < inner.length) {
    while (index < inner.length && /[\s,]/.test(inner[index])) {
      index += 1;
    }

    if (index >= inner.length) {
      break;
    }

    const keyToken = readTomlKeyToken(inner, index);
    if (!keyToken) {
      return undefined;
    }

    index = keyToken.nextIndex;

    while (index < inner.length && /\s/.test(inner[index])) {
      index += 1;
    }

    if (inner[index] !== "=") {
      return undefined;
    }
    index += 1;

    while (index < inner.length && /\s/.test(inner[index])) {
      index += 1;
    }

    const valueToken = readTomlStringToken(inner, index);
    if (!valueToken) {
      return undefined;
    }

    result[keyToken.value] = valueToken.value;
    index = valueToken.nextIndex;

    while (index < inner.length && /\s/.test(inner[index])) {
      index += 1;
    }

    if (index < inner.length) {
      if (inner[index] !== ",") {
        return undefined;
      }
      index += 1;
    }
  }

  return result;
}

function readTomlKeyToken(text, startIndex) {
  const char = text[startIndex];

  if (char === "\"" || char === "'") {
    return readTomlStringToken(text, startIndex);
  }

  let index = startIndex;
  while (index < text.length && /[A-Za-z0-9_-]/.test(text[index])) {
    index += 1;
  }

  if (index === startIndex) {
    return null;
  }

  return {
    value: text.slice(startIndex, index),
    nextIndex: index,
  };
}

function readTomlStringToken(text, startIndex) {
  const quote = text[startIndex];
  if (quote !== "\"" && quote !== "'") {
    return null;
  }

  let index = startIndex + 1;
  let escaped = false;

  while (index < text.length) {
    const char = text[index];

    if (quote === "\"") {
      if (escaped) {
        escaped = false;
        index += 1;
        continue;
      }

      if (char === "\\") {
        escaped = true;
        index += 1;
        continue;
      }
    }

    if (char === quote) {
      const token = text.slice(startIndex, index + 1);
      const value = parseTomlString(token);
      if (value === undefined) {
        return null;
      }

      return {
        value,
        nextIndex: index + 1,
      };
    }

    index += 1;
  }

  return null;
}

function normalizeTomlMcpServerEntry(entry) {
  const normalized = {};

  if (entry && typeof entry.command === "string" && entry.command) {
    normalized.command = entry.command;
  }

  if (entry && Array.isArray(entry.args)) {
    normalized.args = entry.args.slice();
  }

  if (entry && typeof entry.cwd === "string" && entry.cwd) {
    normalized.cwd = entry.cwd;
  }

  const env = normalizeTomlStringMap(entry && entry.env);
  if (env) {
    normalized.env = env;
  }

  return normalized;
}

function normalizeTomlStringMap(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const entries = Object.entries(value).filter(([key, entryValue]) => {
    return key && typeof entryValue === "string";
  });

  if (entries.length === 0) {
    return null;
  }

  return Object.fromEntries(entries);
}

function appendTomlMcpServerEntry(content, entry, newline) {
  const sectionContent = renderTomlMcpServerEntry(entry, newline);
  if (!content) {
    return sectionContent;
  }

  let nextContent = content;
  if (!nextContent.endsWith("\n") && !nextContent.endsWith("\r\n")) {
    nextContent += newline;
  }

  if (nextContent.trim() && !nextContent.endsWith(`${newline}${newline}`)) {
    nextContent += newline;
  }

  return `${nextContent}${sectionContent}`;
}

function renderTomlMcpServerEntry(entry, newline) {
  const lines = [
    `[${MCP_SERVER_TABLE}.${MCP_SERVER_NAME}]`,
    `command = ${formatTomlString(entry.command)}`,
  ];

  if (Array.isArray(entry.args)) {
    lines.push(`args = ${formatTomlStringArray(entry.args)}`);
  }

  if (entry.cwd) {
    lines.push(`cwd = ${formatTomlString(entry.cwd)}`);
  }

  if (entry.env) {
    lines.push("");
    lines.push(`[${MCP_SERVER_TABLE}.${MCP_SERVER_NAME}.env]`);
    Object.entries(entry.env).forEach(([key, value]) => {
      lines.push(`${formatTomlKey(key)} = ${formatTomlString(value)}`);
    });
  }

  return `${lines.join(newline)}${newline}`;
}

function removeTomlMcpServerEntry(content, sections) {
  const lines = splitTextIntoLines(content);
  if (lines.length === 0 || !Array.isArray(sections) || sections.length === 0) {
    return content;
  }

  const ranges = sections
    .slice()
    .sort((left, right) => left.startLine - right.startLine)
    .map((section) => {
      let startLine = section.startLine;
      let endLine = section.endLine;

      if (startLine > 0 && !stripLineEnding(lines[startLine - 1]).trim()) {
        startLine -= 1;
      }

      while (endLine < lines.length && !stripLineEnding(lines[endLine]).trim()) {
        endLine += 1;
      }

      return {
        startLine,
        endLine,
      };
    });

  const mergedRanges = [];
  ranges.forEach((range) => {
    const previousRange = mergedRanges[mergedRanges.length - 1];

    if (previousRange && range.startLine <= previousRange.endLine) {
      previousRange.endLine = Math.max(previousRange.endLine, range.endLine);
      return;
    }

    mergedRanges.push({ ...range });
  });

  const keptLines = [];
  let cursor = 0;

  mergedRanges.forEach((range) => {
    keptLines.push(...lines.slice(cursor, range.startLine));
    cursor = range.endLine;
  });

  keptLines.push(...lines.slice(cursor));

  return keptLines.join("");
}

function formatTomlString(value) {
  return JSON.stringify(String(value));
}

function formatTomlStringArray(value) {
  return `[${value.map((item) => formatTomlString(item)).join(", ")}]`;
}

function formatTomlKey(value) {
  return /^[A-Za-z0-9_-]+$/.test(value) ? value : formatTomlString(value);
}

function stripLineEnding(value) {
  return String(value).replace(/\r?\n$/, "");
}

function normalizeObject(value, label) {
  if (value === undefined) {
    return {};
  }

  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`Expected ${label} to be a JSON object.`);
  }

  return value;
}

function cloneJsonObject(value) {
  return JSON.parse(JSON.stringify(normalizeObject(value, "JSON config")));
}

function buildEnvironment(options = {}) {
  return {
    execPath: options.execPath || process.execPath,
    homeDir: path.resolve(options.homeDir || os.homedir()),
    packageRoot: path.resolve(options.packageRoot || path.join(__dirname, "..", "..")),
    platform: options.platform || process.platform,
  };
}

function toArray(value) {
  return Array.isArray(value) ? value : [value];
}

module.exports = {
  MCP_SERVER_NAME,
  buildMcpServerEntry,
  detectMcpClientTargets,
  formatMcpConfigSummary,
  installMcpServer,
  normalizeMcpClientId,
  uninstallMcpServer,
};
