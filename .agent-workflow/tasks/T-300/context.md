# T-300 Context

## Why now

Phase 1 reduced the common workflow to `quick` plus `done`, but agents still had to leave their MCP-capable editor and drop into a terminal to call those commands. Shipping a stdio MCP server removes that context switch and turns the existing local-first workflow modules into reusable tools for Claude Code, Cursor, and other MCP clients.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- The implementation pins `@modelcontextprotocol/sdk` at `1.3.0`.
- The pinned SDK ships a CommonJS build, so the repo can stay CommonJS while adding an MCP entry point.
- The pinned SDK's stdio transport uses newline-delimited JSON messages, not `Content-Length` framing.
- All workflow logic still lives in the existing `src/lib/` modules; the MCP layer is a thin wrapper.
- The CLI now exposes `mcp:serve`, and the package now exposes `agent-workflow-mcp`.
- README and docs now include Claude Code and Cursor setup examples plus a dedicated MCP setup guide.

## Open questions

- No blocking design questions remain for this slice.
- Follow-up work can decide whether later SDK upgrades should expose richer structured tool payloads when client support improves.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- The MCP SDK is the only new direct runtime dependency in this task.
- Existing CLI, dashboard, and HTTP behavior must keep working unchanged.
- The MCP server must not print extra stdout logs after startup because stdout is reserved for protocol traffic.
- Verification must include the actual MCP handler tests plus the real CLI stdio path.
