# Issue Backlog

This file captures the first public issue drafts for the repository.

It exists so the work can stay structured even when issue creation is done later by hand or through another tool.

## 1. Design `run:execute` without breaking the contract-first architecture

Suggested labels:

- `design`
- `executor`
- `architecture`

Title:

`Design run:execute local executor without breaking the contract-first adapter layer`

Problem:

The project can already create prompt bundles, adapter handoff packs, runs, and checkpoints, but it cannot yet launch a local executor in a structured way. We need execution automation, but not at the cost of schema drift, machine-specific assumptions, or turning adapters into hard-coded vendor glue.

Why it matters:

- automation is a core product goal
- execution should still leave durable evidence
- handoff contracts should remain inspectable and portable
- future agent/runtime integrations should not require rewriting the workflow model

Acceptance criteria:

- define the boundary between `run-request.<adapter>.json`, adapter config, and runtime-only execution state
- define what `run:execute` reads, what it writes, and what it must never persist
- define how stdout, stderr, exit code, timestamps, and execution status map into `runs/*.json`
- define how verification docs and checkpoints refresh after execution
- define how user-approved local commands fit without baking absolute paths into the project state

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

Non-goals:

- full CI integration on the first pass
- deep language-aware static analysis
- replacing human judgment with a single numeric score
