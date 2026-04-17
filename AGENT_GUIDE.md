# Agent Workflow Studio - Agent Guide

This file teaches any coding agent how to use agent-workflow-studio. When `skills:generate` is run, this guide is copied into `CLAUDE.md` and `AGENTS.md` at the target repository root.

## Choose your workflow

Pick the path that matches your environment:

### MCP path (recommended when available)

If you are running inside Codex, Claude Code, or Cursor with MCP configured, use the `workflow_*` tools directly. No terminal commands needed.

```
workflow_quick({ title: "Add auth", mode: "lite" })
# ... do the work ...
workflow_done({ taskId: "T-001", summary: "Implemented JWT login", complete: true })
```

Other useful tools: `workflow_task_list`, `workflow_overview`, `workflow_update_task`, `workflow_append_note`, `workflow_undo`, `workflow_validate`.

Install MCP once per client:

```bash
npx agent-workflow mcp:install --client codex --root .
npx agent-workflow mcp:install --client claude --root .
npx agent-workflow mcp:install --client cursor --root .
```

### CLI path (when MCP is not available)

```bash
npx agent-workflow quick "Add auth" --lite --root .
# ... do the work ...
npx agent-workflow done T-001 "Implemented JWT login" --complete --root .
```

`done` auto-infers changed files from `git diff`. Zero flags needed for the common case.

### Full audit path (compliance / heavy review)

```bash
npx agent-workflow quick "Add auth" --full --agent codex --root .
# Fill in task.md, context.md, verification.md
npx agent-workflow prompt:compile T-001 --root .
# Hand prompt to agent, or use run:execute
npx agent-workflow done T-001 "Implemented JWT login" --status passed \
  --proof-path src/auth.js --check "tests pass" --complete --root .
```

Add `--strict` for fingerprint-backed evidence freshness.

## Workflow state

All workflow state lives inside `.agent-workflow/` at the repository root:

- `memory/` - project knowledge: `product.md`, `architecture.md`, `domain-rules.md`, `runbook.md`
- `tasks/` - one folder per task; Lite tasks may start with only `task.json` and `task.md`, while Full tasks also include `context.md`, `verification.md`, `checkpoint.md`, prompt files, and run-prep artifacts
- `adapters/` - adapter configs for Codex, Claude Code, and custom agents
- `project.json` - stable project configuration
- `project-profile.md` - generated repository snapshot

## Initialization

If `.agent-workflow/` does not exist yet, initialize it:

```bash
npx agent-workflow init --root .
npx agent-workflow scan --root .
npx agent-workflow memory:bootstrap --root .
```

Then read `.agent-workflow/handoffs/memory-bootstrap.md` and follow its instructions to fill the memory docs. Replace placeholder text with repo-grounded facts. If something is unknown, write it as an open question instead of guessing.

After writing memory docs, validate the scaffold:

```bash
npx agent-workflow validate --root .
```

## Before starting any task

1. Check existing tasks: `npx agent-workflow task:list --root .` (or `workflow_task_list` via MCP)
2. If no task exists for the current work, create one:
   - **Lite** (default for most work): `quick "title" --lite` — creates only `task.json` + `task.md`
   - **Full** (audit/compliance): `quick "title" --full` — creates all docs + prompt + checkpoint
3. Optionally read project memory under `.agent-workflow/memory/` for context.

## After completing work

Use `done` — it records evidence, refreshes the checkpoint, and optionally marks the task complete in one step:

```bash
npx agent-workflow done <taskId> "<summary>" --complete --root .
```

Or via MCP:

```
workflow_done({ taskId: "T-001", summary: "what I did", complete: true })
```

`done` auto-infers proof paths from `git diff` and auto-advances task status from `todo` to `in_progress`. Add `--status passed` and `--check "tests pass"` when you have specific verification to record.

If you need the older explicit flow:

```bash
npx agent-workflow run:add <taskId> "<summary>" --status passed --root .
npx agent-workflow checkpoint <taskId> --root .
```

## Checking workflow status

```bash
npx agent-workflow task:list --root .
npx agent-workflow validate --root .
```

Read the validation output and task list. If there are risks, stale docs, or tasks needing proof, tell the user what needs attention.

## Updating project memory

When you discover new architectural facts, constraints, or domain rules during your work, update the relevant memory doc under `.agent-workflow/memory/`. Keep notes concise, durable, and handoff-friendly.

After significant changes to the project structure:

```bash
npx agent-workflow scan --root .
npx agent-workflow memory:bootstrap --root .
```

## Rules

- Always use repo-relative paths in scope and proof, never absolute paths.
- Never fake verification evidence.
- If verification is incomplete, use `--status draft` instead of `--status passed`.
- Keep changes within the declared task scope.
- Record evidence immediately after completing work, not later.
- Update memory docs when you learn something new about the project.
- Prefer explicit unknowns over confident guesses.
