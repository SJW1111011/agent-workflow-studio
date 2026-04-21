# T-600 Context

## Why now

The current smart-default flow only understands npm test evidence, which leaves Python, Rust, and Go repositories without the same zero-config verification help. Pulling runner detection into a registry keeps the inference contract stable while making the evidence layer extensible enough for built-in multi-language support and repo-specific collectors.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `src/lib/smart-defaults.js` currently parses `package.json` and executes `npm test` directly.
- `src/lib/task-service.js` already consumes `inferTestStatusResult()` and only needs backward-compatible return data.
- `src/lib/workspace.js` is the existing normalization point for repo-level `project.json` settings.
- `src/lib/schema-validator.js` already validates `project.json` booleans, so custom collector shape validation belongs there.
- The shipped implementation keeps custom collectors after the built-in collectors so npm-first behavior stays stable in mixed-language workspaces.
- The task prompt requires workflow docs, verification evidence, and `checkpoint.md` to stay current during implementation.

## Open questions

- None at handoff; custom collectors currently default after built-ins to preserve existing behavior.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
