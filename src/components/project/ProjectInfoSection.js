import styles from '@/styles/ProjectSettings.module.css';

export default function ProjectInfoSection({ project }) {
  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Project Information</h2>
      <div className={styles.infoGrid}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Project ID:</span>
          <span className={styles.infoValue}>{project.id}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Total Events:</span>
          <span className={styles.infoValue}>{project._count.events}</span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Created:</span>
          <span className={styles.infoValue}>
            {new Date(project.createdAt).toLocaleDateString()}
          </span>
        </div>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Team Members:</span>
          <span className={styles.infoValue}>
            {project.users.map(u => u.email).join(', ')}
          </span>
        </div>
      </div>
    </section>
  );
}
