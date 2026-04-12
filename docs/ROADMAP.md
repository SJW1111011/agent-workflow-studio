# Roadmap — 2026 Long-term Improvement Plan

> **Execution model:** Codex executes, Claude Code evaluates, suggests, and audits.
> Every phase is managed by agent-workflow-studio itself (dogfooding).

## Guiding Principles

1. **Subtraction, not addition.** Every change must reduce user friction. Never add features at the cost of simplicity.
2. **Dogfooding is the only proof.** The improvement process itself must be managed by agent-workflow-studio. If the tool can't manage its own evolution, it's not ready for others.
3. **Backward compatibility.** Already published to npm. Users must not lose data or rewrite workflows on upgrade.

---

## Phase 0 — Infrastructure Modernization (Tech Debt)

**Goal:** Establish a healthy engineering foundation for all subsequent work.

| Task | Description |
|------|-------------|
| T-100 | TypeScript migration skeleton — `tsconfig.json`, build pipeline, first module converted |
| T-101 | ESM dual-package — `exports` field in package.json, CJS backward-compat preserved |
| T-102 | Vitest migration — replace hand-rolled test runner, maintain ≥85% coverage |
| T-103 | CI matrix — GitHub Actions for Node 18/20/22, coverage reporting, automated npm publish |

**Acceptance criteria:**
- `npm test` passes with ≥85% coverage
- Types are exportable (`import type { Task } from 'agent-workflow-studio'`)
- Both ESM and CJS imports work
- CI is green on Node 18, 20, 22
- ESLint + Prettier enforced (devDeps only)

**Does NOT include:** Any user-facing feature changes.

---

## Phase 1 — Cut the Ceremony (Core Overhaul, Highest User Value)

**Goal:** 90% of daily tasks can be recorded in 30 seconds, not 5 minutes.

| Change | Detail |
|--------|--------|
| Lite Mode (default) | Record summary + git diff only; verification/context/checkpoint lazily created on demand |
| Full Mode (opt-in) | Current complete workflow, preserved for compliance and power users |
| `quick` rework | Generates minimal set: task.md with title + goal line only |
| Smart defaults | Scope inferred from `git diff`; checks from test exit code; artifacts from changed files |
| `done` command | One step replaces `run:add` + `checkpoint` |
| `undo` command | Roll back most recent operation |

**Acceptance criteria:**
- Zero-config path: `quick "xxx"` → write code → `done` → valid task record produced
- Full Mode still works identically to current behavior
- No existing `.agent-workflow/` data is lost on upgrade

---

## Phase 2 — Real Agent Integration (File Protocol → Integration Platform)

**Goal:** Users say "create a task for X" inside Claude Code and the full pipeline runs automatically.

| Change | Detail |
|--------|--------|
| MCP Server mode | Expose core capabilities as MCP tools; any MCP client (Claude Code, Cursor, Windsurf) can call them |
| Claude Agent SDK adapter | Native integration, replaces CLI paste workflow |
| Codex API adapter | Same — real API calls, not file-based handoff |
| Streaming logs | SSE replaces file polling |
| Bidirectional comms | Agent can update task status and append notes mid-execution |

**Acceptance criteria:**
- From Claude Code, natural language triggers: create task → compile prompt → execute → record evidence → refresh checkpoint — full pipeline
- File protocol preserved as fallback for offline/custom setups
- No vendor lock-in: MCP is an open standard

---

## Phase 3 — Evidence Model Simplification (Make Complexity Invisible)

**Goal:** New users never need to learn "proof anchor" to use the tool effectively.

| Change | Detail |
|--------|--------|
| Unified evidence | Merge weak/strong proof → single `evidence` concept with coverage score |
| Fingerprint optional | Proof anchor fingerprinting becomes `--strict` opt-in, not default |
| Auto-extraction | `git diff` → paths; test output → checks; exit code → pass/fail |
| Coverage bar | Verification gate simplified to a coverage percentage, not a gate list |
| Compliance mode | `--strict` flag preserves all current strictness for audit scenarios |

**Acceptance criteria:**
- New users achieve full workflow without learning proof/anchor/gate terminology
- `--strict` users get stronger evidence than current default
- Existing `.agent-workflow/` data migrated transparently

---

## Phase 4 — Dashboard Rebuild

**Goal:** From demo page to real control plane.

| Change | Detail |
|--------|--------|
| Preact + Vite | Component model + fast builds, small bundle |
| Real-time updates | SSE/WebSocket — no manual refresh needed |
| Multi-task views | Kanban, Gantt, timeline |
| Live log stream | Watch agent execution output in real time |
| Responsive + Dark mode | Mobile-friendly, system theme support |

**Acceptance criteria:**
- Agent execution state updates without page refresh
- Lighthouse score ≥90
- Works on mobile viewport

---

## Phase 5 — Ecosystem

**Goal:** External users can self-onboard, contribute, and extend.

| Deliverable | Detail |
|-------------|--------|
| VitePress doc site | Replace README-driven docs |
| Cookbook | 10+ real-world scenarios (refactor, bugfix, audit, migration, new feature, ...) |
| Plugin system | Third-party recipes, adapters, evidence collectors |
| Template library | Pre-configured setups for React, Python, Rust, Go projects |
| Video demos | 2–3 minute walkthroughs of core value propositions |
| Community | GitHub Discussions or Discord |

**Acceptance criteria:**
- npm weekly downloads trending up
- ≥1k GitHub stars
- ≥5 external contributors

---

## Phase 6 — Advanced Exploration (No Timeline Commitment)

- Multi-agent orchestration (planner + executor + reviewer roles)
- Team mode (optional cloud backend, cross-member task assignment and review)
- Remote execution (container/SSH sandbox)
- AI-assisted task decomposition (high-level goal → sub-task tree)

---

## Phase Dependency Graph

```
Phase 0 (Infra) ──┬──> Phase 1 (Cut ceremony) ──┬──> Phase 3 (Evidence) ──┐
                  │                               │                        │
                  └──> Phase 2 (Agent integration) ┘──> Phase 4 (Dashboard) ┴──> Phase 5 (Ecosystem)
                                                                                    │
                                                                                    v
                                                                               Phase 6 (Explore)
```

Phases 1 and 2 can run in parallel (different modules). Phase 3 depends on Phase 1.

---

## Execution Model: Codex + Claude Code Loop

```
Claude Code creates task (task.md / context.md / verification.md)
        ↓
Claude Code compiles prompt
        ↓
Codex executes → records evidence
        ↓
Claude Code triple review:
  • Code review: diff within scope, quality, bugs
  • Evidence review: evidence authentic, complete, not fabricated
  • Architecture review: aligned with phase goals and guiding principles
        ↓
Pass → refresh checkpoint    Fail → create correction task for Codex
```

When Phase 2 MCP integration is complete, this loop can be semi-automated inside Claude Code.

---

## Key Risks and Mitigations

| Risk | Mitigation |
|------|-----------|
| Break existing npm users | 0.x → 1.0 migration guide; Lite Mode is additive, old behavior preserved |
| TypeScript migration cost | Incremental; `.d.ts` bridges; no big-bang rewrite |
| MCP vendor lock-in | MCP is open standard; file protocol retained as fallback |
| Over-simplification loses power users | Full/Strict modes preserve all current strictness |
| Codex execution drift | Clear acceptance criteria per phase + Claude Code review gate |
| Phase timelines slip | Each phase ships independently with measurable user value |

---

## Legacy Roadmap (Pre-2026)

The original roadmap phases (Foundation, Stronger prompt compiler, Verification layer, Multi-agent orchestration, External integrations, Polish) have been completed or absorbed into this plan. The verification layer work is preserved as Phase 3's `--strict` mode. Multi-agent orchestration moves to Phase 6.
