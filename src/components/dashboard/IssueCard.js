import Icon from '@/components/Icon';
import { getEventTypeBadge } from '@/lib/event-display';
import { levelColors, relativeTime, statusLabel } from '@/lib/ui';
import styles from '@/styles/Dashboard.module.css';

export default function IssueCard({ issue, isSelected, isActive, isNew, isSelectionMode, eventIndex, onToggleSelect, onOpen, onPrevEvent, onNextEvent, onResolve, onIgnore }) {
  const type = issue.level;
  return (
    <div
      onClick={() => (isSelectionMode ? onToggleSelect() : onOpen())}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          if (isSelectionMode) onToggleSelect(); else onOpen();
        }
      }}
      role="button"
      tabIndex={0}
      data-item-id={issue.id}
      aria-current={isActive ? 'true' : undefined}
      className={`${styles.eventCard} ${isSelected ? styles.eventCardSelected : ''} ${isActive ? styles.eventCardActive : ''}`}
    >
      {isSelectionMode && (
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onToggleSelect()}
          className={styles.eventCheckbox}
          onClick={(e) => e.stopPropagation()}
        />
      )}
      <div className={styles.eventHeader}>
        <span className={styles.eventLevel} style={{ color: levelColors(type).fg }}>
          <span className={styles.levelMark} style={{ backgroundColor: levelColors(type).fg }} />
          {String(type).toUpperCase()}
        </span>
        <span className={styles.eventProject}>{issue.project?.name || 'Unknown project'}</span>
        {isNew && <span className={styles.newBadge}>New</span>}
        {issue.regressedAt && issue.status === 'UNRESOLVED' && (
          <span
            className={styles.regressedBadge}
            title={`Reopened ${new Date(issue.regressedAt).toLocaleString()} after it was resolved`}
          >
            Regressed
          </span>
        )}
        {(() => {
          const typeBadge = getEventTypeBadge(issue);
          return typeBadge ? (
            <span className={styles.eventTypeBadge} title={`${typeBadge.label} event`}>
              {typeBadge.label}
            </span>
          ) : null;
        })()}
        <span
          className={styles.eventTime}
          title={`Last seen ${new Date(issue.lastSeen).toLocaleString()}`}
        >
          {relativeTime(issue.lastSeen)}
        </span>
      </div>
      <h4 className={styles.eventTitle}>{issue.title}</h4>
      <div className={styles.eventMeta}>
        <span className={`${styles.statusText} ${styles[`status${issue._isStandaloneEvent ? 'Active' : (issue.status || '').charAt(0) + (issue.status || '').slice(1).toLowerCase().replace(/_(.)/g, (m, c) => c.toUpperCase())}`] || ''}`}>
          <span className={styles.statusDot} />
          {issue._isStandaloneEvent ? String(issue.eventType || 'event').toLowerCase() : statusLabel(issue.status)}
        </span>
        {issue.count > 1 && (
          <span className={styles.occurrenceBadge} title={`${issue.count} events in this issue`}>
            <button
              onClick={(e) => onPrevEvent(e)}
              className={styles.navButton}
              title="Previous duplicate event"
              aria-label="Previous event"
            >
              <Icon name="chevronLeft" size={12} strokeWidth={2.25} />
            </button>
            <span className={styles.eventCounter}>
              {(eventIndex) + 1}/{issue.count}
            </span>
            <button
              onClick={(e) => onNextEvent(e)}
              className={styles.navButton}
              title="Next duplicate event"
              aria-label="Next event"
            >
              <Icon name="chevronRight" size={12} strokeWidth={2.25} />
            </button>
          </span>
        )}
        {issue.githubIssueUrl && (
          <span className={styles.githubBadge} title="GitHub issue exists">
            <Icon name="github" size={13} />
          </span>
        )}
        {!issue._isStandaloneEvent && issue.status !== 'RESOLVED' && issue.status !== 'IGNORED' && (
          <span className={styles.quickActions}>
            <button
              className={styles.quickResolveButton}
              onClick={(e) => {
                e.stopPropagation();
                onResolve();
              }}
              title="Resolve this issue (r)"
            >
              <Icon name="check" size={12} strokeWidth={2.25} /> Resolve
            </button>
            <button
              className={styles.quickIgnoreButton}
              onClick={(e) => {
                e.stopPropagation();
                onIgnore();
              }}
              title="Ignore this issue: hides it and stops GitHub auto-reports (i)"
            >
              <Icon name="eyeOff" size={12} /> Ignore
            </button>
          </span>
        )}
        {!issue._isStandaloneEvent && (issue.status === 'RESOLVED' || issue.status === 'IGNORED') && (
          <span className={styles.quickActions}>
            <button
              className={styles.quickResolveButton}
              onClick={(e) => {
                e.stopPropagation();
                if (issue.status === 'RESOLVED') onResolve(); else onIgnore();
              }}
            >
              {issue.status === 'RESOLVED' ? 'Reopen' : 'Unignore'}
            </button>
          </span>
        )}
      </div>
    </div>
  );
}
