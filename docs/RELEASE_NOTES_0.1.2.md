# Release Notes - 0.1.2

Released: 2026-04-10

`0.1.2` is a small but meaningful release focused on day-to-day usability. It makes the dashboard easier to scan, makes agent-native onboarding more visible, and keeps the published install surface verified.

## Highlights

### 1. Agent skills are now a first-class onboarding path

This release brings the workflow closer to the agents themselves:

- `skills:generate` is part of the CLI surface
- `AGENT_GUIDE.md` ships as the shared workflow guide
- generated `AGENTS.md` and `CLAUDE.md` teach Codex and Claude Code the same task/evidence/checkpoint loop
- generated Claude slash commands provide ready-to-use entrypoints for workflow initialization, task creation, completion, and status checks

Why it matters: the workflow no longer depends on a human remembering every step. The agent can load the protocol directly from the repo.

### 2. The dashboard is easier to navigate

The local control plane now has clearer navigation and better panel ergonomics:

- tab navigation across the main dashboard sections
- collapsible panels for denser information without overwhelming the first view

Why it matters: the dashboard is meant to be the place where tasks, risks, runs, and verification state can be checked quickly during real work, not just a demo surface.

### 3. The project homepage is clearer about what it offers

The release also improves the public-facing product story:

- the README is more visitor-oriented
- agent skills are surfaced earlier in the page
- the workflow is framed more clearly around evidence, resumable checkpoints, and local control

Why it matters: this reduces the gap between "interesting internal tool" and "something a new user can understand quickly."

## Validation

Before and during the release flow, the package surface was re-verified with:

- `npm test`
- `npm run validate -- --root .`
- `npm run smoke`
- `npm run verify:onboarding`

The package is published on npm as `agent-workflow-studio@0.1.2`.

## Upgrade note

If you are already using the package, this release does not change the core local-first file model. Existing `.agent-workflow/` state continues to work; the main gains are onboarding clarity and a better dashboard experience.

## Related docs

- [`../CHANGELOG.md`](../CHANGELOG.md)
- [`GETTING_STARTED.md`](GETTING_STARTED.md)
- [`ARCHITECTURE.md`](ARCHITECTURE.md)
- [`PUBLISHING.md`](PUBLISHING.md)
