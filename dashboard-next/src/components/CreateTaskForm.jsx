import { useState } from "preact/hooks";
import { useDashboardContext } from "../context/DashboardContext.jsx";

export default function CreateTaskForm({ onClose, onSuccess }) {
  const { api, setActionStatus } = useDashboardContext();
  const [title, setTitle] = useState("");
  const [priority, setPriority] = useState("P1");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [createdTask, setCreatedTask] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const result = await api.postJson("/api/quick", {
        title: title.trim(),
        priority,
      });

      setActionStatus(`Created task ${result.taskId}`, "success");
      setCreatedTask(result);
    } catch (err) {
      setError(err.message || "Failed to create task");
      setActionStatus(err.message || "Failed to create task", "error");
      setIsSubmitting(false);
    }
  }

  function copyCommand() {
    if (!createdTask) return;
    const command = `npx agent-workflow run ${createdTask.taskId}`;
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDone() {
    if (onSuccess && createdTask) {
      onSuccess(createdTask);
    }
    if (onClose) {
      onClose();
    }
  }

  if (createdTask) {
    return (
      <div className="create-task-form">
        <div className="form-header">
          <h2>✓ Task Created</h2>
          {onClose && (
            <button
              type="button"
              className="close-button"
              onClick={handleDone}
              aria-label="Close"
            >
              ×
            </button>
          )}
        </div>

        <div className="task-created-success">
          <div className="task-created-info">
            <span className="task-id-badge">{createdTask.taskId}</span>
            <p className="task-title">{title}</p>
          </div>

          <div className="next-steps">
            <h3>Next: Start the Agent</h3>
            <p>Run this command in your terminal to start agent execution:</p>

            <div className="command-box">
              <code>{`npx agent-workflow run ${createdTask.taskId}`}</code>
              <button
                type="button"
                className="copy-button"
                onClick={copyCommand}
                title="Copy command"
              >
                {copied ? "✓" : "📋"}
              </button>
            </div>

            <p className="hint">
              💡 The agent will read the task, execute it, and record results for your review.
            </p>
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="button button-primary"
            onClick={handleDone}
          >
            Got it
          </button>
        </div>
      </div>
    );
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
          {isSubmitting ? "Creating..." : "Create Task"}
        </button>
      </div>
    </form>
  );
}
