# Changelog

This project keeps a lightweight changelog focused on user-visible changes and release-level milestones.

## [Unreleased]

### Docs

- added the workflow hero diagram to `README.md` so new visitors can understand the task -> run -> evidence -> checkpoint loop before reading the command surface
- added a real dashboard overview screenshot to `README.md` so the control plane is visible alongside the product explanation
- rewrote `docs/ARCHITECTURE.md` as a reader-facing system tour instead of a long implementation inventory

## [0.2.0] - 2026-04-22

See [`docs/RELEASE_NOTES_0.2.0.md`](docs/RELEASE_NOTES_0.2.0.md) for the longer release summary.

### Dashboard

- rebuilt the modern dashboard with the Vite + Preact shell, SSE execution updates, responsive light/dark/system theming, and kanban plus timeline task views
- added trust score, freshness heatmap, and evidence timeline surfaces so verification quality is visible in the control plane instead of buried in task files

### Evidence

- added pluggable evidence collectors with built-in npm, pytest, cargo, and go runners
- wired multi-collector inference into `done`, `run:add`, and the MCP completion flow so matching test runners can contribute structured evidence automatically
- added agent activity evidence so MCP sessions can record files touched, commands run, and tool-call context alongside normal run proofs

### MCP

- added read-only MCP resources for workflow overview, task detail, and memory documents
- added MCP prompt packages such as `workflow-resume`, `workflow-verify`, and `workflow-handoff` for agent-native handoff without prompt-file truncation
- repositioned MCP resources and prompts as the preferred replacement for `prompt:compile`

### Compatibility

- kept `0.1.2` workflow data compatible by normalizing legacy run evidence aliases on read, preserving `manualProofAnchors` verification blocks when strict mode is off, and keeping `validate --root .` backward compatible

### Deprecations

- deprecated `prompt:compile` ahead of its planned `0.3.0` removal while keeping the command available as a transition path
- revived `skills:generate` with MCP-first workflow rules and two-system framing (project tasks vs execution steps) in generated CLAUDE.md/AGENTS.md

## [0.1.2] - 2026-04-10

See [`docs/RELEASE_NOTES_0.1.2.md`](docs/RELEASE_NOTES_0.1.2.md) for the longer release summary.

### Dashboard

- added tab navigation and collapsible panels to the local dashboard so the control plane is easier to scan during day-to-day use

### README

- raised `skills:generate` higher in the homepage narrative so agent-native onboarding is visible earlier
- clarified that generated `AGENTS.md`, `CLAUDE.md`, and Claude slash commands let the workflow become part of the agent's default context

### Release

- published `agent-workflow-studio@0.1.2`
- re-confirmed the npm-first install surface with `npm test`, `npm run validate -- --root .`, `npm run smoke`, and `npm run verify:onboarding`
