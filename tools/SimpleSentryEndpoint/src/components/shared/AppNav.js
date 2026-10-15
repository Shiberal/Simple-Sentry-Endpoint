import Link from 'next/link';
import Icon from '@/components/Icon';
import shell from '@/styles/AppShell.module.css';

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
 * Tool-local rail for Simple Sentry pages.
 * Cross-tool switching lives in Hub — here: Hub escape, project picker, account.
 */
export default function AppNav({ active, isAdmin, onLogout, children, user }) {
  const initial = (user?.username || user?.email || '').charAt(0).toUpperCase();

  return (
    <nav className={shell.navSidebar} aria-label="Primary">
      <Link href="/hub" className={shell.navBrand} title="EDT Hub" aria-label="EDT Hub">
        E
      </Link>

      <NavLink
        href="/hub"
        icon="apps"
        title="Hub"
        tooltip="Hub"
        label="Back to Hub"
        active={active === 'hub'}
      />

      {children != null && (
        <>
          <div className={shell.navDivider} />
          {children}
        </>
      )}

      <div className={shell.navSpacer} />

      <div className={shell.navDivider} />

      {isAdmin && (
        <NavLink
          href="/admin"
          icon="settings"
          title="Admin"
          tooltip="Admin Settings"
          label="Admin settings"
          active={active === 'admin'}
        />
      )}
      <NavLink
        href="/profile"
        icon="user"
        title="Profile"
        tooltip="Your Profile"
        label="Your profile"
        active={active === 'profile'}
      />

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
