import { statusLabel, relativeTime } from '@/lib/ui';
import styles from '@/styles/Dashboard.module.css';

export default function MergeModal({ draft, setDraft, onConfirm, onClose }) {
  return (
    <div className={styles.modalOverlay} onClick={() => onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Merge issues" style={{ maxWidth: '560px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Merge {draft.issues.length} issues</h3>
        <p className={styles.modalText}>
          Choose the issue to keep. The others are removed and their events, comments and counts move into it. Future events matching any of them land in the kept issue.
        </p>
        <div className={styles.dupList}>
          {draft.issues.map(issue => (
            <label key={issue.id} className={styles.dupGroup}>
              <input
                type="radio"
                name="merge-target"
                checked={draft.targetId === issue.id}
                onChange={() => setDraft({ ...draft, targetId: issue.id })}
              />
              <div className={styles.dupGroupBody}>
                <div className={styles.dupGroupTitle}>{issue.title}</div>
                <div className={styles.dupGroupMeta}>
                  #{issue.id} · {issue.count} events · first seen {relativeTime(issue.firstSeen)} · {statusLabel(issue.status)}
                </div>
              </div>
            </label>
          ))}
        </div>
        <div className={styles.modalButtons}>
          <button onClick={() => onClose()} className={styles.modalButtonCancel}>Cancel</button>
          <button onClick={onConfirm} className={styles.modalButtonSubmit}>Merge into #{draft.targetId}</button>
        </div>
      </div>
    </div>
  );
}
