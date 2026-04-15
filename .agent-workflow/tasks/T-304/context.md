# T-304 Context

## Why now

T-303 builds `mcp:install` for Claude Code and Cursor. Codex also fully supports MCP (stdio and streamable HTTP transports) but uses TOML config instead of JSON. Without this task, Codex users must manually edit `~/.codex/config.toml` — which is the exact friction `mcp:install` was designed to eliminate. All three major agent clients (Claude Code, Codex, Cursor) should be first-class citizens in one release.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Codex MCP config lives in `~/.codex/config.toml` (global) or `.codex/config.toml` (project, trusted only)
- Codex supports both stdio and streamable HTTP MCP transports
- TOML config format for MCP servers in Codex:
  ```toml
  [mcp_servers.agent-workflow]
  type = "stdio"
  command = "npx"
  args = ["agent-workflow-mcp"]
  ```
- Claude Code uses JSON: `~/.claude/settings.json` → `mcpServers` object
- Cursor uses JSON: `.cursor/mcp.json`
- T-303 builds the JSON installer — this task adds the TOML parallel
- The MCP server binary (`agent-workflow-mcp`) from T-300 is the same for all three clients — only the config format differs
- Codex CLI and Codex IDE extension share the same `config.toml`, so one install covers both

## Open questions

- Should we use a TOML library or write a minimal parser? Leaning minimal parser — the MCP section is just `[mcp_servers.name]` with 3-4 key-value pairs, no need for full TOML spec compliance.
- Should auto-detect try all three clients or stop at the first found? Leaning try all and report which ones were configured.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-303 (mcp:install infrastructure must exist)
- No runtime dependencies — TOML handling must be built-in
- Must not corrupt existing Codex config
- Must pass `npm test`, `npm run lint`, `npm run smoke`
