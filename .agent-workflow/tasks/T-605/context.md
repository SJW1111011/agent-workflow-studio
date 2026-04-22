# T-605 Context

## Why now

Phase 5 already introduced MCP resources and prompts as the preferred handoff path, so leaving `prompt:compile` and `skills:generate` positioned as first-class guidance keeps steering users toward legacy flows. Deprecating them now preserves backward compatibility for existing scripts while shifting new usage toward MCP before the planned 0.3.0 removal.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- The implementation scope is limited to deprecation warnings in `src/cli.js`, a notice in `src/lib/prompt-compiler.js`, and doc updates in `AGENT_GUIDE.md`, `README.md`, and `docs/ROADMAP.md`.
- The warning text must go to stderr only so CLI output remains safe for stdio-based MCP transport.
- Both commands stay functional in 0.2.x; this task is deprecation-only and must not remove the legacy paths yet.

## Open questions

- Secondary docs outside the declared scope still mention the legacy commands and may need a follow-up cleanup task.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P2
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
