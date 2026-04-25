# Changelog

## [0.3.0] - 2024-12-XX - Agent Autonomy

**Major product repositioning**: Agent Workflow Studio is now a **workbench for human-agent collaboration on projects**, not just an AI code trust system.

### Product Vision

This release completes Phase 6 (Agent Autonomy) and repositions the product:

- **Not**: A coding assistant or code review tool
- **But**: A project management system where humans and agents work together
- **Goal**: Enable human-agent collaboration at project scale
- **Scope**: Software projects today, any project tomorrow

See [PRODUCT_VISION.md](docs/PRODUCT_VISION.md) for the full vision.

### New Features

**Human-Agent Collaboration Loop (T-700)**
- Dashboard approval/rejection buttons with feedback
- Rejected tasks automatically create correction tasks
- Approval adds +10 to trust score, rejection adds -20
- Feedback becomes the agent's next instruction

**Cross-Agent Handoff Protocol (T-701)**
- `workflow_handoff` MCP tool: Agent A marks work complete, passes to Agent B
- `workflow_pickup` MCP tool: Agent B claims task with full context
- Handoff records stored in evidence chain
- Dashboard shows handoff history and agent chain

**Task Queue and Claim Mechanism (T-702)**
- `workflow_claim_task` MCP tool: Claim tasks with expiry-backed locks
- `workflow_release_task` MCP tool: Release claimed tasks
- `workflow://queue` MCP resource: Discover claimable tasks
- Claim expiry (default 1 hour) prevents stuck tasks
- Dashboard shows claim status badges

**Orchestrator Daemon (T-703)**
- `npx agent-workflow orchestrate`: Run agents autonomously
- Watches task queue, spawns agent sessions (Claude Code, Codex)
- Supports concurrency control (`--max-concurrent`)
- Graceful shutdown (SIGINT/SIGTERM)
- Cross-platform (Windows, macOS, Linux)
- See [ORCHESTRATOR.md](docs/ORCHESTRATOR.md) for setup

**CI Evidence Pipeline (T-704)**
- `POST /api/webhook/evidence`: Receive CI verification results
- HMAC-SHA256 signature validation (constant-time)
- CI evidence adjusts trust score (passed +5, failed -10)
- GitHub Actions integration example
- See [CI_INTEGRATION.md](docs/CI_INTEGRATION.md) for setup

### Breaking Changes

- **Removed**: `prompt:compile` command (deprecated in 0.2.0)
  - Use MCP resource `workflow://tasks/{taskId}` instead
  - Or use MCP prompt `workflow-resume`

### Documentation

- **NEW**: [PRODUCT_VISION.md](docs/PRODUCT_VISION.md) - Why this exists
- **NEW**: [ORCHESTRATOR.md](docs/ORCHESTRATOR.md) - Run agents autonomously
- **NEW**: [CI_INTEGRATION.md](docs/CI_INTEGRATION.md) - Connect GitHub Actions
- **UPDATED**: [README.md](README.md) - Repositioned as collaboration workbench
- **UPDATED**: [AGENT_GUIDE.md](AGENT_GUIDE.md) - How agents use the workbench
- **UPDATED**: [ROADMAP.md](docs/ROADMAP.md) - Phase 6 complete

### MCP Tools (15 total)

New in 0.3.0:
- `workflow_handoff`: Record cross-agent handoff
- `workflow_pickup`: Claim task and get full context
- `workflow_claim_task`: Claim task with expiry lock
- `workflow_release_task`: Release claimed task

Existing:
- `workflow_quick`: Create task
- `workflow_done`: Mark done and record evidence
- `workflow_task_list`: List all tasks
- `workflow_overview`: Project health snapshot
- `workflow_validate`: Check for issues
- `workflow_record_activity`: Log progress breadcrumb
- `workflow_undo`: Undo last operation
- `workflow_checkpoint`: Refresh checkpoint
- `workflow_append_note`: Add timestamped note
- `workflow_run_add`: Record run with evidence
- `workflow_update_task`: Update task metadata

### MCP Resources (5 total)

New in 0.3.0:
- `workflow://queue`: Claimable tasks sorted by priority

Existing:
- `workflow://overview`: Project health
- `workflow://tasks`: All tasks
- `workflow://tasks/{taskId}`: Task detail
- `workflow://memory/{docName}`: Memory docs

### Status: Experimental

This is a new product category. We're learning with early users.

**What works:**
- Task management and tracking
- Evidence collection and display
- Multi-agent handoff
- Human review and approval
- Autonomous orchestration
- CI integration

**What's experimental:**
- Agent reliability in autonomous mode
- Trust score calibration
- Orchestrator stability over long runs
- Non-coding use cases

**We need your feedback.** Try it, break it, tell us what works and what doesn't.

### Technical

- 45 test files, 215 tests passing
- Node.js 18+ required
- MCP SDK 1.0.3
- Zero runtime dependencies (except MCP SDK)

---

## [0.2.1] - 2024-11-XX

### Fixed

- skills:generate docs inconsistency
- MCP improvements

---

## [0.2.0] - 2024-11-XX - Evidence & MCP

### Added

- Multi-collector evidence system
- MCP resources and prompts
- Agent activity evidence
- Dashboard trust signals
- Deprecated prompt:compile in favor of MCP

---

## [0.1.2] - 2024-10-XX - Foundation

Initial release with task management, evidence tracking, and trust scoring.
