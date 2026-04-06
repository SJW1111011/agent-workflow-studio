# Verification Freshness Design

This note describes how `agent-workflow-studio` should evolve verification freshness from a mostly `mtime`-driven heuristic into a Git-aware repository snapshot model without breaking the current proof contract.

## Status

As of 2026-04-06:

- Phase 1 is implemented through `src/lib/repository-snapshot.js`
- overview and task detail now reuse a normalized repository snapshot
- Git mode prefers `git status --porcelain=v2`, with filesystem fallback preserved
- Phase 2 proof anchors are still pending

## Why this exists

The current verification gate already gets the most important product decision right:

- proof is tied to repo-relative scope
- proof can be weak or strong
- planned checks are intent, not evidence
- overview, task detail, and checkpoint all explain the same gate

What is still weak is freshness detection.

Today the gate mostly asks:

- which workspace files match the task scope?
- were those files modified after the latest proof timestamp?

That works for a first local-only pass, but `mtime` is not a trustworthy repository signal:

- `git checkout` can change `mtime` without changing content
- `git stash pop` can rehydrate files with fresh timestamps
- archive extraction or editor tools can rewrite timestamps
- overview/task detail can end up re-walking the workspace repeatedly

The next step should strengthen repository truth without replacing the current proof model.

## Current contract that must stay true

Any redesign should preserve these invariants:

1. Tasks still declare repo-relative scope through `task.json.scope` and `task.md`.
2. Verification gate statuses stay explainable:
   - `ready`
   - `scope-missing`
   - `needs-proof`
   - `partially-covered`
   - `covered`
3. Proof strength still depends on proof content, not just execution timestamps:
   - planned checks are not proof
   - path-only proof is weak
   - path + check or artifact is strong
4. The system stays local-first and Git-native:
   - no cloud state
   - no hidden remote service
   - no absolute paths
5. Existing run records and `verification.md` remain readable and valid.

This is not a license to rewrite verification around Git internals alone. The proof contract stays primary; Git only improves freshness and change detection.

## Design summary

Introduce a new internal boundary:

- `RepositorySnapshot`

The verification gate should depend on a repository snapshot abstraction instead of directly depending on filesystem traversal plus `mtime`.

### Proposed shape

```js
{
  mode: "git" | "filesystem",
  available: true,
  collectedAt: "2026-04-06T12:00:00.000Z",
  headCommit: "abc123" | null,
  files: [
    {
      path: "src/server.js",
      changeType: "modified" | "added" | "deleted" | "renamed" | "untracked",
      gitState: "M" | "A" | "D" | "R" | "??" | null,
      previousPath: "src/old.js" | null,
      contentFingerprint: "sha1:..." | null,
      exists: true,
      modifiedAt: "...",
      modifiedAtMs: 0
    }
  ]
}
```

Notes:

- `mode: "git"` is preferred when the target repo has Git available.
- `mode: "filesystem"` is a compatibility fallback for non-Git directories or constrained environments.
- `contentFingerprint` is an internal comparison token, not a user-facing trust claim by itself.

## Key idea: split the migration into two phases

The project should not jump straight from `mtime` to a full content-hash rewrite. That would risk breaking the current contract.

### Phase 1: Git-aware current diff, legacy proof freshness

Replace `walkWorkspaceFiles()` as the source of "what is currently changed" with a Git-backed snapshot when possible.

Behavior:

- current scoped changes come from Git dirty state, not from every file in the workspace
- proof strength still uses the existing proof item model
- proof freshness can temporarily continue to fall back to recorded time for legacy/manual proof

What this fixes immediately:

- avoids many `mtime` false positives
- avoids repeated full workspace walks for dirty-file discovery
- makes rename/delete/untracked state explicit in the gate

What it does not fully solve yet:

- "did this exact file content change after proof?" is still time-based for legacy evidence

This is acceptable as an intermediate step because it improves correctness and performance without changing durable schema.

### Phase 2: proof anchors for content-aware freshness

Add optional snapshot anchors to newly recorded proof so freshness can be compared by repository identity instead of by timestamp.

For passed runs, the most natural extension is optional metadata such as:

```js
{
  scopeProofPaths: ["src/server.js"],
  scopeProofAnchors: [
    {
      path: "src/server.js",
      contentFingerprint: "sha1:...",
      gitState: "M"
    }
  ]
}
```

The gate can then say:

- if current scoped file fingerprint still matches the anchored proof fingerprint, the proof remains fresh
- if it differs, the file needs fresh proof even if timestamps are misleading

For legacy runs and freeform manual proof in `verification.md`:

- keep the existing time-based fallback
- clearly label it as a compatibility path, not the long-term ideal

This preserves backward compatibility while letting new evidence become stronger.

#### Minimal durable schema

The smallest additive run-record extension should stay path-centric and repo-relative:

```js
{
  scopeProofPaths: ["src/server.js"],
  scopeProofAnchors: [
    {
      path: "src/server.js",
      gitState: "M",
      previousPath: null,
      exists: true,
      contentFingerprint: "sha1:..."
    }
  ]
}
```

Rules:

- `scopeProofAnchors` is optional
- it should only be written for newly recorded passed runs
- each anchor `path` must stay repo-relative, just like `scopeProofPaths`
- no absolute paths, raw diffs, or machine-local temp paths should be persisted
- the anchor list should be limited to the normalized proof paths for that run, not every changed file in the repository

The field is intentionally narrow:

- `path` keeps the proof contract explainable
- `gitState` and `previousPath` preserve rename/delete context when Git knows it
- `exists` makes delete coverage explicit
- `contentFingerprint` is the durable comparison token

#### Capture rules

Phase 2 should capture anchors at run-persist time, after `scopeProofPaths` has already been normalized.

Suggested behavior:

1. Build or reuse the current repository snapshot.
2. For each normalized proof path, try to find the matching snapshot entry.
3. Persist an anchor only for the paths that can be described safely.
4. If snapshot capture fails, still persist the run without anchors instead of failing the run record itself.

That keeps the feature additive. Proof-anchor capture should strengthen evidence, not become a new write-time failure mode.

#### Filesystem fallback strategy

Git mode can usually provide both dirty-state metadata and current fingerprints.

Filesystem fallback needs a narrower strategy so Phase 2 does not regress performance:

- do not hash the whole workspace just to capture anchors
- if Git is unavailable, compute targeted fingerprints only for the normalized proof paths being recorded
- for deleted or missing files, persist `exists: false` and leave `contentFingerprint: null`

This keeps fallback local-only and relocatable without reintroducing O(workspace files) cost.

#### Matching rules inside the gate

The gate should continue to start from strong proof items, then prefer anchors when present:

1. Find strong proof items that mention the current scoped file path.
2. If a proof item has a matching anchor, use anchor comparison as the freshness decision.
3. If a proof item has no anchor, fall back to the existing time-based compatibility path.

An anchor should count as matching when:

- `path` matches the current scoped file path
- `gitState` matches when both sides have one
- `previousPath` matches for rename coverage when present
- `exists` matches when present
- `contentFingerprint` matches when both sides have one

If an anchored proof item disagrees with the current snapshot, treat that file as needing fresh proof even when timestamps would have looked acceptable.

#### Scope of Phase 2

Phase 2 should extend passed run evidence only.

It should not yet:

- invent a second durable proof store
- require anchors for manual `verification.md` proof blocks
- block legacy run records from participating in the gate
- replace proof strength rules with Git metadata alone

Manual `verification.md` can keep the current compatibility path until there is a separate managed-anchor design for human-authored proof.

## Why not just use `git status --porcelain` everywhere

`git status --porcelain` is necessary, but not sufficient.

It answers:

- what is dirty now?
- what kind of Git state does each path have?

It does not fully answer:

- was this file changed after a particular proof item was recorded?

That second question requires a durable comparison anchor. That is why the migration needs both:

- a better current repository snapshot
- optional proof anchors for newer evidence

## Proposed internal API changes

These are internal refactors first, not breaking user-facing commands.

### Replace `loadRepositoryDiff(...)`

Current:

- `loadRepositoryDiff(workspaceRoot)`

Proposed:

- `loadRepositorySnapshot(workspaceRoot, options = {})`

Responsibilities:

- detect whether Git is available
- collect a Git-backed snapshot when possible
- fall back to filesystem mode when necessary
- normalize fields so the verification gate does not care where the snapshot came from

### Update verification gate inputs

Current:

- `buildTaskVerificationGate(workspaceRoot, taskMeta, runs, repositoryDiff, taskText)`

Proposed:

- `buildTaskVerificationGate(workspaceRoot, taskMeta, runs, repositorySnapshot, taskText)`

The gate should operate on normalized repository entries:

- path
- change type
- previous path when renamed
- fingerprint when available
- timestamp only as fallback

### Reuse one snapshot per request

Within one overview or task-detail request:

- load one repository snapshot
- pass it through to all task enrichment and verification calls

This preserves current explainability while avoiding repeated repository scans.

## Gate behavior under the new model

The user-facing statuses should remain the same, but their inputs become more trustworthy.

### `scope-missing`

Unchanged in meaning:

- active task state exists
- no repo-relative scope hints are good enough to match current repository changes

### `needs-proof`

Now means:

- scoped changed files exist in the current repository snapshot
- none of them are fresh-covered by strong proof

### `partially-covered`

Now means:

- some scoped changed files are fresh-covered
- at least one scoped changed file still lacks fresh strong proof

### `covered`

Now means:

- scoped changed files are either absent
- or every scoped changed file is covered by strong proof whose anchor still matches

### `ready`

Still means:

- there is no current scoped change requiring fresh proof

## Compatibility rules

The migration should be explicitly backward compatible.

### Existing runs

Existing run records without proof anchors:

- stay valid
- still contribute proof items
- use time-based freshness fallback

### Existing `verification.md`

Freeform proof blocks remain valid:

- path parsing still works
- weak/strong grading still works
- freshness stays time-based unless a later managed anchor strategy is added

### Non-Git repositories

If the target repository is not a Git repo:

- continue using filesystem snapshot mode
- keep the current heuristic behavior
- expose in the gate summary or repository summary that the snapshot is in fallback mode

This keeps relocatability and local-first behavior intact.

## Performance expectations

This design should also reduce repeated expensive work.

Expected improvements:

- one snapshot per overview request instead of repeated workspace walks
- one snapshot per task-detail request
- Git can report dirty files directly instead of requiring every file to be enumerated for current-diff detection

Even after Phase 1, the gate may still read a few files for proof parsing, but repository-scale change detection should no longer be O(tasks x workspace files).

## Testing plan

Before implementation, add or extend tests around these cases:

1. Git snapshot parsing
   - modified
   - added
   - deleted
   - renamed
   - untracked
2. Gate transitions under normalized repository entries
   - `needs-proof`
   - `partially-covered`
   - `covered`
   - `scope-missing`
3. Backward compatibility
   - legacy run without anchors
   - new run with anchors
   - manual `verification.md` proof only
   - non-Git workspace fallback
   - anchor capture failure still records the run
4. Performance-sensitive reuse
   - overview reuses one snapshot across all tasks
   - task detail does not perform duplicate snapshot collection
5. Anchor matching behavior
   - unchanged fingerprint stays covered
   - changed fingerprint reopens `needs-proof`
   - rename anchors match renamed scoped files
   - deleted anchors match deleted scoped files

## Recommended implementation order

1. Introduce `loadRepositorySnapshot(...)` with Git mode plus filesystem fallback.
2. Refactor `buildTaskVerificationGate(...)` to consume normalized snapshot entries.
3. Reuse one snapshot in overview/task-detail paths.
4. Keep legacy time-based freshness as fallback.
5. Add optional `scopeProofAnchors` for newly recorded passed runs.
6. Teach the gate to prefer anchor comparison when those anchors exist.
7. Later decide whether manual `verification.md` needs a managed anchor strategy.

## Non-goals

- full semantic diffing
- cloud-backed verification history
- replacing human judgment with a single verification score
- making Git metadata the proof model itself

Git should strengthen freshness, not replace proof.
