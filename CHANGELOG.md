# Changelog

This project keeps a lightweight changelog focused on user-visible changes and release-level milestones.

## [Unreleased]

### Docs

- added the workflow hero diagram to `README.md` so new visitors can understand the task -> run -> evidence -> checkpoint loop before reading the command surface
- added a real dashboard overview screenshot to `README.md` so the control plane is visible alongside the product explanation
- rewrote `docs/ARCHITECTURE.md` as a reader-facing system tour instead of a long implementation inventory

## [0.1.2] - 2026-04-10

### Dashboard

- added tab navigation and collapsible panels to the local dashboard so the control plane is easier to scan during day-to-day use

### README

- raised `skills:generate` higher in the homepage narrative so agent-native onboarding is visible earlier
- clarified that generated `AGENTS.md`, `CLAUDE.md`, and Claude slash commands let the workflow become part of the agent's default context

### Release

- published `agent-workflow-studio@0.1.2`
- re-confirmed the npm-first install surface with `npm test`, `npm run validate -- --root .`, `npm run smoke`, and `npm run verify:onboarding`
