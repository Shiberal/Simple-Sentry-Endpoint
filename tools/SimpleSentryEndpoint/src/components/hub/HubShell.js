import Link from 'next/link';
import Icon from '@/components/Icon';
import ThemeToggle from '@/components/ThemeToggle';
import { HUB_TABS } from '@/lib/edt-tools';
import styles from '@/styles/Hub.module.css';

function RailLink({ href, icon, label, active }) {
  return (
    <Link
      href={href}
      className={`${styles.railItem} ${active ? styles.railItemActive : ''}`}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      title={label}
    >
      <Icon name={icon} size={18} strokeWidth={1.6} />
      <span className={styles.railTip}>{label}</span>
    </Link>
  );
}

/**
 * Coolify-style icon rail + Hub main. Tabs live in the main pane so tools stay inside Hub.
 */
export default function HubShell({
  title = 'Hub',
  meta,
  children,
  tabId = 'all',
  user,
  railActive = 'hub',
}) {
  const initial = (user?.username || user?.email || 'U').charAt(0).toUpperCase();

  return (
    <div className={styles.shell}>
      <aside className={styles.rail} aria-label="EDT">
        <Link href="/hub" className={styles.railBrand} title="EDT" aria-label="EDT">
          E
        </Link>

        <div className={styles.railGroup}>
          <RailLink href="/" icon="home" label="Home" active={railActive === 'home'} />
          <RailLink href="/hub" icon="apps" label="Hub" active={railActive === 'hub'} />
        </div>

        <div className={styles.railDivider} />

        <div className={styles.railGroup}>
          <RailLink href="/hub/sentry" icon="activity" label="Sentry" active={railActive === 'sentry'} />
          <RailLink href="/performance" icon="chart" label="Performance" active={railActive === 'performance'} />
          <RailLink href="/monitors" icon="clock" label="Monitor" active={railActive === 'monitor'} />
          <RailLink href="/projects" icon="folder" label="Projects" active={railActive === 'projects'} />
        </div>

        <div className={styles.railSpacer} />

        <div className={styles.railDivider} />

        <div className={styles.railGroup}>
          {user?.isAdmin ? (
            <RailLink href="/admin" icon="settings" label="Admin" active={railActive === 'admin'} />
          ) : null}
          <RailLink href="/profile" icon="user" label="Profile" active={railActive === 'profile'} />
          <div className={styles.railTheme}>
            <ThemeToggle />
          </div>
        </div>

        <Link
          href="/profile"
          className={styles.railAvatar}
          aria-label={user?.email || 'Profile'}
          title={user?.email || 'Profile'}
        >
          {initial}
        </Link>
      </aside>

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
