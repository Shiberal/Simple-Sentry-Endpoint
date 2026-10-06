import styles from '@/styles/ProjectSettings.module.css';

export default function IgnoredIssuesSection({ ignoredIssues, onChanged }) {
  const handleUnignoreIssue = async (issueId) => {
    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'UNRESOLVED' })
      });

      if (response.ok) {
        // Refresh ignored issues list
        onChanged();
        alert('Issue unignored successfully!');
      } else {
        alert('Failed to unignore issue');
      }
    } catch (error) {
      console.error('Error unignoring issue:', error);
      alert('Error unignoring issue');
    }
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>🔕 Ignored Issues</h2>
      <p className={styles.sectionDescription}>
        Issues that are ignored will not appear in the main dashboard view and will not trigger GitHub auto-reporting.
        You can unignore them at any time to restore normal monitoring.
      </p>
      {ignoredIssues.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>No ignored issues for this project.</p>
        </div>
      ) : (
        <div className={styles.ignoredIssuesList}>
          {ignoredIssues.map(issue => (
            <div key={issue.id} className={styles.ignoredIssueItem}>
              <div className={styles.ignoredIssueInfo}>
                <div className={styles.ignoredIssueHeader}>
                  <span className={styles.ignoredIssueTitle}>{issue.title}</span>
                  <span className={styles.ignoredIssueBadge}>
                    {issue.level.toUpperCase()}
                  </span>
                </div>
                <div className={styles.ignoredIssueMeta}>
                  <span>Occurrences: {issue.count}</span>
                  <span>•</span>
                  <span>Last seen: {new Date(issue.lastSeen).toLocaleDateString()}</span>
                  <span>•</span>
                  <span>First seen: {new Date(issue.firstSeen).toLocaleDateString()}</span>
                </div>
              </div>
              <button
                onClick={() => handleUnignoreIssue(issue.id)}
                className={styles.unignoreButton}
              >
                Unignore
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
