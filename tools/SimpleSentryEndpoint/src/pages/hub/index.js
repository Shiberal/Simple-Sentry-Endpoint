import { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import Icon from '@/components/Icon';
import HubShell from '@/components/hub/HubShell';
import { TOOLS } from '@/lib/edt-tools';
import styles from '@/styles/Hub.module.css';

/** EDT Hub — logged-in home. Sentry issues live under the Sentry tab → /hub/sentry. */
export default function HubPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [checking, setChecking] = useState(true);

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

  return (
    <>
      <Head>
        <title>EDT Hub</title>
      </Head>
      <HubShell
        title="Hub"
        meta={`Signed in as ${user.email}`}
        tabId="overview"
      >
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <p className={styles.brandMark}>EDT</p>
            <p className={styles.lede}>
              Pick a tool. Sentry is the issues workspace (formerly Dashboard). Monitor stays under its own tab.
            </p>
          </div>
        </section>

        <div className={styles.toolList} role="list">
          {TOOLS.map((tool) => (
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
