# Product Vision

## The Big Idea

**Agent Workflow Studio is a workbench for human-agent collaboration on projects.**

Not a coding assistant. Not a chatbot. A **collaboration platform** where humans and AI agents work together to ship products.

## The Problem

AI agents are getting capable. They can write code, analyze data, create content. But there's no good way to **work with them on projects**.

Current tools (Cursor, Claude Code, Codex) are **assistants** — they help in the moment, then forget. They're great for:
- Writing a function
- Fixing a bug
- Explaining code

But they fail when you need to:
- **Manage a project** with multiple tasks over days or weeks
- **Collaborate with multiple agents** on different parts of the work
- **Hand off work** between agents or sessions without losing context
- **Track progress and quality** across the entire project
- **Run agents autonomously** while you sleep

**There's no workbench. No shared workspace. No project management system designed for human-agent teams.**

That's what we're building.

## The Vision

### Phase 1: Software projects (now)

Developers use Agent Workflow Studio to manage software projects with AI agents:

1. **Morning**: Create tasks for the day
2. **Daytime**: Work with agents, review their output, approve or reject
3. **Evening**: Start the orchestrator, go home
4. **Night**: Agents work autonomously on the task queue
5. **Next morning**: Open dashboard, see what agents completed, review and approve

The workbench provides:
- Task management
- Evidence tracking
- Quality assessment
- Human review loop
- Agent orchestration
- Work handoff between agents

### Phase 2: Beyond code (future)

The same workbench model works for **any project**:

**Content creation:**
- Tasks = articles, videos, social posts
- Agents = writers, editors, designers
- Evidence = drafts, revisions, feedback
- Human role = editorial review, approval

**Data analysis:**
- Tasks = analyses, reports, visualizations
- Agents = data scientists, analysts
- Evidence = notebooks, results, validations
- Human role = interpret findings, decide actions

**Business operations:**
- Tasks = processes, workflows, decisions
- Agents = operators, coordinators
- Evidence = execution logs, outcomes
- Human role = strategic oversight, exceptions

**Company management:**
- Tasks = initiatives, projects, goals
- Agents = functional specialists
- Evidence = progress reports, metrics
- Human role = leadership, direction

The architecture is **project-agnostic**. Code is just the first domain.

## Core Principles

### 1. Project-level, not code-level

The unit is **tasks and deliverables**, not files and functions.

The goal is **shipping products**, not writing code.

Code is an implementation detail.

### 2. Collaboration, not assistance

Agents are **team members**, not tools.

They have tasks, produce work, hand off to others, and improve over time.

Humans are **project leads**, not users. They manage, review, and decide.

### 3. Work leaves a trail

Every action creates evidence. This serves two purposes:

**For humans:**
- Trust: Can I rely on this work?
- Auditability: What happened and why?
- Decision-making: Should I approve this?

**For agents:**
- Context: What's been done so far?
- Handoff: What should I do next?
- Knowledge: What have we learned?

Evidence is the **shared memory** of the human-agent team.

### 4. Autonomous but supervised

Agents can work independently, but humans stay in control.

The orchestrator runs agents autonomously. The dashboard shows what they did. Humans review and approve.

**Autonomy without supervision = chaos**
**Supervision without autonomy = bottleneck**
**Both together = productive collaboration**

### 5. Local-first, git-native

All data lives in your repository. No cloud dependency. No vendor lock-in.

Evidence is stored as files. Tasks are directories. Everything is version-controlled.

You own your data. You control your workflow.

## What Makes This Different

### vs. Cursor / Claude Code / Codex

| Them | Us |
|------|-----|
| Code assistant | Project workbench |
| Single session | Multi-session, multi-day |
| One agent | Multiple agents |
| No persistence | Full evidence chain |
| No project management | Task tracking, progress monitoring |
| No autonomy | Orchestrated autonomous work |

### vs. Jira / Linear / Asana

| Them | Us |
|------|-----|
| Human task management | Human-agent task management |
| Manual execution | Agent execution |
| No evidence | Automatic evidence collection |
| No quality signals | Trust scores from evidence |
| No handoff protocol | Structured agent handoff |

### vs. GitHub Actions / CI/CD

| Them | Us |
|------|-----|
| Automation scripts | Agent orchestration |
| Fixed workflows | Adaptive agents |
| No project context | Full project awareness |
| No human review loop | Integrated approval workflow |

**We're not competing with these tools. We're creating a new category.**

## Success Metrics

### For users

**Time to value:**
- How fast can you start a project with agents?
- How quickly do agents complete tasks?

**Collaboration quality:**
- How smoothly do agents hand off work?
- How often do humans need to intervene?
- How much context is lost between sessions?

**Trust and confidence:**
- Do humans trust agent work?
- Do they approve without extensive review?
- Do they feel in control?

### For the product

**Adoption:**
- How many projects use the workbench?
- How many tasks are created?
- How many agents are orchestrated?

**Engagement:**
- How often do users return?
- How long do projects run?
- How many agents collaborate on a project?

**Expansion:**
- Do users expand beyond coding projects?
- Do they use it for other domains?
- Do they build custom workflows?

## Roadmap

### 0.3.0 (now) - Foundation

- Task management
- Evidence tracking
- Multi-agent handoff
- Human review loop
- Autonomous orchestration
- CI integration

**Status: Experimental**
**Domain: Software projects**

### 0.4.0 - Workbench refinement

- Better task visualization
- Real-time progress updates
- Richer collaboration modes
- Improved orchestrator stability
- More agent integrations

**Status: Beta**
**Domain: Software projects**

### 0.5.0 - Beyond code

- Project templates for non-coding domains
- Custom evidence types
- Domain-specific trust signals
- Flexible task models

**Status: Production-ready**
**Domain: Multi-domain**

### 1.0.0 - Platform

- Plugin system for custom agents
- Marketplace for workflows
- Team collaboration features
- Enterprise deployment options

**Status: Platform**
**Domain: Universal**

## Why Now?

**AI agents are getting capable enough** to do real work, not just assist.

**But there's no infrastructure** for human-agent collaboration at project scale.

**We're building that infrastructure.**

The timing is right. The need is real. The opportunity is massive.

## Join Us

This is experimental. We're figuring it out with early users.

If you believe in human-agent collaboration, try Agent Workflow Studio. Break it. Tell us what works and what doesn't.

Together, we'll build the workbench for the future of work.

---

**Agent Workflow Studio** — Where humans and agents build together.
