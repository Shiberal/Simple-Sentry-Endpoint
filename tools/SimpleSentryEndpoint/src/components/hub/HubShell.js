import Link from 'next/link';
import { useRouter } from 'next/router';
import Icon from '@/components/Icon';
import ThemeToggle from '@/components/ThemeToggle';
import { TOOLS } from '@/lib/edt-tools';
import styles from '@/styles/Hub.module.css';

export default function HubShell({ title, meta, children }) {
  const router = useRouter();
  const active = router.pathname === '/hub' ? 'home' : '';

  return (
    <div className={styles.shell}>
      <aside className={styles.rail} aria-label="EDT tools">
        <Link href="/hub" className={styles.railBrand} title="EDT Hub" aria-label="EDT Hub">
          E
        </Link>
        {TOOLS.map((tool) => (
          <Link
            key={tool.id}
            href={tool.href}
            className={styles.railItem}
            aria-label={tool.name}
          >
            <Icon name={tool.icon} size={18} />
            <span className={styles.railTip}>{tool.shortName}</span>
          </Link>
        ))}
        <div className={styles.railSpacer} />
        <Link
          href="/hub"
          className={`${styles.railItem} ${active === 'home' ? styles.railItemActive : ''}`}
          aria-label="All tools"
          aria-current={active === 'home' ? 'page' : undefined}
        >
          <Icon name="dashboard" size={18} />
          <span className={styles.railTip}>All tools</span>
        </Link>
        <Link href="/" className={styles.railItem} aria-label="Sentry Monitor home">
          <Icon name="inbox" size={18} />
          <span className={styles.railTip}>SSE home</span>
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
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
