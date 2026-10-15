import { useState } from 'react';
import styles from '@/styles/ProjectSettings.module.css';

export default function GitHubSection({ project, projectId }) {
  const [githubRepo, setGithubRepo] = useState(project.githubRepo || '');
  const [githubToken, setGithubToken] = useState(project.githubToken || '');
  const [autoGithubReport, setAutoGithubReport] = useState(project.autoGithubReport || false);
  const initialFilters = project.autoGithubReportFilters || {};
  const [filterLevels, setFilterLevels] = useState(initialFilters.levels || ['error']);
  const [filterEnvironments, setFilterEnvironments] = useState(initialFilters.environments ? initialFilters.environments.join(', ') : '');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSaveGitHub = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    try {
      // Build filters object
      const filters = {
        levels: filterLevels,
        environments: filterEnvironments ? filterEnvironments.split(',').map(e => e.trim()).filter(Boolean) : []
      };

      const response = await fetch(`/api/projects/${projectId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubRepo,
          githubToken,
          autoGithubReport,
          autoGithubReportFilters: filters
        })
      });

      if (response.ok) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch (error) {
      console.error('Error saving GitHub config:', error);
      alert('Failed to save GitHub configuration');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>🐙 GitHub Integration</h2>
      <p className={styles.sectionDescription}>
        Configure GitHub repository to create issues directly from errors.
      </p>
      <form onSubmit={handleSaveGitHub} className={styles.form}>
        <div className={styles.formGroup}>
          <label className={styles.label}>GitHub Repository</label>
          <input
            type="text"
            value={githubRepo}
            onChange={(e) => setGithubRepo(e.target.value)}
            placeholder="e.g., owner/repo or https://github.com/owner/repo"
            className={styles.input}
          />
          <p className={styles.helpText}>
            Enter your repository in the format &quot;owner/repo&quot; or paste the full GitHub URL
          </p>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.label}>GitHub Token (Optional)</label>
          <input
            type="password"
            value={githubToken}
            onChange={(e) => setGithubToken(e.target.value)}
            placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
            className={styles.input}
          />
          <p className={styles.helpText}>
            Personal access token with &quot;repo&quot; scope. Required for private repositories.
            <br />
            <a 
              href="https://github.com/settings/tokens/new?scopes=repo&description=Sentry%20Clone%20Integration" 
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              Create token →
            </a>
          </p>
        </div>

        <div className={styles.formGroup}>
          <label className={styles.checkboxLabel}>
            <input
              type="checkbox"
              checked={autoGithubReport}
              onChange={(e) => setAutoGithubReport(e.target.checked)}
              className={styles.checkbox}
            />
            <span>Automatically create GitHub issues for new errors</span>
          </label>
          <p className={styles.helpText}>
            When enabled, new issues will automatically create GitHub issues in your configured repository.
          </p>
        </div>

        {autoGithubReport && (
          <div className={styles.filterSection}>
            <h3 className={styles.filterTitle}>Auto-Report Filters</h3>
            <p className={styles.helpText} style={{ marginBottom: 'var(--space-4)' }}>
              Configure which errors should automatically create GitHub issues.
            </p>

            <div className={styles.formGroup}>
              <label className={styles.label}>Error Levels</label>
              <div className={styles.checkboxGroup}>
                {['error', 'warning', 'info', 'fatal'].map(level => (
                  <label key={level} className={styles.checkboxLabel}>
                    <input
                      type="checkbox"
                      checked={filterLevels.includes(level)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setFilterLevels([...filterLevels, level]);
                        } else {
                          setFilterLevels(filterLevels.filter(l => l !== level));
                        }
                      }}
                      className={styles.checkbox}
                    />
                    <span className={styles.levelBadge} data-level={level}>
                      {level}
                    </span>
                  </label>
                ))}
              </div>
              <p className={styles.helpText}>
                Select which error levels should trigger auto-reporting.
              </p>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Environments (Optional)</label>
              <input
                type="text"
                value={filterEnvironments}
                onChange={(e) => setFilterEnvironments(e.target.value)}
                placeholder="e.g., production, staging"
                className={styles.input}
              />
              <p className={styles.helpText}>
                Comma-separated list of environments. Leave empty to report from all environments.
              </p>
            </div>
          </div>
        )}

        <div className={styles.formActions}>
          <button 
            type="submit" 
            disabled={saving}
            className={styles.saveButton}
            style={{
              opacity: saving ? 0.6 : 1
            }}
          >
            {saving ? 'Saving...' : saved ? '✓ Saved!' : 'Save GitHub Config'}
          </button>
        </div>
      </form>
    </section>
  );
}
