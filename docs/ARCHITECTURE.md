# Architecture

## System shape

The first version is deliberately simple:

- a zero-dependency Node.js CLI
- a zero-dependency local HTTP server
- a structured `.agent-workflow/` folder inside the target repository
- a static dashboard that consumes live JSON from the local server

## Layers

### 1. Workflow storage layer

All project memory and task artifacts live inside the target repository:

```text
.agent-workflow/
  adapters/
  project.json
  project-profile.json
  project-profile.md
  memory/
  recipes/
    index.json
  decisions/
  handoffs/
  tasks/
```

This keeps the workflow state:

- readable by humans
- readable by agents
- versionable in Git
- portable across machines

### 2. CLI layer

The CLI owns:

- scaffold creation
- repository scanning
- quick task bootstrap over the existing file-based workflow
- memory bootstrap prompt generation for scaffold docs
- adapter contract generation
- recipe registry generation
- task creation
- prompt compilation
- run preparation
- run execution
- run recording
- checkpoint generation
- schema validation

The CLI never stores absolute paths in workflow documents.

### 3. Control plane API

The local HTTP server exposes:

- `GET /api/health`
- `GET /api/overview`
- `GET /api/tasks`
- `GET /api/tasks/:taskId`
- `GET /api/tasks/:taskId/execution`
- `GET /api/tasks/:taskId/execution/logs/:stream`
- `GET /api/tasks/:taskId/runs/:runId/logs/:stream`
- `GET /api/recipes`
- `GET /api/runs`
- `GET /api/validate`
- `POST /api/tasks`
- `POST /api/tasks/:taskId/execute`
- `POST /api/tasks/:taskId/execution/cancel`
- `POST /api/tasks/:taskId/verification/anchors/refresh`
- `PATCH /api/tasks/:taskId`
- `PUT /api/tasks/:taskId/documents/:documentName`
- `POST /api/tasks/:taskId/runs`

Writes are still local-only and only affect the target repository's `.agent-workflow/` state.

Server-facing modules are expected to throw explicit HTTP-aware errors (`statusCode` and optional stable `code`) so the local API can preserve its `{ error }` payload contract without mapping status codes from message text.

### 4. Dashboard layer

The dashboard renders:

- project overview
- task detail
- recipe registry
- schema summary
- task board
- task creation and task metadata editing forms
- lightweight markdown editing for `task.md`, `context.md`, and `verification.md`
- an explicit manual proof-anchor refresh action for `verification.md` that stays local-only
- run evidence recording form with structured proof paths, checks, and artifact refs
- metadata-managed markdown blocks for task title/recipe/context constraints that stay stable during edits
- editor guidance that explains which sections are managed on save versus freeform
- a verification editor flow that hides the managed manual proof-anchor JSON from the primary editing surface while still preserving that block on save
- task detail and task cards now distinguish anchor-backed strong proof from compatibility-only strong proof so the freshness path is visible without reading raw markdown
- run proof path shortcuts that can prefill pending scoped files from the current verification gate
- run check shortcuts that can draft one verification check per pending scoped file
- verification.md shortcuts that can draft a pending proof plan from the current scoped file set by inserting planned checks plus file-only Proof links placeholders
- run-form shortcuts that can sync drafted proof paths/checks into the verification editor as an unsaved proof plan
- checkpoint detail
- executor run metadata and task-local log inspection
- a local-only dashboard execution bridge that reuses the shared executor module for `stdioMode: pipe` adapters
- transient execution status plus cancel requests surfaced in task detail without creating a second durable execution database
- clearer dashboard reporting backed by a structured execution outcome field instead of summary-text inference
- active execution stdout/stderr tail inspection through a local-only execution-log API backed by the same task-local log files
- derived execution observability in task detail, such as awaiting-output vs streaming-output, stream byte counts, and last output time
- a seamless handoff from active execution tails to persisted run-log viewing once the executor run is durably recorded
- clearer task-detail outcome layering so timeout, interruption, cancellation, and generic failure do not collapse into one visual state
- overview task cards now expose the latest executor outcome separately from the latest overall run summary
- overview stats now aggregate each task's latest executor outcome for dashboard-level reporting
- overview stats now also aggregate task-level verification signals so the board can distinguish planned-only checks, draft proof, mixed proof, and strong proof at a glance
- overview task cards now expose the task-level verification signal summary without opening task detail
- memory freshness view
- diff-aware verification gate summaries backed by a Git-aware repository snapshot with filesystem fallback
- risk queue
- verification summary

The browser-side code stays static and local-only:

- `dashboard/app.js` remains the orchestration layer for fetches, state transitions, and DOM wiring
- document/proof drafting helpers can live in separate static modules such as `dashboard/document-helpers.js`
- overview/task-board derivation helpers can live in separate static modules such as `dashboard/task-board-helpers.js`
- API request/url helpers can live in separate static modules such as `dashboard/api-client-helpers.js`
- form/editor state derivation helpers can live in separate static modules such as `dashboard/form-state-helpers.js`
- form event-flow helpers can live in separate static modules such as `dashboard/form-event-helpers.js`
- orchestration state derivation helpers can live in separate static modules such as `dashboard/orchestration-state-helpers.js`
- task-list/card renderers can live in separate static modules such as `dashboard/task-list-render-helpers.js`
- execution/run detail presentation helpers can live in separate static modules such as `dashboard/execution-detail-helpers.js`
- task-detail / verification rendering helpers can live in separate static modules such as `dashboard/task-detail-helpers.js`
- log-panel state/render helpers can live in separate static modules such as `dashboard/log-panel-helpers.js`
- overview/list section renderers can live in separate static modules such as `dashboard/overview-render-helpers.js`
- no bundler or cloud build step is required for these refactors

## Data model

### Project

`project.json` is the stable configuration for the workflow layer.

### Project profile

`project-profile.json` is a generated snapshot of:

- detected scripts
- package managers
- docs
- top-level directories
- scanner recommendations

### Repository snapshot

Verification freshness now depends on an internal repository snapshot boundary rather than ad hoc workspace walks.

That snapshot:

- prefers Git dirty-state data from `git status --porcelain=v2`
- falls back to filesystem mode for non-Git or constrained environments
- normalizes file entries as `path + changeType + gitState + previousPath + modifiedAt`
- caches direct proof-path fingerprints in memory by file path plus `mtime` so repeated refreshes do not keep re-hashing unchanged files
- keeps filesystem fallback targeted by fingerprinting proof paths on demand instead of hashing the whole workspace
- is reused once per overview or task-detail request so verification does not scan the workspace per task

### Task

Each task folder contains:

- `task.json`
- `task.md`
- `context.md`
- `verification.md`
- `checkpoint.md`
- `prompt.codex.md`
- `prompt.claude.md`
- `launch.codex.md`
- `launch.claude-code.md`
- `run-request.codex.json`
- `run-request.claude-code.json`
- `runs/*.json`

This split allows both structured data and rich narrative context.

`verification.md` can now also hold an optional managed `## Evidence` block for manual proof anchors, while keeping `## Proof links` human-authored.

### Validation report

The validation layer returns:

- repository-wide issues
- counts by severity
- task-level issues that can be filtered into the task detail view

## Risk derivation

The first dashboard pass computes risks from simple heuristics:

- workflow not initialized
- project profile missing
- memory docs still contain placeholders
- memory docs older than the current freshness threshold
- task has no compiled prompt
- task has no run evidence
- latest run failed
- task docs older than recent workflow activity or the current freshness threshold
- scoped local changes in the current repository snapshot are newer than the latest verification evidence
- scoped local changes are not explicitly linked to proof paths yet
- proof only partially covers the scoped changed files
- proof items exist but are too weak because they lack clear checks or artifact refs
- active tasks have local changes but no repo-relative scope hints
- task scope still contains ambiguous entries that cannot be matched automatically

Later versions can add:

- diff-aware stale docs based on changed files
- richer dashboard proof capture controls on top of the current structured check/artifact model
- contract mismatches
- fake implementation heuristics

## Why this is relocatable

- the tool root is only used to locate local source files and dashboard assets
- the target repository is always resolved from runtime input
- generated content uses repository-relative paths
- no database path is hardcoded

See `docs/RELOCATABLE_DESIGN.md`.

