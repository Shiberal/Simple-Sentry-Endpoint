import styles from '@/styles/Dashboard.module.css';
import sk from '@/styles/Skeleton.module.css';

function IssueSkeletonRow({ variant }) {
  const wTitle = variant % 3 === 0 ? sk.w85 : variant % 3 === 1 ? sk.w70 : sk.w100;
  return (
    <div className={sk.issueSkeletonRow}>
      <div className={sk.issueSkeletonTop}>
        <div className={sk.issueSkeletonLeading}>
          <span className={`${sk.bone} ${sk.bonePill}`} style={{ width: 36 }} />
          <span className={`${sk.bone} ${sk.bonePill}`} style={{ width: 52 }} />
        </div>
        <span className={`${sk.bone} ${sk.boneLine}`} style={{ width: 48 }} />
      </div>
      <div className={sk.issueSkeletonTitle}>
        <span className={`${sk.bone} ${sk.boneLineMd} ${wTitle}`} />
        <span
          className={`${sk.bone} ${sk.boneLine}`}
          style={{ width: '58%', marginTop: 8 }}
        />
      </div>
      <div className={sk.issueSkeletonBadges}>
        <span className={`${sk.bone} ${sk.bonePill}`} style={{ width: 56 }} />
        <span className={`${sk.bone} ${sk.bonePill}`} style={{ width: 44 }} />
      </div>
      <div className={sk.issueSkeletonMeta}>
        <span className={`${sk.bone} ${sk.boneLine}`} style={{ width: '32%' }} />
        <span className={`${sk.bone} ${sk.boneLine}`} style={{ width: 72 }} />
      </div>
    </div>
  );
}

/**
 * Skeleton placeholder for the dashboard issues list (matches card layout).
 */
export default function IssueListSkeleton({ rows = 8 }) {
  return (
    <div
      className={styles.eventsContainer}
      role="status"
      aria-busy="true"
      aria-label="Loading issues"
    >
      <span className={sk.visuallyHidden}>Loading issues</span>
      {Array.from({ length: rows }, (_, i) => (
        <IssueSkeletonRow key={i} variant={i} />
      ))}
    </div>
  );
}
