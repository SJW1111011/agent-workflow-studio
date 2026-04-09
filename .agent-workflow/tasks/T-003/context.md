# T-003 Context

## Why now

The project now has one proven narrow real-agent `run:execute` path for Codex plus shared preflight/readiness, additive failure categories, `stdinMode: promptFile`, and a published npm onboarding flow. The next highest-priority gap is proving that the same contract can also drive one real local Claude Code CLI path end to end on the repository itself without introducing a second executor model or broadening generated defaults too early.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- The roadmap and handoff docs both prioritize proving real local adapter paths before broadening defaults.
- Built-in generated adapter scaffolds still default to `commandMode: manual`, even though the repo-local dogfooding path is allowed to opt into `exec`.
- On this machine, `cmd.exe /d /s /c claude --version` resolves successfully, while direct PowerShell invocation of the local shim resolves to `claude.ps1`, which is blocked by script-execution policy.
- `claude auth status` currently reports `loggedIn: true`, `authMethod: oauth_token`, and `apiProvider: firstParty`.
- Real local Claude print mode already works on this machine with `claude --model sonnet --bare --output-format json -p`.
- The same local CLI also accepts prompt text over stdin, which matches the existing executor `stdinMode: promptFile` contract.
- With `--permission-mode bypassPermissions`, the local Claude CLI can inspect repo files non-interactively in print mode and return structured JSON output.
- The first real `run:execute` attempt failed with `Not logged in` even though `claude auth status` was green, and a direct reproduction confirmed that the stripped child env must forward `ANTHROPIC_AUTH_TOKEN` plus `ANTHROPIC_BASE_URL` for this machine's non-interactive Claude path.
- Durable workflow artifacts must remain repo-relative and Git-friendly.
- The first dogfooding launch does not need the child Claude process to implement a feature; it only needs the process to consume the compiled prompt, stay within scope, and leave honest run evidence.

## Open questions

- Does the real `run:execute` path succeed end to end with the Windows-safe wrapper plus `stdinMode: promptFile` and JSON output?
- Is the current prompt already narrow enough for Claude Code to stay inspection-first without unrelated repo edits?
- Should auth/provider readiness eventually grow beyond env-presence hints, since `claude auth status` can be green while the stripped child process still needs explicit token/base-url forwarding?
- After one real Claude run, which argv shape details are stable enough to document, and which should remain repo-local until more machines are verified?

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
