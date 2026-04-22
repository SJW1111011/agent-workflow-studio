# T-606 - Version Bump to 0.2.0

## Goal

Release version 0.2.0 with all Phase 4 and Phase 5 changes. Write changelog, release notes, verify backward compatibility with 0.1.2 data, and update roadmap.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: package.json
  - repo path: package-lock.json
  - repo path: CHANGELOG.md
  - repo path: docs/RELEASE_NOTES_0.2.0.md
  - repo path: docs/ROADMAP.md
- Out of scope:
  - repo path: src/
  - repo path: dashboard-next/

Release-specific work inside that scope: bump version metadata, publish the 0.2.0 release summary, and mark Phase 5 complete. No source or dashboard implementation changes are part of this task.

## Design

### CHANGELOG.md

Add a 0.2.0 section covering:
- Phase 4: dashboard rebuild (Preact + Vite, SSE, dark mode, kanban/timeline)
- Phase 5: evidence collectors (npm/pytest/cargo/go), MCP resources and prompts, multi-collector integration, agent activity evidence, dashboard trust surface, and deprecations

### Release Notes

User-facing summary:
- What's new (evidence collectors, MCP resources/prompts, trust score, dark mode, kanban)
- Migration notes (`prompt:compile` deprecated, `skills:generate` deprecated)
- Breaking changes (none - fully backward compatible)

### Backward Compatibility Verification

- Existing `.agent-workflow/` data from 0.1.2 loads correctly
- Old run records with legacy evidence aliases still parse
- Old `verification.md` blocks with `manualProofAnchors` still work
- `validate --root .` passes on 0.1.2 data

## Deliverables

- Updated `package.json` and `package-lock.json` with version 0.2.0
- Updated `CHANGELOG.md` with a 0.2.0 section
- New `docs/RELEASE_NOTES_0.2.0.md`
- Updated `docs/ROADMAP.md` marking Phase 5 complete
- `npm test`, `npm run smoke`, `npm run lint`, and `npm run validate -- --root .` all pass
- `npm pack` produces a valid tarball

## Acceptance Criteria

- `package.json` version is `0.2.0`
- `package-lock.json` version metadata matches `0.2.0`
- CHANGELOG covers all shipped Phase 4 and Phase 5 changes
- Release notes are user-facing and include migration guidance
- Backward compatibility is verified with existing 0.1.2 workflow data
- All required local checks pass
- `npm pack` succeeds

## Risks

- Must not publish to npm without explicit user approval - this task only prepares the release, does not publish
