# `run:execute` Design

This document defines the first local executor design for `run:execute`.

The goal is to add real local execution without breaking the project's contract-first architecture.

Status on 2026-04-03:

- Phase A is now implemented in CLI-only form
- the first implementation supports `commandMode: exec`
- the first implementation supports both `stdioMode: inherit` and `stdioMode: pipe`
- stdout/stderr capture, timeout metadata, and interruption metadata are now implemented
- dashboard-triggered execution and transcript linking remain future work

## Why this exists

The current workflow can already:

- define task structure
- compile strong prompts
- generate adapter-specific handoff packs
- record run evidence after the fact
- refresh checkpoints

What it cannot do yet is launch a local agent runtime in a structured, portable way.

That gap matters because automation is part of the product thesis, but the executor must not collapse the architecture into hard-coded vendor glue.

## Non-negotiable constraints

`run:execute` must preserve these rules:

1. The target repository remains the source of truth.
2. Adapter configs remain the vendor-specific contract boundary.
3. Generated workflow state must stay portable and must not persist absolute machine paths.
4. Execution evidence must be written back into the task package.
5. The executor must not turn the product into a generic chat shell or opaque job runner.

## Current contract surface

Today the execution contract is already split into durable files:

- `.agent-workflow/adapters/<adapter>.json`
- `.agent-workflow/tasks/<taskId>/prompt.<adapter>.md`
- `.agent-workflow/tasks/<taskId>/run-request.<adapter>.json`
- `.agent-workflow/tasks/<taskId>/launch.<adapter>.md`

That split is good and should stay.

### Adapter config owns

- adapter identity
- runner binary hint
- capability flags
- adapter-specific execution behavior

### Run request owns

- task-level execution intent
- prompt file reference
- task-relative paths
- expected outputs

### Executor owns

- runtime path resolution
- process spawning
- timestamp capture
- exit status capture
- optional stdout and stderr capture
- writing execution evidence back into task artifacts

The executor should not become the place where vendor behavior is hard-coded.

## Proposed CLI contract

First-pass command:

```bash
npm run cli -- run:execute T-001 --agent codex --root ../repo
```

Expected behavior:

1. Resolve the target repository from `--root` or `process.cwd()`.
2. Ensure the task exists.
3. Ensure prompt and run-request artifacts exist, regenerating them through the existing `run:prepare` path when needed.
4. Load the adapter config.
5. If the adapter is still manual-only, stop with a clear message and point the user to the existing launch pack.
6. If the adapter is executable, build the final argv from the adapter contract plus the run-request.
7. Spawn the process locally.
8. Persist execution evidence into the task run ledger.
9. Refresh `verification.md` and `checkpoint.md`.

## Contract additions

The first implementation should prefer additive changes over breaking ones.

### Adapter config additions

Current adapter files already include:

- `runnerCommand`
- `commandMode`
- `capabilities`

The executor design adds these optional fields:

- `argvTemplate`: argument template appended after `runnerCommand`
- `cwdMode`: `workspaceRoot` or `taskRoot`
- `stdioMode`: `inherit` or `pipe`
- `successExitCodes`: explicit success codes, default `[0]`
- `envAllowlist`: environment variable names the executor may forward

Example direction:

```json
{
  "adapterId": "codex",
  "runnerCommand": ["codex"],
  "commandMode": "exec",
  "argvTemplate": ["run", "--prompt-file", "{promptFile}"],
  "cwdMode": "workspaceRoot",
  "stdioMode": "inherit",
  "successExitCodes": [0],
  "envAllowlist": []
}
```

Why this shape:

- the adapter remains the only vendor-specific translation layer
- the core executor only performs token substitution and process launch
- the workflow schema stays inspectable and portable

### Supported template tokens

The executor should support a small, explicit token set:

- `{workspaceRoot}`
- `{taskRoot}`
- `{promptFile}`
- `{launchPackFile}`
- `{runRequestFile}`

Tokens are resolved at runtime into absolute paths for process launch, but persisted workflow files should continue to store only repository-relative paths.

## Run record design

Current run records are simple and should stay backward compatible.

Existing fields:

- `id`
- `taskId`
- `agent`
- `status`
- `summary`
- `createdAt`

`run:execute` should extend the run record with optional fields instead of replacing the schema outright.

Suggested additive fields:

- `source`: `manual` or `executor`
- `adapterId`
- `commandMode`
- `startedAt`
- `completedAt`
- `durationMs`
- `exitCode`
- `timedOut`
- `timeoutMs`
- `interrupted`
- `interruptionSignal`
- `terminationSignal`
- `promptFile`
- `runRequestFile`
- `launchPackFile`
- `stdoutFile`
- `stderrFile`
- `errorMessage`

Example shape:

```json
{
  "id": "run-1760000000000",
  "taskId": "T-001",
  "agent": "codex",
  "adapterId": "codex",
  "source": "executor",
  "status": "passed",
  "summary": "Executor completed with exit code 0.",
  "createdAt": "2026-04-03T01:00:00.000Z",
  "startedAt": "2026-04-03T01:00:00.000Z",
  "completedAt": "2026-04-03T01:03:12.000Z",
  "durationMs": 192000,
  "exitCode": 0,
  "commandMode": "exec",
  "promptFile": ".agent-workflow/tasks/T-001/prompt.codex.md",
  "runRequestFile": ".agent-workflow/tasks/T-001/run-request.codex.json",
  "launchPackFile": ".agent-workflow/tasks/T-001/launch.codex.md",
  "stdoutFile": ".agent-workflow/tasks/T-001/runs/run-1760000000000.stdout.log",
  "stderrFile": ".agent-workflow/tasks/T-001/runs/run-1760000000000.stderr.log"
}
```

## What gets persisted vs what stays runtime-only

### Persist

- run json entry
- relative paths to prompt, run-request, and optional logs
- timestamps
- exit code
- status
- concise execution summary

### Do not persist

- absolute workspace paths
- arbitrary shell command strings
- raw environment variable values
- process ids
- machine-specific temporary directories

This keeps the evidence durable without baking one machine's runtime details into the project state.

## Execution flow

### Phase 1: prepare

- normalize adapter id
- ensure prompt exists
- ensure run-request exists
- read adapter config
- reject unsupported command modes early

### Phase 2: resolve runtime plan

- resolve all repository-relative references to runtime absolute paths
- build argv from `runnerCommand + argvTemplate`
- choose cwd from `cwdMode`
- forward only allowed environment keys

Important:

- do not use `shell: true`
- do not concatenate one large command string
- use direct process spawning with argv arrays

### Phase 3: execute

- create a run id
- record `startedAt`
- launch the process
- optionally pipe stdout and stderr into task-local log files
- wait for exit, error, timeout, or interruption

### Phase 4: persist evidence

- write `runs/<runId>.json`
- append a structured evidence block to `verification.md`
- rebuild `checkpoint.md`
- update `task.json.updatedAt`
- if the task is still `todo`, it may move to `in_progress`
- never auto-mark a task as `done`

## Verification and checkpoint refresh rules

`run:execute` should refresh workflow evidence automatically, but only in ways that remain honest.

### `verification.md`

Append an evidence block including:

- adapter
- source: executor
- status
- exit code when available
- prompt file reference
- log file references when available
- unresolved risk note when the run failed, timed out, or produced partial evidence

### `checkpoint.md`

Rebuild from current task state plus recorded runs.

The checkpoint should explicitly reflect:

- latest run status
- latest run timestamp
- whether execution evidence exists
- what still needs manual verification

## Failure modes

The first implementation should model failure explicitly instead of hiding it.

Important failure classes:

- adapter still configured as manual-only
- runner binary missing
- invalid adapter argv template
- child process launch error
- timeout
- user interruption
- non-zero exit code

Each of these should produce a run record when execution actually started, or a clear CLI error when it never did.

## Interaction model

The first pass should stay CLI-first.

Why:

- process execution and terminal ownership are simpler from the CLI
- interactive agent runtimes often want inherited stdio
- the dashboard should not become the first place where process orchestration complexity accumulates

Later, the dashboard can call into the same local execution service, but the core implementation should be shared and not duplicated in `src/server.js`.

## Phased implementation plan

### Phase A: minimal local executor

- CLI-only `run:execute`
- additive run schema fields
- adapter `commandMode: exec`
- `stdioMode: inherit` support
- verification and checkpoint refresh

### Phase B: better capture and safety

- stdout and stderr log capture
- timeout support
- interruption metadata
- richer adapter config validation
- clearer failure summaries in dashboard views

### Phase C: richer resume support

- transcript linking where supported
- resume metadata beyond first-pass interruption records
- dashboard-triggered execution built on the same executor module

## What this design deliberately avoids

- cloud execution
- hidden databases
- generic chat session orchestration
- hard-coded vendor launch flows in the core CLI
- automatic task completion based only on exit code

## Recommendation

Implement `run:execute` as a thin generic launcher over existing contracts:

- adapters define how to launch
- run-request defines what to launch for a task
- executor performs safe local resolution and process spawning
- run ledger, verification docs, and checkpoints capture the evidence

That keeps automation aligned with the product thesis:

- tasks still compile into strong prompts
- runs leave evidence
- evidence refreshes docs and checkpoints
- long jobs stay handoff-friendly because the contract remains file-based and durable
