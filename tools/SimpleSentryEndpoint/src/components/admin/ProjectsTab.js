import { useState } from 'react';
import styles from '@/styles/Admin.module.css';

export default function ProjectsTab({ projects, users, notify, onChanged }) {
  const [projectSearch, setProjectSearch] = useState('');
  const [editingProject, setEditingProject] = useState(null);
  const [deletingProject, setDeletingProject] = useState(null);
  const [userSelectionSearch, setUserSelectionSearch] = useState('');

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
        notify('Project updated successfully', 'success');
        setEditingProject(null);
        onChanged();
      } else {
        notify(data.error || 'Failed to update project', 'error');
      }
    } catch (error) {
      console.error('Error updating project:', error);
      notify('Error updating project', 'error');
    }
  };

  const handleDeleteProject = async () => {
    try {
      const response = await fetch(`/api/admin/projects/${deletingProject.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        notify('Project deleted successfully', 'success');
        setDeletingProject(null);
        onChanged();
      } else {
        notify(data.error || 'Failed to delete project', 'error');
      }
    } catch (error) {
      console.error('Error deleting project:', error);
      notify('Error deleting project', 'error');
    }
  };

  const toggleUserSelection = (userId, type) => {
    const field = type === 'user' ? 'userIds' : 'ownerIds';
    const current = editingProject[field] || [];
    const newSelection = current.includes(userId)
      ? current.filter(id => id !== userId)
      : [...current, userId];
    setEditingProject({ ...editingProject, [field]: newSelection });
  };

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

  return (
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
                        onClick={() => setDeletingProject(p)}
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

      {deletingProject && (
        <div className={styles.modalOverlay} onClick={() => setDeletingProject(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Delete Project</h2>
            <p className={styles.modalText}>
              Are you sure you want to delete project <strong>{deletingProject.name}</strong>? 
              This will also delete all associated events and issues. This action cannot be undone.
            </p>
            <div className={styles.modalButtons}>
              <button
                onClick={() => setDeletingProject(null)}
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
    </>
  );
}
