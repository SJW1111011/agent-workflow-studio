# T-605 Checkpoint

Generated at: 2026-04-22T12:07:25.433Z

## Completed

- Prompt compiled
- 1 run(s) recorded
- Task context captured
- Scoped verification evidence looks current

## Confirmed facts

- Title: Deprecate prompt:compile and skills:generate
- Priority: P2
- Status: done
- Latest run status: passed
- Total runs: 1

## Verification gate

- Status: covered
- Summary: Recorded verification covers the current scoped file set.
- Evidence coverage: 100% (7/7 scoped files)
- Scope hints: 7
- Ambiguous scope entries: 0
- Scoped files awaiting proof: 0

### Scoped files awaiting proof

- None

### Scoped files already linked to proof

- AGENT_GUIDE.md
- README.md
- docs/ROADMAP.md
- src/cli.js
- src/lib/prompt-compiler.js
- test/cli.test.js
- test/quick-task.test.js

### Explicit evidence items

- manual:verification.md#proof-1 | paths=src/cli.js, src/lib/prompt-compiler.js, AGENT_GUIDE.md, README.md, docs/ROADMAP.md, test/cli.test.js, test/quick-task.test.js | checks=`npm test`; `npm run smoke`; raw stdout/stderr captures confirm both deprecated commands warn on stderr only; `.agent-workflow/tasks/T-605/prompt.codex.md` includes the deprecation notice (result: Passed on 2026-04-22) | artifacts=.agent-workflow/tasks/T-605/runs/t605-prompt-compile.stdout.raw.txt, .agent-workflow/tasks/T-605/runs/t605-prompt-compile.stderr.raw.txt, .agent-workflow/tasks/T-605/runs/t605-prompt-compile.summary.txt, .agent-workflow/tasks/T-605/runs/t605-skills-generate.stdout.raw.txt, .agent-workflow/tasks/T-605/runs/t605-skills-generate.stderr.raw.txt, .agent-workflow/tasks/T-605/runs/t605-skills-generate.summary.txt
- run:run-1776843206071 | paths=src/cli.js, src/lib/prompt-compiler.js, AGENT_GUIDE.md, README.md, docs/ROADMAP.md, test/cli.test.js, test/quick-task.test.js, .agent-workflow/tasks/T-605/context.md, .agent-workflow/tasks/T-605/verification.md | checks=[passed] npm test; [passed] npm run smoke; [passed] prompt:compile warning captured on stderr only; [passed] skills:generate warning captured on stderr only; [passed] prompt.codex.md includes a deprecation notice | artifacts=.agent-workflow/tasks/T-605/runs/t605-prompt-compile.stdout.raw.txt, .agent-workflow/tasks/T-605/runs/t605-prompt-compile.stderr.raw.txt, .agent-workflow/tasks/T-605/runs/t605-prompt-compile.summary.txt, .agent-workflow/tasks/T-605/runs/t605-skills-generate.stdout.raw.txt, .agent-workflow/tasks/T-605/runs/t605-skills-generate.stderr.raw.txt, .agent-workflow/tasks/T-605/runs/t605-skills-generate.summary.txt

### Scope entries that need tightening

- None

## Risks

- No immediate risks detected

## Latest evidence

- Summary: Deprecated prompt:compile and skills:generate in favor of MCP resources and prompts.
- Timestamp: 2026-04-22T07:33:26.070Z

## Resume instructions

1. Read task.md, context.md, and verification.md.
2. Review the latest prompt and decide whether it still reflects scope.
3. Refresh verification.md and checkpoint.md again if scoped files change.
4. Continue only after acknowledging the risks above.
