import { useState } from 'react';
import styles from '@/styles/Admin.module.css';

export default function MaintenanceTab({ notify, onChanged }) {
  const [isMerging, setIsMerging] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);

  const handleMergeDuplicates = async () => {
    if (isMerging) return;

    setIsMerging(true);
    try {
      const response = await fetch('/api/admin/merge-duplicates', {
        method: 'POST'
      });

      const data = await response.json();

      if (data.success) {
        notify(`Merged ${data.duplicatesMerged} duplicate issues`, 'success');
        onChanged();
      } else {
        notify(data.error || 'Failed to merge duplicates', 'error');
      }
    } catch (error) {
      console.error('Error merging duplicates:', error);
      notify('Error merging duplicates', 'error');
    } finally {
      setIsMerging(false);
    }
  };

  const handleCleanup = async () => {
    if (isCleaning) return;

    if (!confirm('Are you sure you want to delete events older than 30 days? This action cannot be undone.')) {
      return;
    }

    setIsCleaning(true);
    try {
      const response = await fetch('/api/admin/maintenance/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 })
      });

      const data = await response.json();

      if (data.success) {
        notify(`Deleted ${data.deletedCount} old events`, 'success');
        onChanged();
      } else {
        notify(data.error || 'Failed to clean up data', 'error');
      }
    } catch (error) {
      console.error('Error cleaning up data:', error);
      notify('Error cleaning up data', 'error');
    } finally {
      setIsCleaning(false);
    }
  };

  return (
    <>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>Maintenance Tools</h2>
      </div>
      <div className={styles.controlPanel}>
        <h3 className={styles.controlPanelTitle}>Data Management</h3>
        <div className={styles.controlPanelActions}>
          <button
            onClick={handleMergeDuplicates}
            className={styles.controlButton}
            disabled={isMerging}
          >
            Merge Duplicate Issues
            <div className={styles.controlButtonDescription}>
              Find and merge issues with identical fingerprints
            </div>
          </button>
          <button
            onClick={handleCleanup}
            className={`${styles.controlButton} ${styles.controlButtonDanger}`}
            disabled={isCleaning}
          >
            {isCleaning ? 'Cleaning up...' : 'Clean Up Old Events (30+ days)'}
            <div className={styles.controlButtonDescription}>
              Permanently delete events older than 30 days to free up space
            </div>
          </button>
        </div>
      </div>
    </>
  );
}
