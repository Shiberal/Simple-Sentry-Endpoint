import { useState } from 'react';
import styles from '@/styles/ProjectSettings.module.css';

export default function ClearDataSection({ project, projectId, onCleared }) {
  const [showClearDataConfirm, setShowClearDataConfirm] = useState(false);
  const [clearingData, setClearingData] = useState(false);

  const handleClearData = async () => {
    setClearingData(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/clear-data`, {
        method: 'POST'
      });

      if (response.ok) {
        const data = await response.json();
        alert(`Successfully cleared ${data.deleted.issues} issues and ${data.deleted.events} events.`);
        setShowClearDataConfirm(false);
        // Refresh project data
        await onCleared();
      } else {
        const error = await response.json();
        alert(`Failed to clear data: ${error.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error clearing data:', error);
      alert('Error clearing data');
    } finally {
      setClearingData(false);
    }
  };

  return (
    <section className={styles.section} style={{borderColor: '#f59e0b'}}>
      <h2 className={styles.sectionTitle} style={{color: '#f59e0b'}}>Clear Data</h2>
      <p className={styles.sectionDescription}>
        Clear all issues and events for this project. This action cannot be undone.
        {project._count?.issues !== undefined && project._count?.events !== undefined && (
          <span> This will delete {project._count.issues} issues and {project._count.events} events.</span>
        )}
      </p>
      {showClearDataConfirm ? (
        <div className={styles.deleteConfirm}>
          <p className={styles.deleteWarning}>
            Are you sure? This will permanently delete all issues and events for &quot;{project.name}&quot;.
            {project._count?.issues !== undefined && project._count?.events !== undefined && (
              <span> This includes {project._count.issues} issues and {project._count.events} events.</span>
            )}
          </p>
          <div className={styles.deleteButtons}>
            <button 
              onClick={() => setShowClearDataConfirm(false)}
              className={styles.cancelButton}
              disabled={clearingData}
            >
              Cancel
            </button>
            <button 
              onClick={handleClearData}
              className={styles.deleteButton}
              disabled={clearingData}
              style={{
                opacity: clearingData ? 0.6 : 1
              }}
            >
              {clearingData ? 'Clearing...' : 'Yes, Clear All Data'}
            </button>
          </div>
        </div>
      ) : (
        <button 
          onClick={() => setShowClearDataConfirm(true)}
          className={styles.dangerButton}
          style={{
            backgroundColor: '#f59e0b',
            borderColor: '#f59e0b'
          }}
        >
          Clear All Issues and Events
        </button>
      )}
    </section>
  );
}
