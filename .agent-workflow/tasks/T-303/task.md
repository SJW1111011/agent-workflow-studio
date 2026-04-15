# T-303 - MCP configuration — CLI command to register MCP server in Claude Code and Cursor settings

## Goal

Add a `mcp:install` CLI command that auto-registers the agent-workflow-studio MCP server in the correct configuration file for Claude Code (`~/.claude/settings.json`) and Cursor (`.cursor/mcp.json`). After running this command, the user can immediately use workflow tools from their agent without manual JSON editing.

<!-- agent-workflow:managed:task-recipe-meta:start -->
## Recipe

- Recipe ID: feature
- Recipe summary: Deliver scoped user value without breaking contracts.
<!-- agent-workflow:managed:task-recipe-meta:end -->

## Scope

- In scope:
  - repo path: src/lib/mcp-install.js (new — detect client, read/write config)
  - repo path: src/cli.js (register `mcp:install` and `mcp:uninstall` commands)
  - repo path: test/mcp-install.test.js (new)
  - repo path: README.md (document the command)
  - repo path: docs/MCP_SETUP.md (reference the auto-install)
- Out of scope:
  - repo path: src/mcp-server.js (server itself unchanged)
  - repo path: dashboard/ (no UI changes)
  - repo path: Windsurf, Zed, or other editors (document manually for now)

## Required docs

- .agent-workflow/project-profile.md
- docs/ROADMAP.md (Phase 2 context)

## Deliverables

- `mcp:install [--client claude|cursor]` — detects client config file, adds MCP server entry
- `mcp:uninstall [--client claude|cursor]` — removes the entry
- Auto-detect client if `--client` not specified (look for config files)
- Never overwrite existing entries — merge or warn
- Unit tests for config read/write/merge
- Documentation in README and MCP_SETUP.md

## Risks

- Config file formats may differ between Claude Code versions — use defensive parsing
- Writing to `~/.claude/settings.json` could corrupt the file if malformed — read, validate, merge, write atomically
- User may not have the target client installed — warn and exit gracefully

## Acceptance Criteria

- `npx agent-workflow mcp:install --client claude` adds server to `~/.claude/settings.json`
- `npx agent-workflow mcp:install --client cursor` adds server to `.cursor/mcp.json`
- Idempotent: running twice doesn't duplicate the entry
- `mcp:uninstall` removes the entry cleanly
- Graceful error if client config file doesn't exist
- `npm test` passes with new tests
