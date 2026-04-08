const path = require("path");
const {
  ensureDir,
  fileExists,
  listDirectories,
  readJson,
  readText,
  writeFileIfMissing,
  writeJson,
} = require("./fs-utils");

const MEMORY_TEMPLATES = {
  "product.md": `# Product Memory

## Product truth

- What user problem are we solving?
- What must never be faked?
- What business outcomes matter most?

## Current constraints

- Technical constraints:
- Compliance constraints:
- Operational constraints:

## Open questions

- 
`,
  "architecture.md": `# Architecture Memory

## Current architecture

- Core modules:
- Data flows:
- Key dependencies:

## Fragile areas

- 

## Invariants

- 
`,
  "domain-rules.md": `# Domain Rules

## Rules that must stay true

- 

## Contract assumptions

- 

## Forbidden shortcuts

- placeholder APIs
- fake verification
- hidden production toggles
`,
  "runbook.md": `# Runbook

## Standard loops

1. scan
2. create or update task
3. compile prompt
4. execute
5. record evidence
6. checkpoint

## Verification expectations

- what must be tested?
- what can only be manually verified?
- what still lacks tooling?
`,
};

const RECIPE_REGISTRY = [
  {
    id: "audit",
    name: "Audit",
    fileName: "audit.md",
    summary: "Find bugs, fake implementations, contract mismatches, and missing verification.",
    recommendedFor: ["code audit", "truthfulness audit", "launch review"],
  },
  {
    id: "feature",
    name: "Feature",
    fileName: "feature.md",
    summary: "Deliver scoped user value without breaking contracts.",
    recommendedFor: ["feature delivery", "scoped implementation", "incremental release"],
  },
  {
    id: "review",
    name: "Review",
    fileName: "review.md",
    summary: "Review changes for correctness, regressions, and missing tests.",
    recommendedFor: ["PR review", "post-implementation check", "handoff review"],
  },
];

const RECIPE_TEMPLATES = {
  "audit.md": `# Audit Recipe

## Goal

Find bugs, fake implementations, contract mismatches, and missing verification.

## Required outputs

- findings with file references
- assumptions
- verification gaps
`,
  "feature.md": `# Feature Recipe

## Goal

Deliver user value without breaking established contracts.

## Required outputs

- implementation plan
- affected files
- validation evidence
`,
  "review.md": `# Review Recipe

## Goal

Review for correctness, regression risk, missing tests, and unclear contracts.

## Required outputs

- findings first
- assumptions
- follow-up actions
`,
};

const ADAPTER_TEMPLATES = {
  "README.md": `# Adapter Config

These files describe local adapter contracts for agent runtimes.

- Edit runnerCommand after confirming your local installation.
- Built-in adapters may include a recommended exec template while still defaulting to manual mode.
- Keep this folder portable.
- Do not write absolute machine paths here unless you truly need them.
`,
  "codex.json": JSON.stringify(
    {
      schemaVersion: 1,
      adapterId: "codex",
      name: "Codex",
      promptFile: "prompt.codex.md",
      runRequestFile: "run-request.codex.json",
      launchPackFile: "launch.codex.md",
      runnerCommand: ["codex"],
      argvTemplate: ["exec", "--sandbox", "workspace-write", "--ask-for-approval", "never", "-"],
      commandMode: "manual",
      cwdMode: "workspaceRoot",
      stdioMode: "pipe",
      stdinMode: "promptFile",
      successExitCodes: [0],
      envAllowlist: [],
      capabilities: {
        interactive: true,
        multiAgent: true,
        resumable: true,
      },
      notes: [
        "The built-in Codex profile now includes a recommended non-interactive `codex exec` template, but commandMode stays manual until you opt in.",
        "Confirm the local Codex CLI invocation for this machine before automating process launch.",
        "If Windows direct spawning of `codex` is unavailable on your machine, switch runnerCommand to a working local wrapper such as `cmd.exe` plus a matching argvTemplate.",
      ],
    },
    null,
    2
  ),
  "claude-code.json": JSON.stringify(
    {
      schemaVersion: 1,
      adapterId: "claude-code",
      name: "Claude Code",
      promptFile: "prompt.claude.md",
      runRequestFile: "run-request.claude-code.json",
      launchPackFile: "launch.claude-code.md",
      runnerCommand: ["claude"],
      argvTemplate: [],
      commandMode: "manual",
      cwdMode: "workspaceRoot",
      stdioMode: "inherit",
      successExitCodes: [0],
      envAllowlist: [],
      capabilities: {
        interactive: true,
        multiAgent: true,
        resumable: true,
      },
      notes: ["Confirm the local Claude Code invocation for this machine before automating process launch."],
    },
    null,
    2
  ),
};

function resolveWorkspaceRoot(inputRoot) {
  return path.resolve(inputRoot || process.cwd());
}

function workflowRoot(workspaceRoot) {
  return path.join(workspaceRoot, ".agent-workflow");
}

function memoryRoot(workspaceRoot) {
  return path.join(workspaceRoot, ".agent-workflow", "memory");
}

function recipesRoot(workspaceRoot) {
  return path.join(workspaceRoot, ".agent-workflow", "recipes");
}

function recipesIndexPath(workspaceRoot) {
  return path.join(recipesRoot(workspaceRoot), "index.json");
}

function adaptersRoot(workspaceRoot) {
  return path.join(workspaceRoot, ".agent-workflow", "adapters");
}

function tasksRoot(workspaceRoot) {
  return path.join(workspaceRoot, ".agent-workflow", "tasks");
}

function taskRoot(workspaceRoot, taskId) {
  return path.join(tasksRoot(workspaceRoot), taskId);
}

function runsRoot(workspaceRoot, taskId) {
  return path.join(taskRoot(workspaceRoot, taskId), "runs");
}

function decisionsRoot(workspaceRoot) {
  return path.join(workflowRoot(workspaceRoot), "decisions");
}

function handoffsRoot(workspaceRoot) {
  return path.join(workflowRoot(workspaceRoot), "handoffs");
}

function projectConfigPath(workspaceRoot) {
  return path.join(workflowRoot(workspaceRoot), "project.json");
}

function projectProfilePath(workspaceRoot) {
  return path.join(workflowRoot(workspaceRoot), "project-profile.json");
}

function projectProfileMarkdownPath(workspaceRoot) {
  return path.join(workflowRoot(workspaceRoot), "project-profile.md");
}

function ensureWorkflowScaffold(workspaceRoot) {
  ensureDir(workflowRoot(workspaceRoot));
  ensureDir(memoryRoot(workspaceRoot));
  ensureDir(recipesRoot(workspaceRoot));
  ensureDir(adaptersRoot(workspaceRoot));
  ensureDir(tasksRoot(workspaceRoot));
  ensureDir(decisionsRoot(workspaceRoot));
  ensureDir(handoffsRoot(workspaceRoot));

  Object.entries(MEMORY_TEMPLATES).forEach(([fileName, content]) => {
    writeFileIfMissing(path.join(memoryRoot(workspaceRoot), fileName), content);
  });

  Object.entries(RECIPE_TEMPLATES).forEach(([fileName, content]) => {
    writeFileIfMissing(path.join(recipesRoot(workspaceRoot), fileName), content);
  });

  if (!fileExists(recipesIndexPath(workspaceRoot))) {
    writeJson(recipesIndexPath(workspaceRoot), {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      recipes: RECIPE_REGISTRY,
    });
  }

  Object.entries(ADAPTER_TEMPLATES).forEach(([fileName, content]) => {
    writeFileIfMissing(
      path.join(adaptersRoot(workspaceRoot), fileName),
      fileName.endsWith(".json") ? `${content}\n` : content
    );
  });

  if (!fileExists(projectConfigPath(workspaceRoot))) {
    writeJson(projectConfigPath(workspaceRoot), {
      schemaVersion: 1,
      repositoryName: path.basename(workspaceRoot),
      createdAt: new Date().toISOString(),
      adapters: ["codex", "claude-code"],
      dashboard: {
        defaultPort: 4173,
      },
      notes: "This file is portable and should not contain absolute paths.",
    });
  }
}

function readProjectConfig(workspaceRoot) {
  return readJson(projectConfigPath(workspaceRoot), {
    schemaVersion: 1,
    repositoryName: path.basename(workspaceRoot),
  });
}

function readTaskMeta(workspaceRoot, taskId) {
  return readJson(path.join(taskRoot(workspaceRoot, taskId), "task.json"), null);
}

function listTaskIds(workspaceRoot) {
  return listDirectories(tasksRoot(workspaceRoot));
}

function readTaskDoc(workspaceRoot, taskId, fileName) {
  return readText(path.join(taskRoot(workspaceRoot, taskId), fileName), "");
}

function taskFiles(workspaceRoot, taskId) {
  const root = taskRoot(workspaceRoot, taskId);
  return {
    root,
    meta: path.join(root, "task.json"),
    task: path.join(root, "task.md"),
    context: path.join(root, "context.md"),
    verification: path.join(root, "verification.md"),
    checkpoint: path.join(root, "checkpoint.md"),
    promptCodex: path.join(root, "prompt.codex.md"),
    promptClaude: path.join(root, "prompt.claude.md"),
    runs: runsRoot(workspaceRoot, taskId),
  };
}

module.exports = {
  adaptersRoot,
  decisionsRoot,
  ensureWorkflowScaffold,
  handoffsRoot,
  listTaskIds,
  memoryRoot,
  projectConfigPath,
  projectProfileMarkdownPath,
  projectProfilePath,
  readProjectConfig,
  readTaskDoc,
  readTaskMeta,
  recipesIndexPath,
  recipesRoot,
  RECIPE_REGISTRY,
  resolveWorkspaceRoot,
  runsRoot,
  taskFiles,
  taskRoot,
  tasksRoot,
  workflowRoot,
};

