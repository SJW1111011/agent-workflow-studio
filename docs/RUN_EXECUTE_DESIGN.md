# `run:execute` Design

This document defines the first local executor design for `run:execute`.

The goal is to add real local execution without breaking the project's contract-first architecture.

Status on 2026-04-07:

- Phase A is implemented
- Phase B is largely implemented
- the first implementation supports `commandMode: exec`
- the first implementation supports both `stdioMode: inherit` and `stdioMode: pipe`
- stdout/stderr capture, timeout metadata, and interruption metadata are now implemented
- the dashboard now has a thin local API bridge over the same executor for `stdioMode: pipe`
- the dashboard bridge can now request cancellation for active local `pipe` executions
- HTTP behavior for the local API is now explicitly typed instead of inferred from error text
- transcript linking and richer resume metadata remain future work
- the next step is design hardening first, not a second execution subsystem

## Why this exists

The current workflow can already:

- define task structure
- compile strong prompts
- generate adapter-specific handoff packs
- record run evidence after the fact
- refresh checkpoints

What it still cannot do yet is cover every local runtime shape with equal UX quality.

That remaining gap matters because automation is part of the product thesis, but the executor must not collapse the architecture into hard-coded vendor glue.

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
- `scopeProofPaths`
- `scopeProofAnchors`
- `verificationChecks`
- `verificationArtifacts`
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
  "stderrFile": ".agent-workflow/tasks/T-001/runs/run-1760000000000.stderr.log",
  "scopeProofPaths": [
    "src/server.js"
  ],
  "scopeProofAnchors": [
    {
      "path": "src/server.js",
      "gitState": "M",
      "previousPath": null,
      "exists": true,
      "contentFingerprint": "sha1:abc123"
    }
  ],
  "verificationChecks": [
    {
      "label": "Local codex executor result",
      "status": "passed",
      "details": "exitCode=0; stdio=pipe",
      "artifacts": [
        ".agent-workflow/tasks/T-001/prompt.codex.md",
        ".agent-workflow/tasks/T-001/run-request.codex.json",
        ".agent-workflow/tasks/T-001/runs/run-1760000000000.stdout.log"
      ]
    }
  ],
  "verificationArtifacts": [
    ".agent-workflow/tasks/T-001/prompt.codex.md",
    ".agent-workflow/tasks/T-001/run-request.codex.json",
    ".agent-workflow/tasks/T-001/runs/run-1760000000000.stdout.log",
    ".agent-workflow/tasks/T-001/runs/run-1760000000000.stderr.log"
  ]
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
- structured verification checks and artifact refs when available

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
- which scoped files still appear to need proof under the current local verification gate

Passed runs may also snapshot `scopeProofPaths` so the verification layer can explain which repo-relative files were explicitly covered at record time.

Those paths can now participate in proof items alongside structured `verificationChecks`, the run summary fallback, and task-local artifact refs such as stdout/stderr logs.

Passed runs can now also persist optional `scopeProofAnchors` for those same proof paths.

That remains:

- repo-relative
- optional
- backward compatible with existing run records
- safe to omit when anchor capture is unavailable

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

Interactive terminal-owned flows should stay CLI-first.

Why:

- process execution and terminal ownership are simpler from the CLI
- interactive agent runtimes often want inherited stdio
- the dashboard should not become the first place where process orchestration complexity accumulates

Later, the dashboard can call into the same local execution service, but the core implementation should be shared and not duplicated in `src/server.js`.

## Dashboard local API bridge

This implementation does not rewrite `run:execute` for HTTP.

It keeps a thin local bridge over the same executor path that the CLI already uses.

That means:

- `src/lib/run-executor.js` stays the single execution implementation
- the dashboard only talks to a local server endpoint
- `src/server.js` should stay a thin request/response wrapper, or delegate to a small execution-focused module if the flow grows
- adapter argv resolution, process spawning, evidence writing, and checkpoint refresh must remain shared behavior

### Current API shape

The first dashboard execution pass stays local-only and small:

- `POST /api/tasks/:taskId/execute`
- request body:
  - `agent`: optional adapter id, default `codex`
  - `timeoutMs`: optional positive integer override
- response:
  - `202 Accepted` when a local execution starts
  - task id, adapter id, local execution status, and latest known run id when available

Current follow-up status route:

- `GET /api/tasks/:taskId/execution`

Current active log route:

- `GET /api/tasks/:taskId/execution/logs/:stream`
- local-only tail/readback for the current dashboard execution state
- backed by the same task-local stdout/stderr files that the shared executor writes
- once the execution is durably recorded as a run, the dashboard may switch that panel to the persisted run-log route for the same stream

Current cancel route:

- `POST /api/tasks/:taskId/execution/cancel`

That route can expose transient server-local state such as:

- `idle`
- `starting`
- `running`
- `cancel-requested`
- `completed`
- `failed-to-start`

It can also derive lightweight observability from the current task-local log files, for example:

- `activity`: `awaiting-output`, `streaming-output`, `shutting-down`, or terminal states
- `streams.stdout` / `streams.stderr`: existence, byte count, and last update time
- `lastOutputAt`
- `totalOutputBytes`

### Current safety boundary

The dashboard-triggered pass only launches adapters whose resolved execution plan uses `stdioMode: pipe`.

If an adapter resolves to `stdioMode: inherit`, the local API should reject the request with a clear message telling the user to use the CLI.

Why this boundary matters:

- interactive agents often expect terminal ownership
- the browser should not pretend to be a terminal multiplexer
- keeping `inherit` CLI-only avoids inventing a fragile pseudo-chat shell around local processes

### State model

The dashboard does not need a second durable execution database.

Instead:

- transient "currently running" state can stay server-local and in memory
- durable truth stays in the task package
- the UI can poll task detail plus execution status while a job is active
- the bridge may also expose active stdout/stderr tail readback by pointing at the same task-local log files, without creating a second log store
- the bridge may derive lightweight stream/activity metadata from those same log files, as long as it does not become a second durable execution model
- cancellation only updates transient bridge state immediately; the durable truth still becomes the final interrupted executor run
- the bridge can also expose a structured final `outcome` such as `passed`, `timed-out`, `interrupted`, `cancelled`, or `failed-to-start` so the dashboard does not have to infer that from summary strings
- the dashboard presentation layer may map those outcomes into distinct local visual states, as long as it remains a pure UI interpretation and not a second execution contract

Durable evidence still comes from the existing artifacts:

- `runs/<runId>.json`
- task-local stdout/stderr logs when capture mode is enabled
- `verification.md`
- `checkpoint.md`

The current pass also keeps one more simplification:

- allow at most one active dashboard-launched execution per task

That keeps evidence ordering understandable and avoids overlapping local mutations before the model is proven.

### Why this still fits the contract-first architecture

This dashboard bridge does not change the source of truth:

- the adapter contract still defines how execution works
- the prepared run-request still defines what is being launched
- the shared executor still owns runtime resolution and evidence writing
- the task package still remains the durable audit trail

So the dashboard becomes a local trigger, not a second workflow engine.

## Next local executor step

The next `run:execute` step should stay deliberately narrow.

It should harden the current contract instead of adding a second execution product.

### What the next step should do

- keep the existing pipeline: `task -> prompt/run-request -> execution plan -> local process -> run evidence -> verification/checkpoint refresh`
- keep adapter config as the only vendor-specific launch contract
- keep `src/lib/run-executor.js` as the shared execution implementation for both CLI and dashboard-triggered local runs
- make long-running jobs easier to inspect and hand off by improving durable evidence, not by introducing hidden runtime state
- extend tests and design constraints before expanding runtime breadth

### What the next step should not do

- do not create a dashboard-only execution ledger
- do not persist chat transcripts or opaque session blobs as the main resume mechanism
- do not turn the browser into a pseudo-terminal for `stdioMode: inherit`
- do not bypass `run:prepare` / `run-request` by launching directly from ad hoc UI state
- do not bake absolute paths, machine-specific temp state, or shell-composed command strings into workflow artifacts

### Durable handoff contract

The resume story should continue to rely on files that another agent or operator can inspect later:

- `task.md`
- `context.md`
- `verification.md`
- `checkpoint.md`
- `prompt.<adapter>.md`
- `run-request.<adapter>.json`
- `launch.<adapter>.md`
- `runs/<runId>.json`
- task-local stdout/stderr logs when capture mode is enabled

If a future execution feature cannot explain itself through those artifacts, it is probably outside the intended architecture boundary.

### Additive contract growth only

If future executor work needs more metadata, prefer additive optional fields over schema churn.

Good candidates are fields that improve auditability without changing the source of truth, for example:

- an execution intent identifier shared across transient bridge state and the final run record
- a normalized lifecycle state description
- explicit failure category labels
- a sanitized execution summary that explains what happened without persisting machine-specific command strings

Avoid fields that would make the task package depend on one machine's private environment.

### UI boundary

The dashboard should remain a control plane:

- start a local execution
- observe transient status
- inspect active or persisted logs
- request cancellation
- refresh task detail after durable evidence lands

It should not become the canonical execution state store.

### Recommended implementation sequence

Before adding another execution capability, do this in order:

1. document the lifecycle and failure semantics clearly
2. lock them down with unit and smoke coverage
3. only then add the smallest implementation needed on top of the shared executor

That sequence keeps automation aligned with the contract-first workflow model instead of letting orchestration details outrun the evidence model.

## Phased implementation plan

### Phase A: minimal local executor

- shared `run:execute` executor path
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
- local dashboard execution bridge for `stdioMode: pipe`

### Phase C: richer resume support

- transcript linking where supported
- resume metadata beyond first-pass interruption records
- richer dashboard-triggered execution flows on top of the same executor module, while `inherit` stays CLI-only until terminal ownership is designed

### Phase D: contract hardening before breadth

- keep the execution lifecycle additive and explicit
- expand test coverage around execution states, failure categories, and local API contracts
- only add new executor behaviors that still land in the same durable task artifacts

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
