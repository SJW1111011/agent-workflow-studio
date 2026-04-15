# Architecture Memory

## Current architecture

- Core modules: `src/cli.js` for local commands, `src/server.js` for the local control-plane API, shared logic under `src/lib/`, static dashboard modules under `dashboard/`, and focused unit/smoke coverage under `test/` plus `scripts/smoke-test.js`.
- Data flows: `scan` builds `project-profile.*`; task bootstrap (`quick` or explicit task commands) creates task bundles; `prompt:compile` and `run:prepare` build adapter handoff artifacts; `run:execute` / `run:add` persist evidence; verification gates combine scope hints, repository snapshot data, and proof items; checkpoint generation summarizes the current durable state.
- Key dependencies: Node.js stdlib only, optional Git for stronger repository snapshots, and file-based workflow state under `.agent-workflow/`.
- MCP client install is format-aware: Claude Code merges `mcpServers` into `~/.claude/settings.json`, Cursor merges `mcpServers` into `.cursor/mcp.json`, and Codex now merges `[mcp_servers.<name>]` tables into `~/.codex/config.toml` without overwriting unrelated config.

## Fragile areas

- Dashboard orchestration state is still more centralized than the pure helper modules around it.
- Adapter extensibility is intentionally narrow; built-in contracts are stable, but broader third-party adapter growth is still future work.
- Real-agent execution validation still lags behind fake-runner coverage, so dogfooding remains important.
- Onboarding quality depends on keeping scaffold memory/task docs grounded instead of leaving placeholders in place.

## Invariants

- Durable truth stays in repository files such as `.agent-workflow/tasks/*`, `runs/*.json`, `verification.md`, and `checkpoint.md`.
- The dashboard remains a thin local control plane over shared CLI/server libraries rather than a second workflow engine.
- Verification prefers explicit proof linked to repo-relative files, checks, artifacts, and anchors over generic status text.
- Managed markdown blocks may be machine-maintained, but they must coexist safely with nearby human-edited content.
