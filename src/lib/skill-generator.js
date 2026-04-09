const path = require("path");
const { ensureDir, fileExists, readText, writeFileIfMissing } = require("./fs-utils");

const AGENT_GUIDE_PATH = path.join(__dirname, "..", "..", "AGENT_GUIDE.md");

function loadAgentGuideContent() {
  return readText(AGENT_GUIDE_PATH, "");
}

const COMMAND_TEMPLATES = {
  "workflow-init.md": `Initialize agent-workflow-studio in this repository and bootstrap project memory.

Steps:
1. Run \`npx agent-workflow init --root .\`
2. Run \`npx agent-workflow scan --root .\`
3. Run \`npx agent-workflow memory:bootstrap --root .\`
4. Read \`.agent-workflow/handoffs/memory-bootstrap.md\` and follow its instructions to fill the memory docs under \`.agent-workflow/memory/\`
5. After writing each memory doc, review it and remove any guesses not supported by actual code or docs
6. Run \`npx agent-workflow validate --root .\` to confirm the scaffold is healthy

Show the user a summary when done.
`,
  "workflow-task.md": `Create a new structured task for the given work.

Run:
\`\`\`bash
npx agent-workflow quick "$ARGUMENTS" --root .
\`\`\`

After creation, edit the generated task.md:
- Fill Goal with a one-paragraph user outcome
- Fill Scope with repo-relative paths (use \`repo path: src/auth/\` format)
  - In scope: files and directories this task will touch
  - Out of scope: what should not be changed
- Fill Deliverables and Risks

Then read context.md and verification.md:
- context.md: fill Why now, Facts, Open questions
- verification.md: fill Planned checks (automated and manual)

Show the user a summary of the created task when done.
`,
  "workflow-done.md": `Record evidence for the current task and refresh the checkpoint.

Steps:
1. Run \`npx agent-workflow task:list --root .\` to find the active task
2. Identify which files you changed that are within the task scope
3. For each scoped file you changed, prepare a --proof-path and a --check
4. Record evidence:
   \`\`\`bash
   npx agent-workflow run:add <taskId> "<one-line summary>" \\
     --status passed \\
     --proof-path <file1> \\
     --proof-path <file2> \\
     --check "<what you verified for file1>" \\
     --check "<what you verified for file2>" \\
     --root .
   \`\`\`
   Use \`--status draft\` if verification is incomplete.
5. Run \`npx agent-workflow checkpoint <taskId> --root .\`
6. Show the user the checkpoint summary from \`.agent-workflow/tasks/<taskId>/checkpoint.md\`
`,
  "workflow-status.md": `Show the current workflow state and highlight any issues.

Steps:
1. Run \`npx agent-workflow task:list --root .\`
2. Run \`npx agent-workflow validate --root .\`
3. Read and summarize:
   - Total tasks and their statuses (todo / in_progress / done)
   - Which tasks have strong proof, which need proof
   - Any validation warnings or errors
4. If there are risks or stale docs, tell the user what needs attention
5. Suggest next actions (e.g. "T-002 needs proof for src/auth.js")
`,
};

function generateSkills(workspaceRoot) {
  const guideContent = loadAgentGuideContent();
  const results = [];

  const claudeMdPath = path.join(workspaceRoot, "CLAUDE.md");
  results.push(writeSkillFile(claudeMdPath, guideContent, "CLAUDE.md"));

  const agentsMdPath = path.join(workspaceRoot, "AGENTS.md");
  results.push(writeSkillFile(agentsMdPath, guideContent, "AGENTS.md"));

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
  formatSkillsSummary,
  generateSkills,
  loadAgentGuideContent,
};
