import { useState, useEffect } from 'preact/hooks';
import styles from './CommandPalette.module.css';

export default function CommandPalette({ isOpen, onClose, onCommand }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const commands = [
    { id: 'create', label: 'Create Task', icon: '+', shortcut: 'C' },
    { id: 'refresh', label: 'Refresh', icon: '↻', shortcut: 'R' },
    { id: 'view-all', label: 'View All Tasks', icon: '📋' },
    { id: 'view-review', label: 'View Awaiting Review', icon: '👁️' },
    { id: 'view-active', label: 'View In Progress', icon: '⚡' },
    { id: 'view-done', label: 'View Done', icon: '✓' },
  ];

  const filteredCommands = query
    ? commands.filter(cmd =>
        cmd.label.toLowerCase().includes(query.toLowerCase())
      )
    : commands;

  useEffect(() => {
    if (!isOpen) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(i => Math.min(i + 1, filteredCommands.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (filteredCommands[selectedIndex]) {
          handleCommand(filteredCommands[selectedIndex].id);
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedIndex, filteredCommands]);

  function handleCommand(commandId) {
    onCommand(commandId);
    onClose();
  }

  if (!isOpen) return null;

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.palette} onClick={(e) => e.stopPropagation()}>
        <div className={styles.searchBox}>
          <span className={styles.searchIcon}>🔍</span>
          <input
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onInput={(e) => setQuery(e.target.value)}
            autoFocus
          />
          <kbd className={styles.kbd}>ESC</kbd>
        </div>

        <div className={styles.results}>
          {filteredCommands.length === 0 ? (
            <div className={styles.empty}>No commands found</div>
          ) : (
            filteredCommands.map((cmd, index) => (
              <button
                key={cmd.id}
                className={`${styles.command} ${index === selectedIndex ? styles.selected : ''}`}
                onClick={() => handleCommand(cmd.id)}
                onMouseEnter={() => setSelectedIndex(index)}
              >
                <span className={styles.icon}>{cmd.icon}</span>
                <span className={styles.label}>{cmd.label}</span>
                {cmd.shortcut && (
                  <kbd className={styles.shortcut}>{cmd.shortcut}</kbd>
                )}
              </button>
            ))
          )}
        </div>

        <div className={styles.footer}>
          <div className={styles.hint}>
            <kbd>↑</kbd><kbd>↓</kbd> Navigate
            <kbd>↵</kbd> Select
            <kbd>ESC</kbd> Close
          </div>
        </div>
      </div>
    </div>
  );
}
