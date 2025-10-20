import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/ProjectSettings.module.css';

export default function ProjectSettings() {
  const router = useRouter();
  const { id } = router.query;
  const [project, setProject] = useState(null);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [githubRepo, setGithubRepo] = useState('');
  const [githubToken, setGithubToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (id) {
      checkAuth();
    }
  }, [id]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        router.push('/login');
        return;
      }
      const data = await response.json();
      setUser(data.user);
      fetchProject();
    } catch (error) {
      router.push('/login');
    }
  };

  const fetchProject = async () => {
    try {
      const response = await fetch(`/api/projects/${id}`);
      if (!response.ok) {
        router.push('/dashboard');
        return;
      }
      const data = await response.json();
      setProject(data.project);
      setGithubRepo(data.project.githubRepo || '');
      setGithubToken(data.project.githubToken || '');
    } catch (error) {
      console.error('Error fetching project:', error);
      router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveGitHub = async (e) => {
    e.preventDefault();
    setSaving(true);
    setSaved(false);
    
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          githubRepo,
          githubToken
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

  const handleDelete = async () => {
    try {
      const response = await fetch(`/api/projects/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        router.push('/dashboard');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
    }
  };

  if (loading || !project) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
    );
  }

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : '';
  const envelopeUrl = `${baseUrl}/api/${project.key}/envelope`;
  const dsn = `${baseUrl}@${project.key}`;

  const curlExample = `curl -X POST ${envelopeUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"event_id":"'$(date +%s)'"}
{"level":"error","message":"Test error from curl","environment":"production","platform":"node"}'`;

  const nodeExample = `// Using fetch in Node.js or Browser
const sendError = async (error) => {
  const envelope = \`{\"event_id\":\"\${Date.now()}\"}\\n\${JSON.stringify({
    level: 'error',
    message: error.message,
    exception: {
      values: [{
        type: error.name,
        value: error.message,
        stacktrace: {
          frames: error.stack.split('\\n').slice(1, 5).map(line => ({
            filename: 'app.js',
            function: line.trim(),
            lineno: 1
          }))
        }
      }]
    },
    environment: 'production',
    platform: 'javascript',
    timestamp: new Date().toISOString()
  })}\`;

  await fetch('${envelopeUrl}', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: envelope
  });
};

// Usage
try {
  // Your code
} catch (error) {
  await sendError(error);
}`;

  const pythonExample = `import requests
import json
import time

def send_error(message, level='error'):
    envelope = f'{{"event_id":"{int(time.time())}"}}'
    envelope += '\\n' + json.dumps({
        'level': level,
        'message': message,
        'environment': 'production',
        'platform': 'python',
        'timestamp': time.time()
    })
    
    requests.post(
        '${envelopeUrl}',
        data=envelope,
        headers={'Content-Type': 'application/json'}
    )

# Usage
try:
    # Your code
    raise Exception("Something went wrong")
except Exception as e:
    send_error(str(e))`;

  return (
    <>
      <Head>
        <title>{project.name} - Settings</title>
      </Head>
      
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <Link href="/dashboard" className={styles.backLink}>
              ← Back to Dashboard
            </Link>
            <h1 className={styles.title}>{project.name}</h1>
          </div>
        </header>

        <div className={styles.main}>
          {/* DSN Section */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Project Key (DSN)</h2>
            <p className={styles.sectionDescription}>
              Use this unique key to send events to your project.
            </p>
            <div className={styles.codeContainer}>
              <code className={styles.code}>{project.key}</code>
              <button 
                onClick={() => handleCopy(project.key)}
                className={styles.copyButton}
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
          </section>

          {/* Endpoint URL */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Envelope Endpoint</h2>
            <p className={styles.sectionDescription}>
              Send events to this endpoint using HTTP POST.
            </p>
            <div className={styles.codeContainer}>
              <code className={styles.code}>{envelopeUrl}</code>
              <button 
                onClick={() => handleCopy(envelopeUrl)}
                className={styles.copyButton}
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
          </section>

          {/* Integration Examples */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Integration Examples</h2>
            
            {/* cURL */}
            <div className={styles.exampleBlock}>
              <h3 className={styles.exampleTitle}>cURL</h3>
              <div className={styles.codeBlockContainer}>
                <pre className={styles.codeBlock}>{curlExample}</pre>
                <button 
                  onClick={() => handleCopy(curlExample)}
                  className={styles.copyButtonSmall}
                >
                  Copy
                </button>
              </div>
            </div>

            {/* JavaScript/Node.js */}
            <div className={styles.exampleBlock}>
              <h3 className={styles.exampleTitle}>JavaScript / Node.js</h3>
              <div className={styles.codeBlockContainer}>
                <pre className={styles.codeBlock}>{nodeExample}</pre>
                <button 
                  onClick={() => handleCopy(nodeExample)}
                  className={styles.copyButtonSmall}
                >
                  Copy
                </button>
              </div>
            </div>

            {/* Python */}
            <div className={styles.exampleBlock}>
              <h3 className={styles.exampleTitle}>Python</h3>
              <div className={styles.codeBlockContainer}>
                <pre className={styles.codeBlock}>{pythonExample}</pre>
                <button 
                  onClick={() => handleCopy(pythonExample)}
                  className={styles.copyButtonSmall}
                >
                  Copy
                </button>
              </div>
            </div>
          </section>

          {/* Project Info */}
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

          {/* GitHub Integration */}
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
                  Enter your repository in the format "owner/repo" or paste the full GitHub URL
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
                  Personal access token with "repo" scope. Required for private repositories.
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

          {/* Danger Zone */}
          <section className={styles.section} style={{borderColor: '#dc2626'}}>
            <h2 className={styles.sectionTitle} style={{color: '#dc2626'}}>Danger Zone</h2>
            <p className={styles.sectionDescription}>
              Delete this project and all associated events. This action cannot be undone.
            </p>
            {showDeleteConfirm ? (
              <div className={styles.deleteConfirm}>
                <p className={styles.deleteWarning}>
                  Are you sure? This will permanently delete "{project.name}" and all {project._count.events} events.
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
              >
                Delete Project
              </button>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
