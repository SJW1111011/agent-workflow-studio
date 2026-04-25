# T-703 - Orchestrator Daemon

## Goal

Add `npx agent-workflow orchestrate` command that runs as a daemon, watching the task queue and spawning agent sessions when tasks are available. This enables overnight autonomous work — the orchestrator runs in the background (terminal, tmux, or CI), checks the queue periodically, and starts Claude Code or Codex sessions to work on tasks. The human opens the dashboard in the morning and sees what agents completed.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/cli.js (add orchestrate command)
  - repo path: src/lib/orchestrator.js (new — orchestrator loop logic)
  - repo path: docs/ORCHESTRATOR.md (new — setup guide)
  - repo path: README.md (mention orchestrate command)
  - repo path: AGENT_GUIDE.md (orchestrator workflow)
  - repo path: test/orchestrator.test.js (new)
- Out of scope:
  - repo path: dashboard/ (no dashboard changes)
  - repo path: src/server.js (no API changes)

## Design

### CLI command

```bash
npx agent-workflow orchestrate --root . --agent claude --interval 300
```

Options:
- `--agent <name>`: Agent to spawn (claude, codex, or custom adapter). Default: claude
- `--interval <seconds>`: Check interval in seconds. Default: 300 (5 minutes)
- `--max-concurrent <n>`: Max concurrent agent sessions. Default: 1
- `--stop-when-empty`: Exit when queue is empty. Default: false (run forever)

### Orchestrator loop

```
loop:
  read workflow://queue via MCP
  if queue has tasks:
    task = queue[0] (highest priority)
    spawn agent session with prompt:
      "Read workflow://queue, claim the highest priority task, work on it, record evidence with workflow_done"
    wait for agent session to complete
  else:
    if --stop-when-empty: exit
  sleep interval
```

### Agent spawning

For Claude Code:
```bash
claude --print "Read workflow://queue, claim the highest priority task with workflow_claim_task, work on it, record evidence with workflow_done. When done, check the queue again and continue until empty."
```

For Codex:
```bash
codex exec "Read workflow://queue, claim the highest priority task with workflow_claim_task, work on it, record evidence with workflow_done. When done, check the queue again and continue until empty."
```

The spawned agent:
1. Connects via MCP (already configured)
2. Reads workflow://queue
3. Claims highest priority task
4. Works on it (reads task context, writes code, runs tests)
5. Calls workflow_done to record evidence
6. Checks queue again, repeats until empty
7. Session ends

### Concurrency

With `--max-concurrent 1` (default): sequential — wait for agent to finish before spawning next.

With `--max-concurrent N > 1`: spawn up to N agents in parallel, each claims a different task from the queue.

### Logging

Orchestrator logs to stdout:
- `[orchestrator] Checking queue...`
- `[orchestrator] Found 3 tasks in queue`
- `[orchestrator] Spawning claude session for T-001`
- `[orchestrator] Agent session completed (exit code 0)`
- `[orchestrator] Queue empty, sleeping 300s`

### Signal handling

- SIGINT (Ctrl+C): graceful shutdown — wait for current agent sessions to finish, then exit
- SIGTERM: same as SIGINT

### Error handling

- If agent session exits with non-zero code: log error, continue to next task
- If queue read fails: log error, retry after interval
- If spawn fails: log error, retry after interval

## Deliverables

- `npx agent-workflow orchestrate` CLI command
- `src/lib/orchestrator.js` with loop logic
- Agent spawning for claude and codex
- Concurrency control (--max-concurrent)
- Signal handling (SIGINT/SIGTERM)
- `docs/ORCHESTRATOR.md` setup guide
- `test/orchestrator.test.js`
- All existing tests pass

## Acceptance Criteria

- `npx agent-workflow orchestrate --root . --agent claude` runs and checks queue
- When tasks are available, spawns claude session
- Agent claims task, works on it, records evidence
- Orchestrator continues to next task after agent finishes
- `--stop-when-empty` exits when queue is empty
- SIGINT gracefully shuts down
- `npm test`, `npm run smoke`, `npm run lint` pass

## Risks

- Agent spawning must work on Windows, macOS, Linux — use cross-platform spawn
- Agent session must have MCP configured — orchestrator assumes MCP is already set up
- Long-running orchestrator must handle process crashes — log errors and continue
- Concurrent agents must not claim the same task — claim lock prevents this (T-702)
