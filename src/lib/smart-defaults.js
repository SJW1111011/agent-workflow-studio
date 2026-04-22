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
  const inferred = inferAllTestResultsResult(workspaceRoot, options);
  const firstResult = inferred.results[0] || null;

  return {
    collectorId: firstResult ? firstResult.collectorId : null,
    result: firstResult
      ? {
          status: firstResult.status,
          check: firstResult.check,
        }
      : null,
    messages: inferred.messages,
    durationMs: firstResult ? firstResult.durationMs : 0,
  };
}

function inferAllTestResults(workspaceRoot, options = {}) {
  return inferAllTestResultsResult(workspaceRoot, options).results;
}

function inferAllTestResultsResult(workspaceRoot, options = {}) {
  const registry = resolveCollectorRegistry(workspaceRoot, options);
  const results = [];
  const messages = [];
  let fallbackMessage = "";

  registry.collectors.forEach((collector) => {
    const detection = detectCollector(collector, workspaceRoot);
    if (!detection.matched) {
      if (!fallbackMessage && detection.message) {
        fallbackMessage = detection.message;
      }
      return;
    }

    const execution = executeCollector(collector, workspaceRoot, options);
    messages.push(...execution.messages);
    if (execution.result) {
      results.push({
        collectorId: collector.id,
        status: execution.result.status,
        check: execution.result.check,
        durationMs: execution.durationMs,
      });
    }
  });

  if (results.length === 0 && messages.length === 0) {
    messages.push(
      fallbackMessage ||
        "Info: no matching evidence collector was detected, so inferred test status was skipped."
    );
  }

  return {
    results,
    messages,
  };
}

function resolveCollectorRegistry(workspaceRoot, options = {}) {
  if (options.collectorRegistry && Array.isArray(options.collectorRegistry.collectors)) {
    return {
      collectors: options.collectorRegistry.collectors.slice().sort(compareCollectors),
    };
  }

  if (Array.isArray(options.collectors)) {
    return {
      collectors: options.collectors.slice().sort(compareCollectors),
    };
  }

  return createCollectorRegistry(workspaceRoot);
}

function detectCollector(collector, workspaceRoot) {
  try {
    if (collector.detect(workspaceRoot) === true) {
      return {
        matched: true,
        message: "",
      };
    }
  } catch (error) {
    return {
      matched: false,
      message: `Warning: ${collector.id || "collector"} detection failed, so inferred test status was skipped.`,
    };
  }

  return {
    matched: false,
    message:
      typeof collector.missMessage === "function"
        ? normalizeMessage(collector.missMessage(workspaceRoot))
        : "",
  };
}

function executeCollector(collector, workspaceRoot, options = {}) {
  try {
    const result = collector.execute(workspaceRoot, options) || {};
    const status = normalizeCollectorStatus(result.status);

    return {
      result: status
        ? {
            status,
            check: normalizeCollectorCheck(result.check, collector.name || collector.id || "test collector"),
          }
        : null,
      messages: normalizeMessages(result.messages),
      durationMs: normalizeDuration(result.durationMs),
    };
  } catch (error) {
    return {
      result: null,
      messages: [
        `Warning: ${collector.id || "collector"} execution failed unexpectedly, so inferred test status was skipped.`,
      ],
      durationMs: 0,
    };
  }
}

function compareCollectors(left, right) {
  const leftPriority = Number.isInteger(left && left.priority) ? left.priority : Number.MAX_SAFE_INTEGER;
  const rightPriority = Number.isInteger(right && right.priority) ? right.priority : Number.MAX_SAFE_INTEGER;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return String(left && left.id ? left.id : "").localeCompare(String(right && right.id ? right.id : ""));
}

function normalizeCollectorStatus(value) {
  return value === "passed" || value === "failed" ? value : "";
}

function normalizeCollectorCheck(value, fallback) {
  return isNonEmptyString(value) ? value.trim() : fallback;
}

function normalizeDuration(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function normalizeMessages(messages) {
  return (Array.isArray(messages) ? messages : []).map((entry) => normalizeMessage(entry)).filter(Boolean);
}

function normalizeMessage(value) {
  return isNonEmptyString(value) ? value.trim() : "";
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

module.exports = {
  TEST_DURATION_WARNING_MS,
  inferAllTestResults,
  inferAllTestResultsResult,
  inferProofPaths,
  inferProofPathsResult,
  inferTestStatus,
  inferTestStatusResult,
};
