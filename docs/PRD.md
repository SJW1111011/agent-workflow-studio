# Product Requirements Document

## Product name

Agent Workflow Studio

## Problem

Coding agents are powerful, but teams still lose time and trust because:

- prompts are ad hoc
- project memory is fragmented
- task state is hard to reconstruct
- verification is often implied instead of proven
- context compaction breaks long-running work

## Product vision

Build a local-first workflow OS and project control plane that sits above Codex and Claude Code.

It should convert repository knowledge into stable execution context, convert tasks into high-quality prompts, and convert runs into auditable evidence and resumable checkpoints.

## Users

1. Solo builders who want a disciplined agent workflow.
2. Small product teams running coding agents on shared repositories.
3. Reviewers who need to understand what an agent read, changed, and verified.
4. Open-source maintainers who want reproducible agent contributions.

## Core user stories

1. As a builder, I want to initialize a workflow layer inside any repository.
2. As a builder, I want each task to have a structured home for goals, scope, risk, and verification.
3. As a builder, I want Codex and Claude Code prompts compiled from the same source of truth.
4. As a reviewer, I want to inspect runs, evidence, risks, and memory freshness in one panel.
5. As a long-running project owner, I want a checkpoint that lets a new agent resume safely.

## MVP scope

### In scope

- local workflow scaffold
- repository scanner
- task packages
- prompt compiler
- run ledger
- checkpoint generator
- dashboard for overview, tasks, memory, risks, and verification

### Out of scope

- cloud sync
- hosted execution
- full issue tracker replacement
- IDE replacement
- general-purpose multi-tenant permissions

## Success criteria

- a new repository can be workflow-enabled in under five minutes
- every task has a reproducible prompt and checkpoint trail
- a reviewer can identify stale memory and missing verification quickly
- moving the project directory does not break local usage

## Risks

- vendors ship overlapping features quickly
- documentation quality decays without freshness rules
- teams over-document and under-verify
- dashboards become decorative if they are disconnected from execution

## Product principles

1. Local first.
2. Git native.
3. Evidence over vibes.
4. Structured memory over prompt sprawl.
5. Resumability is a first-class feature.

