
import styles from '@/styles/Dashboard.module.css';

export default function DuplicatesModal({ preview, selected, setSelected, busy, onApply, onClose }) {
  return (
    <div className={styles.modalOverlay} onClick={() => onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" aria-label="Duplicate issues" style={{ maxWidth: '640px', width: '92%' }} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>
          {preview.groups.length > 0
            ? `${preview.groups.length} group${preview.groups.length === 1 ? '' : 's'} of duplicate issues`
            : 'Update issue grouping'}
        </h3>
        <p className={styles.modalText}>
          {preview.groups.length > 0
            ? 'Issues in a group have the same error signature. Merging keeps the oldest issue, moves every event and comment into it, and makes future events land there.'
            : `${preview.outdated} issue${preview.outdated === 1 ? ' uses' : 's use'} an older grouping key. Applying refreshes it so new events group correctly.`}
        </p>
        <div className={styles.dupList}>
          {preview.groups.map(group => (
            <label key={`${group.projectId}-${group.primaryId}`} className={styles.dupGroup}>
              <input
                type="checkbox"
                checked={selected.includes(group.primaryId)}
                onChange={() => setSelected(prev => prev.includes(group.primaryId) ? prev.filter(id => id !== group.primaryId) : [...prev, group.primaryId])}
              />
              <div className={styles.dupGroupBody}>
                <div className={styles.dupGroupTitle}>{group.issues[0].title}</div>
                <div className={styles.dupGroupMeta}>
                  {group.projectName} · {group.issues.length} issues · {group.issues.reduce((n, i) => n + i.count, 0)} events
                  {' · '}keeps #{group.primaryId}, merges {group.issues.slice(1).map(i => `#${i.id}`).join(', ')}
                </div>
              </div>
            </label>
          ))}
        </div>
        <div className={styles.modalButtons}>
          <button onClick={() => onClose()} className={styles.modalButtonCancel}>Cancel</button>
          <button
            onClick={onApply}
            disabled={busy || (preview.groups.length > 0 && selected.length === 0)}
            className={styles.modalButtonSubmit}
          >
            {busy ? 'Merging…' : preview.groups.length > 0 ? `Merge ${selected.length} group${selected.length === 1 ? '' : 's'}` : 'Apply'}
          </button>
        </div>
      </div>
    </div>
  );
}
