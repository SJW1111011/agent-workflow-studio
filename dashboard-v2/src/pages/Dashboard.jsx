import { useState } from 'preact/hooks';
import { useTasks, useTaskDetail } from '../hooks/api';
import Modal from '../components/Modal';
import CreateTaskForm from '../components/CreateTaskForm';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { tasks, loading, error, refresh } = useTasks();
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);

  function handleTaskCreated(result) {
    setShowCreateModal(false);
    setSelectedTaskId(result.taskId);
    refresh();
  }

  if (loading) {
    return <div className={styles.loading}>Loading...</div>;
  }

  if (error) {
    return <div className={styles.error}>Error: {error}</div>;
  }

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <h1>Agent Workflow Studio</h1>
        <button onClick={() => setShowCreateModal(true)}>
          + Create Task
        </button>
      </header>

      <div className={styles.content}>
        <aside className={styles.sidebar}>
          <h2>Tasks ({tasks.length})</h2>
          <div className={styles.taskList}>
            {tasks.map((task) => (
              <button
                key={task.id}
                className={
                  task.id === selectedTaskId
                    ? `${styles.taskCard} ${styles.active}`
                    : styles.taskCard
                }
                onClick={() => setSelectedTaskId(task.id)}
              >
                <div className={styles.taskTitle}>
                  {task.id} - {task.title}
                </div>
                <div className={styles.taskMeta}>
                  {task.priority} | {task.status}
                </div>
              </button>
            ))}
          </div>
        </aside>

        <main className={styles.main}>
          {selectedTaskId ? (
            <TaskDetail
              taskId={selectedTaskId}
              onClose={() => setSelectedTaskId(null)}
              onUpdate={refresh}
            />
          ) : (
            <div className={styles.empty}>
              Select a task to view details
            </div>
          )}
        </main>
      </div>

      <Modal isOpen={showCreateModal} onClose={() => setShowCreateModal(false)}>
        <CreateTaskForm
          onSuccess={handleTaskCreated}
          onCancel={() => setShowCreateModal(false)}
        />
      </Modal>
    </div>
  );
}

function TaskDetail({ taskId, onClose, onUpdate }) {
  const { task, loading, error } = useTaskDetail(taskId);
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (loading) return <div>Loading task...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!task) return null;

  return (
    <div className={styles.detail}>
      <div className={styles.detailHeader}>
        <h2>{task.meta.id} - {task.meta.title}</h2>
        <button onClick={onClose}>×</button>
      </div>

      <div className={styles.detailContent}>
        <p><strong>Priority:</strong> {task.meta.priority}</p>
        <p><strong>Status:</strong> {task.meta.status}</p>
        <p><strong>Recipe:</strong> {task.meta.recipeId}</p>

        {task.runs && task.runs.length > 0 && (
          <div className={styles.runs}>
            <h3>Runs ({task.runs.length})</h3>
            {task.runs.map((run) => (
              <div key={run.id} className={styles.run}>
                <div>{run.summary}</div>
                <div className={styles.runMeta}>{run.status}</div>
              </div>
            ))}
          </div>
        )}

        {task.runs && task.runs.length > 0 && !task.meta.reviewStatus && (
          <div className={styles.actions}>
            <button onClick={() => handleApprove(task.meta.id, onUpdate)}>
              Approve
            </button>
            <button onClick={() => setShowRejectForm(true)}>
              Reject
            </button>
          </div>
        )}

        {showRejectForm && (
          <RejectForm
            taskId={task.meta.id}
            onSuccess={() => {
              setShowRejectForm(false);
              onUpdate();
            }}
            onCancel={() => setShowRejectForm(false)}
          />
        )}
      </div>
    </div>
  );
}

async function handleApprove(taskId, onUpdate) {
  try {
    await fetch(`/api/tasks/${taskId}/approve`, { method: 'POST' });
    onUpdate();
  } catch (err) {
    alert('Failed to approve: ' + err.message);
  }
}

function RejectForm({ taskId, onSuccess, onCancel }) {
  const [feedback, setFeedback] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!feedback.trim()) return;

    try {
      setSubmitting(true);
      await fetch(`/api/tasks/${taskId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedback.trim() }),
      });
      onSuccess();
    } catch (err) {
      alert('Failed to reject: ' + err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className={styles.rejectForm}>
      <h3>Reject Task</h3>
      <textarea
        value={feedback}
        onInput={(e) => setFeedback(e.target.value)}
        placeholder="Explain what needs to be improved..."
        rows="4"
        required
        autoFocus
      />
      <div className={styles.actions}>
        <button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" disabled={submitting || !feedback.trim()}>
          {submitting ? 'Submitting...' : 'Reject'}
        </button>
      </div>
    </form>
  );
}
