# Agent Workflow Studio

<p align="center">
  <a href="https://www.npmjs.com/package/agent-workflow-studio"><img src="https://img.shields.io/npm/v/agent-workflow-studio?style=for-the-badge" alt="npm version"></a>
  <a href="https://github.com/SJW1111011/agent-workflow-studio/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/SJW1111011/agent-workflow-studio/ci.yml?branch=main&style=for-the-badge&label=CI" alt="CI"></a>
  <a href="https://codecov.io/gh/SJW1111011/agent-workflow-studio"><img src="https://codecov.io/gh/SJW1111011/agent-workflow-studio/graph/badge.svg" alt="Coverage"></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge" alt="MIT license"></a>
  <a href="https://nodejs.org"><img src="https://img.shields.io/badge/node-%3E%3D18-brightgreen?style=for-the-badge" alt="Node 18+"></a>
  <img src="https://img.shields.io/badge/status-experimental-orange?style=for-the-badge" alt="Experimental">
</p>

**A workbench for human-agent collaboration on projects.**

Not an AI coding assistant. A project management system where humans and agents work together to ship products.

---

## What is this?

Agent Workflow Studio is a **collaboration workbench** that lets humans and AI agents work together on projects — not just code, but any project with tasks, deliverables, and quality requirements.

**Think of it as:**
- Jira for human-agent teams
- GitHub Actions for agent orchestration
- A shared workspace where work is visible, traceable, and handoff-ready

**Not:**
- A better autocomplete
- A chat interface for code
- A code review tool

## Why does this exist?

Current AI tools (Cursor, Claude Code, Codex) are **code assistants** — they help you write code in the moment. But when you want to:

- **Manage a project** with multiple tasks
- **Collaborate with multiple agents** over days or weeks
- **Hand off work** between agents or sessions
- **Track progress** and quality across the project
- **Run agents autonomously** overnight

...you need a **workbench**, not an assistant.

Agent Workflow Studio is that workbench.

## Core capabilities

### 1. Project-level management

Tasks, not files. Deliverables, not functions. Progress tracking, not just code completion.

```bash
# Create a task
npx agent-workflow quick "Add user authentication" --root .

# Agent works on it, records evidence
# (via MCP tools or CLI)

# View progress in dashboard
npx agent-workflow dashboard --root .
```

### 2. Work leaves a trail

Every agent action creates evidence: what changed, what was tested, what was verified. This evidence serves two purposes:

- **For humans**: Trust, auditability, decision-making
- **For agents**: Context, handoff documents, knowledge base

### 3. Multi-agent collaboration

Agents can hand off work to each other with full context. No information loss.

```javascript
// Agent A finishes part of the work
workflow_handoff({
  taskId: "T-001",
  summary: "Completed database schema",
  remaining: "Need to update ORM models"
})

// Agent B picks up where A left off
workflow_pickup({
  taskId: "T-001",
  agent: "codex"
})
// Returns: full context, checkpoint, evidence so far
```

### 4. Human-agent collaboration loop

Humans review agent work, approve or reject with feedback. Rejections create correction tasks automatically.

Dashboard → Review task → Approve (trust +10) or Reject with feedback → Agent continues

### 5. Autonomous execution

Run agents overnight. The orchestrator watches the task queue and spawns agent sessions automatically.

```bash
# Start the orchestrator
npx agent-workflow orchestrate --agent claude --root .

# Go to sleep
# Wake up, open dashboard, see what agents completed
```

## Quick start

### Install

```bash
npm install agent-workflow-studio
cd your-project
npx agent-workflow init --root .
npx agent-workflow scan --root .
```

### Option 1: Use with MCP (Claude Code, Codex, Cursor)

```bash
npx agent-workflow mcp:install --client claude --root .
```

Then in your editor:

```
"Create a task called 'Add authentication'"
"Work on T-001 and record evidence when done"
```

### Option 2: Use from CLI

```bash
# Create task
npx agent-workflow quick "Add authentication" --lite --root .

# Work on it (manually or with agent)
# ...

# Record evidence
npx agent-workflow done T-001 "Completed auth flow" --complete --root .
```

### Option 3: Run autonomously

```bash
# Create tasks
npx agent-workflow quick "Task 1" --root .
npx agent-workflow quick "Task 2" --root .

# Start orchestrator (spawns agents to work on tasks)
npx agent-workflow orchestrate --agent claude --root .

# Open dashboard to monitor
npx agent-workflow dashboard --root .
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Dashboard (Web UI)                   │
│              Review · Approve · Monitor Progress         │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────┐
│                  Orchestrator (Daemon)                   │
│         Watches queue · Spawns agents · Manages work     │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────┐
│                    Task Queue (MCP)                      │
│           Claimable tasks · Priority sorting             │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────┐
│              Agents (Claude Code, Codex, etc)            │
│      Claim tasks · Do work · Record evidence · Handoff   │
└─────────────────────────────────────────────────────────┘
                            ▲
                            │
┌─────────────────────────────────────────────────────────┐
│                  Evidence Chain (Local)                  │
│        Git diffs · Test results · CI status · Proofs     │
└─────────────────────────────────────────────────────────┘
```

## Key concepts

### Tasks

The unit of work. Has a goal, scope, verification criteria, and evidence.

### Evidence

What happened during the work. Git diffs, test results, manual proofs, CI status. Stored locally, append-only.

### Trust score

Quality signal derived from evidence coverage, verification status, human review, and CI results. Helps humans decide what to approve.

### Checkpoint

Snapshot of task state for resuming work. Includes context, progress, and next steps.

### Handoff

Structured way for agents to pass work to each other. Includes summary, remaining work, and full context.

### Orchestrator

Daemon that watches the task queue and spawns agent sessions automatically. Enables overnight autonomous work.

## Use cases

### Today: Software projects

- Multi-task feature development
- Refactoring with verification
- Bug fixes with evidence
- Overnight agent work

### Tomorrow: Beyond code

The workbench model works for any project:

- **Content creation**: Tasks = articles, agents = writers/editors
- **Data analysis**: Tasks = analyses, agents = data scientists
- **Business operations**: Tasks = processes, agents = operators

The architecture is project-agnostic. Code is just the first domain.

## Status: Experimental

This is a new product category. We're figuring it out with early users.

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

## Documentation

- [Product Vision](docs/PRODUCT_VISION.md) - Why this exists
- [MCP Setup](docs/MCP_SETUP.md) - Connect your agents
- [Orchestrator Guide](docs/ORCHESTRATOR.md) - Run agents autonomously
- [CI Integration](docs/CI_INTEGRATION.md) - Connect GitHub Actions
- [Agent Guide](AGENT_GUIDE.md) - How agents use the workbench
- [Roadmap](docs/ROADMAP.md) - What's next

## Requirements

- Node.js 18+
- Git repository
- MCP-compatible agent (Claude Code, Codex) or CLI usage

## License

MIT

## Contributing

This is experimental. We're learning what works. If you have ideas or feedback, open an issue or PR.

---

**Agent Workflow Studio** — Where humans and agents build together.
