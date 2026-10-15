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

  if (checking) {
    return (
      <>
        <Head>
          <title>Status · EDT</title>
        </Head>
        <HubShell title="Status" railActive="hub">
          <p className={styles.muted}>Loading…</p>
        </HubShell>
      </>
    );
  }

  if (!user) return null;

  const mon = monitor.summary;
  const monBad = mon ? (mon.failing || 0) + (mon.missed || 0) : null;
  const monOk = mon ? mon.ok || 0 : null;
  const statsReady = !sentry.loading && !monitor.loading && !sentry.error && !monitor.error;
  const issueCount = sentry.active ?? 0;
  const needsAttention = statsReady && (issueCount > 0 || (monBad ?? 0) > 0);

  let summaryText = 'Checking Sentry and Monitors…';
  if (sentry.error || monitor.error) {
    summaryText = 'Some status data could not be loaded. Open a tool below for details.';
  } else if (!sentry.loading && !monitor.loading) {
    if (needsAttention) {
      const parts = [];
      if (issueCount > 0) parts.push(`${issueCount} active issue${issueCount === 1 ? '' : 's'}`);
      if ((monBad ?? 0) > 0) parts.push(`${monBad} monitor${monBad === 1 ? '' : 's'} failing or missed`);
      summaryText = parts.join(' · ');
    } else {
      summaryText = 'Nothing urgent — no active issues and monitors look healthy (24h).';
    }
  }

  return (
    <>
      <Head>
        <title>Status · EDT</title>
      </Head>
      <HubShell title="Status" meta={user.email} user={user} railActive="hub">
        <p
          className={`${styles.attentionSummary} ${needsAttention ? styles.attentionSummaryWarn : ''}`}
          role="status"
        >
          <strong>Today</strong> — {summaryText}
        </p>

        <div className={styles.primaryStack}>
          <Link
            href="/hub/sentry"
            className={`${styles.statusCard} ${issueCount > 0 ? styles.statusCardAttention : ''}`}
          >
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
                    ? 'No active issues — open issues'
                    : 'Active issues — triage now'}
            </p>
          </Link>

          <Link
            href="/monitors"
            className={`${styles.statusCard} ${(monBad ?? 0) > 0 ? styles.statusCardAttention : ''}`}
          >
            <div className={styles.statusHead}>
              <span className={styles.statusIcon} aria-hidden>
                <Icon name="clock" size={18} />
              </span>
              <span className={styles.statusLabel}>Monitors</span>
            </div>
            <p className={styles.statusValue}>
              {monitor.loading ? '…' : monitor.error ? '—' : monBad}
            </p>
            <p className={styles.statusHint}>
              {monitor.error
                ? monitor.error
                : monitor.loading
                  ? 'Loading monitors (24h)'
                  : monBad === 0
                    ? `${monOk} healthy in the last 24h`
                    : `${monBad} failing or missed · ${monOk} ok — review monitors`}
            </p>
          </Link>
        </div>

        <p className={styles.shortcuts}>
          Also: <Link href="/performance">Performance</Link>
          {' · '}
          <Link href="/projects">Projects</Link>
        </p>
      </HubShell>
    </>
  );
}
