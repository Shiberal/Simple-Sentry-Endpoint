import { useEffect, useMemo, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Icon from '@/components/Icon';
import HubShell from '@/components/hub/HubShell';
import { normalizeHubTab, toolsForHubTab } from '@/lib/edt-tools';
import styles from '@/styles/Hub.module.css';

/** EDT Hub — Coolify-style rail; tabs show tools inside Hub. */
export default function HubPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

  const tabId = useMemo(
    () => normalizeHubTab(typeof router.query.tab === 'string' ? router.query.tab : 'all'),
    [router.query.tab]
  );
  const tools = useMemo(() => toolsForHubTab(tabId), [tabId]);

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

  const tabLabel =
    tabId === 'sentry' ? 'Sentry' : tabId === 'monitor' ? 'Monitor' : 'All tools';

  return (
    <>
      <Head>
        <title>{`${tabLabel} · EDT Hub`}</title>
      </Head>
      <HubShell
        title="Hub"
        meta={`Signed in as ${user.email}`}
        tabId={tabId}
        user={user}
        railActive="hub"
      >
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <p className={styles.brandMark}>EDT</p>
            <p className={styles.lede}>
              {tabId === 'all'
                ? 'Your tools. Open one from a tab, or jump straight into a workspace.'
                : `Working in ${tabLabel} — open the workspace or a shortcut below.`}
            </p>
          </div>
        </section>

        <div className={styles.toolList} role="list">
          {tools.map((tool) => (
            <article key={tool.id} className={styles.toolRow} role="listitem">
              <div className={styles.toolIcon} aria-hidden>
                <Icon name={tool.icon} size={22} />
              </div>
              <div>
                <h2 className={styles.toolName}>{tool.name}</h2>
                <p className={styles.toolSummary}>{tool.summary}</p>
              </div>
              <div className={styles.toolActions}>
                <Link href={tool.href} className={`${styles.btn} ${styles.btnPrimary}`}>
                  Open
                </Link>
                {tool.actions.slice(1).map((action) => (
                  <Link key={action.id} href={action.href} className={styles.btn}>
                    {action.label}
                  </Link>
                ))}
              </div>
            </article>
          ))}
        </div>
      </HubShell>
    </>
  );
}
