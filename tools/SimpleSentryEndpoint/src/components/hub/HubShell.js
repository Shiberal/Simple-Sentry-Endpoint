import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import EdtToolRail from '@/components/shared/EdtToolRail';
import { HUB_TABS } from '@/lib/edt-tools';
import styles from '@/styles/Hub.module.css';
import shell from '@/styles/AppShell.module.css';

/**
 * Same left tool switcher as tool pages; Hub content + tabs on the right.
 */
export default function HubShell({
  title = 'Hub',
  meta,
  children,
  tabId = 'all',
  user,
  railActive = 'hub',
}) {
  return (
    <div className={styles.shell}>
      <div className={shell.navStack}>
        <EdtToolRail
          active={railActive}
          isAdmin={user?.isAdmin}
          user={user}
          footer={
            <div className={shell.navTheme}>
              <ThemeToggle />
            </div>
          }
        />
      </div>

      <div className={styles.main}>
        <header className={styles.topBar}>
          <div>
            <h1 className={styles.topTitle}>{title}</h1>
            {meta ? <p className={styles.topMeta}>{meta}</p> : null}
          </div>
        </header>

        <nav className={styles.hubTabs} aria-label="Hub tools">
          {HUB_TABS.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`${styles.hubTab} ${tabId === tab.id ? styles.hubTabActive : ''}`}
              aria-current={tabId === tab.id ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>

        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
