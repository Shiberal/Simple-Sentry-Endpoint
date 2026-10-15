import Head from 'next/head';
import { ThemeProvider } from '@/contexts/ThemeContext';
import '@/styles/globals.css';

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <Head>
        <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
        <title>EDT</title>
      </Head>
      <Component {...pageProps} />
    </ThemeProvider>
  );
}
