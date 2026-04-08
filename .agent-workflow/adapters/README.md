# Adapter Config

These files describe local adapter contracts for agent runtimes.

- Edit runnerCommand after confirming your local installation.
- Built-in adapters may include a recommended exec template while still defaulting to manual mode.
- On the locally observed Codex CLI surface from 2026-04-08, `codex exec` accepted `--sandbox` but rejected `--ask-for-approval`; keep any local exec template aligned with the CLI version you actually verified.
- Keep this folder portable.
- Do not write absolute machine paths here unless you truly need them.
