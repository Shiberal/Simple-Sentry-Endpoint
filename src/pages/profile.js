import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import styles from '@/styles/Auth.module.css';

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [formData, setFormData] = useState({
    username: '',
    name: ''
  });

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (!data?.user) {
        router.push('/login');
        return;
      }
      setUser(data.user);
      fetchProfile();
    } catch (error) {
      router.push('/login');
    }
  };

  const fetchProfile = async () => {
    try {
      const response = await fetch('/api/users/profile');
      if (!response.ok) {
        throw new Error('Failed to fetch profile');
      }
      const data = await response.json();
      if (data.success) {
        setUser(data.user);
        setFormData({
          username: data.user.username || '',
          name: data.user.name || ''
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setError('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setSaving(true);

    try {
      const response = await fetch('/api/users/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      if (data.success) {
        setUser(data.user);
        setSuccess('Profile updated successfully');
        // Clear success message after 3 seconds
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    document.cookie = 'session=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
    router.push('/login');
  };

  if (loading) {
    return (
      <div className={styles.container}>
        <div style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>Loading...</div>
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>Profile Settings - Sentry Monitor</title>
      </Head>

      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.logo}>
              <span className={styles.logoIcon}>👤</span>
              Profile Settings
            </h1>
          </div>

          {error && (
            <div className={styles.error} style={{ marginBottom: 'var(--space-3)' }}>
              {error}
            </div>
          )}

          {success && (
            <div style={{
              backgroundColor: 'var(--success-bg)',
              color: 'var(--success-text)',
              padding: 'var(--space-3)',
              borderRadius: 'var(--radius-md)',
              fontSize: 'var(--font-sm)',
              border: '1px solid var(--success)',
              marginBottom: 'var(--space-3)'
            }}>
              {success}
            </div>
          )}

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.label}>Email</label>
              <input
                type="email"
                className={styles.input}
                value={user?.email || ''}
                disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}
              />
              <div className={styles.hint}>Email cannot be changed</div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Username</label>
              <input
                type="text"
                className={styles.input}
                value={formData.username}
                onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                placeholder="Enter username"
                pattern="[a-zA-Z0-9_-]+"
                title="Username can only contain letters, numbers, underscores, and hyphens"
              />
              <div className={styles.hint}>
                Username can only contain letters, numbers, underscores, and hyphens. Leave empty to use auto-generated UUID.
              </div>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Display Name</label>
              <input
                type="text"
                className={styles.input}
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Enter your display name"
              />
              <div className={styles.hint}>
                Your display name as it appears to other users
              </div>
            </div>

            <button
              type="submit"
              className={styles.button}
              disabled={saving}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </form>

          <div style={{
            marginTop: 'var(--space-4)',
            paddingTop: 'var(--space-4)',
            borderTop: '1px solid var(--border-primary)',
            display: 'flex',
            flexDirection: 'column',
            gap: 'var(--space-2)'
          }}>
            <Link href="/dashboard" className={styles.link}>
              ← Back to Dashboard
            </Link>
            {user?.isAdmin && (
              <Link href="/admin" className={styles.link}>
                ⚙️ Admin Panel
              </Link>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
