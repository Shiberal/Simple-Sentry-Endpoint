import Head from 'next/head';
import Link from 'next/link';
import Icon from '@/components/Icon';
import HubShell from '@/components/HubShell';
import { TOOLS, toolOpenUrl } from '@/lib/tools';
import styles from '@/styles/Hub.module.css';

export default function HomePage() {
  return (
    <>
      <Head>
        <title>EDT</title>
      </Head>
      <HubShell title="Tools" meta="Open any tool from one place">
        <section className={styles.hero}>
          <div className={styles.heroInner}>
            <p className={styles.brandMark}>EDT</p>
            <p className={styles.lede}>
              Ops tools that share one look. Start with Monitor or Sentry + Performance — more slots later.
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
                <Link href={`/workspace/${tool.id}`} className={`${styles.btn} ${styles.btnPrimary}`}>
                  Open in Hub
                </Link>
                <a
                  href={toolOpenUrl(tool)}
                  target="_blank"
                  rel="noreferrer"
                  className={styles.btn}
                >
                  Open alone
                  <Icon name="link" size={14} />
                </a>
              </div>
            </article>
          ))}
        </div>
      </HubShell>
    </>
  );
}
