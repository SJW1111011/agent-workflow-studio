# Orchestrator

`agent-workflow orchestrate` runs a local daemon that watches `workflow://queue` and starts non-interactive agent sessions when claimable tasks are available.

It is designed for overnight or background work: start it in a terminal, tmux session, or CI job, then review completed tasks and evidence in the dashboard later.

## Setup

Install the MCP server for the agent you want to spawn. The orchestrator assumes the child agent can already read `workflow://queue` and call `workflow_claim_task` / `workflow_done`.

```bash
npx agent-workflow mcp:install --client claude --root .
npx agent-workflow mcp:install --client codex --root .
```

Start the daemon:

```bash
npx agent-workflow orchestrate --root . --agent claude --interval 300
```

For Codex:

```bash
npx agent-workflow orchestrate --root . --agent codex --interval 300
```

## Options

| Option | Default | Description |
| --- | --- | --- |
| `--agent <name>` | `claude` | Built-in agents are `claude` and `codex`. Unknown names are launched as commands that receive the prompt as their first argument. |
| `--agent-command "<command>"` | none | Custom command template. Include `{prompt}` where the orchestrator prompt should be inserted. If omitted, the prompt is appended. |
| `--interval <seconds>` | `300` | Queue polling interval. |
| `--max-concurrent <n>` | `1` | Maximum active child agent sessions. |
| `--stop-when-empty` | `false` | Exit instead of sleeping when the queue is empty and no sessions are active. |
| `--root <path>` | current directory | Target repository that contains `.agent-workflow/`. |

## What It Spawns

Claude Code:

```bash
claude --print "<orchestrator prompt>"
```

Codex:

```bash
codex exec "<orchestrator prompt>"
```

Custom command:

```bash
npx agent-workflow orchestrate --agent custom --agent-command "custom-agent run --prompt {prompt}" --root .
```

The prompt tells the child agent to read `workflow://queue`, claim the highest-priority task with `workflow_claim_task`, do the work, record evidence with `workflow_done`, then check the queue again until it is empty.

## Loop Behavior

1. Read `workflow://queue`.
2. If tasks are available, spawn up to `--max-concurrent` agent sessions.
3. Each child agent claims work through MCP. Claim locks prevent duplicate assignment.
4. Agent stdout and stderr are prefixed and streamed through the orchestrator logs.
5. Non-zero child exits are logged, then the daemon keeps polling.
6. If the queue is empty, sleep for `--interval` seconds unless `--stop-when-empty` is set.

## Graceful Shutdown

Press `Ctrl+C` or send `SIGTERM` to request shutdown. The orchestrator stops launching new sessions, waits for active child sessions to finish, then exits.

If a child agent needs to stop before completing a task, it should call `workflow_handoff` so another session can continue from the latest checkpoint.

## Operational Notes

- Keep `--max-concurrent 1` until your tasks and agents are comfortable with parallel edits.
- Use `--stop-when-empty` for CI or scheduled jobs that should exit cleanly.
- Use tmux, a terminal multiplexer, or your process supervisor of choice for overnight local runs.
- The orchestrator does not replace evidence. Work is only visible as complete after the child agent records `workflow_done`.
- The dashboard remains the supervision surface; no dashboard changes are required to use this command.

## Troubleshooting

- If a session fails to launch, confirm `claude` or `codex` is on `PATH`.
- If the child agent cannot see workflow tools, rerun `mcp:install` for that client and restart the agent CLI.
- If the same task appears to be skipped, check whether it is actively claimed or whether the claim expiry has not elapsed yet.
- If the daemon appears idle, run `npx agent-workflow task:list --root .` and confirm at least one task is `todo` or unclaimed `in_progress`.
