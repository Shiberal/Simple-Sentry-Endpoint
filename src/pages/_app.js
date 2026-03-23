import "@/styles/globals.css";
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ErrorBoundary } from '@/components/ErrorBoundary';

export default function App({ Component, pageProps }) {
  return (
    <ThemeProvider>
      <a
        href="#main-content"
        style={{
          position: 'absolute',
          left: '-9999px',
          zIndex: 99999,
          padding: 'var(--space-2) var(--space-3)',
          background: 'var(--accent-primary)',
          color: '#fff',
          borderRadius: 'var(--radius-sm)',
        }}
        onFocus={(e) => {
          e.target.style.left = 'var(--space-2)';
          e.target.style.top = 'var(--space-2)';
        }}
        onBlur={(e) => {
          e.target.style.left = '-9999px';
          e.target.style.top = 'auto';
        }}
      >
        Skip to main content
      </a>
      <ErrorBoundary>
        <Component {...pageProps} />
      </ErrorBoundary>
    </ThemeProvider>
  );
}
