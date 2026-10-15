import { useMemo, useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Icon from '@/components/Icon';
import HubShell from '@/components/HubShell';
import { getTool, toolOpenUrl } from '@/lib/tools';
import styles from '@/styles/Hub.module.css';

export default function WorkspacePage() {
  const router = useRouter();
  const tool = getTool(typeof router.query.tool === 'string' ? router.query.tool : '');
  const [actionId, setActionId] = useState(null);
  const [frameBlocked, setFrameBlocked] = useState(false);

  const activeAction = useMemo(() => {
    if (!tool) return null;
    if (actionId) return tool.actions.find((a) => a.id === actionId) || tool.actions[0];
    return tool.actions[0];
  }, [tool, actionId]);

  const frameSrc = tool && activeAction ? toolOpenUrl(tool, activeAction.path) : '';

  if (!router.isReady) {
    return (
      <HubShell title="…" wide>
        <p className={styles.muted} style={{ padding: '2rem' }}>Loading…</p>
      </HubShell>
    );
  }

  if (!tool) {
    return (
      <HubShell title="Unknown tool">
        <p className={styles.lede}>That tool is not in the EDT catalog.</p>
        <a href="/" className={`${styles.btn} ${styles.btnPrimary}`} style={{ marginTop: '1rem' }}>
          Back to tools
        </a>
      </HubShell>
    );
  }

  return (
    <>
      <Head>
        <title>{tool.name} · EDT</title>
      </Head>
      <HubShell title={tool.name} meta={tool.summary} wide>
        <div className={styles.workspaceBar}>
          <div className={styles.workspaceTabs} role="tablist" aria-label="Views">
            {tool.actions.map((action) => (
              <button
                key={action.id}
                type="button"
                role="tab"
                aria-selected={activeAction?.id === action.id}
                className={`${styles.tab} ${activeAction?.id === action.id ? styles.tabActive : ''}`}
                onClick={() => {
                  setActionId(action.id);
                  setFrameBlocked(false);
                }}
              >
                {action.label}
              </button>
            ))}
          </div>
          <div className={styles.topActions}>
            <a
              href={frameSrc}
              target="_blank"
              rel="noreferrer"
              className={styles.btn}
            >
              Open alone
              <Icon name="link" size={14} />
            </a>
          </div>
        </div>

        <div className={styles.frameWrap}>
          {!frameBlocked ? (
            <iframe
              key={frameSrc}
              className={styles.frame}
              src={frameSrc}
              title={tool.name}
              onError={() => setFrameBlocked(true)}
            />
          ) : (
            <div className={styles.frameFallback}>
              <h2>Open {tool.name} in its own window</h2>
              <p>
                This browser blocked embedding the tool. Use Open alone — same session cookies still apply on that host.
              </p>
              <p className={styles.muted}>{frameSrc}</p>
              <a href={frameSrc} target="_blank" rel="noreferrer" className={`${styles.btn} ${styles.btnPrimary}`}>
                Continue to {tool.shortName}
              </a>
            </div>
          )}
        </div>
      </HubShell>
    </>
  );
}
