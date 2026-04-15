# T-304 - Codex MCP support — add Codex as mcp:install target and document TOML config integration

## Goal

Extend `mcp:install` / `mcp:uninstall` to support Codex as a first-class target. Codex stores MCP server configuration in TOML format (`~/.codex/config.toml` or project-level `.codex/config.toml`), unlike Claude Code (JSON) and Cursor (JSON). After this task, `mcp:install --client codex` writes the correct TOML config entry so Codex can call agent-workflow-studio's MCP tools directly — completing the three-client MCP integration story.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/mcp-install.js (add Codex TOML support — read/parse/merge/write TOML)
  - repo path: src/cli.js (extend `--client` to accept `codex`)
  - repo path: test/mcp-install.test.js (add Codex TOML tests)
  - repo path: README.md (document Codex MCP setup)
  - repo path: docs/MCP_SETUP.md (add Codex section with TOML examples)
  - repo path: AGENT_GUIDE.md (update to mention MCP as primary integration for all three clients)
- Out of scope:
  - repo path: src/mcp-server.js (MCP server itself unchanged — Codex uses the same stdio transport)
  - repo path: dashboard/ (no UI changes)
  - repo path: Codex App Server protocol (out of scope — MCP is sufficient for tool integration)

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 2 context)
- Codex MCP documentation (https://developers.openai.com/codex/mcp)
- Codex config reference (https://mintlify.wiki/openai/codex/configuration/mcp-servers)

## Deliverables

- `mcp:install --client codex` writes MCP server entry to `~/.codex/config.toml`
- `mcp:uninstall --client codex` removes the entry
- Lightweight TOML parser/writer (no external dependency — TOML for MCP config is simple enough to handle with a focused parser)
- Auto-detect: when `--client` is omitted and `~/.codex/config.toml` exists, include Codex in the detected clients
- Unit tests covering: TOML read/write, merge without corruption, idempotent install, clean uninstall
- `docs/MCP_SETUP.md` updated with Codex-specific section showing both auto-install and manual TOML config
- README updated with three-client MCP setup summary

## Risks

- TOML parsing without a library — Codex MCP config is simple (key-value + table sections), but edge cases in TOML spec (multiline strings, inline tables) could cause issues. Mitigate: only parse/write the subset needed for `[mcp_servers]` entries.
- `~/.codex/config.toml` may contain unrelated Codex settings — must preserve all existing content when merging.
- Codex supports project-level `.codex/config.toml` for trusted projects — this task targets global config only; project-level is a follow-up.
- TOML spec uses `\n` line endings — must handle Windows `\r\n` correctly.

## Acceptance Criteria

- `npx agent-workflow mcp:install --client codex` writes valid TOML entry to `~/.codex/config.toml`
- `npx agent-workflow mcp:uninstall --client codex` removes the entry without corrupting other config
- Idempotent: running install twice doesn't duplicate the entry
- Existing `~/.codex/config.toml` content is preserved during merge
- `mcp:install` auto-detect includes Codex when config file exists
- All three clients work: `--client claude`, `--client cursor`, `--client codex`
- TOML output is readable and valid
- `npm test` passes with new tests
- `npm run smoke` passes
- No runtime dependencies added (TOML parsing is built-in)
