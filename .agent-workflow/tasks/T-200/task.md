# T-200 - Lite Mode for quick — minimal file generation, defer prompt/run-prep/checkpoint

## Goal

Add a `--lite` mode (eventually become the default) to the `quick` command that generates only the minimal task scaffold (`task.json` + `task.md` only) and skips prompt compilation, run preparation, and checkpoint generation. The deferred files materialize on demand when their corresponding commands are invoked. This is the foundational change for Phase 1: cutting ceremony.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/quick-task.js
  - repo path: src/cli.js (add `--lite` and `--full` flags to `quick`)
  - repo path: src/lib/task-documents.js (allow lazy creation of context/verification/checkpoint)
  - repo path: src/lib/task-service.js (createTask must support skipping doc generation)
  - repo path: src/lib/run-preparer.js (must be safe to call later when files don't exist)
  - repo path: src/lib/checkpoint.js (must be safe to call when verification.md doesn't exist)
  - repo path: src/lib/prompt-compiler.js (must be callable on-demand)
  - repo path: test/quick-task.test.js (add lite mode tests)
  - repo path: test/task-documents.test.js (test lazy document generation)
  - repo path: README.md (document Lite/Full modes)
  - repo path: AGENT_GUIDE.md (update agent workflow guidance)
  - repo path: docs/ROADMAP.md (mark T-200 done)
- Out of scope:
  - repo path: dashboard/ (UI changes deferred to Phase 4)
  - repo path: src/lib/verification-gates.js (T-202 will handle smart defaults)
  - repo path: src/server.js (API changes deferred until UI work)
  - repo path: any deletion of Full Mode behavior

## Required docs

- .agent-workflow/project-profile.md
- .agent-workflow/memory/architecture.md
- docs/ROADMAP.md (Phase 1 context)
- docs/AGENT_GUIDE.md if exists, else AGENT_GUIDE.md

## Deliverables

- `quick --lite "<title>"` generates ONLY `task.json` + `task.md` (single-line goal acceptable as placeholder)
- `quick --full "<title>"` preserves the current behavior (all 7 files generated)
- Default behavior in this task: `--full` remains default (will flip in a follow-up task after Lite is proven)
- Lazy materialization: `prompt:compile`, `run:prepare`, `checkpoint`, and `run:add` all work whether or not the optional docs exist beforehand
- New tests covering Lite mode: file count, content, and lazy materialization
- Documentation explaining when to use Lite vs Full

## Risks

- Existing code paths assume all files exist (e.g., `buildTaskVerificationGate` reads `verification.md`); guard or auto-create
- Dashboard may break if it expects compiled prompts to always exist — verify via smoke test
- Tests that use `createTaskWorkspace` helper may need an `--full` opt-in to keep current behavior
- Ordering matters: lazy creation must use the same template content as `quick --full` does, otherwise outputs diverge

## Acceptance Criteria

- `quick --lite "X"` generates exactly 2 files: `task.json`, `task.md`
- `quick --full "X"` generates the same 7 files as before (no regression)
- Calling `prompt:compile T-XXX` on a Lite task creates the missing prompt + run-request + launch pack on demand
- Calling `checkpoint T-XXX` on a Lite task auto-creates verification.md with empty skeleton if missing, then proceeds
- Calling `run:add T-XXX "summary" --status passed` on a Lite task creates context.md and verification.md if missing, then records evidence
- All existing tests still pass (`npm test` green)
- New tests added for Lite mode behavior
- README has a "Lite vs Full" section
