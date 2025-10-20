import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from "next/head";
import Link from 'next/link';

export default function Home() {
  const router = useRouter();

  useEffect(() => {
    checkAuthAndRedirect();
  }, []);

  const checkAuthAndRedirect = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (response.ok) {
        // User is logged in, redirect to dashboard
        router.push('/dashboard');
      }
    } catch (error) {
      // User is not logged in, stay on landing page
    }
  };

  return (
    <>
      <Head>
        <title>Sentry Monitor - Error Tracking</title>
        <meta name="description" content="Monitor and track application errors" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div style={styles.container}>
        <div style={styles.hero}>
          <h1 style={styles.heroTitle}>
            <span style={styles.heroIcon}>⚡</span>
            Sentry Monitor
          </h1>
          <p style={styles.heroSubtitle}>
            Real-time error tracking and monitoring for your applications
          </p>
          <div style={styles.heroButtons}>
            <Link href="/register" style={styles.primaryButton}>
              Get Started
            </Link>
            <Link href="/login" style={styles.secondaryButton}>
              Sign In
            </Link>
          </div>
        </div>

        <div style={styles.features}>
          <div style={styles.feature}>
            <div style={styles.featureIcon}>📊</div>
            <h3 style={styles.featureTitle}>Real-time Monitoring</h3>
            <p style={styles.featureText}>
              Track errors and events as they happen with automatic refresh
            </p>
          </div>
          <div style={styles.feature}>
            <div style={styles.featureIcon}>🎯</div>
            <h3 style={styles.featureTitle}>Project Organization</h3>
            <p style={styles.featureText}>
              Manage multiple projects with unique keys and team collaboration
            </p>
          </div>
          <div style={styles.feature}>
            <div style={styles.featureIcon}>🔌</div>
            <h3 style={styles.featureTitle}>Easy Integration</h3>
            <p style={styles.featureText}>
              Simple HTTP API compatible with any language or framework
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '2rem',
  },
  hero: {
    textAlign: 'center',
    marginBottom: '4rem',
  },
  heroIcon: {
    fontSize: '4rem',
    display: 'block',
    marginBottom: '1rem',
  },
  heroTitle: {
    fontSize: '3.5rem',
    fontWeight: '800',
    color: '#fff',
    marginBottom: '1rem',
    textShadow: '0 4px 6px rgba(0,0,0,0.2)',
  },
  heroSubtitle: {
    fontSize: '1.25rem',
    color: '#f3f4f6',
    marginBottom: '2rem',
  },
  heroButtons: {
    display: 'flex',
    gap: '1rem',
    justifyContent: 'center',
  },
  primaryButton: {
    padding: '1rem 2.5rem',
    backgroundColor: '#fff',
    color: '#667eea',
    textDecoration: 'none',
    borderRadius: '0.5rem',
    fontSize: '1.125rem',
    fontWeight: '600',
    boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
    transition: 'transform 0.2s',
    display: 'inline-block',
  },
  secondaryButton: {
    padding: '1rem 2.5rem',
    backgroundColor: 'transparent',
    color: '#fff',
    textDecoration: 'none',
    border: '2px solid #fff',
    borderRadius: '0.5rem',
    fontSize: '1.125rem',
    fontWeight: '600',
    transition: 'all 0.2s',
    display: 'inline-block',
  },
  features: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
    gap: '2rem',
    maxWidth: '1000px',
    width: '100%',
  },
  feature: {
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    padding: '2rem',
    borderRadius: '1rem',
    textAlign: 'center',
    boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
  },
  featureIcon: {
    fontSize: '3rem',
    marginBottom: '1rem',
  },
  featureTitle: {
    fontSize: '1.25rem',
    fontWeight: '700',
    color: '#1a202c',
    marginBottom: '0.75rem',
  },
  featureText: {
    fontSize: '0.95rem',
    color: '#4a5568',
    lineHeight: 1.6,
  },
};
