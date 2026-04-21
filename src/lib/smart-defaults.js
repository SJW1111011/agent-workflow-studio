const { normalizeProofPaths } = require("./evidence-utils");
const { createCollectorRegistry, TEST_DURATION_WARNING_MS } = require("./evidence-collectors");
const { loadChangedFilePaths } = require("./repository-snapshot");

function inferProofPaths(workspaceRoot, options = {}) {
  return inferProofPathsResult(workspaceRoot, options).proofPaths;
}

function inferProofPathsResult(workspaceRoot, options = {}) {
  const proofPaths = loadChangedFilePaths(workspaceRoot, options);
  if (!proofPaths) {
    return {
      proofPaths: [],
      messages: ["Warning: git diff is unavailable here, so inferred proof paths were skipped."],
    };
  }

  return {
    proofPaths: normalizeProofPaths(proofPaths),
    messages: [],
  };
}

function inferTestStatus(workspaceRoot, options = {}) {
  return inferTestStatusResult(workspaceRoot, options).result;
}

function inferTestStatusResult(workspaceRoot, options = {}) {
  const registry = createCollectorRegistry(workspaceRoot);
  return registry.detectAndExecute(options);
}

module.exports = {
  TEST_DURATION_WARNING_MS,
  inferProofPaths,
  inferProofPathsResult,
  inferTestStatus,
  inferTestStatusResult,
};
