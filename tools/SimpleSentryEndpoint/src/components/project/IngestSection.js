import { useState } from 'react';
import styles from '@/styles/ProjectSettings.module.css';

export default function IngestSection({ project, projectId }) {
  const [fingerprintByPageUrl, setFingerprintByPageUrl] = useState(Boolean(project.fingerprintByPageUrl));
  const [ingestFiltersText, setIngestFiltersText] = useState(JSON.stringify(project.ingestFilters || {}, null, 2));
  const [scrubRulesText, setScrubRulesText] = useState(JSON.stringify(project.scrubRules || {}, null, 2));
  const [sampleRate, setSampleRate] = useState(project.sampleRate != null ? String(project.sampleRate) : '');
  const [savingIngest, setSavingIngest] = useState(false);
  const [savedIngest, setSavedIngest] = useState(false);

  const handleSaveIngest = async (e) => {
    e.preventDefault();
    let ingestFiltersParsed;
    let scrubRulesParsed;
    try {
      ingestFiltersParsed = JSON.parse(ingestFiltersText || '{}');
    } catch {
      alert('Ingest filters JSON is invalid');
      return;
    }
    try {
      scrubRulesParsed = JSON.parse(scrubRulesText || '{}');
    } catch {
      alert('Scrub rules JSON is invalid');
      return;
    }
    const sr =
      sampleRate.trim() === '' ? null : Number(sampleRate.trim());
    if (sr != null && Number.isNaN(sr)) {
      alert('Sample rate must be a number between 0 and 1, or empty');
      return;
    }
    setSavingIngest(true);
    setSavedIngest(false);
    try {
      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fingerprintByPageUrl,
          ingestFilters: ingestFiltersParsed,
          scrubRules: scrubRulesParsed,
          sampleRate: sr
        })
      });
      if (response.ok) {
        setSavedIngest(true);
        setTimeout(() => setSavedIngest(false), 3000);
      }
    } catch {
      alert('Failed to save ingest settings');
    } finally {
      setSavingIngest(false);
    }
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>Ingest & grouping</h2>
      <p className={styles.sectionDescription}>
        Source maps upload: POST <code>/api/&lt;projectId&gt;/bundle?release=&amp;name=</code> with{' '}
        <code>Authorization: Bearer</code> DSN key and JSON source map body.
      </p>
      <form onSubmit={handleSaveIngest} className={styles.form}>
        <label className={styles.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input
            type="checkbox"
            checked={fingerprintByPageUrl}
            onChange={(e) => setFingerprintByPageUrl(e.target.checked)}
          />
          Subdivide issues by page URL (extra.page_url / request.url)
        </label>
        <div className={styles.formGroup}>
          <label className={styles.label}>Sample rate (0–1, empty = SDK only)</label>
          <input
            className={styles.input}
            value={sampleRate}
            onChange={(e) => setSampleRate(e.target.value)}
            placeholder="e.g. 0.25"
          />
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Inbound filters JSON</label>
          <textarea
            className={styles.input}
            rows={6}
            value={ingestFiltersText}
            onChange={(e) => setIngestFiltersText(e.target.value)}
            spellCheck={false}
          />
          <p className={styles.helpText}>
            Example: blockedUrlSubstrings, blockedTransactions.
          </p>
        </div>
        <div className={styles.formGroup}>
          <label className={styles.label}>Scrub rules JSON</label>
          <textarea
            className={styles.input}
            rows={4}
            value={scrubRulesText}
            onChange={(e) => setScrubRulesText(e.target.value)}
            spellCheck={false}
          />
          <p className={styles.helpText}>
            denyKeys: array of substrings matched against JSON keys before storage.
          </p>
        </div>
        <div className={styles.formActions}>
          <button
            type="submit"
            className={styles.saveButton}
            disabled={savingIngest}
            style={{ opacity: savingIngest ? 0.6 : 1 }}
          >
            {savingIngest ? 'Saving...' : savedIngest ? '✓ Saved!' : 'Save ingest settings'}
          </button>
        </div>
      </form>
    </section>
  );
}
