let activeTaskId = null;
let activeTaskDetail = null;
let activeDocumentName = "task.md";
let activeExecutorOutcomeFilter = "all";
let executionPollHandle = null;
let executionPollTaskId = null;
let executionLogTaskId = null;
let executionLogOpenStreams = new Set();
const CHECK_STATUSES = new Set(["passed", "failed", "recorded", "info"]);
const EXECUTOR_OUTCOME_FILTERS = new Set(["all", "passed", "failed", "timed-out", "interrupted", "cancelled", "none"]);

const EDITABLE_DOCUMENTS = {
  "task.md": {
    detailField: "taskText",
    note: "Task title and managed recipe block stay synced from task.json. Use repo-relative paths in Scope for stronger verification gates.",
    managedSections: [
      "Heading from task id/title",
      "Recipe block from task.json and the active recipe",
    ],
    freeSections: [
      "Goal",
      "Scope",
      "Required docs",
      "Deliverables",
      "Risks",
    ],
  },
  "context.md": {
    detailField: "contextText",
    note: "Managed recipe guidance and priority constraints stay synced from task.json.",
    managedSections: [
      "Heading from task id",
      "Recipe guidance block from the active recipe",
      "Priority and workflow reminder lines inside Constraints",
    ],
    freeSections: [
      "Why now",
      "Facts",
      "Open questions",
      "Any extra custom constraints",
    ],
  },
  "verification.md": {
    detailField: "verificationText",
    note: "Run evidence can still append to verification.md after edits. Use Proof links with repo-relative files plus check/result/artifact refs for stronger coverage. The draft shortcut can add planned manual checks and file-only Proof links, but it still stays non-authoritative until you complete the proof.",
    managedSections: [
      "Heading from task id",
    ],
    freeSections: [
      "Planned checks",
      "Proof links",
      "Blocking gaps",
      "Any manual notes between evidence refreshes",
    ],
  },
};

async function fetchJson(url, options = {}) {
  const response = await fetch(url, options);
  const isJson = (response.headers.get("content-type") || "").includes("application/json");
  const payload = isJson ? await response.json() : null;

  if (!response.ok) {
    throw new Error((payload && payload.error) || `Failed to load ${url}`);
  }

  return payload;
}

function postJson(url, body) {
  return fetchJson(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function patchJson(url, body) {
  return fetchJson(url, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function putJson(url, body) {
  return fetchJson(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

function parseRunEvidenceDraft(values = {}) {
  const status = String(values.status || "draft").trim().toLowerCase();
  const scopeProofPaths = parseRepoRelativeList(values.scopeProofPaths || values.proofPaths || "");
  const verificationArtifacts = parseRepoRelativeList(values.verificationArtifacts || values.artifacts || "");
  const verificationChecks = parseRunChecks(values.verificationChecks || values.checks || "", status);

  return omitEmptyEvidenceFields({
    scopeProofPaths,
    verificationChecks,
    verificationArtifacts,
  });
}

function parseRunChecks(text, runStatus) {
  const fallbackStatus = defaultCheckStatusForRun(runStatus);
  return splitLineEntries(text)
    .map((line) => parseRunCheckLine(line, fallbackStatus))
    .filter(Boolean);
}

function parseRunCheckLine(line, fallbackStatus) {
  const parts = String(line || "")
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean);

  if (parts.length === 0) {
    return null;
  }

  let status = fallbackStatus;
  let label = parts[0];
  let details;
  let artifacts = [];

  if (parts.length > 1 && CHECK_STATUSES.has(parts[0].toLowerCase())) {
    status = parts[0].toLowerCase();
    label = parts[1] || "";
    details = parts[2] || undefined;
    artifacts = parseLooseList(parts.slice(3).join("|"));
  } else {
    details = parts[1] || undefined;
    artifacts = parseLooseList(parts.slice(2).join("|"));
  }

  if (!label) {
    return null;
  }

  return omitUndefinedFields({
    label,
    status,
    details,
    artifacts: artifacts.length > 0 ? artifacts : undefined,
  });
}

function parseRepoRelativeList(text) {
  return uniqueStrings(parseLooseList(text));
}

function getPendingProofPaths(detail) {
  return uniqueStrings(
    detail && detail.verificationGate && Array.isArray(detail.verificationGate.relevantChangedFiles)
      ? detail.verificationGate.relevantChangedFiles.map((item) => item.path).filter(Boolean)
      : []
  );
}

function collectRunDraftValues() {
  return {
    status: document.getElementById("run-status").value,
    scopeProofPaths: document.getElementById("run-proof-paths").value,
    verificationChecks: document.getElementById("run-checks").value,
    verificationArtifacts: document.getElementById("run-artifacts").value,
  };
}

function mergeProofPathDraft(currentText, detail) {
  return uniqueStrings(parseRepoRelativeList(currentText).concat(getPendingProofPaths(detail))).join("\n");
}

function buildPendingProofCheckLines(detail) {
  return getPendingProofPaths(detail).map((item) => `Review ${item} diff`);
}

function mergeProofCheckDraft(currentText, detail, runStatus) {
  const existingLines = splitLineEntries(currentText);
  const fallbackStatus = defaultCheckStatusForRun(String(runStatus || "").trim().toLowerCase());
  const existingLabels = new Set(
    existingLines
      .map((line) => parseRunCheckLine(line, fallbackStatus))
      .filter(Boolean)
      .map((item) => item.label)
  );
  const nextLines = buildPendingProofCheckLines(detail).filter((line) => {
    const parsed = parseRunCheckLine(line, fallbackStatus);
    return parsed && !existingLabels.has(parsed.label);
  });

  return existingLines.concat(nextLines).join("\n");
}

function buildVerificationProofDraft(detail, currentText = "") {
  return buildVerificationProofDraftFromPaths(getPendingProofPaths(detail), currentText);
}

function buildVerificationProofDraftFromPaths(paths, currentText = "") {
  const existingPaths = extractVerificationProofPaths(currentText);
  const nextProofPaths = uniqueStrings(paths).filter((item) => item && !existingPaths.has(item));
  const nextProofNumber = getNextProofNumber(currentText);

  return nextProofPaths
    .map(
      (item, index) => `### Proof ${nextProofNumber + index}

- Files: ${item}
- Check:
- Result:
- Artifact:`
    )
    .join("\n\n");
}

function buildVerificationPlannedCheckDraft(detail, currentText = "") {
  const existingChecks = extractVerificationPlannedManualChecks(currentText);

  return buildPendingProofCheckLines(detail)
    .filter((item) => !existingChecks.has(item))
    .map((item) => `- manual: ${item}`)
    .join("\n");
}

function parseRunVerificationDraft(values = {}) {
  const status = String(values.status || "draft").trim().toLowerCase();
  return {
    status,
    scopeProofPaths: parseRepoRelativeList(values.scopeProofPaths || values.proofPaths || ""),
    verificationChecks: parseRunChecks(values.verificationChecks || values.checks || "", status),
  };
}

function buildVerificationPlannedCheckDraftFromRunDraft(values = {}, currentText = "") {
  const existingChecks = extractVerificationPlannedManualChecks(currentText);
  const runDraft = parseRunVerificationDraft(values);

  return runDraft.verificationChecks
    .map((item) => formatVerificationPlannedCheck(item))
    .filter(Boolean)
    .filter((item) => !existingChecks.has(item))
    .map((item) => `- manual: ${item}`)
    .join("\n");
}

function formatVerificationPlannedCheck(check) {
  if (!check || !check.label) {
    return "";
  }

  return check.details ? `${check.label} - ${check.details}` : check.label;
}

function mergeVerificationPlannedCheckDraft(currentText, detail) {
  const draftLines = buildVerificationPlannedCheckDraft(detail, currentText);
  return mergeVerificationPlannedCheckLines(currentText, draftLines);
}

function mergeVerificationPlannedCheckLines(currentText, draftLines) {
  const normalized = String(currentText || "").replace(/\r\n/g, "\n").trim();

  if (!draftLines) {
    return normalized;
  }

  if (!normalized) {
    return `## Planned checks\n\n${draftLines}`;
  }

  const plannedRange = findMarkdownSectionRange(normalized, "Planned checks");
  if (plannedRange) {
    const existingBody = normalized.slice(plannedRange.bodyStart, plannedRange.end).trim();
    const mergedSection = `## Planned checks\n\n${[existingBody, draftLines].filter(Boolean).join("\n")}`;
    return [normalized.slice(0, plannedRange.start).trimEnd(), mergedSection, normalized.slice(plannedRange.end).trimStart()]
      .filter(Boolean)
      .join("\n\n");
  }

  const proofRange = findMarkdownSectionRange(normalized, "Proof links") || findMarkdownSectionRange(normalized, "Proof Links");
  if (proofRange) {
    const plannedSection = `## Planned checks\n\n${draftLines}`;
    return [normalized.slice(0, proofRange.start).trimEnd(), plannedSection, normalized.slice(proofRange.start).trimStart()]
      .filter(Boolean)
      .join("\n\n");
  }

  return `${normalized}\n\n## Planned checks\n\n${draftLines}`;
}

function mergeVerificationProofDraft(currentText, detail) {
  return mergeVerificationProofDraftFromPaths(currentText, getPendingProofPaths(detail));
}

function mergeVerificationProofDraftFromPaths(currentText, paths) {
  const draftBlocks = buildVerificationProofDraftFromPaths(paths, currentText);
  const normalized = String(currentText || "").replace(/\r\n/g, "\n").trim();

  if (!draftBlocks) {
    return normalized;
  }

  if (!normalized) {
    return `## Proof links\n\n${draftBlocks}`;
  }

  const proofRange = findMarkdownSectionRange(normalized, "Proof links") || findMarkdownSectionRange(normalized, "Proof Links");
  if (proofRange) {
    const existingBody = normalized.slice(proofRange.bodyStart, proofRange.end).trim();
    const mergedSection = `## ${proofRange.title}\n\n${[existingBody, draftBlocks].filter(Boolean).join("\n\n")}`;
    return [normalized.slice(0, proofRange.start).trimEnd(), mergedSection, normalized.slice(proofRange.end).trimStart()]
      .filter(Boolean)
      .join("\n\n");
  }

  const blockingRange = findMarkdownSectionRange(normalized, "Blocking gaps");
  if (blockingRange) {
    const proofSection = `## Proof links\n\n${draftBlocks}`;
    return [normalized.slice(0, blockingRange.start).trimEnd(), proofSection, normalized.slice(blockingRange.start).trimStart()]
      .filter(Boolean)
      .join("\n\n");
  }

  return `${normalized}\n\n## Proof links\n\n${draftBlocks}`;
}

function mergeVerificationProofPlanDraft(currentText, detail) {
  return mergeVerificationProofDraft(mergeVerificationPlannedCheckDraft(currentText, detail), detail);
}

function mergeVerificationFromRunDraft(currentText, values = {}) {
  const normalized = String(currentText || "").replace(/\r\n/g, "\n").trim();
  const runDraft = parseRunVerificationDraft(values);
  const plannedDraft = buildVerificationPlannedCheckDraftFromRunDraft(values, normalized);
  const withPlannedChecks = mergeVerificationPlannedCheckLines(normalized, plannedDraft);
  return mergeVerificationProofDraftFromPaths(withPlannedChecks, runDraft.scopeProofPaths);
}

function hasRunDraftVerificationContent(values = {}) {
  const runDraft = parseRunVerificationDraft(values);
  return runDraft.scopeProofPaths.length > 0 || runDraft.verificationChecks.length > 0;
}

function extractVerificationProofPaths(text) {
  const proofSection = getMarkdownSection(text, "Proof links") || getMarkdownSection(text, "Proof Links");
  const proofPaths = new Set();

  splitLineEntries(proofSection).forEach((line) => {
    const normalized = String(line || "").replace(/^\s*[-*+]\s*/, "").trim();
    if (/^(?:files?|paths?)\s*:/i.test(normalized)) {
      const value = normalized.slice(normalized.indexOf(":") + 1).trim();
      parseRepoRelativeList(value).forEach((item) => {
        proofPaths.add(item);
      });
    }
  });

  return proofPaths;
}

function extractVerificationPlannedManualChecks(text) {
  const plannedSection = getMarkdownSection(text, "Planned checks");
  const plannedChecks = new Set();

  splitLineEntries(plannedSection).forEach((line) => {
    const normalized = String(line || "").replace(/^\s*[-*+]\s*/, "").trim();
    if (/^manual\s*:/i.test(normalized)) {
      const value = normalized.slice(normalized.indexOf(":") + 1).trim();
      if (value) {
        plannedChecks.add(value);
      }
    }
  });

  return plannedChecks;
}

function getNextProofNumber(text) {
  const matches = Array.from(String(text || "").matchAll(/^###\s+Proof\s+(\d+)/gm));
  if (matches.length === 0) {
    return 1;
  }

  const maxValue = matches.reduce((current, match) => {
    const numeric = Number(match[1]);
    return Number.isFinite(numeric) && numeric > current ? numeric : current;
  }, 0);
  return maxValue + 1;
}

function getMarkdownSection(text, title) {
  const range = findMarkdownSectionRange(text, title);
  return range ? String(text || "").replace(/\r\n/g, "\n").slice(range.bodyStart, range.end).trim() : "";
}

function findMarkdownSectionRange(text, title) {
  const normalized = String(text || "").replace(/\r\n/g, "\n");
  if (!normalized.trim()) {
    return null;
  }

  const lines = normalized.split("\n");
  const headingLine = `## ${title}`;
  const lineOffsets = [];
  let offset = 0;

  lines.forEach((line) => {
    lineOffsets.push(offset);
    offset += line.length + 1;
  });

  const startLine = lines.findIndex((line) => line.trim() === headingLine);
  if (startLine === -1) {
    return null;
  }

  let endLine = lines.length;
  for (let index = startLine + 1; index < lines.length; index += 1) {
    if (lines[index].startsWith("## ")) {
      endLine = index;
      break;
    }
  }

  const start = lineOffsets[startLine];
  const bodyStart = start + lines[startLine].length + 1;
  const end = endLine < lines.length ? lineOffsets[endLine] - 1 : normalized.length;

  return {
    title,
    start,
    bodyStart: Math.min(bodyStart, normalized.length),
    end: Math.max(bodyStart, end),
  };
}

function parseLooseList(text) {
  return String(text || "")
    .split(/\r?\n/)
    .flatMap((line) => line.split(/[;,]/))
    .map((entry) => entry.trim())
    .filter(Boolean);
}

function splitLineEntries(text) {
  return String(text || "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function defaultCheckStatusForRun(status) {
  if (status === "passed") {
    return "passed";
  }
  if (status === "failed") {
    return "failed";
  }
  return "recorded";
}

function uniqueStrings(values) {
  return Array.from(new Set((Array.isArray(values) ? values : []).filter(Boolean)));
}

function omitUndefinedFields(value) {
  return Object.fromEntries(Object.entries(value || {}).filter(([, item]) => item !== undefined));
}

function omitEmptyEvidenceFields(value) {
  return Object.fromEntries(
    Object.entries(value || {}).filter(([, item]) => {
      if (Array.isArray(item)) {
        return item.length > 0;
      }

      return item !== undefined;
    })
  );
}

async function loadOverview() {
  return fetchJson("/api/overview");
}

async function loadTaskDetail(taskId) {
  return fetchJson(`/api/tasks/${encodeURIComponent(taskId)}`);
}

async function loadTaskExecution(taskId) {
  return fetchJson(`/api/tasks/${encodeURIComponent(taskId)}/execution`);
}

async function loadTaskExecutionLog(taskId, stream, maxChars = 6000) {
  const params = new URLSearchParams();
  params.set("maxChars", String(maxChars));
  return fetchJson(`/api/tasks/${encodeURIComponent(taskId)}/execution/logs/${encodeURIComponent(stream)}?${params.toString()}`);
}

async function loadRunLog(taskId, runId, stream) {
  return fetchJson(
    `/api/tasks/${encodeURIComponent(taskId)}/runs/${encodeURIComponent(runId)}/logs/${encodeURIComponent(stream)}`
  );
}

function isDashboardCancelSignal(signal) {
  return String(signal || "").trim().toLowerCase() === "dashboard-cancel";
}

function isDashboardCancelledRun(run) {
  return Boolean(run && run.interrupted && isDashboardCancelSignal(run.interruptionSignal));
}

function normalizeExecutionOutcome(executionState) {
  const state = executionState && typeof executionState === "object" ? executionState : {};
  if (typeof state.outcome === "string" && state.outcome.trim()) {
    return state.outcome.trim().toLowerCase();
  }

  if (state.status !== "completed") {
    return state.status === "failed-to-start" ? "failed-to-start" : "";
  }

  if (String(state.summary || "").includes("dashboard-cancel")) {
    return "cancelled";
  }
  if (String(state.summary || "").includes("timed out")) {
    return "timed-out";
  }
  if (String(state.summary || "").includes("interrupted")) {
    return "interrupted";
  }
  if (state.runStatus === "passed") {
    return "passed";
  }
  if (state.runStatus === "failed") {
    return "failed";
  }

  return "";
}

function describeRunOutcome(run) {
  if (isDashboardCancelledRun(run)) {
    return {
      label: "cancelled",
      warn: false,
      summary: "Cancelled from dashboard.",
      detail: "The shared executor stopped after a local dashboard cancel request.",
    };
  }

  if (run && run.timedOut) {
    return {
      label: "timed out",
      warn: true,
      summary: run.summary || "Execution hit its configured timeout.",
      detail: run.timeoutMs ? `Timeout configured at ${run.timeoutMs} ms.` : "Execution hit its configured timeout.",
    };
  }

  if (run && run.interrupted) {
    return {
      label: "interrupted",
      warn: true,
      summary: run.summary || "Execution was interrupted before completion.",
      detail: run.interruptionSignal ? `Interrupted by ${run.interruptionSignal}.` : "Execution was interrupted before completion.",
    };
  }

  if (run && run.status === "failed") {
    return {
      label: "failed",
      warn: true,
      summary: run.summary || "Execution failed.",
      detail: run.errorMessage || (run.exitCode === undefined || run.exitCode === null ? "Execution failed." : `Exit code ${run.exitCode}.`),
    };
  }

  if (run && run.status === "passed") {
    return {
      label: "passed",
      warn: false,
      summary: run.summary || "Execution completed successfully.",
      detail: run.exitCode === undefined || run.exitCode === null ? "Evidence recorded." : `Exit code ${run.exitCode}.`,
    };
  }

  return {
    label: run && run.status ? run.status : "pending",
    warn: false,
    summary: run && run.summary ? run.summary : "No summary recorded.",
    detail: "",
  };
}

function describeExecutionState(executionState) {
  const state = executionState && typeof executionState === "object" ? executionState : { status: "idle" };
  const adapterLabel = state.adapterId || "adapter";
  const outcome = normalizeExecutionOutcome(state);

  if (state.status === "starting") {
    return {
      statusLabel: "starting",
      warn: false,
      summary: `Starting local ${adapterLabel} execution.`,
    };
  }

  if (state.status === "running") {
    return {
      statusLabel: "running",
      warn: false,
      summary: `Local ${adapterLabel} execution is running.`,
    };
  }

  if (state.status === "cancel-requested") {
    return {
      statusLabel: "cancel requested",
      warn: true,
      summary: `Cancellation requested for local ${adapterLabel} execution.`,
    };
  }

  if (state.status === "failed-to-start") {
    return {
      statusLabel: "failed to start",
      warn: true,
      summary: state.error || `Local ${adapterLabel} execution failed to start.`,
    };
  }

  if (state.status === "completed") {
    const resolvedOutcome =
      outcome === "cancelled"
        ? {
            label: "cancelled",
            warn: false,
            summary: "Cancelled from dashboard.",
          }
        : outcome === "timed-out"
          ? {
              label: "timed out",
              warn: true,
              summary: state.summary || "Execution hit its configured timeout.",
            }
          : outcome === "interrupted"
            ? {
                label: "interrupted",
                warn: true,
                summary: state.summary || "Execution was interrupted before completion.",
              }
            : outcome === "passed"
              ? {
                  label: "passed",
                  warn: false,
                  summary: state.summary || "Execution completed successfully.",
                }
              : {
                  label: "failed",
                  warn: true,
                  summary: state.summary || "Execution failed.",
                };

    return {
      statusLabel: resolvedOutcome.label,
      warn: resolvedOutcome.warn,
      summary:
        resolvedOutcome.label === "cancelled"
          ? `Local ${adapterLabel} execution was cancelled from dashboard.`
          : resolvedOutcome.label === "passed"
            ? `Local ${adapterLabel} execution completed successfully.`
            : state.summary || resolvedOutcome.summary,
    };
  }

  return {
    statusLabel: "idle",
    warn: false,
    summary: "No dashboard-triggered execution for the selected task yet.",
  };
}

function describeExecutorOutcome(outcome, summary) {
  const normalized = String(outcome || "").trim().toLowerCase();

  if (normalized === "cancelled") {
    return {
      label: "executor cancelled",
      warn: false,
      summary: summary || "Latest local executor run was cancelled from dashboard.",
    };
  }

  if (normalized === "timed-out") {
    return {
      label: "executor timed out",
      warn: true,
      summary: summary || "Latest local executor run timed out.",
    };
  }

  if (normalized === "interrupted") {
    return {
      label: "executor interrupted",
      warn: true,
      summary: summary || "Latest local executor run was interrupted.",
    };
  }

  if (normalized === "passed") {
    return {
      label: "executor passed",
      warn: false,
      summary: summary || "Latest local executor run completed successfully.",
    };
  }

  if (normalized === "failed") {
    return {
      label: "executor failed",
      warn: true,
      summary: summary || "Latest local executor run failed.",
    };
  }

  return null;
}

function normalizeExecutorOutcomeFilter(value) {
  const normalized = String(value || "all").trim().toLowerCase();
  return EXECUTOR_OUTCOME_FILTERS.has(normalized) ? normalized : "all";
}

function matchesExecutorOutcomeFilter(task, filterValue) {
  const normalized = normalizeExecutorOutcomeFilter(filterValue);
  const outcome = String((task && task.latestExecutorOutcome) || "").trim().toLowerCase();

  if (normalized === "all") {
    return true;
  }

  if (normalized === "none") {
    return !outcome;
  }

  return outcome === normalized;
}

function filterTasksByExecutorOutcome(tasks, filterValue) {
  return (Array.isArray(tasks) ? tasks : []).filter((task) => matchesExecutorOutcomeFilter(task, filterValue));
}

function describeExecutorOutcomeFilter(filterValue) {
  const normalized = normalizeExecutorOutcomeFilter(filterValue);
  if (normalized === "all") {
    return "all tasks";
  }
  if (normalized === "none") {
    return "tasks without executor runs";
  }
  return `tasks with executor outcome ${normalized}`;
}

function summarizeExecutorOutcomeFilter(totalCount, visibleCount, filterValue) {
  const filterLabel = describeExecutorOutcomeFilter(filterValue);
  return `Showing ${visibleCount} of ${totalCount} ${filterLabel}.`;
}

function getTaskCardToneClass(task) {
  const executorOutcome = describeExecutorOutcome(task && task.latestExecutorOutcome, task && task.latestExecutorSummary);
  if (!executorOutcome) {
    return "";
  }

  const normalized = normalizeExecutorOutcomeFilter(task.latestExecutorOutcome);
  if (normalized === "passed") {
    return "task-card-executor-ok";
  }
  if (normalized === "cancelled") {
    return "task-card-executor-cancelled";
  }
  if (normalized === "timed-out" || normalized === "interrupted" || normalized === "failed") {
    return "task-card-executor-warn";
  }

  return "";
}

function normalizeExecutorOutcomeStats(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    passed: normalizeStatCount(source.passed),
    failed: normalizeStatCount(source.failed),
    timedOut: normalizeStatCount(source.timedOut),
    interrupted: normalizeStatCount(source.interrupted),
    cancelled: normalizeStatCount(source.cancelled),
    none: normalizeStatCount(source.none),
  };
}

function normalizeStatCount(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) && numeric >= 0 ? numeric : 0;
}

function countTasksWithExecutorOutcome(executorStats) {
  const normalized = normalizeExecutorOutcomeStats(executorStats);
  return (
    normalized.passed +
    normalized.failed +
    normalized.timedOut +
    normalized.interrupted +
    normalized.cancelled
  );
}

function renderExecutorOutcomeStatCard(totalTasks, executorStats) {
  const normalized = normalizeExecutorOutcomeStats(executorStats);
  const executedTasks = countTasksWithExecutorOutcome(normalized);
  const breakdown = [
    ["Passed", normalized.passed, false],
    ["Failed", normalized.failed, true],
    ["Timed out", normalized.timedOut, true],
    ["Interrupted", normalized.interrupted, true],
    ["Cancelled", normalized.cancelled, false],
    ["No run", normalized.none, false],
  ];
  const summary =
    totalTasks > 0
      ? `${executedTasks} of ${totalTasks} tasks have local executor evidence.`
      : "No tasks yet.";

  return `
    <article class="stat-card stat-card-breakdown">
      <h3>Executor Outcomes</h3>
      <strong>${escapeHtml(executedTasks)}</strong>
      <p class="stat-caption">${escapeHtml(summary)}</p>
      <dl class="stat-breakdown">
        ${breakdown
          .map(
            ([label, value, warn]) => `
              <div class="stat-breakdown-item ${warn ? "warn" : ""}">
                <dt>${escapeHtml(label)}</dt>
                <dd>${escapeHtml(value)}</dd>
              </div>
            `
          )
          .join("")}
      </dl>
    </article>
  `;
}

function renderStats(stats) {
  const container = document.getElementById("stats");
  const entries = [
    ["Tasks", stats.tasks],
    ["Runs", stats.runs],
    ["Risks", stats.risks],
    ["Memory Docs", stats.memoryDocs],
  ];

  container.innerHTML = entries
    .map(
      ([label, value]) => `
        <article class="stat-card">
          <h3>${label}</h3>
          <strong>${escapeHtml(value)}</strong>
        </article>
      `
    )
    .concat(renderExecutorOutcomeStatCard(normalizeStatCount(stats.tasks), stats.executorOutcomes))
    .join("");
}

function renderTasks(tasks) {
  const allTasks = Array.isArray(tasks) ? tasks : [];
  const visibleTasks = filterTasksByExecutorOutcome(allTasks, activeExecutorOutcomeFilter);
  const container = document.getElementById("tasks");
  const summaryNode = document.getElementById("task-filter-summary");
  const filterNode = document.getElementById("task-executor-filter");

  if (summaryNode) {
    summaryNode.textContent = summarizeExecutorOutcomeFilter(allTasks.length, visibleTasks.length, activeExecutorOutcomeFilter);
  }
  if (filterNode) {
    filterNode.value = normalizeExecutorOutcomeFilter(activeExecutorOutcomeFilter);
  }

  if (!visibleTasks.length) {
    container.innerHTML =
      allTasks.length === 0
        ? '<div class="empty">Nothing here yet.</div>'
        : '<div class="empty">No tasks match the current executor outcome filter.</div>';
    return;
  }

  container.innerHTML = visibleTasks
    .map((task) => {
      const executorOutcome = describeExecutorOutcome(task.latestExecutorOutcome, task.latestExecutorSummary);
      const cardToneClass = getTaskCardToneClass(task);
      return `
        <article class="task-card ${cardToneClass} ${task.id === activeTaskId ? "active" : ""}" data-task-id="${escapeHtml(task.id)}">
          <h3>${task.id} - ${escapeHtml(task.title || "Untitled task")}</h3>
          <p class="task-meta">Priority ${escapeHtml(task.priority || "P2")} | ${escapeHtml(task.status || "todo")} | Recipe ${escapeHtml(task.recipeId || "feature")}</p>
          <p>${escapeHtml(task.latestRunSummary || "No runs yet")}</p>
          ${
            executorOutcome
              ? `<p class="subtle">Latest executor: ${escapeHtml(executorOutcome.summary)}${task.latestExecutorAt ? ` (${escapeHtml(formatTimestampLabel(task.latestExecutorAt))})` : ""}</p>`
              : ""
          }
          <div class="tag-row">
            <span class="tag">${task.hasCodexPrompt ? "Codex prompt" : "No Codex prompt"}</span>
            <span class="tag">${task.hasClaudePrompt ? "Claude prompt" : "No Claude prompt"}</span>
            <span class="tag ${task.freshnessStatus === "stale" ? "warn" : ""}">${escapeHtml(task.freshnessStatus === "stale" ? `Docs stale (${task.staleDocCount || 0})` : "Docs fresh")}</span>
            <span class="tag ${isVerificationGateWarning(task.verificationGateStatus) ? "warn" : ""}">${escapeHtml(formatVerificationGateLabel(task.verificationGateStatus, task.relevantChangeCount || 0))}</span>
            <span class="tag ${task.latestRunStatus === "failed" ? "warn" : ""}">${escapeHtml(task.latestRunStatus)}</span>
            ${
              executorOutcome
                ? `<span class="tag ${executorOutcome.warn ? "warn" : ""}">${escapeHtml(executorOutcome.label)}</span>`
                : '<span class="tag">no executor run</span>'
            }
          </div>
        </article>
      `;
    })
    .join("");

  document.querySelectorAll("[data-task-id]").forEach((node) => {
    node.addEventListener("click", () => {
      selectTask(node.getAttribute("data-task-id"));
    });
  });
}

function renderAdapters(adapters) {
  renderCollection(
    "adapters",
    adapters,
    (adapter) => `
      <article class="list-item">
        <h3>${escapeHtml(adapter.displayName || adapter.adapterId)}</h3>
        <p class="subtle">${escapeHtml(adapter.adapterId)}</p>
        <div class="tag-row">
          <span class="tag ${adapter.exists ? "" : "warn"}">${adapter.exists ? "Configured" : "Missing"}</span>
          <span class="tag">${escapeHtml((((adapter.config && adapter.config.runnerCommand) || [])).join(" ") || "No runner hint")}</span>
        </div>
      </article>
    `
  );
}

function renderRecipes(recipes) {
  renderCollection(
    "recipes",
    recipes,
    (recipe) => `
      <article class="list-item">
        <h3>${escapeHtml(recipe.name)}</h3>
        <p>${escapeHtml(recipe.summary)}</p>
        <div class="tag-row">
          <span class="tag">${escapeHtml(recipe.id)}</span>
          <span class="tag">${escapeHtml((recipe.recommendedFor || []).join(", ") || "General")}</span>
        </div>
      </article>
    `
  );
}

function renderValidation(report) {
  const items = [];

  items.push({
    title: report.ok ? "Workspace schema looks coherent" : "Schema issues detected",
    body: `Errors: ${report.errorCount}, warnings: ${report.warningCount}`,
    warn: !report.ok,
  });

  (report.issues || []).slice(0, 5).forEach((issue) => {
    items.push({
      title: `${issue.level.toUpperCase()} - ${issue.code}`,
      body: `${issue.message} (${issue.target})`,
      warn: issue.level === "error",
    });
  });

  renderCollection(
    "validation",
    items,
    (item) => `
      <article class="list-item">
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.body)}</p>
        <div class="tag-row">
          <span class="tag ${item.warn ? "warn" : ""}">${item.warn ? "Needs attention" : "Healthy"}</span>
        </div>
      </article>
    `
  );
}

function renderExecutionStateMarkup(executionState) {
  const state = executionState && typeof executionState === "object" ? executionState : { status: "idle" };
  const taskId = state.taskId || "";
  const adapterLabel = state.adapterId || "adapter";
  const description = describeExecutionState(state);
  const tags = [
    createTag(description.statusLabel, description.warn),
    state.runStatus ? createTag(state.runStatus, state.runStatus === "failed") : "",
    state.stdioMode ? createTag(`stdio ${state.stdioMode}`, false) : "",
    typeof state.exitCode === "number" ? createTag(`exit ${state.exitCode}`, state.runStatus === "failed") : "",
  ]
    .filter(Boolean)
    .join("");

  if ((state.status || "idle") === "idle") {
    return '<div class="empty">No dashboard-triggered execution for this task yet.</div>';
  }

  const detailLines = [
    `<p>${escapeHtml(description.summary)}</p>`,
    state.startedAt ? `<p class="subtle">Started ${escapeHtml(formatTimestampLabel(state.startedAt))}</p>` : "",
    state.cancelRequestedAt ? `<p class="subtle">Cancel requested ${escapeHtml(formatTimestampLabel(state.cancelRequestedAt))}</p>` : "",
    state.completedAt ? `<p class="subtle">Completed ${escapeHtml(formatTimestampLabel(state.completedAt))}</p>` : "",
    state.runId ? `<p class="subtle">Run id: ${escapeHtml(state.runId)}</p>` : "",
    state.stdoutFile ? `<p class="subtle">stdout: ${escapeHtml(state.stdoutFile)}</p>` : "",
    state.stderrFile ? `<p class="subtle">stderr: ${escapeHtml(state.stderrFile)}</p>` : "",
    state.status === "completed" && state.summary && state.summary !== description.summary
      ? `<p class="subtle">${escapeHtml(state.summary)}</p>`
      : "",
    state.error ? `<p class="subtle run-error">${escapeHtml(state.error)}</p>` : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <article class="list-item">
      <h3>${escapeHtml(adapterLabel)}</h3>
      ${detailLines}
      <div class="tag-row">${tags}</div>
      ${renderExecutionLogActions(taskId, state)}
    </article>
  `;
}

function renderExecutionStateSummary(executionState) {
  const state = executionState && typeof executionState === "object" ? executionState : { status: "idle" };
  const description = describeExecutionState(state);

  if (state.status === "running") {
    return `${description.summary} Evidence will appear in task detail after it finishes.`;
  }
  if (state.status === "cancel-requested") {
    return `${description.summary} Waiting for the shared executor to exit cleanly.`;
  }
  if (state.status === "completed") {
    return `${description.summary}${state.runId ? ` (${state.runId})` : ""}`;
  }

  return description.summary;
}

function isActiveExecutionState(executionState) {
  return (
    executionState &&
    (executionState.status === "starting" ||
      executionState.status === "running" ||
      executionState.status === "cancel-requested")
  );
}

function updateExecutionStateUI(executionState) {
  const selectedTaskId = activeTaskDetail && activeTaskDetail.meta ? activeTaskDetail.meta.id : "";
  const state =
    executionState && executionState.taskId === selectedTaskId
      ? executionState
      : activeTaskDetail && activeTaskDetail.executionState && activeTaskDetail.executionState.taskId === selectedTaskId
        ? activeTaskDetail.executionState
        : selectedTaskId
          ? { taskId: selectedTaskId, status: "idle" }
          : null;
  const statusNode = document.getElementById("run-execution-status");
  const panelNode = document.getElementById("task-execution-state-panel");
  const executeButton = document.getElementById("run-execute-local");
  const cancelButton = document.getElementById("run-cancel-execution");
  const canCancel = state && (state.status === "starting" || state.status === "running");

  if (statusNode) {
    statusNode.textContent = selectedTaskId
      ? renderExecutionStateSummary(state)
      : "Select a task to view local execution status.";
  }

  if (panelNode) {
    panelNode.innerHTML = renderExecutionStateMarkup(state);
    if (selectedTaskId) {
      bindExecutionLogButtons(selectedTaskId, state);
      if (executionLogTaskId === selectedTaskId && executionLogOpenStreams.size > 0) {
        refreshOpenExecutionLogs(selectedTaskId, state);
      }
    }
  }

  if (executeButton) {
    executeButton.disabled = !selectedTaskId || isActiveExecutionState(state);
  }
  if (cancelButton) {
    cancelButton.disabled = !selectedTaskId || !canCancel;
  }
}

function clearExecutionPolling() {
  if (executionPollHandle) {
    clearTimeout(executionPollHandle);
  }
  executionPollHandle = null;
  executionPollTaskId = null;
}

function clearExecutionLogState(nextTaskId = null) {
  executionLogTaskId = nextTaskId;
  executionLogOpenStreams = new Set();
}

function ensureExecutionLogTask(taskId) {
  if (executionLogTaskId !== taskId) {
    clearExecutionLogState(taskId);
  }
}

function scheduleExecutionPolling(taskId, delayMs = 900) {
  clearExecutionPolling();
  executionPollTaskId = taskId;
  executionPollHandle = setTimeout(() => {
    executionPollHandle = null;
    pollExecutionState(taskId);
  }, delayMs);
}

async function pollExecutionState(taskId) {
  if (!activeTaskDetail || !activeTaskDetail.meta || activeTaskDetail.meta.id !== taskId) {
    clearExecutionPolling();
    return;
  }

  try {
    const state = await loadTaskExecution(taskId);
    if (activeTaskDetail && activeTaskDetail.meta && activeTaskDetail.meta.id === taskId) {
      activeTaskDetail.executionState = state;
    }
    updateExecutionStateUI(state);

    if (isActiveExecutionState(state)) {
      scheduleExecutionPolling(taskId);
      return;
    }

    clearExecutionPolling();
    if (state.status === "completed" || state.status === "failed-to-start") {
      await refreshDashboard(taskId);
      if (state.status === "completed") {
        const description = describeExecutionState(state);
        setActionStatus(
          `${description.summary.replace(/\.$/, "")} for ${taskId}.`,
          description.statusLabel === "passed" ? "success" : description.statusLabel === "cancelled" ? "" : "error"
        );
      } else {
        setActionStatus(state.error || `Local execution failed to start for ${taskId}.`, "error");
      }
    }
  } catch (error) {
    clearExecutionPolling();
    setActionStatus(error.message, "error");
  }
}

function getExecutionLogPanelId(stream) {
  return `execution-log-${String(stream || "").replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function buildExecutionLogPanelMarkup(taskId, state, stream) {
  const hasLog = Boolean(state && state[stream === "stderr" ? "stderrFile" : "stdoutFile"]);
  const isOpen = executionLogTaskId === taskId && executionLogOpenStreams.has(stream);

  if (!hasLog) {
    return "";
  }

  return `
    <div class="run-log-panel ${isOpen ? "" : "hidden"}" id="${getExecutionLogPanelId(stream)}">
      <p class="subtle">${escapeHtml(isActiveExecutionState(state) ? `Tail ${stream} from the active local execution.` : `View the latest cached ${stream} tail from this local execution.`)}</p>
    </div>
  `;
}

function renderExecutionLogActions(taskId, state) {
  const buttons = ["stdout", "stderr"]
    .map((stream) => {
      const hasLog = Boolean(state && state[stream === "stderr" ? "stderrFile" : "stdoutFile"]);
      if (!hasLog) {
        return "";
      }

      const isOpen = executionLogTaskId === taskId && executionLogOpenStreams.has(stream);
      const label = isOpen ? `Hide ${stream}` : isActiveExecutionState(state) ? `Tail ${stream}` : `View latest ${stream}`;
      return `<button type="button" class="log-button execution-log-button" data-task-id="${escapeHtml(taskId)}" data-execution-stream="${stream}">${escapeHtml(label)}</button>`;
    })
    .filter(Boolean);

  if (buttons.length === 0) {
    return "";
  }

  return `
    <div class="log-actions">${buttons.join("")}</div>
    ${buildExecutionLogPanelMarkup(taskId, state, "stdout")}
    ${buildExecutionLogPanelMarkup(taskId, state, "stderr")}
  `;
}

async function refreshOpenExecutionLogs(taskId, executionState) {
  if (!taskId || executionLogTaskId !== taskId || executionLogOpenStreams.size === 0) {
    return;
  }

  const state =
    executionState && executionState.taskId === taskId
      ? executionState
      : activeTaskDetail && activeTaskDetail.executionState && activeTaskDetail.executionState.taskId === taskId
        ? activeTaskDetail.executionState
        : null;

  const streams = Array.from(executionLogOpenStreams);
  await Promise.all(
    streams.map(async (stream) => {
      const panel = document.getElementById(getExecutionLogPanelId(stream));
      if (!panel) {
        return;
      }

      panel.classList.remove("hidden");
      panel.innerHTML = `<p class="subtle">Loading ${escapeHtml(stream)}...</p>`;

      try {
        const log = await loadTaskExecutionLog(taskId, stream);
        if (executionLogTaskId !== taskId || !executionLogOpenStreams.has(stream)) {
          return;
        }

        const latestPanel = document.getElementById(getExecutionLogPanelId(stream));
        if (!latestPanel) {
          return;
        }

        latestPanel.innerHTML = `
          <p class="subtle">Log path: ${escapeHtml(log.path)}</p>
          ${
            log.pending
              ? `<p class="subtle">${escapeHtml(`Waiting for ${stream} output to appear...`)}</p>`
              : log.truncated
                ? `<p class="subtle">${escapeHtml(`Showing last ${log.content.length} of ${log.size} chars.`)}</p>`
                : ""
          }
          ${
            log.updatedAt
              ? `<p class="subtle">${escapeHtml(`${log.active ? "Auto-refreshing" : "Last updated"} ${formatTimestampLabel(log.updatedAt)}`)}</p>`
              : ""
          }
          <pre class="detail-pre">${escapeHtml(log.content || (log.pending ? "" : "(empty log)"))}</pre>
        `;
      } catch (error) {
        if (executionLogTaskId !== taskId || !executionLogOpenStreams.has(stream)) {
          return;
        }

        const latestPanel = document.getElementById(getExecutionLogPanelId(stream));
        if (latestPanel) {
          latestPanel.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
        }
      }
    })
  );
}

function bindExecutionLogButtons(taskId, executionState) {
  document.querySelectorAll("[data-execution-stream]").forEach((button) => {
    button.addEventListener("click", async () => {
      const stream = button.getAttribute("data-execution-stream");
      ensureExecutionLogTask(taskId);

      if (executionLogOpenStreams.has(stream)) {
        executionLogOpenStreams.delete(stream);
      } else {
        executionLogOpenStreams.add(stream);
      }

      updateExecutionStateUI(executionState);
      if (executionLogOpenStreams.has(stream)) {
        await refreshOpenExecutionLogs(taskId, executionState);
      }
    });
  });
}

function renderTaskDetail(detail) {
  const previousTaskId = activeTaskDetail && activeTaskDetail.meta ? activeTaskDetail.meta.id : null;
  const container = document.getElementById("task-detail");
  activeTaskDetail = detail || null;

  if (!detail) {
    container.innerHTML = '<div class="empty">Select a task to inspect its detail bundle.</div>';
    clearExecutionPolling();
    clearExecutionLogState(null);
    populateTaskForms(null);
    updateExecutionStateUI(null);
    return;
  }

  if (previousTaskId !== detail.meta.id) {
    clearExecutionLogState(detail.meta.id);
  }

  const generatedFiles = (detail.generatedFiles || [])
    .map(
      (item) => `
        <article class="list-item">
          <h3>${escapeHtml(item.name)}</h3>
          <div class="tag-row">
            <span class="tag ${item.exists ? "" : "warn"}">${item.exists ? "Generated" : "Missing"}</span>
          </div>
        </article>
      `
    )
    .join("");

  const schemaIssues = (detail.schemaIssues || []).length
    ? (detail.schemaIssues || [])
        .map(
          (issue) => `
            <article class="list-item">
              <h3>${escapeHtml(issue.level.toUpperCase())} - ${escapeHtml(issue.code)}</h3>
              <p>${escapeHtml(issue.message)}</p>
              <p class="subtle">${escapeHtml(issue.target)}</p>
            </article>
          `
        )
        .join("")
    : '<div class="empty">No task-level schema issues detected.</div>';

  const runItems = (detail.runs || []).length
    ? (detail.runs || [])
        .map((run) => renderTaskRun(run, detail.meta.id))
        .join("")
    : '<div class="empty">No runs recorded yet.</div>';

  const freshnessItems = renderTaskFreshness(detail.freshness);
  const verificationGateItems = renderVerificationGate(detail.verificationGate);

  container.innerHTML = `
    <div class="detail-grid">
      <article class="detail-card">
        <h3>${escapeHtml(detail.meta.id)} - ${escapeHtml(detail.meta.title)}</h3>
        <p class="subtle">Priority ${escapeHtml(detail.meta.priority || "P2")} | Status ${escapeHtml(detail.meta.status || "todo")}</p>
        <div class="tag-row">
          <span class="tag">${escapeHtml((detail.recipe && detail.recipe.id) || detail.meta.recipeId || "feature")}</span>
          <span class="tag">${escapeHtml((detail.recipe && detail.recipe.name) || "Unknown recipe")}</span>
        </div>
        <p>${escapeHtml((detail.recipe && detail.recipe.summary) || "No recipe summary available.")}</p>
      </article>

      <article class="detail-card">
        <h3>Generated Files</h3>
        <div class="list">${generatedFiles}</div>
      </article>

      <article class="detail-card wide">
        <h3>Task Brief</h3>
        <pre class="detail-pre">${escapeHtml(detail.taskText || "No task.md content.")}</pre>
      </article>

      <article class="detail-card">
        <h3>Context</h3>
        <pre class="detail-pre">${escapeHtml(detail.contextText || "No context.md content.")}</pre>
      </article>

      <article class="detail-card">
        <h3>Verification</h3>
        <pre class="detail-pre">${escapeHtml(detail.verificationText || "No verification.md content.")}</pre>
      </article>

      <article class="detail-card">
        <h3>Checkpoint</h3>
        <pre class="detail-pre">${escapeHtml(detail.checkpointText || "No checkpoint.md content.")}</pre>
      </article>

      <article class="detail-card">
        <h3>Runs</h3>
        <div class="list">${runItems}</div>
      </article>

      <article class="detail-card">
        <h3>Execution Bridge</h3>
        <div class="list" id="task-execution-state-panel">${renderExecutionStateMarkup(detail.executionState)}</div>
      </article>

      <article class="detail-card">
        <h3>Schema Issues</h3>
        <div class="list">${schemaIssues}</div>
      </article>

      <article class="detail-card">
        <h3>Freshness</h3>
        <div class="list">${freshnessItems}</div>
      </article>

      <article class="detail-card">
        <h3>Verification Gate</h3>
        <div class="list">${verificationGateItems}</div>
      </article>
    </div>
  `;

  bindRunLogButtons(detail.meta.id);
  populateTaskForms(detail);
  updateExecutionStateUI(detail.executionState);
  if (isActiveExecutionState(detail.executionState)) {
    scheduleExecutionPolling(detail.meta.id);
  } else if (executionPollTaskId === detail.meta.id) {
    clearExecutionPolling();
  }
}

function renderMemory(memory) {
  renderCollection(
    "memory",
    memory,
    (item) => `
      <article class="list-item">
        <h3>${escapeHtml(item.name)}</h3>
        <p class="subtle">${escapeHtml(item.relativePath)}</p>
        <p class="subtle">${escapeHtml(item.freshnessReason || "")}</p>
        <div class="tag-row">
          <span class="tag ${item.placeholder || item.freshnessStatus === "stale" ? "warn" : ""}">${escapeHtml(item.freshnessStatus || (item.placeholder ? "placeholder" : "fresh"))}</span>
          <span class="tag">${item.size} chars</span>
          <span class="tag">${escapeHtml(formatTimestampLabel(item.modifiedAt))}</span>
        </div>
      </article>
    `
  );
}

function renderVerification(items) {
  renderCollection(
    "verification",
    items,
    (item) => `
      <article class="list-item">
        <h3>${escapeHtml(item.taskId)}</h3>
        <p>${escapeHtml(item.summary)}</p>
        <div class="tag-row">
          <span class="tag ${item.status === "failed" || isVerificationGateWarning(item.status) ? "warn" : ""}">${escapeHtml(item.status)}</span>
          ${item.relevantChangeCount ? `<span class="tag">${escapeHtml(`${item.relevantChangeCount} changed file(s)`)}</span>` : ""}
        </div>
      </article>
    `
  );
}

function renderRisks(risks) {
  renderCollection(
    "risks",
    risks,
    (risk) => `
      <article class="list-item">
        <h3>${escapeHtml(risk.level.toUpperCase())}</h3>
        <p>${escapeHtml(risk.message)}</p>
      </article>
    `
  );
}

function renderRuns(runs) {
  renderCollection(
    "runs",
    runs,
    (run) => {
      const outcome = describeRunOutcome(run);
      return `
        <article class="list-item">
          <h3>${escapeHtml(run.taskId)} - ${escapeHtml(outcome.label)}</h3>
          <p>${escapeHtml(outcome.summary)}</p>
          ${outcome.detail ? `<p class="subtle">${escapeHtml(outcome.detail)}</p>` : ""}
          <p class="subtle">${escapeHtml(run.agent || "manual")} | ${escapeHtml(run.createdAt)}</p>
          <div class="tag-row">
            <span class="tag ${outcome.warn ? "warn" : ""}">${escapeHtml(outcome.label)}</span>
            <span class="tag">${escapeHtml(run.source || "manual")}</span>
            ${run.adapterId ? `<span class="tag">${escapeHtml(run.adapterId)}</span>` : ""}
            ${run.exitCode === undefined || run.exitCode === null ? "" : `<span class="tag ${outcome.warn ? "warn" : ""}">exit ${escapeHtml(run.exitCode)}</span>`}
          </div>
        </article>
      `;
    }
  );
}

function renderTaskFreshness(freshness) {
  if (!freshness || !Array.isArray(freshness.docs) || freshness.docs.length === 0) {
    return '<div class="empty">No freshness data available.</div>';
  }

  const summary = freshness.summary || {};
  const items = freshness.docs
    .map(
      (doc) => `
        <article class="list-item">
          <h3>${escapeHtml(doc.name)}</h3>
          <p>${escapeHtml(doc.reason || "No freshness note available.")}</p>
          <p class="subtle">${escapeHtml(doc.relativePath || "Unknown path")}</p>
          <div class="tag-row">
            <span class="tag ${doc.status !== "fresh" ? "warn" : ""}">${escapeHtml(doc.status || "unknown")}</span>
            <span class="tag">${escapeHtml(formatTimestampLabel(doc.modifiedAt))}</span>
          </div>
        </article>
      `
    )
    .join("");

  return `
    <article class="list-item">
      <h3>${escapeHtml(summary.status === "stale" ? "Needs refresh" : "Looks current")}</h3>
      <p>${escapeHtml(summary.message || "No summary available.")}</p>
      <div class="tag-row">
        <span class="tag ${summary.status === "stale" ? "warn" : ""}">${escapeHtml(summary.status || "unknown")}</span>
        <span class="tag">${escapeHtml(`${summary.staleCount || 0} stale doc(s)`)}</span>
      </div>
    </article>
    ${items}
  `;
}

function renderVerificationGate(verificationGate) {
  if (!verificationGate || !verificationGate.summary) {
    return '<div class="empty">No verification gate data available.</div>';
  }

  const summary = verificationGate.summary;
  const scopeCoverage = verificationGate.scopeCoverage || {};
  const scopeHints = (verificationGate.scopeHints || []).length
    ? (verificationGate.scopeHints || [])
        .map(
          (hint) => `
            <article class="list-item">
              <h3>${escapeHtml(hint.pattern)}</h3>
              <p class="subtle">Declared in ${escapeHtml(hint.source)}</p>
            </article>
          `
        )
        .join("")
    : '<div class="empty">No repo-relative scope hints found yet.</div>';

  const changedFiles = (verificationGate.relevantChangedFiles || []).length
    ? (verificationGate.relevantChangedFiles || [])
        .map(
          (changedFile) => `
            <article class="list-item">
              <h3>${escapeHtml(changedFile.path)}</h3>
              <p>${escapeHtml(renderChangeMatchSummary(changedFile))}</p>
              <div class="tag-row">
                <span class="tag ${changedFile.changeType === "deleted" ? "warn" : ""}">${escapeHtml(changedFile.changeType)}</span>
                ${changedFile.gitState ? `<span class="tag">${escapeHtml(changedFile.gitState)}</span>` : ""}
                <span class="tag">${escapeHtml(formatTimestampLabel(changedFile.modifiedAt))}</span>
              </div>
            </article>
          `
        )
        .join("")
    : '<div class="empty">No current local changes match this task scope.</div>';
  const coveredFiles = (verificationGate.coveredScopedFiles || []).length
    ? (verificationGate.coveredScopedFiles || [])
        .map(
          (coveredFile) => `
            <article class="list-item">
              <h3>${escapeHtml(coveredFile.path)}</h3>
              <p>${escapeHtml(renderChangeMatchSummary(coveredFile))}</p>
              <div class="tag-row">
                <span class="tag">${escapeHtml("covered")}</span>
                <span class="tag">${escapeHtml(formatTimestampLabel(coveredFile.proofUpdatedAt))}</span>
              </div>
            </article>
          `
        )
        .join("")
    : '<div class="empty">No scoped files are explicitly linked to proof yet.</div>';
  const proofItems = (proofCoverage.items || []).length
    ? (proofCoverage.items || [])
        .map(
          (item) => `
            <article class="list-item">
              <h3>${escapeHtml(`${item.sourceType}:${item.sourceLabel}`)}</h3>
              <p>${escapeHtml(item.checks && item.checks.length > 0 ? item.checks.join("; ") : "No explicit check text recorded.")}</p>
              <p class="subtle">${escapeHtml(item.paths && item.paths.length > 0 ? item.paths.join(", ") : "No proof paths recorded.")}</p>
              <p class="subtle">${escapeHtml(item.artifacts && item.artifacts.length > 0 ? item.artifacts.join(", ") : "No artifact refs recorded.")}</p>
              <div class="tag-row">
                <span class="tag ${item.strong ? "" : "warn"}">${escapeHtml(item.strong ? "strong proof" : "weak proof")}</span>
                <span class="tag">${escapeHtml(formatTimestampLabel(item.recordedAt))}</span>
              </div>
            </article>
          `
        )
        .join("")
    : '<div class="empty">No explicit proof items recorded yet.</div>';
  const ambiguousScopeEntries = (scopeCoverage.ambiguousEntries || []).length
    ? (scopeCoverage.ambiguousEntries || [])
        .map(
          (entry) => `
            <article class="list-item">
              <h3>${escapeHtml(entry.value)}</h3>
              <p class="subtle">Needs a tighter repo-relative path in ${escapeHtml(entry.source)}</p>
            </article>
          `
        )
        .join("")
    : '<div class="empty">No ambiguous scope entries detected.</div>';

  const evidence = verificationGate.evidence || {};
  const proofCoverage = verificationGate.proofCoverage || {};

  return `
    <article class="list-item">
      <h3>${escapeHtml(formatVerificationGateHeading(summary.status))}</h3>
      <p>${escapeHtml(summary.message || "No verification gate summary available.")}</p>
      <div class="tag-row">
        <span class="tag ${isVerificationGateWarning(summary.status) ? "warn" : ""}">${escapeHtml(summary.status || "unknown")}</span>
        <span class="tag">${escapeHtml(`${summary.relevantChangeCount || 0} relevant change(s)`)}</span>
        <span class="tag">${escapeHtml(`${(verificationGate.repository && verificationGate.repository.scopedFileCount) || 0} scoped file(s)`)}</span>
        <span class="tag">${escapeHtml(`${scopeCoverage.hintCount || 0} scope hint(s)`)}</span>
        ${(scopeCoverage.ambiguousCount || 0) > 0 ? `<span class="tag warn">${escapeHtml(`${scopeCoverage.ambiguousCount} ambiguous`)}</span>` : ""}
        ${(proofCoverage.explicitProofCount || 0) > 0 ? `<span class="tag">${escapeHtml(`${proofCoverage.explicitProofCount} explicit proof item(s)`)}</span>` : ""}
        ${(proofCoverage.weakProofCount || 0) > 0 ? `<span class="tag warn">${escapeHtml(`${proofCoverage.weakProofCount} weak proof item(s)`)}</span>` : ""}
      </div>
      <p class="subtle">Latest run: ${escapeHtml(formatTimestampLabel(evidence.latestRunAt))}</p>
      <p class="subtle">Verification updated: ${escapeHtml(formatTimestampLabel(evidence.verificationUpdatedAt))}</p>
      <p class="subtle">Latest evidence: ${escapeHtml(formatTimestampLabel(evidence.latestEvidenceAt))}</p>
    </article>
    <article class="list-item">
      <h3>Scope Hints</h3>
      <div class="list">${scopeHints}</div>
    </article>
    <article class="list-item">
      <h3>Relevant Changed Files</h3>
      <div class="list">${changedFiles}</div>
    </article>
    <article class="list-item">
      <h3>Covered Scoped Files</h3>
      <div class="list">${coveredFiles}</div>
    </article>
    <article class="list-item">
      <h3>Proof Items</h3>
      <div class="list">${proofItems}</div>
    </article>
    <article class="list-item">
      <h3>Scope Entries To Tighten</h3>
      <div class="list">${ambiguousScopeEntries}</div>
    </article>
  `;
}

function renderCollection(id, items, renderItem) {
  const container = document.getElementById(id);
  if (!items || items.length === 0) {
    container.innerHTML = '<div class="empty">Nothing here yet.</div>';
    return;
  }

  container.innerHTML = items.map(renderItem).join("");
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function formatTimestampLabel(value) {
  if (!value) {
    return "No timestamp";
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return `Updated ${date.toLocaleString()}`;
}

function formatVerificationGateLabel(status, relevantChangeCount) {
  if (status === "needs-proof") {
    return `Proof needed (${relevantChangeCount})`;
  }

  if (status === "partially-covered") {
    return `Partial proof (${relevantChangeCount})`;
  }

  if (status === "covered") {
    return `Proof covered (${relevantChangeCount})`;
  }

  if (status === "scope-missing") {
    return "Scope hint needed";
  }

  if (status === "unavailable") {
    return "Diff unavailable";
  }

  return relevantChangeCount > 0 ? `Proof ready (${relevantChangeCount})` : "Proof ready";
}

function formatVerificationGateHeading(status) {
  if (status === "needs-proof") {
    return "Explicit proof needed";
  }

  if (status === "partially-covered") {
    return "Proof is only partial";
  }

  if (status === "covered") {
    return "Scoped diff is covered";
  }

  if (status === "scope-missing") {
    return "Scope hints missing";
  }

  if (status === "unavailable") {
    return "Diff-aware gate unavailable";
  }

  return "No extra proof required";
}

function renderChangeMatchSummary(changedFile) {
  const matchedBy = (changedFile.matchedBy || []).map((hint) => `${hint.pattern} (${hint.source})`);
  if (matchedBy.length === 0) {
    return "Matched by no scope hints.";
  }

  return `Matched by ${matchedBy.join(", ")}${changedFile.previousPath ? `; previous path ${changedFile.previousPath}` : ""}`;
}

function isVerificationGateWarning(status) {
  return status === "needs-proof" || status === "partially-covered" || status === "scope-missing";
}

function getEditableDocumentConfig(documentName) {
  return EDITABLE_DOCUMENTS[documentName] || EDITABLE_DOCUMENTS["task.md"];
}

function populateRecipeSelect(selectId, recipes, selectedValue) {
  const select = document.getElementById(selectId);
  if (!select) {
    return;
  }

  select.innerHTML = (recipes || [])
    .map(
      (recipe) =>
        `<option value="${escapeHtml(recipe.id)}"${recipe.id === selectedValue ? " selected" : ""}>${escapeHtml(recipe.id)} - ${escapeHtml(recipe.name)}</option>`
    )
    .join("");
}

function populateDocumentEditor(detail) {
  const form = document.getElementById("document-editor-form");
  const taskIdInput = document.getElementById("document-task-id");
  const documentSelect = document.getElementById("document-name");
  const contentInput = document.getElementById("document-content");
  const note = document.getElementById("document-sync-note");
  const managedNode = document.getElementById("document-managed-list");
  const freeNode = document.getElementById("document-free-list");
  const guardrailNode = document.getElementById("document-guardrail-note");
  const draftProofButton = document.getElementById("document-draft-proof-links");
  const hasDetail = Boolean(detail && detail.meta);
  const config = getEditableDocumentConfig(activeDocumentName);
  const pendingPaths = getPendingProofPaths(detail);
  const canDraftVerificationProof = hasDetail && activeDocumentName === "verification.md" && pendingPaths.length > 0;

  taskIdInput.value = hasDetail ? detail.meta.id : "";
  documentSelect.value = activeDocumentName;
  contentInput.value = hasDetail ? detail[config.detailField] || "" : "";
  note.textContent = hasDetail ? config.note : "Select a task to edit its markdown bundle.";
  managedNode.innerHTML = renderGuidanceList(
    hasDetail ? config.managedSections : [],
    "No managed sections listed for this document."
  );
  freeNode.innerHTML = renderGuidanceList(
    hasDetail ? config.freeSections : [],
    "Select a task to view editable sections."
  );
  guardrailNode.textContent = hasDetail
    ? activeDocumentName === "verification.md" && pendingPaths.length > 0
      ? "Managed markers are maintained automatically on save. The verification draft shortcut can add planned checks plus file placeholders, but you still need real Check/Result/Artifact content before treating it as evidence."
      : "Managed markers are maintained automatically on save; you can focus on the surrounding markdown."
    : "Select a task to view editor guardrails.";
  if (draftProofButton) {
    draftProofButton.disabled = !canDraftVerificationProof;
    draftProofButton.textContent = canDraftVerificationProof
      ? `Draft Proof Plan From Pending Files (${pendingPaths.length})`
      : "Draft Proof Plan From Pending Files";
  }

  Array.from(form.elements).forEach((element) => {
    if (element.name !== "taskId") {
      element.disabled = !hasDetail;
    }
  });
}

function renderGuidanceList(items, emptyMessage) {
  const values = Array.isArray(items) ? items.filter(Boolean) : [];
  if (values.length === 0) {
    return `<p class="subtle">${escapeHtml(emptyMessage)}</p>`;
  }

  return values.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
}

function getVerificationEditorBaseText(detail) {
  if (activeDocumentName === "verification.md") {
    return document.getElementById("document-content").value;
  }

  return detail && typeof detail.verificationText === "string" ? detail.verificationText : "";
}

function openVerificationEditorDraft(content) {
  activeDocumentName = "verification.md";
  populateDocumentEditor(activeTaskDetail);
  document.getElementById("document-name").value = "verification.md";
  document.getElementById("document-content").value = content;
}

function populateTaskForms(detail) {
  const hasDetail = Boolean(detail && detail.meta);
  const updateForm = document.getElementById("task-update-form");
  const runForm = document.getElementById("run-create-form");
  const previousRunTaskId = document.getElementById("run-task-id").value;

  document.getElementById("selected-task-id").value = hasDetail ? detail.meta.id : "";
  document.getElementById("selected-task-title").value = hasDetail ? detail.meta.title || "" : "";
  document.getElementById("selected-task-status").value = hasDetail ? detail.meta.status || "todo" : "todo";
  document.getElementById("selected-task-priority").value = hasDetail ? detail.meta.priority || "P2" : "P2";
  document.getElementById("selected-task-recipe").value = hasDetail ? detail.meta.recipeId || "feature" : "feature";
  document.getElementById("run-task-id").value = hasDetail ? detail.meta.id : "";
  updateRunProofNote(detail);

  if (!hasDetail || previousRunTaskId !== detail.meta.id) {
    clearRunEvidenceDraft();
  }

  Array.from(updateForm.elements).forEach((element) => {
    if (element.name !== "taskId") {
      element.disabled = !hasDetail;
    }
  });
  Array.from(runForm.elements).forEach((element) => {
    if (element.name !== "taskId") {
      element.disabled = !hasDetail;
    }
  });

  populateDocumentEditor(detail);
  updateExecutionStateUI(detail ? detail.executionState : null);
}

function clearRunEvidenceDraft() {
  document.getElementById("run-summary").value = "";
  document.getElementById("run-proof-paths").value = "";
  document.getElementById("run-checks").value = "";
  document.getElementById("run-artifacts").value = "";
}

function normalizeOptionalPositiveInteger(value, fieldName) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return undefined;
  }

  const numeric = Number(normalized);
  if (!Number.isInteger(numeric) || numeric <= 0) {
    throw new Error(`${fieldName} must be a positive integer.`);
  }

  return numeric;
}

function updateRunProofNote(detail) {
  const note = document.getElementById("run-proof-note");
  const fillPathsButton = document.getElementById("run-fill-pending-paths");
  const draftChecksButton = document.getElementById("run-draft-pending-checks");
  if (!note) {
    return;
  }

  const baseText = "Checks default to the selected run status when you omit an explicit status. Use `status | label | optional details | artifact1, artifact2` for richer entries. Shortcut buttons can prefill proof paths, draft one check per pending scoped file, or sync the current run draft into verification.md.";
  const pendingPaths = getPendingProofPaths(detail);

  if (fillPathsButton) {
    fillPathsButton.disabled = pendingPaths.length === 0;
    fillPathsButton.textContent =
      pendingPaths.length > 0 ? `Use Pending Scoped Files (${pendingPaths.length})` : "Use Pending Scoped Files";
  }
  if (draftChecksButton) {
    draftChecksButton.disabled = pendingPaths.length === 0;
    draftChecksButton.textContent =
      pendingPaths.length > 0
        ? `Draft Checks From Pending Files (${pendingPaths.length})`
        : "Draft Checks From Pending Files";
  }

  note.textContent =
    pendingPaths.length > 0
      ? `${baseText} Pending scoped files: ${pendingPaths.join(", ")}`
      : baseText;
}

function renderTaskRun(run, taskId) {
  const outcome = describeRunOutcome(run);
  const tags = [
    createTag(outcome.label, outcome.warn),
    createTag(run.source || "manual", run.source === "executor" ? false : false),
    run.adapterId ? createTag(run.adapterId, false) : "",
    run.exitCode === undefined || run.exitCode === null ? "" : createTag(`exit ${run.exitCode}`, outcome.warn),
    run.timedOut ? createTag("timed out", true) : "",
    run.interrupted && !isDashboardCancelledRun(run) ? createTag("interrupted", true) : "",
  ]
    .filter(Boolean)
    .join("");

  const metaLines = [
    outcome.detail ? `<p>${escapeHtml(outcome.detail)}</p>` : "",
    run.createdAt ? `<p class="subtle">Started ${escapeHtml(run.createdAt)}</p>` : "",
    run.completedAt ? `<p class="subtle">Completed ${escapeHtml(run.completedAt)}</p>` : "",
    run.durationMs !== undefined ? `<p class="subtle">Duration ${escapeHtml(run.durationMs)} ms</p>` : "",
    run.timeoutMs !== undefined ? `<p class="subtle">Timeout ${escapeHtml(run.timeoutMs)} ms</p>` : "",
    run.interruptionSignal ? `<p class="subtle">Interrupted by ${escapeHtml(run.interruptionSignal)}</p>` : "",
    run.terminationSignal ? `<p class="subtle">Termination signal ${escapeHtml(run.terminationSignal)}</p>` : "",
    Array.isArray(run.scopeProofPaths) && run.scopeProofPaths.length > 0
      ? `<p class="subtle">Proof paths: ${escapeHtml(run.scopeProofPaths.join(", "))}</p>`
      : "",
    Array.isArray(run.verificationChecks) && run.verificationChecks.length > 0
      ? run.verificationChecks
          .map((check) => `<p class="subtle">Check: ${escapeHtml(formatRunVerificationCheck(check))}</p>`)
          .join("")
      : "",
    Array.isArray(run.verificationArtifacts) && run.verificationArtifacts.length > 0
      ? `<p class="subtle">Verification artifacts: ${escapeHtml(run.verificationArtifacts.join(", "))}</p>`
      : "",
    run.stdoutFile ? `<p class="subtle">stdout: ${escapeHtml(run.stdoutFile)}</p>` : "",
    run.stderrFile ? `<p class="subtle">stderr: ${escapeHtml(run.stderrFile)}</p>` : "",
    run.errorMessage ? `<p class="subtle run-error">${escapeHtml(run.errorMessage)}</p>` : "",
  ]
    .filter(Boolean)
    .join("");

  const logActions = [
    run.stdoutFile
      ? `<button type="button" class="log-button" data-task-id="${escapeHtml(taskId)}" data-run-id="${escapeHtml(run.id)}" data-stream="stdout">View stdout</button>`
      : "",
    run.stderrFile
      ? `<button type="button" class="log-button" data-task-id="${escapeHtml(taskId)}" data-run-id="${escapeHtml(run.id)}" data-stream="stderr">View stderr</button>`
      : "",
  ]
    .filter(Boolean)
    .join("");

  return `
    <article class="list-item run-item">
      <h3>${escapeHtml(run.agent || "manual")} - ${escapeHtml(outcome.label)}</h3>
      <p>${escapeHtml(outcome.summary)}</p>
      <div class="tag-row">${tags}</div>
      <div class="run-meta">${metaLines}</div>
      ${
        logActions
          ? `<div class="log-actions">${logActions}</div><div class="run-log-panel hidden" id="${getRunLogPanelId(run.id)}"></div>`
          : ""
      }
    </article>
  `;
}

function formatRunVerificationCheck(check) {
  if (!check || !check.label) {
    return "Recorded verification check";
  }

  const statusPrefix = check.status ? `[${check.status}] ` : "";
  const detailsSuffix = check.details ? ` - ${check.details}` : "";
  const artifactSuffix =
    Array.isArray(check.artifacts) && check.artifacts.length > 0 ? ` | artifacts: ${check.artifacts.join(", ")}` : "";
  return `${statusPrefix}${check.label}${detailsSuffix}${artifactSuffix}`;
}

function createTag(label, warn) {
  return `<span class="tag ${warn ? "warn" : ""}">${escapeHtml(label)}</span>`;
}

function getRunLogPanelId(runId) {
  return `run-log-${String(runId).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
}

function bindRunLogButtons(taskId) {
  document.querySelectorAll("[data-stream][data-run-id]").forEach((button) => {
    button.addEventListener("click", async () => {
      const runId = button.getAttribute("data-run-id");
      const stream = button.getAttribute("data-stream");
      const panel = document.getElementById(getRunLogPanelId(runId));
      if (!panel) {
        return;
      }

      if (button.dataset.loaded === stream && !panel.classList.contains("hidden")) {
        panel.classList.add("hidden");
        button.textContent = stream === "stdout" ? "View stdout" : "View stderr";
        return;
      }

      try {
        button.disabled = true;
        button.textContent = `Loading ${stream}...`;
        const log = await loadRunLog(taskId, runId, stream);
        panel.classList.remove("hidden");
        panel.innerHTML = `
          <p class="subtle">Log path: ${escapeHtml(log.path)}</p>
          ${log.truncated ? `<p class="subtle">Showing last ${escapeHtml(log.content.length)} of ${escapeHtml(log.size)} chars.</p>` : ""}
          <pre class="detail-pre">${escapeHtml(log.content || "(empty log)")}</pre>
        `;
        button.dataset.loaded = stream;
        button.textContent = stream === "stdout" ? "Hide stdout" : "Hide stderr";
      } catch (error) {
        panel.classList.remove("hidden");
        panel.innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
        button.textContent = stream === "stdout" ? "Retry stdout" : "Retry stderr";
      } finally {
        button.disabled = false;
      }
    });
  });
}

function setActionStatus(message, tone) {
  const node = document.getElementById("action-status");
  node.textContent = message;
  node.className = "action-status";
  if (tone) {
    node.classList.add(tone);
  }
}

async function selectTask(taskId) {
  if (activeTaskId && activeTaskId !== taskId) {
    clearExecutionPolling();
  }
  activeTaskId = taskId;
  renderTasks(window.__overview.tasks || []);
  renderTaskDetail(await loadTaskDetail(taskId));
}

async function refreshDashboard(nextTaskId) {
  const overview = await loadOverview();
  window.__overview = overview;
  document.getElementById("workspace-root").textContent = overview.workspaceRoot;
  renderStats(overview.stats);
  renderAdapters(overview.adapters || []);
  renderRecipes(overview.recipes || []);
  renderValidation(overview.validation || { ok: true, issues: [], errorCount: 0, warningCount: 0 });
  populateRecipeSelect("create-recipe", overview.recipes || [], document.getElementById("create-recipe").value || "feature");
  populateRecipeSelect("selected-task-recipe", overview.recipes || [], document.getElementById("selected-task-recipe").value || "feature");
  renderTasks(overview.tasks || []);
  renderMemory(overview.memory || []);
  renderVerification(overview.verification || []);
  renderRisks(overview.risks || []);
  renderRuns(overview.runs || []);

  if (overview.tasks && overview.tasks.length > 0) {
    activeTaskId =
      nextTaskId && overview.tasks.some((task) => task.id === nextTaskId)
        ? nextTaskId
        : activeTaskId && overview.tasks.some((task) => task.id === activeTaskId)
          ? activeTaskId
          : overview.tasks[0].id;
    renderTasks(overview.tasks || []);
    renderTaskDetail(await loadTaskDetail(activeTaskId));
  } else {
    activeTaskId = null;
    renderTaskDetail(null);
  }
}

function bindForms() {
  document.getElementById("task-executor-filter").addEventListener("change", (event) => {
    activeExecutorOutcomeFilter = normalizeExecutorOutcomeFilter(event.currentTarget.value);
    renderTasks(window.__overview.tasks || []);
  });

  document.getElementById("document-name").addEventListener("change", (event) => {
    activeDocumentName = event.currentTarget.value || "task.md";
    populateDocumentEditor(activeTaskDetail);
  });

  document.getElementById("task-create-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    try {
      setActionStatus("Creating task...", "");
      const payload = {
        taskId: String(formData.get("taskId") || "").trim(),
        title: String(formData.get("title") || "").trim(),
        priority: String(formData.get("priority") || "").trim(),
        recipeId: String(formData.get("recipeId") || "").trim(),
      };
      const task = await postJson("/api/tasks", payload);
      form.reset();
      document.getElementById("create-priority").value = "P2";
      document.getElementById("create-recipe").value = payload.recipeId || "feature";
      await refreshDashboard(task.id);
      setActionStatus(`Created task ${task.id}.`, "success");
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  });

  document.getElementById("task-update-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const taskId = String(formData.get("taskId") || "").trim();
    if (!taskId) {
      setActionStatus("Select a task before updating it.", "error");
      return;
    }

    try {
      setActionStatus(`Saving task ${taskId}...`, "");
      await patchJson(`/api/tasks/${encodeURIComponent(taskId)}`, {
        title: String(formData.get("title") || "").trim(),
        status: String(formData.get("status") || "").trim(),
        priority: String(formData.get("priority") || "").trim(),
        recipeId: String(formData.get("recipeId") || "").trim(),
      });
      await refreshDashboard(taskId);
      setActionStatus(`Updated task ${taskId}.`, "success");
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  });

  document.getElementById("run-create-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const taskId = String(formData.get("taskId") || "").trim();
    if (!taskId) {
      setActionStatus("Select a task before recording run evidence.", "error");
      return;
    }

    try {
      setActionStatus(`Recording run for ${taskId}...`, "");
      const payload = {
        agent: String(formData.get("agent") || "").trim(),
        status: String(formData.get("status") || "").trim(),
        summary: String(formData.get("summary") || "").trim(),
        ...parseRunEvidenceDraft({
          status: String(formData.get("status") || "").trim(),
          scopeProofPaths: String(formData.get("scopeProofPaths") || ""),
          verificationChecks: String(formData.get("verificationChecks") || ""),
          verificationArtifacts: String(formData.get("verificationArtifacts") || ""),
        }),
      };
      await postJson(`/api/tasks/${encodeURIComponent(taskId)}/runs`, payload);
      clearRunEvidenceDraft();
      await refreshDashboard(taskId);
      setActionStatus(`Recorded run evidence for ${taskId}.`, "success");
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  });

  document.getElementById("run-execute-local").addEventListener("click", async () => {
    if (!activeTaskDetail || !activeTaskDetail.meta) {
      setActionStatus("Select a task before starting local execution.", "error");
      return;
    }

    const taskId = activeTaskDetail.meta.id;
    const agent = String(document.getElementById("run-execute-agent").value || "codex").trim() || "codex";

    try {
      const timeoutMs = normalizeOptionalPositiveInteger(
        document.getElementById("run-execute-timeout").value,
        "Execution timeout"
      );
      setActionStatus(`Starting local ${agent} execution for ${taskId}...`, "");
      const state = await postJson(`/api/tasks/${encodeURIComponent(taskId)}/execute`, {
        agent,
        timeoutMs,
      });
      if (activeTaskDetail && activeTaskDetail.meta && activeTaskDetail.meta.id === taskId) {
        activeTaskDetail.executionState = state;
      }
      updateExecutionStateUI(state);
      scheduleExecutionPolling(taskId, 200);
      setActionStatus(`Started local ${agent} execution for ${taskId}.`, "success");
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  });

  document.getElementById("run-cancel-execution").addEventListener("click", async () => {
    if (!activeTaskDetail || !activeTaskDetail.meta) {
      setActionStatus("Select a task before cancelling local execution.", "error");
      return;
    }

    const taskId = activeTaskDetail.meta.id;

    try {
      setActionStatus(`Requesting cancellation for ${taskId}...`, "");
      const state = await postJson(`/api/tasks/${encodeURIComponent(taskId)}/execution/cancel`, {});
      if (activeTaskDetail && activeTaskDetail.meta && activeTaskDetail.meta.id === taskId) {
        activeTaskDetail.executionState = state;
      }
      updateExecutionStateUI(state);
      scheduleExecutionPolling(taskId, 200);
      setActionStatus(`Cancellation requested for ${taskId}.`, "success");
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  });

  document.getElementById("run-fill-pending-paths").addEventListener("click", () => {
    const input = document.getElementById("run-proof-paths");
    const pendingPaths = getPendingProofPaths(activeTaskDetail);

    if (pendingPaths.length === 0) {
      setActionStatus("No pending scoped files are available for this task right now.", "error");
      return;
    }

    input.value = mergeProofPathDraft(input.value, activeTaskDetail);
    setActionStatus(`Added ${pendingPaths.length} pending scoped file(s) to proof paths.`, "success");
  });

  document.getElementById("run-draft-pending-checks").addEventListener("click", () => {
    const input = document.getElementById("run-checks");
    const pendingPaths = getPendingProofPaths(activeTaskDetail);
    const runStatus = document.getElementById("run-status").value;

    if (pendingPaths.length === 0) {
      setActionStatus("No pending scoped files are available for draft checks right now.", "error");
      return;
    }

    input.value = mergeProofCheckDraft(input.value, activeTaskDetail, runStatus);
    setActionStatus(`Drafted check text for ${pendingPaths.length} pending scoped file(s).`, "success");
  });

  document.getElementById("run-sync-verification-draft").addEventListener("click", () => {
    if (!activeTaskDetail || !activeTaskDetail.meta) {
      setActionStatus("Select a task before syncing the run draft into verification.md.", "error");
      return;
    }

    const runDraftValues = collectRunDraftValues();
    if (!hasRunDraftVerificationContent(runDraftValues)) {
      setActionStatus("Add proof paths or verification checks in the run form before syncing them into verification.md.", "error");
      return;
    }

    const nextContent = mergeVerificationFromRunDraft(getVerificationEditorBaseText(activeTaskDetail), runDraftValues);
    openVerificationEditorDraft(nextContent);
    setActionStatus("Synced the current run draft into the verification.md editor. Review and save when ready.", "success");
  });

  document.getElementById("document-draft-proof-links").addEventListener("click", () => {
    const input = document.getElementById("document-content");
    const pendingPaths = getPendingProofPaths(activeTaskDetail);

    if (activeDocumentName !== "verification.md") {
      setActionStatus("Switch the editor to verification.md before drafting proof links.", "error");
      return;
    }

    if (pendingPaths.length === 0) {
      setActionStatus("No pending scoped files are available for proof-link drafting right now.", "error");
      return;
    }

    input.value = mergeVerificationProofPlanDraft(input.value, activeTaskDetail);
    setActionStatus(
      `Drafted planned checks and proof-link placeholders for ${pendingPaths.length} pending scoped file(s). Fill Check/Result/Artifact before treating them as proof.`,
      "success"
    );
  });

  document.getElementById("document-editor-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const taskId = String(formData.get("taskId") || "").trim();
    const documentName = String(formData.get("documentName") || "").trim() || "task.md";

    if (!taskId) {
      setActionStatus("Select a task before editing its markdown docs.", "error");
      return;
    }

    try {
      activeDocumentName = documentName;
      setActionStatus(`Saving ${documentName} for ${taskId}...`, "");
      const detail = await putJson(
        `/api/tasks/${encodeURIComponent(taskId)}/documents/${encodeURIComponent(documentName)}`,
        {
          content: String(formData.get("content") || ""),
        }
      );
      renderTaskDetail(detail);
      renderTasks(window.__overview.tasks || []);
      setActionStatus(`Saved ${documentName} for ${taskId}.`, "success");
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  });
}

async function bootstrap() {
  try {
    const overview = await loadOverview();
    window.__overview = overview;
    document.getElementById("workspace-root").textContent = overview.workspaceRoot;
    populateRecipeSelect("create-recipe", overview.recipes || [], "feature");
    populateRecipeSelect("selected-task-recipe", overview.recipes || [], "feature");
    bindForms();
    await refreshDashboard();
    setActionStatus("Ready.", "");
  } catch (error) {
    document.getElementById("stats").innerHTML = `<div class="empty">${escapeHtml(error.message)}</div>`;
  }
}

if (typeof window !== "undefined" && typeof document !== "undefined") {
  bootstrap();
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    buildVerificationProofDraft,
    buildVerificationPlannedCheckDraft,
    buildPendingProofCheckLines,
    collectRunDraftValues,
    extractVerificationPlannedManualChecks,
    extractVerificationProofPaths,
    filterTasksByExecutorOutcome,
    formatVerificationPlannedCheck,
    getPendingProofPaths,
    getEditableDocumentConfig,
    hasRunDraftVerificationContent,
    matchesExecutorOutcomeFilter,
    mergeVerificationProofPlanDraft,
    mergeVerificationPlannedCheckDraft,
    mergeVerificationProofDraft,
    mergeVerificationFromRunDraft,
    mergeProofCheckDraft,
    mergeProofPathDraft,
    normalizeExecutorOutcomeFilter,
    parseRunVerificationDraft,
    parseRunCheckLine,
    parseRunChecks,
    parseRunEvidenceDraft,
    summarizeExecutorOutcomeFilter,
  };
}
