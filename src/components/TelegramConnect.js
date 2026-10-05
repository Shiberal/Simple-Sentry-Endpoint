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
      {note && <p className={styles.helpText}>{note}</p>}
      {err && <p className={styles.helpText} role="alert">⚠️ {err}</p>}
    </div>
  );
}
