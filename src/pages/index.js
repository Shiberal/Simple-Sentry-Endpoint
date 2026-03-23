import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import styles from '@/styles/Landing.module.css';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        if (!cancelled && data?.user) {
          router.push('/dashboard');
        }
      } catch {
        /* stay on landing */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <>
      <Head>
        <title>Sentry Monitor - Error Tracking</title>
        <meta name="description" content="Monitor and track application errors" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <main id="main-content" className={styles.page}>
        <div className={styles.topBar}>
          <ThemeToggle />
        </div>

        <div className={styles.hero}>
          <h1 className={styles.heroTitle}>
            <span className={styles.heroIcon} aria-hidden>
              ⚡
            </span>
            Sentry Monitor
          </h1>
          <p className={styles.heroSubtitle}>
            Real-time error tracking and monitoring for your applications
          </p>
          <div className={styles.heroButtons}>
            <Link href="/register" className={styles.primaryButton}>
              Get Started
            </Link>
            <Link href="/login" className={styles.secondaryButton}>
              Sign In
            </Link>
          </div>
        </div>

        <div className={styles.features}>
          <div className={styles.feature}>
            <div className={styles.featureIcon} aria-hidden>
              📊
            </div>
            <h2 className={styles.featureTitle}>Real-time Monitoring</h2>
            <p className={styles.featureText}>
              Track errors and events as they happen with automatic refresh
            </p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon} aria-hidden>
              🎯
            </div>
            <h2 className={styles.featureTitle}>Project Organization</h2>
            <p className={styles.featureText}>
              Manage multiple projects with unique keys and team collaboration
            </p>
          </div>
          <div className={styles.feature}>
            <div className={styles.featureIcon} aria-hidden>
              🔌
            </div>
            <h2 className={styles.featureTitle}>Easy Integration</h2>
            <p className={styles.featureText}>
              Simple HTTP API compatible with any language or framework
            </p>
          </div>
        </div>
      </main>
    </>
  );
}
