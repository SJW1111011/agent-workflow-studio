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

As of 2026-04-04, the project already has a working MVP foundation:

- workflow scaffold generation under `.agent-workflow/`
- repository scanning and project profile generation
- task creation with recipe support
- Codex / Claude Code adapter contracts
- prompt compilation
- run preparation handoff packs
- shared `run:execute` for adapters that opt into `commandMode: exec`
- stdout/stderr capture plus timeout/interruption metadata for `run:execute`
- a local-only dashboard execution bridge for adapters that resolve to `stdioMode: pipe`
- dashboard-triggered local execution can now also request cancellation and surface transient `cancel-requested` state
- dashboard execution state now also carries a structured final outcome so the UI does not have to infer pass/fail/cancel from summary text
- dashboard task detail can now tail active local stdout/stderr through a local-only execution-log API while a shared executor run is still in flight
- dashboard execution state now also derives lightweight stream observability from those same task-local logs, including activity, byte counts, and last output time
- the dashboard execution log panel now switches to the persisted run log automatically once the run is durably recorded
- overview task cards now also surface the latest executor outcome separately from the latest overall run
- overview stats now also aggregate each task's latest executor outcome for dashboard-level reporting
- run evidence recording
- checkpoint generation
- recipe registry
- schema validation
- local dashboard
- lightweight freshness detection for memory docs and task markdown bundles
- first-pass diff-aware verification gates using scoped workspace file mtimes plus task scope hints
- stronger scope hint extraction for `task.md` markers like `path:` / `files:` / `dirs:`
- checkpoint refresh rules that now surface scoped files awaiting proof
- explicit proof linkage so generic verification edits no longer cover scoped changes unless repo-relative paths are named
- proof items now carry paths plus check/artifact refs, and the gate can report `partially-covered`
- passed runs can now persist structured `verificationChecks` and `verificationArtifacts`
- dashboard write actions for task creation, task metadata updates, markdown task doc edits, and structured run evidence creation
- metadata-managed task/context markdown blocks now stay stable during richer edits
- the dashboard editor now explains managed vs free-edit sections for each task document
- the dashboard run form can now prefill proof paths from pending scoped files
- the dashboard run form can now also draft one check line per pending scoped file
- the verification editor can now draft a pending proof plan from pending scoped files by inserting planned checks plus file-only proof-link placeholders
- the run form can now sync drafted proof paths/checks into the verification editor as an unsaved proof-plan draft
- the dashboard can now trigger local `run:execute` through a thin local API bridge, while task detail surfaces transient execution state plus persisted executor logs

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
- show diff-aware verification gate state from current scoped workspace file changes
- show checkpoint detail in task detail
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

Verified on 2026-04-04:

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
- markdown guardrails that keep managed task/context blocks synced without wiping nearby custom notes
- CLI executor path for `run:execute`, including run ledger + verification/checkpoint refresh
- dashboard executor bridge APIs for `POST /api/tasks/:taskId/execute` and `GET /api/tasks/:taskId/execution`
- dashboard active execution log API for `GET /api/tasks/:taskId/execution/logs/:stream`
- derived execution-state observability fields such as `activity`, `streams`, `lastOutputAt`, and `totalOutputBytes`
- seamless UI handoff from active execution tails to persisted run-log viewing after completion
- dashboard executor cancel API for `POST /api/tasks/:taskId/execution/cancel`
- executor capture mode and timeout path
- overview and task detail freshness heuristics for memory/task docs
- diff-aware verification gate status transitions from "needs proof" to "covered"
- checkpoint content for pending proof, covered proof, and weak scope hints
- explicit proof linkage: generic verification text stays insufficient, but passed scoped evidence can cover files
- structured run evidence: API/CLI run creation can persist scope proof paths plus concrete check/artifact refs
- proof item parsing for manual verification notes and passed run evidence
- overview aggregate stats for latest executor outcomes across tasks

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

1. Keep refining proof-capture shortcuts without letting drafts or placeholders masquerade as strong proof.
2. Add lightweight execution observability on top of the shared executor boundary, such as better log-tail UX or clearer run-state transitions, without inventing a second durable execution store.
3. Harden the new dashboard execution bridge without expanding it past the current `stdioMode: pipe` boundary.
4. Add richer freshness heuristics based on repository changes instead of only timestamps.
5. Keep interactive `stdioMode: inherit` flows CLI-only until there is a real terminal-ownership design.

## What not to do next

- do not rush into full process orchestration before the workflow model is stable
- do not build a cloud sync layer yet
- do not turn this into a generic chat shell
- do not hard-code absolute paths or machine-specific runner behavior

## Recommended immediate task for the next agent

Suggested first task:

Add low-risk execution observability while preserving the current shared-executor boundary.

Expected shape:

- keep `src/lib/run-executor.js` as the only launch implementation
- improve status/reporting/log visibility without inventing a second durable execution store
- do not duplicate adapter launch logic or turn the browser into a terminal surrogate

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
