
import styles from '@/styles/Dashboard.module.css';

export default function GitHubIssueModal({ data, setData, onCopy, onClose }) {
  return (
    <div className={styles.modalOverlay} onClick={() => onClose()}>
      <div className={styles.modal} role="dialog" aria-modal="true" style={{ maxWidth: '600px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
        <h3 className={styles.modalTitle}>Create GitHub Issue</h3>
        <p className={styles.modalText}>
          Copy the information below and create an issue on your GitHub repository.
        </p>

        <div className={styles.githubFormGroup}>
          <label className={styles.githubLabel}>Issue Title</label>
          <input
            type="text"
            value={data.title}
            onChange={(e) => setData({...data, title: e.target.value})}
            className={styles.modalInput}
            placeholder="Issue title"
          />
        </div>

        <div className={styles.githubFormGroup}>
          <label className={styles.githubLabel}>Issue Body (Markdown)</label>
          <textarea
            value={data.body}
            onChange={(e) => setData({...data, body: e.target.value})}
            className={styles.modalTextarea}
            style={{ height: '300px' }}
            placeholder="Issue description"
          />
        </div>

        <div className={styles.githubInstructions}>
          <strong>Instructions</strong>
          <ol className={styles.githubSteps}>
            <li>Copy the title and body above</li>
            <li>Go to your GitHub repository</li>
            <li>Click &quot;Issues&quot; → &quot;New Issue&quot;</li>
            <li>Paste the content and submit</li>
          </ol>
        </div>

        <div className={styles.modalButtons}>
          <button 
            type="button" 
            onClick={() => {
              onCopy();
            }} 
            className={styles.modalButtonSubmit}
          >
            Copy all
          </button>
          <button 
            type="button"
            onClick={() => onClose()}
            className={styles.modalButtonCancel}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
