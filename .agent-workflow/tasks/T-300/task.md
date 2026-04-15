# T-300 - MCP Server - expose core workflow tools via Model Context Protocol

## Goal

Build an MCP (Model Context Protocol) server that exposes the core workflow operations as MCP tools. Any MCP-compatible client can create tasks, record evidence, refresh checkpoints, inspect the workspace, and undo the latest workflow-layer action without dropping to a separate terminal command. The server should run over stdio so Claude Code, Cursor, and other MCP clients can launch it directly from their MCP configuration.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/mcp-server.js
  - repo path: src/lib/mcp-tools.js
  - repo path: src/cli.js
  - repo path: package.json
  - repo path: package-lock.json
  - repo path: test/mcp-tools.test.js
  - repo path: test/mcp-server.test.js
  - repo path: README.md
  - repo path: docs/MCP_SETUP.md
  - repo path: docs/README.md
- Out of scope:
  - repo path: dashboard/
  - repo path: src/server.js
  - repo path: src/lib/run-executor.js
  - repo path: SSE streaming (T-301)

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md
- MCP SDK documentation (https://modelcontextprotocol.io)

## Deliverables

- `src/mcp-server.js` - MCP server with these tools:
  - `workflow_quick`
  - `workflow_done`
  - `workflow_task_list`
  - `workflow_run_add`
  - `workflow_checkpoint`
  - `workflow_undo`
  - `workflow_validate`
  - `workflow_overview`
- `src/lib/mcp-tools.js` - shared tool definitions plus handlers that delegate to the existing workflow modules
- CLI support for `mcp:serve`
- package metadata for the `agent-workflow-mcp` bin
- MCP-focused automated tests
- README setup examples
- `docs/MCP_SETUP.md`

## Risks

- The MCP SDK is the first direct runtime dependency. Keep imports isolated to `src/mcp-server.js` and pin the version.
- MCP stdio behavior can drift between SDK versions. Keep integration coverage on the actual CLI surface.
- Tool input schemas must stay aligned with CLI semantics or MCP users will see confusing behavior differences.
- The MCP server is a long-running process and must shut down cleanly without leaking listeners or writing non-protocol stdout noise.

## Acceptance Criteria

- `npx agent-workflow mcp:serve` starts an MCP server on stdio
- Claude Code and Cursor can be configured to use this server from documented examples
- `workflow_quick` creates a task and returns the task id
- `workflow_task_list` returns task status, priority, and run counts
- `workflow_done` records evidence and refreshes the checkpoint
- All 8 tools return JSON-serializable results
- `npm test` passes
- `npm run lint` passes
- `npm run smoke` passes
