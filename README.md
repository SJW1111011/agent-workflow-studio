# Agent Workflow Studio

<p align="center">
  <a href="https://www.npmjs.com/package/agent-workflow-studio"><img src="https://img.shields.io/npm/v/agent-workflow-studio?style=for-the-badge" alt="npm version"></a>
  <a href="https://github.com/SJW1111011/agent-workflow-studio/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/SJW1111011/agent-workflow-studio/ci.yml?branch=main&style=for-the-badge&label=CI" alt="CI"></a>
  <a href="https://codecov.io/gh/SJW1111011/agent-workflow-studio"><img src="https://codecov.io/gh/SJW1111011/agent-workflow-studio/graph/badge.svg" alt="Coverage"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="MIT license"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=for-the-badge" alt="Node 18+"></a>
  <img src="https://img.shields.io/badge/runtime%20deps-1-blue?style=for-the-badge" alt="One runtime dependency for MCP support">
</p>

Track what your coding agents do. Record evidence. Resume where you left off.

Local-first · Git-native · npm-installable · MCP-ready

## Who is this for?

| You are...                                      | Recommended path                                              | Time to first task         |
| ----------------------------------------------- | ------------------------------------------------------------- | -------------------------- |
| A developer using Claude Code, Codex, or Cursor | **MCP tools** — say "create a task" in your editor            | 2 minutes (one-time setup) |
| A developer who prefers the terminal            | **CLI** — `quick --lite` + `done`                             | 30 seconds                 |
| A team running auditable agent workflows        | **Full mode** — task docs, prompt compilation, evidence gates | 5 minutes per task         |

## How it works

A local-first workflow loop: create a task, do the work, record what happened.

<p align="center">
  <img
    src="https://raw.githubusercontent.com/SJW1111011/agent-workflow-studio/main/docs/assets/agent-workflow-hero.png"
    alt="Agent Workflow Studio workflow diagram showing quick creation, execution and verification, checkpoints, and the local dashboard"
    width="1100"
  />
</p>

## Try it in 1 minute

### Path 1: MCP (recommended for editor users)

```bash
npm install agent-workflow-studio
npx agent-workflow init --root .
npx agent-workflow mcp:install --root .
```

Then in Claude Code, Codex, or Cursor:

```
"create a task called 'Add authentication'"
"list my tasks"
"mark T-001 done with 'implemented JWT login'"
```

### Path 2: CLI (quick and light)

```bash
npm install agent-workflow-studio
npx agent-workflow init --root .
npx agent-workflow quick "Add authentication" --lite --root .
# ... do the work ...
npx agent-workflow done T-001 "Implemented JWT login" --complete --root .
```

### Path 3: Full workflow (auditable)

```bash
npm install agent-workflow-studio
npx agent-workflow init --root .
npx agent-workflow quick "Add authentication" --task-id T-001 --agent codex --root .
# Fill in task.md, context.md, verification.md
# Hand prompt.codex.md to Codex
npx agent-workflow done T-001 "Implemented JWT login" --status passed --complete --root .
npx agent-workflow dashboard --root . --port 4173
```

For the helper-directory install flow, see [docs/GETTING_STARTED.md](docs/GETTING_STARTED.md).

## See the dashboard

Track tasks, runs, risks, executor outcomes, and verification signals from one local control plane.

<p align="center">
  <img
    src="https://raw.githubusercontent.com/SJW1111011/agent-workflow-studio/main/docs/assets/dashboard.png"
    alt="Agent Workflow Studio dashboard overview showing task counts, runs, risks, executor outcomes, and verification signals"
    width="1100"
  />
</p>

The current workflow UI still keeps the legacy dashboard available, while `dashboard-next/` now ships a responsive Preact shell with light, dark, and system theme support.

For feature-complete task operations today, keep using:

```bash
npx agent-workflow dashboard --root . --port 4173 --legacy-dashboard
```

For modern-shell development in this repository, run the local API server on `4173`, then start the new shell on `5173`:

```bash
npm run dashboard -- --root . --port 4173
npm run dashboard:dev
```

When you want the repo-local server to serve the built Preact shell instead of the legacy HTML bundle, generate `dashboard-next/dist/` first:

```bash
npm run dashboard:build
```

## Real-time execution streams

Dashboard execution still keeps the existing snapshot routes, but it now also exposes SSE endpoints for live subscribers:

- `GET /api/tasks/:taskId/execution` returns the current execution snapshot as JSON
- `GET /api/tasks/:taskId/execution/events` streams execution state updates as `text/event-stream`
- `GET /api/tasks/:taskId/execution/logs/:stream` returns the current stdout/stderr tail as JSON
- `GET /api/tasks/:taskId/execution/logs/:stream/stream` streams live stdout/stderr lines as `text/event-stream`

That keeps backward compatibility for polling clients while giving the dashboard and future MCP subscriptions a push-based path.

## Core capabilities

- **`quick`** - create either a minimal Lite task scaffold or the full prompt/run/checkpoint bundle, depending on how much ceremony you want up front
- **`memory:bootstrap`** - generate a local-only handoff prompt that helps Codex or Claude Code fill grounded project memory
- **`run:execute`** - launch a local adapter when you explicitly opt into `commandMode: exec`, with shared preflight, logs, and evidence capture
- **`done`** - record evidence and refresh the checkpoint in one step, with an optional `--complete` flag to mark the task done
- **`undo`** - roll back the latest workflow-layer operation (`quick`, `run:add`, `done`, or explicit `checkpoint`) without touching source files or git history
- **`mcp:install` / `mcp:uninstall`** - register or remove the MCP server in Codex, Claude Code, and Cursor without manual JSON or TOML editing
- **`mcp:serve`** - expose the core workflow operations as MCP tools over stdio for Claude Code, Cursor, and other MCP clients
- **`verification gate`** - compare repo-relative task scope against the current repository snapshot and surface evidence coverage as a percentage, while still listing which scoped files need explicit evidence
- **`verification records`** - use timestamp-based freshness by default, with opt-in strict fingerprint checks for audit-heavy workflows
- **`skills:generate`** - write `AGENTS.md`, `CLAUDE.md`, and Claude slash commands so the workflow becomes part of the agent's default context
- **`dashboard`** - inspect tasks, evidence, freshness, risks, execution state, and quick-create flows from a local control plane at `localhost:4173`

## Built for agents too

Teach Codex and Claude Code the workflow automatically:

```bash
npx agent-workflow skills:generate --root .
```

This writes `AGENTS.md`, `CLAUDE.md`, and Claude slash commands so the agent can follow the same task/evidence/checkpoint flow without manual setup.

See [AGENT_GUIDE.md](AGENT_GUIDE.md) for the full workflow guide.

## Use it through MCP

Install the MCP server into your editor config first:

```bash
npx agent-workflow mcp:install --client codex --root .
npx agent-workflow mcp:install --client claude --root .
npx agent-workflow mcp:install --client cursor --root .
```

If the standard config file already exists, you can also omit `--client` and let the CLI auto-detect supported targets:

```bash
npx agent-workflow mcp:install --root .
```

The installer writes the correct launch entry for the way you are running the package:

- contributor checkout: `node /absolute/path/to/agent-workflow-studio/src/mcp-server.js --root ...`
- local npm install: `npx agent-workflow-mcp --root ...` plus the right `cwd`
- Codex is written to `~/.codex/config.toml`; Claude Code and Cursor keep using their existing JSON config files

Remove the MCP entry later with:

```bash
npx agent-workflow mcp:uninstall --client codex --root .
npx agent-workflow mcp:uninstall --client claude --root .
```

For a quick terminal check, you can still start the stdio server directly:

```bash
npx agent-workflow mcp:serve --root .
```

The server exposes these MCP tools:

- `workflow_quick`
- `workflow_done`
- `workflow_update_task`
- `workflow_append_note`
- `workflow_task_list`
- `workflow_run_add`
- `workflow_checkpoint`
- `workflow_undo`
- `workflow_validate`
- `workflow_overview`

That lets an MCP-connected agent update task status or priority mid-execution and append timestamped progress notes to `context.md`, instead of waiting until the final `done` step to leave durable state behind. For the auto-install flow, Codex TOML examples, and Claude Code or Cursor specifics, see [docs/MCP_SETUP.md](docs/MCP_SETUP.md).

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
|                      - runs/ evidence + verification records        |
+-------------------------------------------------------------------+
         |                                         |
         v                                         v
   Git-trackable repo                        Dashboard / CLI
```

## Daily workflow

### The fast path (most users)

```bash
npx agent-workflow quick "Fix the login bug" --lite --root .
# ... fix the bug ...
npx agent-workflow done T-001 "Fixed race condition in session handler" --complete --root .
```

That's it. `done` auto-infers changed files from `git diff`, records evidence, refreshes the checkpoint, and marks the task complete. Zero flags needed for the common case.

### The MCP path (editor users)

If you've run `mcp:install`, just talk to your agent:

```
"create a lite task for fixing the login bug"
"I'm done — fixed race condition in session handler, mark it complete"
"undo that"
```

### The full path (audit / compliance)

1. Create a task with `quick` or `task:new` (Full mode).
2. Fill in `task.md` (scope, deliverables, risks), `context.md`, and `verification.md`.
3. Compile the prompt: `prompt:compile T-001 --root .`
4. Hand the prompt to Codex or Claude Code, or use `run:execute` with a local adapter.
5. Record evidence: `done T-001 "summary" --status passed --proof-path src/auth.js --check "tests pass" --complete --root .`
6. Add `--strict` for fingerprint-backed freshness, or set `strictVerification: true` in `project.json`.
7. Review `checkpoint.md` and the verification gate.

## Undo the latest workflow action

Use `undo` when the most recent workflow-layer step created the wrong task or evidence record:

```bash
npx agent-workflow undo --root .
```

`undo` currently reverses the latest `quick`, `run:add`, `done`, or explicit `checkpoint` operation. The log is capped to the latest 20 entries, and rollback stays inside `.agent-workflow/` so source files and git history are left alone.

## Lite vs Full

`quick` now supports two task creation modes:

- `npx agent-workflow quick "My task" --lite --root .` creates only `task.json` and `task.md`, then lets `prompt:compile`, `run:prepare`, `run:add`, `done`, and `checkpoint` materialize the rest on demand.
- `npx agent-workflow quick "My task" --full --agent codex --root .` preserves the current full bundle: task docs, prompt, run request, launch pack, and checkpoint.
- The current default is still Full Mode so existing workflows keep working unchanged.

## Verification model

Two ideas sit at the center of the project:

- **Verification gate**: compare repo-relative task scope against the current repository snapshot (Git-backed when available, filesystem fallback otherwise), report what percentage of scoped files have verified evidence, and still explain which files need attention.
- **Verification records**: default freshness is timestamp-based, which keeps the common path simpler and faster. When you opt into `--strict` or set `strictVerification: true`, passed run evidence and refreshed manual verification also carry content fingerprints so freshness survives misleading `mtime` churn, branch switches, and agent handoff noise. `draft` evidence still needs checks or artifacts; `verified` evidence includes repo-relative paths plus checks or artifacts.

## Upgrading from pre-Phase-3

No manual migration step is required for existing `.agent-workflow/` data.

- Older run records that still use legacy evidence aliases are normalized on read, so CLI, MCP, and dashboard task detail can keep loading them.
- Older `verification.md` managed anchor blocks that still use the `manualProofAnchors` payload are still parsed, and they stay preserved when strict verification is off.
- Older `checkpoint.md` and `checkpoint.json` files can stay on disk as-is; if you regenerate a checkpoint, the new file will use the current `action-required` / `incomplete` / `unconfigured` wording.
- `validate --root .` accepts both the old and new verification check vocabulary, so a repo upgrade does not require hand-editing historical run JSON first.
- If you want managed proof-anchor refresh again, enable strict verification in `.agent-workflow/project.json` with `"strictVerification": true`.

## Why this exists

Coding agents are powerful but forgetful. They lose context between sessions, leave no audit trail, and can't resume interrupted work. Agent Workflow Studio is the missing layer:

- **Task memory** — structured context that survives session boundaries
- **Evidence trail** — what changed, what was verified, what's still open
- **Resumable checkpoints** — pick up where you (or the agent) left off
- **Shared control plane** — one dashboard across Codex, Claude Code, and Cursor

## Commands

- **Onboarding:** `init`, `scan`, `memory:bootstrap`, `memory:validate`
- **Tasking:** `recipe:list`, `quick`, `task:new`, `task:list`
- **Adapters:** `adapter:list`, `adapter:create`
- **Execution:** `prompt:compile`, `run:prepare`, `run:execute`, `run:add`, `done`, `checkpoint`, `undo`, `mcp:install`, `mcp:uninstall`, `mcp:serve`
- **Inspection:** `dashboard`, `validate`
- **Skills:** `skills:generate`

## Adapter layer

Adapters bridge the workflow layer and real agent CLIs.

- Built-in Codex and Claude Code adapters ship as `manual` by default
- Switch to `commandMode: exec` when you are ready to automate local runs
- `adapter:create` scaffolds a custom adapter for any CLI agent
- `stdinMode: promptFile` lets non-interactive CLIs receive prompts over stdin
- Execution captures stdout/stderr, timeout, interruption, and cancellation metadata
- Shared preflight checks verify runner availability, env vars, and stdio compatibility before spawn

Both Codex and Claude Code have been dogfooded on this repository with real local runs. See [docs/ADAPTERS.md](docs/ADAPTERS.md) for the full adapter contract and [docs/RUN_EXECUTE_DESIGN.md](docs/RUN_EXECUTE_DESIGN.md) for the executor design.

## Recipes and schema validation

- Recipes (`audit`, `feature`, `review`) are indexed in `.agent-workflow/recipes/index.json` and attached to tasks via `recipeId`
- `validate` checks project config, adapters, tasks, and run records for missing or malformed fields
- The dashboard surfaces schema issues, memory freshness, and evidence coverage in one view

See [docs/RECIPES_AND_SCHEMA.md](docs/RECIPES_AND_SCHEMA.md).

## Relocatable by design

No absolute paths are written into workflow files. The CLI and dashboard resolve the target repository from `--root` or the current working directory. See [docs/RELOCATABLE_DESIGN.md](docs/RELOCATABLE_DESIGN.md).

## Layout

```text
agent-workflow-studio/
  src/           CLI + core modules
  dashboard/     legacy static dashboard fallback
  dashboard-next/ Vite + Preact shell source
  docs/          design docs and guides
  scripts/       smoke test + unit test runner
  test/          unit tests
```

Initialized target repository:

```text
.agent-workflow/
  project.json
  project-profile.json / .md
  memory/        product, architecture, domain-rules, runbook
  recipes/       audit, feature, review + index.json
  adapters/      codex.json, claude-code.json, custom *.json
  tasks/         T-001/, T-002/, ...
  handoffs/      memory-bootstrap.md
  decisions/
```

## Contributor workflow

From this project root:

```bash
npm install
npm run build
npm run init -- --root ../some-repo
npm run scan -- --root ../some-repo
npm run memory:bootstrap -- --root ../some-repo
npm run quick -- "Build the scanner" --task-id T-001 --priority P1 --agent codex --root ../some-repo
npm run dashboard -- --root ../some-repo --port 4173
npm run dashboard:dev
npm run dashboard:build
npm run dashboard -- --root ../some-repo --port 4173 --legacy-dashboard
npm run mcp:serve -- --root ../some-repo
npm run run:execute -- T-001 --agent codex --root ../some-repo
npx agent-workflow done T-001 "Scanner pass completed." --root ../some-repo
npx agent-workflow done T-001 "Docs-only follow-up." --proof-path README.md --status draft --root ../some-repo
npm run validate -- --root ../some-repo
npm test
```

`npm run build` now emits `dist/` from `src/` and compiles `src/lib/fs-utils.ts` for the CommonJS bridge at `src/lib/fs-utils.js`. Re-run it after editing `.ts` files, or let `npm test` rebuild automatically via `pretest`.

## Learn more

- [Getting Started](docs/GETTING_STARTED.md) - the full npm-first onboarding flow
- [Documentation Index](docs/README.md) - the map for all design and reference docs
- [MCP Setup](docs/MCP_SETUP.md) - Codex, Claude Code, and Cursor auto-install plus manual configuration examples
- [Release Notes 0.1.2](docs/RELEASE_NOTES_0.1.2.md) - the published release summary for the current npm version
- [Architecture](docs/ARCHITECTURE.md) - how the scaffold, dashboard, adapters, and evidence model fit together
- [Verification Design](docs/VERIFICATION_FRESHNESS_DESIGN.md) - verification gates, verification records, and freshness rules
- [Executor Design](docs/RUN_EXECUTE_DESIGN.md) - local executor planning, preflight, and evidence capture
- [Adapters](docs/ADAPTERS.md) - built-in adapters and custom adapter scaffolding
- [Changelog](CHANGELOG.md) - released changes plus current unreleased docs polish
- [Roadmap](docs/ROADMAP.md) - the likely next build steps
- [Publishing](docs/PUBLISHING.md) - npm release checklist

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md). Keep changes local-first, relocatable, and schema-aware. Run `npm run lint`, `npm run format:check`, `npm test`, and `npm run smoke` before opening a PR; `npm test` now rebuilds `dist/` first so repo-local TypeScript bridges stay current.

GitHub Actions now also enforces the Node 18/20/22 matrix, uploads the Node 22 coverage run to Codecov, and uses tag-only publish automation for npm releases.

## Community

[CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) defines how we collaborate. Issues and PRs should stay focused on strong prompts, evidence quality, checkpoints, and agent handoff durability.

## Project history

Built largely by Codex in a single session (default 258k context, repeatedly compacted and spanning more than 50 commits over 7 days), with Claude Code providing evaluation, suggestions, and code review. The project itself is managed by agent-workflow-studio — 24 tasks across 4 completed phases, each reviewed against a structured checklist. This is both the tool and the proof that structured agent workflows work.

## License

Released under the MIT License. See [LICENSE](LICENSE).
