(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  root.AgentWorkflowDashboardFormEventHelpers = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  function bindDashboardForms(deps = {}) {
    const doc = deps.document;
    if (!doc) {
      throw new Error("Document is required to bind dashboard forms.");
    }

    doc.getElementById("task-executor-filter").addEventListener("change", (event) => {
      deps.setActiveExecutorOutcomeFilter(deps.normalizeExecutorOutcomeFilter(event.currentTarget.value));
      deps.renderTasks(deps.getOverviewTasks());
    });

    doc.getElementById("document-name").addEventListener("change", (event) => {
      deps.setActiveDocumentName(event.currentTarget.value || "task.md");
      deps.populateDocumentEditor(deps.getActiveTaskDetail());
    });

    doc.getElementById("task-create-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const payload = buildTaskCreatePayload(new deps.FormDataCtor(event.currentTarget));

      try {
        deps.setActionStatus("Creating task...", "");
        const task = await deps.postJson("/api/tasks", payload);
        event.currentTarget.reset();
        doc.getElementById("create-priority").value = "P2";
        doc.getElementById("create-recipe").value = payload.recipeId || "feature";
        await deps.refreshDashboard(task.id);
        deps.setActionStatus(`Created task ${task.id}.`, "success");
      } catch (error) {
        deps.setActionStatus(error.message, "error");
      }
    });

    doc.getElementById("task-update-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const request = buildTaskUpdatePayload(new deps.FormDataCtor(event.currentTarget));
      if (!request.taskId) {
        deps.setActionStatus("Select a task before updating it.", "error");
        return;
      }

      try {
        deps.setActionStatus(`Saving task ${request.taskId}...`, "");
        await deps.patchJson(`/api/tasks/${encodeURIComponent(request.taskId)}`, request.payload);
        await deps.refreshDashboard(request.taskId);
        deps.setActionStatus(`Updated task ${request.taskId}.`, "success");
      } catch (error) {
        deps.setActionStatus(error.message, "error");
      }
    });

    doc.getElementById("run-create-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const request = buildRunCreatePayload(new deps.FormDataCtor(event.currentTarget), deps.parseRunEvidenceDraft);
      if (!request.taskId) {
        deps.setActionStatus("Select a task before recording run evidence.", "error");
        return;
      }

      try {
        deps.setActionStatus(`Recording run for ${request.taskId}...`, "");
        await deps.postJson(`/api/tasks/${encodeURIComponent(request.taskId)}/runs`, request.payload);
        deps.clearRunEvidenceDraft();
        await deps.refreshDashboard(request.taskId);
        deps.setActionStatus(`Recorded run evidence for ${request.taskId}.`, "success");
      } catch (error) {
        deps.setActionStatus(error.message, "error");
      }
    });

    doc.getElementById("run-execute-local").addEventListener("click", async () => {
      try {
        const request = resolveExecutionRequest({
          activeTaskDetail: deps.getActiveTaskDetail(),
          agentValue: doc.getElementById("run-execute-agent").value,
          timeoutValue: doc.getElementById("run-execute-timeout").value,
          normalizeOptionalPositiveInteger: deps.normalizeOptionalPositiveInteger,
        });
        deps.setActionStatus(`Starting local ${request.agent} execution for ${request.taskId}...`, "");
        const state = await deps.postJson(`/api/tasks/${encodeURIComponent(request.taskId)}/execute`, {
          agent: request.agent,
          timeoutMs: request.timeoutMs,
        });
        deps.assignActiveExecutionState(request.taskId, state);
        deps.updateExecutionStateUI(state);
        deps.scheduleExecutionPolling(request.taskId, 200);
        deps.setActionStatus(`Started local ${request.agent} execution for ${request.taskId}.`, "success");
      } catch (error) {
        deps.setActionStatus(error.message, "error");
      }
    });

    doc.getElementById("run-cancel-execution").addEventListener("click", async () => {
      try {
        const taskId = requireActiveTaskId(deps.getActiveTaskDetail(), "Select a task before cancelling local execution.");
        deps.setActionStatus(`Requesting cancellation for ${taskId}...`, "");
        const state = await deps.postJson(`/api/tasks/${encodeURIComponent(taskId)}/execution/cancel`, {});
        deps.assignActiveExecutionState(taskId, state);
        deps.updateExecutionStateUI(state);
        deps.scheduleExecutionPolling(taskId, 200);
        deps.setActionStatus(`Cancellation requested for ${taskId}.`, "success");
      } catch (error) {
        deps.setActionStatus(error.message, "error");
      }
    });

    doc.getElementById("run-fill-pending-paths").addEventListener("click", () => {
      const pendingPaths = deps.getPendingProofPaths(deps.getActiveTaskDetail());
      if (pendingPaths.length === 0) {
        deps.setActionStatus("No pending scoped files are available for this task right now.", "error");
        return;
      }

      const input = doc.getElementById("run-proof-paths");
      input.value = deps.mergeProofPathDraft(input.value, deps.getActiveTaskDetail());
      deps.setActionStatus(`Added ${pendingPaths.length} pending scoped file(s) to proof paths.`, "success");
    });

    doc.getElementById("run-draft-pending-checks").addEventListener("click", () => {
      const pendingPaths = deps.getPendingProofPaths(deps.getActiveTaskDetail());
      if (pendingPaths.length === 0) {
        deps.setActionStatus("No pending scoped files are available for draft checks right now.", "error");
        return;
      }

      const input = doc.getElementById("run-checks");
      input.value = deps.mergeProofCheckDraft(input.value, deps.getActiveTaskDetail(), doc.getElementById("run-status").value);
      deps.setActionStatus(`Drafted check text for ${pendingPaths.length} pending scoped file(s).`, "success");
    });

    doc.getElementById("run-sync-verification-draft").addEventListener("click", () => {
      try {
        requireActiveTaskId(deps.getActiveTaskDetail(), "Select a task before syncing the run draft into verification.md.");
        const runDraftValues = deps.collectRunDraftValues();
        if (!deps.hasRunDraftVerificationContent(runDraftValues)) {
          deps.setActionStatus("Add proof paths or verification checks in the run form before syncing them into verification.md.", "error");
          return;
        }

        const nextContent = deps.mergeVerificationFromRunDraft(
          deps.getVerificationEditorBaseText({
            activeDocumentName: deps.getActiveDocumentName(),
            currentEditorText: doc.getElementById("document-content").value,
            detail: deps.getActiveTaskDetail(),
          }),
          runDraftValues
        );
        deps.openVerificationEditorDraft(nextContent);
        deps.setActionStatus("Synced the current run draft into the verification.md editor. Review and save when ready.", "success");
      } catch (error) {
        deps.setActionStatus(error.message, "error");
      }
    });

    doc.getElementById("document-draft-proof-links").addEventListener("click", () => {
      const input = doc.getElementById("document-content");
      const pendingPaths = deps.getPendingProofPaths(deps.getActiveTaskDetail());

      if (deps.getActiveDocumentName() !== "verification.md") {
        deps.setActionStatus("Switch the editor to verification.md before drafting proof links.", "error");
        return;
      }

      if (pendingPaths.length === 0) {
        deps.setActionStatus("No pending scoped files are available for proof-link drafting right now.", "error");
        return;
      }

      input.value = deps.mergeVerificationProofPlanDraft(input.value, deps.getActiveTaskDetail());
      deps.setActionStatus(
        `Drafted planned checks and proof-link placeholders for ${pendingPaths.length} pending scoped file(s). Fill Check/Result/Artifact before treating them as proof.`,
        "success"
      );
    });

    doc.getElementById("document-refresh-proof-anchors").addEventListener("click", async () => {
      try {
        const detail = deps.getActiveTaskDetail();
        const taskId = requireActiveTaskId(detail, "Select a task before refreshing manual proof anchors.");
        if (deps.getActiveDocumentName() !== "verification.md") {
          deps.setActionStatus("Switch the editor to verification.md before refreshing proof anchors.", "error");
          return;
        }

        const editorContent = doc.getElementById("document-content").value;
        if (
          hasUnsavedVerificationEditorChanges(
            deps.getActiveDocumentName(),
            editorContent,
            detail,
            deps.getEditableDocumentContent
          )
        ) {
          deps.setActionStatus(
            "Save verification.md before refreshing proof anchors so the managed anchors match the latest proof text.",
            "error"
          );
          return;
        }

        deps.setActionStatus(`Refreshing proof anchors for ${taskId}...`, "");
        const response = await deps.postJson(
          `/api/tasks/${encodeURIComponent(taskId)}/verification/anchors/refresh`,
          {}
        );
        await deps.refreshDashboard(taskId);
        deps.setActionStatus(
          buildManualProofAnchorRefreshMessage(taskId, response && response.manualProofAnchorRefresh),
          "success"
        );
      } catch (error) {
        deps.setActionStatus(error.message, "error");
      }
    });

    doc.getElementById("document-editor-form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const request = buildDocumentSavePayload(new deps.FormDataCtor(event.currentTarget));
      if (!request.taskId) {
        deps.setActionStatus("Select a task before editing its markdown docs.", "error");
        return;
      }

      try {
        deps.setActiveDocumentName(request.documentName);
        deps.setActionStatus(`Saving ${request.documentName} for ${request.taskId}...`, "");
        const detail = await deps.putJson(
          `/api/tasks/${encodeURIComponent(request.taskId)}/documents/${encodeURIComponent(request.documentName)}`,
          {
            content: request.content,
          }
        );
        deps.renderTaskDetail(detail);
        deps.renderTasks(deps.getOverviewTasks());
        deps.setActionStatus(`Saved ${request.documentName} for ${request.taskId}.`, "success");
      } catch (error) {
        deps.setActionStatus(error.message, "error");
      }
    });
  }

  function buildTaskCreatePayload(formData) {
    return {
      taskId: String(formData.get("taskId") || "").trim(),
      title: String(formData.get("title") || "").trim(),
      priority: String(formData.get("priority") || "").trim(),
      recipeId: String(formData.get("recipeId") || "").trim(),
    };
  }

  function buildTaskUpdatePayload(formData) {
    return {
      taskId: String(formData.get("taskId") || "").trim(),
      payload: {
        title: String(formData.get("title") || "").trim(),
        status: String(formData.get("status") || "").trim(),
        priority: String(formData.get("priority") || "").trim(),
        recipeId: String(formData.get("recipeId") || "").trim(),
      },
    };
  }

  function buildRunCreatePayload(formData, parseRunEvidenceDraft) {
    const status = String(formData.get("status") || "").trim();
    return {
      taskId: String(formData.get("taskId") || "").trim(),
      payload: {
        agent: String(formData.get("agent") || "").trim(),
        status,
        summary: String(formData.get("summary") || "").trim(),
        ...(typeof parseRunEvidenceDraft === "function"
          ? parseRunEvidenceDraft({
              status,
              scopeProofPaths: String(formData.get("scopeProofPaths") || ""),
              verificationChecks: String(formData.get("verificationChecks") || ""),
              verificationArtifacts: String(formData.get("verificationArtifacts") || ""),
            })
          : {}),
      },
    };
  }

  function buildDocumentSavePayload(formData) {
    return {
      taskId: String(formData.get("taskId") || "").trim(),
      documentName: String(formData.get("documentName") || "").trim() || "task.md",
      content: String(formData.get("content") || ""),
    };
  }

  function hasUnsavedVerificationEditorChanges(activeDocumentName, editorContent, detail, getEditableDocumentContent) {
    if (activeDocumentName !== "verification.md") {
      return false;
    }

    const savedContent =
      detail && typeof detail.verificationText === "string"
        ? typeof getEditableDocumentContent === "function"
          ? getEditableDocumentContent("verification.md", detail.verificationText)
          : detail.verificationText
        : "";

    return normalizeMultilineText(editorContent) !== normalizeMultilineText(savedContent);
  }

  function buildManualProofAnchorRefreshMessage(taskId, refreshSummary = {}) {
    const strongProofCount = Number(refreshSummary.strongProofCount || 0);
    const refreshedCount = Number(refreshSummary.refreshedCount || 0);
    const skippedCount = Number(refreshSummary.skippedCount || 0);
    const clearedCount = Number(refreshSummary.clearedCount || 0);
    const changed = Boolean(refreshSummary.changed);

    if (clearedCount > 0 && strongProofCount === 0) {
      return `Cleared ${clearedCount} stale manual proof anchor record(s) for ${taskId}; no strong manual proof items remain.`;
    }

    if (refreshedCount > 0 && skippedCount > 0) {
      return `Refreshed ${refreshedCount} manual proof anchor record(s) for ${taskId}; ${skippedCount} strong proof item(s) stay on compatibility-only freshness.`;
    }

    if (refreshedCount > 0 && !changed) {
      return `Manual proof anchors are already current for ${taskId}.`;
    }

    if (refreshedCount > 0) {
      return `Refreshed ${refreshedCount} manual proof anchor record(s) for ${taskId}.`;
    }

    if (skippedCount > 0) {
      return `No manual proof anchors were captured for ${taskId}; ${skippedCount} strong proof item(s) stay on compatibility-only freshness.`;
    }

    return `Manual proof anchors are already current for ${taskId}.`;
  }

  function requireActiveTaskId(activeTaskDetail, errorMessage) {
    if (!activeTaskDetail || !activeTaskDetail.meta || !activeTaskDetail.meta.id) {
      throw new Error(errorMessage);
    }

    return activeTaskDetail.meta.id;
  }

  function resolveExecutionRequest({
    activeTaskDetail,
    agentValue,
    timeoutValue,
    normalizeOptionalPositiveInteger,
  }) {
    const taskId = requireActiveTaskId(activeTaskDetail, "Select a task before starting local execution.");
    const agent = String(agentValue || "codex").trim() || "codex";
    const timeoutMs =
      typeof normalizeOptionalPositiveInteger === "function"
        ? normalizeOptionalPositiveInteger(timeoutValue, "Execution timeout")
        : undefined;

    return {
      taskId,
      agent,
      timeoutMs,
    };
  }

  function normalizeMultilineText(value) {
    return String(value || "").replace(/\r\n/g, "\n").trim();
  }

  return {
    bindDashboardForms,
    buildManualProofAnchorRefreshMessage,
    buildDocumentSavePayload,
    buildRunCreatePayload,
    buildTaskCreatePayload,
    buildTaskUpdatePayload,
    hasUnsavedVerificationEditorChanges,
    requireActiveTaskId,
    resolveExecutionRequest,
  };
});
