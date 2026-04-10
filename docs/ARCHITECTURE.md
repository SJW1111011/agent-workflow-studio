# Architecture

Agent Workflow Studio is the missing layer between coding agents and a real repository.

It does not try to replace Git, an editor, or the agent CLI itself. Instead, it turns the messy middle of agent work into durable local artifacts:

- tasks become explicit bundles
- prompts become reproducible files
- runs become evidence
- evidence refreshes verification and checkpoints
- long jobs survive interruption and handoff

If you are new to the docs, start with `README.md`, then come here, then continue into the deeper design notes linked at the end.

## The core idea

Everything revolves around one decision: workflow state lives inside the target repository under `.agent-workflow/`.

That means the system stays:

- local-first
- Git-native
- inspectable by humans
- readable by agents
- movable across machines
- free of hidden databases or cloud state

The CLI and dashboard are just two ways to read and mutate the same file-based workflow state.

## System at a glance

```text
User or agent
     |
     v
CLI commands / local dashboard
     |
     v
.agent-workflow/ inside the target repo
     |
     +--> task bundles, prompts, run requests, checkpoints
     +--> memory docs, adapters, recipes, validation state
     |
     v
Local agent runtime (manual handoff or exec adapter)
     |
     v
Run logs + verification evidence + refreshed checkpoint
```

## The main objects

The architecture makes more sense if you think in terms of a few durable objects instead of individual commands.

### Project

`project.json` is the stable root config for the workflow layer.

It records the repo-level contract: which adapters exist, which recipes are available, and which scaffold conventions the workspace follows.

### Project profile

`project-profile.json` and `project-profile.md` are generated snapshots of the repository.

They capture facts such as:

- top-level directories
- scripts
- package-manager hints
- docs that already exist
- scanner recommendations

This is the grounding layer that keeps prompt generation and memory bootstrap tied to the real repo instead of guesswork.

### Memory docs

Memory docs are the durable project context that an agent should be able to reload later:

- product
- architecture
- domain rules
- runbook

They are intentionally plain markdown so they can be edited, reviewed, versioned, and fed back into prompts.

### Task bundle

Each task gets its own folder under `.agent-workflow/tasks/<taskId>/`.

A task bundle combines:

- structured metadata in `task.json`
- narrative intent in `task.md`
- working context in `context.md`
- verification planning and proof in `verification.md`
- resumable summary in `checkpoint.md`
- compiled prompts and launch packs
- recorded run files in `runs/`

This is the center of the system. A task is not just a title; it is the durable container for the whole work loop.

### Adapter

Adapters describe how workflow state connects to a concrete agent runtime.

An adapter can stay manual, where the user copies files into an agent session, or opt into `commandMode: exec`, where the local executor launches the agent and records evidence.

### Run record

A run record is the durable output of a work attempt.

It stores:

- summary and status
- agent identity
- structured proof paths
- verification checks and artifacts
- optional proof anchors
- stdout and stderr logs for executor-backed runs

Run records are what make the system auditable instead of purely conversational.

## What lives in `.agent-workflow/`

The exact contents grow over time, but the mental model stays stable:

```text
.agent-workflow/
  project.json
  project-profile.json
  project-profile.md
  memory/
  recipes/
  adapters/
  handoffs/
  decisions/
  tasks/
    T-001/
      task.json
      task.md
      context.md
      verification.md
      checkpoint.md
      prompt.codex.md
      run-request.codex.json
      launch.codex.md
      runs/
```

The important part is not the exact file count. The important part is that the system writes its state into the repo in a way that is reviewable and relocatable.

## The daily workflow loop

At a high level, the product runs in five steps:

1. Build context
   - initialize the scaffold
   - scan the repo
   - bootstrap and validate memory
2. Bundle the task
   - create a task with `quick` or `task:new`
   - fill scope, context, risks, and planned checks
3. Execute
   - hand the prompt to Codex or Claude Code manually
   - or use an adapter with `run:execute`
4. Review proof
   - inspect `verification.md`
   - review recorded runs and logs
   - confirm the verification gate state
5. Refresh the handoff
   - update `checkpoint.md`
   - leave the task in a state another agent or future session can resume

That loop is what the README hero diagram is visualizing.

## The runtime layers

### 1. Storage layer

The storage layer is the repo-local `.agent-workflow/` tree.

This is the source of truth. Everything else is a lens over it.

Key consequence: there is no separate database for tasks, executions, or verification state.

### 2. CLI layer

The CLI is the authoring and automation surface.

It owns commands such as:

- `init`
- `scan`
- `memory:bootstrap`
- `memory:validate`
- `quick`
- `prompt:compile`
- `run:prepare`
- `run:execute`
- `run:add`
- `checkpoint`
- `validate`
- `skills:generate`

The CLI is also where the system stays strict about portability: generated workflow files do not store machine-specific absolute paths.

### 3. Local control-plane API

The local server is a thin HTTP layer over the same workspace state.

Representative routes include:

- `GET /api/overview`
- `GET /api/tasks`
- `GET /api/tasks/:taskId`
- `POST /api/quick`
- `POST /api/tasks/:taskId/execute`
- `POST /api/tasks/:taskId/verification/anchors/refresh`
- `GET /api/validate`

This API is intentionally local-only. It exists to power the dashboard, not to introduce a hosted backend.

### 4. Dashboard layer

The dashboard is the visual control plane.

It gives a faster way to see and edit:

- overview stats
- task state
- runs and logs
- risks
- memory freshness
- verification signals
- quick creation and task metadata
- markdown docs such as `task.md`, `context.md`, and `verification.md`

The dashboard does not own a second state model. It reads and writes the same repo-local files the CLI uses.

### 5. Agent skill layer

`skills:generate` turns the workflow into agent-readable guidance.

It writes:

- `AGENTS.md` for Codex
- `CLAUDE.md` for Claude Code
- Claude slash-command templates

This layer matters because it teaches the agent to follow the same file-based workflow protocol instead of inventing a parallel one.

## Verification and trust model

The most distinctive part of the architecture is the trust layer.

Most agent tooling stops at "a run happened." This project goes further and asks: "what proof still covers the current repo state?"

### Repository snapshot

Verification starts from a repository snapshot boundary, not from ad hoc timestamp guesses.

The snapshot:

- prefers Git dirty-state data from `git status --porcelain=v2`
- falls back to filesystem mode when Git is unavailable
- normalizes file-change information into a reusable shape
- is reused across overview and task-detail derivation

### Verification gate

The verification gate compares task scope against the current repository snapshot.

Its job is to answer questions like:

- which scoped files changed
- which ones have explicit proof
- which proof is only partial or weak
- which tasks still need proof before they are trustworthy again

This is why task scope quality matters so much in `task.md`.

### Proof anchors

Proof anchors make freshness content-aware instead of `mtime`-only.

When a passed run or refreshed manual proof stores content fingerprints for scoped files, the gate can tell the difference between:

- real content drift
- branch-switch noise
- timestamp churn

That is the key step that turns verification from a heuristic into a more deterministic contract.

### Manual proof still stays human-readable

`verification.md` remains a human-edited document.

The system can add managed anchor metadata, but the visible proof plan and proof links stay in markdown so the task remains readable during review.

## Execution model

Execution is deliberately split into two modes.

### Manual mode

Manual mode is the safest default.

The system creates prompts, run requests, and launch packs, but the user decides how to hand them to the agent.

### Exec mode

`commandMode: exec` lets a local adapter launch the agent directly.

That path adds:

- shared execution planning
- preflight readiness checks
- env allowlist handling
- stdout and stderr capture
- timeout and interruption handling
- durable run evidence

The executor is still local-first. It does not depend on a hosted job runner or cloud queue.

## Why the dashboard does not need a database

A common temptation would be to add a separate runtime database for execution state or UI state.

The current design deliberately avoids that.

Instead:

- durable state goes into `.agent-workflow/`
- transient dashboard execution state is derived locally
- persisted logs stay task-local
- overview and task detail are rebuilt from repo state

That keeps the architecture easier to inspect, relocate, and reason about under Git.

## Why this architecture is relocatable

Relocatability is not an extra feature. It is a design constraint.

The system keeps that promise by:

- resolving the target repo from runtime input
- writing repo-relative paths into generated artifacts
- avoiding hardcoded database locations
- keeping dashboard assets in the tool repo and workflow state in the target repo

See `RELOCATABLE_DESIGN.md` for the deeper rationale.

## Current boundaries

The architecture is intentionally opinionated about what it is not.

It is not:

- a cloud sync service
- a generic issue tracker
- a database-backed project manager
- a replacement for Git
- a replacement for the agent CLI itself

It is a local workflow OS for turning agent work into inspectable, resumable project state.

## Where to go deeper

- `GETTING_STARTED.md` - the shortest verified onboarding path
- `VERIFICATION_FRESHNESS_DESIGN.md` - verification gate and proof-anchor details
- `RUN_EXECUTE_DESIGN.md` - executor planning, preflight, and lifecycle boundaries
- `ADAPTERS.md` - adapter contract and custom adapter scaffolding
- `RECIPES_AND_SCHEMA.md` - recipe and validation details
- `RELOCATABLE_DESIGN.md` - why the file model stays movable
- `NEXT_AGENT_HANDOFF.md` - the latest compact implementation status
