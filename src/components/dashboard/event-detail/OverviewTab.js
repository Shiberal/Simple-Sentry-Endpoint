import Icon from '@/components/Icon';
import { getEventType } from '@/lib/event-display';
import styles from '@/styles/Dashboard.module.css';
import OverviewDetails from './OverviewDetails';
import ExceptionSection from './ExceptionSection';

export default function OverviewTab({ selectedEvent, data, copyToClipboard, ...exceptionProps }) {
  return (
    <>
      <div className={styles.detailSection}>
        <div className={styles.overviewGrid}>
          <div className={styles.overviewItem}>
            <span className={styles.overviewLabel}>Event ID</span>
            <div className={styles.overviewValueWithCopy}>
              <span className={styles.overviewValue}>{selectedEvent.id}</span>
              <button 
                onClick={() => copyToClipboard(selectedEvent.id.toString())}
                className={styles.copyIconButton}
                title="Copy"
              >
                <Icon name="copy" size={14} />
              </button>
            </div>
          </div>

          <div className={styles.overviewItem}>
            <span className={styles.overviewLabel}>Type</span>
            <span 
              className={styles.eventType}
              style={{
                backgroundColor: getEventType(selectedEvent) === 'error' ? 'var(--error-bg)' : 
                               getEventType(selectedEvent) === 'warning' ? 'var(--warning-bg)' : 
                               getEventType(selectedEvent) === 'message' ? 'var(--success-bg)' : 'var(--info-bg)',
                color: getEventType(selectedEvent) === 'error' ? 'var(--error)' : 
                       getEventType(selectedEvent) === 'warning' ? 'var(--warning)' : 
                       getEventType(selectedEvent) === 'message' ? 'var(--success)' : 'var(--info)'
              }}
            >
              {getEventType(selectedEvent) === 'message' ? 'MESSAGE' : getEventType(selectedEvent).toUpperCase()}
            </span>
          </div>

          {selectedEvent.issue && (
            <div className={styles.overviewItem}>
              <span className={styles.overviewLabel}>Status</span>
              <span 
                className={styles.eventType}
                style={{
                  backgroundColor: selectedEvent.issue.status === 'RESOLVED' ? 'var(--success-bg)' : 
                                 selectedEvent.issue.status === 'IGNORED' ? 'var(--bg-tertiary)' : 
                                 selectedEvent.issue.status === 'IN_PROGRESS' ? 'var(--warning-bg)' : 'var(--error-bg)',
                  color: selectedEvent.issue.status === 'RESOLVED' ? 'var(--success)' : 
                        selectedEvent.issue.status === 'IGNORED' ? 'var(--text-secondary)' : 
                        selectedEvent.issue.status === 'IN_PROGRESS' ? 'var(--warning)' : 'var(--error)'
                }}
              >
                {selectedEvent.issue.status === 'IN_PROGRESS' ? 'IN PROGRESS' : selectedEvent.issue.status}
              </span>
            </div>
          )}

          <div className={styles.overviewItem}>
            <span className={styles.overviewLabel}>Project</span>
            <span className={styles.overviewValue}>{selectedEvent.project?.name || 'Unknown Project'}</span>
          </div>

          <div className={styles.overviewItem}>
            <span className={styles.overviewLabel}>Timestamp</span>
            <span className={styles.overviewValue}>
              {new Date(selectedEvent.createdAt).toLocaleString()}
            </span>
          </div>

          {data.level && (
            <div className={styles.overviewItem}>
              <span className={styles.overviewLabel}>Level</span>
              <span className={styles.overviewValue}>{data.level}</span>
            </div>
          )}

          {data.environment && (
            <div className={styles.overviewItem}>
              <span className={styles.overviewLabel}>Environment</span>
              <span className={styles.overviewValue}>{data.environment}</span>
            </div>
          )}

          {data.platform && (
            <div className={styles.overviewItem}>
              <span className={styles.overviewLabel}>Platform</span>
              <span className={styles.overviewValue}>{data.platform}</span>
            </div>
          )}

          {data.release && (
            <div className={styles.overviewItem}>
              <span className={styles.overviewLabel}>Release</span>
              <span className={styles.overviewValue}>{data.release}</span>
            </div>
          )}
        </div>
      </div>

      <OverviewDetails selectedEvent={selectedEvent} data={data} />

      <ExceptionSection data={data} copyToClipboard={copyToClipboard} {...exceptionProps} />

      {data.tags && Object.keys(data.tags).length > 0 && (
        <div className={styles.detailSection}>
          <h4 className={styles.detailSectionTitle}>Tags</h4>
          <div className={styles.tagsContainer}>
            {Object.entries(data.tags).map(([key, value]) => (
              <div key={key} className={styles.tag}>
                <span className={styles.tagKey}>{key}:</span>
                <span className={styles.tagValue}>{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
