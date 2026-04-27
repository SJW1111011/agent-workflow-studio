import { useState } from 'preact/hooks';
import { useCreateTask } from '../hooks/api';
import styles from './CreateTaskForm.module.css';

export default function CreateTaskForm({ onSuccess, onCancel }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('P1');
  const { create, creating, error } = useCreateTask();

  async function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;

    try {
      // TODO: Pass description to backend to generate better task.md
      const result = await create(title.trim(), priority);
      onSuccess(result);
    } catch (err) {
      // Error is handled by hook
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <h2>Create Task</h2>
      <p className={styles.subtitle}>
        Create a new task for agent execution.
      </p>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.field}>
        <label>Title *</label>
        <input
          type="text"
          value={title}
          onInput={(e) => setTitle(e.target.value)}
          placeholder="e.g., Add user authentication"
          disabled={creating}
          autoFocus
          required
        />
      </div>

      <div className={styles.field}>
        <label>Description</label>
        <textarea
          value={description}
          onInput={(e) => setDescription(e.target.value)}
          placeholder="Describe what needs to be done. The agent will use this to understand the task."
          rows="6"
          disabled={creating}
        />
        <div className={styles.hint}>
          Optional: Provide context to help the agent understand the task better.
        </div>
      </div>

      <div className={styles.field}>
        <label>Priority</label>
        <select
          value={priority}
          onChange={(e) => setPriority(e.target.value)}
          disabled={creating}
        >
          <option value="P0">P0 - Critical</option>
          <option value="P1">P1 - High</option>
          <option value="P2">P2 - Medium</option>
          <option value="P3">P3 - Low</option>
        </select>
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={onCancel} disabled={creating}>
          Cancel
        </button>
        <button type="submit" disabled={creating || !title.trim()}>
          {creating ? 'Creating...' : 'Create Task'}
        </button>
      </div>
    </form>
  );
}
