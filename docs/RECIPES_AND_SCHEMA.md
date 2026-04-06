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
- run evidence recording, including structured proof paths/checks/artifacts
- diff-aware verification gates driven by task scope hints

Task doc editing now keeps a few metadata-managed markdown blocks stable on save:

- `task.md` heading and recipe block
- `context.md` heading, recipe guidance block, and priority/workflow reminder lines

That guardrail is intentionally narrow:

- custom nearby notes still remain editable
- the workflow contract can refresh managed facts after task metadata changes
- the editor does not try to lock down the whole document schema
- the dashboard now shows these managed vs free-edit areas directly in the editor UI

It does not try to prove business correctness yet. It proves something narrower but still useful:

- the workflow state is present
- the structure is coherent
- critical references do not silently drift

## Scope hints and verification gates

The current diff-aware verification pass stays contract-first and local-only.

It looks for repo-relative scope hints in:

- `task.json.scope`
- `task.md` under `## Scope`

It also understands a few lightweight scope markers inside `task.md`, for example:

- `path: src/server.js`
- `files: README.md, docs/ARCHITECTURE.md`
- `dirs: src/lib/`

Those hints are matched against a normalized repository snapshot:

- Git mode prefers `git status --porcelain=v2` so modified, added, deleted, renamed, untracked, and unmerged paths are explicit
- filesystem mode remains as a compatibility fallback for non-Git or constrained environments
- legacy/manual proof freshness still falls back to recorded time in this phase

When scoped files are changed, the dashboard can now say whether:

- no current scoped diff needs proof
- scoped changes need explicit proof
- proof only partially covers the current scoped diff
- the latest run or `verification.md` update already covers the current scoped diff

`checkpoint.md` now also reflects:

- the current verification gate status
- which scoped files still need proof
- whether any scope entries are too ambiguous to enforce automatically

This is intentionally heuristic:

- it does not replace CI or human review
- it works best when tasks declare clear repo-relative paths
- it works best when `verification.md` or passed run evidence mentions the exact repo-relative paths being checked
- overview and task detail reuse one repository snapshot per request so verification does not scale as tasks x workspace files
- it is designed to stay explainable rather than opaque

## Explicit proof linkage

The current pass is stricter than a pure timestamp heuristic.

It now expects changed scoped files to be linked through explicit repo-relative paths:

- in manual `verification.md` notes
- or in passed run evidence via `scopeProofPaths`

Those proof links are now treated as proof items that carry:

- repo-relative paths
- check text
- artifact references when available
- optional result/status text when a proof block records it

This keeps the model honest:

- updating `verification.md` without naming the changed scoped files does not automatically satisfy the gate
- recording a passed run can snapshot the current scoped files into evidence so the checkpoint and dashboard can explain why the gate moved to covered
- passed runs can now also persist structured `verificationChecks`, `verificationArtifacts`, and optional `scopeProofAnchors` so proof is tied to concrete results, task-local evidence refs, and stronger freshness comparisons
- weak proof items that mention files but omit clear checks/artifacts can be surfaced for cleanup instead of silently counting as strong proof
- the dashboard can now prefill proof paths from the current pending scoped file set, so local proof capture lines up with the gate more easily
- the dashboard can now also draft one verification check per pending scoped file, which helps proof capture start from the actual gate state
- the verification editor can now draft a pending proof plan from the same scoped file set by inserting planned checks plus file-only Proof links placeholders; those drafts still need real result/artifact content before they should count as strong proof
- the run form can now sync its drafted proof paths/checks into the verification editor, so users can move from run evidence drafting into markdown proof planning without an extra copy/paste pass
- when anchors are present on a passed run, the gate now prefers anchor comparison over timestamp heuristics for that scoped file

## CLI usage

```bash
npm run validate -- --root ../repo
```

The command prints a summary and any issues found.

Structured proof can also be attached directly to a passed run:

```bash
npm run run:add -- T-001 "Scoped proof recorded." --status passed --proof-path src/server.js --check "Reviewed src/server.js diff" --artifact .agent-workflow/tasks/T-001/checkpoint.md --root ../repo
```

## Why this matters

Without schema checks, workflow documents can decay quietly.

Without recipes, tasks are harder to classify, compare, and automate.

Together they push the project toward a stronger open standard instead of a pile of prompts and markdown files.
