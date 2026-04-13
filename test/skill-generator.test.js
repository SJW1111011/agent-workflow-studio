const fs = require("fs");
const path = require("path");
const { generateSkills, loadAgentGuideContent, COMMAND_TEMPLATES } = require("../src/lib/skill-generator");

const TEST_TMP_ROOT = path.join(__dirname, "..", "tmp", "unit-tests");

function createTempDir(prefix) {
  fs.mkdirSync(TEST_TMP_ROOT, { recursive: true });
  return fs.mkdtempSync(path.join(TEST_TMP_ROOT, `${prefix}-`));
}

const suite = {
  name: "skill-generator",
  tests: [
    {
      name: "generateSkills creates all files in an empty directory",
      run() {
        const workspaceRoot = createTempDir("skills-empty");
        const result = generateSkills(workspaceRoot);

        if (result.createdCount !== 6) {
          throw new Error(`Expected 6 files created, got ${result.createdCount}`);
        }
        if (result.skippedCount !== 0) {
          throw new Error(`Expected 0 files skipped, got ${result.skippedCount}`);
        }
        if (!fs.existsSync(path.join(workspaceRoot, "CLAUDE.md"))) {
          throw new Error("CLAUDE.md was not created");
        }
        if (!fs.existsSync(path.join(workspaceRoot, "AGENTS.md"))) {
          throw new Error("AGENTS.md was not created");
        }
        for (const fileName of Object.keys(COMMAND_TEMPLATES)) {
          if (!fs.existsSync(path.join(workspaceRoot, ".claude", "commands", fileName))) {
            throw new Error(`${fileName} was not created`);
          }
        }
      },
    },
    {
      name: "generateSkills does not overwrite existing files",
      run() {
        const workspaceRoot = createTempDir("skills-existing");
        const customContent = "# My custom CLAUDE.md\n\nDo not overwrite this.\n";
        fs.writeFileSync(path.join(workspaceRoot, "CLAUDE.md"), customContent, "utf8");

        const result = generateSkills(workspaceRoot);

        if (result.skippedCount < 1) {
          throw new Error("Expected at least 1 file skipped");
        }
        const claudeMd = fs.readFileSync(path.join(workspaceRoot, "CLAUDE.md"), "utf8");
        if (claudeMd !== customContent) {
          throw new Error("CLAUDE.md was overwritten");
        }
        if (!fs.existsSync(path.join(workspaceRoot, "AGENTS.md"))) {
          throw new Error("AGENTS.md should still be created");
        }
      },
    },
    {
      name: "CLAUDE.md and AGENTS.md contain the full agent guide content",
      run() {
        const workspaceRoot = createTempDir("skills-content");
        generateSkills(workspaceRoot);

        const guideContent = loadAgentGuideContent();
        const claudeMd = fs.readFileSync(path.join(workspaceRoot, "CLAUDE.md"), "utf8");
        const agentsMd = fs.readFileSync(path.join(workspaceRoot, "AGENTS.md"), "utf8");

        if (!guideContent.includes("## Before starting any task")) {
          throw new Error("AGENT_GUIDE.md is missing expected content");
        }
        if (claudeMd !== guideContent) {
          throw new Error("CLAUDE.md does not match AGENT_GUIDE.md content");
        }
        if (agentsMd !== guideContent) {
          throw new Error("AGENTS.md does not match AGENT_GUIDE.md content");
        }
      },
    },
    {
      name: "command templates contain expected workflow instructions",
      run() {
        const initCmd = COMMAND_TEMPLATES["workflow-init.md"];
        if (!initCmd.includes("npx agent-workflow init")) {
          throw new Error("workflow-init.md missing init command");
        }
        if (!initCmd.includes("memory-bootstrap.md")) {
          throw new Error("workflow-init.md missing bootstrap reference");
        }

        const taskCmd = COMMAND_TEMPLATES["workflow-task.md"];
        if (!taskCmd.includes("$ARGUMENTS")) {
          throw new Error("workflow-task.md missing $ARGUMENTS placeholder");
        }
        if (!taskCmd.includes("repo path:")) {
          throw new Error("workflow-task.md missing scope format hint");
        }

        const doneCmd = COMMAND_TEMPLATES["workflow-done.md"];
        if (!doneCmd.includes("run:add")) {
          throw new Error("workflow-done.md missing run:add command");
        }
        if (!doneCmd.includes("checkpoint")) {
          throw new Error("workflow-done.md missing checkpoint command");
        }

        const statusCmd = COMMAND_TEMPLATES["workflow-status.md"];
        if (!statusCmd.includes("validate")) {
          throw new Error("workflow-status.md missing validate command");
        }
      },
    },
  ],
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
