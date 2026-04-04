# Issue Backlog

This file captures the first public issue drafts for the repository.

It exists so the work can stay structured even when issue creation is done later by hand or through another tool.

## 1. Surface executor state more clearly in the dashboard

Suggested labels:

- `executor`
- `dashboard`
- `ux`

Title:

`Surface executor status, logs, and failure signals more clearly in the dashboard`

Problem:

The project now has a CLI-only `run:execute` path with stdout/stderr capture and timeout metadata, but the dashboard does not yet present that evidence well. Runs are persisted, yet the operator still has to inspect raw files to quickly understand what happened.

Why it matters:

- automation is a core product goal
- execution should still leave durable evidence
- failed runs should be easier to triage
- operators should be able to inspect executor evidence without dropping out of the control plane

Acceptance criteria:

- show executor-specific fields such as exit code, timeout, interruption signal, and log paths in task detail
- distinguish manual evidence from executor evidence in the dashboard
- keep the underlying contract-first executor model unchanged
- avoid turning the dashboard into a terminal emulator
- document the UI behavior clearly

Non-goals:

- full multi-agent orchestration
- cloud execution
- transcript ingestion for every vendor on day one

## 2. Add freshness detection for memory docs and task docs

Suggested labels:

- `dashboard`
- `verification`
- `docs`

Title:

`Add freshness detection for memory docs and task markdown bundles`

Problem:

The dashboard can show memory docs and task detail, but it does not yet score whether docs still look fresh relative to recent workflow activity. That makes it too easy for project memory and task context to silently decay.

Why it matters:

- stale docs weaken prompt quality
- stale verification notes reduce trust in evidence
- handoffs become less reliable when memory and checkpoints lag behind recent work

Acceptance criteria:

- define simple freshness heuristics for memory docs and task docs
- surface freshness state in overview risks and task detail
- keep the first version local-only and dependency-light
- avoid relying on absolute paths or external services
- document the heuristic limits clearly

Status:

- first timestamp-based freshness heuristics are now implemented
- next iteration should become more diff-aware and less purely time-based

Non-goals:

- full semantic diffing
- cloud document history
- heavy indexing systems

## 3. Add diff-aware verification gates

Suggested labels:

- `verification`
- `schema`
- `automation`

Title:

`Add diff-aware verification gates so changed work requires explicit proof`

Problem:

The workflow layer can record run evidence, but it does not yet connect evidence quality to what actually changed. That makes it possible to have a task that looks active without a strong answer to whether changed files were truly verified.

Why it matters:

- evidence should be proportional to the change surface
- tasks should not move toward done based on optimistic summaries alone
- verification state should become a stronger part of the control plane

Acceptance criteria:

- define a first-pass diff-aware verification model for local repositories
- add task-level and overview-level signals for missing proof
- keep the checks explainable and auditable
- avoid blocking the workflow on perfect automation
- update docs so contributors understand the contract

Status:

- first local-only diff-aware verification gates are now implemented
- current matching depends on repo-relative scope hints and current workspace file mtimes
- scope extraction and checkpoint refresh rules have now improved
- explicit proof linkage has now improved through repo-relative proof paths
- proof paths now connect to concrete checks and artifact refs through proof items
- next iteration should strengthen how proof items connect to command execution outputs and external artifacts

Non-goals:

- full CI integration on the first pass
- deep language-aware static analysis
- replacing human judgment with a single numeric score
