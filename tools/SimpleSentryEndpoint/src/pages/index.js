import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import BrandMark from '@/components/BrandMark';
import ThemeToggle from '@/components/ThemeToggle';
import styles from '@/styles/Landing.module.css';

function IconPulse() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M4 12h3l2-6 4 12 2-6h5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconLayers() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M12 3 3 7.5l9 4.5 9-4.5L12 3Zm0 9L3 7.5M12 12l9-4.5M12 12v9l9-4.5M12 12 3 7.5M12 21v-9"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconApi() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M8 9h8M8 12h5M8 15h8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
      <rect
        x="3"
        y="5"
        width="18"
        height="14"
        rx="2"
        stroke="currentColor"
        strokeWidth="1.75"
      />
    </svg>
  );
}

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
        <title>Sentry Monitor — Error tracking</title>
        <meta name="description" content="Monitor and track application errors in one calm workspace." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <div className={styles.page}>
        <header className={styles.topBar}>
          <div className={styles.brand}>
            <BrandMark className={styles.brandMark} size={26} />
            <span>Sentry Monitor</span>
          </div>
          <div className={styles.topActions}>
            <Link href="/login" className={styles.signInLink}>
              Sign in
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <main className={styles.main} id="main">
          <section className={styles.hero} aria-labelledby="landing-heading">
            <div className={styles.heroCopy}>
              <p className={styles.kicker}>Observability</p>
              <h1 id="landing-heading" className={styles.title}>
                Errors surface fast. Context stays intact.
              </h1>
              <p className={styles.lede}>
                Stream events from your stack, triage issues with your team, and keep production noise
                readable — without another cluttered dashboard.
              </p>
              <div className={styles.ctaRow}>
                <Link href="/register" className={styles.primaryCta}>
                  Create your account
                </Link>
                <Link href="/login" className={styles.secondaryCta}>
                  Sign in
                </Link>
              </div>
              <p className={styles.metaNote}>
                HTTP-friendly ingestion, project-scoped keys, and a workspace tuned for review — not
                decoration.
              </p>
            </div>

            <aside className={styles.heroAside} aria-label="At a glance">
              <h2 className={styles.asideTitle}>At a glance</h2>
              <ul className={styles.asideList}>
                <li className={styles.asideItem}>
                  <span className={styles.asideIcon}>
                    <IconPulse />
                  </span>
                  <div>
                    <p className={styles.asideItemTitle}>Live stream</p>
                    <p className={styles.asideItemText}>
                      Watch issues arrive as your users hit them, with filters that stay out of your way.
                    </p>
                  </div>
                </li>
                <li className={styles.asideItem}>
                  <span className={styles.asideIcon}>
                    <IconLayers />
                  </span>
                  <div>
                    <p className={styles.asideItemTitle}>Projects &amp; teams</p>
                    <p className={styles.asideItemText}>
                      Separate environments and collaborators without juggling spreadsheets of keys.
                    </p>
                  </div>
                </li>
                <li className={styles.asideItem}>
                  <span className={styles.asideIcon}>
                    <IconApi />
                  </span>
                  <div>
                    <p className={styles.asideItemTitle}>Simple API</p>
                    <p className={styles.asideItemText}>
                      POST envelopes from any runtime; spend less time wiring SDKs and more time fixing.
                    </p>
                  </div>
                </li>
              </ul>
            </aside>
          </section>

          <section className={styles.featuresSection} aria-labelledby="features-heading">
            <h2 id="features-heading" className={styles.sectionHeading}>
              Capabilities
            </h2>
            <div className={styles.features}>
            <article className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <IconPulse />
              </div>
              <h3 className={styles.featureTitle}>Real-time monitoring</h3>
              <p className={styles.featureText}>
                Track errors and events as they happen with automatic refresh tuned for triage sessions.
              </p>
            </article>
            <article className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <IconLayers />
              </div>
              <h3 className={styles.featureTitle}>Project organization</h3>
              <p className={styles.featureText}>
                Multiple projects, unique keys, and a sidebar that keeps navigation shallow and obvious.
              </p>
            </article>
            <article className={styles.featureCard}>
              <div className={styles.featureIcon}>
                <IconApi />
              </div>
              <h3 className={styles.featureTitle}>Easy integration</h3>
              <p className={styles.featureText}>
                A straightforward HTTP API so you can instrument services in the language you already use.
              </p>
            </article>
            </div>
          </section>
        </main>

        <footer className={styles.footer}>
          <p>Sentry Monitor — error tracking for teams who prefer clarity over chrome.</p>
        </footer>
      </div>
    </>
  );
}
