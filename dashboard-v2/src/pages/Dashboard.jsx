import { useState } from 'preact/hooks';
import { useTasks, useTaskDetail } from '../hooks/api';
import Modal from '../components/Modal';
import CreateTaskForm from '../components/CreateTaskForm';
import styles from './Dashboard.module.css';

export default function Dashboard() {
  const { tasks, loading, error, refresh } = useTasks();
  const [selectedTaskId, setSelectedTaskId] = useState(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [view, setView] = useState('all'); // 'all', 'review', 'active', 'done'

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

  // Filter tasks based on view
  const filteredTasks = filterTasksByView(tasks, view);
  const reviewCount = tasks.filter(needsReview).length;
  const activeCount = tasks.filter(t => t.status === 'in_progress').length;
  const doneCount = tasks.filter(t => t.status === 'done').length;

  return (
    <div className={styles.dashboard}>
      <header className={styles.header}>
        <div>
          <h1>Agent Workflow Studio</h1>
          <p className={styles.subtitle}>Human-Agent Collaboration Workbench</p>
        </div>
        <button className={styles.createButton} onClick={() => setShowCreateModal(true)}>
          + Create Task
        </button>
      </header>

      <div className={styles.content}>
        <aside className={styles.sidebar}>
          <nav className={styles.viewNav}>
            <button
              className={view === 'all' ? styles.viewActive : ''}
              onClick={() => setView('all')}
            >
              All Tasks
              <span className={styles.count}>{tasks.length}</span>
            </button>
            <button
              className={view === 'review' ? styles.viewActive : ''}
              onClick={() => setView('review')}
            >
              Awaiting Review
              <span className={`${styles.count} ${reviewCount > 0 ? styles.countHighlight : ''}`}>
                {reviewCount}
              </span>
            </button>
            <button
              className={view === 'active' ? styles.viewActive : ''}
              onClick={() => setView('active')}
            >
              In Progress
              <span className={styles.count}>{activeCount}</span>
            </button>
            <button
              className={view === 'done' ? styles.viewActive : ''}
              onClick={() => setView('done')}
            >
              Done
              <span className={styles.count}>{doneCount}</span>
            </button>
          </nav>

          <div className={styles.taskList}>
            {filteredTasks.length === 0 ? (
              <div className={styles.emptyList}>
                {view === 'review' && 'No tasks awaiting review'}
                {view === 'active' && 'No tasks in progress'}
                {view === 'done' && 'No completed tasks'}
                {view === 'all' && 'No tasks yet'}
              </div>
            ) : (
              filteredTasks.map((task) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  isActive={task.id === selectedTaskId}
                  onClick={() => setSelectedTaskId(task.id)}
                />
              ))
            )}
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
              <div className={styles.emptyIcon}>📋</div>
              <p>Select a task to view details</p>
              {reviewCount > 0 && (
                <button
                  className={styles.emptyAction}
                  onClick={() => setView('review')}
                >
                  {reviewCount} task{reviewCount > 1 ? 's' : ''} awaiting review →
                </button>
              )}
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

function TaskCard({ task, isActive, onClick }) {
  const needsReviewFlag = needsReview(task);
  const statusInfo = getTaskStatusInfo(task);

  return (
    <button
      className={`${styles.taskCard} ${isActive ? styles.active : ''} ${needsReviewFlag ? styles.needsReview : ''}`}
      onClick={onClick}
    >
      <div className={styles.taskHeader}>
        <span className={styles.taskId}>{task.id}</span>
        <span className={`${styles.statusBadge} ${styles[statusInfo.class]}`}>
          {statusInfo.label}
        </span>
      </div>
      <div className={styles.taskTitle}>{task.title}</div>
      <div className={styles.taskMeta}>
        <span>{task.priority || 'P2'}</span>
        {task.latestRunSummary && (
          <span className={styles.runSummary}>• {task.latestRunSummary}</span>
        )}
      </div>
      {needsReviewFlag && (
        <div className={styles.reviewFlag}>
          👁️ Needs Review
        </div>
      )}
    </button>
  );
}

function TaskDetail({ taskId, onClose, onUpdate }) {
  const { task, loading, error } = useTaskDetail(taskId);
  const [showRejectForm, setShowRejectForm] = useState(false);

  if (loading) return <div className={styles.detailLoading}>Loading task...</div>;
  if (error) return <div className={styles.detailError}>Error: {error}</div>;
  if (!task) return null;

  const canReview = needsReview(task.meta);
  const statusInfo = getTaskStatusInfo(task.meta);

  return (
    <div className={styles.detail}>
      <div className={styles.detailHeader}>
        <div>
          <div className={styles.detailTitle}>
            <span className={styles.taskId}>{task.meta.id}</span>
            <h2>{task.meta.title}</h2>
          </div>
          <div className={styles.detailMeta}>
            <span className={`${styles.statusBadge} ${styles[statusInfo.class]}`}>
              {statusInfo.label}
            </span>
            <span>{task.meta.priority || 'P2'}</span>
            <span>{task.meta.recipeId || 'feature'}</span>
          </div>
        </div>
        <button className={styles.closeButton} onClick={onClose}>×</button>
      </div>

      <div className={styles.detailContent}>
        {task.meta.goal && (
          <div className={styles.section}>
            <h3>Goal</h3>
            <p>{task.meta.goal}</p>
          </div>
        )}

        {task.runs && task.runs.length > 0 && (
          <div className={styles.section}>
            <h3>Work History ({task.runs.length} run{task.runs.length > 1 ? 's' : ''})</h3>
            <div className={styles.runs}>
              {task.runs.map((run) => (
                <div key={run.id} className={styles.run}>
                  <div className={styles.runHeader}>
                    <span className={styles.runStatus}>{run.status}</span>
                    <span className={styles.runTime}>
                      {new Date(run.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <div className={styles.runSummary}>{run.summary}</div>
                  {run.proofPaths && run.proofPaths.length > 0 && (
                    <div className={styles.runProofs}>
                      <strong>Evidence:</strong>
                      {run.proofPaths.map((path, i) => (
                        <code key={i}>{path}</code>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {canReview && !showRejectForm && (
          <div className={styles.reviewSection}>
            <h3>Review Required</h3>
            <p>This task has completed work and is awaiting your review.</p>
            <div className={styles.reviewActions}>
              <button
                className={styles.approveButton}
                onClick={() => handleApprove(task.meta.id, onUpdate)}
              >
                ✓ Approve
              </button>
              <button
                className={styles.rejectButton}
                onClick={() => setShowRejectForm(true)}
              >
                ✗ Reject
              </button>
            </div>
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

        {task.meta.reviewStatus === 'approved' && (
          <div className={styles.reviewResult}>
            <div className={styles.approved}>✓ Approved</div>
            {task.meta.reviewedAt && (
              <p>Reviewed on {new Date(task.meta.reviewedAt).toLocaleString()}</p>
            )}
          </div>
        )}

        {task.meta.reviewStatus === 'rejected' && (
          <div className={styles.reviewResult}>
            <div className={styles.rejected}>✗ Rejected</div>
            {task.meta.rejectionFeedback && (
              <div className={styles.feedback}>
                <strong>Feedback:</strong>
                <p>{task.meta.rejectionFeedback}</p>
              </div>
            )}
            {task.meta.correctionTaskId && (
              <p>
                Correction task created: <strong>{task.meta.correctionTaskId}</strong>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

async function handleApprove(taskId, onUpdate) {
  if (!confirm('Approve this task?')) return;

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
      <p>Explain what needs to be improved. A correction task will be created.</p>
      <textarea
        value={feedback}
        onInput={(e) => setFeedback(e.target.value)}
        placeholder="Be specific about what needs to change..."
        rows="6"
        required
        autoFocus
      />
      <div className={styles.formActions}>
        <button type="button" onClick={onCancel} disabled={submitting}>
          Cancel
        </button>
        <button type="submit" disabled={submitting || !feedback.trim()}>
          {submitting ? 'Submitting...' : 'Reject & Create Correction Task'}
        </button>
      </div>
    </form>
  );
}

// Helper functions
function needsReview(task) {
  if (!task) return false;
  // Has runs but no review status
  const hasRuns = task.runs && task.runs > 0;
  const noReview = !task.reviewStatus;
  return hasRuns && noReview;
}

function filterTasksByView(tasks, view) {
  switch (view) {
    case 'review':
      return tasks.filter(needsReview);
    case 'active':
      return tasks.filter(t => t.status === 'in_progress');
    case 'done':
      return tasks.filter(t => t.status === 'done');
    default:
      return tasks;
  }
}

function getTaskStatusInfo(task) {
  if (!task) return { label: 'Unknown', class: 'unknown' };

  if (task.reviewStatus === 'approved') {
    return { label: 'Approved', class: 'approved' };
  }
  if (task.reviewStatus === 'rejected') {
    return { label: 'Rejected', class: 'rejected' };
  }
  if (needsReview(task)) {
    return { label: 'Awaiting Review', class: 'review' };
  }

  switch (task.status) {
    case 'done':
      return { label: 'Done', class: 'done' };
    case 'in_progress':
      return { label: 'In Progress', class: 'progress' };
    case 'todo':
      return { label: 'To Do', class: 'todo' };
    default:
      return { label: task.status || 'Unknown', class: 'unknown' };
  }
}
