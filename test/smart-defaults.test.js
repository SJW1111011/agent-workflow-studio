const assert = require("node:assert/strict");

const { main } = require("../src/cli");
const { recordRun, listRuns } = require("../src/lib/task-service");
const {
  inferProofPaths,
  inferProofPathsResult,
  inferTestStatus,
} = require("../src/lib/smart-defaults");
const {
  createTaskWorkspace,
  initializeGitRepository,
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
  writeJsonFile(`${workspaceRoot}/package.json`, {
    name: "smart-defaults-test",
    version: "1.0.0",
    scripts,
  });
}

const tests = [
  {
    name: "inferProofPaths reads the git working tree diff and keeps repo-relative paths",
    run() {
      const { workspaceRoot } = createTaskWorkspace("smart-defaults-proof-paths");
      initializeGitRepository(workspaceRoot);
      writeTextFile(`${workspaceRoot}/README.md`, "# Smart defaults\n");
      commitAll(workspaceRoot, "initial");

      writeTextFile(`${workspaceRoot}/README.md`, "# Smart defaults\n\nupdated\n");
      writeTextFile(`${workspaceRoot}/notes.txt`, "untracked\n");

      assert.deepEqual(inferProofPaths(workspaceRoot).sort(), ["README.md", "notes.txt"]);
    },
  },
  {
    name: "inferProofPathsResult warns and returns no paths when git diff is unavailable",
    run() {
      const { workspaceRoot } = createTaskWorkspace("smart-defaults-no-git");

      const result = inferProofPathsResult(workspaceRoot);

      assert.deepEqual(result.proofPaths, []);
      assert.match(result.messages[0], /git diff is unavailable/i);
    },
  },
  {
    name: "inferTestStatus returns passed when npm test exits successfully",
    run() {
      const { workspaceRoot } = createTaskWorkspace("smart-defaults-test-pass");
      writePackageJson(workspaceRoot, {
        test: 'node -e "process.exit(0)"',
      });

      assert.deepEqual(inferTestStatus(workspaceRoot), {
        status: "passed",
        check: "npm test",
      });
    },
  },
  {
    name: "inferTestStatus returns failed when npm test exits non-zero",
    run() {
      const { workspaceRoot } = createTaskWorkspace("smart-defaults-test-fail");
      writePackageJson(workspaceRoot, {
        test: 'node -e "process.exit(2)"',
      });

      assert.deepEqual(inferTestStatus(workspaceRoot), {
        status: "failed",
        check: "npm test",
      });
    },
  },
  {
    name: "cli done infers proof paths with no extra flags and keeps draft status",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("smart-defaults-done-proof");
      initializeGitRepository(workspaceRoot);
      writeTextFile(`${workspaceRoot}/README.md`, "# Smart defaults\n");
      commitAll(workspaceRoot, "initial");

      writeTextFile(`${workspaceRoot}/README.md`, "# Smart defaults\n\nchanged\n");

      captureCliOutput(() => {
        main(["done", taskId, "Recorded with zero flags.", "--root", workspaceRoot]);
      });

      const run = listRuns(workspaceRoot, taskId)[0];
      assert.equal(run.status, "draft");
      assert.deepEqual(run.scopeProofPaths, ["README.md"]);
      assert.equal(run.verificationChecks, undefined);
    },
  },
  {
    name: "cli done can infer status and check from npm test when requested",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("smart-defaults-done-test");
      initializeGitRepository(workspaceRoot);
      setProjectAutoInferTest(workspaceRoot, true);
      writeTextFile(`${workspaceRoot}/README.md`, "# Smart defaults\n");
      writePackageJson(workspaceRoot, {
        test: 'node -e "process.exit(0)"',
      });
      commitAll(workspaceRoot, "initial");

      writeTextFile(`${workspaceRoot}/README.md`, "# Smart defaults\n\nchanged\n");

      captureCliOutput(() => {
        main(["done", taskId, "Recorded with inferred test.", "--root", workspaceRoot]);
      });

      const run = listRuns(workspaceRoot, taskId)[0];
      assert.equal(run.status, "passed");
      assert.deepEqual(run.scopeProofPaths, ["README.md"]);
      assert.equal(run.verificationChecks[0].label, "npm test");
      assert.equal(run.verificationChecks[0].status, "passed");
    },
  },
  {
    name: "recordRun keeps explicit status, proof paths, and checks ahead of smart defaults",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("smart-defaults-overrides");
      initializeGitRepository(workspaceRoot);
      setProjectAutoInferTest(workspaceRoot, true);
      writeTextFile(`${workspaceRoot}/README.md`, "# Smart defaults\n");
      writePackageJson(workspaceRoot, {
        test: 'node -e "process.exit(2)"',
      });
      commitAll(workspaceRoot, "initial");

      writeTextFile(`${workspaceRoot}/README.md`, "# Smart defaults\n\nchanged\n");

      const run = recordRun(workspaceRoot, taskId, "Manual override.", "passed", "manual", {
        scopeProofPaths: ["docs/manual-proof.md"],
        verificationChecks: [{ label: "manual check", status: "info" }],
        inferScopeProofPaths: true,
        inferTestStatus: true,
      });

      assert.equal(run.status, "passed");
      assert.deepEqual(run.scopeProofPaths, ["docs/manual-proof.md"]);
      assert.equal(run.verificationChecks.length, 1);
      assert.equal(run.verificationChecks[0].label, "manual check");
      assert.equal(run.verificationChecks[0].status, "info");
    },
  },
  {
    name: "cli run:add uses project autoInferTest with zero extra flags",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("smart-defaults-run-add-test");
      initializeGitRepository(workspaceRoot);
      setProjectAutoInferTest(workspaceRoot, true);
      writeTextFile(`${workspaceRoot}/README.md`, "# Smart defaults\n");
      writePackageJson(workspaceRoot, {
        test: 'node -e "process.exit(0)"',
      });
      commitAll(workspaceRoot, "initial");

      writeTextFile(`${workspaceRoot}/README.md`, "# Smart defaults\n\nchanged\n");

      captureCliOutput(() => {
        main(["run:add", taskId, "Recorded with project-configured test inference.", "--root", workspaceRoot]);
      });

      const run = listRuns(workspaceRoot, taskId)[0];
      assert.equal(run.status, "passed");
      assert.deepEqual(run.scopeProofPaths, ["README.md"]);
      assert.equal(run.verificationChecks[0].label, "npm test");
      assert.equal(run.verificationChecks[0].status, "passed");
    },
  },
  {
    name: "cli done prints an info message and skips inferred test status when no test script exists",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("smart-defaults-no-test-script");
      initializeGitRepository(workspaceRoot);
      setProjectAutoInferTest(workspaceRoot, true);
      writeTextFile(`${workspaceRoot}/README.md`, "# Smart defaults\n");
      writePackageJson(workspaceRoot, {
        lint: 'node -e "process.exit(0)"',
      });
      commitAll(workspaceRoot, "initial");

      writeTextFile(`${workspaceRoot}/README.md`, "# Smart defaults\n\nchanged\n");

      const output = captureCliOutput(() => {
        main(["done", taskId, "Recorded without a test script.", "--root", workspaceRoot]);
      });

      const run = listRuns(workspaceRoot, taskId)[0];
      assert.equal(run.status, "draft");
      assert.equal(run.verificationChecks, undefined);
      assert.match(output, /no test script/i);
    },
  },
  {
    name: "cli done skips inferred test status when --skip-test is used",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("smart-defaults-skip-test");
      initializeGitRepository(workspaceRoot);
      setProjectAutoInferTest(workspaceRoot, true);
      writeTextFile(`${workspaceRoot}/README.md`, "# Smart defaults\n");
      writePackageJson(workspaceRoot, {
        test: 'node -e "process.exit(0)"',
      });
      commitAll(workspaceRoot, "initial");

      writeTextFile(`${workspaceRoot}/README.md`, "# Smart defaults\n\nchanged\n");

      captureCliOutput(() => {
        main(["done", taskId, "Recorded with tests skipped.", "--skip-test", "--root", workspaceRoot]);
      });

      const run = listRuns(workspaceRoot, taskId)[0];
      assert.equal(run.status, "draft");
      assert.deepEqual(run.scopeProofPaths, ["README.md"]);
      assert.equal(run.verificationChecks, undefined);
    },
  },
];

const suite = {
  name: "smart-defaults",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
