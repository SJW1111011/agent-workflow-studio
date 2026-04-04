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
- `GET /api/tasks/:taskId/runs/:runId/logs/:stream`
- `GET /api/recipes`
- `GET /api/runs`
- `GET /api/validate`
- `POST /api/tasks`
- `PATCH /api/tasks/:taskId`
- `PUT /api/tasks/:taskId/documents/:documentName`
- `POST /api/tasks/:taskId/runs`

Writes are still local-only and only affect the target repository's `.agent-workflow/` state.

### 4. Dashboard layer

The dashboard renders:

- project overview
- task detail
- recipe registry
- schema summary
- task board
- task creation and task metadata editing forms
- lightweight markdown editing for `task.md`, `context.md`, and `verification.md`
- run evidence recording form with structured proof paths, checks, and artifact refs
- metadata-managed markdown blocks for task title/recipe/context constraints that stay stable during edits
- editor guidance that explains which sections are managed on save versus freeform
- run proof path shortcuts that can prefill pending scoped files from the current verification gate
- run check shortcuts that can draft one verification check per pending scoped file
- verification.md shortcuts that can draft a pending proof plan from the current scoped file set by inserting planned checks plus file-only Proof links placeholders
- run-form shortcuts that can sync drafted proof paths/checks into the verification editor as an unsaved proof plan
- checkpoint detail
- executor run metadata and task-local log inspection
- a local-only dashboard execution bridge that reuses the shared executor module for `stdioMode: pipe` adapters
- transient execution status plus cancel requests surfaced in task detail without creating a second durable execution database
- clearer dashboard reporting backed by a structured execution outcome field instead of summary-text inference
- overview task cards now expose the latest executor outcome separately from the latest overall run summary
- overview stats now aggregate each task's latest executor outcome for dashboard-level reporting
- memory freshness view
- diff-aware verification gate summaries
- risk queue
- verification summary

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
- scoped local changes are newer than the latest verification evidence
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

