# Roadmap - 2026 Long-term Improvement Plan

> **Execution model:** Codex executes, Claude Code evaluates, suggests, and audits.
> Every phase is managed by agent-workflow-studio itself (dogfooding).

## Guiding Principles

1. **Subtraction, not addition.** Every change must reduce user friction. Never add features at the cost of simplicity.
2. **Dogfooding is the only proof.** The improvement process itself must be managed by agent-workflow-studio. If the tool cannot manage its own evolution, it is not ready for others.
3. **Backward compatibility.** The package is already published to npm. Users must not lose data or rewrite workflows on upgrade.

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

## Phase 5 - Agent-Native Evidence - IN PROGRESS

**Goal:** Make evidence automatic, make agents first-class MCP citizens, make trust quantifiable.

| Task | Description |
|------|-------------|
| T-600 | Evidence collector plugin system: pluggable registry with npm/pytest/cargo/go built-ins |
| T-601 | MCP resources and prompts: expose workflow state as resources, replace prompt:compile |
| T-602 | Smart defaults v2: multi-collector integration into done/run-add flow |
| T-603 | Agent activity evidence: structured evidence from MCP tool calls |
| T-604 | Dashboard trust surface: trust score, freshness heatmap, evidence timeline |
| T-605 | Deprecate prompt:compile and skills:generate |
| T-606 | Version bump to 0.2.0 |

| Change | Detail |
|--------|--------|
| Evidence collectors | Pluggable registry replaces hardcoded npm-test; auto-detects pytest, cargo, go |
| MCP resources | Agents pull task/evidence/memory data as structured resources |
| MCP prompts | workflow-resume replaces prompt:compile with no truncation |
| Agent activity | Agents report what they did as structured evidence through MCP |
| Trust score | Deterministic 0-100 score from evidence coverage, freshness, collector diversity |
| Deprecations | prompt:compile and skills:generate deprecated in favor of MCP resources/prompts |

**Acceptance criteria:**
- Evidence auto-collected from multiple test runners without configuration
- MCP resources and prompts listable and readable by any MCP client
- Trust score visible in dashboard for all tasks
- Backward compatible with 0.1.2 .agent-workflow/ data

---

## Phase 6 - Ecosystem

**Goal:** External users can self-onboard, contribute, and extend.

| Deliverable | Detail |
|-------------|--------|
| VitePress doc site | Replace the README-driven docs stack |
| Cookbook | 10+ real-world scenarios (refactor, bugfix, audit, migration, new feature, and more) |
| Template library | Pre-configured setups for React, Python, Rust, and Go projects |
| Community | GitHub Discussions or Discord |

**Acceptance criteria:**
- npm weekly downloads trend upward
- >= 1k GitHub stars
- >= 20 external contributors

---

## Phase 7 - Advanced Exploration (No Timeline Commitment)

- Multi-agent orchestration (planner + executor + reviewer roles)
- Team mode with an optional cloud backend, cross-member task assignment, and review
- Remote execution through containers or SSH sandboxes
- AI-assisted task decomposition from a high-level goal into a sub-task tree

---

## Phase Dependency Graph

```text
Phase 0 (Infra) ---> Phase 1 (Cut ceremony) ---> Phase 3 (Evidence)
                  \                            \
                   \                            ---> Phase 2 (Agent integration) ---> Phase 4 (Dashboard) ---> Phase 5 (Agent-native evidence) ---> Phase 6 (Ecosystem)
                    \
                     ---> Phase 7 (Explore)
```

Phases 1 and 2 can run in parallel because they mostly touch different modules. Phase 3 depends on Phase 1. Phase 5 depends on Phase 4 (dashboard) and Phase 2 (MCP).

---

## How Users Work with Agent Workflow Studio

Most users follow the **fast path**: create a task, do the work, record what happened.

```text
MCP or CLI: quick --lite "title"
        -> do the work (write code, run tests, etc.)
        -> MCP or CLI: done "summary" --complete
```

MCP tools (`workflow_quick`, `workflow_done`, etc.) are the recommended integration for editor users. The CLI is the fallback for terminal users.

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

This loop produced 29 tasks across 5 phases (T-100 ~ T-504), each reviewed against `.agent-workflow/review-checklist.md`. The MCP integration (Phase 2) now makes it possible to run parts of this loop from inside Claude Code without switching to a terminal.

---

## Key Risks and Mitigations

| Risk | Mitigation |
|------|------------|
| Break existing npm users | 0.x -> 1.0 migration guide; Lite Mode stays additive while old behavior is preserved |
| TypeScript migration cost | Incremental adoption with `.d.ts` bridges; no big-bang rewrite |
| MCP vendor lock-in | MCP is open; file protocol remains as the fallback |
| Over-simplification loses power users | Full and Strict modes preserve the stronger workflow paths |
| Codex execution drift | Clear acceptance criteria per phase plus Claude Code review gates |
| Phase timelines slip | Each phase should ship independently with measurable user value |

---

## Legacy Roadmap (Pre-2026)

The original roadmap phases (Foundation, Stronger prompt compiler, Verification layer, Multi-agent orchestration, External integrations, and Polish) have been completed or absorbed into this plan. The verification layer work is now captured by Phase 3's `--strict` mode. Multi-agent orchestration moves to Phase 6.
