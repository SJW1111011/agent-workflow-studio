# Release Notes - 0.2.0

Prepared: 2026-04-22

`0.2.0` closes Phase 4 and Phase 5 in one release line. It makes the modern dashboard feel like a real control plane, gives agents an MCP-native handoff surface, and turns evidence collection into something the workflow can do automatically across more than one test runner, all without breaking existing `0.1.2` workflow data.

## Highlights

### 1. Evidence collection is broader and more automatic

The workflow can now gather richer proof with less manual glue:

- built-in evidence collectors detect and run `npm test`, `python -m pytest --tb=no -q`, `cargo test --no-fail-fast`, and `go test ./...`
- `done`, `run:add`, and MCP completion flows can store structured multi-collector results instead of a single inferred test outcome
- MCP sessions can record agent activity evidence such as touched files, commands run, and tool-call context alongside ordinary run proof

Why it matters: evidence is now closer to the real work the agent performed, and the workflow no longer assumes every repository is a Node-only `npm test` project.

### 2. MCP is now the preferred handoff surface

This release makes agents first-class workflow readers, not just command runners:

- read-only MCP resources expose workflow overview, task detail, and memory documents directly
- MCP prompt packages now include `workflow-resume`, `workflow-verify`, and `workflow-handoff`
- `prompt:compile` is now deprecated in favor of MCP resources and prompts

Why it matters: agents can pull complete, structured context without relying on generated prompt files or fighting prompt truncation.

### 3. The dashboard now shows trust, not just raw task data

Phase 4 and Phase 5 together substantially raised the quality of the local control plane:

- the modern dashboard now runs on the Vite + Preact shell with SSE execution updates
- users get responsive light, dark, and system theming plus kanban and timeline task views
- trust score, freshness heatmap, and evidence timeline surfaces make evidence quality visible at a glance

Why it matters: the dashboard is becoming a supervision surface, not just a file browser for task metadata.

## Migration Notes

- No data migration is required from `0.1.2`.
- Existing `.agent-workflow/` data continues to load in the CLI, MCP surface, and dashboard.
- Older run records that still use legacy evidence aliases are normalized on read.
- Older `verification.md` managed anchor blocks that still use the `manualProofAnchors` payload are still parsed and preserved when strict verification is off.
- `prompt:compile` and `skills:generate` still exist as deprecated transition paths, but new integrations should prefer MCP resources and prompts.

## Breaking Changes

None. `0.2.0` is intended to be backward compatible with existing `0.1.2` workflow data.

## Release Validation

The release-preparation pass for `0.2.0` verified:

- `npm test`
- `npm run smoke`
- `npm run lint`
- `npm run validate -- --root .`
- `npm pack --json --cache ./.npm-cache-tmp --pack-destination .agent-workflow/tasks/T-606/runs`

This task prepares the `0.2.0` package line and release notes in the repository. npm publication remains a separate, explicit approval step.

## Related docs

- [`../CHANGELOG.md`](../CHANGELOG.md)
- [`ROADMAP.md`](ROADMAP.md)
- [`PUBLISHING.md`](PUBLISHING.md)
