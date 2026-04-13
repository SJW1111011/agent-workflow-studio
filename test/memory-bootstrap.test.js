const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

const {
  formatMemoryBootstrapSummary,
  generateMemoryBootstrapPrompt,
  loadMemoryBootstrapDocs,
} = require("../src/lib/memory-bootstrap");
const { createTaskWorkspace, readTextFile, writeTextFile } = require("./test-helpers");

const tests = [
  {
    name: "loadMemoryBootstrapDocs keeps memory docs ordered and tracks placeholder-like content",
    run() {
      const { workspaceRoot } = createTaskWorkspace("memory-bootstrap-order");
      writeTextFile(
        path.join(workspaceRoot, ".agent-workflow", "memory", "architecture.md"),
        "# Architecture Memory\n\n## Current architecture\n\n- API routes live in src/server.js\n"
      );

      const docs = loadMemoryBootstrapDocs(workspaceRoot);

      assert.deepEqual(
        docs.slice(0, 4).map((doc) => doc.name),
        ["product.md", "architecture.md", "domain-rules.md", "runbook.md"]
      );
      assert.equal(docs.find((doc) => doc.name === "architecture.md").placeholder, false);
      assert.equal(docs.find((doc) => doc.name === "product.md").placeholder, true);
    },
  },
  {
    name: "generateMemoryBootstrapPrompt refreshes project profile and writes a reusable handoff prompt",
    run() {
      const { workspaceRoot } = createTaskWorkspace("memory-bootstrap-generate");
      writeTextFile(path.join(workspaceRoot, "README.md"), "# Memory bootstrap workspace\n");
      fs.mkdirSync(path.join(workspaceRoot, "docs"), { recursive: true });
      writeTextFile(path.join(workspaceRoot, "docs", "architecture-notes.md"), "# Notes\n");
      writeTextFile(
        path.join(workspaceRoot, "package.json"),
        `${JSON.stringify(
          {
            name: "memory-bootstrap-generate",
            version: "0.0.1",
            scripts: {
              test: "node -e \"console.log('ok')\"",
            },
          },
          null,
          2
        )}\n`
      );

      const result = generateMemoryBootstrapPrompt(workspaceRoot);

      assert.equal(result.placeholderDocCount, 4);
      assert.ok(fs.existsSync(result.outputPath));
      assert.ok(result.profile.docs.includes("README.md"));
      assert.ok(result.profile.docs.includes("docs/architecture-notes.md"));
      assert.ok(Object.prototype.hasOwnProperty.call(result.profile.scripts, "test"));

      const prompt = readTextFile(result.outputPath);
      assert.match(prompt, /# Memory Bootstrap Prompt/);
      assert.match(prompt, /\.agent-workflow\/project-profile\.md/);
      assert.match(prompt, /\.agent-workflow\/memory\/product\.md/);
      assert.match(prompt, /Do not fake verification, production state, or business context\./);

      const summary = formatMemoryBootstrapSummary(result, workspaceRoot);
      assert.match(summary, /Memory bootstrap prompt ready:/);
      assert.match(summary, /Placeholder-like memory docs: 4/);
      assert.match(summary, /Give .*memory-bootstrap\.md to Codex or Claude Code\./);
    },
  },
];

const suite = {
  name: "memory-bootstrap",
  tests,
};

describe(suite.name, () => {
  suite.tests.forEach((testCase) => {
    it(testCase.name, testCase.run);
  });
});
