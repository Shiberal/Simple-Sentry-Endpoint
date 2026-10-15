import { useState } from 'react';
import styles from '@/styles/Admin.module.css';

export default function UsersTab({ users, notify, onChanged }) {
  const [userSearch, setUserSearch] = useState('');
  const [editingUser, setEditingUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(null);

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
        notify('User updated successfully', 'success');
        setEditingUser(null);
        onChanged();
      } else {
        notify(data.error || 'Failed to update user', 'error');
      }
    } catch (error) {
      console.error('Error updating user:', error);
      notify('Error updating user', 'error');
    }
  };

  const handleDeleteUser = async () => {
    try {
      const response = await fetch(`/api/admin/users/${deletingUser.id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (data.success) {
        notify('User deleted successfully', 'success');
        setDeletingUser(null);
        onChanged();
      } else {
        notify(data.error || 'Failed to delete user', 'error');
      }
    } catch (error) {
      console.error('Error deleting user:', error);
      notify('Error deleting user', 'error');
    }
  };

  const filteredUsers = users.filter(u =>
    !userSearch ||
    u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
    (u.name && u.name.toLowerCase().includes(userSearch.toLowerCase()))
  );

  return (
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
                        onClick={() => setEditingUser({ ...u })}
                        className={styles.buttonEdit}
                      >
                        Edit
                      </button>
                      <button
                        onClick={() => setDeletingUser(u)}
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

      {deletingUser && (
        <div className={styles.modalOverlay} onClick={() => setDeletingUser(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2 className={styles.modalTitle}>Delete User</h2>
            <p className={styles.modalText}>
              Are you sure you want to delete user <strong>{deletingUser.email}</strong>? 
              This action cannot be undone.
            </p>
            <div className={styles.modalButtons}>
              <button
                onClick={() => setDeletingUser(null)}
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
    </>
  );
}
