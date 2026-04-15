# T-300 - MCP Server — expose core workflow tools via Model Context Protocol

## Goal

Build an MCP (Model Context Protocol) server that exposes the core workflow operations as MCP tools. Any MCP-compatible client (Claude Code, Cursor, Windsurf) can call `quick`, `done`, `task:list`, `run:add`, `checkpoint`, and `undo` directly. The server uses stdio transport so it can be configured in Claude Code's `settings.json` or Cursor's MCP config. This is the foundation of Phase 2: turning agent-workflow-studio from a CLI tool into an integration platform.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/mcp-server.js (new — MCP server entry point, stdio transport)
  - repo path: src/lib/mcp-tools.js (new — tool definitions and handlers wrapping existing lib modules)
  - repo path: src/cli.js (register `mcp:serve` command)
  - repo path: package.json (add `@anthropic-ai/sdk` or `@modelcontextprotocol/sdk` as dependency, add `mcp:serve` script, add `bin` entry for MCP)
  - repo path: test/mcp-tools.test.js (new — unit tests for tool handlers)
  - repo path: README.md (document MCP setup instructions)
  - repo path: docs/MCP_SETUP.md (new — detailed MCP configuration guide)
- Out of scope:
  - repo path: dashboard/ (no UI changes)
  - repo path: src/server.js (HTTP server unchanged — MCP is a separate transport)
  - repo path: src/lib/run-executor.js (remote execution via MCP is a later task)
  - repo path: SSE streaming (T-301)

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 2 context)
- MCP SDK documentation (https://modelcontextprotocol.io)

## Deliverables

- `src/mcp-server.js` — MCP server using stdio transport with these tools:
  - `workflow_quick` — create a task (lite or full mode)
  - `workflow_done` — record evidence + checkpoint in one step
  - `workflow_task_list` — list all tasks with status, runs, priority
  - `workflow_run_add` — record a run with optional proof paths and checks
  - `workflow_checkpoint` — refresh task checkpoint
  - `workflow_undo` — undo the most recent operation
  - `workflow_validate` — validate workspace integrity
  - `workflow_overview` — get workspace summary
- `src/lib/mcp-tools.js` — tool definitions (name, description, inputSchema) and handlers that delegate to existing `src/lib/` modules
- `mcp:serve` CLI command that starts the MCP server on stdio
- `package.json` bin entry: `"agent-workflow-mcp": "src/mcp-server.js"`
- Unit tests for all tool handlers
- README section with Claude Code and Cursor configuration examples
- `docs/MCP_SETUP.md` with full setup guide

## Risks

- MCP SDK is the first runtime dependency — breaks the zero-dependency principle. Mitigate: the MCP server is an optional entry point (`src/mcp-server.js`), the core CLI (`src/cli.js`) remains zero-dep. Mark the MCP SDK as an optional or peer dependency if possible.
- MCP protocol evolution — the SDK may change between versions. Pin the dependency version.
- stdio transport means the MCP server is a long-running process — must handle graceful shutdown and not leak resources.
- Tool input schemas must match the existing CLI argument contracts exactly, or users will get confused by discrepancies.

## Acceptance Criteria

- `npx agent-workflow mcp:serve` starts an MCP server on stdio
- Claude Code can be configured to use this server (documented in README)
- From Claude Code: "create a task called 'Add auth'" triggers `workflow_quick` and returns the task ID
- From Claude Code: "list my tasks" triggers `workflow_task_list` and returns formatted output
- From Claude Code: "mark T-001 done with 'implemented login'" triggers `workflow_done`
- All 8 tools return structured JSON results
- `npm test` passes with new tests
- `npm run smoke` passes
- Core CLI remains zero runtime dependencies (MCP SDK only needed by `src/mcp-server.js`)
