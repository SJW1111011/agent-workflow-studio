# Roadmap - 2026 Long-term Improvement Plan

> **Execution model:** Codex executes, Claude Code evaluates, suggests, and audits.
> Every phase is managed by agent-workflow-studio itself (dogfooding).

## Guiding Principles

1. **Subtraction, not addition.** Every change must reduce user friction. Never add features at the cost of simplicity.
2. **Dogfooding is the only proof.** The improvement process itself must be managed by agent-workflow-studio. If the tool cannot manage its own evolution, it is not ready for others.
3. **Backward compatibility.** The package is already published to npm. Users must not lose data or rewrite workflows on upgrade.

---

## Phase 0 - Infrastructure Modernization (Tech Debt)

**Goal:** Establish a healthy engineering foundation for all subsequent work.

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

## Phase 1 - Cut the Ceremony (Core Overhaul, Highest User Value)

**Goal:** 90% of daily tasks can be recorded in 30 seconds, not 5 minutes.

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

## Phase 2 - Real Agent Integration (File Protocol to Integration Platform)

**Goal:** Users say "create a task for X" inside Claude Code and the full pipeline runs automatically.

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

## Phase 3 - Evidence Model Simplification (Make Complexity Invisible)

**Goal:** New users never need to learn "proof anchor" to use the tool effectively.

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

## Phase 4 - Dashboard Rebuild

**Goal:** Move from a demo page to a real control plane.

| Change | Detail |
|--------|--------|
| Preact + Vite | Component model plus fast builds and a small bundle |
| Real-time updates | SSE or WebSocket support so the UI no longer needs manual refresh |
| Multi-task views | Kanban, Gantt, and timeline views |
| Live log stream | Watch agent execution output in real time |
| Responsive + Dark mode | Mobile-friendly layout plus system theme support |

**Acceptance criteria:**
- Agent execution state updates without page refresh
- Lighthouse score >= 90
- Works on mobile viewports

---

## Phase 5 - Ecosystem

**Goal:** External users can self-onboard, contribute, and extend.

| Deliverable | Detail |
|-------------|--------|
| VitePress doc site | Replace the README-driven docs stack |
| Cookbook | 10+ real-world scenarios (refactor, bugfix, audit, migration, new feature, and more) |
| Plugin system | Third-party recipes, adapters, and evidence collectors |
| Template library | Pre-configured setups for React, Python, Rust, and Go projects |
| Video demos | Short walkthroughs of core value propositions |
| Community | GitHub Discussions or Discord |

**Acceptance criteria:**
- npm weekly downloads trend upward
- >= 1k GitHub stars
- >= 20 external contributors

---

## Phase 6 - Advanced Exploration (No Timeline Commitment)

- Multi-agent orchestration (planner + executor + reviewer roles)
- Team mode with an optional cloud backend, cross-member task assignment, and review
- Remote execution through containers or SSH sandboxes
- AI-assisted task decomposition from a high-level goal into a sub-task tree

---

## Phase Dependency Graph

```text
Phase 0 (Infra) ---> Phase 1 (Cut ceremony) ---> Phase 3 (Evidence)
                  \                            \
                   \                            ---> Phase 2 (Agent integration) ---> Phase 4 (Dashboard) ---> Phase 5 (Ecosystem)
                    \
                     ---> Phase 6 (Explore)
```

Phases 1 and 2 can run in parallel because they mostly touch different modules. Phase 3 depends on Phase 1.

---

## Execution Model: Codex + Claude Code Loop

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

When Phase 2 MCP integration is complete, this loop can be semi-automated inside Claude Code.

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
