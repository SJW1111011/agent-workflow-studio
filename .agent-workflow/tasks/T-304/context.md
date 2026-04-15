# T-304 Context

## Why now

T-303 adds `mcp:install` for Claude Code and Cursor. Codex also supports MCP over stdio, but it stores server definitions in TOML instead of JSON. Without this task, Codex users still have to hand-edit `~/.codex/config.toml`, which undercuts the same friction-reduction story the JSON installer already solved for the other clients.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Codex MCP config lives in `~/.codex/config.toml` (global) or `.codex/config.toml` (project, trusted only).
- Current Codex MCP config uses `[mcp_servers.<name>]` TOML tables with `command`, `args`, and optional `cwd` / `env`.
- This task only targets the global `~/.codex/config.toml` install path.
- Claude Code uses JSON: `~/.claude/settings.json` -> `mcpServers`.
- Cursor uses JSON: `.cursor/mcp.json`.
- T-303 built the JSON installer; this task adds the TOML parallel.
- The MCP server binary (`agent-workflow-mcp`) is the same for all three clients; only the config format differs.
- Codex CLI and the Codex IDE extension share the same `config.toml`, so one global install covers both.

## Open questions

- Project-level `.codex/config.toml` install support remains a follow-up after the global path lands cleanly.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-303 (`mcp:install` infrastructure must already exist).
- No runtime dependencies; TOML handling must stay built-in.
- Must not corrupt existing Codex config.
- Must pass `npm test`, `npm run lint`, and `npm run smoke`.
