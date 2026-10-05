import { useCallback, useEffect, useState } from 'react';

/** Pair a project with a Telegram chat: show a short key, wait for the bot to receive it, confirm. */
export default function TelegramConnect({ projectId, styles, onChange }) {
  const [st, setSt] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');

  const call = useCallback(async (action) => {
    const res = await fetch(`/api/projects/${projectId}/telegram`, action
      ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) }
      : undefined);
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || 'Request failed');
    setSt(j);
    return j;
  }, [projectId]);

  useEffect(() => { call().catch((e) => setErr(e.message)); }, [call]);

  // While a key is pending, ask the server to check the bot inbox every 3s
  useEffect(() => {
    if (!st?.pending) return undefined;
    const t = setInterval(() => call().then((j) => { if (j.connected) onChange?.(j.chatId); }).catch(() => {}), 3000);
    return () => clearInterval(t);
  }, [st?.pending, call, onChange]);

  const run = async (action, done) => {
    setBusy(true);
    setErr('');
    setNote('');
    try { const j = await call(action); if (done) setNote(done); onChange?.(j.chatId); } catch (e) { setErr(e.message); } finally { setBusy(false); }
  };

  const [dbg, setDbg] = useState(null);
  const [dbgBusy, setDbgBusy] = useState(false);
  const loadDebug = useCallback(async () => {
    setDbgBusy(true);
    try {
      const res = await fetch(`/api/projects/${projectId}/telegram?debug=1`);
      const j = await res.json();
      setDbg(res.ok ? j.debug : { error: j.error || 'Request failed' });
    } catch (e) {
      setDbg({ error: e.message });
    } finally {
      setDbgBusy(false);
    }
  }, [projectId]);

  if (!st) return <p className={styles.helpText}>{err || 'Loading…'}</p>;
  if (!st.configured) return <div className={styles.warningBox}><p>⚠️ <code>TELEGRAM_BOT_TOKEN</code> is not visible to the server process. Set it in the container environment and restart.</p></div>;

  return (
    <div className={styles.formGroup}>
      {st.connected ? (
        <>
          <p><strong>✓ Connected</strong> <span className={styles.helpText}>chat {st.chatId}</span></p>
          <div className={styles.formActions}>
            <button type="button" className={styles.saveButton} disabled={busy} onClick={() => run('test', 'Test message sent. Check Telegram.')}>Send test message</button>
            <button type="button" className={styles.saveButton} disabled={busy} onClick={() => run('disconnect')}>Disconnect</button>
          </div>
        </>
      ) : st.pending ? (
        <>
          <p>Waiting for confirmation… Link key: <code>{st.pending.key}</code></p>
          <ol className={styles.helpText}>
            <li>{st.pending.link ? <a href={st.pending.link} target="_blank" rel="noopener noreferrer" className={styles.link}>Open @{st.bot} in Telegram →</a> : 'Open your bot in Telegram'} and press <strong>Start</strong>.</li>
            <li>For a group: add @{st.bot || 'the bot'} to it, then send <code>/start@{st.bot || 'bot'} {st.pending.key}</code>.</li>
          </ol>
          <p className={styles.helpText}>The key expires in 15 minutes. This page confirms as soon as the bot receives it.</p>
          {st.pollError && <p className={styles.helpText}>⚠️ {st.pollError}</p>}
          <button type="button" className={styles.saveButton} disabled={busy} onClick={() => run('start')}>New key</button>
        </>
      ) : (
        <button type="button" className={styles.saveButton} disabled={busy} onClick={() => run('start')}>Connect Telegram</button>
      )}
      <details onToggle={(e) => { if (e.currentTarget.open && !dbg) loadDebug(); }}>
        <summary className={styles.helpText}>Debug</summary>
        <TelegramDebug dbg={dbg} busy={dbgBusy} st={st} styles={styles} onRefresh={loadDebug} onTest={() => run('test', 'Test message sent. Check Telegram.').then(loadDebug)} onClearWebhook={() => run('clear-webhook', 'Webhook removed.').then(loadDebug)} />
      </details>
      {note && <p className={styles.helpText}>{note}</p>}
      {err && <p className={styles.helpText} role="alert">⚠️ {err}</p>}
    </div>
  );
}

const Check = ({ ok, warn, children }) => <li>{ok ? '✅' : warn ? '⚠️' : '❌'} {children}</li>;

function TelegramDebug({ dbg, busy, st, styles, onRefresh, onTest, onClearWebhook }) {
  if (!dbg) return <p className={styles.helpText}>{busy ? 'Checking…' : 'No data yet.'}</p>;
  if (dbg.error) return <p className={styles.helpText}>⚠️ {dbg.error}</p>;
  const { bot, webhook, chat, recentSends } = dbg;
  return (
    <div>
      <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0' }}>
        <Check ok={st.configured}>Server has <code>TELEGRAM_BOT_TOKEN</code></Check>
        <Check ok={!bot.error}>{bot.error ? `Bot not reachable: ${bot.error}` : <>Bot <strong>@{bot.username}</strong> reachable{bot.canJoinGroups === false ? ' (cannot be added to groups)' : ''}</>}</Check>
        <Check ok={!webhook.url && !webhook.error} warn={!!webhook.url}>
          {webhook.error ? `Webhook check failed: ${webhook.error}` : webhook.url
            ? <>A webhook is set (<code>{webhook.url}</code>), so linking by key cannot receive messages. <button type="button" className={styles.link} onClick={onClearWebhook}>Remove webhook</button></>
            : 'No webhook set (linking by key works)'}
          {webhook.lastError ? ` · last webhook error: ${webhook.lastError}` : ''}
        </Check>
        {st.connected ? (
          <>
            <Check ok={chat && !chat.error}>{chat?.error ? `Linked chat ${st.chatId} not found: ${chat.error}` : chat ? <>Chat <strong>{chat.title || chat.id}</strong> ({chat.type}, id {chat.id})</> : 'Chat not checked'}</Check>
            {chat && !chat.error && <Check ok={chat.canPost} warn={chat.canPost == null}>{chat.botStatus ? `Bot status in chat: ${chat.botStatus}${chat.canPost ? ', can post' : ', cannot post. Make it a member or admin'}` : `Bot membership unknown${chat.error ? `: ${chat.error}` : ''}`}</Check>}
          </>
        ) : <Check warn>No chat linked yet</Check>}
      </ul>
      <div className={styles.formActions}>
        <button type="button" className={styles.saveButton} disabled={busy} onClick={onRefresh}>{busy ? 'Checking…' : 'Re-check'}</button>
        {st.connected && <button type="button" className={styles.saveButton} disabled={busy} onClick={onTest}>Send test message</button>}
      </div>
      <p className={styles.helpText}>Recent deliveries from this server (cleared on restart):</p>
      {recentSends.length ? (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, fontSize: 'var(--font-xs)' }}>
          {recentSends.map((x, i) => <li key={i}>{x.ok ? '✅' : '❌'} {new Date(x.at).toLocaleTimeString()} · {x.ok ? x.preview : x.error}</li>)}
        </ul>
      ) : <p className={styles.helpText}>None yet.</p>}
    </div>
  );
}
