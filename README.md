# Agent Workflow Studio

<p align="center">
  <a href="https://www.npmjs.com/package/agent-workflow-studio"><img src="https://img.shields.io/npm/v/agent-workflow-studio?style=for-the-badge" alt="npm version"></a>
  <a href="https://github.com/SJW1111011/agent-workflow-studio/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/SJW1111011/agent-workflow-studio/ci.yml?branch=main&style=for-the-badge&label=CI" alt="CI"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="MIT license"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=for-the-badge" alt="Node 18+"></a>
  <img src="https://img.shields.io/badge/dependencies-0-brightgreen?style=for-the-badge" alt="Zero dependencies">
</p>

Make every Codex and Claude Code run leave an auditable evidence trail.

Zero dependencies - local-first - Git-native - npm-installable

Agent Workflow Studio turns:

- tasks into strong prompts
- runs into evidence
- evidence into refreshed docs and checkpoints
- long jobs into resumable handoffs instead of lost context

## Try it in 1 minute

Fastest scratch-repo path:

```bash
npm install agent-workflow-studio
npx agent-workflow init --root .
npx agent-workflow quick "My first task" --task-id T-001 --agent codex --root .
npx agent-workflow dashboard --root . --port 4173
```

Then open `http://localhost:4173`.

If you want the cleaner helper-directory install flow instead of adding `node_modules/` to the target repo, see `docs/GETTING_STARTED.md`. If you are contributing from this repository checkout, jump to `Contributor workflow` below.

## Core capabilities

- **`quick`** - create a durable task bundle in one step: profile refresh, task docs, prompt, run request, launch pack, and checkpoint
- **`memory:bootstrap`** - generate a local-only handoff prompt that helps Codex or Claude Code fill grounded project memory
- **`run:execute`** - launch a local adapter when you explicitly opt into `commandMode: exec`, with shared preflight, logs, and evidence capture
- **`verification gate`** - compare repo-relative task scope against the current repository snapshot and show which scoped files still need explicit proof
- **`proof anchors`** - keep passed evidence and refreshed manual proof tied to content fingerprints, not fragile `mtime` alone
- **`dashboard`** - inspect tasks, evidence, freshness, risks, execution state, and quick-create flows from a local control plane at `localhost:4173`

## Architecture at a glance

```text
Task creation          Agent execution           Evidence + resume
     |                       |                         |
     v                       v                         v
+-------------------------------------------------------------------+
|                        .agent-workflow/                           |
|                                                                   |
|  memory/            tasks/T-001/                 adapters/         |
|  - product.md       - task.md                    - codex.json      |
|  - architecture.md  - context.md                 - claude-code.json|
|  - rules.md         - verification.md            - custom *.json   |
|                      - prompt.codex.md                              |
|                      - run-request.codex.json                       |
|                      - launch.codex.md                              |
|                      - checkpoint.md                                |
|                      - runs/ evidence + proof anchors               |
+-------------------------------------------------------------------+
         |                                         |
         v                                         v
   Git-trackable repo                        Dashboard / CLI
```

## Daily workflow

1. Create a task with `quick` or `task:new`.
2. Hand the compiled prompt to Codex or Claude Code, or use `run:execute` when a local adapter is ready.
3. Review proof in `verification.md` and recorded runs under `.agent-workflow/tasks/<taskId>/runs/`.
4. Refresh `checkpoint.md`, keep moving, and resume later without losing context.

## Verification model

Two verification ideas sit at the center of the project:

- `verification gate`: compare repo-relative task scope against the current repository snapshot and explain which scoped files still need explicit proof
- `proof anchor`: persist repo-relative content fingerprints with passed run evidence, and now also with explicitly refreshed manual proof, so freshness can survive misleading `mtime` churn, branch switches, and agent handoff noise
- workflow-managed proof fingerprints now normalize away pure bookkeeping churn such as `task.json.updatedAt` and appended `verification.md` evidence blocks, so evidence refresh does not reopen proof by itself
- Git mode gives the strongest version of this model because it carries dirty-state metadata plus current fingerprints for changed files; filesystem fallback stays local-only and portable, but only hashes targeted proof paths instead of the whole workspace

## Why this exists

Most teams using coding agents still lack:

- stable project memory
- structured task context
- trustworthy verification state
- resumable checkpoints
- a shared control plane across Codex and Claude Code

Agent Workflow Studio is designed to become that missing layer.

## Command surface

The current foundation includes:

- onboarding: `init`, `scan`, `memory:bootstrap`, `memory:validate`
- tasking: `recipe:list`, `quick`, `task:new`, `task:list`
- adapters: `adapter:list`, `adapter:create`
- execution prep: `prompt:compile`, `run:prepare`
- execution + evidence: `run:execute`, `run:add`, `checkpoint`
- inspection: `dashboard`, `validate`
- the dashboard frontend is split across static helper modules for document editing/proof drafting, API client helpers, form/editor state derivation, form event flows, orchestration state derivation, task-board summaries, task-list rendering, execution/run detail presentation, task-detail/verification rendering, log-panel state/render helpers, and overview/list section rendering without introducing a bundler
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

## Contributor workflow

Run everything from this project root:

```bash
npm run init -- --root ../some-repo
npm run scan -- --root ../some-repo
npm run adapter:list
npm run adapter:create -- demo-agent --runner "npx demo-agent-cli" --prompt-target claude --root ../some-repo
npm run recipe:list -- --root ../some-repo
npm run memory:bootstrap -- --root ../some-repo
# after saving grounded notes under .agent-workflow/memory/*.md
npm run memory:validate -- --root ../some-repo
npm run quick -- "Build the scanner" --task-id T-001 --priority P1 --recipe feature --agent codex --root ../some-repo
npm run task:new -- T-001 "Build the scanner" --priority P1 --recipe feature --root ../some-repo
npm run dashboard -- --root ../some-repo --port 4173
npm run prompt:compile -- T-001 --agent codex --root ../some-repo
npm run run:prepare -- T-001 --agent codex --root ../some-repo
npm run run:execute -- T-001 --agent codex --root ../some-repo
npm run run:add -- T-001 "Initial scanner pass completed." --status passed --root ../some-repo
npm run checkpoint -- T-001 --root ../some-repo
npm run validate -- --root ../some-repo
npm test
```

Then open `http://localhost:4173`.

If you want the shortest installed-package path instead of contributor-from-source commands, see `docs/GETTING_STARTED.md`.

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
- once those docs are saved, `memory:validate` gives you a local-only check for leftover scaffold lines, obviously empty sections, and absolute machine paths

## npm distribution

As of 2026-04-09, `agent-workflow-studio@0.1.1` is live on npm.

- the package name is `agent-workflow-studio`
- the installed CLI command is `agent-workflow`
- the published payload stays scoped to runtime files (`src/`, `dashboard/`, docs, and top-level metadata) instead of shipping tests, tmp artifacts, or repo-local dogfooding state; `package.json.files` is the primary whitelist and root `.npmignore` now mirrors the non-runtime directories as an explicit release guardrail
- GitHub Actions now also verifies a packed-tarball install plus dashboard quick-create flow across Windows, macOS, and Linux, so npm-first onboarding regressions are less likely to hide behind repo-only tests
- local development from this repository root still works through the same `npm run ...` commands

Install and verify it with:

```bash
npm install -g agent-workflow-studio
agent-workflow --help
agent-workflow init --root ../some-repo
agent-workflow dashboard --root ../some-repo --port 4173
npm install agent-workflow-studio
npx agent-workflow --help
npx agent-workflow init --root ../some-repo
npx agent-workflow dashboard --root ../some-repo --port 4173
```

The package name and executable name are intentionally different, so the verified install flow is `npm install ...` followed by `agent-workflow` / `npx agent-workflow`.

For a verified npm-first onboarding flow that keeps your target repo clean, see `docs/GETTING_STARTED.md`.

See `docs/PUBLISHING.md` for the release checklist, current published status, and post-publish verification commands.

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
- dynamic discovery of additional repo-local `*.json` adapter configs beyond the built-in Codex and Claude Code scaffolds
- agent-specific prompt targets
- execution handoff packs such as `run-request.codex.json` and `launch.codex.md`
- a place to customize local runner commands after you confirm your environment

You can now scaffold a custom adapter locally with:

```bash
npm run adapter:create -- demo-agent --runner "npx demo-agent-cli" --prompt-target claude --stdin-mode promptFile --env DEMO_AGENT_TOKEN --root ../some-repo
```

That writes `.agent-workflow/adapters/demo-agent.json`, updates `.agent-workflow/project.json`, and makes the new adapter visible to `adapter:list`, `run:prepare`, `run:execute`, overview metadata, and task-detail generated files.

There is now a first local `run:execute` bridge for adapters that explicitly switch to `commandMode: exec`.

- built-in adapters still default to `manual`
- the built-in Codex adapter now also carries a recommended non-interactive `codex exec --sandbox workspace-write -` profile, but it still stays `manual` until you explicitly opt in
- the repo-local Claude dogfooding profile is now also proven on this Windows machine with `cmd.exe /d /s /c claude --model sonnet --bare --output-format json -p --permission-mode bypassPermissions`, but that remains a narrow local override rather than a generated default
- the first executable pass keeps the contract-first structure
- execution writes evidence back into `runs/*.json`, `verification.md`, and `checkpoint.md`
- `stdioMode: inherit` and `stdioMode: pipe` are supported
- adapters can now also declare `stdinMode: promptFile`, so non-interactive CLIs can receive the compiled prompt over stdin without shell glue
- on the locally observed Codex CLI surface from 2026-04-08, `codex exec` accepted `--sandbox` but rejected `--ask-for-approval`, so the recommended template stays aligned to that narrower flag set until broader confirmation exists
- even after runner shape is confirmed, a real local CLI may still need separate auth/provider readiness before model execution succeeds
- the real Claude pilot also confirmed that non-interactive child launches may require adapter-owned env forwarding even when a standalone auth check looks healthy; on this machine the child process needed `ANTHROPIC_AUTH_TOKEN` plus `ANTHROPIC_BASE_URL`
- capture mode can persist stdout and stderr logs under the task run ledger
- execution can record timeout and interruption metadata
- CLI and dashboard now share the same preflight/readiness pass before launch, so adapter validation, artifact readiness, and caller-specific stdio checks do not drift apart
- that shared preflight now also surfaces adapter notes plus local runner-availability advisories, so blocked launches can explain whether the machine is missing a confirmed CLI path or just still configured for manual handoff
- in Git-backed repositories, that same preflight can now also warn when the current worktree is already dirty, and the advisory now distinguishes task-scoped changes, workflow bookkeeping, and outside-scope edits so harmless evidence churn is easier to separate from riskier code drift
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
- The dashboard can quick-create the same durable bundle as CLI `quick`, create bare tasks, update selected task metadata, edit `task.md` / `context.md` / `verification.md`, and record structured run evidence through local-only API endpoints
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

## Learn more

This README is the short visitor-facing entrypoint. For deeper reading:

- [`docs/GETTING_STARTED.md`](docs/GETTING_STARTED.md) - the full npm-first onboarding flow
- [`docs/README.md`](docs/README.md) - the documentation map for architecture, execution, verification, publishing, and roadmap docs
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) - how the workflow scaffold, dashboard, adapters, and evidence model fit together
- [`docs/VERIFICATION_FRESHNESS_DESIGN.md`](docs/VERIFICATION_FRESHNESS_DESIGN.md) - verification gates, proof anchors, and freshness rules
- [`docs/RUN_EXECUTE_DESIGN.md`](docs/RUN_EXECUTE_DESIGN.md) - local executor planning, preflight, and evidence capture
- [`docs/ADAPTERS.md`](docs/ADAPTERS.md) - built-in adapters and custom adapter scaffolding
- [`docs/ROADMAP.md`](docs/ROADMAP.md) - the likely next build steps

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
- run `npm test`, `npm run smoke`, and `npm run verify:onboarding` before opening a PR when you touch packaging, onboarding, or dashboard quick flows

## Community

- `CODE_OF_CONDUCT.md` defines how we collaborate
- issues and PRs should stay focused on strong prompts, evidence quality, checkpoints, and agent handoff durability

## License

Released under the MIT License. See `LICENSE`.

