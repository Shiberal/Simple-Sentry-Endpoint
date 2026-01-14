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
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('users');
  const [editingUser, setEditingUser] = useState(null);
  const [editingProject, setEditingProject] = useState(null);
  const [showDeleteUserConfirm, setShowDeleteUserConfirm] = useState(false);
  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = useState(false);
  const [deletingUser, setDeletingUser] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);
  const [notifications, setNotifications] = useState([]);

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
      if (!response.ok) {
        router.push('/login');
        return;
      }
      const data = await response.json();
      if (!data.user || !data.user.isAdmin) {
        router.push('/dashboard');
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
      const [usersRes, projectsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/projects')
      ]);

      const usersData = await usersRes.json();
      const projectsData = await projectsRes.json();

      if (usersData.success) {
        setUsers(usersData.users);
      }
      if (projectsData.success) {
        setProjects(projectsData.projects);
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

  const handleLogout = () => {
    document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

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

        <div className={styles.main}>
          <div className={styles.tabs}>
            <button
              className={`${styles.tab} ${activeTab === 'users' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('users')}
            >
              👥 Users ({users.length})
            </button>
            <button
              className={`${styles.tab} ${activeTab === 'projects' ? styles.tabActive : ''}`}
              onClick={() => setActiveTab('projects')}
            >
              📁 Projects ({projects.length})
            </button>
          </div>

          <div className={styles.content}>
            {activeTab === 'users' && (
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
                    {users.map(u => (
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {activeTab === 'projects' && (
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
                    {projects.map(p => (
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
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

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
            <div className={styles.modal} onClick={(e) => e.stopPropagation()} style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}>
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
                  Users (select multiple)
                  <select
                    multiple
                    className={styles.input}
                    style={{ minHeight: '100px' }}
                    value={(editingProject.userIds || []).map(id => String(id))}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                      setEditingProject({ ...editingProject, userIds: selected });
                    }}
                  >
                    {users.map(u => (
                      <option key={u.id} value={String(u.id)}>
                        {u.email} {u.name ? `(${u.name})` : ''}
                      </option>
                    ))}
                  </select>
                  <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-xs)' }}>
                    Hold Ctrl/Cmd to select multiple users
                  </small>
                </label>
                <label className={styles.label}>
                  Owners (select multiple)
                  <select
                    multiple
                    className={styles.input}
                    style={{ minHeight: '100px' }}
                    value={(editingProject.ownerIds || []).map(id => String(id))}
                    onChange={(e) => {
                      const selected = Array.from(e.target.selectedOptions, option => parseInt(option.value));
                      setEditingProject({ ...editingProject, ownerIds: selected });
                    }}
                  >
                    {users.map(u => (
                      <option key={u.id} value={String(u.id)}>
                        {u.email} {u.name ? `(${u.name})` : ''}
                      </option>
                    ))}
                  </select>
                  <small style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-xs)' }}>
                    Hold Ctrl/Cmd to select multiple owners
                  </small>
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
