import { useEffect, useRef, useState } from "preact/hooks";
import DocumentEditor from "./DocumentEditor.jsx";
import { useDashboardContext } from "../context/DashboardContext.jsx";
import {
  getEditableDocumentConfig,
  getEditableDocumentContent,
  getPendingProofPaths,
  hasRunDraftVerificationContent,
  mergeProofCheckDraft,
  mergeProofPathDraft,
  mergeVerificationFromRunDraft,
  mergeVerificationProofPlanDraft,
  parseRunEvidenceDraft,
} from "../utils/document.js";
import {
  buildDocumentEditorView,
  buildRunProofNoteView,
  buildTaskFormView,
  getVerificationEditorBaseText,
  normalizeOptionalPositiveInteger,
} from "../utils/forms.js";
import {
  buildDocumentSavePayload,
  buildManualProofAnchorRefreshMessage,
  buildQuickCreatePayload,
  buildRunCreatePayload,
  buildTaskCreatePayload,
  buildTaskUpdatePayload,
  hasUnsavedVerificationEditorChanges,
  requireActiveTaskId,
  resolveExecutionRequest,
} from "../utils/forms.js";

function getDefaultRecipeId(recipes) {
  return recipes.find((recipe) => recipe.id === "feature")?.id || recipes[0]?.id || "feature";
}

function createInitialQuickForm(recipes) {
  return {
    agent: "codex",
    priority: "P2",
    recipeId: getDefaultRecipeId(recipes),
    taskId: "",
    title: "",
  };
}

function createInitialCreateForm(recipes) {
  return {
    priority: "P2",
    recipeId: getDefaultRecipeId(recipes),
    taskId: "",
    title: "",
  };
}

function createInitialRunForm() {
  return {
    agent: "codex",
    executeAgent: "codex",
    executeTimeoutMs: "",
    scopeProofPaths: "",
    status: "passed",
    summary: "",
    taskId: "",
    verificationArtifacts: "",
    verificationChecks: "",
  };
}

export default function Forms({ hidden }) {
  const {
    api,
    refreshDashboard,
    setActionStatus,
    setActiveDocumentName,
    state,
    updateSelectedExecutionState,
  } = useDashboardContext();
  const detail = state.taskDetail.data;
  const recipes = state.overview.data?.recipes || [];
  const pendingPaths = getPendingProofPaths(detail);
  const activeDocumentName = state.activeDocumentName;
  const previousRunTaskIdRef = useRef("");
  const documentOverrideRef = useRef(null);

  const [quickForm, setQuickForm] = useState(createInitialQuickForm(recipes));
  const [createForm, setCreateForm] = useState(createInitialCreateForm(recipes));
  const [taskUpdateForm, setTaskUpdateForm] = useState({
    priority: "P2",
    recipeId: getDefaultRecipeId(recipes),
    status: "todo",
    taskId: "",
    title: "",
  });
  const [runForm, setRunForm] = useState(createInitialRunForm());
  const [documentContent, setDocumentContent] = useState("");

  useEffect(() => {
    const defaultRecipeId = getDefaultRecipeId(recipes);
    setQuickForm((current) => ({
      ...current,
      recipeId: recipes.some((recipe) => recipe.id === current.recipeId) ? current.recipeId : defaultRecipeId,
    }));
    setCreateForm((current) => ({
      ...current,
      recipeId: recipes.some((recipe) => recipe.id === current.recipeId) ? current.recipeId : defaultRecipeId,
    }));
    setTaskUpdateForm((current) => ({
      ...current,
      recipeId: recipes.some((recipe) => recipe.id === current.recipeId) ? current.recipeId : defaultRecipeId,
    }));
  }, [recipes]);

  useEffect(() => {
    const view = buildTaskFormView(detail, previousRunTaskIdRef.current);
    previousRunTaskIdRef.current = view.runTaskId;

    setTaskUpdateForm((current) => ({
      ...current,
      priority: view.selectedTaskPriority,
      recipeId: view.selectedTaskRecipeId,
      status: view.selectedTaskStatus,
      taskId: view.selectedTaskId,
      title: view.selectedTaskTitle,
    }));

    setRunForm((current) => ({
      ...current,
      scopeProofPaths: view.shouldClearRunEvidenceDraft ? "" : current.scopeProofPaths,
      summary: view.shouldClearRunEvidenceDraft ? "" : current.summary,
      taskId: view.runTaskId,
      verificationArtifacts: view.shouldClearRunEvidenceDraft ? "" : current.verificationArtifacts,
      verificationChecks: view.shouldClearRunEvidenceDraft ? "" : current.verificationChecks,
    }));
  }, [detail?.meta?.id, detail?.meta?.priority, detail?.meta?.recipeId, detail?.meta?.status, detail?.meta?.title]);

  useEffect(() => {
    const editableConfig = getEditableDocumentConfig(activeDocumentName);
    const nextContent =
      documentOverrideRef.current !== null
        ? documentOverrideRef.current
        : detail && editableConfig.detailField
          ? getEditableDocumentContent(activeDocumentName, detail[editableConfig.detailField] || "")
          : "";

    setDocumentContent(nextContent);
    documentOverrideRef.current = null;
  }, [activeDocumentName, detail?.contextText, detail?.meta?.id, detail?.taskText, detail?.verificationText]);

  const editableConfig = getEditableDocumentConfig(activeDocumentName);
  const documentView = {
    ...buildDocumentEditorView({
      activeDocumentName,
      detail,
      documentContent,
      editableConfig,
      pendingPaths,
    }),
    freeSections: editableConfig.freeSections || [],
    managedSections: editableConfig.managedSections || [],
  };
  const runProofView = buildRunProofNoteView(pendingPaths);

  async function handleQuickCreateSubmit(event) {
    event.preventDefault();
    const payload = buildQuickCreatePayload(new FormData(event.currentTarget));

    try {
      setActionStatus("Creating quick task...", "");
      const quickTask = await api.quickCreateTask(payload);
      setQuickForm(createInitialQuickForm(recipes));
      await refreshDashboard(quickTask.taskId);
      setActionStatus(
        `Quick task ${quickTask.taskId} is ready for ${quickTask.adapterId || payload.agent || "codex"}.`,
        "success"
      );
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  }

  async function handleCreateTaskSubmit(event) {
    event.preventDefault();
    const payload = buildTaskCreatePayload(new FormData(event.currentTarget));

    try {
      setActionStatus("Creating task...", "");
      const task = await api.postJson("/api/tasks", payload);
      setCreateForm(createInitialCreateForm(recipes));
      await refreshDashboard(task.id);
      setActionStatus(`Created task ${task.id}.`, "success");
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  }

  async function handleUpdateTaskSubmit(event) {
    event.preventDefault();
    const request = buildTaskUpdatePayload(new FormData(event.currentTarget));
    if (!request.taskId) {
      setActionStatus("Select a task before updating it.", "error");
      return;
    }

    try {
      setActionStatus(`Saving task ${request.taskId}...`, "");
      await api.patchJson(`/api/tasks/${encodeURIComponent(request.taskId)}`, request.payload);
      await refreshDashboard(request.taskId);
      setActionStatus(`Updated task ${request.taskId}.`, "success");
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  }

  async function handleRunSubmit(event) {
    event.preventDefault();
    const request = buildRunCreatePayload(new FormData(event.currentTarget), parseRunEvidenceDraft);
    if (!request.taskId) {
      setActionStatus("Select a task before recording run evidence.", "error");
      return;
    }

    try {
      setActionStatus(`Recording run for ${request.taskId}...`, "");
      await api.postJson(`/api/tasks/${encodeURIComponent(request.taskId)}/runs`, request.payload);
      setRunForm((current) => ({
        ...current,
        scopeProofPaths: "",
        summary: "",
        verificationArtifacts: "",
        verificationChecks: "",
      }));
      await refreshDashboard(request.taskId);
      setActionStatus(`Recorded run evidence for ${request.taskId}.`, "success");
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  }

  async function handleExecuteLocal() {
    try {
      const request = resolveExecutionRequest({
        activeTaskDetail: detail,
        agentValue: runForm.executeAgent,
        normalizeOptionalPositiveInteger,
        timeoutValue: runForm.executeTimeoutMs,
      });
      setActionStatus(`Starting local ${request.agent} execution for ${request.taskId}...`, "");
      const executionState = await api.postJson(`/api/tasks/${encodeURIComponent(request.taskId)}/execute`, {
        agent: request.agent,
        timeoutMs: request.timeoutMs,
      });
      updateSelectedExecutionState(request.taskId, executionState);
      setActionStatus(`Started local ${request.agent} execution for ${request.taskId}.`, "success");
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  }

  async function handleCancelExecution() {
    try {
      const taskId = requireActiveTaskId(detail, "Select a task before cancelling local execution.");
      setActionStatus(`Requesting cancellation for ${taskId}...`, "");
      const executionState = await api.postJson(`/api/tasks/${encodeURIComponent(taskId)}/execution/cancel`, {});
      updateSelectedExecutionState(taskId, executionState);
      setActionStatus(`Cancellation requested for ${taskId}.`, "success");
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  }

  function handleFillPendingPaths() {
    if (pendingPaths.length === 0) {
      setActionStatus("No pending scoped files are available for this task right now.", "error");
      return;
    }

    setRunForm((current) => ({
      ...current,
      scopeProofPaths: mergeProofPathDraft(current.scopeProofPaths, detail),
    }));
    setActionStatus(`Added ${pendingPaths.length} pending scoped file(s) to proof paths.`, "success");
  }

  function handleDraftPendingChecks() {
    if (pendingPaths.length === 0) {
      setActionStatus("No pending scoped files are available for draft checks right now.", "error");
      return;
    }

    setRunForm((current) => ({
      ...current,
      verificationChecks: mergeProofCheckDraft(current.verificationChecks, detail, current.status),
    }));
    setActionStatus(`Drafted check text for ${pendingPaths.length} pending scoped file(s).`, "success");
  }

  function handleSyncVerificationDraft() {
    try {
      requireActiveTaskId(detail, "Select a task before syncing the run draft into verification.md.");
      const runDraftValues = {
        scopeProofPaths: runForm.scopeProofPaths,
        status: runForm.status,
        verificationArtifacts: runForm.verificationArtifacts,
        verificationChecks: runForm.verificationChecks,
      };

      if (!hasRunDraftVerificationContent(runDraftValues)) {
        setActionStatus(
          "Add proof paths or verification checks in the run form before syncing them into verification.md.",
          "error"
        );
        return;
      }

      const nextContent = mergeVerificationFromRunDraft(
        getVerificationEditorBaseText({
          activeDocumentName,
          currentEditorText: documentContent,
          detail,
          getEditableDocumentContent,
        }),
        runDraftValues
      );
      documentOverrideRef.current = nextContent;
      setActiveDocumentName("verification.md");
      setActionStatus(
        "Synced the current run draft into the verification.md editor. Review and save when ready.",
        "success"
      );
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  }

  function handleDraftProofLinks() {
    if (activeDocumentName !== "verification.md") {
      setActionStatus("Switch the editor to verification.md before drafting verification records.", "error");
      return;
    }

    if (pendingPaths.length === 0) {
      setActionStatus(
        "No pending scoped files are available for verification-record drafting right now.",
        "error"
      );
      return;
    }

    setDocumentContent((current) => mergeVerificationProofPlanDraft(current, detail));
    setActionStatus(
      `Drafted draft checks and verification-record placeholders for ${pendingPaths.length} pending scoped file(s). Fill Check/Result/Artifact before treating them as verified evidence.`,
      "success"
    );
  }

  async function handleRefreshProofAnchors() {
    try {
      const taskId = requireActiveTaskId(detail, "Select a task before refreshing verification records.");
      if (activeDocumentName !== "verification.md") {
        setActionStatus("Switch the editor to verification.md before refreshing verification records.", "error");
        return;
      }

      if (
        hasUnsavedVerificationEditorChanges(
          activeDocumentName,
          documentContent,
          detail,
          getEditableDocumentContent
        )
      ) {
        setActionStatus(
          "Save verification.md before refreshing verification records so the managed data matches the latest proof text.",
          "error"
        );
        return;
      }

      setActionStatus(`Refreshing verification records for ${taskId}...`, "");
      const response = await api.postJson(
        `/api/tasks/${encodeURIComponent(taskId)}/verification/anchors/refresh`,
        {}
      );
      await refreshDashboard(taskId);
      setActionStatus(buildManualProofAnchorRefreshMessage(taskId, response?.manualProofAnchorRefresh), "success");
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  }

  async function handleDocumentSubmit(event) {
    event.preventDefault();
    const request = buildDocumentSavePayload(new FormData(event.currentTarget));
    if (!request.taskId) {
      setActionStatus("Select a task before editing its markdown docs.", "error");
      return;
    }

    try {
      setActiveDocumentName(request.documentName);
      setActionStatus(`Saving ${request.documentName} for ${request.taskId}...`, "");
      await api.putJson(
        `/api/tasks/${encodeURIComponent(request.taskId)}/documents/${encodeURIComponent(request.documentName)}`,
        {
          content: request.content,
        }
      );
      await refreshDashboard(request.taskId);
      setActionStatus(`Saved ${request.documentName} for ${request.taskId}.`, "success");
    } catch (error) {
      setActionStatus(error.message, "error");
    }
  }

  return (
    <section className={hidden ? "panel panel-wide tab-hidden" : "panel panel-wide"} data-tab="actions">
      <div className="panel-head">
        <div>
          <h2>Task Actions</h2>
          <p>
            Quick-create task bundles, update task metadata, record run evidence, and edit markdown docs without
            leaving the dashboard.
          </p>
        </div>
      </div>

      <div className="action-grid">
        <form className="form-card" id="task-quick-form" onSubmit={handleQuickCreateSubmit}>
          <h3>Quick Create</h3>
          <p className="subtle">
            Thin dashboard entrypoint over the same durable `quick` flow: scan, task bundle, prompt, run request,
            launch pack, and checkpoint.
          </p>
          <label>
            <span>Task ID (Optional)</span>
            <input
              id="quick-task-id"
              name="taskId"
              onInput={(event) => setQuickForm((current) => ({ ...current, taskId: event.currentTarget.value }))}
              placeholder="T-002"
              type="text"
              value={quickForm.taskId}
            />
          </label>
          <label>
            <span>Title</span>
            <input
              name="title"
              onInput={(event) => setQuickForm((current) => ({ ...current, title: event.currentTarget.value }))}
              required
              type="text"
              value={quickForm.title}
            />
          </label>
          <label>
            <span>Priority</span>
            <select
              id="quick-priority"
              name="priority"
              onChange={(event) => setQuickForm((current) => ({ ...current, priority: event.currentTarget.value }))}
              value={quickForm.priority}
            >
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
              <option value="P0">P0</option>
            </select>
          </label>
          <label>
            <span>Recipe</span>
            <select
              id="quick-recipe"
              name="recipeId"
              onChange={(event) => setQuickForm((current) => ({ ...current, recipeId: event.currentTarget.value }))}
              value={quickForm.recipeId}
            >
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.id} - {recipe.name}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Agent</span>
            <select
              id="quick-agent"
              name="agent"
              onChange={(event) => setQuickForm((current) => ({ ...current, agent: event.currentTarget.value }))}
              value={quickForm.agent}
            >
              <option value="codex">codex</option>
              <option value="claude-code">claude-code</option>
            </select>
          </label>
          <button type="submit">Quick Create</button>
        </form>

        <form className="form-card" id="task-create-form" onSubmit={handleCreateTaskSubmit}>
          <h3>Create Task</h3>
          <label>
            <span>Task ID</span>
            <input
              name="taskId"
              onInput={(event) => setCreateForm((current) => ({ ...current, taskId: event.currentTarget.value }))}
              required
              type="text"
              value={createForm.taskId}
            />
          </label>
          <label>
            <span>Title</span>
            <input
              name="title"
              onInput={(event) => setCreateForm((current) => ({ ...current, title: event.currentTarget.value }))}
              required
              type="text"
              value={createForm.title}
            />
          </label>
          <label>
            <span>Priority</span>
            <select
              id="create-priority"
              name="priority"
              onChange={(event) => setCreateForm((current) => ({ ...current, priority: event.currentTarget.value }))}
              value={createForm.priority}
            >
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
              <option value="P0">P0</option>
            </select>
          </label>
          <label>
            <span>Recipe</span>
            <select
              id="create-recipe"
              name="recipeId"
              onChange={(event) => setCreateForm((current) => ({ ...current, recipeId: event.currentTarget.value }))}
              value={createForm.recipeId}
            >
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.id} - {recipe.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Create Task</button>
        </form>

        <form className="form-card" id="task-update-form" onSubmit={handleUpdateTaskSubmit}>
          <h3>Selected Task</h3>
          <label>
            <span>Task ID</span>
            <input id="selected-task-id" name="taskId" readOnly type="text" value={taskUpdateForm.taskId} />
          </label>
          <label>
            <span>Title</span>
            <input
              id="selected-task-title"
              name="title"
              onInput={(event) => setTaskUpdateForm((current) => ({ ...current, title: event.currentTarget.value }))}
              placeholder="Select a task first"
              type="text"
              value={taskUpdateForm.title}
            />
          </label>
          <label>
            <span>Status</span>
            <select
              id="selected-task-status"
              name="status"
              onChange={(event) => setTaskUpdateForm((current) => ({ ...current, status: event.currentTarget.value }))}
              value={taskUpdateForm.status}
            >
              <option value="todo">todo</option>
              <option value="in_progress">in_progress</option>
              <option value="blocked">blocked</option>
              <option value="done">done</option>
            </select>
          </label>
          <label>
            <span>Priority</span>
            <select
              id="selected-task-priority"
              name="priority"
              onChange={(event) => setTaskUpdateForm((current) => ({ ...current, priority: event.currentTarget.value }))}
              value={taskUpdateForm.priority}
            >
              <option value="P0">P0</option>
              <option value="P1">P1</option>
              <option value="P2">P2</option>
              <option value="P3">P3</option>
            </select>
          </label>
          <label>
            <span>Recipe</span>
            <select
              id="selected-task-recipe"
              name="recipeId"
              onChange={(event) => setTaskUpdateForm((current) => ({ ...current, recipeId: event.currentTarget.value }))}
              value={taskUpdateForm.recipeId}
            >
              {recipes.map((recipe) => (
                <option key={recipe.id} value={recipe.id}>
                  {recipe.id} - {recipe.name}
                </option>
              ))}
            </select>
          </label>
          <button disabled={!taskUpdateForm.taskId} type="submit">
            Save Task Meta
          </button>
        </form>

        <form className="form-card" id="run-create-form" onSubmit={handleRunSubmit}>
          <h3>Record Run</h3>
          <label>
            <span>Task ID</span>
            <input id="run-task-id" name="taskId" readOnly type="text" value={runForm.taskId} />
          </label>
          <label>
            <span>Agent</span>
            <select
              id="run-agent"
              name="agent"
              onChange={(event) => setRunForm((current) => ({ ...current, agent: event.currentTarget.value }))}
              value={runForm.agent}
            >
              <option value="codex">codex</option>
              <option value="claude-code">claude-code</option>
              <option value="manual">manual</option>
            </select>
          </label>
          <label>
            <span>Status</span>
            <select
              id="run-status"
              name="status"
              onChange={(event) => setRunForm((current) => ({ ...current, status: event.currentTarget.value }))}
              value={runForm.status}
            >
              <option value="passed">passed</option>
              <option value="draft">draft</option>
              <option value="failed">failed</option>
            </select>
          </label>
          <label>
            <span>Summary</span>
            <textarea
              id="run-summary"
              name="summary"
              onInput={(event) => setRunForm((current) => ({ ...current, summary: event.currentTarget.value }))}
              rows="5"
              value={runForm.summary}
            />
          </label>
          <label>
            <span>Proof Paths</span>
            <textarea
              id="run-proof-paths"
              name="scopeProofPaths"
              onInput={(event) =>
                setRunForm((current) => ({ ...current, scopeProofPaths: event.currentTarget.value }))
              }
              rows="4"
              value={runForm.scopeProofPaths}
            />
          </label>
          <div className="form-inline-actions">
            <button
              className="secondary-button"
              disabled={runProofView.fillPathsButtonDisabled}
              id="run-fill-pending-paths"
              onClick={handleFillPendingPaths}
              type="button"
            >
              {runProofView.fillPathsButtonText}
            </button>
            <button
              className="secondary-button"
              disabled={runProofView.draftChecksButtonDisabled}
              id="run-draft-pending-checks"
              onClick={handleDraftPendingChecks}
              type="button"
            >
              {runProofView.draftChecksButtonText}
            </button>
            <button
              className="secondary-button"
              id="run-sync-verification-draft"
              onClick={handleSyncVerificationDraft}
              type="button"
            >
              Sync Draft To verification.md Editor
            </button>
          </div>
          <label>
            <span>Verification Checks</span>
            <textarea
              id="run-checks"
              name="verificationChecks"
              onInput={(event) =>
                setRunForm((current) => ({ ...current, verificationChecks: event.currentTarget.value }))
              }
              rows="4"
              value={runForm.verificationChecks}
            />
          </label>
          <label>
            <span>Verification Artifacts</span>
            <textarea
              id="run-artifacts"
              name="verificationArtifacts"
              onInput={(event) =>
                setRunForm((current) => ({ ...current, verificationArtifacts: event.currentTarget.value }))
              }
              rows="4"
              value={runForm.verificationArtifacts}
            />
          </label>
          <p className="subtle" id="run-proof-note">
            {runProofView.noteText}
          </p>
          <div className="form-subsection">
            <h4>Execute Local Adapter</h4>
            <p className="subtle" id="run-execute-note">
              Thin local bridge over `run:execute`. Dashboard-triggered execution stays local-only, currently supports
              adapters that resolve to `stdioMode: pipe`, and can request cancellation for active local runs.
            </p>
            <div className="editor-meta">
              <label>
                <span>Execute Agent</span>
                <select
                  id="run-execute-agent"
                  name="executeAgent"
                  onChange={(event) =>
                    setRunForm((current) => ({ ...current, executeAgent: event.currentTarget.value }))
                  }
                  value={runForm.executeAgent}
                >
                  <option value="codex">codex</option>
                  <option value="claude-code">claude-code</option>
                </select>
              </label>
              <label>
                <span>Timeout Override (ms)</span>
                <input
                  id="run-execute-timeout"
                  name="executeTimeoutMs"
                  min="1"
                  onInput={(event) =>
                    setRunForm((current) => ({ ...current, executeTimeoutMs: event.currentTarget.value }))
                  }
                  placeholder="Optional"
                  type="number"
                  value={runForm.executeTimeoutMs}
                />
              </label>
            </div>
            <div className="form-inline-actions">
              <button className="secondary-button" id="run-execute-local" onClick={handleExecuteLocal} type="button">
                Execute Local Adapter
              </button>
              <button
                className="secondary-button"
                id="run-cancel-execution"
                onClick={handleCancelExecution}
                type="button"
              >
                Cancel Active Execution
              </button>
            </div>
            <p className="subtle run-execution-status" id="run-execution-status">
              {detail?.executionState?.summary || "Select a task to view local execution status."}
            </p>
          </div>
          <button disabled={!runForm.taskId} type="submit">
            Record Run Evidence
          </button>
        </form>

        <DocumentEditor
          content={documentContent}
          detail={detail}
          documentName={activeDocumentName}
          onContentChange={setDocumentContent}
          onDocumentNameChange={setActiveDocumentName}
          onDraftProofLinks={handleDraftProofLinks}
          onRefreshProofAnchors={handleRefreshProofAnchors}
          onSubmit={handleDocumentSubmit}
          view={documentView}
        />
      </div>

      <div className={`action-status${state.actionStatus.tone ? ` ${state.actionStatus.tone}` : ""}`} id="action-status">
        {state.actionStatus.message}
      </div>
    </section>
  );
}
