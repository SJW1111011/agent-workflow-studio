export default function DocumentEditor({
  content,
  detail,
  documentName,
  onContentChange,
  onDocumentNameChange,
  onDraftProofLinks,
  onRefreshProofAnchors,
  onSubmit,
  view,
}) {
  return (
    <form className="form-card form-card-wide" id="document-editor-form" onSubmit={onSubmit}>
      <div className="editor-head">
        <div>
          <h3>Edit Task Docs</h3>
          <p className="subtle">Local-only markdown editing for `task.md`, `context.md`, and `verification.md`.</p>
        </div>
        <button disabled={view.disableInputs} type="submit">
          Save Document
        </button>
      </div>

      <div className="editor-meta">
        <label>
          <span>Task ID</span>
          <input id="document-task-id" name="taskId" readOnly type="text" value={detail?.meta?.id || ""} />
        </label>
        <label>
          <span>Document</span>
          <select
            id="document-name"
            name="documentName"
            onChange={(event) => onDocumentNameChange(event.currentTarget.value)}
            value={documentName}
          >
            <option value="task.md">task.md</option>
            <option value="context.md">context.md</option>
            <option value="verification.md">verification.md</option>
          </select>
        </label>
      </div>

      <div className="editor-guidance">
        <article className="editor-guidance-card">
          <h4>Managed On Save</h4>
          {view.hasDetail && Array.isArray(view.managedSections) && view.managedSections.length > 0 ? (
            <ul className="editor-guidance-list" id="document-managed-list">
              {view.managedSections.map((item) => (
                <li key={`managed:${item}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="subtle" id="document-managed-list">
              No managed sections listed for this document.
            </p>
          )}
        </article>
        <article className="editor-guidance-card">
          <h4>Free To Edit</h4>
          {view.hasDetail && Array.isArray(view.freeSections) && view.freeSections.length > 0 ? (
            <ul className="editor-guidance-list" id="document-free-list">
              {view.freeSections.map((item) => (
                <li key={`free:${item}`}>{item}</li>
              ))}
            </ul>
          ) : (
            <p className="subtle" id="document-free-list">
              Select a task to view editable sections.
            </p>
          )}
        </article>
      </div>

      <div className="form-inline-actions">
        <button
          className="secondary-button"
          disabled={view.draftProofButtonDisabled}
          id="document-draft-proof-links"
          onClick={onDraftProofLinks}
          type="button"
        >
          {view.draftProofButtonText}
        </button>
        <button
          className="secondary-button"
          disabled={view.refreshProofAnchorsButtonDisabled}
          id="document-refresh-proof-anchors"
          onClick={onRefreshProofAnchors}
          type="button"
        >
          {view.refreshProofAnchorsButtonText}
        </button>
      </div>

      <label>
        <span>Content</span>
        <textarea
          disabled={view.disableInputs}
          id="document-content"
          name="content"
          onInput={(event) => onContentChange(event.currentTarget.value)}
          rows="14"
          value={content}
        />
      </label>

      <p className="subtle" id="document-guardrail-note">
        {view.guardrailNote}
      </p>
      <p className="subtle" id="document-sync-note">
        {view.note}
      </p>
    </form>
  );
}
