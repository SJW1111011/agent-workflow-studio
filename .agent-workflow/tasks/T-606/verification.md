# T-606 Verification

## Draft checks

- automated:
  - `npm test`
  - `npm run smoke`
  - `npm run lint`
  - `npm run validate -- --root .`
  - `npm pack --json --cache ./.npm-cache-tmp --pack-destination .agent-workflow/tasks/T-606/runs`
- manual:
  - Review `CHANGELOG.md`, `docs/RELEASE_NOTES_0.2.0.md`, and `docs/ROADMAP.md` to confirm the 0.2.0 summary covers the shipped Phase 4 and Phase 5 work.
  - Confirm the release notes and changelog do not claim npm publication, because publish approval is explicitly out of scope.

## Verification records

### Record 1

- Files: `package.json`, `package-lock.json`, `CHANGELOG.md`, `docs/RELEASE_NOTES_0.2.0.md`, `docs/ROADMAP.md`
- Check: `npm test` (40 files, 194 tests passed, including migration-compatibility coverage for legacy aliases and `manualProofAnchors`); `npm run smoke`; `npm run lint`; `npm run validate -- --root .`; `npm pack --json --cache ./.npm-cache-tmp --pack-destination .agent-workflow/tasks/T-606/runs`; manual review confirmed the release notes and changelog cover Phase 4 and Phase 5 without claiming npm publication
- Result: Passed on 2026-04-22
- Artifact: `.agent-workflow/tasks/T-606/runs/t606-npm-test.log`, `.agent-workflow/tasks/T-606/runs/t606-npm-smoke.log`, `.agent-workflow/tasks/T-606/runs/t606-npm-lint.log`, `.agent-workflow/tasks/T-606/runs/t606-validate-root.log`, `.agent-workflow/tasks/T-606/runs/t606-npm-pack.json`, `.agent-workflow/tasks/T-606/runs/agent-workflow-studio-0.2.0.tgz`

## Blocking gaps

- None.

## Evidence 2026-04-22T12:43:36.595Z

- Agent: manual
- Status: passed
- Scoped files covered: package.json, package-lock.json, CHANGELOG.md, docs/RELEASE_NOTES_0.2.0.md, docs/ROADMAP.md
- Verification artifacts: .agent-workflow/tasks/T-606/runs/t606-npm-test.log, .agent-workflow/tasks/T-606/runs/t606-npm-smoke.log, .agent-workflow/tasks/T-606/runs/t606-npm-lint.log, .agent-workflow/tasks/T-606/runs/t606-validate-root.log, .agent-workflow/tasks/T-606/runs/t606-npm-pack.json, .agent-workflow/tasks/T-606/runs/agent-workflow-studio-0.2.0.tgz
- Proof artifacts: .agent-workflow/tasks/T-606/runs/t606-npm-test.log, .agent-workflow/tasks/T-606/runs/t606-npm-smoke.log, .agent-workflow/tasks/T-606/runs/t606-npm-lint.log, .agent-workflow/tasks/T-606/runs/t606-validate-root.log, .agent-workflow/tasks/T-606/runs/t606-npm-pack.json, .agent-workflow/tasks/T-606/runs/agent-workflow-studio-0.2.0.tgz
- Summary: Prepared the 0.2.0 release package and verified backward compatibility.
- Verification check: [passed] npm test (40 files, 194 tests passed; includes migration-compatibility coverage for legacy aliases and manualProofAnchors)
- Verification check: [passed] npm run smoke
- Verification check: [passed] npm run lint
- Verification check: [passed] npm run validate -- --root .
- Verification check: [passed] npm pack --json produced agent-workflow-studio-0.2.0.tgz
- Verification check: [passed] Manual doc review confirmed the 0.2.0 notes cover Phase 4 and Phase 5 without claiming npm publication
