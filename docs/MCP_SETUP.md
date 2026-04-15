# MCP Setup

This guide shows how to run `agent-workflow-studio` as an MCP server over stdio so Claude Code, Cursor, and other MCP clients can call the workflow tools directly.

## What the MCP server exposes

The server exposes these MCP tools:

- `workflow_quick`
- `workflow_done`
- `workflow_task_list`
- `workflow_run_add`
- `workflow_checkpoint`
- `workflow_undo`
- `workflow_validate`
- `workflow_overview`

All tool handlers delegate to the same durable workflow modules used by the CLI, so MCP calls update `.agent-workflow/` the same way terminal commands do.

## Choose one launch shape

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

Merge an entry like this into `mcpServers`:

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

Create or update `.cursor/mcp.json` in the target repo:

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
- `agent-workflow mcp:serve` and `agent-workflow-mcp` start the same stdio server. The dedicated `agent-workflow-mcp` bin is usually easier for editor config files.
- The package now has one runtime dependency: `@modelcontextprotocol/sdk`. The existing workflow logic still lives in the local file-based modules under `src/lib/`.
- The MCP server is stdio-only in this release. SSE and remote execution remain separate follow-up work.
