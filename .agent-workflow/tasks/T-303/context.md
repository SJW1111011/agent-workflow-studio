# T-303 Context

## Why now

T-300 builds the MCP server, but users still need to manually edit JSON config files to register it. This is the #1 onboarding friction point for MCP tools. A one-command installer eliminates it. Should ship shortly after T-300 to complete the "zero-manual-config" story.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Claude Code MCP config: `~/.claude/settings.json` → `mcpServers` object
- Cursor MCP config: `.cursor/mcp.json` at project root or user home
- MCP server entry format: `{"command": "npx", "args": ["agent-workflow-mcp"], "env": {}}`
- The `bin` entry from T-300 provides `agent-workflow-mcp` as the command
- `settings.json` may contain other unrelated settings — must preserve them

## Open questions

- Should auto-detect prefer Claude Code or Cursor when both are present? Leaning Claude Code since this project is built for it.
- Should `mcp:install` also run `init` if `.agent-workflow/` doesn't exist? Leaning yes — reduces onboarding to one command.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P2
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-300 (MCP server must exist)
- Must never corrupt existing config files — atomic write pattern
- Must not add runtime dependencies
- Must pass `npm test`, `npm run lint`, `npm run smoke`

## Progress notes

- 2026-04-15T09:24:00.000Z: Read the required project memory, roadmap, CLI, MCP docs, and existing tests. Confirmed the change should land as a focused install helper plus thin CLI wiring and docs updates.
- 2026-04-15T17:13:00.000Z: Implemented `mcp:install` / `mcp:uninstall`, added merge/idempotence coverage, updated README and MCP setup docs, and verified with `npm test`, `npm run lint`, `npm run smoke`, and `npm run format:check`.
