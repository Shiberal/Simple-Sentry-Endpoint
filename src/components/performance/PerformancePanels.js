const cardStyle = {
  background: 'var(--bg-primary)',
  borderRadius: 'var(--radius-md)',
  border: '1px solid var(--border-primary)',
  boxShadow: 'var(--shadow-sm)'
};

/** Bordered card, optionally with an h2 title. */
export function Panel({ title, padding = 'var(--space-4)', marginBottom, children }) {
  return (
    <div style={{ ...cardStyle, padding, ...(marginBottom ? { marginBottom } : {}) }}>
      {title && <h2 style={{ marginTop: 0, color: 'var(--text-primary)', fontSize: 'var(--font-lg)' }}>{title}</h2>}
      {children}
    </div>
  );
}

/** Small metric tile: label, big coloured value and an optional footnote. */
export function StatCard({ title, value, color, valueSize = 'var(--font-2xl)', note }) {
  return (
    <div style={{ ...cardStyle, padding: 'var(--space-4)' }}>
      <h3 style={{ margin: '0 0 var(--space-2) 0', fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>{title}</h3>
      <p style={{ margin: 0, fontSize: valueSize, fontWeight: 'var(--weight-bold)', color }}>{value}</p>
      {note && <p style={{ margin: 'var(--space-1) 0 0 0', fontSize: 'var(--font-xs)', color: 'var(--text-tertiary)' }}>{note}</p>}
    </div>
  );
}

/** Auto-fitting grid of stat tiles. */
export function StatGrid({ minWidth, gap = '20px', marginBottom, children }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(${minWidth}px, 1fr))`,
      gap,
      ...(marginBottom ? { marginBottom } : {})
    }}>
      {children}
    </div>
  );
}

/** Centered message box used when there is nothing to chart yet. */
export function EmptyPanel({ title, hint }) {
  return (
    <div style={{ ...cardStyle, padding: 'var(--space-12)', textAlign: 'center' }}>
      <p style={{ fontSize: 'var(--font-lg)', color: 'var(--text-secondary)' }}>{title}</p>
      <p style={{ color: 'var(--text-tertiary)', marginTop: 'var(--space-2)' }}>{hint}</p>
    </div>
  );
}

const thStyle = { padding: 'var(--space-3)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: 'var(--font-xs)', fontWeight: 'var(--weight-semibold)' };

/** Plain table with the performance page's header/row styling; `rows` is [{ key, cells }]. */
export function DataTable({ columns, rows }) {
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '2px solid var(--border-primary)' }}>
            {columns.map((c) => <th key={c} style={thStyle}>{c}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} style={{ borderBottom: '1px solid var(--border-primary)' }}>
              {row.cells.map((cell, i) => <td key={i} style={{ padding: 'var(--space-3)', color: 'var(--text-primary)', ...cell.style }}>{cell.value}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
