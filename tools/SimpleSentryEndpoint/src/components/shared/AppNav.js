import EdtToolRail from '@/components/shared/EdtToolRail';
import shell from '@/styles/AppShell.module.css';

/**
 * Dual rail: fixed EDT tool switcher (left) + tool-local rail (right).
 * Project pickers and in-tool controls stay in the second column so the
 * tool selector never jumps when you change tools.
 */
export default function AppNav({ active, isAdmin, onLogout, children, user }) {
  return (
    <div className={shell.navStack}>
      <EdtToolRail active={active} isAdmin={isAdmin} onLogout={onLogout} user={user} />

      {children != null ? (
        <nav className={shell.toolRail} aria-label="Within tool">
          {children}
        </nav>
      ) : null}
    </div>
  );
}
