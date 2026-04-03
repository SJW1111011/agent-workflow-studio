# Agent Workflow Studio

Agent Workflow Studio is a local-first workflow OS and project control plane for Codex and Claude Code.

The product thesis is simple:

- tasks should compile into strong prompts
- runs should leave evidence
- evidence should refresh docs and checkpoints
- long jobs should survive context compaction and agent handoff

This repository starts with a relocatable foundation:

- a headless workflow scaffold in `.agent-workflow/`
- a zero-dependency CLI to initialize, scan, create tasks, compile prompts, and record runs
- a lightweight dashboard that reads the workflow state from any repository root
- a smoke test that proves the project still works when nested under a non-English path

## Why this exists

Most teams using coding agents still lack:

- stable project memory
- structured task context
- trustworthy verification state
- resumable checkpoints
- a shared control plane across Codex and Claude Code

Agent Workflow Studio is designed to become that missing layer.

## Current MVP

The current foundation includes:

- `init`: create `.agent-workflow/` with memory docs, recipes, decisions, handoffs, and task folders
- `scan`: generate a project profile from the target repository
- `adapter:list`: inspect the built-in Codex and Claude Code adapter contracts
- `recipe:list`: inspect the built-in workflow recipes
- `task:new`: create a structured task package with both machine-readable and human-readable context
- `prompt:compile`: generate Codex or Claude Code prompts from workflow state
- `run:prepare`: generate an execution handoff pack for a specific adapter
- `run:add`: append execution evidence to a task
- `checkpoint`: build a resumable checkpoint for the current task
- `validate`: run schema checks on project, adapters, tasks, and recorded runs
- `dashboard`: open a local control plane for tasks, memory freshness, risks, verification gaps, metadata edits, run evidence, and markdown task doc edits

## Layout

```text
agent-workflow-studio/
  docs/
  dashboard/
  scripts/
  src/
```

Once initialized against a target repository, that repository receives:

```text
.agent-workflow/
  project.json
  project-profile.json
  project-profile.md
  memory/
  recipes/
  decisions/
  handoffs/
  tasks/
```

## Quick start

Run everything from this project root:

```bash
npm run init -- --root ../some-repo
npm run scan -- --root ../some-repo
npm run adapter:list
npm run recipe:list -- --root ../some-repo
npm run task:new -- T-001 "Build the scanner" --priority P1 --recipe feature --root ../some-repo
npm run prompt:compile -- T-001 --agent codex --root ../some-repo
npm run run:prepare -- T-001 --agent codex --root ../some-repo
npm run run:add -- T-001 "Initial scanner pass completed." --status passed --root ../some-repo
npm run checkpoint -- T-001 --root ../some-repo
npm run validate -- --root ../some-repo
npm run dashboard -- --root ../some-repo --port 4173
```

Then open `http://localhost:4173`.

## Relocatable by design

This project is intentionally safe to move to another directory later.

- No absolute paths are written into generated workflow files.
- The CLI and dashboard resolve the target repository from `--root` or the current working directory.
- The dashboard reads data from the target repository at runtime instead of baking the source path into the build.
- The smoke test runs from the current nested path to catch path-resolution regressions early.

See `docs/RELOCATABLE_DESIGN.md` for details.

## Adapter layer

The first adapter pass does not hard-wire a specific vendor launch flow into the core.

Instead it provides:

- stable adapter contracts under `.agent-workflow/adapters/`
- agent-specific prompt targets
- execution handoff packs such as `run-request.codex.json` and `launch.codex.md`
- a place to customize local runner commands after you confirm your environment

See `docs/ADAPTERS.md`.

## Recipe registry and schema checks

The workflow layer now treats recipes as first-class metadata instead of loose markdown only.

- Recipes are indexed in `.agent-workflow/recipes/index.json`
- Tasks can declare a `recipeId`
- Validation checks look for missing or malformed project, task, adapter, and run records
- The dashboard surfaces both repository-wide and task-level schema issues
- The dashboard can create tasks, update selected task metadata, edit `task.md` / `context.md` / `verification.md`, and record run evidence through local-only API endpoints

See `docs/RECIPES_AND_SCHEMA.md`.

## Suggested next build steps

1. Add executable runner adapters on top of the current handoff contracts.
2. Add richer freshness detection, diff-aware verification gates, and checkpoint refresh rules.
3. Add repository-aware recipe customization and stronger task editing guardrails.
4. Add GitHub issue and PR linking.
5. Add multi-agent run orchestration and resume bundles.

## Contributing

If you want to help shape this into a serious open source workflow layer, start here:

- read `CONTRIBUTING.md`
- keep changes local-first, relocatable, and schema-aware
- run `npm run smoke` before opening a PR

## Community

- `CODE_OF_CONDUCT.md` defines how we collaborate
- issues and PRs should stay focused on strong prompts, evidence quality, checkpoints, and agent handoff durability

## License

Released under the MIT License. See `LICENSE`.

