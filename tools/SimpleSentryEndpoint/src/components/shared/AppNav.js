import Link from 'next/link';
import Icon from '@/components/Icon';
import shell from '@/styles/AppShell.module.css';

// Sentry + Performance nav; Monitors is its own EDT tool but still served here for now
const LINKS = [
  { key: 'projects', href: '/projects', icon: 'folder', title: 'Projects', tooltip: 'Projects', label: 'Projects' },
  { key: 'dashboard', href: '/dashboard', icon: 'dashboard', title: 'Issues', tooltip: 'Issues', label: 'Issues' },
  { key: 'performance', href: '/performance', icon: 'activity', title: 'Performance', tooltip: 'Performance', label: 'Performance' },
  { key: 'monitors', href: '/monitors', icon: 'clock', title: 'Monitor (EDT)', tooltip: 'Monitor', label: 'Monitor' },
];

function NavLink({ href, icon, title, tooltip, label, active }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }} aria-label={label}>
      <div className={`${shell.navItem} ${active ? shell.navItemActive : ''}`} title={title}>
        <Icon name={icon} size={18} />
        <div className={shell.navItemTooltip}>{tooltip}</div>
      </div>
    </Link>
  );
}

/**
 * Left icon rail shared by every signed-in page.
 * `children` renders between the dividers (a page's project picker); omit it for a single divider.
 * The Admin link shows only when `isAdmin` is passed, the Logout button only when `onLogout` is.
 */
export default function AppNav({ active, isAdmin, onLogout, children }) {
  return (
    <nav className={shell.navSidebar} aria-label="Primary">
      <NavLink href="/hub" icon="inbox" title="EDT Hub" tooltip="EDT Hub" label="EDT Hub" active={active === 'hub'} />
      <div className={shell.navDivider}></div>

      {LINKS.map(({ key, ...link }) => <NavLink key={key} {...link} active={active === key} />)}

      <div className={shell.navDivider}></div>

      {children != null && (
        <>
          {children}
          <div className={shell.navDivider}></div>
        </>
      )}

      {isAdmin && <NavLink href="/admin" icon="settings" title="Admin" tooltip="Admin Settings" label="Admin settings" active={active === 'admin'} />}
      <NavLink href="/profile" icon="user" title="Profile" tooltip="Your Profile" label="Your profile" active={active === 'profile'} />

      {onLogout && (
        <button className={shell.navItem} onClick={onLogout} aria-label="Log out" title="Logout">
          <Icon name="logout" size={18} />
          <div className={shell.navItemTooltip}>Logout</div>
        </button>
      )}
    </nav>
  );
}
