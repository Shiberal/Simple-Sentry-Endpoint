import ThemeToggle from '@/components/ThemeToggle';
import EdtToolRail from '@/components/shared/EdtToolRail';
import styles from '@/styles/Hub.module.css';
import shell from '@/styles/AppShell.module.css';

/** Same left tool switcher as tool pages; status content on the right. */
export default function HubShell({ title = 'Status', meta, children, user, railActive = 'hub' }) {
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
        <div className={styles.content}>{children}</div>
      </div>
    </div>
  );
}
