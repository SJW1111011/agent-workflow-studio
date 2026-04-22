# T-605 - Deprecate prompt:compile and skills:generate

## Goal

Mark `prompt:compile` and `skills:generate` as deprecated, print warnings to stderr, and update documentation to point users to MCP resources and prompts instead. Commands still work — deprecation only, no removal until 0.3.0.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/cli.js
  - repo path: src/lib/prompt-compiler.js
  - repo path: AGENT_GUIDE.md
  - repo path: README.md
  - repo path: docs/ROADMAP.md
  - repo path: test/cli.test.js
  - repo path: test/quick-task.test.js
- Out of scope:
  - repo path: src/lib/mcp-tools.js
  - repo path: dashboard-next/

## Design

- `prompt:compile` prints to stderr: "Deprecated: use MCP resource workflow://tasks/{taskId} or prompt workflow-resume instead. prompt:compile will be removed in 0.3.0."
- `skills:generate` prints to stderr: "Deprecated: MCP tools are self-describing and do not need generated skill files. skills:generate will be removed in 0.3.0."
- Warnings go to stderr, not stdout — critical for MCP stdio transport compatibility
- Commands still function identically after the warning
- AGENT_GUIDE.md: MCP path references `workflow-resume` prompt instead of prompt:compile
- README.md: remove prompt:compile from "Try it in 1 minute" full path, add deprecation note

## Deliverables

- Updated `src/cli.js` with deprecation warnings
- Updated `src/lib/prompt-compiler.js` with deprecation notice
- Updated `AGENT_GUIDE.md`
- Updated `README.md`
- Updated `docs/ROADMAP.md`
- All existing tests pass unchanged

## Acceptance Criteria

- `prompt:compile` prints deprecation warning to stderr and still produces output
- `skills:generate` prints deprecation warning to stderr and still generates files
- Warnings do not appear on stdout (verified by piping stdout)
- Documentation updated to reference MCP resources/prompts
- `npm test` passes; `npm run smoke` passes

## Risks

- Users who depend on prompt:compile in scripts may be surprised by stderr output — deprecation notice should be clear about timeline (0.3.0 removal)
