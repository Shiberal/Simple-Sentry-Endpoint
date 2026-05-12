import { useCallback, useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import styles from '@/styles/Dashboard.module.css';

export default function MonitorsPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [projects, setProjects] = useState([]);
  const [pid, setPid] = useState(null);
  const [monitors, setMonitors] = useState([]);
  const [loading, setLoading] = useState(true);

  const [slug, setSlug] = useState('');
  const [name, setName] = useState('');
  const [schedule, setSchedule] = useState('');
  const [environment, setEnvironment] = useState('');
  const [pingUrls, setPingUrls] = useState('');
  const [creating, setCreating] = useState(false);
  const [runningPings, setRunningPings] = useState(false);
  const [error, setError] = useState('');

  const loadMonitors = useCallback(async (projectId) => {
    if (!projectId) return;
    const res = await fetch(`/api/projects/${projectId}/monitors`);
    const j = await res.json();
    if (!res.ok) {
      setMonitors([]);
      return;
    }
    setMonitors(j.monitors || []);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const me = await fetch('/api/auth/me').then((r) => r.json());
        if (!me?.user) {
          router.push('/login');
          return;
        }
        setUser(me.user);
        const pr = await fetch('/api/projects').then((r) => r.json());
        const list = pr.projects || [];
        setProjects(list);
        if (list.length && !pid) setPid(list[0].id);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (!pid) return;
    setError('');
    loadMonitors(pid);
  }, [pid, loadMonitors]);

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!pid) return;
    setCreating(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${pid}/monitors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: slug.trim(),
          name: name.trim() || undefined,
          schedule: schedule.trim() || undefined,
          environment: environment.trim() || undefined,
          urls: pingUrls.trim()
        })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(j.error || 'Could not create monitor');
        return;
      }
      setSlug('');
      setName('');
      setSchedule('');
      setEnvironment('');
      setPingUrls('');
      await loadMonitors(pid);
    } finally {
      setCreating(false);
    }
  };

  const runPingsForProject = async () => {
    if (!pid) return;
    setRunningPings(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${pid}/monitors/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setError(j.error || 'Ping run failed');
      await loadMonitors(pid);
    } finally {
      setRunningPings(false);
    }
  };

  const runPingForMonitor = async (monitorId) => {
    if (!pid) return;
    setRunningPings(true);
    setError('');
    try {
      const res = await fetch(`/api/projects/${pid}/monitors/ping`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ monitorId })
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) setError(j.error || 'Ping failed');
      await loadMonitors(pid);
    } finally {
      setRunningPings(false);
    }
  };

  const deleteMonitor = async (id, monSlug) => {
    if (
      typeof window !== 'undefined' &&
      !window.confirm(`Delete monitor "${monSlug}"? SDK check-ins for this slug will be ignored until you create it again.`)
    )
      return;
    const res = await fetch(`/api/projects/${pid}/monitors?monitorId=${id}`, {
      method: 'DELETE'
    });
    const j = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(j.error || 'Delete failed');
      return;
    }
    await loadMonitors(pid);
  };

  if (loading) return <div className={styles.container}>Loading…</div>;
  if (!user) return null;

  return (
    <>
      <Head>
        <title>Monitors - Sentry Monitor</title>
      </Head>
      <div className={styles.container} style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
          <Link href="/dashboard">← Dashboard</Link>
          <h1 style={{ margin: 0 }}>Cron monitors</h1>
          <select
            value={pid || ''}
            onChange={(e) => setPid(parseInt(e.target.value, 10))}
          >
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => runPingsForProject()}
            disabled={!pid || runningPings}
            style={{ padding: '6px 14px', cursor: pid ? 'pointer' : 'not-allowed' }}
          >
            {runningPings ? 'Running…' : 'HTTP ping (all URLs, this project)'}
          </button>
        </div>

        <p style={{ maxWidth: 720, marginBottom: 24 }}>
          Define monitors here first so SDK <code style={{ padding: '0 4px' }}>monitor_slug</code>{' '}
          values are recognized. Optionally add one URL per line (or comma-separated); this server performs
          a <strong>GET</strong> on each URL on a schedule (<code style={{ padding: '0 4px' }}>ENABLE_MONITOR_HTTP_PINGER</code>,{' '}
          <code style={{ padding: '0 4px' }}>/api/cron/monitors-ping</code>), or manually with the buttons
          below.
        </p>

        {error ? (
          <p style={{ color: 'crimson', marginBottom: 12 }}>{error}</p>
        ) : null}

        <form
          onSubmit={handleCreate}
          style={{
            marginBottom: 32,
            padding: 16,
            border: '1px solid var(--border-primary, #ccc)',
            borderRadius: 8,
            maxWidth: 560,
            background: 'var(--bg-secondary, #fafafa)'
          }}
        >
          <h2 style={{ fontSize: 16, marginTop: 0 }}>Create monitor</h2>
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Slug</label>
          <input
            required
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="e.g. nightly-backup"
            pattern="^[a-zA-Z0-9_-]+$"
            style={{ width: '100%', padding: 8, marginBottom: 12, boxSizing: 'border-box' }}
          />
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Display name (optional)</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ width: '100%', padding: 8, marginBottom: 12, boxSizing: 'border-box' }}
          />
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
            Schedule hint (optional, e.g. cron)
          </label>
          <input
            value={schedule}
            onChange={(e) => setSchedule(e.target.value)}
            placeholder="0 2 * * *"
            style={{ width: '100%', padding: 8, marginBottom: 12, boxSizing: 'border-box' }}
          />
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>Environment (optional)</label>
          <input
            value={environment}
            onChange={(e) => setEnvironment(e.target.value)}
            placeholder="production"
            style={{ width: '100%', padding: 8, marginBottom: 12, boxSizing: 'border-box' }}
          />
          <label style={{ display: 'block', fontSize: 12, marginBottom: 4 }}>
            URLs to ping (optional, one per line or comma-separated, http/https only)
          </label>
          <textarea
            value={pingUrls}
            onChange={(e) => setPingUrls(e.target.value)}
            placeholder={`https://api.example.com/health\nhttps://status.example.com/`}
            rows={4}
            style={{
              width: '100%',
              padding: 8,
              marginBottom: 12,
              boxSizing: 'border-box',
              fontFamily: 'monospace',
              fontSize: 12
            }}
          />
          <button type="submit" disabled={creating || !pid}>
            {creating ? 'Saving…' : 'Create'}
          </button>
        </form>

        {!monitors.length ? (
          <p>No monitors yet — create one above, then point the Sentry cron integration at this slug.</p>
        ) : (
          <table style={{ width: '100%', maxWidth: 960, borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>Slug</th>
                <th>Name</th>
                <th>Schedule</th>
                <th>Env</th>
                <th>Ping URLs</th>
                <th>Last status</th>
                <th>Last check-in</th>
                <th>Recent</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {monitors.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8, fontFamily: 'monospace', fontWeight: 600 }}>{m.slug}</td>
                  <td>{m.name || '—'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: 13 }}>{m.schedule || '—'}</td>
                  <td>{m.environment || '—'}</td>
                  <td
                    title={(m.pingUrls || []).join('\n')}
                    style={{
                      maxWidth: 200,
                      fontSize: 11,
                      verticalAlign: 'top',
                      wordBreak: 'break-all'
                    }}
                  >
                    {m.pingUrls && m.pingUrls.length ? (
                      <>
                        {(m.pingUrls || []).slice(0, 2).join(' · ')}
                        {(m.pingUrls || []).length > 2
                          ? ` (+${m.pingUrls.length - 2})`
                          : ''}
                      </>
                    ) : (
                      '—'
                    )}
                  </td>
                  <td>{m.status}</td>
                  <td>
                    {m.lastCheckInAt
                      ? new Date(m.lastCheckInAt).toLocaleString()
                      : '—'}
                  </td>
                  <td style={{ fontSize: 12 }}>
                    {(m.checkIns || [])
                      .map((c) => `${c.status} @ ${new Date(c.createdAt).toLocaleTimeString()}`)
                      .join(' · ')}
                  </td>
                  <td style={{ padding: 8 }}>
                    <button
                      type="button"
                      onClick={() => runPingForMonitor(m.id)}
                      disabled={
                        runningPings || !m.pingUrls || !m.pingUrls.length
                      }
                      style={{
                        marginRight: 8,
                        cursor:
                          runningPings || !m.pingUrls || !m.pingUrls.length
                            ? 'not-allowed'
                            : 'pointer'
                      }}
                      title={
                        !m.pingUrls || !m.pingUrls.length
                          ? 'Add URLs to this monitor'
                          : 'GET each URL once'
                      }
                    >
                      Ping
                    </button>
                    <button
                      type="button"
                      onClick={() => deleteMonitor(m.id, m.slug)}
                      style={{
                        color: '#a00',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer'
                      }}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
