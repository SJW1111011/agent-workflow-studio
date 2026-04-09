# Getting Started

This is the shortest verified npm-first path for trying `agent-workflow-studio` on a clean local repository.

It is written for the published package, not for contributors working from this repo checkout.

## Verified path

As of 2026-04-09, the following flow was re-validated from a truly external clean temp directory on Windows against `agent-workflow-studio@0.1.1`:

- install the published package locally into a separate tool directory
- run `init`
- run `scan`
- run `memory:bootstrap`
- run `quick`
- run `validate`
- launch `dashboard`
- confirm `/api/health` and `/api/overview` return `200`

Because the package name and the executable name differ, the most reliable no-global-install shape is:

```bash
npm install agent-workflow-studio
npx agent-workflow --help
```

If you prefer a global install, the equivalent command name is `agent-workflow`.

## Platform notes

- macOS/Linux: the commands below assume `node` and `npm` are already installed in the same shell session
- Windows PowerShell/CMD: use the same CLI arguments, but the examples in this guide are written in npm-first / POSIX-friendly style
- WSL on Windows: the bash-style onboarding flow was validated on this machine, but the shell did not have native `node` / `npm` on `PATH`; if you want to run the Linux-style commands directly inside WSL, install Node inside WSL first, otherwise use the Windows shell flow
- Hosted CI is now configured to exercise a packed-tarball install plus the dashboard `Quick Create` path on `windows-latest`, `ubuntu-latest`, and `macos-latest`

## 5-minute npm-first start

1. Create or choose a repository

```bash
mkdir demo-repo
cd demo-repo
git init
npm init -y
```

2. Open a separate helper directory so the workflow tool itself does not add `node_modules/` noise to your target repo

```bash
cd ..
mkdir workflow-cli
cd workflow-cli
npm init -y
```

3. Install the published package

```bash
npm install agent-workflow-studio
```

4. Initialize the workflow scaffold

```bash
npx agent-workflow init --root ../demo-repo
```

5. Scan the repo and generate the bootstrap prompt for memory docs

```bash
npx agent-workflow scan --root ../demo-repo
npx agent-workflow memory:bootstrap --root ../demo-repo
```

6. Create the first task bundle fast

```bash
npx agent-workflow quick "Ship the first feature slice" --task-id T-001 --priority P1 --recipe feature --agent codex --root ../demo-repo
```

7. Validate the generated workflow state

```bash
npx agent-workflow validate --root ../demo-repo
```

8. Open the local control plane

```bash
npx agent-workflow dashboard --root ../demo-repo --port 4173
```

Then open `http://localhost:4173`.
The Task Actions panel now also includes a `Quick Create` card that uses the same durable quick-task service as the CLI, so browser-driven bootstrapping still produces the same prompt, run-request, launch pack, and checkpoint files.

## What you should see

After the verified quick-start flow, the repo should contain:

```text
.agent-workflow/
  project.json
  project-profile.json
  project-profile.md
  handoffs/
    memory-bootstrap.md
  tasks/
    T-001/
      task.md
      context.md
      verification.md
      prompt.codex.md
      run-request.codex.json
      launch.codex.md
      checkpoint.md
```

## What to do next

- review `.agent-workflow/handoffs/memory-bootstrap.md` and give it to Codex or Claude Code
- after saving grounded memory notes, run `npx agent-workflow memory:validate --root ../demo-repo`
- review `task.md`, `context.md`, and `verification.md`
- give `prompt.codex.md` or `prompt.claude.md` to your agent
- after the run, record evidence and refresh the checkpoint

## Notes

- keep everything repo-relative; do not hard-code machine paths into workflow files
- `memory:validate` is expected to fail until you replace scaffold memory lines with repo-grounded notes
- Git mode gives the strongest verification view, so initializing a Git repo early is recommended
- `quick` is a shortcut over the same durable task artifacts, not a separate hidden runtime
