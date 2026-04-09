# T-003 Verification

## Planned checks

- automated: npm test
- automated: npm run smoke
- automated: npm run validate -- --root .
- automated: npm run run:execute -- T-003 --agent claude --root .
- manual: Review the persisted run record, stdout/stderr logs, and checkpoint for T-003 to confirm the real local Claude path left durable evidence without broadening defaults.

## Proof links

### Proof 1

- Files: .agent-workflow/adapters/claude-code.json, .agent-workflow/tasks/T-003/task.md, .agent-workflow/tasks/T-003/context.md, .agent-workflow/tasks/T-003/verification.md
- Check: Scoped the repo-local Claude dogfooding adapter and task docs so one real Claude Code run can be attempted through the existing `run:execute` contract.
- Result: The task bundle now defines a narrow, local-only Claude executor pilot with explicit checks and boundaries.
- Artifact: .agent-workflow/tasks/T-003/checkpoint.md

### Proof 2

- Files: README.md, docs/ADAPTERS.md, docs/RUN_EXECUTE_DESIGN.md, docs/NEXT_AGENT_HANDOFF.md, .agent-workflow/adapters/claude-code.json, .agent-workflow/tasks/T-003/task.json, .agent-workflow/tasks/T-003/checkpoint.md, .agent-workflow/tasks/T-003/checkpoint.json, .agent-workflow/tasks/T-003/runs/run-1775698767859.json, .agent-workflow/tasks/T-003/runs/run-1775698767859.stdout.log, .agent-workflow/tasks/T-003/runs/run-1775699218129.json, .agent-workflow/tasks/T-003/runs/run-1775699218129.stdout.log
- Check: A real local `run:execute` for T-003 via the Claude Code adapter (`cmd.exe /d /s /c claude --model sonnet --bare --output-format json -p --permission-mode bypassPermissions` + `stdinMode: promptFile` + `envAllowlist: [ANTHROPIC_AUTH_TOKEN, ANTHROPIC_BASE_URL]`) reached the child Claude process, passed automated validation, and left durable task-local evidence plus scoped documentation updates describing the confirmed launcher shape.
- Result: `npm test` passed with 82 tests; `npm run smoke` passed; `npm run validate -- --root .` returned ok=true with 0 errors and 0 warnings. The first Claude run failed with exit code 1 and `Not logged in`, which confirmed that the stripped child env still needed `ANTHROPIC_AUTH_TOKEN` plus `ANTHROPIC_BASE_URL`. After allowlisting those env vars, the next real Claude run exited 0, produced a durable run record, refreshed the checkpoint, and updated the scoped adapter/design docs without broad repo edits.
- Artifact: .agent-workflow/tasks/T-003/runs/run-1775698767859.stdout.log, .agent-workflow/tasks/T-003/runs/run-1775699218129.json, .agent-workflow/tasks/T-003/runs/run-1775699218129.stdout.log, .agent-workflow/tasks/T-003/checkpoint.md

## Blocking gaps

- ~~The repo-local Claude path still needs one real `run:execute` attempt whose primary outcome is durable evidence, not inferred readiness from ad hoc shell probes alone.~~ *Resolved: see Proof 2.*

## Evidence

<!-- agent-workflow:managed:verification-manual-proof-anchors:start -->
### Manual proof anchors

```json
{
  "version": 1,
  "manualProofAnchors": [
    {
      "proofSignature": "sha1:a60e571137147050812ae2a445000bb78446b192",
      "capturedAt": "2026-04-09T01:57:30.320Z",
      "paths": [
        ".agent-workflow/adapters/claude-code.json",
        ".agent-workflow/tasks/T-003/task.md",
        ".agent-workflow/tasks/T-003/context.md",
        ".agent-workflow/tasks/T-003/verification.md"
      ],
      "anchors": [
        {
          "path": ".agent-workflow/adapters/claude-code.json",
          "gitState": "M",
          "exists": true,
          "contentFingerprint": "sha1:e44cb5e1989d538342e3b849497ab3d03f6d763a"
        },
        {
          "path": ".agent-workflow/tasks/T-003/task.md",
          "gitState": "??",
          "exists": true,
          "contentFingerprint": "sha1:84c8a7dc08e7cfa69e7746d586735136b0064f48"
        },
        {
          "path": ".agent-workflow/tasks/T-003/context.md",
          "gitState": "??",
          "exists": true,
          "contentFingerprint": "sha1:0c2efdf0ff7ad984e93278829fd789eafe189e0e"
        },
        {
          "path": ".agent-workflow/tasks/T-003/verification.md",
          "gitState": "??",
          "exists": true,
          "contentFingerprint": "sha1:5d3d67e5f2d29b77a74aadd3077c120a3aa796ea"
        }
      ]
    },
    {
      "proofSignature": "sha1:41ff65abfd4d39fc00ad6d46bb5508b09267ed8f",
      "capturedAt": "2026-04-09T01:57:30.320Z",
      "paths": [
        "README.md",
        "docs/ADAPTERS.md",
        "docs/RUN_EXECUTE_DESIGN.md",
        "docs/NEXT_AGENT_HANDOFF.md",
        ".agent-workflow/adapters/claude-code.json",
        ".agent-workflow/tasks/T-003/task.json",
        ".agent-workflow/tasks/T-003/checkpoint.md",
        ".agent-workflow/tasks/T-003/checkpoint.json",
        ".agent-workflow/tasks/T-003/runs/run-1775698767859.json",
        ".agent-workflow/tasks/T-003/runs/run-1775698767859.stdout.log",
        ".agent-workflow/tasks/T-003/runs/run-1775699218129.json",
        ".agent-workflow/tasks/T-003/runs/run-1775699218129.stdout.log"
      ],
      "anchors": [
        {
          "path": "README.md",
          "gitState": "M",
          "exists": true,
          "contentFingerprint": "sha1:88df6ca157338ed043ec7e0e46c8f5095f8f443c"
        },
        {
          "path": "docs/ADAPTERS.md",
          "gitState": "M",
          "exists": true,
          "contentFingerprint": "sha1:3d872d492662ec7d949500350f17829aa474259c"
        },
        {
          "path": "docs/RUN_EXECUTE_DESIGN.md",
          "gitState": "M",
          "exists": true,
          "contentFingerprint": "sha1:743f3381fc97b6bbd1d7e015f8805cd0a0a9e9e6"
        },
        {
          "path": "docs/NEXT_AGENT_HANDOFF.md",
          "gitState": "M",
          "exists": true,
          "contentFingerprint": "sha1:1e5fe9b022711cd4343291c5a8fbf8dfb2acd573"
        },
        {
          "path": ".agent-workflow/adapters/claude-code.json",
          "gitState": "M",
          "exists": true,
          "contentFingerprint": "sha1:e44cb5e1989d538342e3b849497ab3d03f6d763a"
        },
        {
          "path": ".agent-workflow/tasks/T-003/task.json",
          "gitState": "??",
          "exists": true,
          "contentFingerprint": "sha1:cfeebb8951475d9c080926331b971fdee357516b"
        },
        {
          "path": ".agent-workflow/tasks/T-003/checkpoint.md",
          "gitState": "??",
          "exists": true,
          "contentFingerprint": "sha1:8464f8bb9fca75b73629aac015e34f6fb47536e5"
        },
        {
          "path": ".agent-workflow/tasks/T-003/checkpoint.json",
          "gitState": "??",
          "exists": true,
          "contentFingerprint": "sha1:0594aa8a2e07baf705b7480c18feb9d2af9126d4"
        },
        {
          "path": ".agent-workflow/tasks/T-003/runs/run-1775698767859.json",
          "gitState": "??",
          "exists": true,
          "contentFingerprint": "sha1:b31d4e546592e959f6572c60ea6484ea4ba925b8"
        },
        {
          "path": ".agent-workflow/tasks/T-003/runs/run-1775698767859.stdout.log",
          "gitState": "??",
          "exists": true,
          "contentFingerprint": "sha1:ee4376b5614b00032e7ff79fb468e774b3e78843"
        },
        {
          "path": ".agent-workflow/tasks/T-003/runs/run-1775699218129.json",
          "gitState": "??",
          "exists": true,
          "contentFingerprint": "sha1:cbb5b03012d0ee3bb03472d509a8d26823f7bf13"
        },
        {
          "path": ".agent-workflow/tasks/T-003/runs/run-1775699218129.stdout.log",
          "gitState": "??",
          "exists": true,
          "contentFingerprint": "sha1:d122fe0a592ce1f196c37708eac9fab6f1eb7dea"
        }
      ]
    }
  ]
}
```
<!-- agent-workflow:managed:verification-manual-proof-anchors:end -->

## Evidence 2026-04-09T01:39:29.887Z

- Agent: claude-code
- Source: executor
- Adapter: claude-code
- Status: failed
- Outcome: failed
- Exit code: 1
- Duration ms: 2028
- Prompt file: .agent-workflow/tasks/T-003/prompt.claude.md
- Run request file: .agent-workflow/tasks/T-003/run-request.claude-code.json
- Launch pack file: .agent-workflow/tasks/T-003/launch.claude-code.md
- Stdout log: .agent-workflow/tasks/T-003/runs/run-1775698767859.stdout.log
- Stderr log: .agent-workflow/tasks/T-003/runs/run-1775698767859.stderr.log
- Scoped files covered: .agent-workflow/tasks/T-003/checkpoint.json, .agent-workflow/tasks/T-003/checkpoint.md, .agent-workflow/tasks/T-003/launch.claude-code.md, .agent-workflow/tasks/T-003/prompt.claude.md, .agent-workflow/tasks/T-003/run-request.claude-code.json, .agent-workflow/tasks/T-003/runs/run-1775698767859.stderr.log, .agent-workflow/tasks/T-003/runs/run-1775698767859.stdout.log, .agent-workflow/tasks/T-003/task.json
- Verification artifacts: .agent-workflow/tasks/T-003/prompt.claude.md, .agent-workflow/tasks/T-003/run-request.claude-code.json, .agent-workflow/tasks/T-003/launch.claude-code.md, .agent-workflow/tasks/T-003/runs/run-1775698767859.stdout.log, .agent-workflow/tasks/T-003/runs/run-1775698767859.stderr.log
- Proof artifacts: .agent-workflow/tasks/T-003/runs/run-1775698767859.stdout.log, .agent-workflow/tasks/T-003/runs/run-1775698767859.stderr.log, .agent-workflow/tasks/T-003/prompt.claude.md, .agent-workflow/tasks/T-003/run-request.claude-code.json, .agent-workflow/tasks/T-003/launch.claude-code.md
- Failure category: non-zero-exit
- Summary: Executor failed with exit code 1.
- Verification check: [failed] Local claude-code executor result - exitCode=1; stdio=pipe; stdin=promptFile

## Evidence 2026-04-09T01:52:16.548Z

- Agent: claude-code
- Source: executor
- Adapter: claude-code
- Status: passed
- Outcome: passed
- Exit code: 0
- Duration ms: 318419
- Prompt file: .agent-workflow/tasks/T-003/prompt.claude.md
- Run request file: .agent-workflow/tasks/T-003/run-request.claude-code.json
- Launch pack file: .agent-workflow/tasks/T-003/launch.claude-code.md
- Stdout log: .agent-workflow/tasks/T-003/runs/run-1775699218129.stdout.log
- Stderr log: .agent-workflow/tasks/T-003/runs/run-1775699218129.stderr.log
- Scoped files covered: docs/ADAPTERS.md, docs/NEXT_AGENT_HANDOFF.md, .agent-workflow/tasks/T-003/checkpoint.json, .agent-workflow/tasks/T-003/checkpoint.md, .agent-workflow/tasks/T-003/launch.claude-code.md, .agent-workflow/tasks/T-003/prompt.claude.md, .agent-workflow/tasks/T-003/run-request.claude-code.json, .agent-workflow/tasks/T-003/runs/run-1775698767859.json, .agent-workflow/tasks/T-003/runs/run-1775698767859.stderr.log, .agent-workflow/tasks/T-003/runs/run-1775698767859.stdout.log, .agent-workflow/tasks/T-003/runs/run-1775699218129.stderr.log, .agent-workflow/tasks/T-003/runs/run-1775699218129.stdout.log, .agent-workflow/tasks/T-003/task.json, .agent-workflow/adapters/claude-code.json, .agent-workflow/tasks/T-003/context.md, .agent-workflow/tasks/T-003/task.md, .agent-workflow/tasks/T-003/verification.md
- Verification artifacts: .agent-workflow/tasks/T-003/prompt.claude.md, .agent-workflow/tasks/T-003/run-request.claude-code.json, .agent-workflow/tasks/T-003/launch.claude-code.md, .agent-workflow/tasks/T-003/runs/run-1775699218129.stdout.log, .agent-workflow/tasks/T-003/runs/run-1775699218129.stderr.log
- Proof artifacts: .agent-workflow/tasks/T-003/runs/run-1775699218129.stdout.log, .agent-workflow/tasks/T-003/runs/run-1775699218129.stderr.log, .agent-workflow/tasks/T-003/prompt.claude.md, .agent-workflow/tasks/T-003/run-request.claude-code.json, .agent-workflow/tasks/T-003/launch.claude-code.md
- Summary: Executor completed with exit code 0.
- Verification check: [passed] Local claude-code executor result - exitCode=0; stdio=pipe; stdin=promptFile
