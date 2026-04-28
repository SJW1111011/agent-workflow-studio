import { useState } from 'preact/hooks';
import styles from './TaskCreatedModal.module.css';

export default function TaskCreatedModal({ task, onClose, onStartAgent }) {
  const [copied, setCopied] = useState(false);
  const [starting, setStarting] = useState(false);

  const cliCommand = `npx agent-workflow run ${task.taskId}`;

  async function handleCopyCommand() {
    try {
      await navigator.clipboard.writeText(cliCommand);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      alert('Failed to copy: ' + err.message);
    }
  }

  async function handleStartAgent() {
    setStarting(true);
    try {
      await onStartAgent(task.taskId);
      onClose();
    } catch (err) {
      alert('Failed to start agent: ' + err.message);
      setStarting(false);
    }
  }

  return (
    <div className={styles.modal}>
      <div className={styles.header}>
        <h2>✓ Task Created Successfully</h2>
        <button className={styles.closeButton} onClick={onClose}>×</button>
      </div>

      <div className={styles.taskCard}>
        <div className={styles.taskHeader}>
          <span className={styles.taskId}>{task.taskId}</span>
          <span className={styles.priority}>{task.priority || 'P1'}</span>
        </div>
        <h3 className={styles.taskTitle}>{task.title}</h3>
        {task.promptPath && (
          <div className={styles.promptInfo}>
            <strong>Prompt generated:</strong>
            <code>{task.promptPath}</code>
          </div>
        )}
      </div>

      <div className={styles.nextSteps}>
        <h3>What's next?</h3>
        <p className={styles.subtitle}>Choose how to start working on this task</p>

        <div className={styles.options}>
          <button
            className={styles.optionPrimary}
            onClick={handleStartAgent}
            disabled={starting}
          >
            <span className={styles.optionIcon}>🚀</span>
            <div className={styles.optionContent}>
              <strong>{starting ? 'Starting Agent...' : 'Start Agent Now'}</strong>
              <span>Agent will execute this task in the background</span>
            </div>
          </button>

          <button className={styles.optionSecondary} onClick={handleCopyCommand}>
            <span className={styles.optionIcon}>📋</span>
            <div className={styles.optionContent}>
              <strong>{copied ? 'Copied!' : 'Copy CLI Command'}</strong>
              <code className={styles.command}>{cliCommand}</code>
            </div>
          </button>

          <button className={styles.optionTertiary} onClick={onClose}>
            <span className={styles.optionIcon}>⏰</span>
            <div className={styles.optionContent}>
              <strong>Handle Later</strong>
              <span>Task will be in your queue</span>
            </div>
          </button>
        </div>
      </div>

      <div className={styles.tip}>
        <strong>💡 Tip:</strong> You can also start tasks from the CLI or let the orchestrator handle them automatically.
      </div>
    </div>
  );
}
