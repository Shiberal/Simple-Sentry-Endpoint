import styles from '@/styles/ProjectSettings.module.css';
import sk from '@/styles/Skeleton.module.css';

/**
 * Skeleton for project settings / integration page while project loads.
 */
export default function ProjectSettingsSkeleton() {
  return (
    <div className={styles.container} role="status" aria-busy="true" aria-label="Loading project">
      <span className={sk.visuallyHidden}>Loading project</span>
      <header className={styles.header}>
        <div className={styles.headerContent}>
          <span className={`${sk.bone} ${sk.boneLine}`} style={{ width: 150, height: 12, marginBottom: 10 }} />
          <span className={`${sk.bone} ${sk.boneLineLg}`} style={{ width: 280, height: 24, borderRadius: 8 }} />
        </div>
      </header>
      <div className={styles.main}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} style={{ marginBottom: 'var(--space-8)' }}>
            <span className={`${sk.bone} ${sk.boneLineMd}`} style={{ width: '36%', marginBottom: 12 }} />
            <span className={`${sk.bone} ${sk.boneLine}`} style={{ width: '92%', marginBottom: 8 }} />
            <span className={`${sk.bone} ${sk.boneLine}`} style={{ width: '75%', marginBottom: 16 }} />
            <span className={`${sk.bone}`} style={{ width: '100%', height: 64, borderRadius: 8 }} />
          </div>
        ))}
      </div>
    </div>
  );
}
