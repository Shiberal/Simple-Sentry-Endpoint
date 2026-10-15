import { useState } from 'react';
import TelegramConnect from '@/components/TelegramConnect';
import styles from '@/styles/ProjectSettings.module.css';

export default function TelegramSection({ project, projectId }) {
  const [telegramChatId, setTelegramChatId] = useState(project.telegramChatId || '');
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [savedTelegram, setSavedTelegram] = useState(false);

  const handleSaveTelegram = async (e) => {
    e.preventDefault();
    setSavingTelegram(true);
    setSavedTelegram(false);

    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          telegramChatId: telegramChatId || null
        })
      });

      if (response.ok) {
        setSavedTelegram(true);
        setTimeout(() => setSavedTelegram(false), 3000);
      }
    } catch (error) {
      console.error('Error saving Telegram config:', error);
      alert('Failed to save Telegram configuration');
    } finally {
      setSavingTelegram(false);
    }
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>📱 Telegram Integration</h2>
      <p className={styles.sectionDescription}>
        Receive instant error notifications in your Telegram channel or chat.
      </p>
      <TelegramConnect projectId={projectId} styles={styles} onChange={(chatId) => setTelegramChatId(chatId || '')} />
      <details>
        <summary className={styles.helpText}>Enter a chat ID manually</summary>
      <form onSubmit={handleSaveTelegram} className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.label}>Telegram Chat ID</label>
          <input
            type="text"
            value={telegramChatId}
            onChange={(e) => setTelegramChatId(e.target.value)}
            placeholder="e.g., -1001234567890 or @channel_name"
            className={styles.input}
          />
          <p className={styles.helpText}>
            Enter your Telegram chat ID or channel username. 
            For channels, use the format <code>@channel_name</code> or the numeric ID like <code>-1001234567890</code>.
            <br />
            <strong>Note:</strong> Make sure to add your bot as an administrator to the channel/group.
            <br />
            <a 
              href="https://t.me/userinfobot" 
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              Get your Chat ID with @userinfobot →
            </a>
          </p>
        </div>

        <div className={styles.formActions}>
          <button 
            type="submit" 
            disabled={savingTelegram}
            className={styles.saveButton}
            style={{
              opacity: savingTelegram ? 0.6 : 1
            }}
          >
            {savingTelegram ? 'Saving...' : savedTelegram ? '✓ Saved!' : 'Save Telegram Config'}
          </button>
        </div>
      </form>
      </details>
    </section>
  );
}
