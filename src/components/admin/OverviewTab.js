import styles from '@/styles/Admin.module.css';

export default function OverviewTab({ stats }) {
  return (
    <>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>System Overview</h2>
      </div>
      <div className={styles.statsGrid}>
        <div className={styles.statCard}>
          <div className={styles.statCardLabel}>Total Users</div>
          <div className={styles.statCardValue}>{stats.users}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardLabel}>Total Projects</div>
          <div className={styles.statCardValue}>{stats.projects}</div>
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardLabel}>Total Events</div>
          <div className={styles.statCardValue}>{stats.events.toLocaleString()}</div>
          {stats.recentEvents > 0 && (
            <div className={styles.statCardSubtext}>+{stats.recentEvents} in last 24h</div>
          )}
        </div>
        <div className={styles.statCard}>
          <div className={styles.statCardLabel}>Total Issues</div>
          <div className={styles.statCardValue}>{stats.issues.toLocaleString()}</div>
          {stats.recentIssues > 0 && (
            <div className={styles.statCardSubtext}>+{stats.recentIssues} in last 24h</div>
          )}
        </div>
      </div>
    </>
  );
}
