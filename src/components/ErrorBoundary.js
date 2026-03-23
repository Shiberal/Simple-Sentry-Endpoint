import { Component } from 'react';

export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            minHeight: '40vh',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 'var(--space-6, 1.5rem)',
            color: 'var(--text-primary)',
            background: 'var(--bg-primary)',
            textAlign: 'center',
            gap: 'var(--space-3, 0.75rem)',
          }}
        >
          <h1 style={{ fontSize: 'var(--font-xl, 1.25rem)', fontWeight: 600 }}>
            Something went wrong
          </h1>
          <p style={{ color: 'var(--text-secondary)', maxWidth: '32rem' }}>
            The page hit an unexpected error. Try refreshing. If the problem continues, contact an
            administrator.
          </p>
          <button
            type="button"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              if (typeof window !== 'undefined') window.location.reload();
            }}
            style={{
              marginTop: 'var(--space-2)',
              padding: 'var(--space-2) var(--space-4)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-primary)',
              background: 'var(--accent-primary)',
              color: 'var(--text-on-accent, #fff)',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            Reload page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
