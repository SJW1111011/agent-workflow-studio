# T-002 Verification

## Planned checks

- automated: npm test
- automated: npm run smoke
- automated: npm run validate -- --root .
- automated: npm run run:execute -- T-002 --agent codex --root .
- manual: Review the persisted run record, stdout/stderr logs, and checkpoint for T-002 to confirm the real local execution path left durable evidence without broadening defaults.

## Proof links

### Proof 1

- Files: .agent-workflow/adapters/codex.json, .agent-workflow/tasks/T-002/task.md, .agent-workflow/tasks/T-002/context.md, .agent-workflow/tasks/T-002/verification.md
- Check: Scoped the repo-local dogfooding adapter and task docs so one real Codex run can be attempted through the existing `run:execute` contract.
- Result: The task bundle now defines a narrow, local-only executor pilot with explicit checks and boundaries.
- Artifact: .agent-workflow/tasks/T-002/checkpoint.md

### Proof 2

- Files: src/lib/workspace.js, src/lib/run-executor.js, test/workspace.test.js, test/run-executor.test.js, README.md, docs/ADAPTERS.md, docs/RUN_EXECUTE_DESIGN.md, docs/NEXT_AGENT_HANDOFF.md
- Check: Updated the recommended Codex exec template after a real dogfooding run showed that the local `codex exec` subcommand rejected `--ask-for-approval`, and fixed executor run serialization so ordinary failed runs do not persist invalid null signal fields.
- Result: The dogfooding path now reaches the real Codex CLI with the narrower confirmed argv shape, and failed executor runs stay schema-valid while leaving durable logs.
- Artifact: .agent-workflow/tasks/T-002/runs/run-1775654646958.stderr.log

## Blocking gaps

- The first real launch proved the child process path but failed because the prior recommended template passed unsupported `--ask-for-approval` flags to `codex exec`.
- After the template fix, the real launch reached Codex itself but still failed before model execution because the local environment does not provide `OPENAI_API_KEY`.
- A fully passed end-to-end Codex pilot on this machine now depends on local auth/provider readiness, not on prompt streaming, run ledger persistence, or Windows wrapper shape.

## Evidence 2026-04-08T13:24:07.079Z

- Agent: codex
- Source: executor
- Adapter: codex
- Status: failed
- Outcome: failed
- Exit code: 2
- Duration ms: 121
- Prompt file: .agent-workflow/tasks/T-002/prompt.codex.md
- Run request file: .agent-workflow/tasks/T-002/run-request.codex.json
- Launch pack file: .agent-workflow/tasks/T-002/launch.codex.md
- Stdout log: .agent-workflow/tasks/T-002/runs/run-1775654646958.stdout.log
- Stderr log: .agent-workflow/tasks/T-002/runs/run-1775654646958.stderr.log
- Scoped files covered: .agent-workflow/adapters/codex.json, .agent-workflow/tasks/T-002/checkpoint.json, .agent-workflow/tasks/T-002/checkpoint.md, .agent-workflow/tasks/T-002/context.md, .agent-workflow/tasks/T-002/launch.codex.md, .agent-workflow/tasks/T-002/prompt.codex.md, .agent-workflow/tasks/T-002/run-request.codex.json, .agent-workflow/tasks/T-002/runs/run-1775654646958.stderr.log, .agent-workflow/tasks/T-002/runs/run-1775654646958.stdout.log, .agent-workflow/tasks/T-002/task.json, .agent-workflow/tasks/T-002/task.md
- Verification artifacts: .agent-workflow/tasks/T-002/prompt.codex.md, .agent-workflow/tasks/T-002/run-request.codex.json, .agent-workflow/tasks/T-002/launch.codex.md, .agent-workflow/tasks/T-002/runs/run-1775654646958.stdout.log, .agent-workflow/tasks/T-002/runs/run-1775654646958.stderr.log
- Proof artifacts: .agent-workflow/tasks/T-002/runs/run-1775654646958.stdout.log, .agent-workflow/tasks/T-002/runs/run-1775654646958.stderr.log, .agent-workflow/tasks/T-002/prompt.codex.md, .agent-workflow/tasks/T-002/run-request.codex.json, .agent-workflow/tasks/T-002/launch.codex.md
- Failure category: non-zero-exit
- Summary: Executor failed with exit code 2.
- Verification check: [failed] Local codex executor result - exitCode=2; stdio=pipe; stdin=promptFile

## Evidence 2026-04-08T13:29:23.859Z

- Agent: codex
- Source: executor
- Adapter: codex
- Status: failed
- Outcome: failed
- Exit code: 1
- Duration ms: 138
- Prompt file: .agent-workflow/tasks/T-002/prompt.codex.md
- Run request file: .agent-workflow/tasks/T-002/run-request.codex.json
- Launch pack file: .agent-workflow/tasks/T-002/launch.codex.md
- Stdout log: .agent-workflow/tasks/T-002/runs/run-1775654963721.stdout.log
- Stderr log: .agent-workflow/tasks/T-002/runs/run-1775654963721.stderr.log
- Scoped files covered: .agent-workflow/adapters/codex.json, README.md, docs/NEXT_AGENT_HANDOFF.md, docs/RUN_EXECUTE_DESIGN.md, .agent-workflow/tasks/T-002/checkpoint.json, .agent-workflow/tasks/T-002/checkpoint.md, .agent-workflow/tasks/T-002/launch.codex.md, .agent-workflow/tasks/T-002/prompt.codex.md, .agent-workflow/tasks/T-002/run-request.codex.json, .agent-workflow/tasks/T-002/runs/run-1775654646958.json, .agent-workflow/tasks/T-002/runs/run-1775654646958.stderr.log, .agent-workflow/tasks/T-002/runs/run-1775654646958.stdout.log, .agent-workflow/tasks/T-002/runs/run-1775654963721.stderr.log, .agent-workflow/tasks/T-002/runs/run-1775654963721.stdout.log, .agent-workflow/tasks/T-002/task.json
- Verification artifacts: .agent-workflow/tasks/T-002/prompt.codex.md, .agent-workflow/tasks/T-002/run-request.codex.json, .agent-workflow/tasks/T-002/launch.codex.md, .agent-workflow/tasks/T-002/runs/run-1775654963721.stdout.log, .agent-workflow/tasks/T-002/runs/run-1775654963721.stderr.log
- Proof artifacts: .agent-workflow/tasks/T-002/runs/run-1775654963721.stdout.log, .agent-workflow/tasks/T-002/runs/run-1775654963721.stderr.log, .agent-workflow/tasks/T-002/prompt.codex.md, .agent-workflow/tasks/T-002/run-request.codex.json, .agent-workflow/tasks/T-002/launch.codex.md
- Failure category: non-zero-exit
- Summary: Executor failed with exit code 1.
- Verification check: [failed] Local codex executor result - exitCode=1; stdio=pipe; stdin=promptFile

## Evidence 2026-04-08T13:30:25.369Z

- Agent: codex
- Source: executor
- Adapter: codex
- Status: failed
- Outcome: failed
- Exit code: 1
- Duration ms: 513
- Prompt file: .agent-workflow/tasks/T-002/prompt.codex.md
- Run request file: .agent-workflow/tasks/T-002/run-request.codex.json
- Launch pack file: .agent-workflow/tasks/T-002/launch.codex.md
- Stdout log: .agent-workflow/tasks/T-002/runs/run-1775655024856.stdout.log
- Stderr log: .agent-workflow/tasks/T-002/runs/run-1775655024856.stderr.log
- Scoped files covered: README.md, docs/NEXT_AGENT_HANDOFF.md, docs/RUN_EXECUTE_DESIGN.md, .agent-workflow/tasks/T-002/checkpoint.json, .agent-workflow/tasks/T-002/checkpoint.md, .agent-workflow/tasks/T-002/launch.codex.md, .agent-workflow/tasks/T-002/prompt.codex.md, .agent-workflow/tasks/T-002/run-request.codex.json, .agent-workflow/tasks/T-002/runs/run-1775654646958.json, .agent-workflow/tasks/T-002/runs/run-1775654646958.stderr.log, .agent-workflow/tasks/T-002/runs/run-1775654646958.stdout.log, .agent-workflow/tasks/T-002/runs/run-1775654963721.json, .agent-workflow/tasks/T-002/runs/run-1775654963721.stderr.log, .agent-workflow/tasks/T-002/runs/run-1775654963721.stdout.log, .agent-workflow/tasks/T-002/runs/run-1775655024856.stderr.log, .agent-workflow/tasks/T-002/runs/run-1775655024856.stdout.log, .agent-workflow/tasks/T-002/task.json
- Verification artifacts: .agent-workflow/tasks/T-002/prompt.codex.md, .agent-workflow/tasks/T-002/run-request.codex.json, .agent-workflow/tasks/T-002/launch.codex.md, .agent-workflow/tasks/T-002/runs/run-1775655024856.stdout.log, .agent-workflow/tasks/T-002/runs/run-1775655024856.stderr.log
- Proof artifacts: .agent-workflow/tasks/T-002/runs/run-1775655024856.stdout.log, .agent-workflow/tasks/T-002/runs/run-1775655024856.stderr.log, .agent-workflow/tasks/T-002/prompt.codex.md, .agent-workflow/tasks/T-002/run-request.codex.json, .agent-workflow/tasks/T-002/launch.codex.md
- Failure category: non-zero-exit
- Summary: Executor failed with exit code 1.
- Verification check: [failed] Local codex executor result - exitCode=1; stdio=pipe; stdin=promptFile
