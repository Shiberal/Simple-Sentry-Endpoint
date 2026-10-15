import { useEffect } from 'react';
import Head from 'next/head';

const TARGET =
  process.env.NEXT_PUBLIC_MONITOR_RUNTIME_URL ||
  process.env.MONITOR_RUNTIME_URL ||
  'http://localhost:3001/monitors';

/** Thin EDT entry: send operators to the monitor UI in the shared runtime. */
export default function MonitorEntry() {
  useEffect(() => {
    window.location.replace(TARGET);
  }, []);

  return (
    <>
      <Head>
        <title>Monitor · EDT</title>
      </Head>
      <main style={{ fontFamily: 'system-ui', padding: '2rem', maxWidth: 40 + 'rem' }}>
        <h1>Monitor</h1>
        <p>Opening the monitor runtime…</p>
        <p>
          <a href={TARGET}>{TARGET}</a>
        </p>
      </main>
    </>
  );
}
