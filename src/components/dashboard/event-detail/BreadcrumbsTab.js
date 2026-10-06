import styles from '@/styles/Dashboard.module.css';

export default function BreadcrumbsTab({ data }) {
  return (
    <div className={styles.detailSection}>
      <h4 className={styles.detailSectionTitle}>Breadcrumbs</h4>
      <div className={styles.breadcrumbsContainer}>
        {(Array.isArray(data.breadcrumbs) ? data.breadcrumbs : data.breadcrumbs.values).map((crumb, idx) => {
          // Format timestamp if it's a unix timestamp
          const timestamp = crumb.timestamp 
            ? (typeof crumb.timestamp === 'number' && crumb.timestamp > 1000000000000 
                ? new Date(crumb.timestamp).toLocaleString()
                : typeof crumb.timestamp === 'number' && crumb.timestamp > 1000000000
                ? new Date(crumb.timestamp * 1000).toLocaleString()
                : crumb.timestamp)
            : '';

          return (
            <div key={idx} className={styles.breadcrumb}>
              <div className={styles.breadcrumbHeader}>
                <span className={styles.breadcrumbType}>
                  {crumb.type || crumb.category || crumb.level || 'default'}
                </span>
                <span className={styles.breadcrumbTime}>{timestamp}</span>
              </div>
              {crumb.message && (
                <div className={styles.breadcrumbMessage}>{crumb.message}</div>
              )}
              {crumb.data && (
                <pre className={styles.breadcrumbData}>
                  {JSON.stringify(crumb.data, null, 2)}
                </pre>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
