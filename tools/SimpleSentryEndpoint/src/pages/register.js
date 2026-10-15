import { useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import BrandMark from '@/components/BrandMark';
import styles from '@/styles/Auth.module.css';

export default function Register() {
  const router = useRouter();
  const nextHref =
    typeof router.query.next === 'string' && router.query.next.startsWith('/')
      ? router.query.next
      : '/hub/sentry';
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

      const loginQuery = new URLSearchParams({ registered: 'true', next: nextHref });
      router.push(`/login?${loginQuery.toString()}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <Head>
        <title>Register · EDT</title>
      </Head>
      <div className={styles.container}>
        <div className={styles.card}>
          <div className={styles.header}>
            <Link href="/" className={styles.logo}>
              <BrandMark className={styles.logoMark} size={24} />
              EDT
            </Link>
            <h1 className={styles.title}>Create your account</h1>
            <p className={styles.subtitle}>Set up a workspace and start ingesting events in minutes.</p>
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

            <button type="submit" disabled={loading} className={styles.button}>
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className={styles.footer}>
            <p className={styles.footerText}>
              Already have an account?{' '}
              <Link
                href={
                  nextHref === '/hub/sentry'
                    ? '/login'
                    : `/login?next=${encodeURIComponent(nextHref)}`
                }
                className={styles.link}
              >
                Sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
