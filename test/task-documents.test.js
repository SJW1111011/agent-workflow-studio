const assert = require("node:assert/strict");

const { getRecipe } = require("../src/lib/recipes");
const { saveTaskDocument, syncManagedTaskDocs } = require("../src/lib/task-documents");
const {
  createTaskWorkspace,
  readJsonFile,
  readTextFile,
  writeTextFile,
} = require("./test-helpers");

function countMatches(text, pattern) {
  return (String(text || "").match(pattern) || []).length;
}

const tests = [
  {
    name: "saveTaskDocument normalizes task heading and recipe metadata while keeping freeform notes",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("task-doc-heading");

      const result = saveTaskDocument(
        workspaceRoot,
        taskId,
        "task.md",
        [
          "# Wrong heading",
          "",
          "## Goal",
          "",
          "Keep the user-facing outcome explicit.",
          "",
          "## Notes",
          "",
          "- Preserve this note.",
          "",
        ].join("\n")
      );

      assert.match(result.content, /^# T-001 - Test task$/m);
      assert.match(result.content, /agent-workflow:managed:task-recipe-meta:start/);
      assert.match(result.content, /Recipe ID: feature/);
      assert.match(result.content, /## Notes\n\n- Preserve this note\./);
      assert.doesNotMatch(result.content, /^# Wrong heading$/m);
    },
  },
  {
    name: "saveTaskDocument rewrites context constraints as managed lines without duplicating defaults",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("task-doc-context");

      const result = saveTaskDocument(
        workspaceRoot,
        taskId,
        "context.md",
        [
          "# Temporary heading",
          "",
          "## Facts",
          "",
          "- Local-first only.",
          "",
          "## Constraints",
          "",
          "- Priority: P0",
          "- Keep the workflow docs current.",
          "- Must stay local-only.",
          "",
        ].join("\n")
      );

      assert.match(result.content, /^# T-001 Context$/m);
      assert.match(result.content, /agent-workflow:managed:context-constraints-meta:start/);
      assert.match(result.content, /- Priority: P1/);
      assert.match(result.content, /- Must stay local-only\./);
      assert.equal(countMatches(result.content, /- Priority:/g), 1);
      assert.equal(countMatches(result.content, /- Keep the workflow docs current\./g), 1);
    },
  },
  {
    name: "saveTaskDocument preserves verification details while only normalizing the heading",
    run() {
      const { workspaceRoot, taskId } = createTaskWorkspace("task-doc-verification");

      const result = saveTaskDocument(
        workspaceRoot,
        taskId,
        "verification.md",
        [
          "# Draft verification",
          "",
          "## Planned checks",
          "",
          "- manual: Review src/app.js diff",
          "",
          "## Proof links",
          "",
          "### Proof 1",
          "",
          "- Files: src/app.js",
          "- Check: npm test",
          "- Artifact: logs/test.txt",
          "",
          "## Blocking gaps",
          "",
          "- none",
          "",
        ].join("\n")
      );

      assert.match(result.content, /^# T-001 Verification$/m);
      assert.match(result.content, /- manual: Review src\/app\.js diff/);
      assert.match(result.content, /- Files: src\/app\.js/);
      assert.match(result.content, /- Check: npm test/);
      assert.match(result.content, /- Artifact: logs\/test\.txt/);
      assert.doesNotMatch(result.content, /^# Draft verification$/m);
    },
  },
  {
    name: "syncManagedTaskDocs refreshes task, context, and checkpoint metadata while keeping custom notes",
    run() {
      const { workspaceRoot, files } = createTaskWorkspace("task-doc-sync");

      writeTextFile(
        files.task,
        [
          "# T-001 - Test task",
          "",
          "## Goal",
          "",
          "Keep the outcome concrete.",
          "",
          "## Notes",
          "",
          "- Preserve task note.",
          "",
        ].join("\n")
      );
      writeTextFile(
        files.context,
        [
          "# T-001 Context",
          "",
          "## Facts",
          "",
          "- Existing fact.",
          "",
          "## Constraints",
          "",
          "- Must stay local-only.",
          "",
        ].join("\n")
      );
      writeTextFile(
        files.checkpoint,
        [
          "# T-001 Checkpoint",
          "",
          "## Completed",
          "",
          "- Preserve checkpoint note.",
          "",
          "## Confirmed facts",
          "",
          "- Priority: P9",
          "- Status: todo",
          "- Extra fact: keep me.",
          "",
          "## Resume instructions",
          "",
          "- Re-open the task docs first.",
          "",
        ].join("\n")
      );

      const meta = readJsonFile(files.meta);
      meta.title = "Updated task title";
      meta.recipeId = "audit";
      meta.priority = "P0";
      meta.status = "blocked";
      const recipe = getRecipe(workspaceRoot, meta.recipeId);

      syncManagedTaskDocs(files, meta, recipe);

      const taskText = readTextFile(files.task);
      const contextText = readTextFile(files.context);
      const checkpointText = readTextFile(files.checkpoint);

      assert.match(taskText, /^# T-001 - Updated task title$/m);
      assert.match(taskText, /Recipe ID: audit/);
      assert.match(taskText, /## Notes\n\n- Preserve task note\./);

      assert.match(contextText, /Recommended for: code audit, truthfulness audit, launch review/);
      assert.match(contextText, /- Priority: P0/);
      assert.match(contextText, /- Must stay local-only\./);

      assert.match(checkpointText, /- Priority: P0/);
      assert.match(checkpointText, /- Status: blocked/);
      assert.match(checkpointText, /- Extra fact: keep me\./);
      assert.match(checkpointText, /- Preserve checkpoint note\./);
    },
  },
];

module.exports = {
  name: "task-documents",
  tests,
};
