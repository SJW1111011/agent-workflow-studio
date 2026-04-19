# T-601 - MCP Resources and Prompts

## Goal

Expose workflow state as MCP resources and provide agent-native prompts that replace prompt:compile. Agents can pull task details, evidence, and memory docs as structured resources, and use prompts like `workflow-resume` to get full context for resuming a task — without truncation or file-write side effects.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/mcp-resources.js (new — resource handlers)
  - repo path: src/lib/mcp-prompts.js (new — prompt handlers)
  - repo path: src/mcp-server.js (register resource + prompt capabilities and handlers)
  - repo path: test/mcp-resources.test.js (new — unit tests)
- Out of scope:
  - repo path: src/lib/mcp-tools.js (existing tools unchanged)
  - repo path: dashboard-next/ (no dashboard changes)

## Design

### MCP Resources (read-only data agents can pull)

Static resources:
- `workflow://overview` — full workspace overview (JSON, from buildOverview)
- `workflow://tasks` — task list with status, coverage, verification signal

Resource templates (parameterized):
- `workflow://tasks/{taskId}` — single task detail with task.md content, context.md, verification.md, checkpoint.md, latest run summary, verification gate, coverage
- `workflow://memory/{docName}` — memory doc content (product.md, architecture.md, domain-rules.md, runbook.md)

Implementation: `src/lib/mcp-resources.js` exports `createResourceHandlers(workspaceRoot)` returning `{ listResources(), listResourceTemplates(), readResource(uri) }`.

### MCP Prompts (structured context packages)

- `workflow-resume` — args: `{ taskId }` — returns task.md + context.md + checkpoint.md + latest run summary + verification gate status. This is the MCP-native replacement for prompt:compile, with no truncation.
- `workflow-verify` — args: `{ taskId }` — returns verification.md + verification gate + evidence coverage + what's missing
- `workflow-handoff` — args: `{ taskId }` — returns cross-agent context: what was done, what's left, evidence status, checkpoint state

Implementation: `src/lib/mcp-prompts.js` exports `createPromptHandlers(workspaceRoot)` returning `{ listPrompts(), getPrompt(name, args) }`.

### MCP Server Changes

`src/mcp-server.js` adds capabilities for resources and prompts alongside existing tools. Register handlers for: ListResourcesRequestSchema, ListResourceTemplatesRequestSchema, ReadResourceRequestSchema, ListPromptsRequestSchema, GetPromptRequestSchema. MCP SDK 1.3.0 already exports all required schemas.

## Deliverables

- `src/lib/mcp-resources.js` with resource and template handlers
- `src/lib/mcp-prompts.js` with 3 prompt handlers
- `src/mcp-server.js` updated with resource + prompt capabilities
- `test/mcp-resources.test.js` with tests for resource listing, reading, and prompt generation
- All existing MCP tools and tests pass unchanged

## Acceptance Criteria

- MCP client can list resources and read workflow://overview, workflow://tasks, workflow://tasks/T-001, workflow://memory/product
- workflow-resume prompt returns full task context without truncation
- workflow-handoff includes evidence status and checkpoint state
- All 10 existing MCP tools still work unchanged
- npm test passes
- No new runtime dependencies

## Risks

- Resource URIs must be stable — changing them later breaks agent integrations
- Large overview JSON may be slow for repos with 100+ tasks
- Prompt content must not include sensitive data
