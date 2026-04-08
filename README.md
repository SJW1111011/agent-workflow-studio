# Agent Workflow Studio

Agent Workflow Studio is a local-first workflow OS and project control plane for Codex and Claude Code.

The product thesis is simple:

- tasks should compile into strong prompts
- runs should leave evidence
- evidence should refresh docs and checkpoints
- long jobs should survive context compaction and agent handoff

Two verification ideas sit at the center of that thesis:

- `verification gate`: compare repo-relative task scope against the current repository snapshot and explain which scoped files still need explicit proof
- `proof anchor`: persist repo-relative content fingerprints with passed run evidence, and now also with explicitly refreshed manual proof, so freshness can survive misleading `mtime` churn, branch switches, and agent handoff noise

Git mode gives the strongest version of this model because it carries dirty-state metadata plus current fingerprints for changed files. Filesystem fallback stays local-only and portable, but only hashes targeted proof paths instead of the whole workspace.

This repository starts with a relocatable foundation:

- a headless workflow scaffold in `.agent-workflow/`
- a zero-dependency CLI to initialize, scan, create tasks, compile prompts, and record runs
- a lightweight dashboard that reads the workflow state from any repository root
- a zero-dependency test layer with focused unit coverage plus a smoke test that proves the project still works when nested under a non-English path
- executor contract coverage now includes focused unit tests for plan resolution plus passed / timed-out / interrupted local runs, so `run:execute` lifecycle rules do not live in smoke alone
- overview aggregation now also has focused unit coverage for uninitialized workspaces plus task-level executor outcome / verification signal summaries
- local server/API coverage now also has focused tests for health, 400 validation paths, 404 missing-resource paths, and 409 inactive-execution conflicts

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
- `quick`: create a task bundle fast by refreshing the project profile, creating the task, compiling the prompt, preparing the run-request/launch pack, and refreshing the checkpoint
- `memory:bootstrap`: generate a local-only bootstrap prompt for filling the scaffold memory docs through Codex or Claude Code without embedding cloud API calls
- `task:new`: create a structured task package with both machine-readable and human-readable context
- `prompt:compile`: generate Codex or Claude Code prompts from workflow state
- `run:prepare`: generate an execution handoff pack for a specific adapter
- `run:execute`: launch a local adapter when its config explicitly opts into `commandMode: exec`
- `run:add`: append execution evidence to a task, including optional proof paths, checks, and artifact refs
- `checkpoint`: build a resumable checkpoint for the current task
- `validate`: run schema checks on project, adapters, tasks, and recorded runs
- `dashboard`: open a local control plane for tasks, memory freshness, task doc freshness, Git-aware diff-aware verification gates, checkpoint detail, metadata edits, structured run evidence capture, manual proof-anchor refresh, a local execution bridge for `stdioMode: pipe` adapters, shared execution preflight/readiness, executor state/cancel flow, and markdown task doc edits
- the dashboard frontend is now split across static helper modules for document editing/proof drafting, API client helpers, form/editor state derivation, form event flows, orchestration state derivation, task-board summaries, task-list rendering, execution/run detail presentation, task-detail/verification rendering, log-panel state/render helpers, and overview/list section rendering without introducing a bundler
- server-facing mutations and log APIs now use explicit HTTP-aware errors, so the local control plane no longer guesses status codes from message text

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
npm run memory:bootstrap -- --root ../some-repo
npm run quick -- "Build the scanner" --task-id T-001 --priority P1 --recipe feature --agent codex --root ../some-repo
npm run task:new -- T-001 "Build the scanner" --priority P1 --recipe feature --root ../some-repo
npm run prompt:compile -- T-001 --agent codex --root ../some-repo
npm run run:prepare -- T-001 --agent codex --root ../some-repo
npm run run:execute -- T-001 --agent codex --root ../some-repo
npm run run:add -- T-001 "Initial scanner pass completed." --status passed --root ../some-repo
npm run checkpoint -- T-001 --root ../some-repo
npm run validate -- --root ../some-repo
npm test
npm run dashboard -- --root ../some-repo --port 4173
```

Then open `http://localhost:4173`.

`quick` is intentionally a shortcut over the existing file-based workflow, not a replacement for it.

It still lands the same durable artifacts:

- `.agent-workflow/project-profile.json` / `.agent-workflow/project-profile.md`
- `.agent-workflow/tasks/<taskId>/task.md`
- `.agent-workflow/tasks/<taskId>/context.md`
- `.agent-workflow/tasks/<taskId>/verification.md`
- `.agent-workflow/tasks/<taskId>/prompt.<agent>.md`
- `.agent-workflow/tasks/<taskId>/run-request.<adapter>.json`
- `.agent-workflow/tasks/<taskId>/launch.<adapter>.md`
- `.agent-workflow/tasks/<taskId>/checkpoint.md`

`memory:bootstrap` follows the same philosophy:

- it refreshes the project profile locally
- it writes a reusable prompt to `.agent-workflow/handoffs/memory-bootstrap.md`
- it does not call a cloud API or mutate the memory docs for you
- it gives you a file-based handoff you can pass to Codex or Claude Code, then review before saving

## npm-ready distribution

The package metadata is now prepared for npm distribution:

- `package.json` exposes the CLI through the `agent-workflow` bin
- the published package payload is scoped to runtime files (`src/`, `dashboard/`, docs, and top-level metadata) instead of shipping tests, tmp artifacts, or repo-local dogfooding state
- local development still works the same way from this repository root

After publishing, the intended install shapes are:

```bash
npx agent-workflow-studio init --root ../some-repo
npx agent-workflow-studio quick "Build the scanner" --task-id T-001 --priority P1 --recipe feature --agent codex --root ../some-repo
npm install -g agent-workflow-studio
agent-workflow init --root ../some-repo
```

Until the package is actually published, keep using the local `npm run ...` commands from this repository.

See `docs/PUBLISHING.md` for the concrete release checklist and current npm preflight status.

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
- the built-in Codex adapter now also carries a recommended non-interactive `codex exec --sandbox workspace-write -` profile, but it still stays `manual` until you explicitly opt in
- the first executable pass keeps the contract-first structure
- execution writes evidence back into `runs/*.json`, `verification.md`, and `checkpoint.md`
- `stdioMode: inherit` and `stdioMode: pipe` are supported
- adapters can now also declare `stdinMode: promptFile`, so non-interactive CLIs can receive the compiled prompt over stdin without shell glue
- on the locally observed Codex CLI surface from 2026-04-08, `codex exec` accepted `--sandbox` but rejected `--ask-for-approval`, so the recommended template stays aligned to that narrower flag set until broader confirmation exists
- even after runner shape is confirmed, a real local CLI may still need separate auth/provider readiness before model execution succeeds
- capture mode can persist stdout and stderr logs under the task run ledger
- execution can record timeout and interruption metadata
- CLI and dashboard now share the same preflight/readiness pass before launch, so adapter validation, artifact readiness, and caller-specific stdio checks do not drift apart
- that shared preflight now also surfaces adapter notes plus local runner-availability advisories, so blocked launches can explain whether the machine is missing a confirmed CLI path or just still configured for manual handoff
- in Git-backed repositories, that same preflight can now also warn when the current worktree is already dirty, so inspection-first dogfooding runs are less likely to surprise operators after launch
- when an adapter explicitly allowlists environment variables, preflight can now also warn when those entries are missing from the current process before a real local CLI fails later for avoidable setup reasons
- the dashboard task detail can inspect executor metadata and local run logs through local-only APIs
- the CLI can launch both `inherit` and `pipe` modes through the shared executor
- the dashboard now uses a thin local API over that same executor module for `stdioMode: pipe`
- dashboard/CLI execution failures can now surface normalized `failureCategory` plus machine-readable blocking issues without parsing free-form summary text
- the dashboard can request cancellation for an active local `pipe` execution, and the interrupted run still lands in the task ledger with evidence
- the dashboard execution bridge now exposes a structured local outcome (`passed`, `timed-out`, `interrupted`, `cancelled`, `failed-to-start`) so task detail and recent runs do not need to guess from summary text
- the dashboard bridge now also preserves preflight-blocked state locally (`preflight-failed`) when a launch is rejected before spawn, while durable run evidence remains reserved for real process starts
- the dashboard execution panel can now tail the active local stdout/stderr logs through a local-only API while the shared executor is still running
- the execution state payload now also derives lightweight stream observability from those same task-local logs, including activity (`awaiting-output` vs `streaming-output`), last output time, and byte counts
- when that local execution finishes, the same dashboard log panel can now switch over to the persisted run log automatically instead of dropping the log view
- task detail now gives timeout / interrupted / cancelled / failed executions distinct visual treatment so cancellation does not read like a generic failure
- overview stats and task cards now also aggregate verification signals, so you can distinguish planned-only checks, draft proof, and strong proof without opening each task detail view
- overview task cards now also surface the latest executor outcome separately from the latest overall run, so manual proof updates do not hide the most recent executor result
- overview stats now aggregate the latest executor outcome across tasks, so the dashboard can show how many tasks last passed, timed out, were cancelled, or still have no executor evidence
- interactive `stdioMode: inherit` flows remain intentionally CLI-first so the browser does not become a fake terminal

See `docs/ADAPTERS.md`.

The current executor contract and the next local executor boundary are scoped in `docs/RUN_EXECUTE_DESIGN.md`.

## Recipe registry and schema checks

The workflow layer now treats recipes as first-class metadata instead of loose markdown only.

- Recipes are indexed in `.agent-workflow/recipes/index.json`
- Tasks can declare a `recipeId`
- Validation checks look for missing or malformed project, task, adapter, and run records
- The dashboard surfaces both repository-wide and task-level schema issues
- The dashboard applies lightweight freshness heuristics to memory docs and task markdown bundles
- The dashboard applies a Git-aware verification gate by matching repo-relative task scope hints against a reusable repository snapshot
- Checkpoints now surface whether scoped files still need explicit proof before handoff
- The dashboard can create tasks, update selected task metadata, edit `task.md` / `context.md` / `verification.md`, and record structured run evidence through local-only API endpoints
- metadata-managed markdown blocks now stay pinned during edits, so task title / recipe / context recipe guidance / priority lines refresh without wiping nearby custom notes
- the dashboard editor now explains which sections are managed on save versus free to edit, keeps the manual proof-anchor JSON out of the primary `verification.md` editing surface, and preserves that managed anchor block on save
- the run evidence form can now prefill proof paths from the task's current pending scoped files
- the run evidence form can now also draft one verification check per pending scoped file
- the `verification.md` editor can now draft a pending proof plan from the current scoped file set by inserting planned manual checks plus file-only Proof links placeholders without falsely claiming completed verification
- the run evidence form can now sync its drafted proof paths/checks into the `verification.md` editor as an unsaved proof-plan draft
- the dashboard can now explicitly refresh manual proof anchors into a managed `## Evidence` block after you save strong manual proof, so anchor-backed freshness does not depend on run records alone
- task detail and task cards now surface whether strong proof is `anchor-backed` or still `compatibility-only`, so operators can see which freshness path the gate is relying on

Diff-aware verification stays intentionally lightweight in this pass:

- it prefers a Git-backed repository snapshot from `git status --porcelain=v2` and falls back to a filesystem snapshot when Git is unavailable
- it matches changed files against repo-relative paths declared in `task.json.scope` or `task.md` under `## Scope`
- it understands simple scope directives such as `path:`, `files:`, and `dirs:`
- it reuses one repository snapshot per overview or task-detail request instead of re-walking the workspace for each task
- it only treats scoped changes as covered when explicit proof paths are linked through `verification.md` text or passed run evidence
- passed run evidence can now persist structured `verificationChecks`, `verificationArtifacts`, and optional `scopeProofAnchors` alongside `scopeProofPaths`
- it now tracks proof items as `paths + checks + artifacts`, so evidence can be audited instead of treated as a bare timestamp
- it makes rename / delete / untracked state explicit in the verification summary when Git is available
- a generic `verification.md` timestamp bump is no longer enough to cover scoped changes by itself
- passed-run anchors now allow content-aware freshness when they are present
- manual proof now defaults to the compatibility timestamp path, but can opt into the same anchor-backed freshness model through a local-only refresh action that writes a managed block under `verification.md`
- direct proof fingerprint reads now use a small in-memory cache keyed by file path plus `mtime`, so repeated overview/task-detail refreshes do not keep re-hashing unchanged proof files
- filesystem fallback still avoids hashing the whole workspace; it only fingerprints the proof paths being anchored, so Git mode remains the strongest protection path
- it does not try to replace human judgment or full CI evidence

See `docs/RECIPES_AND_SCHEMA.md`.

## Suggested next build steps

1. Build any additional executor capability on top of the new shared preflight/readiness contract instead of adding caller-specific launch rules.
2. Keep interactive `stdioMode: inherit` flows CLI-only until there is a real terminal-ownership design.
3. Keep `dashboard/app.js` focused on orchestration/event wiring if any new dashboard features land.
4. Revisit adapter extensibility only after the verification/evidence model stays stable under the new manual-proof anchor path.
5. Add more focused unit coverage around any future executor-planning contract before broadening adapter execution modes.

## Contributing

If you want to help shape this into a serious open source workflow layer, start here:

- read `CONTRIBUTING.md`
- keep changes local-first, relocatable, and schema-aware
- run `npm test` and `npm run smoke` before opening a PR

## Community

- `CODE_OF_CONDUCT.md` defines how we collaborate
- issues and PRs should stay focused on strong prompts, evidence quality, checkpoints, and agent handoff durability

## License

Released under the MIT License. See `LICENSE`.

