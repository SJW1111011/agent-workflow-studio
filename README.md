# Agent Workflow Studio

Agent Workflow Studio is a local-first workflow OS and project control plane for Codex and Claude Code.

The product thesis is simple:

- tasks should compile into strong prompts
- runs should leave evidence
- evidence should refresh docs and checkpoints
- long jobs should survive context compaction and agent handoff

This repository starts with a relocatable foundation:

- a headless workflow scaffold in `.agent-workflow/`
- a zero-dependency CLI to initialize, scan, create tasks, compile prompts, and record runs
- a lightweight dashboard that reads the workflow state from any repository root
- a smoke test that proves the project still works when nested under a non-English path

## Why this exists

Most teams using coding agents still lack:

- stable project memory
- structured task context
- trustworthy verification state
- resumable checkpoints
- a shared control plane across Codex and Claude Code

Agent Workflow Studio is designed to become that missing layer.

## Current MVP

The current foundation includes:

- `init`: create `.agent-workflow/` with memory docs, recipes, decisions, handoffs, and task folders
- `scan`: generate a project profile from the target repository
- `adapter:list`: inspect the built-in Codex and Claude Code adapter contracts
- `recipe:list`: inspect the built-in workflow recipes
- `task:new`: create a structured task package with both machine-readable and human-readable context
- `prompt:compile`: generate Codex or Claude Code prompts from workflow state
- `run:prepare`: generate an execution handoff pack for a specific adapter
- `run:execute`: launch a local adapter when its config explicitly opts into `commandMode: exec`
- `run:add`: append execution evidence to a task, including optional proof paths, checks, and artifact refs
- `checkpoint`: build a resumable checkpoint for the current task
- `validate`: run schema checks on project, adapters, tasks, and recorded runs
- `dashboard`: open a local control plane for tasks, memory freshness, task doc freshness, diff-aware verification gates, checkpoint detail, metadata edits, structured run evidence capture, a local execution bridge for `stdioMode: pipe` adapters, executor state/cancel flow, and markdown task doc edits

## Layout

```text
agent-workflow-studio/
  docs/
  dashboard/
  scripts/
  src/
```

Once initialized against a target repository, that repository receives:

```text
.agent-workflow/
  project.json
  project-profile.json
  project-profile.md
  memory/
  recipes/
  decisions/
  handoffs/
  tasks/
```

## Quick start

Run everything from this project root:

```bash
npm run init -- --root ../some-repo
npm run scan -- --root ../some-repo
npm run adapter:list
npm run recipe:list -- --root ../some-repo
npm run task:new -- T-001 "Build the scanner" --priority P1 --recipe feature --root ../some-repo
npm run prompt:compile -- T-001 --agent codex --root ../some-repo
npm run run:prepare -- T-001 --agent codex --root ../some-repo
npm run run:execute -- T-001 --agent codex --root ../some-repo
npm run run:add -- T-001 "Initial scanner pass completed." --status passed --root ../some-repo
npm run checkpoint -- T-001 --root ../some-repo
npm run validate -- --root ../some-repo
npm run dashboard -- --root ../some-repo --port 4173
```

Then open `http://localhost:4173`.

## Relocatable by design

This project is intentionally safe to move to another directory later.

- No absolute paths are written into generated workflow files.
- The CLI and dashboard resolve the target repository from `--root` or the current working directory.
- The dashboard reads data from the target repository at runtime instead of baking the source path into the build.
- The smoke test runs from the current nested path to catch path-resolution regressions early.

See `docs/RELOCATABLE_DESIGN.md` for details.

## Adapter layer

The first adapter pass does not hard-wire a specific vendor launch flow into the core.

Instead it provides:

- stable adapter contracts under `.agent-workflow/adapters/`
- agent-specific prompt targets
- execution handoff packs such as `run-request.codex.json` and `launch.codex.md`
- a place to customize local runner commands after you confirm your environment

There is now a first local `run:execute` bridge for adapters that explicitly switch to `commandMode: exec`.

- built-in adapters still default to `manual`
- the first executable pass keeps the contract-first structure
- execution writes evidence back into `runs/*.json`, `verification.md`, and `checkpoint.md`
- `stdioMode: inherit` and `stdioMode: pipe` are supported
- capture mode can persist stdout and stderr logs under the task run ledger
- execution can record timeout and interruption metadata
- the dashboard task detail can inspect executor metadata and local run logs through local-only APIs
- the CLI can launch both `inherit` and `pipe` modes through the shared executor
- the dashboard now uses a thin local API over that same executor module for `stdioMode: pipe`
- the dashboard can request cancellation for an active local `pipe` execution, and the interrupted run still lands in the task ledger with evidence
- the dashboard execution bridge now exposes a structured local outcome (`passed`, `timed-out`, `interrupted`, `cancelled`, `failed-to-start`) so task detail and recent runs do not need to guess from summary text
- the dashboard execution panel can now tail the active local stdout/stderr logs through a local-only API while the shared executor is still running
- the execution state payload now also derives lightweight stream observability from those same task-local logs, including activity (`awaiting-output` vs `streaming-output`), last output time, and byte counts
- when that local execution finishes, the same dashboard log panel can now switch over to the persisted run log automatically instead of dropping the log view
- task detail now gives timeout / interrupted / cancelled / failed executions distinct visual treatment so cancellation does not read like a generic failure
- overview stats and task cards now also aggregate verification signals, so you can distinguish planned-only checks, draft proof, and strong proof without opening each task detail view
- overview task cards now also surface the latest executor outcome separately from the latest overall run, so manual proof updates do not hide the most recent executor result
- overview stats now aggregate the latest executor outcome across tasks, so the dashboard can show how many tasks last passed, timed out, were cancelled, or still have no executor evidence
- interactive `stdioMode: inherit` flows remain intentionally CLI-first so the browser does not become a fake terminal

See `docs/ADAPTERS.md`.

The current executor contract and next hardening steps are scoped in `docs/RUN_EXECUTE_DESIGN.md`.

## Recipe registry and schema checks

The workflow layer now treats recipes as first-class metadata instead of loose markdown only.

- Recipes are indexed in `.agent-workflow/recipes/index.json`
- Tasks can declare a `recipeId`
- Validation checks look for missing or malformed project, task, adapter, and run records
- The dashboard surfaces both repository-wide and task-level schema issues
- The dashboard applies lightweight freshness heuristics to memory docs and task markdown bundles
- The dashboard applies a first-pass diff-aware verification gate by comparing repo-relative task scope hints against current workspace file mtimes
- Checkpoints now surface whether scoped files still need explicit proof before handoff
- The dashboard can create tasks, update selected task metadata, edit `task.md` / `context.md` / `verification.md`, and record structured run evidence through local-only API endpoints
- metadata-managed markdown blocks now stay pinned during edits, so task title / recipe / context recipe guidance / priority lines refresh without wiping nearby custom notes
- the dashboard editor now explains which sections are managed on save versus free to edit, so those guardrails are visible before you type
- the run evidence form can now prefill proof paths from the task's current pending scoped files
- the run evidence form can now also draft one verification check per pending scoped file
- the `verification.md` editor can now draft a pending proof plan from the current scoped file set by inserting planned manual checks plus file-only Proof links placeholders without falsely claiming completed verification
- the run evidence form can now sync its drafted proof paths/checks into the `verification.md` editor as an unsaved proof-plan draft

Diff-aware verification stays intentionally lightweight in this pass:

- it reads local workspace files only
- it matches changed files against repo-relative paths declared in `task.json.scope` or `task.md` under `## Scope`
- it understands simple scope directives such as `path:`, `files:`, and `dirs:`
- it only treats scoped changes as covered when explicit proof paths are linked through `verification.md` text or passed run evidence
- passed run evidence can now persist structured `verificationChecks` and `verificationArtifacts` alongside `scopeProofPaths`
- it now tracks proof items as `paths + checks + artifacts`, so evidence can be audited instead of treated as a bare timestamp
- a generic `verification.md` timestamp bump is no longer enough to cover scoped changes by itself
- it does not try to replace human judgment or full CI evidence

See `docs/RECIPES_AND_SCHEMA.md`.

## Suggested next build steps

1. Add stronger task editing guardrails so managed markdown blocks stay stable during richer edits.
2. Surface richer proof-capture controls in the dashboard run form.
3. Harden dashboard execution/reporting flows without breaking the shared executor boundary.
4. Add GitHub issue and PR linking.
5. Add multi-agent run orchestration and resume bundles.

## Contributing

If you want to help shape this into a serious open source workflow layer, start here:

- read `CONTRIBUTING.md`
- keep changes local-first, relocatable, and schema-aware
- run `npm run smoke` before opening a PR

## Community

- `CODE_OF_CONDUCT.md` defines how we collaborate
- issues and PRs should stay focused on strong prompts, evidence quality, checkpoints, and agent handoff durability

## License

Released under the MIT License. See `LICENSE`.

