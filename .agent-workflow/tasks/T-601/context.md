# T-601 Context

## Why now

Agents already have MCP tool access, but they still need prompt-file compilation or manual file reads to recover full task context. Shipping resources and prompts here removes that gap, keeps MCP workflows read-only for resume/handoff, and sets up the later prompt-compile deprecation without breaking current tooling.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `src/lib/task-service.js` already exposes `getTaskDetail(workspaceRoot, taskId)`, which returns task docs, runs, freshness, and verification gate data suitable for MCP resource/prompt reuse.
- `src/lib/overview.js` already builds the workspace-level payload needed for `workflow://overview` and task-list summaries.
- MCP SDK `@modelcontextprotocol/sdk@1.3.0` in this repo exports the resource and prompt request schemas needed for `resources/*` and `prompts/*`.
- `src/lib/mcp-resources.js` now exposes stable read-only resources for `workflow://overview`, `workflow://tasks`, `workflow://tasks/{taskId}`, and `workflow://memory/{docName}`.
- `src/lib/mcp-prompts.js` now exposes `workflow-resume`, `workflow-verify`, and `workflow-handoff`, using a short text briefing plus embedded workflow resources for full, untruncated task context.
- `src/mcp-server.js` now advertises MCP `resources` and `prompts` capabilities alongside the existing tool surface.
- `test/mcp-resources.test.js` covers resource listing/reading and prompt generation, while `test/mcp-server.test.js` now checks the stdio server's resources and prompts end to end.
- `npm test` and `npm run lint` both passed on 2026-04-20 after the MCP resource/prompt changes landed.

## Open questions

- None at handoff.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
