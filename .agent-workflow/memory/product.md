# Product Memory

## Product truth

**Agent Workflow Studio is a workbench for human-agent collaboration on projects.**

Core truths:
- This is not a coding assistant. It's a project management system where humans and agents work together.
- The unit is tasks and deliverables, not files and functions. The goal is shipping products, not writing code.
- Work leaves a trail. Evidence serves two purposes: trust for humans, context for agents.
- Agents are team members, not tools. They claim tasks, produce work, hand off to others.
- Humans are project leads, not users. They manage, review, approve, and decide.
- The workbench model works for any project. Code is just the first domain.

Verification principles:
- Evidence must never be faked or silently inferred from vibes.
- Proof freshness, run evidence, and checkpoint state must be real and traceable.
- Trust scores are signals, not guarantees. They help humans decide, not replace human judgment.

## Current constraints

**Technical:**
- Zero-dependency Node.js (except MCP SDK)
- Local-only execution, no cloud dependency
- Repo-relative durable artifacts
- No absolute paths in workflow state
- No hidden database outside the repository
- Git-native storage

**Product:**
- Support MCP-compatible agents (Claude Code, Codex, custom)
- Preserve contract-first schemas for stability
- Keep onboarding simple without becoming a generic chat shell
- Maintain local-first, git-native architecture

**Scope:**
- Current focus: Software projects
- Future expansion: Any project with tasks and deliverables
- Experimental status: Learning with early users

## Open questions

**Product direction:**
- How do we validate the workbench model with real users?
- What's the right balance between autonomy and supervision?
- How do we expand beyond coding projects?

**Technical:**
- How much of this repository's own `.agent-workflow/` state should stay committed as dogfooding expands?
- What level of orchestrator stability is needed for production use?
- How do we handle agent failures gracefully in autonomous mode?

**Go-to-market:**
- Who are the early adopters? (Developers experimenting with agents? Teams scaling agent usage?)
- What's the killer use case that proves the value?
- How do we communicate "workbench" vs "assistant"?

## Product evolution

**Phase 1 (0.1.x - 0.2.x): Foundation**
- Built task management, evidence tracking, trust scoring
- Established local-first, git-native architecture
- Proved the technical feasibility

**Phase 2 (0.3.x): Workbench**
- Added human-agent collaboration loop (approval, rejection, feedback)
- Added multi-agent handoff protocol
- Added autonomous orchestration
- **Repositioned as collaboration workbench**

**Phase 3 (0.4.x+): Refinement**
- Improve workbench UX
- Validate with real users
- Expand agent integrations
- Stabilize autonomous mode

**Phase 4 (0.5.x+): Expansion**
- Extend beyond coding projects
- Support more domains (content, data, operations)
- Build domain-specific templates
- Prove the universal workbench model

