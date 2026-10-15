import { useState } from 'react';
import useMountEffect from '@/hooks/useMountEffect';
import Icon from '@/components/Icon';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Link from 'next/link';
import AuthCardSkeleton from '@/components/AuthCardSkeleton';
import AppNav from '@/components/shared/AppNav';
import shell from '@/styles/AppShell.module.css';
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

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (!data?.user) {
        router.push('/?next=/profile');
        return;
      }
      setUser(data.user);
      fetchProfile();
    } catch (error) {
      router.push('/?next=/profile');
    }
  };

  useMountEffect(checkAuth);

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

  if (loading) {
    return (
      <>
        <Head>
          <title>Profile · EDT</title>
        </Head>
        <div className={shell.container}>
          <AppNav active="profile" isAdmin={user?.isAdmin} user={user} />
          <div className={shell.main}>
            <AuthCardSkeleton />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>Profile · EDT</title>
      </Head>

      <div className={shell.container}>
        <AppNav active="profile" isAdmin={user?.isAdmin} user={user} />

        <div className={shell.main}>
          <header className={shell.header}>
            <div className={shell.headerContent}>
              <h1 className={shell.logo}>
                <span className={shell.logoIcon}><Icon name="user" size={16} strokeWidth={2} /></span>
                Profile
              </h1>
            </div>
          </header>

          <div
            style={{
              flex: 1,
              overflowY: 'auto',
              display: 'flex',
              justifyContent: 'center',
              padding: 'var(--space-6) var(--space-4)',
            }}
          >
        <div className={styles.card} style={{ width: '100%', maxWidth: 480 }}>

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

          {user?.isAdmin && (
            <div
              style={{
                marginTop: 'var(--space-4)',
                paddingTop: 'var(--space-4)',
                borderTop: '1px solid var(--border-primary)',
              }}
            >
              <Link href="/admin" className={styles.link}>
                Admin panel
              </Link>
            </div>
          )}
        </div>
          </div>
        </div>
      </div>
    </>
  );
}
