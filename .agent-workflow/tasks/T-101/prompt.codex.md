# T-101 Prompt for Codex

## Mission

Complete the task truthfully and leave the repository easier for the next agent to understand.

## Read first

- .agent-workflow/project.json
- .agent-workflow/project-profile.md
- .agent-workflow/memory/product.md
- .agent-workflow/memory/architecture.md
- .agent-workflow/memory/domain-rules.md
- .agent-workflow/recipes/feature.md
- .agent-workflow/tasks/T-101/task.md
- .agent-workflow/tasks/T-101/context.md
- .agent-workflow/tasks/T-101/verification.md

## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.

## Task brief

# T-101 - ESM dual-package — exports field, CJS backward-compat preserved

## Goal

Configure the package for ESM + CJS dual publishing so downstream consumers can use either `import` or `require()`. After this task, `import { workspace } from 'agent-workflow-studio'` works in ESM projects while existing `require()` users are unaffected.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: package.json (`exports` field, `type` field adjustment)
  - repo path: tsconfig.json (if ESM output needs separate config)
  - repo path: src/index.ts or index.js (public API barrel export)
- Out of scope:
  - repo path: dashboard/ (browser code, not npm-published as module)
  - repo path: src/cli.js (CLI entry point stays CJS bin)
  - repo path: test/ (tests can stay CJS)

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 0 context)
- Node.js dual-package documentation (https://nodejs.org/api/packages.html#dual-commonjses-module-packages)

## Deliverables

- `package.json...

## Working context

# T-101 Context

## Why now

Node.js ecosystem has moved to ESM. Libraries that only export CJS are increasingly friction for downstream consumers using `import` syntax. This must land alongside or shortly after T-100 (TypeScript migration) so the TypeScript compiler can output both formats from the start.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- Current: `"type": "commonjs"`, `"main": "index.js"`, no `exports` field
- The `bin` entry (`"agent-workflow": "src/cli.js"`) must stay CJS — `npx` runs bin scripts synchronously
- Node.js conditional exports (`exports` field) is stable since Node 12.11
- The project has zero runtime dependencies, so no transitive CJS/ESM conflicts

## Open questions

- Should we use the "wrapper" pattern (ESM wrapper imports CJS) or true dual compilation (two tsc outputs)?
- Is a separate `tsconfig.esm.json` needed or can one config handle both?

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Kee...

## Verification expectations

# T-101 Verification

## Planned checks

- automated:
- manual:

## Proof links

### Proof 1

- Files:
- Check:
- Result:
- Artifact:

## Blocking gaps

-

## Required behaviors

- Stay within the requested scope.
- Call out fake implementations and unverified assumptions.
- Record runs in .agent-workflow/tasks/T-101/runs.
- Refresh checkpoint.md before handing off.
- If verification is incomplete, say so plainly.

## Codex notes

- Be explicit about the files you inspect, edit, and validate.
- Keep changes narrow and evidence-backed.
- Update workflow docs immediately after each meaningful step.

## Final output

- implemented changes
- updated workflow docs
- verification status
- unresolved risks
