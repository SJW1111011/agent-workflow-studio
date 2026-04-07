let activeTaskId = null;
let activeTaskDetail = null;
let activeDocumentName = "task.md";
let activeExecutorOutcomeFilter = "all";
let executionPollHandle = null;
let executionPollTaskId = null;
let executionLogState = null;
const {
  buildPendingProofCheckLines,
  buildVerificationPlannedCheckDraft,
  buildVerificationProofDraft,
  describeVerificationProofSignals,
  extractVerificationPlannedChecks,
  extractVerificationPlannedManualChecks,
  extractVerificationProofPaths,
  findMarkdownSectionRange,
  formatVerificationPlannedCheck,
  getEditableDocumentConfig,
  getPendingProofPaths,
  hasRunDraftVerificationContent,
  mergeProofCheckDraft,
  mergeProofPathDraft,
  mergeVerificationFromRunDraft,
  mergeVerificationPlannedCheckDraft,
  mergeVerificationProofDraft,
  mergeVerificationProofPlanDraft,
  parseRunCheckLine,
  parseRunChecks,
  parseRunEvidenceDraft,
  parseRunVerificationDraft,
} = loadDashboardModule("AgentWorkflowDashboardDocumentHelpers", "./document-helpers.js");
const {
  filterTasksByExecutorOutcome,
  matchesExecutorOutcomeFilter,
  normalizeExecutorOutcomeFilter,
  normalizeStatCount,
  renderExecutorOutcomeStatCard,
  renderVerificationSignalStatCard,
  summarizeExecutorOutcomeFilter,
} = loadDashboardModule("AgentWorkflowDashboardTaskBoardHelpers", "./task-board-helpers.js");
const {
  describeExecutionPresentation,
  describeExecutionState,
  describeRunOutcome,
  describeRunPresentation,
  formatTimestampLabel,
  getExecutionLogPanelId,
  getRunLogPanelId,
  isActiveExecutionState,
  isVerificationGateWarning,
  renderExecutionStateMarkup,
  renderExecutionStateSummary,
  resolveExecutionLogSource,
} = loadDashboardModule("AgentWorkflowDashboardExecutionDetailHelpers", "./execution-detail-helpers.js");
const {
  renderTaskDetailMarkup,
} = loadDashboardModule("AgentWorkflowDashboardTaskDetailHelpers", "./task-detail-helpers.js");
const {
  buildDocumentEditorView,
  buildRunProofNoteView,
  buildTaskFormView,
  getVerificationEditorBaseText,
  normalizeOptionalPositiveInteger,
} = loadDashboardModule("AgentWorkflowDashboardFormStateHelpers", "./form-state-helpers.js");
const {
  createDashboardApiClient,
} = loadDashboardModule("AgentWorkflowDashboardApiClientHelpers", "./api-client-helpers.js");
const {
  bindDashboardForms,
} = loadDashboardModule("AgentWorkflowDashboardFormEventHelpers", "./form-event-helpers.js");
const {
  buildExecutionCompletionStatus,
  buildExecutionUiView,
  resolveNextActiveTaskId,
  resolveSelectedExecutionContext,
} = loadDashboardModule("AgentWorkflowDashboardOrchestrationStateHelpers", "./orchestration-state-helpers.js");
const {
  renderTaskBoardMarkup,
} = loadDashboardModule("AgentWorkflowDashboardTaskListRenderHelpers", "./task-list-render-helpers.js");
const {
  renderAdaptersMarkup,
  renderMemoryMarkup,
  renderRecipesMarkup,
  renderRisksMarkup,
  renderRunsMarkup,
  renderStatsMarkup,
  renderValidationMarkup,
  renderVerificationMarkup,
} = loadDashboardModule("AgentWorkflowDashboardOverviewRenderHelpers", "./overview-render-helpers.js");
const {
  clearExecutionLogState: createClearedExecutionLogState,
  createExecutionLogState,
  ensureExecutionLogTaskState,
  hasOpenExecutionLogStreams,
  isExecutionLogStreamOpen,
  loadResolvedExecutionLog,
  renderExecutionLogError,
  renderExecutionLogLoading,
  renderExecutionLogUnavailable,
  renderExecutionLogView,
  renderRunLogView,
  toggleExecutionLogStreamState,
} = loadDashboardModule("AgentWorkflowDashboardLogPanelHelpers", "./log-panel-helpers.js");

executionLogState = createExecutionLogState();
const dashboardApi = createDashboardApiClient(typeof fetch === "function" ? fetch.bind(globalThis) : null);

function loadDashboardModule(globalName, relativePath) {
  if (typeof module !== "undefined" && module.exports && typeof require === "function") {
    return require(relativePath);
  }

  if (typeof globalThis !== "undefined" && globalThis[globalName]) {
    return globalThis[globalName];
  }

  throw new Error(`Dashboard helper module is unavailable: ${globalName}`);
}

function collectRunDraftValues() {
  return {
    status: document.getElementById("run-status").value,
    scopeProofPaths: document.getElementById("run-proof-paths").value,
    verificationChecks: document.getElementById("run-checks").value,
    verificationArtifacts: document.getElementById("run-artifacts").value,
  };
}

async function loadOverview() {
  return dashboardApi.loadOverview();
}

async function loadTaskDetail(taskId) {
  return dashboardApi.loadTaskDetail(taskId);
}

async function loadTaskExecution(taskId) {
  return dashboardApi.loadTaskExecution(taskId);
}

async function loadTaskExecutionLog(taskId, stream, maxChars = 6000) {
  return dashboardApi.loadTaskExecutionLog(taskId, stream, maxChars);
}

async function loadRunLog(taskId, runId, stream) {
  return dashboardApi.loadRunLog(taskId, runId, stream);
}

function renderStats(stats) {
  document.getElementById("stats").innerHTML = renderStatsMarkup(stats, {
    escapeHtml,
    normalizeStatCount,
    renderExecutorOutcomeStatCard,
    renderVerificationSignalStatCard,
  });
}

function renderTasks(tasks) {
  const container = document.getElementById("tasks");
  const summaryNode = document.getElementById("task-filter-summary");
  const filterNode = document.getElementById("task-executor-filter");
  const view = renderTaskBoardMarkup(tasks, {
    activeTaskId,
    filterValue: activeExecutorOutcomeFilter,
  });
  activeExecutorOutcomeFilter = view.normalizedFilter;

  if (summaryNode) {
    summaryNode.textContent = view.summaryText;
  }
  if (filterNode) {
    filterNode.value = view.normalizedFilter;
  }

  container.innerHTML = view.markup;

  document.querySelectorAll("[data-task-id]").forEach((node) => {
    node.addEventListener("click", () => {
      selectTask(node.getAttribute("data-task-id"));
    });
  });
}

function renderAdapters(adapters) {
  document.getElementById("adapters").innerHTML = renderAdaptersMarkup(adapters);
}

function renderRecipes(recipes) {
  document.getElementById("recipes").innerHTML = renderRecipesMarkup(recipes);
}

function renderValidation(report) {
  document.getElementById("validation").innerHTML = renderValidationMarkup(report);
}

function updateExecutionStateUI(executionState) {
  const { selectedTaskId, state } = resolveSelectedExecutionContext(activeTaskDetail, executionState);
  const view = buildExecutionUiView({
    selectedTaskId,
    state,
    renderExecutionStateSummary,
    isActiveExecutionState,
  });
  const statusNode = document.getElementById("run-execution-status");
  const panelNode = document.getElementById("task-execution-state-panel");

  if (statusNode) {
    statusNode.textContent = view.statusText;
  }

  if (panelNode) {
    panelNode.innerHTML = renderExecutionStateMarkup(state, {
      executionLogTaskId: executionLogState.taskId,
      executionLogOpenStreams: executionLogState.openStreams,
    });
    if (selectedTaskId) {
      bindExecutionLogButtons(selectedTaskId, state);
      if (hasOpenExecutionLogStreams(executionLogState, selectedTaskId)) {
        refreshOpenExecutionLogs(selectedTaskId, state);
      }
    }
  }

  const executeButton = document.getElementById("run-execute-local");
  if (executeButton) {
    executeButton.disabled = view.executeDisabled;
  }
  const cancelButton = document.getElementById("run-cancel-execution");
  if (cancelButton) {
    cancelButton.disabled = view.cancelDisabled;
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
  executionLogState = createClearedExecutionLogState(nextTaskId);
}

function ensureExecutionLogTask(taskId) {
  executionLogState = ensureExecutionLogTaskState(executionLogState, taskId);
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
    const completionStatus = buildExecutionCompletionStatus(state, taskId, describeExecutionState);
    if (completionStatus) {
      await refreshDashboard(taskId);
      setActionStatus(completionStatus.message, completionStatus.tone);
    }
  } catch (error) {
    clearExecutionPolling();
    setActionStatus(error.message, "error");
  }
}

async function refreshOpenExecutionLogs(taskId, executionState) {
  if (!hasOpenExecutionLogStreams(executionLogState, taskId)) {
    return;
  }

  const state =
    executionState && executionState.taskId === taskId
      ? executionState
      : activeTaskDetail && activeTaskDetail.executionState && activeTaskDetail.executionState.taskId === taskId
        ? activeTaskDetail.executionState
        : null;

  const streams = Array.from(executionLogState.openStreams);
  await Promise.all(
    streams.map(async (stream) => {
      const panel = document.getElementById(getExecutionLogPanelId(stream));
      if (!panel) {
        return;
      }

      panel.classList.remove("hidden");
      panel.innerHTML = renderExecutionLogLoading(stream);

      try {
        const logSource = resolveExecutionLogSource(taskId, state, stream);
        if (!logSource) {
          panel.innerHTML = renderExecutionLogUnavailable(stream);
          return;
        }

        const log = await loadResolvedExecutionLog(logSource, {
          loadRunLog,
          loadTaskExecutionLog,
        });
        if (!isExecutionLogStreamOpen(executionLogState, taskId, stream)) {
          return;
        }

        const latestPanel = document.getElementById(getExecutionLogPanelId(stream));
        if (!latestPanel) {
          return;
        }

        latestPanel.innerHTML = renderExecutionLogView(log, stream, formatTimestampLabel);
      } catch (error) {
        if (!isExecutionLogStreamOpen(executionLogState, taskId, stream)) {
          return;
        }

        const latestPanel = document.getElementById(getExecutionLogPanelId(stream));
        if (latestPanel) {
          latestPanel.innerHTML = renderExecutionLogError(error.message);
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
      executionLogState = toggleExecutionLogStreamState(executionLogState, taskId, stream);

      updateExecutionStateUI(executionState);
      if (isExecutionLogStreamOpen(executionLogState, taskId, stream)) {
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

  container.innerHTML = renderTaskDetailMarkup(detail, {
    executionLogTaskId: executionLogState.taskId,
    executionLogOpenStreams: executionLogState.openStreams,
  });

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
  document.getElementById("memory").innerHTML = renderMemoryMarkup(memory, formatTimestampLabel);
}

function renderVerification(items) {
  document.getElementById("verification").innerHTML = renderVerificationMarkup(items, isVerificationGateWarning);
}

function renderRisks(risks) {
  document.getElementById("risks").innerHTML = renderRisksMarkup(risks);
}

function renderRuns(runs) {
  document.getElementById("runs").innerHTML = renderRunsMarkup(runs, describeRunOutcome);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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
  const view = buildDocumentEditorView({
    detail,
    activeDocumentName,
    editableConfig: getEditableDocumentConfig(activeDocumentName),
    pendingPaths: getPendingProofPaths(detail),
  });

  taskIdInput.value = view.taskId;
  documentSelect.value = view.documentName;
  contentInput.value = view.content;
  note.textContent = view.note;
  managedNode.innerHTML = view.managedMarkup;
  freeNode.innerHTML = view.freeMarkup;
  guardrailNode.textContent = view.guardrailNote;
  if (draftProofButton) {
    draftProofButton.disabled = view.draftProofButtonDisabled;
    draftProofButton.textContent = view.draftProofButtonText;
  }

  Array.from(form.elements).forEach((element) => {
    if (element.name !== "taskId") {
      element.disabled = view.disableInputs;
    }
  });
}

function openVerificationEditorDraft(content) {
  activeDocumentName = "verification.md";
  populateDocumentEditor(activeTaskDetail);
  document.getElementById("document-name").value = "verification.md";
  document.getElementById("document-content").value = content;
}

function populateTaskForms(detail) {
  const updateForm = document.getElementById("task-update-form");
  const runForm = document.getElementById("run-create-form");
  const view = buildTaskFormView(detail, document.getElementById("run-task-id").value);

  document.getElementById("selected-task-id").value = view.selectedTaskId;
  document.getElementById("selected-task-title").value = view.selectedTaskTitle;
  document.getElementById("selected-task-status").value = view.selectedTaskStatus;
  document.getElementById("selected-task-priority").value = view.selectedTaskPriority;
  document.getElementById("selected-task-recipe").value = view.selectedTaskRecipeId;
  document.getElementById("run-task-id").value = view.runTaskId;
  updateRunProofNote(detail);

  if (view.shouldClearRunEvidenceDraft) {
    clearRunEvidenceDraft();
  }

  Array.from(updateForm.elements).forEach((element) => {
    if (element.name !== "taskId") {
      element.disabled = view.disableInputs;
    }
  });
  Array.from(runForm.elements).forEach((element) => {
    if (element.name !== "taskId") {
      element.disabled = view.disableInputs;
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

function updateRunProofNote(detail) {
  const note = document.getElementById("run-proof-note");
  const fillPathsButton = document.getElementById("run-fill-pending-paths");
  const draftChecksButton = document.getElementById("run-draft-pending-checks");
  if (!note) {
    return;
  }

  const view = buildRunProofNoteView(getPendingProofPaths(detail));

  if (fillPathsButton) {
    fillPathsButton.disabled = view.fillPathsButtonDisabled;
    fillPathsButton.textContent = view.fillPathsButtonText;
  }
  if (draftChecksButton) {
    draftChecksButton.disabled = view.draftChecksButtonDisabled;
    draftChecksButton.textContent = view.draftChecksButtonText;
  }

  note.textContent = view.noteText;
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
        panel.classList.remove("hidden");
        panel.innerHTML = renderExecutionLogLoading(stream);
        const log = await loadRunLog(taskId, runId, stream);
        panel.innerHTML = renderRunLogView(log);
        button.dataset.loaded = stream;
        button.textContent = stream === "stdout" ? "Hide stdout" : "Hide stderr";
      } catch (error) {
        panel.classList.remove("hidden");
        panel.innerHTML = renderExecutionLogError(error.message);
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

  const resolvedTaskId = resolveNextActiveTaskId(overview.tasks || [], nextTaskId, activeTaskId);

  if (resolvedTaskId) {
    activeTaskId = resolvedTaskId;
    renderTasks(overview.tasks || []);
    renderTaskDetail(await loadTaskDetail(activeTaskId));
  } else {
    activeTaskId = null;
    renderTaskDetail(null);
  }
}

function bindForms() {
  bindDashboardForms({
    document,
    FormDataCtor: FormData,
    assignActiveExecutionState(taskId, state) {
      if (activeTaskDetail && activeTaskDetail.meta && activeTaskDetail.meta.id === taskId) {
        activeTaskDetail.executionState = state;
      }
    },
    clearRunEvidenceDraft,
    collectRunDraftValues,
    getActiveDocumentName: () => activeDocumentName,
    getActiveTaskDetail: () => activeTaskDetail,
    getOverviewTasks: () => (window.__overview && window.__overview.tasks) || [],
    getPendingProofPaths,
    getVerificationEditorBaseText,
    hasRunDraftVerificationContent,
    mergeProofCheckDraft,
    mergeProofPathDraft,
    mergeVerificationFromRunDraft,
    mergeVerificationProofPlanDraft,
    normalizeExecutorOutcomeFilter,
    normalizeOptionalPositiveInteger,
    openVerificationEditorDraft,
    parseRunEvidenceDraft,
    patchJson: dashboardApi.patchJson,
    populateDocumentEditor,
    postJson: dashboardApi.postJson,
    putJson: dashboardApi.putJson,
    refreshDashboard,
    renderTaskDetail,
    renderTasks,
    scheduleExecutionPolling,
    setActionStatus,
    setActiveDocumentName(value) {
      activeDocumentName = value;
    },
    setActiveExecutorOutcomeFilter(value) {
      activeExecutorOutcomeFilter = value;
    },
    updateExecutionStateUI,
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
    describeExecutionPresentation,
    describeRunPresentation,
    describeVerificationProofSignals,
    extractVerificationPlannedChecks,
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
    resolveExecutionLogSource,
    summarizeExecutorOutcomeFilter,
  };
}
