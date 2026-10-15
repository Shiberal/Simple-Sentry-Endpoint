import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import Icon from '@/components/Icon';
import styles from '@/styles/EdtLanding.module.css';

/** EDT landing — login here enters Hub; services open from Hub after sign-in. */
export default function Home() {
  const router = useRouter();
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const nextPath =
    typeof router.query.next === 'string' && router.query.next.startsWith('/')
      ? router.query.next
      : '/hub';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        const data = await res.json();
        if (!cancelled && data?.user) {
          router.replace(nextPath === '/' ? '/hub' : nextPath);
          return;
        }
      } catch {
        /* stay on landing */
      } finally {
        if (!cancelled) setChecking(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router, nextPath]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Login failed');
      router.push(nextPath === '/' ? '/hub' : nextPath);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (checking) {
    return (
      <>
        <Head>
          <title>EDT</title>
        </Head>
        <div className={styles.page}>
          <p className={styles.checking}>Loading…</p>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>EDT — sign in</title>
        <meta name="description" content="Sign in to EDT Hub and open Sentry, Monitor, and more." />
      </Head>

      <div className={styles.page}>
        <header className={styles.topBar}>
          <div className={styles.brand}>
            <span className={styles.brandMark}>E</span>
            <span>EDT</span>
          </div>
          <div className={styles.topActions}>
            <Link href="/register" className={styles.textLink}>
              Create account
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className={styles.main}>
          <section className={styles.hero}>
            <h1 className={styles.title}>Tools in one place</h1>
            <p className={styles.lede}>
              Sign in to open the Hub. From there you run Sentry (issues &amp; performance) and Monitor —
              same accounts, same data as Simple Sentry Endpoint.
            </p>
            <ul className={styles.serviceList}>
              <li>
                <Icon name="activity" size={16} />
                <span>Sentry + Performance</span>
              </li>
              <li>
                <Icon name="clock" size={16} />
                <span>Monitor</span>
              </li>
            </ul>
          </section>

          <section className={styles.loginPanel} aria-labelledby="login-heading">
            <h2 id="login-heading" className={styles.loginTitle}>
              Sign in
            </h2>
            <form onSubmit={handleSubmit} className={styles.form}>
              {error ? <p className={styles.error}>{error}</p> : null}
              <label className={styles.label}>
                Email
                <input
                  type="email"
                  className={styles.input}
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  autoComplete="email"
                />
              </label>
              <label className={styles.label}>
                Password
                <input
                  type="password"
                  className={styles.input}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required
                  autoComplete="current-password"
                />
              </label>
              <button type="submit" className={styles.submit} disabled={loading}>
                {loading ? 'Signing in…' : 'Enter Hub'}
              </button>
            </form>
            <p className={styles.footerNote}>
              No account? <Link href="/register">Register</Link>
              {' · '}
              <Link href="/login">Classic login page</Link>
            </p>
          </section>
        </main>
      </div>
    </>
  );
}
