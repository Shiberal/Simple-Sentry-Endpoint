import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import styles from '@/styles/Admin.module.css';

export default function AdminPage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');
  const [editingUser, setEditingUser] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState(false);
  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [userSearch, setUserSearch] = useState('');
  const [projectSearch, setProjectSearch] = useState('');
  const [isMerging, setIsMerging] = useState(false);
  const [isCleaning, setIsCleaning] = useState(false);
  const [userSelectionSearch, setUserSelectionSearch] = useState('');

  useEffect(() => {
    checkAuth();
  }, []);

  const showNotification = (message, type = 'info') => {
    const id = Date.now() + Math.random();
    const notification = { id, message, type };
    setNotifications(prev => [...prev, notification]);
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  };

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (!data?.user || !data.user.isAdmin) {
        if (!data?.user) router.push('/login');
        else router.push('/dashboard');
        return;
      }
      setUser(data.user);
      fetchData();
    } catch (error) {
      router.push('/login');
    }
  };

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, projectsRes, statsRes, settingsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/projects'),
        fetch('/api/admin/stats'),
        fetch('/api/admin/settings')
      ]);

      const usersData = await usersRes.json();
      const projectsData = await projectsRes.json();
      const statsData = await statsRes.json();
      const settingsData = await settingsRes.json();

      if (usersData.success) {
        setUsers(usersData.users);
      }
      if (projectsData.success) {
        setProjects(projectsData.projects);
      }
      if (statsData.success) {
        setStats(statsData.stats);
      }
      if (settingsData.success) {
        setSettings(settingsData.settings);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Error fetching data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleEditUser = (user) => {
    setEditingUser({ ...user });
  };

  const handleSaveUser = async () => {
    try {
      const response = await fetch(`/api/admin/users/${editingUser.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingUser.name,
          email: editingUser.email,
          isAdmin: editingUser.isAdmin
        })
      });

      const data = await response.json();
      if (data.success) {
        showNotification('User updated successfully', 'success');
        setEditingUser(null);
        fetchData();
      } else {
        showNotification(data.error || 'Failed to update user', 'error');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      showNotification('Error updating user', 'error');
    }
  };

  const handleDeleteUser = async () => {
    try {
      const response = await fetch(`/api/admin/users/${deletingUser.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        showNotification('User deleted successfully', 'success');
        setShowDeleteUserConfirm(false);
        setDeletingUser(null);
        fetchData();
      } else {
        showNotification(data.error || 'Failed to delete user', 'error');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      showNotification('Error deleting user', 'error');
    }
  };

  const handleEditProject = (project) => {
    setEditingProject({ 
      ...project,
      userIds: project.users.map(u => u.id),
      ownerIds: project.projectOwners.map(o => o.id)
    });
    setUserSelectionSearch('');
  };

  const handleSaveProject = async () => {
    try {
      const response = await fetch(`/api/admin/projects/${editingProject.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: editingProject.name,
          githubRepo: editingProject.githubRepo,
          githubToken: editingProject.githubToken,
          autoGithubReport: editingProject.autoGithubReport,
          autoGithubReportFilters: editingProject.autoGithubReportFilters,
          telegramChatId: editingProject.telegramChatId,
          userIds: editingProject.userIds,
          ownerIds: editingProject.ownerIds
        })
      });

      const data = await response.json();
      if (data.success) {
        showNotification('Project updated successfully', 'success');
        setEditingProject(null);
        fetchData();
      } else {
        showNotification(data.error || 'Failed to update project', 'error');
      }
    } catch (error) {
      console.error('Error updating project:', error);
      showNotification('Error updating project', 'error');
    }
  };

  const handleDeleteProject = async () => {
    try {
      const response = await fetch(`/api/admin/projects/${deletingProject.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        showNotification('Project deleted successfully', 'success');
        setShowDeleteProjectConfirm(false);
        setDeletingProject(null);
        fetchData();
      } else {
        showNotification(data.error || 'Failed to delete project', 'error');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      showNotification('Error deleting project', 'error');
    }
  };

  const handleMergeDuplicates = async () => {
    if (isMerging) return;
    
    setIsMerging(true);
    try {
      const response = await fetch('/api/admin/merge-duplicates', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        showNotification(`Merged ${data.duplicatesMerged} duplicate issues`, 'success');
        fetchData();
      } else {
        showNotification(data.error || 'Failed to merge duplicates', 'error');
      }
    } catch (error) {
      console.error('Error merging duplicates:', error);
      showNotification('Error merging duplicates', 'error');
    } finally {
      setIsMerging(false);
    }
  };

  const handleCleanup = async () => {
    if (isCleaning) return;
    
    if (!confirm('Are you sure you want to delete events older than 30 days? This action cannot be undone.')) {
      return;
    }
    
    setIsCleaning(true);
    try {
      const response = await fetch('/api/admin/maintenance/cleanup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: 30 })
      });
      
      const data = await response.json();
      
      if (data.success) {
        showNotification(`Deleted ${data.deletedCount} old events`, 'success');
        fetchData();
      } else {
        showNotification(data.error || 'Failed to clean up data', 'error');
      }
    } catch (error) {
      console.error('Error cleaning up data:', error);
      showNotification('Error cleaning up data', 'error');
    } finally {
      setIsCleaning(false);
    }
  };

  const handleSaveSettings = async () => {
    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          allowSelfRegistration: settings.allowSelfRegistration,
          allowProjectCreation: settings.allowProjectCreation
        })
      });

      const data = await response.json();
      if (data.success) {
        showNotification('Settings updated successfully', 'success');
        setSettings(data.settings);
      } else {
        showNotification(data.error || 'Failed to update settings', 'error');
      }
    } catch (error) {
      console.error('Error updating settings:', error);
      showNotification('Error updating settings', 'error');
    }
  };

  const handleLogout = () => {
    document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  const toggleUserSelection = (userId, type) => {
    const field = type === 'user' ? 'userIds' : 'ownerIds';
    const current = editingProject[field] || [];
    const newSelection = current.includes(userId)
      ? current.filter(id => id !== userId)
      : [...current, userId];
    setEditingProject({ ...editingProject, [field]: newSelection });
  };

  const filteredUsers = users.filter(u => 
    !userSearch || 
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase()))
  );

  const filteredProjects = projects.filter(p =>
    !projectSearch ||
    p.name.toLowerCase().includes(projectSearch.toLowerCase()) ||
    p.key.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const filteredUsersForSelection = users.filter(u =>
    !userSelectionSearch ||
    u.email.toLowerCase().includes(userSelectionSearch.toLowerCase()) ||
    (u.name && u.name.toLowerCase().includes(userSelectionSearch.toLowerCase()))
  );

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>Loading...</div>
      </div>
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
              <span className={styles.logoIcon}>⚙️</span>
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
              <button onClick={fetchData} className={styles.headerButton}>
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
              className={`${styles.sidebarItem} ${activeTab === 'overview' ? styles.sidebarItemActive : ''}`}
              onClick={() => setActiveTab('overview')}
            >
              <span className={styles.sidebarItemIcon}>📊</span>
              Overview
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
            {activeTab === 'overview' && stats && (
              <>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>System Overview</h2>
                </div>
                <div className={styles.statsGrid}>
                  <div className={styles.statCard}>
                    <div className={styles.statCardLabel}>Total Users</div>
                    <div className={styles.statCardValue}>{stats.users}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statCardLabel}>Total Projects</div>
                    <div className={styles.statCardValue}>{stats.projects}</div>
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statCardLabel}>Total Events</div>
                    <div className={styles.statCardValue}>{stats.events.toLocaleString()}</div>
                    {stats.recentEvents > 0 && (
                      <div className={styles.statCardSubtext}>+{stats.recentEvents} in last 24h</div>
                    )}
                  </div>
                  <div className={styles.statCard}>
                    <div className={styles.statCardLabel}>Total Issues</div>
                    <div className={styles.statCardValue}>{stats.issues.toLocaleString()}</div>
                    {stats.recentIssues > 0 && (
                      <div className={styles.statCardSubtext}>+{stats.recentIssues} in last 24h</div>
                    )}
                  </div>
                </div>
              </>
            )}

            {activeTab === 'users' && (
              <>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Users</h2>
                </div>
                <input
                  type="text"
                  placeholder="Search users by email or name..."
                  className={styles.searchBar}
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                />
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Admin</th>
                        <th>Projects</th>
                        <th>Owned</th>
                        <th>Issues</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredUsers.length === 0 ? (
                        <tr>
                          <td colSpan="8" className={styles.emptyState}>
                            <div className={styles.emptyStateIcon}>👤</div>
                            <div className={styles.emptyStateText}>No users found</div>
                          </td>
                        </tr>
                      ) : (
                        filteredUsers.map(u => (
                          <tr key={u.id}>
                            <td>{u.email}</td>
                            <td>{u.name || '-'}</td>
                            <td>
                              {u.isAdmin ? (
                                <span className={styles.badgeAdmin}>Admin</span>
                              ) : (
                                <span className={styles.badgeUser}>User</span>
                              )}
                            </td>
                            <td>{u._count?.projects || 0}</td>
                            <td>{u._count?.ownedProjects || 0}</td>
                            <td>{u._count?.assignedIssues || 0}</td>
                            <td>{new Date(u.createdAt).toLocaleDateString()}</td>
                            <td>
                              <div className={styles.actionButtons}>
                                <button
                                  onClick={() => handleEditUser(u)}
                                  className={styles.buttonEdit}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    setDeletingUser(u);
                                    setShowDeleteUserConfirm(true);
                                  }}
                                  className={styles.buttonDelete}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'projects' && (
              <>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Projects</h2>
                </div>
                <input
                  type="text"
                  placeholder="Search projects by name or key..."
                  className={styles.searchBar}
                  value={projectSearch}
                  onChange={(e) => setProjectSearch(e.target.value)}
                />
                <div className={styles.tableContainer}>
                  <table className={styles.table}>
                    <thead>
                      <tr>
                        <th>Name</th>
                        <th>Key</th>
                        <th>Users</th>
                        <th>Owners</th>
                        <th>Events</th>
                        <th>Issues</th>
                        <th>Created</th>
                        <th>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredProjects.length === 0 ? (
                        <tr>
                          <td colSpan="8" className={styles.emptyState}>
                            <div className={styles.emptyStateIcon}>📁</div>
                            <div className={styles.emptyStateText}>No projects found</div>
                          </td>
                        </tr>
                      ) : (
                        filteredProjects.map(p => (
                          <tr key={p.id}>
                            <td>{p.name}</td>
                            <td><code className={styles.code}>{p.key}</code></td>
                            <td>{p.users?.length || 0}</td>
                            <td>{p.projectOwners?.length || 0}</td>
                            <td>{p._count?.events || 0}</td>
                            <td>{p._count?.issues || 0}</td>
                            <td>{new Date(p.createdAt).toLocaleDateString()}</td>
                            <td>
                              <div className={styles.actionButtons}>
                                <button
                                  onClick={() => handleEditProject(p)}
                                  className={styles.buttonEdit}
                                >
                                  Edit
                                </button>
                                <button
                                  onClick={() => {
                                    setDeletingProject(p);
                                    setShowDeleteProjectConfirm(true);
                                  }}
                                  className={styles.buttonDelete}
                                >
                                  Delete
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {activeTab === 'system' && settings && (
              <>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>System Settings</h2>
                </div>
                <div className={styles.settingsForm}>
                  <div className={styles.settingsGroup}>
                    <label className={styles.settingsLabel}>
                      <input
                        type="checkbox"
                        className={styles.settingsCheckbox}
                        checked={settings.allowSelfRegistration}
                        onChange={(e) => setSettings({ ...settings, allowSelfRegistration: e.target.checked })}
                      />
                      <span>Allow Self Registration</span>
                    </label>
                    <div className={styles.settingsDescription}>
                      When enabled, users can create accounts without admin approval.
                    </div>
                  </div>
                  <div className={styles.settingsGroup}>
                    <label className={styles.settingsLabel}>
                      <input
                        type="checkbox"
                        className={styles.settingsCheckbox}
                        checked={settings.allowProjectCreation}
                        onChange={(e) => setSettings({ ...settings, allowProjectCreation: e.target.checked })}
                      />
                      <span>Allow Project Creation</span>
                    </label>
                    <div className={styles.settingsDescription}>
                      When enabled, users can create new projects without admin approval.
                    </div>
                  </div>
                  <div className={styles.modalButtons}>
                    <button
                      onClick={handleSaveSettings}
                      className={styles.modalButtonSubmit}
                    >
                      Save Settings
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'maintenance' && (
              <>
                <div className={styles.sectionHeader}>
                  <h2 className={styles.sectionTitle}>Maintenance Tools</h2>
                </div>
                <div className={styles.controlPanel}>
                  <h3 className={styles.controlPanelTitle}>Data Management</h3>
                  <div className={styles.controlPanelActions}>
                    <button
                      onClick={handleMergeDuplicates}
                      className={styles.controlButton}
                      disabled={isMerging}
                    >
                      Merge Duplicate Issues
                      <div className={styles.controlButtonDescription}>
                        Find and merge issues with identical fingerprints
                      </div>
                    </button>
                    <button
                      onClick={handleCleanup}
                      className={`${styles.controlButton} ${styles.controlButtonDanger}`}
                      disabled={isCleaning}
                    >
                      {isCleaning ? 'Cleaning up...' : 'Clean Up Old Events (30+ days)'}
                      <div className={styles.controlButtonDescription}>
                        Permanently delete events older than 30 days to free up space
                      </div>
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        </main>

        {/* Edit User Modal */}
        {editingUser && (
          <div className={styles.modalOverlay} onClick={() => setEditingUser(null)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Edit User</h2>
              <div className={styles.modalForm}>
                <label className={styles.label}>
                  Email
                  <input
                    type="email"
                    className={styles.input}
                    value={editingUser.email}
                    onChange={(e) => setEditingUser({ ...editingUser, email: e.target.value })}
                  />
                </label>
                <label className={styles.label}>
                  Name
                  <input
                    type="text"
                    className={styles.input}
                    value={editingUser.name || ''}
                    onChange={(e) => setEditingUser({ ...editingUser, name: e.target.value })}
                  />
                </label>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={editingUser.isAdmin}
                    onChange={(e) => setEditingUser({ ...editingUser, isAdmin: e.target.checked })}
                  />
                  <span style={{ marginLeft: '8px' }}>Admin</span>
                </label>
                <div className={styles.modalButtons}>
                  <button
                    onClick={() => setEditingUser(null)}
                    className={styles.modalButtonCancel}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveUser}
                    className={styles.modalButtonSubmit}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Edit Project Modal */}
        {editingProject && (
          <div className={styles.modalOverlay} onClick={() => setEditingProject(null)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px' }}>
              <h2 className={styles.modalTitle}>Edit Project</h2>
              <div className={styles.modalForm}>
                <label className={styles.label}>
                  Name
                  <input
                    type="text"
                    className={styles.input}
                    value={editingProject.name}
                    onChange={(e) => setEditingProject({ ...editingProject, name: e.target.value })}
                  />
                </label>
                <label className={styles.label}>
                  GitHub Repo
                  <input
                    type="text"
                    className={styles.input}
                    value={editingProject.githubRepo || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, githubRepo: e.target.value })}
                    placeholder="owner/repo"
                  />
                </label>
                <label className={styles.label}>
                  Telegram Chat ID
                  <input
                    type="text"
                    className={styles.input}
                    value={editingProject.telegramChatId || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, telegramChatId: e.target.value })}
                  />
                </label>
                <label className={styles.label}>
                  <input
                    type="checkbox"
                    checked={editingProject.autoGithubReport}
                    onChange={(e) => setEditingProject({ ...editingProject, autoGithubReport: e.target.checked })}
                  />
                  <span style={{ marginLeft: '8px' }}>Auto GitHub Report</span>
                </label>
                <label className={styles.label}>
                  Users
                  <input
                    type="text"
                    className={styles.input}
                    placeholder="Search users..."
                    value={userSelectionSearch}
                    onChange={(e) => setUserSelectionSearch(e.target.value)}
                    style={{ marginBottom: '0.5rem' }}
                  />
                  <div className={styles.userSelection}>
                    {filteredUsersForSelection.map(u => (
                      <div
                        key={u.id}
                        className={styles.userSelectionItem}
                        onClick={() => toggleUserSelection(u.id, 'user')}
                      >
                        <input
                          type="checkbox"
                          className={styles.userSelectionCheckbox}
                          checked={(editingProject.userIds || []).includes(u.id)}
                          onChange={() => toggleUserSelection(u.id, 'user')}
                        />
                        <span className={styles.userSelectionLabel}>
                          {u.email} {u.name ? `(${u.name})` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </label>
                <label className={styles.label}>
                  Owners
                  <div className={styles.userSelection}>
                    {filteredUsersForSelection.map(u => (
                      <div
                        key={u.id}
                        className={styles.userSelectionItem}
                        onClick={() => toggleUserSelection(u.id, 'owner')}
                      >
                        <input
                          type="checkbox"
                          className={styles.userSelectionCheckbox}
                          checked={(editingProject.ownerIds || []).includes(u.id)}
                          onChange={() => toggleUserSelection(u.id, 'owner')}
                        />
                        <span className={styles.userSelectionLabel}>
                          {u.email} {u.name ? `(${u.name})` : ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </label>
                <div className={styles.modalButtons}>
                  <button
                    onClick={() => setEditingProject(null)}
                    className={styles.modalButtonCancel}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveProject}
                    className={styles.modalButtonSubmit}
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete User Confirmation */}
        {showDeleteUserConfirm && deletingUser && (
          <div className={styles.modalOverlay} onClick={() => setShowDeleteUserConfirm(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Delete User</h2>
              <p className={styles.modalText}>
                Are you sure you want to delete user <strong>{deletingUser.email}</strong>? 
                This action cannot be undone.
              </p>
              <div className={styles.modalButtons}>
                <button
                  onClick={() => {
                    setShowDeleteUserConfirm(false);
                    setDeletingUser(null);
                  }}
                  className={styles.modalButtonCancel}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteUser}
                  className={styles.modalButtonDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Project Confirmation */}
        {showDeleteProjectConfirm && deletingProject && (
          <div className={styles.modalOverlay} onClick={() => setShowDeleteProjectConfirm(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h2 className={styles.modalTitle}>Delete Project</h2>
              <p className={styles.modalText}>
                Are you sure you want to delete project <strong>{deletingProject.name}</strong>? 
                This will also delete all associated events and issues. This action cannot be undone.
              </p>
              <div className={styles.modalButtons}>
                <button
                  onClick={() => {
                    setShowDeleteProjectConfirm(false);
                    setDeletingProject(null);
                  }}
                  className={styles.modalButtonCancel}
                >
                  Cancel
                </button>
                <button
                  onClick={handleDeleteProject}
                  className={styles.modalButtonDelete}
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Notifications */}
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
