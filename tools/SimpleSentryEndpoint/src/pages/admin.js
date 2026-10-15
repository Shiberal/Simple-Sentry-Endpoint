import { useState } from 'react';
import Icon from '@/components/Icon';
import Head from 'next/head';
import Router from 'next/router';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import AdminPageSkeleton from '@/components/AdminPageSkeleton';
import InsightsTab from '@/components/admin/InsightsTab';
import UsersTab from '@/components/admin/UsersTab';
import ProjectsTab from '@/components/admin/ProjectsTab';
import SystemTab from '@/components/admin/SystemTab';
import MaintenanceTab from '@/components/admin/MaintenanceTab';
import useAdminData from '@/hooks/admin/useAdminData';
import useNotifications from '@/hooks/useNotifications';
import styles from '@/styles/Admin.module.css';

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState('insights');
  const { notifications, showNotification } = useNotifications(5000);
  const { user, users, projects, insights, settings, loading, accessDenied, refresh } = useAdminData({ showNotification });

  const handleLogout = async () => {
    // The session cookie is HttpOnly, so only the server can clear it
    await fetch('/api/auth/logout', { method: 'POST' });
    Router.push('/login');
  };

  if (loading) {
    return (
      <>
        <Head>
          <title>Admin - Sentry Monitor</title>
        </Head>
        <AdminPageSkeleton />
      </>
    );
  }

  if (accessDenied) {
    return (
      <>
        <Head>
          <title>Admin - Sentry Monitor</title>
        </Head>
        <div className={styles.container}>
          <div className={styles.content} style={{ maxWidth: 520, margin: '4rem auto', padding: '0 1rem' }}>
            <h1 className={styles.sectionTitle}>Admin access required</h1>
            <p className={styles.sectionSubtitle}>
              Signed in as {user?.email || 'unknown'}, but this account is not a site admin.
              Project ownership is separate from site admin.
            </p>
            <p className={styles.mutedText} style={{ marginTop: '1rem' }}>
              If nobody has site admin yet, reload this page once — the first signed-in user is promoted automatically.
              Or set <code>ADMIN_EMAIL</code> to your email and restart the server.
            </p>
            <div style={{ marginTop: '1.5rem', display: 'flex', gap: '0.75rem' }}>
              <Link href="/dashboard">
                <button type="button" className={styles.headerButton}>Back to dashboard</button>
              </Link>
              <button type="button" className={styles.headerButton} onClick={() => Router.reload()}>
                Retry
              </button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Admin - Sentry Monitor</title>
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <h1 className={styles.logo}>
              <span className={styles.logoIcon}><Icon name="settings" size={18} strokeWidth={2} /></span>
              Admin Panel
            </h1>
            <div className={styles.headerActions}>
              <span className={styles.userEmail}>{user?.email}</span>
              <Link href="/profile">
                <button className={styles.headerButton}>
                  👤 Profile
                </button>
              </Link>
              <Link href="/dashboard">
                <button className={styles.headerButton}>
                  📊 Dashboard
                </button>
              </Link>
              <ThemeToggle />
              <button onClick={refresh} className={styles.headerButton}>
                Refresh
              </button>
              <button 
                onClick={handleLogout} 
                className={styles.headerButton}
                style={{ backgroundColor: 'var(--error)', color: 'white', borderColor: 'var(--error)' }}
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <aside className={styles.sidebar}>
          <nav className={styles.sidebarNav}>
            <button
              className={`${styles.sidebarItem} ${activeTab === 'insights' ? styles.sidebarItemActive : ''}`}
              onClick={() => setActiveTab('insights')}
            >
              <span className={styles.sidebarItemIcon}><Icon name="activity" size={16} /></span>
              Insights
            </button>
            <button
              className={`${styles.sidebarItem} ${activeTab === 'users' ? styles.sidebarItemActive : ''}`}
              onClick={() => setActiveTab('users')}
            >
              <span className={styles.sidebarItemIcon}>👥</span>
              Users ({users.length})
            </button>
            <button
              className={`${styles.sidebarItem} ${activeTab === 'projects' ? styles.sidebarItemActive : ''}`}
              onClick={() => setActiveTab('projects')}
            >
              <span className={styles.sidebarItemIcon}>📁</span>
              Projects ({projects.length})
            </button>
            <button
              className={`${styles.sidebarItem} ${activeTab === 'system' ? styles.sidebarItemActive : ''}`}
              onClick={() => setActiveTab('system')}
            >
              <span className={styles.sidebarItemIcon}>⚙️</span>
              System Settings
            </button>
            <button
              className={`${styles.sidebarItem} ${activeTab === 'maintenance' ? styles.sidebarItemActive : ''}`}
              onClick={() => setActiveTab('maintenance')}
            >
              <span className={styles.sidebarItemIcon}>🔧</span>
              Maintenance
            </button>
          </nav>
        </aside>

        <main className={styles.main}>
          <div className={styles.content}>
            {activeTab === 'insights' && (
              insights
                ? <InsightsTab insights={insights} onRefresh={refresh} />
                : <p className={styles.mutedText}>Loading insights…</p>
            )}
            {activeTab === 'users' && <UsersTab users={users} notify={showNotification} onChanged={refresh} />}
            {activeTab === 'projects' && (
              <ProjectsTab projects={projects} users={users} notify={showNotification} onChanged={refresh} />
            )}
            {activeTab === 'system' && settings && <SystemTab settings={settings} notify={showNotification} />}
            {activeTab === 'maintenance' && <MaintenanceTab notify={showNotification} onChanged={refresh} />}
          </div>
        </main>

        <div className={styles.notifications}>
          {notifications.map(notif => (
            <div key={notif.id} className={`${styles.notification} ${styles[`notification${notif.type}`]}`}>
              {notif.message}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
