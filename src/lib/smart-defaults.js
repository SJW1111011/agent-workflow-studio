const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { normalizeProofPaths } = require("./evidence-utils");
const { loadChangedFilePaths } = require("./repository-snapshot");

const TEST_DURATION_WARNING_MS = 30_000;

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
  const packageJsonPath = path.join(workspaceRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return {
      result: null,
      messages: ["Info: package.json is missing, so inferred test status was skipped."],
      durationMs: 0,
    };
  }

  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  } catch (error) {
    return {
      result: null,
      messages: ["Warning: package.json could not be parsed, so inferred test status was skipped."],
      durationMs: 0,
    };
  }

  if (!hasTestScript(packageJson)) {
    return {
      result: null,
      messages: ["Info: package.json has no test script, so inferred test status was skipped."],
      durationMs: 0,
    };
  }

  const testCommand = buildNpmTestInvocation(options);
  const startedAt = Date.now();

  try {
    execFileSync(testCommand.command, testCommand.args, {
      cwd: workspaceRoot,
      stdio: "ignore",
      windowsHide: true,
    });

    const durationMs = Date.now() - startedAt;
    return {
      result: {
        status: "passed",
        check: "npm test",
      },
      messages: buildTestDurationMessages(durationMs),
      durationMs,
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (!Number.isInteger(error && error.status)) {
      return {
        result: null,
        messages: [
          "Warning: npm test could not be launched, so inferred test status was skipped.",
        ].concat(buildTestDurationMessages(durationMs)),
        durationMs,
      };
    }

    return {
      result: {
        status: "failed",
        check: "npm test",
      },
      messages: buildTestDurationMessages(durationMs),
      durationMs,
    };
  }
}

function hasTestScript(packageJson) {
  return Boolean(
    packageJson &&
      packageJson.scripts &&
      typeof packageJson.scripts.test === "string" &&
      packageJson.scripts.test.trim()
  );
}

function buildTestDurationMessages(durationMs) {
  if (!(durationMs > TEST_DURATION_WARNING_MS)) {
    return [];
  }

  return [
    `Warning: npm test took ${durationMs} ms. Use --skip-test if you do not want inferred test execution.`,
  ];
}

function buildNpmTestInvocation(options = {}) {
  if (Array.isArray(options.testCommand) && options.testCommand.length > 0) {
    const [command, ...args] = options.testCommand.map((value) => String(value));
    return {
      command,
      args,
    };
  }

  if (typeof options.npmCommand === "string" && options.npmCommand.trim()) {
    return {
      command: options.npmCommand.trim(),
      args: ["test"],
    };
  }

  return process.platform === "win32"
    ? {
        command: "cmd.exe",
        args: ["/d", "/s", "/c", "npm test"],
      }
    : {
        command: "npm",
        args: ["test"],
      };
}

module.exports = {
  TEST_DURATION_WARNING_MS,
  inferProofPaths,
  inferProofPathsResult,
  inferTestStatus,
  inferTestStatusResult,
};
