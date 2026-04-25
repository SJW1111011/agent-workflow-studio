# T-703 Context

## Why now

T-700 (approval), T-701 (handoff), T-702 (queue + claim) are complete. The infrastructure is ready. Now we need the orchestrator — the component that actually spawns agent sessions from the queue. Without it, agents still need humans to start them. With it, the product vision becomes real: "developer opens dashboard in the morning, sees what agents completed overnight."

This is the fourth task in Phase 6 and the most critical — it's the piece that enables true autonomous work.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Claude Code CLI: `claude --print "prompt"` runs non-interactively, exits when done
- Codex CLI: `codex exec "prompt"` runs non-interactively, exits when done
- Both support MCP when configured (via mcp:install)
- workflow://queue resource returns claimable tasks (from T-702)
- workflow_claim_task prevents double-assignment (from T-702)
- Node.js `child_process.spawn` works cross-platform
- Orchestrator should be a long-running process (daemon-like)
- Current CLI commands: init, scan, quick, done, task:list, run:add, run:execute, checkpoint, validate, memory:bootstrap, mcp:install, mcp:serve, skills:generate, undo, dashboard:serve

## Open questions

- Should orchestrator support custom agent commands? Leaning yes — allow `--agent-command "custom-agent {prompt}"` for flexibility.
- Should orchestrator log agent output? Leaning yes — pipe agent stdout/stderr to orchestrator log with prefix.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
- Must not break any existing CLI, API, MCP, or test behavior
- Must pass `npm test`, `npm run lint`, `npm run smoke`
- Must work on Windows, macOS, Linux
- Must handle agent crashes gracefully — log error and continue
- Must support graceful shutdown (SIGINT/SIGTERM)
