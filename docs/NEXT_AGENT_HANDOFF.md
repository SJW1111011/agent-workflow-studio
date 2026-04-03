# Next Agent Handoff

This document is the restart point for the next agent that takes over `agent-workflow-studio`.

## Mission

Continue building `agent-workflow-studio` as a local-first workflow OS and project control plane for Codex and Claude Code.

The product direction is already chosen:

- tasks should compile into strong prompts
- runs should leave evidence
- evidence should refresh docs and checkpoints
- long jobs should survive context compaction and handoff

## Current status

As of 2026-04-03, the project already has a working MVP foundation:

- workflow scaffold generation under `.agent-workflow/`
- repository scanning and project profile generation
- task creation with recipe support
- Codex / Claude Code adapter contracts
- prompt compilation
- run preparation handoff packs
- CLI-only `run:execute` for adapters that opt into `commandMode: exec`
- stdout/stderr capture plus timeout/interruption metadata for `run:execute`
- run evidence recording
- checkpoint generation
- recipe registry
- schema validation
- local dashboard
- lightweight freshness detection for memory docs and task markdown bundles
- dashboard write actions for task creation, task metadata updates, markdown task doc edits, and run evidence creation

## Important constraint

If this project is still nested inside the original repository when you read this:

- do not modify files outside `agent-workflow-studio`
- do not touch unrelated files in the parent repo
- especially do not touch the parent repo's dirty data files

Once this folder is moved into its own location, keep that same discipline inside the new repo.

## What has been implemented

### Core CLI

Files:

- `src/cli.js`
- `src/lib/workspace.js`
- `src/lib/scanner.js`
- `src/lib/task-service.js`
- `src/lib/task-documents.js`
- `src/lib/prompt-compiler.js`
- `src/lib/run-preparer.js`
- `src/lib/checkpoint.js`
- `src/lib/adapters.js`
- `src/lib/recipes.js`
- `src/lib/schema-validator.js`
- `src/lib/overview.js`

Supported commands:

- `init`
- `scan`
- `adapter:list`
- `recipe:list`
- `task:new`
- `task:list`
- `prompt:compile`
- `run:prepare`
- `run:execute`
- `run:add`
- `checkpoint`
- `overview`
- `validate`

### Dashboard

Files:

- `src/server.js`
- `dashboard/index.html`
- `dashboard/styles.css`
- `dashboard/app.js`

Current dashboard capabilities:

- show overview stats
- show adapters
- show recipes
- show schema summary
- show tasks
- show task detail
- show memory / risks / verification / recent runs
- show memory and task doc freshness
- inspect executor metadata and local stdout/stderr logs in task detail
- create tasks
- update selected task metadata
- edit `task.md`, `context.md`, and `verification.md`
- record run evidence

### Documentation

Start here:

- `README.md`
- `docs/PRD.md`
- `docs/ARCHITECTURE.md`
- `docs/ADAPTERS.md`
- `docs/RECIPES_AND_SCHEMA.md`
- `docs/ROADMAP.md`
- `docs/RELOCATABLE_DESIGN.md`

## What was validated locally

Verified on 2026-04-02:

- `npm run smoke`

The smoke test currently covers:

- CLI initialization
- repository scan
- adapter listing
- recipe listing
- task creation with recipe
- prompt compilation
- run preparation
- run evidence recording
- checkpoint generation
- schema validation
- local server startup
- overview API
- task detail API
- dashboard write APIs for creating tasks, updating tasks, editing task docs, and recording runs
- CLI executor path for `run:execute`, including run ledger + verification/checkpoint refresh
- executor capture mode and timeout path
- overview and task detail freshness heuristics for memory/task docs

## Why moving the folder should be safe

This project was deliberately built to be relocatable:

- generated workflow files do not persist absolute machine paths
- the CLI resolves the target repository from `--root` or `process.cwd()`
- the local server resolves dashboard assets relative to `src/server.js`
- the dashboard reads live state from the chosen target repository at runtime

After moving the project, the first verification step should be:

```bash
npm run smoke
```

## Highest-priority next steps

Recommended next sequence:

1. Add diff-aware verification gates.
2. Harden task-level guardrails so metadata-managed markdown blocks stay stable during richer edits.
3. Surface executor state even more clearly in the dashboard and task detail flows.
4. Add richer freshness heuristics based on repository changes instead of only timestamps.
5. Only after the local executor is stable, extend dashboard-triggered execution.

## What not to do next

- do not rush into full process orchestration before the workflow model is stable
- do not build a cloud sync layer yet
- do not turn this into a generic chat shell
- do not hard-code absolute paths or machine-specific runner behavior

## Recommended immediate task for the next agent

Suggested first task:

Add diff-aware verification gates on top of the current freshness heuristics.

Expected shape:

- tie changed work more explicitly to verification expectations
- build on top of the current timestamp-based freshness heuristics
- keep the executor contract stable while improving trust signals

## Useful commands

```bash
npm run smoke
npm run dashboard -- --root ../some-target-repo --port 4173
npm run init -- --root ../some-target-repo
npm run scan -- --root ../some-target-repo
npm run task:new -- T-001 "Example task" --priority P1 --recipe feature --root ../some-target-repo
npm run validate -- --root ../some-target-repo
```

## Final note for the next agent

This project is no longer at the blank-scaffold stage.

It already has:

- a strong local-first direction
- a working schema
- a functioning dashboard
- a tested mutation flow

So the next work should preserve coherence, not just add features.
