# T-605 Verification

## Draft checks

- automated:
  - `npm test`
  - `npm run smoke`
- manual:
  - Capture stdout/stderr from `node src/cli.js prompt:compile T-605 --root .` and verify the deprecation warning is stderr-only while the command still writes the prompt file.
  - Capture stdout/stderr from `node src/cli.js skills:generate --root <temp-workspace>` and verify the deprecation warning is stderr-only while the command still generates guide files.

## Verification records

### Record 1

- Files: `src/cli.js`, `src/lib/prompt-compiler.js`, `AGENT_GUIDE.md`, `README.md`, `docs/ROADMAP.md`, `test/cli.test.js`, `test/quick-task.test.js`
- Check: `npm test`; `npm run smoke`; raw stdout/stderr captures confirm both deprecated commands warn on stderr only; `.agent-workflow/tasks/T-605/prompt.codex.md` includes the deprecation notice
- Result: Passed on 2026-04-22
- Artifact: `.agent-workflow/tasks/T-605/runs/t605-prompt-compile.stdout.raw.txt`, `.agent-workflow/tasks/T-605/runs/t605-prompt-compile.stderr.raw.txt`, `.agent-workflow/tasks/T-605/runs/t605-prompt-compile.summary.txt`, `.agent-workflow/tasks/T-605/runs/t605-skills-generate.stdout.raw.txt`, `.agent-workflow/tasks/T-605/runs/t605-skills-generate.stderr.raw.txt`, `.agent-workflow/tasks/T-605/runs/t605-skills-generate.summary.txt`

## Blocking gaps

- None.

## Evidence 2026-04-22T07:33:26.070Z

- Agent: manual
- Status: passed
- Scoped files covered: src/cli.js, src/lib/prompt-compiler.js, AGENT_GUIDE.md, README.md, docs/ROADMAP.md, test/cli.test.js, test/quick-task.test.js, .agent-workflow/tasks/T-605/context.md, .agent-workflow/tasks/T-605/verification.md
- Verification artifacts: .agent-workflow/tasks/T-605/runs/t605-prompt-compile.stdout.raw.txt, .agent-workflow/tasks/T-605/runs/t605-prompt-compile.stderr.raw.txt, .agent-workflow/tasks/T-605/runs/t605-prompt-compile.summary.txt, .agent-workflow/tasks/T-605/runs/t605-skills-generate.stdout.raw.txt, .agent-workflow/tasks/T-605/runs/t605-skills-generate.stderr.raw.txt, .agent-workflow/tasks/T-605/runs/t605-skills-generate.summary.txt
- Proof artifacts: .agent-workflow/tasks/T-605/runs/t605-prompt-compile.stdout.raw.txt, .agent-workflow/tasks/T-605/runs/t605-prompt-compile.stderr.raw.txt, .agent-workflow/tasks/T-605/runs/t605-prompt-compile.summary.txt, .agent-workflow/tasks/T-605/runs/t605-skills-generate.stdout.raw.txt, .agent-workflow/tasks/T-605/runs/t605-skills-generate.stderr.raw.txt, .agent-workflow/tasks/T-605/runs/t605-skills-generate.summary.txt
- Summary: Deprecated prompt:compile and skills:generate in favor of MCP resources and prompts.
- Verification check: [passed] npm test
- Verification check: [passed] npm run smoke
- Verification check: [passed] prompt:compile warning captured on stderr only
- Verification check: [passed] skills:generate warning captured on stderr only
- Verification check: [passed] prompt.codex.md includes a deprecation notice
