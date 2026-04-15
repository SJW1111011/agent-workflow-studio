# T-300 Context

## Why now

Phase 1 cut the CLI ceremony to `quick --lite` + `done`. But users still switch between their agent (Claude Code, Cursor) and a terminal to run these commands. MCP eliminates this context switch entirely — the agent calls workflow tools directly. This is the single highest-impact integration: one task that unlocks every MCP-compatible client without per-client work.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- MCP (Model Context Protocol) is an open standard by Anthropic for LLM tool integration
- Claude Code, Cursor, Windsurf, and other editors support MCP servers via stdio transport
- The MCP SDK (`@modelcontextprotocol/sdk`) provides `Server` class with stdio transport
- All workflow logic already exists in `src/lib/` — the MCP server is a thin wrapper
- The existing HTTP server (`src/server.js`) has 23+ API endpoints — MCP tools are a subset of these
- Claude Code configuration: add server to `~/.claude/settings.json` under `mcpServers`
- Cursor configuration: add server to `.cursor/mcp.json`
- Zero existing MCP code in the codebase — clean slate
- Current project has zero runtime dependencies. MCP SDK will be the first. This is an acceptable trade-off for the integration value, but should be isolated to `src/mcp-server.js`.

## Open questions

- Should MCP SDK be a regular dependency or optional/peer dependency? Leaning regular — the MCP server is a first-class entry point, not optional.
- Should the MCP server resolve `--root` from cwd or require explicit configuration? Leaning cwd — matches CLI behavior.
- Should tool names use `workflow_` prefix or shorter names? Leaning `workflow_` to avoid collisions with other MCP tools.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- MCP SDK is the ONLY new runtime dependency allowed
- Core CLI (`src/cli.js`) must remain zero-dep — MCP SDK only imported by `src/mcp-server.js`
- Must not break any existing CLI, HTTP API, or test behavior
- Must pass `npm test`, `npm run lint`, `npm run smoke`
- Tool input schemas must match CLI argument semantics
