const assert = require("node:assert/strict");

const {
  createCargoTestCollector,
  createCollectorRegistry,
  createGoTestCollector,
  createPytestCollector,
} = require("../src/lib/evidence-collectors");
const { validateWorkspace } = require("../src/lib/schema-validator");
const { projectConfigPath, readProjectConfig } = require("../src/lib/workspace");
const {
  createTaskWorkspace,
  readJsonFile,
  writeJsonFile,
  writeTextFile,
} = require("./test-helpers");

function updateProjectConfig(workspaceRoot, updater) {
  const configPath = projectConfigPath(workspaceRoot);
  const config = readJsonFile(configPath);
  updater(config);
  writeJsonFile(configPath, config);
}

const tests = [
  {
    name: "registry keeps npm-test ahead of other built-in collectors when package.json has a test script",
    run() {
      const { workspaceRoot } = createTaskWorkspace("evidence-collectors-npm-priority");
      writeJsonFile(`${workspaceRoot}/package.json`, {
        name: "collector-priority",
        version: "1.0.0",
        scripts: {
          test: 'node -e "process.exit(0)"',
        },
      });
      writeTextFile(`${workspaceRoot}/pyproject.toml`, "[tool.pytest.ini_options]\naddopts = \"-q\"\n");

      const result = createCollectorRegistry(workspaceRoot).detectAndExecute();

      assert.equal(result.collectorId, "npm-test");
      assert.deepEqual(result.result, {
        status: "passed",
        check: "npm test",
      });
    },
  },
  {
    name: "pytest collector detects pyproject.toml with pytest markers",
    run() {
      const { workspaceRoot } = createTaskWorkspace("evidence-collectors-pytest");
      writeTextFile(`${workspaceRoot}/pyproject.toml`, "[tool.pytest.ini_options]\naddopts = \"-q\"\n");

      assert.equal(createPytestCollector().detect(workspaceRoot), true);
    },
  },
  {
    name: "cargo-test collector detects Cargo.toml",
    run() {
      const { workspaceRoot } = createTaskWorkspace("evidence-collectors-cargo");
      writeTextFile(`${workspaceRoot}/Cargo.toml`, "[package]\nname = \"demo\"\nversion = \"0.1.0\"\n");

      assert.equal(createCargoTestCollector().detect(workspaceRoot), true);
    },
  },
  {
    name: "go-test collector detects go.mod",
    run() {
      const { workspaceRoot } = createTaskWorkspace("evidence-collectors-go");
      writeTextFile(`${workspaceRoot}/go.mod`, "module example.com/demo\n\ngo 1.22\n");

      assert.equal(createGoTestCollector().detect(workspaceRoot), true);
    },
  },
  {
    name: "registry loads custom collectors from project.json",
    run() {
      const { workspaceRoot } = createTaskWorkspace("evidence-collectors-custom");
      updateProjectConfig(workspaceRoot, (config) => {
        config.evidenceCollectors = [
          {
            id: "custom-node-check",
            command: "node",
            args: ["-e", "process.exit(0)"],
            detectFile: "collector.flag",
          },
        ];
      });
      writeTextFile(`${workspaceRoot}/collector.flag`, "present\n");

      const result = createCollectorRegistry(workspaceRoot).detectAndExecute();

      assert.equal(result.collectorId, "custom-node-check");
      assert.deepEqual(result.result, {
        status: "passed",
        check: "node -e process.exit(0)",
      });
    },
  },
  {
    name: "custom collectors return null instead of throwing when the command is missing",
    run() {
      const { workspaceRoot } = createTaskWorkspace("evidence-collectors-missing");
      updateProjectConfig(workspaceRoot, (config) => {
        config.evidenceCollectors = [
          {
            id: "missing-binary-check",
            command: "__collector_command_that_should_not_exist__",
            args: ["--version"],
            detectFile: "collector.flag",
          },
        ];
      });
      writeTextFile(`${workspaceRoot}/collector.flag`, "present\n");

      const result = createCollectorRegistry(workspaceRoot).detectAndExecute();

      assert.equal(result.collectorId, "missing-binary-check");
      assert.equal(result.result, null);
      assert.match(result.messages[0], /could not be launched/i);
    },
  },
  {
    name: "project config normalizes valid collectors and validation flags invalid collector entries",
    run() {
      const { workspaceRoot } = createTaskWorkspace("evidence-collectors-config");
      updateProjectConfig(workspaceRoot, (config) => {
        config.evidenceCollectors = [
          {
            id: "repo-check",
            command: "node",
            args: ["scripts/check.js"],
            detectFile: "scripts/check.js",
          },
          {
            id: "bad shell entry",
            command: "powershell",
            args: ["-Command", "exit 0"],
            detectFile: "../outside.flag",
          },
        ];
      });

      const projectConfig = readProjectConfig(workspaceRoot);
      const validation = validateWorkspace(workspaceRoot);

      assert.deepEqual(projectConfig.evidenceCollectors, [
        {
          id: "repo-check",
          command: "node",
          args: ["scripts/check.js"],
          detectFile: "scripts/check.js",
        },
      ]);
      assert.equal(
        validation.issues.some(
          (entry) =>
            entry.code === "project.evidenceCollectors.entry" &&
            /evidenceCollectors\[1\]/.test(entry.message)
        ),
        true
      );
    },
  },
];

const suite = {
  name: "evidence-collectors",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
