import { useState } from 'react';
import Router from 'next/router';
import styles from '@/styles/ProjectSettings.module.css';

export default function DeleteProjectSection({ project, projectId }) {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        Router.push('/dashboard');
      } else {
        const data = await response.json();
        alert(data.error || data.message || 'Failed to delete project');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      alert('Error deleting project');
    }
  };

  return (
    <section className={styles.section} style={{borderColor: '#dc2626'}}>
      <h2 className={styles.sectionTitle} style={{color: '#dc2626'}}>Danger Zone</h2>
      <p className={styles.sectionDescription}>
        Delete this project and all associated events. This action cannot be undone.
        {project.users && project.users.length > 1 && (
          <span style={{ display: 'block', marginTop: 'var(--space-2)', color: '#dc2626', fontWeight: 500 }}>
            ⚠️ Projects can only be deleted when there is exactly one user remaining. Please remove all other users first.
          </span>
        )}
      </p>
      {showDeleteConfirm ? (
        <div className={styles.deleteConfirm}>
          <p className={styles.deleteWarning}>
            Are you sure? This will permanently delete &quot;{project.name}&quot; and all {project._count.events} events.
          </p>
          <div className={styles.deleteButtons}>
            <button 
              onClick={() => setShowDeleteConfirm(false)}
              className={styles.cancelButton}
            >
              Cancel
            </button>
            <button 
              onClick={handleDelete}
              className={styles.deleteButton}
            >
              Yes, Delete Project
            </button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setShowDeleteConfirm(true)}
          className={styles.dangerButton}
          disabled={project.users && project.users.length > 1}
          style={{
            opacity: (project.users && project.users.length > 1) ? 0.5 : 1,
            cursor: (project.users && project.users.length > 1) ? 'not-allowed' : 'pointer'
          }}
        >
          Delete Project
        </button>
      )}
    </section>
  );
}
