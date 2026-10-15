import Link from 'next/link';
import { useRouter } from 'next/router';
import Icon from '@/components/Icon';
import ThemeToggle from '@/components/ThemeToggle';
import { TOOLS } from '@/lib/tools';
import styles from '@/styles/Hub.module.css';

export default function HubShell({ title, meta, children, wide }) {
  const router = useRouter();
  const active = router.query.tool || (router.pathname === '/' ? 'home' : '');

  return (
    <div className={styles.shell}>
      <aside className={styles.rail} aria-label="EDT tools">
        <Link href="/" className={styles.railBrand} title="EDT Hub" aria-label="EDT Hub">
          E
        </Link>
        {TOOLS.map((tool) => (
          <Link
            key={tool.id}
            href={`/workspace/${tool.id}`}
            className={`${styles.railItem} ${active === tool.id ? styles.railItemActive : ''}`}
            aria-label={tool.name}
            aria-current={active === tool.id ? 'page' : undefined}
          >
            <Icon name={tool.icon} size={18} />
            <span className={styles.railTip}>{tool.shortName}</span>
          </Link>
        ))}
        <div className={styles.railSpacer} />
        <Link
          href="/"
          className={`${styles.railItem} ${active === 'home' ? styles.railItemActive : ''}`}
          aria-label="All tools"
        >
          <Icon name="dashboard" size={18} />
          <span className={styles.railTip}>All tools</span>
        </Link>
      </aside>

      <div className={styles.main}>
        <header className={styles.topBar}>
          <div>
            <h1 className={styles.topTitle}>{title}</h1>
            {meta ? <p className={styles.topMeta}>{meta}</p> : null}
          </div>
          <div className={styles.topActions}>
            <ThemeToggle />
          </div>
        </header>
        <div className={wide ? styles.workspace : styles.content}>{children}</div>
      </div>
    </div>
  );
}
