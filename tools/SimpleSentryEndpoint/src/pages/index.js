import Head from 'next/head';
import Link from 'next/link';
import Icon from '@/components/Icon';
import HubShell from '@/components/hub/HubShell';
import { TOOLS } from '@/lib/edt-tools';
import styles from '@/styles/Hub.module.css';

/** EDT Hub — main page for all tools (same app, one port). */
export default function HomePage() {
  return (
    <>
      <Head>
        <title>EDT</title>
      </Head>
      <HubShell title="Tools" meta="Everything in one place — pick a tool to open it">
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <p className={styles.brandMark}>EDT</p>
            <p className={styles.lede}>
              Ops tools that share one look. Start with Monitor or Sentry + Performance — more later.
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
                {tool.actions.length > 1
                  ? tool.actions.slice(1).map((action) => (
                      <Link key={action.id} href={action.href} className={styles.btn}>
                        {action.label}
                      </Link>
                    ))
                  : null}
              </div>
            </article>
          ))}
        </div>
      </HubShell>
    </>
  );
}
