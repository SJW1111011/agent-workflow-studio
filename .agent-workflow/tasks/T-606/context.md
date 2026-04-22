# T-606 Context

## Why now

Phase 4 and Phase 5 work is already implemented, but the package metadata and user-facing release docs still describe `0.1.2`. The repository needs a truthful `0.2.0` release package, compatibility proof, and roadmap update so users can understand what shipped without reconstructing it from task history.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `package.json` and `package-lock.json` still advertise `0.1.2`, even though Phase 4 and Phase 5 features are already present in the repository.
- `README.md` already documents the `0.1.2` compatibility guarantees: legacy run evidence aliases normalize on read, legacy `manualProofAnchors` blocks still parse, and `validate --root .` accepts the older verification vocabulary.
- `docs/ROADMAP.md` still marks Phase 5 as in progress even though T-600 through T-605 are already complete.
- npm publish is explicitly out of scope for this task; the goal is to prepare the release truthfully, not claim it is already live.

## Open questions

- None. The remaining work is documentation, package metadata, and local verification only.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P2
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
