import { prettifyContent } from '@/lib/event-display';
import styles from '@/styles/Dashboard.module.css';

/** Exception (with code snippet) or plain message, each with a prettify toggle. */
export default function ExceptionSection({
  data, copyToClipboard, prettifiedError, setPrettifiedError, prettifiedMessage, setPrettifiedMessage,
  copiedError, setCopiedError, copiedCode, setCopiedCode,
}) {
  return (
    <>
      {data.exception ? (
        <div className={styles.detailSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <h4 className={styles.detailSectionTitle}>Exception</h4>
            <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
              <button
                className={styles.prettifyButton}
                onClick={() => {
                  const errorText = prettifiedError 
                    ? prettifyContent(data.exception.values?.[0]?.value || 'No message')
                    : (data.exception.values?.[0]?.value || 'No message');
                  copyToClipboard(errorText, setCopiedError);
                }}
                title={copiedError ? 'Copied!' : 'Copy error'}
                style={{ 
                  opacity: copiedError ? 0.7 : 1,
                  transition: 'opacity 0.2s'
                }}
              >
                {copiedError ? 'Copied' : 'Copy'}
              </button>
              <button
                className={styles.prettifyButton}
                onClick={() => setPrettifiedError(!prettifiedError)}
                title={prettifiedError ? 'Show original' : 'Prettify'}
              >
                {prettifiedError ? 'Original' : 'Prettify'}
              </button>
            </div>
          </div>
          <div className={styles.exceptionBox}>
            <div className={styles.exceptionType}>
              {data.exception.values?.[0]?.type || 'Exception'}
            </div>
            <div className={styles.exceptionValue} style={prettifiedError ? { whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px' } : {}}>
              {prettifiedError 
                ? prettifyContent(data.exception.values?.[0]?.value || 'No message')
                : (data.exception.values?.[0]?.value || 'No message')
              }
            </div>
          </div>

          {/* Error Snippet */}
          {(() => {
            const frames = data.exception.values?.[0]?.stacktrace?.frames;
            if (!frames || frames.length === 0) return null;

            // Find the last frame (the one that triggered the error)
            const errorFrame = frames[frames.length - 1];

            // Check if we have context lines
            const hasContext = errorFrame.pre_context || errorFrame.context_line || errorFrame.post_context;
            if (!hasContext) return null;

            // Build the snippet with line numbers
            const lines = [];
            const startLine = errorFrame.lineno - (errorFrame.pre_context?.length || 0);

            // Add pre-context lines
            if (errorFrame.pre_context) {
              errorFrame.pre_context.forEach((line, idx) => {
                lines.push({
                  number: startLine + idx,
                  content: line,
                  isError: false
                });
              });
            }

            // Add the error line
            if (errorFrame.context_line) {
              lines.push({
                number: errorFrame.lineno,
                content: errorFrame.context_line,
                isError: true
              });
            }

            // Add post-context lines
            if (errorFrame.post_context) {
              errorFrame.post_context.forEach((line, idx) => {
                lines.push({
                  number: errorFrame.lineno + idx + 1,
                  content: line,
                  isError: false
                });
              });
            }

            // Format code snippet for copying
            const formatCodeForCopy = () => {
              let formatted = '';
              if (errorFrame.filename) {
                formatted += `${errorFrame.filename}:${errorFrame.lineno}\n`;
              }
              lines.forEach(line => {
                formatted += `${line.number}: ${line.content}\n`;
              });
              return formatted.trim();
            };

            return (
              <div style={{ marginTop: 'var(--space-3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
                  <h4 className={styles.detailSectionTitle}>Code Snippet</h4>
                  <button
                    className={styles.prettifyButton}
                    onClick={() => copyToClipboard(formatCodeForCopy(), setCopiedCode)}
                    title={copiedCode ? 'Copied!' : 'Copy code'}
                    style={{ 
                      opacity: copiedCode ? 0.7 : 1,
                      transition: 'opacity 0.2s'
                    }}
                  >
                    {copiedCode ? 'Copied' : 'Copy'}
                  </button>
                </div>
                {errorFrame.filename && (
                  <div style={{ 
                    fontSize: '11px', 
                    color: 'var(--text-secondary)', 
                    marginBottom: 'var(--space-2)',
                    fontFamily: 'monospace'
                  }}>
                    {errorFrame.filename}:{errorFrame.lineno}
                  </div>
                )}
                <div className={styles.codeSnippet}>
                  {lines.map((line, idx) => (
                    <div 
                      key={idx} 
                      className={`${styles.snippetLine} ${line.isError ? styles.snippetLineError : ''}`}
                    >
                      <span className={styles.snippetLineNumber}>{line.number}</span>
                      <span className={styles.snippetLineContent}>{line.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>
      ) : data.message ? (
        <div className={styles.detailSection}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
            <h4 className={styles.detailSectionTitle}>Message</h4>
            <button
              className={styles.prettifyButton}
              onClick={() => setPrettifiedMessage(!prettifiedMessage)}
              title={prettifiedMessage ? 'Show original' : 'Prettify'}
            >
              {prettifiedMessage ? 'Original' : 'Prettify'}
            </button>
          </div>
          <div className={styles.exceptionBox} style={{ backgroundColor: 'var(--success-bg)', borderColor: 'var(--success)' }}>
            <div className={styles.exceptionValue} style={{ 
              color: 'var(--text-primary)',
              ...(prettifiedMessage ? { whiteSpace: 'pre-wrap', fontFamily: 'monospace', fontSize: '12px' } : {})
            }}>
              {prettifiedMessage 
                ? prettifyContent(data.message)
                : data.message
              }
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
