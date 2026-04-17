# MCP Setup

This guide shows how to run `agent-workflow-studio` as an MCP server over stdio so Codex, Claude Code, Cursor, and other MCP clients can call the workflow tools directly.

## What the MCP server exposes

The server exposes these MCP tools:

- `workflow_quick`
- `workflow_done`
- `workflow_update_task`
- `workflow_append_note`
- `workflow_task_list`
- `workflow_run_add`
- `workflow_checkpoint`
- `workflow_undo`
- `workflow_validate`
- `workflow_overview`

All tool handlers delegate to the same durable workflow modules used by the CLI, so MCP calls update `.agent-workflow/` the same way terminal commands do.

## Recommended workflow after setup

Once MCP is configured, you don't need to use the terminal. Talk to your agent naturally:

**Creating tasks:**
- "create a lite task for adding authentication"
- "create a full task called 'Refactor database layer' with codex as the agent"

**Recording work:**
- "mark T-001 done with 'implemented JWT login' and complete it"
- "add a draft run to T-002 with summary 'WIP on database migration'"

**Checking status:**
- "list my workflow tasks"
- "show me the workspace overview"
- "validate the workflow"

**Mid-execution updates:**
- "update T-001 priority to P0"
- "add a note to T-001: found a race condition in the session handler"

**Undoing mistakes:**
- "undo the last workflow operation"

The MCP tools map directly to CLI commands — `workflow_quick` = `quick`, `workflow_done` = `done`, etc. If MCP is unavailable, fall back to the CLI.

## Quick install

Install the MCP server into the client config you want to use:

```bash
npx agent-workflow mcp:install --client codex --root /absolute/path/to/target-repo
npx agent-workflow mcp:install --client claude --root /absolute/path/to/target-repo
npx agent-workflow mcp:install --client cursor --root /absolute/path/to/target-repo
```

If the standard config file already exists, you can omit `--client` and let the CLI auto-detect supported targets:

```bash
npx agent-workflow mcp:install --root /absolute/path/to/target-repo
```

Auto-detect only touches config files it can already find. Pass `--client codex`, `--client claude`, or `--client cursor` when you want the CLI to create the standard config file for that client.

The installer is non-destructive:

- it merges the `agent-workflow` entry into `mcpServers`
- it preserves unrelated settings and other MCP servers
- it does not overwrite an existing `agent-workflow` entry with different settings; it warns instead

Remove the entry later with:

```bash
npx agent-workflow mcp:uninstall --client codex --root /absolute/path/to/target-repo
npx agent-workflow mcp:uninstall --client claude --root /absolute/path/to/target-repo
npx agent-workflow mcp:uninstall --client cursor --root /absolute/path/to/target-repo
```

## Codex

Codex reads MCP servers from `~/.codex/config.toml`. Codex also supports trusted project-level `.codex/config.toml`, but `mcp:install --client codex` currently targets the global config only.

Recommended command:

```bash
npx agent-workflow mcp:install --client codex --root /absolute/path/to/target-repo
```

Manual config example:

```toml
[mcp_servers.agent-workflow]
command = "npx"
args = ["agent-workflow-mcp", "--root", "/absolute/path/to/target-repo"]
cwd = "/absolute/path/to/workflow-cli"
```

Contributor checkout variant:

```toml
[mcp_servers.agent-workflow]
command = "node"
args = [
  "/absolute/path/to/agent-workflow-studio/src/mcp-server.js",
  "--root",
  "/absolute/path/to/target-repo"
]
```

Codex's MCP config supports `command`, `args`, optional `cwd`, and optional `env` under the same `[mcp_servers.<name>]` table. After saving the config, restart Codex or use `/mcp` inside the Codex TUI to confirm the server is available.

## Launch shapes used by the installer

### Option 1: contributor repo checkout

Use this while working inside this repository:

```bash
cd /absolute/path/to/agent-workflow-studio
npm install
npm run mcp:serve -- --root /absolute/path/to/target-repo
```

For editor configs, point the command at `node` and the checked-out server entry point:

```json
{
  "command": "node",
  "args": [
    "/absolute/path/to/agent-workflow-studio/src/mcp-server.js",
    "--root",
    "/absolute/path/to/target-repo"
  ]
}
```

### Option 2: helper directory with the published package

Use this when you want the workflow tool installed outside the target repo:

```bash
mkdir /absolute/path/to/workflow-cli
cd /absolute/path/to/workflow-cli
npm init -y
npm install agent-workflow-studio
```

From that helper directory, the direct MCP bin is:

```bash
npx agent-workflow-mcp --root /absolute/path/to/target-repo
```

For editor configs, keep `cwd` set to the helper directory so `npx agent-workflow-mcp` resolves the locally installed bin:

```json
{
  "command": "npx",
  "args": ["agent-workflow-mcp", "--root", "/absolute/path/to/target-repo"],
  "cwd": "/absolute/path/to/workflow-cli"
}
```

## Claude Code

Claude Code reads MCP servers from `~/.claude/settings.json`.

Recommended command:

```bash
npx agent-workflow mcp:install --client claude --root /absolute/path/to/target-repo
```

Manual config example:

```json
{
  "mcpServers": {
    "agent-workflow": {
      "command": "npx",
      "args": ["agent-workflow-mcp", "--root", "/absolute/path/to/target-repo"],
      "cwd": "/absolute/path/to/workflow-cli"
    }
  }
}
```

Contributor checkout variant:

```json
{
  "mcpServers": {
    "agent-workflow": {
      "command": "node",
      "args": [
        "/absolute/path/to/agent-workflow-studio/src/mcp-server.js",
        "--root",
        "/absolute/path/to/target-repo"
      ]
    }
  }
}
```

After saving the config, restart Claude Code. Then try requests like:

- `list my workflow tasks`
- `create a task called "Add auth" in lite mode`
- `mark T-001 done with summary "implemented login" and complete it`

## Cursor

Cursor reads MCP servers from `.cursor/mcp.json` in the workspace you want Cursor to control.

Recommended command:

```bash
npx agent-workflow mcp:install --client cursor --root /absolute/path/to/target-repo
```

Manual config example:

```json
{
  "mcpServers": {
    "agent-workflow": {
      "command": "npx",
      "args": ["agent-workflow-mcp", "--root", "/absolute/path/to/target-repo"],
      "cwd": "/absolute/path/to/workflow-cli"
    }
  }
}
```

Contributor checkout variant:

```json
{
  "mcpServers": {
    "agent-workflow": {
      "command": "node",
      "args": [
        "/absolute/path/to/agent-workflow-studio/src/mcp-server.js",
        "--root",
        "/absolute/path/to/target-repo"
      ]
    }
  }
}
```

After updating the file, reload Cursor and confirm the MCP server appears in Cursor's MCP UI.

## Verify the connection

Run this in a terminal first if you want a quick manual check:

```bash
npx agent-workflow mcp:serve --root /absolute/path/to/target-repo
```

If the process starts and waits quietly, that is expected. MCP stdio servers should not print extra stdout logs after startup, because stdout is reserved for protocol messages.

Then, from the MCP client, try:

1. `list my workflow tasks`
2. `create a task called "Ship MCP setup docs"`
3. `show me the workspace overview`

You should see the corresponding `workflow_*` tools being selected by the client, and the target repo should update under `.agent-workflow/`.

## Notes

- `--root` is optional. If you omit it, the server uses the current working directory. For editor integrations, explicit `--root` is usually safer.
- `mcp:install` writes either a direct `node /absolute/path/to/src/mcp-server.js` entry or an `npx agent-workflow-mcp` entry with the correct `cwd`, depending on how it finds the package.
- Codex config is written as TOML under `~/.codex/config.toml`; Claude Code and Cursor continue using JSON config files.
- Codex itself also supports trusted project-level `.codex/config.toml`, but that project-scoped install flow is a follow-up.
- `agent-workflow mcp:serve` and `agent-workflow-mcp` start the same stdio server. The dedicated `agent-workflow-mcp` bin is usually easier for editor config files.
- The package now has one runtime dependency: `@modelcontextprotocol/sdk`. The existing workflow logic still lives in the local file-based modules under `src/lib/`.
- The MCP server is stdio-only in this release. SSE and remote execution remain separate follow-up work.
