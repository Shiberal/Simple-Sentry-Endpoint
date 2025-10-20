import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import styles from '@/styles/Auth.module.css';

export default function Register() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: '', password: '', name: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      // After successful registration, redirect to login
      router.push('/login?registered=true');
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Register - Sentry Monitor</title>
      </Head>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <h1 className={styles.logo}>
              <span className={styles.logoIcon}>⚡</span>
              Sentry Monitor
            </h1>
            <h2 className={styles.title}>Create Account</h2>
            <p className={styles.subtitle}>Start monitoring your applications</p>
          </div>

          <form onSubmit={handleSubmit} className={styles.form}>
            {error && (
              <div className={styles.error}>{error}</div>
            )}

            <div className={styles.formGroup}>
              <label className={styles.label}>Name (Optional)</label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className={styles.input}
                placeholder="Your name"
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Email</label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className={styles.input}
                placeholder="you@example.com"
                required
              />
            </div>

            <div className={styles.formGroup}>
              <label className={styles.label}>Password</label>
              <input
                type="password"
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className={styles.input}
                placeholder="••••••••"
                minLength={6}
                required
              />
              <p className={styles.hint}>Must be at least 6 characters</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                ...styles.button,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
            >
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <div className={styles.footer}>
            <p className={styles.footerText}>
              Already have an account?{' '}
              <Link href="/login" className={styles.link}>
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
