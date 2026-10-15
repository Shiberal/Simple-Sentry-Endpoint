import styles from '@/styles/Auth.module.css';
import sk from '@/styles/Skeleton.module.css';

/**
 * Centered card skeleton for auth-style pages (e.g. profile while loading).
 */
export default function AuthCardSkeleton() {
  return (
    <div className={styles.container}>
      <div
        className={styles.card}
        role="status"
        aria-busy="true"
        aria-label="Loading"
      >
        <span className={sk.visuallyHidden}>Loading</span>
        <div
          style={{
            textAlign: 'center',
            marginBottom: 'var(--space-6)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 'var(--space-3)',
          }}
        >
          <span
            className={`${sk.bone}`}
            style={{
              width: 160,
              height: 20,
              borderRadius: 8,
            }}
          />
          <span
            className={`${sk.bone} ${sk.boneLineLg}`}
            style={{ width: '72%', maxWidth: 320, height: 28, borderRadius: 8 }}
          />
          <span
            className={`${sk.bone} ${sk.boneLine}`}
            style={{ width: '55%', maxWidth: 240, height: 14 }}
          />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {[1, 2].map((i) => (
            <div key={i}>
              <span className={`${sk.bone} ${sk.boneLine}`} style={{ width: '30%', marginBottom: 8 }} />
              <span className={`${sk.bone}`} style={{ width: '100%', height: 40, borderRadius: 8 }} />
            </div>
          ))}
          <span className={`${sk.bone}`} style={{ width: '100%', height: 44, borderRadius: 8, marginTop: 8 }} />
        </div>
      </div>
    </div>
  );
}
