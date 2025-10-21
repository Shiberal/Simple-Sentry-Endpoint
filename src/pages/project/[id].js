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
  const [autoGithubReport, setAutoGithubReport] = useState(false);
  const [filterLevels, setFilterLevels] = useState(['error']);
  const [filterEnvironments, setFilterEnvironments] = useState('');
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
      setAutoGithubReport(data.project.autoGithubReport || false);
      
      // Load filters
      const filters = data.project.autoGithubReportFilters || {};
      setFilterLevels(filters.levels || ['error']);
      setFilterEnvironments(filters.environments ? filters.environments.join(', ') : '');
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
      // Build filters object
      const filters = {
        levels: filterLevels,
        environments: filterEnvironments ? filterEnvironments.split(',').map(e => e.trim()).filter(Boolean) : []
      };

      const response = await fetch(`/api/projects/${id}`, {
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

  // Get base URL - works in both SSR and client-side
  const getBaseUrl = () => {
    if (typeof window !== 'undefined') {
      return window.location.origin;
    }
    // Fallback to environment variable for SSR
    return process.env.NEXT_PUBLIC_BASE_URL || 'https://error.cool.errline5.org';
  };
  
  const getHost = () => {
    if (typeof window !== 'undefined') {
      return window.location.host;
    }
    // Fallback for SSR - extract host from base URL or use env
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://error.cool.errline5.org';
    return baseUrl.replace(/^https?:\/\//, '');
  };

  const baseUrl = getBaseUrl();
  const host = getHost();
  const envelopeUrl = `${baseUrl}/api/${project.id}/envelope`;
  const dsn = `https://${project.key}@${host}/${project.id}`;

  const curlExample = `curl -X POST ${envelopeUrl} \\
  -H "Content-Type: application/json" \\
  -d '{"event_id":"'$(date +%s)'"}
{"level":"error","message":"Test error from curl","environment":"production","platform":"node"}'`;

  const nodeExample = `// Using Official Sentry SDK (Recommended)
import * as Sentry from "@sentry/browser"; // or @sentry/node

Sentry.init({
  dsn: "${dsn}",
  tracesSampleRate: 1.0,
  environment: "production",
});

// Errors are automatically captured
try {
  // Your code
  undefinedFunction();
} catch (error) {
  Sentry.captureException(error);
}

// Or use manual envelope API
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
};`;

  const pythonExample = `# Using Official Sentry SDK (Recommended)
import sentry_sdk

sentry_sdk.init(
    dsn="${dsn}",
    traces_sample_rate=1.0,
    environment="production",
)

# Errors are automatically captured
try:
    # Your code
    1 / 0
except Exception as e:
    sentry_sdk.capture_exception(e)

# Or use manual envelope API
import requests
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
    )`;

  const phpExample = `<?php
// Install: composer require sentry/sdk guzzlehttp/guzzle
require_once __DIR__ . '/vendor/autoload.php';

// Custom HTTP client to follow redirects (required for this server)
class RedirectHttpClient implements \\Sentry\\HttpClient\\HttpClientInterface {
    private $client;
    
    public function __construct() {
        $this->client = new \\GuzzleHttp\\Client([
            'allow_redirects' => true,
            'timeout' => 5,
        ]);
    }
    
    public function sendRequest(
        \\Sentry\\HttpClient\\Request $request,
        \\Sentry\\Options $options
    ): \\Sentry\\HttpClient\\Response {
        $dsn = $options->getDsn();
        $url = $dsn->getEnvelopeApiEndpointUrl();
        
        $authHeader = sprintf(
            'Sentry sentry_version=7, sentry_client=sentry.php/%s, sentry_key=%s',
            \\Sentry\\Client::SDK_VERSION,
            $dsn->getPublicKey()
        );
        
        try {
            $response = $this->client->post($url, [
                'headers' => [
                    'Content-Type' => 'application/x-sentry-envelope',
                    'X-Sentry-Auth' => $authHeader,
                ],
                'body' => $request->getStringBody(),
            ]);
            
            return new \\Sentry\\HttpClient\\Response(
                $response->getStatusCode(),
                $response->getHeaders(),
                (string) $response->getBody()
            );
        } catch (\\Exception $e) {
            return new \\Sentry\\HttpClient\\Response(500, [], '');
        }
    }
}

// Initialize Sentry
\\Sentry\\init([
    'dsn' => '${dsn}',
    'environment' => 'production',
    'sample_rate' => 1.0,
    'http_client' => new RedirectHttpClient(), // Required!
]);

// Usage examples
try {
    // Your code
    throw new Exception('Something went wrong');
} catch (Throwable $e) {
    \\Sentry\\captureException($e);
}

// Or capture messages
\\Sentry\\captureMessage('User action completed', \\Sentry\\Severity::info());

// Add user context
\\Sentry\\configureScope(function (\\Sentry\\State\\Scope $scope): void {
    $scope->setUser(['id' => 123, 'email' => 'user@example.com']);
    $scope->setTag('feature', 'checkout');
});

// Flush events before script ends
register_shutdown_function(fn() => \\Sentry\\SentrySdk::getCurrentHub()->getClient()?->flush(2));
?>`;

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
            <h2 className={styles.sectionTitle}>DSN (Data Source Name)</h2>
            <p className={styles.sectionDescription}>
              Use this DSN with the official Sentry SDK. This is the recommended method.
            </p>
            <div className={styles.codeContainer}>
              <code className={styles.code}>{dsn}</code>
              <button 
                onClick={() => handleCopy(dsn)}
                className={styles.copyButton}
              >
                {copied ? '✓ Copied!' : '📋 Copy'}
              </button>
            </div>
          </section>

          {/* Project Key */}
          <section className={styles.section}>
            <h2 className={styles.sectionTitle}>Project Key</h2>
            <p className={styles.sectionDescription}>
              Your unique project identifier.
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
            <h2 className={styles.sectionTitle}>Envelope Endpoint (Advanced)</h2>
            <p className={styles.sectionDescription}>
              Direct HTTP endpoint for manual integrations. Most users should use the DSN above instead.
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

            {/* PHP */}
            <div className={styles.exampleBlock}>
              <h3 className={styles.exampleTitle}>PHP</h3>
              <div className={styles.codeBlockContainer}>
                <pre className={styles.codeBlock}>{phpExample}</pre>
                <button 
                  onClick={() => handleCopy(phpExample)}
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

          {/* Danger Zone */}
          <section className={styles.section} style={{borderColor: '#dc2626'}}>
            <h2 className={styles.sectionTitle} style={{color: '#dc2626'}}>Danger Zone</h2>
            <p className={styles.sectionDescription}>
              Delete this project and all associated events. This action cannot be undone.
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
