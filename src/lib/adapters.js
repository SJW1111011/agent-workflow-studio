const path = require("path");
const { fileExists, readJson } = require("./fs-utils");
const { adaptersRoot } = require("./workspace");

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

function listAdapters(workspaceRoot) {
  return BUILTIN_ADAPTERS.map((adapter) => {
    const adapterPath = path.join(adaptersRoot(workspaceRoot), adapter.fileName);
    const config = readJson(adapterPath, null);

    return {
      adapterId: adapter.adapterId,
      displayName: adapter.displayName,
      exists: fileExists(adapterPath),
      config,
      adapterPath,
    };
  });
}

function getAdapter(workspaceRoot, adapterId) {
  const match = listAdapters(workspaceRoot).find((adapter) => adapter.adapterId === normalizeAdapterId(adapterId));
  if (!match || !match.exists || !match.config) {
    throw new Error(`Adapter ${adapterId} is not configured yet.`);
  }
  return match.config;
}

function normalizeAdapterId(input) {
  if (input === "claude") {
    return "claude-code";
  }
  return input || "codex";
}

module.exports = {
  getAdapter,
  listAdapters,
  normalizeAdapterId,
};
