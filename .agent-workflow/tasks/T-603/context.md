# T-603 Context

## Why now

Agents can already finish a task with durable run evidence, but they still lack a lightweight way to leave incremental breadcrumbs or a structured summary of what happened during the session. This task closes that gap so future handoffs can see both mid-flight activity and richer final evidence without inventing a second workflow system.

<!-- agent-workflow:managed:context-recipe-guidance:start -->
## Recipe guidance

- Recipe ID: feature
- Recommended for: feature delivery, scoped implementation, incremental release
<!-- agent-workflow:managed:context-recipe-guidance:end -->

## Facts

- `workflow_done` already owns durable run recording and checkpoint refresh, so `evidenceContext` needed to extend that path instead of creating a parallel completion contract.
- Activity breadcrumbs share the task `runs/` folder, which means run readers and validators must ignore `activity-*.json` files or they will treat breadcrumbs as malformed runs.
- `GET /api/tasks/:taskId` already returns the spread `getTaskDetail()` payload, so exposing `activityRecords[]` only required enriching task detail data and keeping the run list clean.
- Full automated coverage passed on 2026-04-22 with `npm test` (`39` files, `189` tests), including new backend tests for MCP tool listing, `workflow_done` evidence-context backfill, activity persistence, and task-detail API output.

## Open questions

- Should activity records eventually have a retention cap or cleanup flow when long-running tasks emit many breadcrumbs?

## Progress notes

### 2026-04-22T15:02:44.3104284+08:00

Read the T-603 task bundle and project memory, then traced the current MCP tool surface, run persistence, and task-detail API so the new activity evidence could plug into the existing contracts instead of forking them.

### 2026-04-22T15:05:00.000+08:00

Implemented `workflow_record_activity`, added `evidenceContext` support to `workflow_done`, split activity breadcrumbs from normal run records in task-service and validation paths, and added regression coverage for the new MCP and API behavior.

### 2026-04-22T15:05:30.000+08:00

Ran the focused activity-evidence tests, then reran the full `npm test` suite and captured the passing output in `.agent-workflow/tasks/T-603/runs/npm-test-20260422.log`.

## Constraints

<!-- agent-workflow:managed:context-constraints-meta:start -->
- Priority: P1
- Keep the workflow docs current.
<!-- agent-workflow:managed:context-constraints-meta:end -->
