import { useState } from 'react';
import styles from '@/styles/ProjectSettings.module.css';

/** Owner-only: add, promote and remove project members. */
export default function TeamSection({ projectId, projectMembers, refreshMembers, refreshProject }) {
  const [newUsername, setNewUsername] = useState('');
  const [addingUser, setAddingUser] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState([]);
  const [removingUsers, setRemovingUsers] = useState(false);

  const refreshAll = async () => {
    await refreshMembers();
    await refreshProject(); // Refresh project data
  };

  const handleAddUser = async (e) => {
    e.preventDefault();
    if (!newUsername.trim()) return;

    setAddingUser(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: newUsername.trim(), isAdmin: false })
      });

      const data = await response.json();
      if (response.ok) {
        setNewUsername('');
        await refreshAll();
        alert(data.message || 'User added successfully');
      } else {
        alert(data.error || data.message || 'Failed to add user');
      }
    } catch (error) {
      console.error('Error adding user:', error);
      alert('Error adding user');
    } finally {
      setAddingUser(false);
    }
  };

  const handleToggleAdmin = async (userId, currentAdminStatus) => {
    try {
      const response = await fetch(`/api/projects/${projectId}/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: !currentAdminStatus })
      });

      const data = await response.json();
      if (response.ok) {
        await refreshAll();
      } else {
        alert(data.error || data.message || 'Failed to update admin status');
      }
    } catch (error) {
      console.error('Error updating admin status:', error);
      alert('Error updating admin status');
    }
  };

  const handleRemoveUser = async (userId) => {
    if (!confirm('Are you sure you want to remove this user from the project?')) {
      return;
    }

    try {
      const response = await fetch(`/api/projects/${projectId}/users/${userId}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (response.ok) {
        await refreshAll();
        alert('User removed successfully');
      } else {
        alert(data.error || data.message || 'Failed to remove user');
      }
    } catch (error) {
      console.error('Error removing user:', error);
      alert('Error removing user');
    }
  };

  const handleBulkRemoveUsers = async () => {
    if (selectedUsers.length === 0) return;

    if (!confirm(`Are you sure you want to remove ${selectedUsers.length} user(s) from the project?`)) {
      return;
    }

    setRemovingUsers(true);
    try {
      const response = await fetch(`/api/projects/${projectId}/users`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userIds: selectedUsers })
      });

      const data = await response.json();
      if (response.ok) {
        setSelectedUsers([]);
        await refreshAll();
        alert(data.message || 'Users removed successfully');
      } else {
        alert(data.error || data.message || 'Failed to remove users');
      }
    } catch (error) {
      console.error('Error removing users:', error);
      alert('Error removing users');
    } finally {
      setRemovingUsers(false);
    }
  };

  const handleSelectUser = (userId) => {
    setSelectedUsers(prev =>
      prev.includes(userId)
        ? prev.filter(id => id !== userId)
        : [...prev, userId]
    );
  };

  const handleSelectAll = () => {
    if (selectedUsers.length === projectMembers.length) {
      setSelectedUsers([]);
    } else {
      setSelectedUsers(projectMembers.map(m => m.id));
    }
  };

  return (
    <section className={styles.section}>
      <h2 className={styles.sectionTitle}>👥 Team Management</h2>
      <p className={styles.sectionDescription}>
        Add users to this project and manage their admin status. Only project owners can manage team members.
      </p>

      {/* Add User Form */}
      <form onSubmit={handleAddUser} className={styles.form} style={{ marginBottom: 'var(--space-6)' }}>
        <div className={styles.formGroup} style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label className={styles.label}>Add User by Username</label>
            <input
              type="text"
              value={newUsername}
              onChange={(e) => setNewUsername(e.target.value)}
              placeholder="Enter username"
              className={styles.input}
              disabled={addingUser}
            />
          </div>
          <button
            type="submit"
            disabled={addingUser || !newUsername.trim()}
            className={styles.saveButton}
            style={{
              opacity: (addingUser || !newUsername.trim()) ? 0.6 : 1,
              whiteSpace: 'nowrap'
            }}
          >
            {addingUser ? 'Adding...' : 'Add User'}
          </button>
        </div>
      </form>

      {/* Bulk Actions */}
      {projectMembers.length > 0 && (
        <div style={{ 
          display: 'flex', 
          gap: 'var(--space-2)', 
          alignItems: 'center',
          marginBottom: 'var(--space-4)',
          padding: 'var(--space-3)',
          backgroundColor: 'var(--color-surface-secondary, #f5f5f5)',
          borderRadius: 'var(--radius-md, 6px)'
        }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={selectedUsers.length === projectMembers.length && projectMembers.length > 0}
              onChange={handleSelectAll}
              style={{ cursor: 'pointer' }}
            />
            <span>Select All</span>
          </label>
          {selectedUsers.length > 0 && (
            <>
              <span style={{ color: 'var(--color-text-secondary, #666)' }}>
                {selectedUsers.length} selected
              </span>
              <button
                onClick={handleBulkRemoveUsers}
                disabled={removingUsers}
                className={styles.dangerButton}
                style={{
                  marginLeft: 'auto',
                  opacity: removingUsers ? 0.6 : 1,
                  padding: 'var(--space-2) var(--space-3)',
                  fontSize: '0.875rem'
                }}
              >
                {removingUsers ? 'Removing...' : `Remove Selected (${selectedUsers.length})`}
              </button>
            </>
          )}
        </div>
      )}

      {/* Members List */}
      {projectMembers.length === 0 ? (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>No team members yet. Add users to get started.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
          {projectMembers.map(member => (
            <div
              key={member.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 'var(--space-3)',
                padding: 'var(--space-3)',
                border: '1px solid var(--color-border, #e0e0e0)',
                borderRadius: 'var(--radius-md, 6px)',
                backgroundColor: selectedUsers.includes(member.id) 
                  ? 'var(--color-surface-secondary, #f5f5f5)' 
                  : 'transparent'
              }}
            >
              <input
                type="checkbox"
                checked={selectedUsers.includes(member.id)}
                onChange={() => handleSelectUser(member.id)}
                style={{ cursor: 'pointer' }}
              />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500 }}>
                  {member.name || member.email || member.username}
                </div>
                <div style={{ fontSize: '0.875rem', color: 'var(--color-text-secondary, #666)' }}>
                  {member.email} {member.username && `(@${member.username})`}
                </div>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={member.isAdmin}
                  onChange={() => handleToggleAdmin(member.id, member.isAdmin)}
                  style={{ cursor: 'pointer' }}
                />
                <span style={{ fontSize: '0.875rem' }}>Admin</span>
              </label>
              <button
                onClick={() => handleRemoveUser(member.id)}
                className={styles.dangerButton}
                style={{
                  padding: 'var(--space-2) var(--space-3)',
                  fontSize: '0.875rem'
                }}
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
