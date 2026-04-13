# Agent Workflow Studio - Agent Guide

This file teaches any coding agent how to use agent-workflow-studio to manage tasks, record evidence, and maintain project memory.

If you are an agent reading this, follow the instructions below whenever the user asks you to work on a task in this repository.

When `skills:generate` is run, this guide is copied into `CLAUDE.md` (for Claude Code) and `AGENTS.md` (for Codex) at the target repository root so both agents pick it up automatically.

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

1. Read the project memory:
   - `.agent-workflow/memory/product.md`
   - `.agent-workflow/memory/architecture.md`
   - `.agent-workflow/memory/domain-rules.md`
2. Check existing tasks: `npx agent-workflow task:list --root .`
3. If no task exists for the current work, create one:
   - Use `npx agent-workflow quick "<task title>" --lite --root .` for the fastest capture flow.
   - Use `npx agent-workflow quick "<task title>" --full --root .` when you want context, verification, prompt, run-prep, and checkpoint files immediately.
   - The current CLI default is still Full Mode, so plain `quick "<task title>"` behaves like `--full`.
4. Open `task.md` and fill in:
   - Goal: one paragraph describing the user outcome
   - Scope: repo-relative paths using `repo path: src/auth/` format
   - Deliverables: what will be produced
   - Risks: what could go wrong
5. If `context.md` and `verification.md` already exist, fill them in immediately.
6. If they do not exist yet because the task was created in Lite Mode, let `prompt:compile`, `run:prepare`, `run:add`, `done`, or `checkpoint` materialize them when needed.

## After completing work

1. Identify which files you changed that are within the task scope.
2. Prefer the one-step completion command:
   ```bash
   npx agent-workflow done <taskId> "<one-line summary>" \
     --status passed \
     --proof-path <changed-file-1> \
     --proof-path <changed-file-2> \
     --check "<what you verified>" \
     --root .
   ```
   Add `--complete` when the task should also move to `done`. Use `--status draft` if verification is incomplete.
3. If you need the older explicit flow, keep using:
   ```bash
   npx agent-workflow run:add <taskId> "<one-line summary>" --status passed --root .
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
