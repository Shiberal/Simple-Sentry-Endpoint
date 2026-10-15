import { useState } from 'react';
import styles from '@/styles/Admin.module.css';

export default function SystemTab({ settings, notify }) {
  const [draft, setDraft] = useState(settings);

  const handleSaveSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowSelfRegistration: draft.allowSelfRegistration,
          allowProjectCreation: draft.allowProjectCreation
        })
      });

      const data = await response.json();
      if (data.success) {
        notify('Settings updated successfully', 'success');
        setDraft(data.settings);
      } else {
        notify(data.error || 'Failed to update settings', 'error');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      notify('Error updating settings', 'error');
    }
  };

  return (
    <>
      <div className={styles.sectionHeader}>
        <h2 className={styles.sectionTitle}>System Settings</h2>
      </div>
      <div className={styles.settingsForm}>
        <div className={styles.settingsGroup}>
          <label className={styles.settingsLabel}>
            <input
              type="checkbox"
              className={styles.settingsCheckbox}
              checked={draft.allowSelfRegistration}
              onChange={(e) => setDraft({ ...draft, allowSelfRegistration: e.target.checked })}
            />
            <span>Allow Self Registration</span>
          </label>
          <div className={styles.settingsDescription}>
            When enabled, users can create accounts without admin approval.
          </div>
        </div>
        <div className={styles.settingsGroup}>
          <label className={styles.settingsLabel}>
            <input
              type="checkbox"
              className={styles.settingsCheckbox}
              checked={draft.allowProjectCreation}
              onChange={(e) => setDraft({ ...draft, allowProjectCreation: e.target.checked })}
            />
            <span>Allow Project Creation</span>
          </label>
          <div className={styles.settingsDescription}>
            When enabled, users can create new projects without admin approval.
          </div>
        </div>
        <div className={styles.modalButtons}>
          <button
            onClick={handleSaveSettings}
            className={styles.modalButtonSubmit}
          >
            Save Settings
          </button>
        </div>
      </div>
    </>
  );
}
