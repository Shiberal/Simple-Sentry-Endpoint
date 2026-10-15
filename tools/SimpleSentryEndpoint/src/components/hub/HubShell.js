import Link from 'next/link';
import Icon from '@/components/Icon';
import ThemeToggle from '@/components/ThemeToggle';
import { HUB_TABS, TOOLS } from '@/lib/edt-tools';
import styles from '@/styles/Hub.module.css';

export default function HubShell({ title, meta, children, tabId = 'overview' }) {
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
            className={`${styles.railItem} ${
              (tool.id === 'sentry-performance' && tabId === 'sentry') ||
              (tool.id === 'monitor' && tabId === 'monitor')
                ? styles.railItemActive
                : ''
            }`}
            aria-label={tool.name}
          >
            <Icon name={tool.icon} size={18} />
            <span className={styles.railTip}>{tool.shortName}</span>
          </Link>
        ))}
        <div className={styles.railSpacer} />
        <Link
          href="/hub"
          className={`${styles.railItem} ${tabId === 'overview' ? styles.railItemActive : ''}`}
          aria-label="Hub overview"
          aria-current={tabId === 'overview' ? 'page' : undefined}
        >
          <Icon name="dashboard" size={18} />
          <span className={styles.railTip}>Overview</span>
        </Link>
      </aside>

      <div className={styles.main}>
        <header className={styles.topBar}>
          <div>
            <h1 className={styles.topTitle}>{title}</h1>
            {meta ? <p className={styles.topMeta}>{meta}</p> : null}
          </div>
          <div className={styles.topActions}>
            <nav className={styles.workspaceTabs} aria-label="Hub sections">
              {HUB_TABS.map((tab) => (
                <Link
                  key={tab.id}
                  href={tab.href}
                  className={`${styles.tab} ${tabId === tab.id ? styles.tabActive : ''}`}
                  aria-current={tabId === tab.id ? 'page' : undefined}
                >
                  {tab.label}
                </Link>
              ))}
            </nav>
            <ThemeToggle />
          </div>
        </header>
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
