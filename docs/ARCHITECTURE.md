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
- run evidence recording form
- executor run metadata and task-local log inspection
- memory freshness view
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

Later versions can add:

- diff-aware stale docs based on changed files
- diff-aware verification gaps
- contract mismatches
- fake implementation heuristics

## Why this is relocatable

- the tool root is only used to locate local source files and dashboard assets
- the target repository is always resolved from runtime input
- generated content uses repository-relative paths
- no database path is hardcoded

See `docs/RELOCATABLE_DESIGN.md`.

