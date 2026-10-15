import { useMemo, useState } from 'react';
import Icon from '@/components/Icon';
import styles from '@/styles/Dashboard.module.css';

function frameFile(frame) {
  return frame.filename || frame.abs_path || frame.module || '';
}

function shortPath(path) {
  if (!path) return 'unknown';
  const parts = String(path).replace(/\\/g, '/').split('/').filter(Boolean);
  if (parts.length <= 2) return parts.join('/') || path;
  return parts.slice(-2).join('/');
}

function frameLocation(frame) {
  const file = frameFile(frame);
  const line = frame.lineno != null ? String(frame.lineno) : null;
  const col = frame.colno != null ? String(frame.colno) : null;
  let loc = shortPath(file);
  if (line) loc += `:${line}`;
  if (col) loc += `:${col}`;
  return { full: [file, line, col].filter(Boolean).join(':'), short: loc, file };
}

function buildContextLines(frame) {
  if (!frame.pre_context?.length && !frame.context_line && !frame.post_context?.length) return [];
  const lines = [];
  const start = (frame.lineno || 0) - (frame.pre_context?.length || 0);
  (frame.pre_context || []).forEach((content, i) => {
    lines.push({ number: start + i, content, isError: false });
  });
  if (frame.context_line != null) {
    lines.push({ number: frame.lineno, content: frame.context_line, isError: true });
  }
  (frame.post_context || []).forEach((content, i) => {
    lines.push({ number: (frame.lineno || 0) + i + 1, content, isError: false });
  });
  return lines;
}

function isInApp(frame) {
  return frame.in_app === true;
}

function FrameRow({ frame, index, expanded, onToggle, isCrash }) {
  const loc = frameLocation(frame);
  const inApp = isInApp(frame);
  const context = buildContextLines(frame);
  const hasContext = context.length > 0;
  const fn = frame.function || frame.module || 'anonymous';

  return (
    <div
      className={[
        styles.stackFrame,
        isCrash ? styles.stackFrameCrash : '',
        inApp ? styles.stackFrameInApp : styles.stackFrameLibrary,
        expanded ? styles.stackFrameExpanded : '',
      ].filter(Boolean).join(' ')}
    >
      <button
        type="button"
        className={styles.stackFrameHeader}
        onClick={() => onToggle(index)}
        aria-expanded={expanded}
      >
        <span className={styles.stackFrameIndex} aria-hidden="true">{index + 1}</span>
        <span className={styles.stackFrameMeta}>
          <span className={styles.stackFrameFunction}>{fn}</span>
          <span className={styles.stackFrameFile} title={loc.full}>{loc.short}</span>
        </span>
        <span className={styles.stackFrameBadges}>
          {isCrash && <span className={styles.stackBadgeCrash}>crash</span>}
          {inApp ? (
            <span className={styles.stackBadgeApp}>app</span>
          ) : (
            <span className={styles.stackBadgeLib}>lib</span>
          )}
          <Icon name={expanded ? 'chevronDown' : 'chevronRight'} size={14} strokeWidth={2} />
        </span>
      </button>

      {expanded && (
        <div className={styles.stackFrameBody}>
          {loc.file && (
            <div className={styles.stackFramePath} title={loc.full}>{loc.full}</div>
          )}
          {hasContext ? (
            <div className={styles.codeSnippet}>
              <div className={styles.codeSnippetScroll}>
                {context.map((line) => (
                  <div
                    key={`${line.number}-${line.isError ? 'e' : 'n'}`}
                    className={`${styles.snippetLine} ${line.isError ? styles.snippetLineError : ''}`}
                  >
                    <span className={styles.snippetLineNumber}>{line.number ?? '·'}</span>
                    <span className={styles.snippetLineContent}>{line.content ?? ''}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className={styles.stackFrameEmpty}>No source context for this frame.</p>
          )}
          {(frame.vars && Object.keys(frame.vars).length > 0) && (
            <details className={styles.stackFrameVars}>
              <summary>Local variables</summary>
              <pre className={styles.codeBlock}>{JSON.stringify(frame.vars, null, 2)}</pre>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

function ExceptionBlock({ value, defaultExpanded }) {
  const frames = useMemo(
    () => (value?.stacktrace?.frames ? value.stacktrace.frames.slice().reverse() : []),
    [value]
  );
  const appCount = frames.filter(isInApp).length;
  const hasMixed = appCount > 0 && appCount < frames.length;
  const [appOnly, setAppOnly] = useState(hasMixed);
  const visible = appOnly ? frames.filter(isInApp) : frames;

  const crashKey = useMemo(() => {
    const crash = frames.find((f) => isInApp(f) && (f.context_line || f.pre_context || f.post_context))
      || frames.find((f) => f.context_line || f.pre_context || f.post_context)
      || frames[0];
    return crash ? frames.indexOf(crash) : 0;
  }, [frames]);

  const [expanded, setExpanded] = useState(() => new Set(defaultExpanded ? [crashKey] : []));

  const toggle = (indexInVisible) => {
    const frame = visible[indexInVisible];
    const realIndex = frames.indexOf(frame);
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(realIndex)) next.delete(realIndex);
      else next.add(realIndex);
      return next;
    });
  };

  if (!value) return null;

  return (
    <section className={styles.stackException}>
      <header className={styles.stackExceptionHead}>
        <div>
          <div className={styles.exceptionType}>{value.type || 'Exception'}</div>
          {value.value != null && value.value !== '' && (
            <div className={styles.stackExceptionValue}>{String(value.value)}</div>
          )}
        </div>
        {frames.length > 0 && (
          <div className={styles.stackToolbar}>
            <span className={styles.stackCount}>
              {visible.length} frame{visible.length === 1 ? '' : 's'}
              {hasMixed ? ` · ${appCount} in app` : ''}
            </span>
            {hasMixed && (
              <button
                type="button"
                className={`${styles.prettifyButton} ${appOnly ? styles.stackFilterOn : ''}`}
                onClick={() => setAppOnly((v) => !v)}
                aria-pressed={appOnly}
              >
                {appOnly ? 'Show all' : 'App only'}
              </button>
            )}
          </div>
        )}
      </header>

      {frames.length === 0 ? (
        <pre className={styles.codeBlock}>{JSON.stringify(value, null, 2)}</pre>
      ) : (
        <div className={styles.stackFrameList}>
          {visible.map((frame, idx) => {
            const realIndex = frames.indexOf(frame);
            return (
              <FrameRow
                key={`${realIndex}-${frame.filename || ''}-${frame.lineno || ''}-${frame.function || ''}`}
                frame={frame}
                index={idx}
                expanded={expanded.has(realIndex)}
                onToggle={toggle}
                isCrash={realIndex === crashKey}
              />
            );
          })}
        </div>
      )}
    </section>
  );
}

export default function StackTrace({ exception }) {
  const values = exception?.values?.filter(Boolean) || [];

  if (!values.length) {
    return <pre className={styles.codeBlock}>{JSON.stringify(exception, null, 2)}</pre>;
  }

  return (
    <div className={styles.stackTraceContainer}>
      {values.map((value, i) => (
        <ExceptionBlock
          key={`${value.type || 'exc'}-${i}`}
          value={value}
          defaultExpanded={i === 0}
        />
      ))}
    </div>
  );
}
