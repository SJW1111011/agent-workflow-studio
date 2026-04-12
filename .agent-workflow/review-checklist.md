# Review Checklist — Claude Code Reviews Codex Deliverables

> Use this checklist every time Codex completes a task.
> Claude Code must pass all applicable sections before refreshing the checkpoint.

## 1. Scope Check

- [ ] All changed files are within the declared task scope
- [ ] No out-of-scope files were modified
- [ ] No unrelated refactoring, cleanup, or "improvements" were added
- [ ] If scope changed during execution, task.md was updated to reflect it

## 2. Code Quality

- [ ] Code compiles / parses without errors
- [ ] No new lint warnings (run ESLint if configured)
- [ ] Naming is clear and consistent with existing codebase conventions
- [ ] No dead code, commented-out blocks, or TODO placeholders left behind
- [ ] No hardcoded secrets, absolute paths, or environment-specific values
- [ ] Error handling is appropriate (not excessive, not missing at boundaries)

## 3. Tests

- [ ] `npm test` passes
- [ ] New code has corresponding test coverage
- [ ] No tests were deleted or weakened to make the suite pass
- [ ] Edge cases relevant to the change are covered

## 4. Evidence Integrity

- [ ] `run:add` was called with accurate `--status` (passed/draft/failed)
- [ ] `--proof-path` entries match actually changed files
- [ ] `--check` descriptions reflect real verification, not boilerplate
- [ ] Evidence is not fabricated (spot-check: do the claimed changes exist in git diff?)
- [ ] If status is `passed`, all planned checks in verification.md are satisfied

## 5. Architecture Alignment

- [ ] Change aligns with the current phase goal (see docs/ROADMAP.md)
- [ ] No violation of the three guiding principles:
  - Subtraction, not addition (did this reduce user friction?)
  - Dogfooding (was the workflow itself used?)
  - Backward compatibility (does existing data still work?)
- [ ] No unnecessary dependencies added
- [ ] Module boundaries respected (no god modules, no circular imports)

## 6. Documentation

- [ ] If public API changed, README or relevant docs updated
- [ ] CHANGELOG.md updated for user-visible changes
- [ ] No auto-generated doc sprawl (don't create docs for internal-only changes)

## 7. Backward Compatibility

- [ ] Existing `.agent-workflow/` data is not corrupted by the change
- [ ] CLI commands that existed before still work with same arguments
- [ ] No breaking changes to npm-published exports without semver major bump

---

## Verdict

- **PASS** → Run `checkpoint <taskId>` to refresh. Move to next task.
- **FAIL** → Create a correction task describing exactly what needs fixing. Assign to Codex.
- **PARTIAL** → Note which items failed. Decide: fix now (small) or create follow-up task (large).

## Notes

_Write review notes here for each specific task review._
