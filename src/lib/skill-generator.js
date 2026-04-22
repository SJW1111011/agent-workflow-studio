const path = require("path");
const { ensureDir, fileExists, readText, writeFileIfMissing } = require("./fs-utils");

const AGENT_GUIDE_PATH = path.join(__dirname, "..", "..", "AGENT_GUIDE.md");

function loadAgentGuideContent() {
  return readText(AGENT_GUIDE_PATH, "");
}

function buildClaudeMdContent(guideContent) {
  const rules = `# Workflow Rules

This project uses agent-workflow-studio for task management, evidence tracking, and trust scoring.

## Required behavior

- ALWAYS use workflow_* MCP tools for task creation, progress tracking, and evidence recording
- NEVER use built-in TaskCreate, TaskList, or TaskUpdate for project work — those are ephemeral and invisible to the dashboard
- When the user says "create a task", use workflow_quick
- When work is done, use workflow_done — it auto-infers changed files and runs test collectors
- Use workflow_record_activity for progress breadcrumbs during long work
- Use workflow:// resources to read task context, evidence, and memory
- Use workflow-resume prompt to get full context when picking up a task

## Quick reference

- Create task: \`workflow_quick({ title: "...", mode: "lite" })\`
- Finish task: \`workflow_done({ taskId: "T-001", summary: "...", complete: true })\`
- List tasks: \`workflow_task_list({})\`
- Project health: \`workflow_overview({})\`
- Resume context: use \`workflow-resume\` prompt with taskId

`;
  return rules + guideContent;
}

const COMMAND_TEMPLATES = {
  "workflow-init.md": `Initialize agent-workflow-studio in this repository.

Steps:
1. Run \`npx agent-workflow init --root .\`
2. Run \`npx agent-workflow scan --root .\`
3. Run \`npx agent-workflow memory:bootstrap --root .\`
4. Read \`.agent-workflow/handoffs/memory-bootstrap.md\` and follow its instructions
5. Run \`npx agent-workflow validate --root .\`

Show the user a summary when done.
`,
  "workflow-task.md": `Create a new workflow task.

If MCP is available, use:
\`\`\`
workflow_quick({ title: "$ARGUMENTS", mode: "lite" })
\`\`\`

Otherwise fall back to CLI:
\`\`\`bash
npx agent-workflow quick "$ARGUMENTS" --lite --root .
\`\`\`

Show the user the created task ID.
`,
  "workflow-done.md": `Record evidence and mark the current task done.

If MCP is available, use:
\`\`\`
workflow_done({ taskId: "<taskId>", summary: "$ARGUMENTS", complete: true })
\`\`\`

Otherwise fall back to CLI:
\`\`\`bash
npx agent-workflow done <taskId> "$ARGUMENTS" --complete --root .
\`\`\`

Both paths auto-infer changed files from git diff and run matching test collectors.
Show the user the evidence summary.
`,
  "workflow-status.md": `Show project workflow health.

If MCP is available, use:
\`\`\`
workflow_overview({})
\`\`\`

Otherwise fall back to CLI:
\`\`\`bash
npx agent-workflow task:list --root .
npx agent-workflow validate --root .
\`\`\`

Summarize: task counts by status, evidence coverage, trust scores, and any issues needing attention.
`,
};

function generateSkills(workspaceRoot) {
  const guideContent = loadAgentGuideContent();
  const claudeMdContent = buildClaudeMdContent(guideContent);
  const results = [];

  const claudeMdPath = path.join(workspaceRoot, "CLAUDE.md");
  results.push(writeSkillFile(claudeMdPath, claudeMdContent, "CLAUDE.md"));

  const agentsMdPath = path.join(workspaceRoot, "AGENTS.md");
  results.push(writeSkillFile(agentsMdPath, claudeMdContent, "AGENTS.md"));

  const commandsDir = path.join(workspaceRoot, ".claude", "commands");
  ensureDir(commandsDir);

  Object.entries(COMMAND_TEMPLATES).forEach(([fileName, content]) => {
    const filePath = path.join(commandsDir, fileName);
    results.push(writeSkillFile(filePath, content, `.claude/commands/${fileName}`));
  });

  return {
    generated: results.filter((r) => r.created),
    skipped: results.filter((r) => !r.created),
    totalFiles: results.length,
    createdCount: results.filter((r) => r.created).length,
    skippedCount: results.filter((r) => !r.created).length,
  };
}

function writeSkillFile(filePath, content, displayName) {
  const existed = fileExists(filePath);
  writeFileIfMissing(filePath, content);
  return {
    path: displayName,
    created: !existed,
  };
}

function formatSkillsSummary(result) {
  const lines = [`Skills generated: ${result.createdCount} created, ${result.skippedCount} already existed`];

  result.generated.forEach((item) => {
    lines.push(`  + ${item.path}`);
  });

  result.skipped.forEach((item) => {
    lines.push(`  - ${item.path} (already exists, skipped)`);
  });

  lines.push("");
  lines.push("Claude Code users: /workflow-init, /workflow-task, /workflow-done, /workflow-status");
  lines.push("Codex users: AGENTS.md is auto-loaded — the agent already knows the workflow");

  return lines.join("\n");
}

module.exports = {
  COMMAND_TEMPLATES,
  buildClaudeMdContent,
  formatSkillsSummary,
  generateSkills,
  loadAgentGuideContent,
};
