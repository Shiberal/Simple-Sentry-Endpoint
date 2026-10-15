import Link from 'next/link';
import Icon from '@/components/Icon';
import shell from '@/styles/AppShell.module.css';

/** Fixed left tool switcher — same place on Hub and every tool page. */
export const RAIL_TOOLS = [
  { key: 'hub', href: '/hub', icon: 'apps', label: 'Hub' },
  { key: 'sentry', href: '/hub/sentry', icon: 'activity', label: 'Sentry' },
  { key: 'performance', href: '/performance', icon: 'chart', label: 'Performance' },
  { key: 'monitors', href: '/monitors', icon: 'clock', label: 'Monitor' },
  { key: 'projects', href: '/projects', icon: 'folder', label: 'Projects' },
];

function RailLink({ href, icon, label, active }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }} aria-label={label}>
      <div className={`${shell.navItem} ${active ? shell.navItemActive : ''}`} title={label}>
        <Icon name={icon} size={18} strokeWidth={1.6} />
        <div className={shell.navItemTooltip}>{label}</div>
      </div>
    </Link>
  );
}

/**
 * Coolify-style EDT tool selector. Stays leftmost so switching tools does not move chrome.
 */
export default function EdtToolRail({
  active,
  isAdmin,
  onLogout,
  user,
  footer = null,
}) {
  const initial = (user?.username || user?.email || '').charAt(0).toUpperCase();

  return (
    <nav className={shell.navSidebar} aria-label="EDT tools">
      <Link href="/hub" className={shell.navBrand} title="EDT" aria-label="EDT">
        E
      </Link>

      {RAIL_TOOLS.map(({ key, href, icon, label }) => (
        <RailLink key={key} href={href} icon={icon} label={label} active={active === key} />
      ))}

      <div className={shell.navSpacer} />

      <div className={shell.navDivider} />

      {footer}

      {isAdmin && (
        <RailLink href="/admin" icon="settings" label="Admin" active={active === 'admin'} />
      )}
      <RailLink href="/profile" icon="user" label="Profile" active={active === 'profile'} />

      {onLogout && (
        <button type="button" className={shell.navItem} onClick={onLogout} aria-label="Log out" title="Logout">
          <Icon name="logout" size={18} strokeWidth={1.6} />
          <div className={shell.navItemTooltip}>Logout</div>
        </button>
      )}

      {initial ? (
        <Link href="/profile" className={shell.navAvatar} aria-label="Profile" title={user?.email || 'Profile'}>
          {initial}
        </Link>
      ) : null}
    </nav>
  );
}
