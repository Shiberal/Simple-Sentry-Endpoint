import { useState } from 'react';
import usePersistedState from '@/hooks/usePersistedState';
import { buildExamples, hrefOf, normalizeBase, resolveDsnBase } from '@/lib/project-dsn';
import styles from '@/styles/ProjectSettings.module.css';

/** DSN picker, project key, envelope endpoint and copy-paste integration snippets. */
export default function ConnectionSections({ project }) {
  const [baseChoice, setBaseChoice] = usePersistedState('project-dsn-base', '');
  const [customBase, setCustomBase] = usePersistedState('project-dsn-custom-bases', []);
  const [newBase, setNewBase] = useState('');
  const [copied, setCopied] = useState(false);

  const { originBase, baseOptions, baseUrl, envelopeUrl, dsn } = resolveDsnBase({ project, baseChoice, customBase });
  const { curlExample, nodeExample, pythonExample, phpExample } = buildExamples({ dsn, envelopeUrl });

  const handleCopy = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const addBase = () => {
    const u = normalizeBase(newBase);
    if (!u) return;
    const href = hrefOf(u);
    if (!baseOptions.includes(href)) setCustomBase([...customBase, href]);
    setBaseChoice(href);
    setNewBase('');
  };

  return (
    <>
      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>DSN (Data Source Name)</h2>
        <p className={styles.sectionDescription}>
          Use this DSN with the official Sentry SDK. This is the recommended method.
        </p>
        <div className={styles.formGroup}>
          <label className={styles.label}>Server URL</label>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-2)' }}>
            <select value={baseUrl} onChange={(e) => setBaseChoice(e.target.value)} className={styles.input} style={{ flex: '1 1 260px' }} aria-label="Server URL used in the DSN">
              {baseOptions.map((u) => <option key={u} value={u}>{u}{u === hrefOf(normalizeBase(originBase)) ? ' (this site)' : ''}</option>)}
            </select>
            <input
              type="text"
              value={newBase}
              onChange={(e) => setNewBase(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addBase(); } }}
              placeholder="Add another URL, e.g. https://errors.example.com"
              className={styles.input}
              style={{ flex: '1 1 260px' }}
              aria-label="Add a server URL"
            />
            <button type="button" onClick={addBase} className={styles.copyButton} disabled={!normalizeBase(newBase)}>Add</button>
          </div>
          <p className={styles.helpText}>Same project key on every URL. The DSN and the snippets below follow the selection and it is remembered in this browser. To preset URLs for everyone, set <code>NEXT_PUBLIC_BASE_URLS</code> (comma separated, at build time).</p>
        </div>
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
    </>
  );
}
