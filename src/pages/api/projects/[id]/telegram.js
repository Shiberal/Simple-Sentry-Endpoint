import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { getSessionPayload as getUser } from '@/lib/session';
import { getBotUsername, pollLinkKeys, recentSends, sendTelegramMessage, telegramApi } from '@/lib/telegram';

const KEY_TTL_MS = 15 * 60 * 1000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

const newKey = () => `sm_${Array.from(crypto.randomBytes(8), (b) => ALPHABET[b % ALPHABET.length]).join('')}`;

/** Bind every project whose pending key shows up in the bot's inbox, and confirm in the chat. */
async function claimKeys() {
  const { keys, error } = await pollLinkKeys();
  for (const { key, chatId } of keys) {
    const project = await prisma.project.findFirst({ where: { telegramLinkKey: key, telegramLinkExpires: { gt: new Date() } } });
    if (!project) continue;
    await prisma.project.update({ where: { id: project.id }, data: { telegramChatId: String(chatId), telegramLinkKey: null, telegramLinkExpires: null } });
    await sendTelegramMessage(chatId, `✅ Connected to project "${project.name}". Errors from this project will be posted here.`, { parseMode: null });
  }
  return error;
}

/** What Telegram itself says about the bot, its webhook and the linked chat. */
async function collectDebug(chatId) {
  const me = await telegramApi('getMe');
  const hook = await telegramApi('getWebhookInfo');
  const out = {
    bot: me.ok ? { id: me.result.id, username: me.result.username, canJoinGroups: me.result.can_join_groups, canReadAllGroupMessages: me.result.can_read_all_group_messages } : { error: me.description },
    webhook: hook.ok ? { url: hook.result.url || null, pendingUpdates: hook.result.pending_update_count, lastError: hook.result.last_error_message || null } : { error: hook.description },
    chat: null,
    recentSends: recentSends.filter((x) => !chatId || x.chatId === String(chatId))
  };
  if (chatId && me.ok) {
    const chat = await telegramApi('getChat', { chat_id: chatId });
    const member = await telegramApi('getChatMember', { chat_id: chatId, user_id: me.result.id });
    out.chat = chat.ok
      ? { id: chat.result.id, type: chat.result.type, title: chat.result.title || chat.result.first_name || null, botStatus: member.ok ? member.result.status : null, canPost: member.ok ? (member.result.status === 'creator' || member.result.status === 'administrator' || member.result.status === 'member') && member.result.can_send_messages !== false : null, error: member.ok ? null : member.description }
      : { error: chat.description };
  }
  return out;
}

/**
 * GET  /api/projects/:id/telegram[?debug=1] connection status (also checks the bot inbox for a pending key)
 * POST /api/projects/:id/telegram {action}  start | disconnect | test | clear-webhook
 */
export default async function handler(req, res) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const id = parseInt(req.query.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Bad project id' });

  try {
    const owned = await prisma.project.findFirst({ where: { id, users: { some: { id: user.userId } } }, select: { id: true } });
    if (!owned) return res.status(403).json({ error: 'You do not have access to this project' });

    if (req.method === 'POST') {
      const { action } = req.body || {};
      if (action === 'start') {
        const key = newKey();
        await prisma.project.update({ where: { id }, data: { telegramLinkKey: key, telegramLinkExpires: new Date(Date.now() + KEY_TTL_MS) } });
      } else if (action === 'disconnect') {
        await prisma.project.update({ where: { id }, data: { telegramChatId: null, telegramLinkKey: null, telegramLinkExpires: null } });
      } else if (action === 'test') {
        const p = await prisma.project.findUnique({ where: { id }, select: { name: true, telegramChatId: true } });
        if (!p.telegramChatId) return res.status(400).json({ error: 'Not connected' });
        const r = await sendTelegramMessage(p.telegramChatId, `✅ Test message from project "${p.name}".`, { parseMode: null });
        if (!r.success) return res.status(502).json({ error: r.error });
      } else if (action === 'clear-webhook') {
        const r = await telegramApi('deleteWebhook');
        if (!r.ok) return res.status(502).json({ error: r.description });
      } else {
        return res.status(400).json({ error: 'Unknown action' });
      }
    } else if (req.method !== 'GET') {
      res.setHeader('Allow', ['GET', 'POST']);
      return res.status(405).end();
    }

    const pollError = await claimKeys();
    const p = await prisma.project.findUnique({ where: { id }, select: { telegramChatId: true, telegramLinkKey: true, telegramLinkExpires: true } });
    const pending = p.telegramLinkKey && p.telegramLinkExpires > new Date();
    const bot = await getBotUsername();
    return res.status(200).json({
      success: true,
      configured: !!process.env.TELEGRAM_BOT_TOKEN,
      bot,
      connected: !!p.telegramChatId,
      chatId: p.telegramChatId,
      pending: pending ? { key: p.telegramLinkKey, expiresAt: p.telegramLinkExpires, link: bot ? `https://t.me/${bot}?start=${p.telegramLinkKey}` : null } : null,
      pollError: pollError || null,
      debug: req.query.debug ? await collectDebug(p.telegramChatId) : undefined
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
