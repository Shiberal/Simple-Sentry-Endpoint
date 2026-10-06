
import styles from '@/styles/Dashboard.module.css';

export default function NewProjectModal({ name, setName, onSubmit, onClose }) {
  return (
    <div className={styles.modalOverlay} onClick={() => onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Create New Project</h3>
        <form onSubmit={onSubmit}>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Project name"
            className={styles.modalInput}
            required
            autoFocus
          />
          <div className={styles.modalButtons}>
            <button type="button" onClick={() => onClose()} className={styles.modalButtonCancel}>
              Cancel
            </button>
            <button type="submit" className={styles.modalButtonSubmit}>
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
