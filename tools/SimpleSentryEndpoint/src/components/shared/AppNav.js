import Link from 'next/link';
import Icon from '@/components/Icon';
import shell from '@/styles/AppShell.module.css';

// Coolify-style groups: hub chrome, then tools, then account
const PRIMARY = [
  { key: 'hub', href: '/hub', icon: 'apps', title: 'Hub', tooltip: 'Hub', label: 'Hub' },
];

const TOOLS = [
  { key: 'sentry', href: '/hub/sentry', icon: 'activity', title: 'Sentry issues', tooltip: 'Sentry', label: 'Sentry issues' },
  { key: 'performance', href: '/performance', icon: 'chart', title: 'Performance', tooltip: 'Performance', label: 'Performance' },
  { key: 'monitors', href: '/monitors', icon: 'clock', title: 'Monitor', tooltip: 'Monitor', label: 'Monitor' },
  { key: 'projects', href: '/projects', icon: 'folder', title: 'Projects', tooltip: 'Projects', label: 'Projects' },
];

function NavLink({ href, icon, title, tooltip, label, active }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }} aria-label={label}>
      <div className={`${shell.navItem} ${active ? shell.navItemActive : ''}`} title={title}>
        <Icon name={icon} size={18} strokeWidth={1.6} />
        <div className={shell.navItemTooltip}>{tooltip}</div>
      </div>
    </Link>
  );
}

/**
 * Left icon rail (Coolify-style) shared by signed-in tool pages.
 * `children` renders between the dividers (project picker).
 */
export default function AppNav({ active, isAdmin, onLogout, children, user }) {
  const initial = (user?.username || user?.email || '').charAt(0).toUpperCase();

  return (
    <nav className={shell.navSidebar} aria-label="Primary">
      <Link href="/hub" className={shell.navBrand} title="EDT" aria-label="EDT">
        E
      </Link>

      {PRIMARY.map(({ key, ...link }) => (
        <NavLink key={key} {...link} active={active === key} />
      ))}

      <div className={shell.navDivider} />

      {TOOLS.map(({ key, ...link }) => (
        <NavLink key={key} {...link} active={active === key} />
      ))}

      <div className={shell.navDivider} />

      {children != null && (
        <>
          {children}
          <div className={shell.navDivider} />
        </>
      )}

      <div className={shell.navSpacer} />

      {isAdmin && (
        <NavLink href="/admin" icon="settings" title="Admin" tooltip="Admin Settings" label="Admin settings" active={active === 'admin'} />
      )}
      <NavLink href="/profile" icon="user" title="Profile" tooltip="Your Profile" label="Your profile" active={active === 'profile'} />

      {onLogout && (
        <button className={shell.navItem} onClick={onLogout} aria-label="Log out" title="Logout">
          <Icon name="logout" size={18} strokeWidth={1.6} />
          <div className={shell.navItemTooltip}>Logout</div>
        </button>
      )}

      {initial ? (
        <Link href="/profile" className={shell.navAvatar} aria-label="Profile" title="Profile">
          {initial}
        </Link>
      ) : null}
    </nav>
  );
}
