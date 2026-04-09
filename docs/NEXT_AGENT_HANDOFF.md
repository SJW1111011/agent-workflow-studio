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

As of 2026-04-09, the project already has a working MVP foundation:

- workflow scaffold generation under `.agent-workflow/`
- repository scanning and project profile generation
- task creation with recipe support
- Codex / Claude Code adapter contracts
- prompt compilation
- `quick` task bootstrap for the common local flow: scan -> task bundle -> prompt -> run-request/launch pack -> checkpoint
- `memory:bootstrap` for the common onboarding flow: scan -> refresh project profile -> write a reusable memory bootstrap prompt under `.agent-workflow/handoffs/`
- `memory:validate` for the onboarding follow-through: fail on unchanged scaffold memory lines and warn on obviously empty sections or absolute machine paths before those notes become durable project memory
- the repo now also has a checked-in `.agent-workflow/` dogfooding state with grounded memory docs plus a real `T-001` onboarding task bundle, checkpoint, and run evidence
- run preparation handoff packs
- shared `run:execute` for adapters that opt into `commandMode: exec`
- stdout/stderr capture plus timeout/interruption metadata for `run:execute`
- a local-only dashboard execution bridge for adapters that resolve to `stdioMode: pipe`
- dashboard-triggered local execution can now also request cancellation and surface transient `cancel-requested` state
- dashboard execution state now also carries a structured final outcome so the UI does not have to infer pass/fail/cancel from summary text
- dashboard task detail can now tail active local stdout/stderr through a local-only execution-log API while a shared executor run is still in flight
- dashboard execution state now also derives lightweight stream observability from those same task-local logs, including activity, byte counts, and last output time
- the dashboard execution log panel now switches to the persisted run log automatically once the run is durably recorded
- task detail now visually separates timed-out, interrupted, cancelled, and failed executor outcomes instead of treating them as one generic warning state
- overview task cards now also surface the latest executor outcome separately from the latest overall run
- overview stats now also aggregate each task's latest executor outcome for dashboard-level reporting
- overview stats and task cards now also aggregate task-level verification signals so planned-only checks, draft proof, mixed proof, and strong proof are visible without opening task detail
- run evidence recording
- checkpoint generation
- recipe registry
- schema validation
- local dashboard
- lightweight freshness detection for memory docs and task markdown bundles
- memory placeholder detection is now line-based instead of heading-fragment based, so grounded memory docs no longer stay falsely flagged just for keeping stable section titles
- Git-aware diff-aware verification gates using a reusable repository snapshot with filesystem fallback
- stronger scope hint extraction for `task.md` markers like `path:` / `files:` / `dirs:`
- checkpoint refresh rules that now surface scoped files awaiting proof
- explicit proof linkage so generic verification edits no longer cover scoped changes unless repo-relative paths are named
- proof items now carry paths plus check/artifact refs, and the gate can report `partially-covered`
- passed runs can now persist structured `verificationChecks`, `verificationArtifacts`, and optional `scopeProofAnchors`
- dashboard write actions for task creation, task metadata updates, markdown task doc edits, and structured run evidence creation
- metadata-managed task/context markdown blocks now stay stable during richer edits
- the dashboard editor now explains managed vs free-edit sections for each task document
- the dashboard run form can now prefill proof paths from pending scoped files
- the dashboard run form can now also draft one check line per pending scoped file
- the verification editor can now draft a pending proof plan from pending scoped files by inserting planned checks plus file-only proof-link placeholders
- the run form can now sync drafted proof paths/checks into the verification editor as an unsaved proof-plan draft
- the dashboard can now trigger local `run:execute` through a thin local API bridge, while task detail surfaces transient execution state plus persisted executor logs
- the repo now also has focused zero-dependency unit tests for `verification-gates` and `task-documents`, so proof parsing and managed markdown regressions do not rely on smoke coverage alone
- low-risk dashboard modularization has started: document/proof drafting helpers, dashboard API client helpers, form/editor state helpers, form event-flow helpers, orchestration state helpers, task-board/overview helpers, task-list render helpers, execution/run detail presentation helpers, task-detail / verification rendering helpers, log-panel state/render helpers, and overview/list section renderers now live in separate static modules, while `dashboard/app.js` stays the orchestration layer
- the repo now also has focused zero-dependency dashboard helper tests for dashboard API client helpers, form/editor state derivation, form event-flow payload helpers, orchestration state derivation, task-list rendering, task-detail / verification rendering, log-panel state/render behavior, and overview/list rendering, so more UI markup contracts are covered outside smoke
- the repo now also has focused zero-dependency `run-executor` contract tests for execution-plan resolution plus passed / timed-out / interrupted local runs, so executor lifecycle behavior no longer depends on smoke alone
- the repo now also has focused zero-dependency `overview` tests for uninitialized workspaces plus executor outcome / verification signal aggregation, so board-level summary logic is no longer smoke-only
- the repo now also has focused zero-dependency `server-api` tests for health plus representative 400 / 404 / 409 local API contracts, so `src/server.js` behavior is less dependent on smoke
- `run:execute` now also has a first shared preflight/readiness pass split across `src/lib/run-preflight.js` and `src/lib/run-plan.js`, while `src/lib/run-executor.js` stays focused on spawn/evidence lifecycle; CLI and dashboard still validate adapter config, prepared artifacts, runtime plan safety, and caller-specific stdio compatibility through the same shared contract
- dashboard/API execution launch failures can now return additive `code`, `failureCategory`, and `blockingIssues` fields instead of relying on free-form error text only
- preflight/readiness now also returns additive `advisories`, including adapter notes plus first-pass local runner-availability guidance for real CLI pilot work
- that same shared preflight can now also add non-blocking dirty-worktree advisories in Git mode plus missing adapter-owned `envAllowlist` hints before launch
- dirty-worktree advisories are now task-aware enough to distinguish task-scoped paths, workflow bookkeeping churn under `.agent-workflow/`, and changed paths outside the current task scope
- adapters can now also opt into `stdinMode: promptFile`, and the executor can stream the compiled prompt into stdin for non-interactive real-CLI style profiles without shell redirection
- the first repo-local real Codex dogfooding attempt reached the actual child process and persisted executor evidence, but it failed fast because the locally observed `codex exec` CLI rejected `--ask-for-approval`; the recommended template now stays within the confirmed `codex exec --sandbox workspace-write -` flag shape
- a follow-up real Codex launch then reached Codex itself and confirmed stdin prompt delivery plus durable run logs, but it still failed before model work because the repo-local dogfooding adapter had not forwarded `OPENAI_API_KEY` into the child process; the local profile now allowlists that env var
- a subsequent real Codex launch now completes with exit code 0 and lands durable task-local evidence, proving the local `run:execute` path end to end; in this repository state the child agent then stopped honestly on the already-dirty working tree instead of making further edits
- the Claude Code T-003 dogfooding pilot is now also proven end to end: the repo-local `claude-code.json` adapter uses `cmd.exe /d /s /c claude --model sonnet --bare --output-format json -p --permission-mode bypassPermissions` with `stdinMode: promptFile`; the first run failed with "Not logged in" confirming that `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_BASE_URL` must be in the child `envAllowlist`; after that fix the launched Claude agent ran all automated checks (npm test 82 passed, smoke passed, validate errors=0) and left durable evidence; built-in generated scaffolds still default to `commandMode: manual`
- package metadata is now exercised by a real npm release: `agent-workflow-studio@0.1.1` is published, the payload is primarily scoped through `package.json.files`, root `.npmignore` now mirrors the non-runtime repo directories as a release backstop, and the CLI is exposed through the `agent-workflow` bin without npm auto-cleanup warnings
- the repo now also includes a first GitHub Actions matrix under `.github/workflows/ci.yml`, configured to run `npm test`, `npm run validate -- --root .`, and `npm run smoke` across `windows-latest`, `ubuntu-latest`, and `macos-latest`
- the first three GitHub Actions CI runs have now completed successfully across all three matrix platforms (`windows-latest`, `ubuntu-latest`, `macos-latest`), so the initial cross-platform shell/path assumptions appear stable under hosted runners
- the published install surface is now partially verified on this Windows machine: `npm install agent-workflow-studio` followed by `npx agent-workflow --help` works from a clean temp directory, while docs now avoid the misleading package-name-as-command shortcut
- the published package now also exposes dashboard launch through the main CLI (`agent-workflow dashboard` / `npx agent-workflow dashboard`), so first-time users no longer need to know the internal `src/server.js` path just to open the local control plane
- a clean temp install of `agent-workflow-studio@0.1.1` has now re-verified the npm-first bootstrap path end to end: `init`, `scan`, `memory:bootstrap`, `quick`, `validate`, and dashboard launch all work from the published package
- that validated path is now written down as a short operator-facing walkthrough in `docs/GETTING_STARTED.md`
- `docs/PUBLISHING.md` now records both the release checklist and the current published status, including the requirement that future publishes still use OTP or bypass-2FA-compatible token auth
- the dashboard execution bridge now preserves a transient `preflight-failed` state locally when launch is blocked before spawn, while durable run evidence still remains reserved for real process starts
- verification freshness Phase 1 is now implemented behind `src/lib/repository-snapshot.js`, and the design note still scopes the later proof-anchor phase
- the first Phase 2 proof-anchor pass is now implemented: passed runs can capture `scopeProofAnchors`, and the gate prefers anchor comparison for those runs while manual proof defaults to the compatibility path until anchors are explicitly refreshed
- direct proof fingerprint reads now use a small in-memory cache keyed by file path plus `mtime`, so repeated proof-anchor comparisons avoid re-hashing unchanged files
- filesystem fallback is now documented more explicitly as the compatibility path: it fingerprints targeted proof paths on demand instead of trying to hash the whole workspace
- manual `verification.md` proof can now also opt into anchor-backed freshness through `POST /api/tasks/:taskId/verification/anchors/refresh`, which writes a managed anchor block under `## Evidence`
- workflow-managed proof fingerprints now normalize away pure bookkeeping churn in task-local `task.json.updatedAt` and appended `verification.md` evidence sections, so anchor refresh/evidence refresh does not reopen proof by itself
- the dashboard verification editor now hides that managed anchor JSON from the primary editing surface, preserves it on save, and exposes an explicit local `Refresh Proof Anchors` action
- task detail and task cards now also call out whether strong proof is anchor-backed or compatibility-only, so the current freshness path is visible without reading raw proof JSON
- `src/server.js` no longer infers HTTP status codes from `error.message.includes(...)`; server-facing libs now throw explicit HTTP-aware errors through `src/lib/http-errors.js`, while the JSON error payload contract stays unchanged
- `docs/RUN_EXECUTE_DESIGN.md` now also narrows the next local executor step more explicitly: add a shared preflight/readiness layer plus normalized lifecycle/failure categories before broadening runtime support, keep dashboard as a thin control plane, and avoid introducing a second execution database or chat-style runtime state

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
- `src/lib/repository-snapshot.js`
- `src/lib/prompt-compiler.js`
- `src/lib/run-preparer.js`
- `src/lib/run-plan.js`
- `src/lib/run-preflight.js`
- `src/lib/checkpoint.js`
- `src/lib/http-errors.js`
- `src/lib/adapters.js`
- `src/lib/run-executor.js`
- `src/lib/recipes.js`
- `src/lib/schema-validator.js`
- `src/lib/overview.js`

Supported commands:

- `init`
- `scan`
- `memory:bootstrap`
- `memory:validate`
- `adapter:list`
- `recipe:list`
- `task:new`
- `quick`
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
- `dashboard/document-helpers.js`
- `dashboard/api-client-helpers.js`
- `dashboard/form-state-helpers.js`
- `dashboard/form-event-helpers.js`
- `dashboard/orchestration-state-helpers.js`
- `dashboard/task-board-helpers.js`
- `dashboard/task-list-render-helpers.js`
- `dashboard/execution-detail-helpers.js`
- `dashboard/task-detail-helpers.js`
- `dashboard/log-panel-helpers.js`
- `dashboard/overview-render-helpers.js`

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
- quick-create a task bundle from the CLI without skipping durable artifacts
- generate a local-only memory bootstrap prompt without embedding cloud AI calls
- update selected task metadata
- edit `task.md`, `context.md`, and `verification.md`
- refresh manual proof anchors for `verification.md`
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
- `docs/VERIFICATION_FRESHNESS_DESIGN.md`

## What was validated locally

Verified on 2026-04-09:

- `npm test`
- `npm run memory:validate -- --root .`
- `npm run smoke`

The smoke test currently covers:

- CLI initialization
- repository scan
- adapter listing
- recipe listing
- task creation with recipe
- quick task bootstrap from the CLI, including project-profile refresh plus prompt/run-request/launch-pack/checkpoint generation
- memory bootstrap prompt generation from the CLI, including project-profile refresh plus a durable handoff prompt under `.agent-workflow/handoffs/memory-bootstrap.md`
- prompt compilation
- run preparation
- run evidence recording
- checkpoint generation
- schema validation
- local server startup
- overview API
- task detail API
- dashboard write APIs for creating tasks, updating tasks, editing task docs, and recording runs
- dashboard/local API refresh for manual proof anchors, including managed-block persistence and immediate task-detail re-read
- markdown guardrails that keep managed task/context blocks synced without wiping nearby custom notes
- markdown guardrails that preserve the managed manual proof-anchor block while the verification editor saves freeform proof text
- CLI executor path for `run:execute`, including run ledger + verification/checkpoint refresh
- dashboard executor bridge APIs for `POST /api/tasks/:taskId/execute` and `GET /api/tasks/:taskId/execution`
- dashboard active execution log API for `GET /api/tasks/:taskId/execution/logs/:stream`
- derived execution-state observability fields such as `activity`, `streams`, `lastOutputAt`, and `totalOutputBytes`
- seamless UI handoff from active execution tails to persisted run-log viewing after completion
- helper-backed presentation mapping for execution/run outcomes so cancellation/timeout/failure stay visually distinct in task detail
- static execution/run detail helper loading via `dashboard/index.html`, so browser and Node smoke imports both resolve the same rendering helpers
- static task-detail helper loading via `dashboard/index.html`, so browser rendering and Node unit tests use the same task-detail / verification markup logic
- static log-panel helper loading via `dashboard/index.html`, so browser log state/render behavior shares the same helpers used in unit tests
- static overview-render helper loading via `dashboard/index.html`, so dashboard list/summary rendering shares the same helpers used in unit tests
- static task-list helper loading via `dashboard/index.html`, so task-card filtering/rendering shares the same helpers used in unit tests
- static form-state helper loading via `dashboard/index.html`, so editor/task-form state derivation shares the same helpers used in unit tests
- static form-event helper loading via `dashboard/index.html`, so task/doc/run form event flows share the same helpers used in unit tests
- static orchestration-state helper loading via `dashboard/index.html`, so task selection and execution-state resolution logic shares the same helpers used in unit tests
- static api-client helper loading via `dashboard/index.html`, so dashboard request/url construction shares the same helpers used in unit tests
- dashboard executor cancel API for `POST /api/tasks/:taskId/execution/cancel`
- explicit API error typing for local dashboard/server routes, including 400/404/409 behavior without message-text status inference
- executor capture mode and timeout path
- unit-level `run:execute` lifecycle coverage for plan resolution, passed runs, timeout metadata, and interruption records
- overview and task detail freshness heuristics for memory/task docs
- diff-aware verification gate status transitions from "needs proof" to "covered"
- manual proof-anchor refresh, managed block persistence, anchor-aware manual gate reopening, and editor-safe verification saves
- checkpoint content for pending proof, covered proof, and weak scope hints
- explicit proof linkage: generic verification text stays insufficient, but passed scoped evidence can cover files
- structured run evidence: API/CLI run creation can persist scope proof paths plus concrete check/artifact refs
- proof item parsing for manual verification notes and passed run evidence
- overview aggregate stats for latest executor outcomes across tasks
- overview aggregate stats and task summaries for verification signal states across tasks, including the guardrail that blank `automated:` / `manual:` placeholders do not count as real planned checks
- unit-level verification for strong vs weak proof parsing, `scope-missing` / `partially-covered` transitions, and managed markdown synchronization in task documents
- unit-level verification for Git repository snapshot parsing, including modified/untracked paths, rename metadata, filesystem fallback, and targeted fingerprint-cache reuse for unchanged proof paths
- unit-level verification for passed-run proof anchors, including anchor persistence, anchor-aware gate matching, and schema validation for malformed anchors
- unit-level verification for dashboard task-detail / verification rendering, including proof signal separation and execution-log UI wiring in task detail markup
- unit-level verification for dashboard log-panel helpers, including active-task stream toggling, resolved log-source loading, and persisted-vs-live log messaging
- unit-level verification for dashboard overview/list render helpers, including stat-card composition plus memory/verification/run/validation markup
- unit-level verification for dashboard task-list render helpers, including filter summaries, card tone classes, and empty filtered-state messaging
- unit-level verification for dashboard form-state helpers, including document editor guardrails, task-form reset rules, and optional timeout normalization
- unit-level verification for dashboard form-event helpers, including task/run/document payload normalization and execution request validation
- unit-level verification for dashboard orchestration-state helpers, including task selection fallback, execution UI button state, and completion-status messaging
- unit-level verification for dashboard api-client helpers, including request option generation, log-url construction, and structured API error surfacing
- unit-level verification for explicit HTTP error helpers plus server-facing task/run/execution error status codes
- unit-level verification for `run-executor`, including adapter token resolution, timeout override behavior, durable stdout/stderr evidence, and interrupted-run persistence
- unit-level verification for `overview`, including uninitialized workspace behavior plus task-level aggregation of latest executor outcomes and verification signal summaries
- unit-level verification for `server-api`, including health plus representative 400 validation errors, 404 missing-resource routes, and 409 inactive-execution conflicts

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

1. Revisit adapter extensibility only after the executor/evidence model is proven stable in dogfooding; prefer a small `adapter:create` or dynamic-discovery path over hard-coded growth.
2. Decide whether the dashboard should grow a thin `quick` entrypoint over the existing CLI contract without inventing a second task-creation path.
3. Keep interactive `stdioMode: inherit` flows CLI-only until there is a real terminal-ownership design.
4. Preserve the current contract-first split between adapter config, prepared run artifacts, preflight, and durable evidence instead of introducing dashboard-only runtime state.
5. Keep watching the GitHub Actions matrix after executor or packaging changes so hosted-runner portability does not silently regress.

## What not to do next

- do not rush into full process orchestration before the workflow model is stable
- do not build a cloud sync layer yet
- do not turn this into a generic chat shell
- do not hard-code absolute paths or machine-specific runner behavior

## Recommended immediate task for the next agent

Suggested first task:

Now that npm publishing, external onboarding validation, cross-platform CI verification, and the `memory:bootstrap` -> `memory:validate` loop are all in place, the next highest-value task is to improve adapter extensibility without breaking the current contract-first execution model.

Expected shape:

- preserve the current local-only API contract and existing smoke coverage
- prefer a small `adapter:create` or dynamic-discovery path over a plugin system or hard-coded adapter growth
- keep the next executor slice focused on one real local CLI path before broadening defaults or adapter breadth
- keep manual proof human-authored in `## Proof links`, with machine-owned anchor metadata isolated under the managed `## Evidence` block
- keep using `src/lib/http-errors.js` for any new server-facing route or local API surface
- keep `docs/RUN_EXECUTE_DESIGN.md` as the boundary for any future `run:execute` work so executor breadth does not outrun the evidence model
- executor work should now start from the shared `preflightRunExecution(...)` result plus normalized failure categories instead of another launch surface
- keep real-adapter argv templates grounded in confirmed local CLI help/output instead of copying unsupported top-level flags into subcommands
- if auth/provider setup becomes productized, keep it additive and adapter-owned instead of baking vendor-specific secret assumptions into global workflow state
- keep `dashboard/app.js` focused on orchestration, event wiring, and refresh flow
- move pure rendering or parsing helpers into static modules that still work without a bundler
- if verification evolves further, preserve backward compatibility for legacy/manual proof and keep anchors repo-relative only

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
