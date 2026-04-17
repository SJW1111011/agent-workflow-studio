# T-501 Context

## Why now

T-500 creates the Vite + Preact scaffold with placeholder tabs. This task fills those tabs with real components. It's the largest task in Phase 4 — converting ~4,500 lines of vanilla JS into Preact components — but the logic is already well-structured in the existing helpers, so it's mostly a translation exercise.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- 11 render-helper modules to convert, totaling ~4,000 lines
- Pure logic (filtering, parsing, formatting) can be extracted to utils/ unchanged
- State currently in global variables: activeTaskId, activeTaskDetail, activeDocumentName, activeExecutorOutcomeFilter, activeTab, executionPollHandle, executionLogState
- Forms use FormData API — Preact controlled inputs are a cleaner pattern
- Document editor is the most complex: markdown section parsing, managed block detection, free-text extraction

## Open questions

- Should we use Preact Router for URL-based routing or keep tab-based? Leaning tab-based for now — URL routing is a follow-up.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Depends on T-500 (scaffold must exist)
- Feature parity with vanilla dashboard — no new features, no removed features
- Must pass `npm run dashboard:build`
