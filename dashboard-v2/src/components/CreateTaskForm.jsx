import { useState } from 'preact/hooks';
import { useCreateTask } from '../hooks/api';
import styles from './CreateTaskForm.module.css';

export default function CreateTaskForm({ onSuccess, onCancel }) {
  const [step, setStep] = useState(1); // 1: describe, 2: review
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('P1');
  const [generating, setGenerating] = useState(false);
  const [generatedTask, setGeneratedTask] = useState(null);
  const { create, creating, error } = useCreateTask();

  async function handleGenerate(e) {
    e.preventDefault();
    if (!title.trim()) return;

    setGenerating(true);
    try {
      // Call AI to generate task.md
      const response = await fetch('/api/tasks/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          priority,
        }),
      });

      if (!response.ok) throw new Error('Failed to generate task');

      const result = await response.json();
      setGeneratedTask(result);
      setStep(2);
    } catch (err) {
      alert('Failed to generate task: ' + err.message);
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreate() {
    try {
      const result = await create(title.trim(), priority);
      onSuccess(result);
    } catch (err) {
      // Error is handled by hook
    }
  }

  if (step === 1) {
    return (
      <form className={styles.form} onSubmit={handleGenerate}>
        <h2>Create Task</h2>
        <p className={styles.subtitle}>
          Describe what you want to accomplish. AI will generate a complete task definition.
        </p>

        <div className={styles.field}>
          <label>Title *</label>
          <input
            type="text"
            value={title}
            onInput={(e) => setTitle(e.target.value)}
            placeholder="e.g., Add user authentication"
            disabled={generating}
            autoFocus
            required
          />
        </div>

        <div className={styles.field}>
          <label>Description</label>
          <textarea
            value={description}
            onInput={(e) => setDescription(e.target.value)}
            placeholder="Describe the task in natural language. What should be done? Why? Any constraints?"
            rows="6"
            disabled={generating}
          />
          <div className={styles.hint}>
            Be specific. The more context you provide, the better the AI can generate the task.
          </div>
        </div>

        <div className={styles.field}>
          <label>Priority</label>
          <select
            value={priority}
            onChange={(e) => setPriority(e.target.value)}
            disabled={generating}
          >
            <option value="P0">P0 - Critical</option>
            <option value="P1">P1 - High</option>
            <option value="P2">P2 - Medium</option>
            <option value="P3">P3 - Low</option>
          </select>
        </div>

        <div className={styles.actions}>
          <button type="button" onClick={onCancel} disabled={generating}>
            Cancel
          </button>
          <button type="submit" disabled={generating || !title.trim()}>
            {generating ? 'Generating...' : 'Generate Task →'}
          </button>
        </div>
      </form>
    );
  }

  // Step 2: Review generated task
  return (
    <div className={styles.form}>
      <h2>Review Generated Task</h2>
      <p className={styles.subtitle}>
        Review the AI-generated task definition. You can edit it before creating.
      </p>

      {error && <div className={styles.error}>{error}</div>}

      <div className={styles.preview}>
        <div className={styles.previewHeader}>
          <strong>{title}</strong>
          <span className={styles.badge}>{priority}</span>
        </div>

        {generatedTask && (
          <div className={styles.previewContent}>
            <div className={styles.section}>
              <h4>Goal</h4>
              <p>{generatedTask.goal || 'No goal generated'}</p>
            </div>

            <div className={styles.section}>
              <h4>Scope</h4>
              <ul>
                {generatedTask.scope?.map((item, i) => (
                  <li key={i}>{item}</li>
                )) || <li>No scope defined</li>}
              </ul>
            </div>

            <div className={styles.section}>
              <h4>Deliverables</h4>
              <ul>
                {generatedTask.deliverables?.map((item, i) => (
                  <li key={i}>{item}</li>
                )) || <li>No deliverables defined</li>}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className={styles.actions}>
        <button type="button" onClick={() => setStep(1)} disabled={creating}>
          ← Back
        </button>
        <button onClick={handleCreate} disabled={creating}>
          {creating ? 'Creating...' : 'Create Task'}
        </button>
      </div>
    </div>
  );
}
