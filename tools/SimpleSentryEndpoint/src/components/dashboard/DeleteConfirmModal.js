import { getEventTitle } from '@/lib/event-display';
import styles from '@/styles/Dashboard.module.css';

export default function DeleteConfirmModal({ deletingIssue, deletingEvent, onCancel, onConfirmIssue, onConfirmEvent, onConfirmBulk }) {
  return (
    <div className={styles.modalOverlay} onClick={onCancel}>
      <div className={styles.modal} role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>
          {deletingIssue 
            ? (deletingIssue.bulk ? 'Delete Multiple Issues' : 'Delete Issue')
            : (deletingEvent?.bulk ? 'Delete Multiple Events' : 'Delete Event')
          }
        </h3>
        <p className={styles.modalText}>
          {deletingIssue 
            ? (deletingIssue.bulk 
                ? `Are you sure you want to delete ${deletingIssue.count} issue${deletingIssue.count > 1 ? 's' : ''}? This will also delete all associated events. This action cannot be undone.`
                : `Are you sure you want to delete this issue? This will also delete ${deletingIssue.count || 1} associated event${(deletingIssue.count || 1) > 1 ? 's' : ''}. This action cannot be undone.`
            )
            : (deletingEvent?.bulk 
                ? `Are you sure you want to delete ${deletingEvent.count} event${deletingEvent.count > 1 ? 's' : ''}? This action cannot be undone.`
                : 'Are you sure you want to delete this event? This action cannot be undone.'
            )
          }
        </p>
        {deletingIssue && !deletingIssue.bulk && (
          <div className={styles.modalEventPreview}>
            <strong>{deletingIssue.title}</strong>
            <br />
            <span className={styles.modalEventMeta}>
              {deletingIssue.project?.name || 'Unknown Project'} • {deletingIssue.count || 1} occurrence{(deletingIssue.count || 1) > 1 ? 's' : ''}
            </span>
          </div>
        )}
        {!deletingIssue && deletingEvent && !deletingEvent.bulk && (
          <div className={styles.modalEventPreview}>
            <strong>{getEventTitle(deletingEvent)}</strong>
            <br />
            <span className={styles.modalEventMeta}>
              {deletingEvent.project?.name || 'Unknown Project'} • {new Date(deletingEvent.createdAt).toLocaleString()}
            </span>
          </div>
        )}
        {deletingIssue?.bulk && (
          <div className={styles.modalEventPreview}>
            <strong>You are about to delete {deletingIssue.count} issue{deletingIssue.count > 1 ? 's' : ''}</strong>
          </div>
        )}
        {!deletingIssue && deletingEvent?.bulk && (
          <div className={styles.modalEventPreview}>
            <strong>You are about to delete {deletingEvent.count} event{deletingEvent.count > 1 ? 's' : ''}</strong>
          </div>
        )}
        <div className={styles.modalButtons}>
          <button 
            type="button" 
            onClick={onCancel}
            className={styles.modalButtonCancel}
          >
            Cancel
          </button>
          <button 
            type="button" 
            onClick={deletingIssue 
              ? (deletingIssue.bulk ? onConfirmBulk : onConfirmIssue)
              : (deletingEvent?.bulk ? onConfirmBulk : onConfirmEvent)
            }
            className={styles.modalButtonDelete}
          >
            Delete {deletingIssue 
              ? (deletingIssue.bulk ? `${deletingIssue.count} Issue${deletingIssue.count > 1 ? 's' : ''}` : 'Issue')
              : (deletingEvent?.bulk ? `${deletingEvent.count} Event${deletingEvent.count > 1 ? 's' : ''}` : 'Event')
            }
          </button>
        </div>
      </div>
    </div>
  );
}
