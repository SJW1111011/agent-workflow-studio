const RUN_PROOF_NOTE_BASE_TEXT =
  "Checks default to the selected run status when you omit an explicit status. Use `status | label | optional details | artifact1, artifact2` for richer entries. Shortcut buttons can prefill proof paths, draft one check per pending scoped file, or sync the current run draft into verification.md.";

export function buildDocumentEditorView({ detail, activeDocumentName, editableConfig, pendingPaths, documentContent }) {
  const hasDetail = Boolean(detail && detail.meta);
  const config = editableConfig || {};
  const paths = Array.isArray(pendingPaths) ? pendingPaths : [];
  const canDraftVerificationProof = hasDetail && activeDocumentName === "verification.md" && paths.length > 0;
  const canRefreshVerificationAnchors = hasDetail && activeDocumentName === "verification.md";

  return {
    hasDetail,
    taskId: hasDetail ? detail.meta.id : "",
    documentName: activeDocumentName,
    content: hasDetail ? String(documentContent !== undefined ? documentContent : detail[config.detailField] || "") : "",
    note: hasDetail ? config.note : "Select a task to edit its markdown bundle.",
    guardrailNote: hasDetail
      ? activeDocumentName === "verification.md" && paths.length > 0
        ? "Managed markers are maintained automatically on save. The verification draft shortcut can add draft checks plus file placeholders, but you still need real Check/Result/Artifact content before treating them as verified evidence. Save first before refreshing verification records so the managed state matches the text you just reviewed."
        : activeDocumentName === "verification.md"
          ? "Managed markers are maintained automatically on save. Save first before refreshing verification records so the managed state matches the current verification text."
          : "Managed markers are maintained automatically on save; you can focus on the surrounding markdown."
      : "Select a task to view editor guardrails.",
    draftProofButtonDisabled: !canDraftVerificationProof,
    draftProofButtonText: canDraftVerificationProof
      ? `Draft Proof Plan From Pending Files (${paths.length})`
      : "Draft Proof Plan From Pending Files",
    refreshProofAnchorsButtonDisabled: !canRefreshVerificationAnchors,
    refreshProofAnchorsButtonText: "Refresh Verification Records",
    disableInputs: !hasDetail,
  };
}

export function buildTaskFormView(detail, previousRunTaskId) {
  const hasDetail = Boolean(detail && detail.meta);
  const nextRunTaskId = hasDetail ? detail.meta.id : "";

  return {
    hasDetail,
    selectedTaskId: hasDetail ? detail.meta.id : "",
    selectedTaskTitle: hasDetail ? detail.meta.title || "" : "",
    selectedTaskStatus: hasDetail ? detail.meta.status || "todo" : "todo",
    selectedTaskPriority: hasDetail ? detail.meta.priority || "P2" : "P2",
    selectedTaskRecipeId: hasDetail ? detail.meta.recipeId || "feature" : "feature",
    runTaskId: nextRunTaskId,
    shouldClearRunEvidenceDraft: !hasDetail || previousRunTaskId !== nextRunTaskId,
    disableInputs: !hasDetail,
  };
}

export function buildRunProofNoteView(pendingPaths) {
  const paths = Array.isArray(pendingPaths) ? pendingPaths : [];

  return {
    noteText: paths.length > 0 ? `${RUN_PROOF_NOTE_BASE_TEXT} Pending scoped files: ${paths.join(", ")}` : RUN_PROOF_NOTE_BASE_TEXT,
    fillPathsButtonDisabled: paths.length === 0,
    fillPathsButtonText: paths.length > 0 ? `Use Pending Scoped Files (${paths.length})` : "Use Pending Scoped Files",
    draftChecksButtonDisabled: paths.length === 0,
    draftChecksButtonText: paths.length > 0 ? `Draft Checks From Pending Files (${paths.length})` : "Draft Checks From Pending Files",
  };
}

export function getVerificationEditorBaseText({ activeDocumentName, currentEditorText, detail, getEditableDocumentContent }) {
  if (activeDocumentName === "verification.md") {
    return String(currentEditorText || "");
  }

  const verificationText = detail && typeof detail.verificationText === "string" ? detail.verificationText : "";
  return typeof getEditableDocumentContent === "function"
    ? getEditableDocumentContent("verification.md", verificationText)
    : verificationText;
}

export function normalizeOptionalPositiveInteger(value, fieldName) {
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

export function buildTaskCreatePayload(formData) {
  return {
    taskId: String(formData.get("taskId") || "").trim(),
    title: String(formData.get("title") || "").trim(),
    priority: String(formData.get("priority") || "").trim(),
    recipeId: String(formData.get("recipeId") || "").trim(),
  };
}

export function buildQuickCreatePayload(formData) {
  return {
    taskId: String(formData.get("taskId") || "").trim(),
    title: String(formData.get("title") || "").trim(),
    priority: String(formData.get("priority") || "").trim(),
    recipeId: String(formData.get("recipeId") || "").trim(),
    agent: String(formData.get("agent") || "").trim(),
  };
}

export function buildTaskUpdatePayload(formData) {
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

export function buildRunCreatePayload(formData, parseRunEvidenceDraft) {
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

export function buildDocumentSavePayload(formData) {
  return {
    taskId: String(formData.get("taskId") || "").trim(),
    documentName: String(formData.get("documentName") || "").trim() || "task.md",
    content: String(formData.get("content") || ""),
  };
}

export function hasUnsavedVerificationEditorChanges(activeDocumentName, editorContent, detail, getEditableDocumentContent) {
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

export function buildManualProofAnchorRefreshMessage(taskId, refreshSummary = {}) {
  const verifiedEvidenceCount = Number(refreshSummary.verifiedEvidenceCount || refreshSummary.strongProofCount || 0);
  const refreshedCount = Number(refreshSummary.refreshedCount || 0);
  const skippedCount = Number(refreshSummary.skippedCount || 0);
  const clearedCount = Number(refreshSummary.clearedCount || 0);
  const changed = Boolean(refreshSummary.changed);

  if (clearedCount > 0 && verifiedEvidenceCount === 0) {
    return `Cleared ${clearedCount} stale verification record(s) for ${taskId}; no verified manual evidence remains.`;
  }
  if (refreshedCount > 0 && skippedCount > 0) {
    return `Refreshed ${refreshedCount} verification record(s) for ${taskId}; ${skippedCount} verified item(s) remain recorded-only.`;
  }
  if (refreshedCount > 0 && !changed) {
    return `Verification records are already current for ${taskId}.`;
  }
  if (refreshedCount > 0) {
    return `Refreshed ${refreshedCount} verification record(s) for ${taskId}.`;
  }
  if (skippedCount > 0) {
    return `No verification records were captured for ${taskId}; ${skippedCount} verified item(s) remain recorded-only.`;
  }
  return `Verification records are already current for ${taskId}.`;
}

export function requireActiveTaskId(activeTaskDetail, errorMessage) {
  if (!activeTaskDetail || !activeTaskDetail.meta || !activeTaskDetail.meta.id) {
    throw new Error(errorMessage);
  }

  return activeTaskDetail.meta.id;
}

export function resolveExecutionRequest({
  activeTaskDetail,
  agentValue,
  timeoutValue,
  normalizeOptionalPositiveInteger: normalizeInteger,
}) {
  const taskId = requireActiveTaskId(activeTaskDetail, "Select a task before starting local execution.");
  const agent = String(agentValue || "codex").trim() || "codex";
  const timeoutMs =
    typeof normalizeInteger === "function" ? normalizeInteger(timeoutValue, "Execution timeout") : undefined;

  return {
    taskId,
    agent,
    timeoutMs,
  };
}

function normalizeMultilineText(value) {
  return String(value || "").replace(/\r\n/g, "\n").trim();
}
