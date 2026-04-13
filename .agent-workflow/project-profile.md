# Project Profile

Generated at: 2026-04-12T18:53:20.284Z

## Repository

- Name: agent-workflow-studio

## Top-level directories

- .claude
- .github
- .npm-cache-tmp
- dashboard
- docs
- scripts
- src
- test
- tmp

## Docs

- README.md
- docs/ADAPTERS.md
- docs/ARCHITECTURE.md
- docs/GETTING_STARTED.md
- docs/ISSUE_BACKLOG.md
- docs/NEXT_AGENT_HANDOFF.md
- docs/PRD.md
- docs/PUBLISHING.md
- docs/README.md
- docs/RECIPES_AND_SCHEMA.md
- docs/RELEASE_NOTES_0.1.2.md
- docs/RELOCATABLE_DESIGN.md
- docs/ROADMAP.md
- docs/RUN_EXECUTE_DESIGN.md
- docs/VERIFICATION_FRESHNESS_DESIGN.md

## Scripts

- `build`: `tsc --project tsconfig.json`
- `pretest`: `npm run build`
- `test`: `vitest run`
- `test:coverage`: `vitest run --coverage`
- `test:watch`: `vitest --watch`
- `cli`: `node src/cli.js`
- `init`: `node src/cli.js init`
- `scan`: `node src/cli.js scan`
- `memory:bootstrap`: `node src/cli.js memory:bootstrap`
- `memory:validate`: `node src/cli.js memory:validate`
- `adapter:list`: `node src/cli.js adapter:list`
- `adapter:create`: `node src/cli.js adapter:create`
- `recipe:list`: `node src/cli.js recipe:list`
- `quick`: `node src/cli.js quick`
- `task:new`: `node src/cli.js task:new`
- `task:list`: `node src/cli.js task:list`
- `prompt:compile`: `node src/cli.js prompt:compile`
- `run:prepare`: `node src/cli.js run:prepare`
- `run:execute`: `node src/cli.js run:execute`
- `checkpoint`: `node src/cli.js checkpoint`
- `run:add`: `node src/cli.js run:add`
- `validate`: `node src/cli.js validate`
- `skills:generate`: `node src/cli.js skills:generate`
- `dashboard`: `node src/server.js`
- `verify:onboarding`: `node scripts/npm-onboarding-check.js`
- `smoke`: `node scripts/smoke-test.js`
- `prepublishOnly`: `npm run build`

## Recommendations

- Add an agent-facing root document such as AGENTS.md or CLAUDE.md.
