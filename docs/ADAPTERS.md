# Adapters

The adapter layer is the bridge between workflow state and a concrete agent runtime such as Codex or Claude Code.

## Current goal

The current version focuses on a safe contract first:

- define what each adapter expects
- generate adapter-specific prompt targets
- produce a run request that another tool or future executor can consume
- avoid hard-coding machine-specific absolute paths

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

## Adapter config fields

- `adapterId`: stable identifier
- `name`: human-readable name
- `promptFile`: task-local prompt file name
- `runRequestFile`: machine-readable execution handoff
- `launchPackFile`: human-readable execution handoff
- `runnerCommand`: local binary hint, editable by the user
- `capabilities`: lightweight feature flags for the adapter

## Next step

The next implementation layer can add:

- real process spawning for approved local executors
- richer stdin or prompt passing strategies
- run completion ingestion
- session transcript linking
