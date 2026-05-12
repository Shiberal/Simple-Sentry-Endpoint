import { useEffect, useState } from 'react';
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
    (async () => {
      try {
        const res = await fetch(`/api/projects/${pid}/monitors`);
        const j = await res.json();
        setMonitors(j.monitors || []);
      } catch {
        setMonitors([]);
      }
    })();
  }, [pid]);

  if (loading) return <div className={styles.container}>Loading…</div>;
  if (!user) return null;

  return (
    <>
      <Head>
        <title>Monitors - Sentry Monitor</title>
      </Head>
      <div className={styles.container} style={{ padding: 24 }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 24 }}>
          <Link href="/dashboard">← Dashboard</Link>
          <h1>Cron monitors (SDK)</h1>
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
        </div>
        {!monitors.length ? (
          <p>No monitors yet — send cron check-ins from the official Sentry SDK.</p>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                <th style={{ padding: 8 }}>Slug</th>
                <th>Status</th>
                <th>Last check-in</th>
                <th>Recent</th>
              </tr>
            </thead>
            <tbody>
              {monitors.map((m) => (
                <tr key={m.id} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: 8, fontFamily: 'monospace' }}>{m.slug}</td>
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
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
