const assert = require("node:assert/strict");
const path = require("path");

const { main } = require("../src/cli");
const { executeMcpTool } = require("../src/lib/mcp-tools");
const { inferAllTestResults } = require("../src/lib/smart-defaults");
const { listRuns, recordRun } = require("../src/lib/task-service");
const {
  createTaskWorkspace,
  initializeGitRepository,
  readJsonFile,
  runCommand,
  setProjectAutoInferTest,
  writeJsonFile,
  writeTextFile,
} = require("./test-helpers");

function commitAll(workspaceRoot, message) {
  runCommand("git", ["add", "."], workspaceRoot);
  runCommand("git", ["commit", "-m", message], workspaceRoot);
}

function captureCliOutput(callback) {
  let output = "";
  const originalWrite = process.stdout.write;

  process.stdout.write = (chunk, encoding, done) => {
    output += String(chunk);
    if (typeof done === "function") {
      done();
    }
    return true;
  };

  try {
    callback();
  } finally {
    process.stdout.write = originalWrite;
  }

  return output;
}

function writePackageJson(workspaceRoot, scripts = {}) {
  writeJsonFile(path.join(workspaceRoot, "package.json"), {
    name: "smart-defaults-v2-test",
    version: "1.0.0",
    scripts,
  });
}

function createStubCollector(collectorId, priority, status, check, durationMs) {
  return {
    id: collectorId,
    name: check,
    priority,
    detect() {
      return true;
    },
    execute() {
      return {
        status,
        check,
        durationMs,
        messages: [],
      };
    },
  };
}

const tests = [
  {
    name: "inferAllTestResults runs every matching collector in priority order",
    run() {
      const { workspaceRoot } = createTaskWorkspace("smart-defaults-v2-collectors");

      const results = inferAllTestResults(workspaceRoot, {
        collectors: [
          createStubCollector("pytest", 20, "passed", "python -m pytest --tb=no -q", 24),
          createStubCollector("npm-test", 10, "passed", "npm test", 12),
        ],
      });

      assert.deepEqual(results, [
        {
          collectorId: "npm-test",
          status: "passed",
          check: "npm test",
          durationMs: 12,
        },
        {
          collectorId: "pytest",
          status: "passed",
          check: "python -m pytest --tb=no -q",
          durationMs: 24,
        },
      ]);
    },
  },
  {
    name: "recordRun stores collector evidence and derives run status from all collector results",
    run() {
      const { workspaceRoot, taskId, files } = createTaskWorkspace("smart-defaults-v2-record-run");
      writeTextFile(path.join(workspaceRoot, "README.md"), "# Smart defaults v2\n");

      const run = recordRun(workspaceRoot, taskId, "Recorded multi-collector evidence.", undefined, "manual", {
        scopeProofPaths: ["README.md"],
        inferScopeProofPaths: false,
        inferTestStatus: true,
        smartDefaultOptions: {
          collectors: [
            createStubCollector("npm-test", 10, "passed", "npm test", 15),
            createStubCollector("pytest", 20, "failed", "python -m pytest --tb=no -q", 31),
          ],
        },
      });
      const persistedRun = readJsonFile(path.join(files.runs, `${run.id}.json`));

      assert.equal(run.status, "failed");
      assert.deepEqual(
        run.verificationChecks.map((check) => ({ label: check.label, status: check.status })),
        [
          {
            label: "npm test",
            status: "passed",
          },
          {
            label: "python -m pytest --tb=no -q",
            status: "failed",
          },
        ]
      );
      assert.deepEqual(run.evidence.collectors, [
        {
          collectorId: "npm-test",
          status: "passed",
          check: "npm test",
          durationMs: 15,
        },
        {
          collectorId: "pytest",
          status: "failed",
          check: "python -m pytest --tb=no -q",
          durationMs: 31,
        },
      ]);
      assert.deepEqual(run.evidence.proofPaths, ["README.md"]);
      assert.equal(persistedRun.evidence.checks.length, 2);
      assert.deepEqual(persistedRun.evidence.collectors, run.evidence.collectors);
    },
  },
  {
    name: "cli run:add --skip-test skips collector execution but still infers proof paths",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("smart-defaults-v2-cli-skip");
      setProjectAutoInferTest(workspaceRoot, true);
      initializeGitRepository(workspaceRoot);
      writeTextFile(path.join(workspaceRoot, "README.md"), "# Smart defaults v2\n");
      writePackageJson(workspaceRoot, {
        test: 'node -e "process.exit(2)"',
      });
      commitAll(workspaceRoot, "initial");

      writeTextFile(path.join(workspaceRoot, "README.md"), "# Smart defaults v2\n\nchanged\n");

      captureCliOutput(() => {
        main(["run:add", taskId, "Recorded with collectors skipped.", "--skip-test", "--root", workspaceRoot]);
      });

      const run = listRuns(workspaceRoot, taskId)[0];
      assert.equal(run.status, "draft");
      assert.deepEqual(run.scopeProofPaths, ["README.md"]);
      assert.equal(run.verificationChecks, undefined);
      assert.deepEqual(run.evidence.proofPaths, ["README.md"]);
      assert.equal(run.evidence.collectors, undefined);
    },
  },
  {
    name: "workflow_done accepts skipTest and bypasses collector execution",
    async run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("smart-defaults-v2-mcp-skip");
      setProjectAutoInferTest(workspaceRoot, true);
      initializeGitRepository(workspaceRoot);
      writeTextFile(path.join(workspaceRoot, "README.md"), "# Smart defaults v2\n");
      writePackageJson(workspaceRoot, {
        test: 'node -e "process.exit(2)"',
      });
      commitAll(workspaceRoot, "initial");

      writeTextFile(path.join(workspaceRoot, "README.md"), "# Smart defaults v2\n\nchanged\n");

      const result = await executeMcpTool(workspaceRoot, "workflow_done", {
        taskId,
        summary: "Recorded through MCP with collectors skipped.",
        skipTest: true,
      });

      assert.equal(result.ok, true);
      assert.equal(result.run.status, "draft");
      assert.deepEqual(result.run.scopeProofPaths, ["README.md"]);
      assert.equal(result.run.verificationChecks, undefined);
      assert.deepEqual(result.run.evidence.proofPaths, ["README.md"]);
      assert.equal(result.run.evidence.collectors, undefined);
    },
  },
];

const suite = {
  name: "smart-defaults-v2",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
