import styles from '@/styles/Dashboard.module.css';

export default function StackTrace({ exception }) {
  if (!exception?.values?.[0]?.stacktrace?.frames) {
    return <pre className={styles.codeBlock}>{JSON.stringify(exception, null, 2)}</pre>;
  }

  const frames = exception.values[0].stacktrace.frames;
  const reversedFrames = frames.slice().reverse();

  return (
    <div className={styles.stackTraceContainer}>
      {reversedFrames.map((frame, idx) => {
        const isLast = idx === reversedFrames.length - 1;
        const indentLevel = idx;

        return (
          <div key={idx} className={styles.stackFrameWrapper}>
            {/* Tree connector lines */}
            <div 
              className={styles.stackFrameTreeLine}
              style={{
                marginLeft: `${indentLevel * 1.5}rem`,
              }}
            >
              <div className={styles.treeConnector}>
                <span className={styles.treeBranch}>{isLast ? '└─' : '├─'}</span>
                <span className={styles.treeArrow}>▶</span>
              </div>
            </div>

            {/* Frame content */}
            <div 
              className={`${styles.stackFrame} ${isLast ? styles.stackFrameLast : ''}`}
              style={{
                marginLeft: `${indentLevel * 1.5 + 2.5}rem`,
              }}
            >
              <div className={styles.stackFrameHeader}>
                <span className={styles.stackFrameFunction}>
                  {frame.function || 'anonymous'}
                </span>
                {frame.filename && (
                  <span className={styles.stackFrameFile}>
                    {frame.filename}:{frame.lineno}
                  </span>
                )}
              </div>
              {frame.context_line && (
                <pre className={styles.stackFrameCode}>{frame.context_line.trim()}</pre>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
