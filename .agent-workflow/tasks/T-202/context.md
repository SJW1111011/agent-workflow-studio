# T-202 Context

## Why now

T-200 (Lite Mode) and T-201 (`done`) reduce file ceremony, but users still have to manually supply `--proof-path` and `--status` flags. For the "30-second task record" goal, flags must be optional with smart defaults. Git diff and test exit code are the two most reliable signals available in any repo.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `repository-snapshot.js` already has `loadRepositoryDiff()` which runs `git status --porcelain=v2` — but it's heavy (includes fingerprinting, file walking). Need a lightweight variant that only returns changed file paths.
- `evidence-utils.js` normalizes proof paths to repo-relative format — smart defaults can feed directly into this.
- `package.json` has a `test` script in most Node.js projects — `npm test` exit code 0 = passed, non-zero = failed.
- Other ecosystems (Python, Rust, Go) have different test commands — start with npm, add others later as plugin hooks.

## Open questions

- Should auto-inferred test results run `npm test` or just check the *last* exit code? Running tests adds latency. Leaning toward opt-in via `--infer-test` flag.
- Should `inferProofPaths` use staged files only, unstaged only, or both? Leaning toward both (staged + unstaged = full working tree diff).

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-201 (`done` command must exist for smart defaults to plug into)
- Must not slow down `run:add` / `done` when git is available — `git diff --name-only` is fast
- Must gracefully degrade in non-git repos
- No runtime dependencies
