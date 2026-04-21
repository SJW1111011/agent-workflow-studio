const assert = require("node:assert/strict");
const path = require("path");

const { buildCheckpoint } = require("../src/lib/checkpoint");
const { createPromptHandlers } = require("../src/lib/mcp-prompts");
const { createResourceHandlers } = require("../src/lib/mcp-resources");
const { executeMcpTool } = require("../src/lib/mcp-tools");
const { createTaskWorkspace, readJsonFile, writeJsonFile, writeTextFile } = require("./test-helpers");

function setTaskScope(files, scope, createdAt = "2026-01-01T00:00:00.000Z") {
  const meta = readJsonFile(files.meta);
  meta.scope = scope;
  meta.status = "in_progress";
  meta.createdAt = createdAt;
  meta.updatedAt = createdAt;
  writeJsonFile(files.meta, meta);
}

function parseTextResource(result) {
  assert.ok(result);
  assert.ok(Array.isArray(result.contents));
  assert.equal(result.contents[0].uri.startsWith("workflow://"), true);
  assert.equal(typeof result.contents[0].text, "string");
  return result.contents[0];
}

async function createVerifiedTaskWorkspace(prefix) {
  const fixture = createTaskWorkspace(prefix);
  const { workspaceRoot, taskId, files } = fixture;

  writeTextFile(path.join(workspaceRoot, "README.md"), "# MCP resources\n");
  writeTextFile(path.join(workspaceRoot, "src", "app.js"), "export const ready = true;\n");
  setTaskScope(files, ["README.md", "src/app.js"]);

  await executeMcpTool(workspaceRoot, "workflow_run_add", {
    taskId,
    summary: "Verified README only.",
    status: "passed",
    proofPaths: ["README.md"],
    checks: ["Reviewed README.md diff"],
  });

  buildCheckpoint(workspaceRoot, taskId);
  return fixture;
}

const tests = [
  {
    name: "resource handlers list workflow resources and read overview, task, and memory payloads",
    async run() {
      const { workspaceRoot, taskId } = await createVerifiedTaskWorkspace("mcp-resources");
      const handlers = createResourceHandlers(workspaceRoot);

      const resources = handlers.listResources();
      const templates = handlers.listResourceTemplates();
      const overview = JSON.parse(parseTextResource(handlers.readResource("workflow://overview")).text);
      const taskList = JSON.parse(parseTextResource(handlers.readResource("workflow://tasks")).text);
      const taskDetail = JSON.parse(parseTextResource(handlers.readResource(`workflow://tasks/${taskId}`)).text);
      const productMemory = parseTextResource(handlers.readResource("workflow://memory/product"));

      assert.deepEqual(
        resources.map((resource) => resource.uri),
        ["workflow://overview", "workflow://tasks"]
      );
      assert.deepEqual(
        templates.map((template) => template.uriTemplate),
        ["workflow://tasks/{taskId}", "workflow://memory/{docName}"]
      );

      assert.equal(overview.initialized, true);
      assert.ok(Array.isArray(overview.tasks));

      assert.equal(taskList.count, 1);
      assert.equal(taskList.tasks[0].id, taskId);
      assert.equal(taskList.tasks[0].coveragePercent, 50);
      assert.equal(taskList.tasks[0].verificationSignalStatus, "verified");

      assert.equal(taskDetail.task.id, taskId);
      assert.match(taskDetail.taskText, /# T-001 - Test task/);
      assert.match(taskDetail.contextText, /# T-001 Context/);
      assert.match(taskDetail.verificationText, /## Evidence/);
      assert.match(taskDetail.checkpointText, /Latest run status: passed/);
      assert.equal(taskDetail.latestRunSummary.summary, "Verified README only.");
      assert.equal(taskDetail.verificationGate.summary.status, "incomplete");
      assert.equal(taskDetail.coveragePercent, 50);

      assert.equal(productMemory.mimeType, "text/markdown");
      assert.match(productMemory.text, /# Product Memory/);
    },
  },
  {
    name: "prompt handlers return resume, verify, and handoff prompt packages with embedded resources",
    async run() {
      const { workspaceRoot, taskId } = await createVerifiedTaskWorkspace("mcp-prompts");
      const handlers = createPromptHandlers(workspaceRoot);

      const prompts = handlers.listPrompts();
      const resume = handlers.getPrompt("workflow-resume", { taskId });
      const verify = handlers.getPrompt("workflow-verify", { taskId });
      const handoff = handlers.getPrompt("workflow-handoff", { taskId });
      const resumeTaskPayload = JSON.parse(resume.messages[1].content.resource.text);

      assert.deepEqual(
        prompts.map((prompt) => prompt.name),
        ["workflow-resume", "workflow-verify", "workflow-handoff"]
      );

      assert.match(resume.messages[0].content.text, /Resume workflow task T-001/);
      assert.match(resume.messages[0].content.text, /Verification gate: incomplete/);
      assert.equal(resume.messages[1].content.type, "resource");
      assert.equal(resume.messages[1].content.resource.uri, `workflow://tasks/${taskId}`);
      assert.match(resumeTaskPayload.checkpointText, /Checkpoint/);
      assert.equal(resume.messages[2].content.resource.uri, "workflow://memory/product");

      assert.match(verify.messages[0].content.text, /Coverage: 50%/);
      assert.match(verify.messages[0].content.text, /Missing scoped files: src\/app.js/);
      assert.equal(verify.messages[1].content.resource.uri, `workflow://tasks/${taskId}`);

      assert.match(handoff.messages[0].content.text, /What was done: Verified README only\./);
      assert.match(handoff.messages[0].content.text, /Checkpoint state: present/);
      assert.equal(handoff.messages[1].content.resource.uri, `workflow://tasks/${taskId}`);
    },
  },
];

const suite = {
  name: "mcp-resources",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
