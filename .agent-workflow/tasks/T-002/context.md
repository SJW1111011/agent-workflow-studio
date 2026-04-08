# T-002 Context

## Why now

The project already has shared executor preflight/readiness, additive failure categories, `stdinMode: promptFile`, and dashboard/CLI surfaces for advisories. The next highest-priority gap is no longer another executor abstraction; it is proving that the existing contract can drive one real local agent CLI end to end on the repository itself.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- The roadmap and handoff docs both prioritize a narrow real-agent `run:execute` pilot before broader adapter defaults.
- Built-in generated adapter scaffolds still default to `commandMode: manual`, even though the Codex scaffold now includes a recommended non-interactive `codex exec ... -` template.
- On this machine, `cmd /c codex --help` resolves successfully, while direct PowerShell invocation of the local shim is blocked by script-execution policy.
- The executor already supports `stdioMode: pipe`, `stdinMode: promptFile`, run ledger persistence, stdout/stderr logs, timeout/interruption metadata, and checkpoint refresh.
- Durable workflow artifacts must remain repo-relative and Git-friendly.
- The first dogfooding launch does not need the child Codex process to implement a feature; it only needs the process to consume the compiled prompt, stay within scope, and leave honest run evidence.
- The first repo-local dogfooding launch reached the real child process but exposed a template bug: the locally observed `codex exec` surface rejected `--ask-for-approval`.
- After fixing that template, the next real launch reached Codex itself and confirmed stdin prompt delivery, but the local Codex CLI still failed before model work because `OPENAI_API_KEY` is not configured in this environment.

## Open questions

- Does `child_process.spawn(...)` succeed with a Windows-safe wrapper such as `cmd.exe /c codex ...` in the real executor path on this machine?
- What is the narrowest dogfooding prompt that proves the pipeline without inviting unrelated repo edits?
- Which evidence should remain committed after the first real local run, and which should stay transient?
- Should local auth/provider prerequisites remain documented as operator setup, or become an additive adapter preflight concept without hard-coding vendor assumptions into core defaults?

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P0
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
