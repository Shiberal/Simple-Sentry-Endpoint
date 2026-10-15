import Head from 'next/head';
import Link from 'next/link';
import Icon from '@/components/Icon';
import HubShell from '@/components/hub/HubShell';
import { TOOLS } from '@/lib/edt-tools';
import styles from '@/styles/Hub.module.css';

/** EDT tool catalog — does not replace the Simple Sentry landing at `/`. */
export default function HubPage() {
  return (
    <>
      <Head>
        <title>EDT Hub</title>
      </Head>
      <HubShell title="Tools" meta="EDT catalog — Simple Sentry Endpoint still works as before from /">
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <p className={styles.brandMark}>EDT</p>
            <p className={styles.lede}>
              Ops tools in one catalog. Sentry Monitor itself is unchanged — landing, login, dashboard,
              monitors, and ingest all behave as they did.
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
