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
  - repo path: package.json (version bump to 0.2.0)
  - repo path: CHANGELOG.md (add 0.2.0 section)
  - repo path: docs/RELEASE_NOTES_0.2.0.md (new — user-facing release summary)
  - repo path: docs/ROADMAP.md (mark Phase 5 complete)
- Out of scope:
  - repo path: src/ (no code changes — this is release packaging only)
  - repo path: dashboard-next/ (no code changes)

## Design

### CHANGELOG.md

Add 0.2.0 section covering:
- Phase 4: Dashboard rebuild (Preact+Vite, SSE, dark mode, kanban/timeline)
- Phase 5: Evidence collectors (npm/pytest/cargo/go), MCP resources and prompts, multi-collector integration, agent activity evidence, dashboard trust surface, deprecations

### Release Notes

User-facing summary:
- What's new (evidence collectors, MCP resources/prompts, trust score, dark mode, kanban)
- Migration notes (prompt:compile deprecated, skills:generate deprecated)
- Breaking changes (none — fully backward compatible)

### Backward Compatibility Verification

- Existing .agent-workflow/ data from 0.1.2 loads correctly
- Old run records with legacy evidence aliases still parse
- Old verification.md with manualProofAnchors still works
- `validate --root .` passes on 0.1.2 data

## Deliverables

- Updated `package.json` with version 0.2.0
- Updated `CHANGELOG.md` with 0.2.0 section
- New `docs/RELEASE_NOTES_0.2.0.md`
- Updated `docs/ROADMAP.md` marking Phase 5 complete
- `npm test`, `npm run smoke`, `npm run lint` all pass
- `npm pack` produces valid tarball

## Acceptance Criteria

- `package.json` version is "0.2.0"
- CHANGELOG covers all Phase 4 and Phase 5 changes
- Release notes are user-facing and include migration guidance
- Backward compatibility verified with existing .agent-workflow/ data
- All tests pass
- `npm pack` succeeds

## Risks

- Must not publish to npm without explicit user approval — this task only prepares the release, does not publish
