# Recipes and Schema

This project now has two reinforcing layers:

- a recipe registry that standardizes task intent
- a schema validator that checks whether the workflow state still looks trustworthy

## Recipe registry

Recipes are indexed in:

```text
.agent-workflow/recipes/index.json
```

Each recipe declares:

- `id`
- `name`
- `fileName`
- `summary`
- `recommendedFor`

The markdown file remains the human-readable guide, but the index lets the CLI and dashboard work with recipes as structured data.

## Task-level recipe usage

Tasks can now be created with:

```bash
npm run task:new -- T-001 "Review auth flow" --recipe review --root ../repo
```

That recipe is then carried into:

- `task.json`
- prompt compilation
- task detail API
- dashboard task detail view

## Schema validation

Validation currently checks:

- `project.json`
- recipe index entries
- adapter configs
- `task.json`
- recorded runs

The local dashboard also uses these structures to power:

- task creation
- task metadata updates
- task markdown editing for `task.md`, `context.md`, and `verification.md`
- run evidence recording

It does not try to prove business correctness yet. It proves something narrower but still useful:

- the workflow state is present
- the structure is coherent
- critical references do not silently drift

## CLI usage

```bash
npm run validate -- --root ../repo
```

The command prints a summary and any issues found.

## Why this matters

Without schema checks, workflow documents can decay quietly.

Without recipes, tasks are harder to classify, compare, and automate.

Together they push the project toward a stronger open standard instead of a pile of prompts and markdown files.
