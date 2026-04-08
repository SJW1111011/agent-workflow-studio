(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
    return;
  }

  root.AgentWorkflowDashboardFormStateHelpers = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, () => {
  const RUN_PROOF_NOTE_BASE_TEXT =
    "Checks default to the selected run status when you omit an explicit status. Use `status | label | optional details | artifact1, artifact2` for richer entries. Shortcut buttons can prefill proof paths, draft one check per pending scoped file, or sync the current run draft into verification.md.";

  function buildDocumentEditorView({ detail, activeDocumentName, editableConfig, pendingPaths, documentContent }) {
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
      managedMarkup: renderGuidanceList(hasDetail ? config.managedSections : [], "No managed sections listed for this document."),
      freeMarkup: renderGuidanceList(hasDetail ? config.freeSections : [], "Select a task to view editable sections."),
      guardrailNote: hasDetail
        ? activeDocumentName === "verification.md" && paths.length > 0
          ? "Managed markers are maintained automatically on save. The verification draft shortcut can add planned checks plus file placeholders, but you still need real Check/Result/Artifact content before treating it as evidence. Save first before refreshing proof anchors so the managed anchor state matches the text you just reviewed."
          : activeDocumentName === "verification.md"
            ? "Managed markers are maintained automatically on save. Save first before refreshing proof anchors so the managed anchor state matches the current verification text."
            : "Managed markers are maintained automatically on save; you can focus on the surrounding markdown."
        : "Select a task to view editor guardrails.",
      draftProofButtonDisabled: !canDraftVerificationProof,
      draftProofButtonText: canDraftVerificationProof
        ? `Draft Proof Plan From Pending Files (${paths.length})`
        : "Draft Proof Plan From Pending Files",
      refreshProofAnchorsButtonDisabled: !canRefreshVerificationAnchors,
      refreshProofAnchorsButtonText: "Refresh Proof Anchors",
      disableInputs: !hasDetail,
    };
  }

  function buildTaskFormView(detail, previousRunTaskId) {
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

  function buildRunProofNoteView(pendingPaths) {
    const paths = Array.isArray(pendingPaths) ? pendingPaths : [];

    return {
      noteText: paths.length > 0 ? `${RUN_PROOF_NOTE_BASE_TEXT} Pending scoped files: ${paths.join(", ")}` : RUN_PROOF_NOTE_BASE_TEXT,
      fillPathsButtonDisabled: paths.length === 0,
      fillPathsButtonText: paths.length > 0 ? `Use Pending Scoped Files (${paths.length})` : "Use Pending Scoped Files",
      draftChecksButtonDisabled: paths.length === 0,
      draftChecksButtonText: paths.length > 0 ? `Draft Checks From Pending Files (${paths.length})` : "Draft Checks From Pending Files",
    };
  }

  function getVerificationEditorBaseText({ activeDocumentName, currentEditorText, detail, getEditableDocumentContent }) {
    if (activeDocumentName === "verification.md") {
      return String(currentEditorText || "");
    }

    const verificationText = detail && typeof detail.verificationText === "string" ? detail.verificationText : "";
    return typeof getEditableDocumentContent === "function"
      ? getEditableDocumentContent("verification.md", verificationText)
      : verificationText;
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

  function renderGuidanceList(items, emptyMessage) {
    const values = Array.isArray(items) ? items.filter(Boolean) : [];
    if (values.length === 0) {
      return `<p class="subtle">${escapeHtml(emptyMessage)}</p>`;
    }

    return values.map((item) => `<li>${escapeHtml(item)}</li>`).join("");
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  return {
    buildDocumentEditorView,
    buildRunProofNoteView,
    buildTaskFormView,
    getVerificationEditorBaseText,
    normalizeOptionalPositiveInteger,
    renderGuidanceList,
  };
});
