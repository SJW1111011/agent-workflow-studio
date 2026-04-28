import { useState } from 'preact/hooks';
import styles from './TaskCreatedModal.module.css';

export default function TaskCreatedModal({ task, onClose, onStartAgent }) {
  const [copied, setCopied] = useState(false);

  function copyCommand() {
    const command = `npx agent-workflow run ${task.taskId}`;
    navigator.clipboard.writeText(command);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className={styles.modal}>
      <div className={styles.header}>
        <div className={styles.icon}>✓</div>
        <h2>Task Created</h2>
      </div>

      <div className={styles.content}>
        <div className={styles.taskInfo}>
          <span className={styles.taskId}>{task.taskId}</span>
          <h3>{task.title}</h3>
        </div>

        <div className={styles.nextSteps}>
          <h4>Next: Start the Agent</h4>
          <p>Run this command in your terminal to start agent execution:</p>

          <div className={styles.commandBox}>
            <code>npx agent-workflow run {task.taskId}</code>
            <button
              className={styles.copyButton}
              onClick={copyCommand}
              title="Copy command"
            >
              {copied ? '✓' : '📋'}
            </button>
          </div>

          <div className={styles.hint}>
            💡 The agent will read the task, execute it, and record results for your review.
          </div>
        </div>
      </div>

      <div className={styles.actions}>
        <button className={styles.primaryButton} onClick={onClose}>
          Got it
        </button>
      </div>
    </div>
  );
}
