const fs = require("fs");
const os = require("os");
const path = require("path");
const { isDeepStrictEqual } = require("util");

const { ensureDir, fileExists } = require("./fs-utils");

const MCP_SERVER_NAME = "agent-workflow";

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
        },
      ];
    },
    installTarget(workspaceRoot, environment) {
      return {
        clientId: "claude",
        displayName: "Claude Code",
        configPath: path.join(environment.homeDir, ".claude", "settings.json"),
        createIfMissing: true,
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
        },
      ];
    },
    installTarget(workspaceRoot) {
      return {
        clientId: "cursor",
        displayName: "Cursor",
        configPath: path.join(workspaceRoot, ".cursor", "mcp.json"),
        createIfMissing: true,
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
        "No supported MCP client config files were detected. Pass --client claude or --client cursor to create one explicitly.",
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
    throw new Error("Usage: [--client claude|cursor] [--root path]");
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
  const tempPath = path.join(
    path.dirname(filePath),
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`
  );

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
