import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Icon from '@/components/Icon';
import HubShell from '@/components/hub/HubShell';
import styles from '@/styles/Hub.module.css';

/**
 * Hub = cross-tool status, not a second catalog.
 * Tool switching is the left rail; this page answers “what needs attention?”
 */
export default function HubPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);
  const [sentry, setSentry] = useState({ loading: true, active: null, error: null });
  const [monitor, setMonitor] = useState({ loading: true, summary: null, error: null });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (cancelled) return;
        if (!data?.user) {
          router.replace('/?next=/hub');
          return;
        }
        setUser(data.user);
      } catch {
        if (!cancelled) router.replace('/?next=/hub');
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    if (!user) return undefined;
    let cancelled = false;

    (async () => {
      try {
        const res = await fetch('/api/issues?status=active&pageSize=1');
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || 'Failed to load issues');
        setSentry({ loading: false, active: data.totalCount ?? data.total ?? 0, error: null });
      } catch (err) {
        if (!cancelled) setSentry({ loading: false, active: null, error: err.message });
      }
    })();

    (async () => {
      try {
        const res = await fetch('/api/monitors?compact=1&range=24h');
        const data = await res.json();
        if (cancelled) return;
        if (!res.ok) throw new Error(data.error || 'Failed to load monitors');
        setMonitor({ loading: false, summary: data.summary || null, error: null });
      } catch (err) {
        if (!cancelled) setMonitor({ loading: false, summary: null, error: err.message });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user]);

  if (checking || !user) {
    return (
      <>
        <Head>
          <title>EDT Hub</title>
        </Head>
        <p className={styles.muted} style={{ padding: '2rem' }}>
          Loading…
        </p>
      </>
    );
  }

  const mon = monitor.summary;
  const monBad = mon ? (mon.failing || 0) + (mon.missed || 0) : null;
  const monOk = mon ? mon.ok || 0 : null;

  return (
    <>
      <Head>
        <title>Status · EDT</title>
      </Head>
      <HubShell title="Status" meta={user.email} user={user} railActive="hub">
        <div className={styles.statusGrid}>
          <Link href="/hub/sentry" className={styles.statusCard}>
            <div className={styles.statusHead}>
              <span className={styles.statusIcon} aria-hidden>
                <Icon name="activity" size={18} />
              </span>
              <span className={styles.statusLabel}>Sentry</span>
            </div>
            <p className={styles.statusValue}>
              {sentry.loading ? '…' : sentry.error ? '—' : sentry.active}
            </p>
            <p className={styles.statusHint}>
              {sentry.error
                ? sentry.error
                : sentry.loading
                  ? 'Loading active issues'
                  : sentry.active === 0
                    ? 'No active issues'
                    : 'Active issues'}
            </p>
          </Link>

          <Link href="/monitors" className={styles.statusCard}>
            <div className={styles.statusHead}>
              <span className={styles.statusIcon} aria-hidden>
                <Icon name="clock" size={18} />
              </span>
              <span className={styles.statusLabel}>Monitor</span>
            </div>
            <p className={styles.statusValue}>
              {monitor.loading ? '…' : monitor.error ? '—' : monBad}
            </p>
            <p className={styles.statusHint}>
              {monitor.error
                ? monitor.error
                : monitor.loading
                  ? 'Loading monitors'
                  : monBad === 0
                    ? `${monOk} healthy`
                    : `${monBad} failing or missed · ${monOk} ok`}
            </p>
          </Link>

          <Link href="/performance" className={styles.statusCard}>
            <div className={styles.statusHead}>
              <span className={styles.statusIcon} aria-hidden>
                <Icon name="chart" size={18} />
              </span>
              <span className={styles.statusLabel}>Performance</span>
            </div>
            <p className={styles.statusValue}>→</p>
            <p className={styles.statusHint}>Transaction overview</p>
          </Link>

          <Link href="/projects" className={styles.statusCard}>
            <div className={styles.statusHead}>
              <span className={styles.statusIcon} aria-hidden>
                <Icon name="folder" size={18} />
              </span>
              <span className={styles.statusLabel}>Projects</span>
            </div>
            <p className={styles.statusValue}>→</p>
            <p className={styles.statusHint}>Keys, DSN, membership</p>
          </Link>
        </div>
      </HubShell>
    </>
  );
}
