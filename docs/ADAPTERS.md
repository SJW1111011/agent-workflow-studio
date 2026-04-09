# Adapters

The adapter layer is the bridge between workflow state and a concrete agent runtime such as Codex or Claude Code.

## Current goal

The current version still focuses on a safe contract first:

- define what each adapter expects
- generate adapter-specific prompt targets
- produce a run request that another tool or future executor can consume
- avoid hard-coding machine-specific absolute paths

It now also includes a first CLI-only executor path for adapters that opt into `commandMode: exec`.

## What gets generated

Inside the target repository:

```text
.agent-workflow/
  adapters/
    README.md
    codex.json
    claude-code.json
```

Inside each task folder after `run:prepare`:

```text
.agent-workflow/tasks/T-001/
  prompt.codex.md
  launch.codex.md
  run-request.codex.json
```

The same pattern exists for Claude Code.

## Why a contract-first adapter layer

Launching agent CLIs directly can vary by:

- operating system
- shell
- local installation method
- authentication state
- how much automation the user wants

So the first version creates a durable handoff pack that is easy to inspect, version, and automate later.

That remains true even after adding `run:execute`:

- built-in adapters still default to `manual`
- execution is only enabled when an adapter config explicitly opts into `exec`
- the executor reads adapter config plus `run-request.<adapter>.json`
- evidence is written back into task-local workflow files

## Adapter config fields

- `adapterId`: stable identifier
- `name`: human-readable name
- `promptFile`: task-local prompt file name
- `runRequestFile`: machine-readable execution handoff
- `launchPackFile`: human-readable execution handoff
- `runnerCommand`: local binary hint, editable by the user
- `argvTemplate`: adapter-owned argument template for executable mode
- `commandMode`: `manual` or `exec`
- `cwdMode`: runtime working directory hint for executable mode
- `stdioMode`: `inherit` or `pipe`
- `stdinMode`: `none` or `promptFile`
- `successExitCodes`: which exit codes count as pass
- `timeoutMs`: optional adapter-level timeout
- `envAllowlist`: optional environment keys to forward
- `capabilities`: lightweight feature flags for the adapter

## Current real-CLI pilots

Two narrow local pilots have been validated through the `run:execute` contract. Both are opt-in and repo-local; built-in generated adapter scaffolds still default to `commandMode: manual`.

### Codex pilot

- the built-in Codex adapter still defaults to `commandMode: manual`
- it now also carries a recommended non-interactive `codex exec --sandbox workspace-write -` argv template
- that template uses `stdinMode: promptFile`, so the compiled prompt can be streamed to Codex over stdin instead of relying on shell redirection
- on the locally observed Codex CLI surface from 2026-04-08, `codex exec` accepted `--sandbox` but rejected `--ask-for-approval`, so the current recommended template stays within that confirmed flag shape

### Claude Code pilot (T-003)

- the repo-local Claude Code adapter (`claude-code.json`) opts into `commandMode: exec` and `stdinMode: promptFile` for dogfooding only
- the locally confirmed non-interactive shape is `cmd.exe /d /s /c claude --model sonnet --bare --output-format json -p --permission-mode bypassPermissions` on Windows
- direct PowerShell invocation resolves to `claude.ps1`, which is blocked by script-execution policy on this machine; the `cmd.exe` wrapper avoids that issue
- the first run attempt revealed that `claude auth status` alone is not sufficient under the executor's stripped child env: the adapter `envAllowlist` must include `ANTHROPIC_AUTH_TOKEN` and `ANTHROPIC_BASE_URL` for non-interactive print mode to stay authenticated
- the pilot is kept inspection-first: the launched Claude process reads scoped docs, runs automated checks, and reports truthfully without making broad repo edits

This is intentionally still opt-in across both pilots:

- local environments vary
- Windows may still need a wrapper such as `cmd.exe` if direct CLI spawning is not available on that machine
- even after runner shape is confirmed, a real local CLI may still require separate auth/provider readiness before model execution succeeds, and that may depend on adapter-owned `envAllowlist` entries for the child process
- preflight now surfaces those readiness issues as typed blocking issues plus advisories instead of silently failing at spawn time
- in Git mode, preflight can also add a non-blocking dirty-worktree advisory when the repository already has local changes before launch

## Next step

The first local executor pass now supports:

- CLI-only `run:execute`
- direct process spawning from adapter config
- run evidence written back into `runs/*.json`
- automatic refresh of `verification.md` and `checkpoint.md`
- stdout and stderr capture in `pipe` mode
- timeout and interruption metadata in the run ledger
- structured verification checks and artifact refs in passed run evidence
- prompt-to-stdin delivery for adapters that explicitly declare `stdinMode: promptFile`

The next implementation layer can add:

- richer proof capture and execution controls in the dashboard
- session transcript linking
- richer resume and interruption recovery flows

The current recommended boundary for that work is documented in `docs/RUN_EXECUTE_DESIGN.md`.
