# Roadmap - 2026 Long-term Improvement Plan

> **Product vision:** Make AI agent work trustworthy, traceable, and resumable.
> Not task management — trust infrastructure for autonomous coding agents.

> **Execution model:** Codex executes, Claude Code evaluates, suggests, and audits.
> Every phase is managed by agent-workflow-studio itself (dogfooding).

## Guiding Principles

1. **Trust over features.** Every change must make agent work more trustworthy or more resumable. If it doesn't serve trust, traceability, or resumability, it doesn't belong.
2. **Agent-first, human-supervised.** Design for agents as primary executors and humans as supervisors. MCP is the agent's interface, dashboard is the human's interface.
3. **Evidence is automatic.** The ideal state is zero manual evidence collection. Agent work naturally produces evidence; test runners auto-detect; CI results flow back.
4. **Subtraction, not addition.** Every change must reduce user friction. Never add features at the cost of simplicity.
5. **Dogfooding is the only proof.** The improvement process itself must be managed by agent-workflow-studio. If the tool cannot manage its own evolution, it is not ready for others.
6. **Backward compatibility.** The package is already published to npm. Users must not lose data or rewrite workflows on upgrade.

---

## Phase 0 - Infrastructure Modernization (Tech Debt) - COMPLETE

**Completed 2026-04-16.** Tasks T-100 ~ T-103.

| Task | Description |
|------|-------------|
| T-100 | TypeScript migration skeleton: `tsconfig.json`, build pipeline, first module converted |
| T-101 | ESM dual-package: `exports` field in package.json, CJS backward compatibility preserved |
| T-102 | Vitest migration: replace hand-rolled test runner, maintain >= 5% coverage |
| T-103 | CI matrix: GitHub Actions for Node 18/20/22, coverage reporting, automated npm publish |

**Acceptance criteria:**
- `npm test` passes with >= 5% coverage
- Types are exportable (`import type { Task } from 'agent-workflow-studio'`)
- Both ESM and CJS imports work
- CI is green on Node 18, 20, and 22
- ESLint and Prettier are enforced (dev dependencies only)

**Does NOT include:** Any user-facing feature changes.

---

## Phase 1 - Cut the Ceremony (Core Overhaul, Highest User Value) - COMPLETE

**Completed 2026-04-16.** Tasks T-200 ~ T-204.

| Change | Detail |
|--------|--------|
| Lite Mode | `quick --lite` now ships the minimal scaffold (`task.json` + `task.md`) and defers prompt compilation, run prep, and checkpoint creation until later |
| Full Mode | `quick --full` preserves the complete workflow for compliance and power users |
| `quick` rework | T-200 complete: minimal task creation lands first, then prompt/run/checkpoint artifacts materialize on demand |
| Smart defaults | Scope inferred from `git diff`; checks from test exit code; artifacts from changed files |
| `done` command | One step replaces `run:add` + `checkpoint` |
| `undo` command | Roll back the most recent operation |

**Acceptance criteria:**
- Zero-config path: `quick "xxx"` -> write code -> `done` -> valid task record produced
- Full Mode still works identically to current behavior
- No existing `.agent-workflow/` data is lost on upgrade

**Progress note:** T-200 is complete. Lite Mode has shipped behind `quick --lite`, while the default remains Full Mode until the follow-up default flip is proven.

---

## Phase 2 - Real Agent Integration (File Protocol to Integration Platform) - COMPLETE

**Completed 2026-04-16.** Tasks T-300 ~ T-304.

| Change | Detail |
|--------|--------|
| MCP Server mode | Expose core capabilities as MCP tools so Claude Code, Cursor, Windsurf, and other MCP clients can call them |
| Claude Agent SDK adapter | Native integration that replaces the CLI paste workflow |
| Codex API adapter | Real API calls instead of file-based handoff |
| Streaming logs | SSE replaces file polling |
| Bidirectional comms | Agents can update task status and append notes mid-execution |

**Acceptance criteria:**
- From Claude Code, natural language triggers create task -> compile prompt -> execute -> record evidence -> refresh checkpoint in one pipeline
- File protocol remains as the offline/custom fallback
- No vendor lock-in: MCP is an open standard

---

## Phase 3 - Evidence Model Simplification (Make Complexity Invisible) - COMPLETE

**Completed 2026-04-17.** Tasks T-400 ~ T-404.

| Change | Detail |
|--------|--------|
| Unified evidence | Merge weak and strong proof into a single `evidence` concept with a coverage score |
| Fingerprint optional | Proof-anchor fingerprinting becomes `--strict` opt-in instead of the default |
| Auto-extraction | `git diff` -> paths, test output -> checks, exit code -> pass/fail |
| Coverage bar | Verification gate becomes a coverage percentage instead of a gate list |
| Compliance mode | `--strict` preserves the current strictness for audit scenarios |

**Acceptance criteria:**
- New users can complete the workflow without learning proof/anchor/gate terminology
- `--strict` users get stronger evidence than the current default
- Existing `.agent-workflow/` data migrates transparently

---

## Phase 4 - Dashboard Rebuild - COMPLETE

**Completed 2026-04-18.** Tasks T-500 ~ T-504.

| Task | Description |
|------|-------------|
| T-500 | Vite + Preact scaffold: build pipeline, dev server, 5-tab component shell |
| T-501 | Component migration: convert 11 render-helpers to Preact JSX with hooks state |
| T-502 | SSE real-time updates: replace 900ms polling with EventSource subscriptions |
| T-503 | Dark mode + responsive: system theme detection, mobile layout, Lighthouse 98/100/100/100 |
| T-504 | Multi-task views: kanban board and timeline alongside existing list |

**Acceptance criteria:**
- Agent execution state updates without page refresh
- Lighthouse score >= 90 (achieved 98/100/100/100)
- Works on mobile viewports

---

## Phase 5 - Agent-Native Evidence - COMPLETE

**Completed 2026-04-22.** Tasks T-600 ~ T-606.

**Goal:** Make evidence automatic, make agents first-class MCP citizens, make trust quantifiable.

| Task | Description |
|------|-------------|
| T-600 | Evidence collector plugin system: pluggable registry with npm/pytest/cargo/go built-ins |
| T-601 | MCP resources and prompts: expose workflow state as resources, replace prompt:compile |
| T-602 | Smart defaults v2: multi-collector integration into done/run-add flow |
| T-603 | Agent activity evidence: structured evidence from MCP tool calls |
| T-604 | Dashboard trust surface: trust score, freshness heatmap, evidence timeline |
| T-605 | Deprecate prompt:compile; revive skills:generate with MCP-first workflow rules |
| T-606 | Version bump to 0.2.0 |

**Progress note:** T-606 is complete. Phase 5 now ships multi-collector evidence, MCP resources and prompts, agent activity evidence, dashboard trust signals, and the `prompt:compile` / `skills:generate` deprecation path together in the `0.2.0` package line.

| Change | Detail |
|--------|--------|
| Evidence collectors | Pluggable registry replaces hardcoded npm-test; auto-detects pytest, cargo, go |
| MCP resources | Agents pull task/evidence/memory data as structured resources |
| MCP prompts | workflow-resume replaces prompt:compile with no truncation |
| Agent activity | Agents report what they did as structured evidence through MCP |
| Trust score | Deterministic 0-100 score from evidence coverage, freshness, collector diversity |
| Deprecations | prompt:compile deprecated in favor of MCP resources/prompts |

**Acceptance criteria:**
- Evidence auto-collected from multiple test runners without configuration
- MCP resources and prompts listable and readable by any MCP client
- Trust score visible in dashboard for all tasks
- Backward compatible with 0.1.2 .agent-workflow/ data

---

## Phase 6 - Agent Autonomy - COMPLETE ✅

**Goal:** Close the loop — agents pick up tasks, work autonomously, humans supervise through the dashboard.

This is the phase that transforms the product from "a tool humans use to manage agent work" into "a platform where agents work and humans supervise." After Phase 6, the vision described in the product direction becomes real.

| Task | Status | Description |
|------|--------|-------------|
| T-700 | ✅ | Dashboard approval loop: approve/reject buttons, feedback, correction task creation |
| T-701 | ✅ | Cross-agent handoff protocol: workflow_handoff + workflow_pickup MCP tools |
| T-702 | ✅ | Task queue + claim: workflow_claim_task, workflow_release_task, workflow://queue resource |
| T-703 | ✅ | Orchestrator: `npx agent-workflow orchestrate` daemon that spawns agent sessions from the queue |
| T-704 | ✅ | CI evidence pipeline: webhook endpoint for GitHub Actions and external evidence sources |

| Change | Detail |
|--------|--------|
| Dashboard approval | Approve/reject agent work, leave feedback that becomes the agent's next instruction |
| Cross-agent handoff | Structured handoff tools: Agent A marks "done to here" → Agent B picks up → evidence chain unbroken |
| Task queue + claim | Agents discover and claim tasks via MCP; claim locks prevent double-assignment |
| Orchestrator | Persistent process that watches the queue and spawns agent sessions (claude/codex) automatically |
| CI evidence pipeline | Webhook receiver for GitHub Actions test results, coverage, and deploy status |

**Acceptance criteria:** ✅ All met
- Human can approve/reject from dashboard; rejection creates a follow-up task for the agent
- Agent B can resume Agent A's work using the handoff protocol with no context loss
- Agent can discover, claim, and complete a task via MCP without human intervention
- `npx agent-workflow orchestrate` runs as a daemon, spawning agent sessions when tasks are available
- CI test results from GitHub Actions appear as evidence on the corresponding task

**Why this phase matters:**
The product vision is "developer opens dashboard in the morning, sees what agents completed overnight." Phase 5 gives agents the ability to produce evidence automatically. Phase 6 gives them the ability to work autonomously — the orchestrator spawns agent sessions from the queue, agents claim and complete tasks, humans supervise through the dashboard's approval loop.

**Release: 0.3.0** after Phase 6 completes. Remove deprecated prompt:compile.

---

## Phase 7 - Ecosystem

**Goal:** External users can self-onboard, contribute, and extend.

| Deliverable | Detail |
|-------------|--------|
| VitePress doc site | Replace the README-driven docs stack with searchable, versioned documentation |
| Cookbook | 10+ real-world scenarios (refactor, bugfix, audit, migration, new feature, and more) |
| Template library | Pre-configured setups for React, Python, Rust, and Go projects |
| Community | GitHub Discussions or Discord for user support and feedback |

**Acceptance criteria:**
- npm weekly downloads trend upward
- >= 1k GitHub stars
- >= 20 external contributors

---

## Phase 8 - Advanced Exploration (No Timeline Commitment)

These are directions that become possible after the core product is solid. No commitment to timeline or order.

| Direction | Detail |
|-----------|--------|
| Multi-agent orchestration | Planner + executor + reviewer roles with structured coordination protocol |
| Team mode | Optional cloud backend for cross-member task assignment, review, and shared dashboards |
| Remote execution | Containers or SSH sandboxes for isolated agent execution with evidence capture |
| AI-assisted decomposition | High-level goal → sub-task tree, with dependency inference and parallel execution planning |
| Trust analytics | Historical trust trends, agent reliability scores, evidence quality over time |
| Compliance export | Generate audit reports from evidence trails for SOC2, ISO, or internal compliance |

---

## Phase Dependency Graph

```text
Phase 0 (Infra) ──> Phase 1 (Cut ceremony) ──> Phase 3 (Evidence simplification)
                 \                           \
                  \                           ──> Phase 2 (Agent integration) ──> Phase 4 (Dashboard) ──> Phase 5 (Agent-native evidence) ──> Phase 6 (Agent autonomy) ──> Phase 7 (Ecosystem)
                   \
                    ──> Phase 8 (Explore)
```

Phase 5 depends on Phase 4 (dashboard) and Phase 2 (MCP). Phase 6 depends on Phase 5 (evidence automation is prerequisite for autonomy). Phase 7 can start in parallel with Phase 6 once the core product is stable.

---

## How Users Work with Agent Workflow Studio

### Today (Phase 5)

Most users follow the **fast path**: create a task, do the work, record what happened.

```text
MCP or CLI: quick --lite "title"
        -> do the work (write code, run tests, etc.)
        -> MCP or CLI: done "summary" --complete
```

MCP tools (`workflow_quick`, `workflow_done`, etc.) are the recommended integration for editor users. The CLI is the fallback for terminal users. Evidence collectors auto-detect test runners. MCP resources and prompts provide structured context for agent handoffs.

### Future (after Phase 6)

The human becomes a supervisor, not a driver.

```text
Developer opens dashboard in the morning
  -> sees 3 tasks completed overnight by agents
  -> reviews evidence: what changed, what was tested, trust score
  -> approves 2 tasks, rejects 1 with feedback
  -> creates 2 new tasks, sets priority
  -> agents auto-claim tasks from the queue
  -> developer writes their own code
  -> checks dashboard in the afternoon — agents completed 2 more
```

The key shift: agents work autonomously within the trust framework. Evidence is automatic. Checkpoints survive session breaks. The dashboard is the control plane where humans maintain oversight without micromanaging execution.

## How We Build This Project

This project itself uses a stricter workflow because we are building the tool with the tool (dogfooding). This is a **power-user pattern**, not the expected user workflow:

```text
Claude Code creates task (task.md / context.md / verification.md)
        -> Claude Code compiles prompt
        -> Codex executes -> records evidence
        -> Claude Code triple review:
           - Code review: diff within scope, quality, bugs
           - Evidence review: evidence authentic, complete, not fabricated
           - Architecture review: aligned with phase goals and guiding principles
        -> Pass -> refresh checkpoint
        -> Fail -> create correction task for Codex
```

This loop has now produced task-by-task dogfooding from T-100 through T-606, with each scoped change reviewed against `.agent-workflow/review-checklist.md`. The MCP integration (Phase 2) now makes it possible to run parts of this loop from inside Claude Code without switching to a terminal.

---

## Key Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Break existing npm users | 0.x -> 1.0 migration guide; Lite Mode stays additive while old behavior is preserved |
| MCP vendor lock-in | MCP is open; file protocol remains as the fallback |
| Over-simplification loses power users | Full and Strict modes preserve the stronger workflow paths |
| Agent autonomy safety | Approval loop is mandatory by default; auto-approve is opt-in for trusted workflows |
| CI webhook security | Webhook receiver validates signatures; evidence is append-only |
| Codex execution drift | Clear acceptance criteria per phase plus Claude Code review gates |
| Phase timelines slip | Each phase should ship independently with measurable user value |

---

## Legacy Roadmap (Pre-2026)

The original roadmap phases (Foundation, Stronger prompt compiler, Verification layer, Multi-agent orchestration, External integrations, and Polish) have been completed or absorbed into this plan. The verification layer work is now captured by Phase 3's `--strict` mode. Multi-agent orchestration moves to Phase 8. The prompt compiler is deprecated in Phase 5 in favor of MCP resources and prompts.
