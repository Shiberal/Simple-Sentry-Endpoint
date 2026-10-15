
import styles from '@/styles/Dashboard.module.css';

export default function ShortcutsModal({ onClose }) {
  return (
    <div className={styles.modalOverlay} onClick={() => onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Keyboard shortcuts" onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Keyboard shortcuts</h3>
        <ul className={styles.shortcutList}>
          <li><kbd className={styles.kbd}>j</kbd> / <kbd className={styles.kbd}>k</kbd><span>Next / previous issue</span></li>
          <li><kbd className={styles.kbd}>r</kbd><span>Resolve / reopen open issue</span></li>
          <li><kbd className={styles.kbd}>i</kbd><span>Ignore / unignore open issue</span></li>
          <li><kbd className={styles.kbd}>/</kbd><span>Focus search</span></li>
          <li><kbd className={styles.kbd}>Shift</kbd>+<kbd className={styles.kbd}>R</kbd><span>Refresh now</span></li>
          <li><kbd className={styles.kbd}>Esc</kbd><span>Close panel, dialog or selection</span></li>
          <li><kbd className={styles.kbd}>?</kbd><span>Show this help</span></li>
        </ul>
        <div className={styles.modalButtons}>
          <button onClick={() => onClose()} className={styles.modalButtonCancel}>Close</button>
        </div>
      </div>
    </div>
  );
}
