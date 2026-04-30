import { useState } from "preact/hooks";
import { useDashboardContext } from "../context/DashboardContext.jsx";

export default function CreateTaskForm({ onClose, onSuccess }) {
  const { api, setActionStatus, updateSelectedExecutionState } = useDashboardContext();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("P1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      // Create task
      const result = await api.postJson("/api/quick", {
        title: title.trim(),
        priority,
      });

      setActionStatus(`Created task ${result.taskId}`, "success");

      // Automatically start execution
      setActionStatus(`Starting agent execution for ${result.taskId}...`, "");
      const executionState = await api.postJson(
        `/api/tasks/${encodeURIComponent(result.taskId)}/execute`,
        { agent: result.adapterId || "codex" }
      );

      updateSelectedExecutionState(result.taskId, executionState);
      setActionStatus(`Agent is now working on ${result.taskId}`, "success");

      // Close modal and switch to task
      if (onSuccess) {
        onSuccess(result);
      }
      if (onClose) {
        onClose();
      }
    } catch (err) {
      setError(err.message || "Failed to create task");
      setActionStatus(err.message || "Failed to create task", "error");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form className="create-task-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <h2>Create New Task</h2>
        {onClose && (
          <button
            type="button"
            className="close-button"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        )}
      </div>

      {error && (
        <div className="form-error" role="alert">
          {error}
        </div>
      )}

      <div className="form-field">
        <label htmlFor="task-title">
          Title <span className="required">*</span>
        </label>
        <input
          id="task-title"
          type="text"
          value={title}
          onInput={(e) => setTitle(e.target.value)}
          placeholder="e.g., Fix login bug"
          disabled={isSubmitting}
          autoFocus
          required
        />
      </div>

      <div className="form-field">
        <label htmlFor="task-priority">Priority</label>
        <select
          id="task-priority"
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          disabled={isSubmitting}
        >
          <option value="P0">P0 - Critical</option>
          <option value="P1">P1 - High</option>
          <option value="P2">P2 - Medium</option>
          <option value="P3">P3 - Low</option>
        </select>
      </div>

      <div className="form-actions">
        {onClose && (
          <button
            type="button"
            className="button button-secondary"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </button>
        )}
        <button
          type="submit"
          className="button button-primary"
          disabled={isSubmitting}
        >
          {isSubmitting ? "Creating & Starting..." : "Create & Start Agent"}
        </button>
      </div>
    </form>
  );
}
