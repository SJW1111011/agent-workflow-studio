const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { readProjectConfig } = require("./workspace");

const TEST_DURATION_WARNING_MS = 30_000;
const CUSTOM_COLLECTOR_PRIORITY_BASE = 100;

function createCollectorRegistry(workspaceRoot, options = {}) {
  const projectConfig = options.projectConfig || readProjectConfig(workspaceRoot);
  const builtInCollectors = Array.isArray(options.builtInCollectors)
    ? options.builtInCollectors.slice()
    : createBuiltInCollectors();
  const customCollectors = Array.isArray(options.customCollectors)
    ? options.customCollectors.slice()
    : createCustomCollectors(projectConfig.evidenceCollectors || []);
  const collectors = builtInCollectors
    .concat(customCollectors)
    .filter((collector) => collector && typeof collector.detect === "function" && typeof collector.execute === "function")
    .sort(compareCollectors);

  return {
    collectors,
    detectAndExecute(runOptions = {}) {
      let fallbackMessage = "";

      for (const collector of collectors) {
        const detection = detectCollector(collector, workspaceRoot);
        if (!detection.matched) {
          if (!fallbackMessage && isNonEmptyString(detection.message)) {
            fallbackMessage = detection.message;
          }
          continue;
        }

        const execution = executeCollector(collector, workspaceRoot, runOptions);
        return {
          collectorId: collector.id,
          result:
            execution.status === "passed" || execution.status === "failed"
              ? {
                  status: execution.status,
                  check: execution.check,
                }
              : null,
          messages: execution.messages,
          durationMs: execution.durationMs,
        };
      }

      return {
        collectorId: null,
        result: null,
        messages: fallbackMessage
          ? [fallbackMessage]
          : ["Info: no matching evidence collector was detected, so inferred test status was skipped."],
        durationMs: 0,
      };
    },
  };
}

function createBuiltInCollectors() {
  return [
    createNpmTestCollector(),
    createPytestCollector(),
    createCargoTestCollector(),
    createGoTestCollector(),
  ];
}

function createNpmTestCollector() {
  return {
    id: "npm-test",
    name: "npm test",
    priority: 10,
    detect(workspaceRoot) {
      return inspectNpmWorkspace(workspaceRoot).matched;
    },
    missMessage(workspaceRoot) {
      return inspectNpmWorkspace(workspaceRoot).message;
    },
    execute(workspaceRoot, options = {}) {
      const invocation = buildNpmTestInvocation(options);
      return executeCollectorCommand(workspaceRoot, "npm test", invocation.command, invocation.args);
    },
  };
}

function createPytestCollector() {
  return {
    id: "pytest",
    name: "pytest",
    priority: 20,
    detect(workspaceRoot) {
      return hasPytestProject(workspaceRoot);
    },
    execute(workspaceRoot) {
      return executeCollectorCommand(
        workspaceRoot,
        "python -m pytest --tb=no -q",
        "python",
        ["-m", "pytest", "--tb=no", "-q"]
      );
    },
  };
}

function createCargoTestCollector() {
  return {
    id: "cargo-test",
    name: "cargo test",
    priority: 30,
    detect(workspaceRoot) {
      return fs.existsSync(path.join(workspaceRoot, "Cargo.toml"));
    },
    execute(workspaceRoot) {
      return executeCollectorCommand(workspaceRoot, "cargo test --no-fail-fast", "cargo", [
        "test",
        "--no-fail-fast",
      ]);
    },
  };
}

function createGoTestCollector() {
  return {
    id: "go-test",
    name: "go test",
    priority: 40,
    detect(workspaceRoot) {
      return fs.existsSync(path.join(workspaceRoot, "go.mod"));
    },
    execute(workspaceRoot) {
      return executeCollectorCommand(workspaceRoot, "go test ./...", "go", ["test", "./..."]);
    },
  };
}

function createCustomCollectors(configuredCollectors) {
  return (Array.isArray(configuredCollectors) ? configuredCollectors : [])
    .map((collector, index) => createCustomCollector(collector, index))
    .filter(Boolean);
}

function createCustomCollector(config, index = 0) {
  if (!config || typeof config !== "object") {
    return null;
  }

  const args = Array.isArray(config.args) ? config.args.slice() : [];
  const check = [config.command].concat(args).join(" ").trim() || config.id;

  return {
    id: config.id,
    name: config.id,
    priority: CUSTOM_COLLECTOR_PRIORITY_BASE + index,
    detect(workspaceRoot) {
      return fs.existsSync(path.join(workspaceRoot, config.detectFile));
    },
    execute(workspaceRoot) {
      return executeCollectorCommand(workspaceRoot, check, config.command, args);
    },
  };
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

function executeCollector(collector, workspaceRoot, runOptions) {
  try {
    const result = collector.execute(workspaceRoot, runOptions) || {};
    return {
      status: normalizeStatus(result.status),
      check: normalizeCheck(result.check, collector.name || collector.id || "test collector"),
      durationMs: normalizeDuration(result.durationMs),
      messages: normalizeMessages(result.messages),
    };
  } catch (error) {
    return {
      status: null,
      check: collector.name || collector.id || "test collector",
      durationMs: 0,
      messages: [
        `Warning: ${collector.id || "collector"} execution failed unexpectedly, so inferred test status was skipped.`,
      ],
    };
  }
}

function executeCollectorCommand(workspaceRoot, check, command, args) {
  const startedAt = Date.now();

  try {
    execFileSync(command, args, {
      cwd: workspaceRoot,
      stdio: "ignore",
      windowsHide: true,
    });

    const durationMs = Date.now() - startedAt;
    return {
      status: "passed",
      check,
      durationMs,
      messages: buildDurationMessages(check, durationMs),
    };
  } catch (error) {
    const durationMs = Date.now() - startedAt;
    if (!Number.isInteger(error && error.status)) {
      return {
        status: null,
        check,
        durationMs,
        messages: [
          `Warning: ${check} could not be launched, so inferred test status was skipped.`,
        ].concat(buildDurationMessages(check, durationMs)),
      };
    }

    return {
      status: "failed",
      check,
      durationMs,
      messages: buildDurationMessages(check, durationMs),
    };
  }
}

function inspectNpmWorkspace(workspaceRoot) {
  const packageJsonPath = path.join(workspaceRoot, "package.json");
  if (!fs.existsSync(packageJsonPath)) {
    return {
      matched: false,
      message: "Info: package.json is missing, so inferred test status was skipped.",
    };
  }

  let packageJson;
  try {
    packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf8"));
  } catch (error) {
    return {
      matched: false,
      message: "Warning: package.json could not be parsed, so inferred test status was skipped.",
    };
  }

  if (!hasTestScript(packageJson)) {
    return {
      matched: false,
      message: "Info: package.json has no test script, so inferred test status was skipped.",
    };
  }

  return {
    matched: true,
    message: "",
  };
}

function hasPytestProject(workspaceRoot) {
  return fileIncludes(path.join(workspaceRoot, "pyproject.toml"), /pytest/i) || fileIncludes(path.join(workspaceRoot, "setup.py"), /pytest/i);
}

function fileIncludes(filePath, pattern) {
  try {
    if (!fs.existsSync(filePath)) {
      return false;
    }
    return pattern.test(fs.readFileSync(filePath, "utf8"));
  } catch (error) {
    return false;
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

function buildDurationMessages(check, durationMs) {
  if (!(durationMs > TEST_DURATION_WARNING_MS)) {
    return [];
  }

  return [
    `Warning: ${check} took ${durationMs} ms. Use --skip-test if you do not want inferred test execution.`,
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

function compareCollectors(left, right) {
  const leftPriority = Number.isInteger(left && left.priority) ? left.priority : Number.MAX_SAFE_INTEGER;
  const rightPriority = Number.isInteger(right && right.priority) ? right.priority : Number.MAX_SAFE_INTEGER;
  if (leftPriority !== rightPriority) {
    return leftPriority - rightPriority;
  }

  return String(left && left.id ? left.id : "").localeCompare(String(right && right.id ? right.id : ""));
}

function normalizeStatus(value) {
  return value === "passed" || value === "failed" ? value : null;
}

function normalizeCheck(value, fallback) {
  return isNonEmptyString(value) ? value.trim() : fallback;
}

function normalizeDuration(value) {
  return Number.isInteger(value) && value >= 0 ? value : 0;
}

function normalizeMessages(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map((entry) => normalizeMessage(entry))
    .filter(Boolean);
}

function normalizeMessage(value) {
  return isNonEmptyString(value) ? value.trim() : "";
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

module.exports = {
  TEST_DURATION_WARNING_MS,
  buildNpmTestInvocation,
  createBuiltInCollectors,
  createCargoTestCollector,
  createCollectorRegistry,
  createCustomCollector,
  createGoTestCollector,
  createNpmTestCollector,
  createPytestCollector,
  hasTestScript,
};
