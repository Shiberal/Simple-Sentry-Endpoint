import crypto from 'crypto';
import prisma from '@/lib/prisma';
import { parse } from 'cookie';
import { getBotUsername, pollLinkKeys, sendTelegramMessage } from '@/lib/telegram';

const KEY_TTL_MS = 15 * 60 * 1000;
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

function getUser(req) {
  try {
    const session = parse(req.headers.cookie || '').session;
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

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

/**
 * GET  /api/projects/:id/telegram           connection status (also checks the bot inbox for a pending key)
 * POST /api/projects/:id/telegram {action}  start | disconnect | test
 */
export default async function handler(req, res) {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  const id = parseInt(req.query.id, 10);
  if (isNaN(id)) return res.status(400).json({ error: 'Bad project id' });

  try {
    const owned = await prisma.project.findFirst({ where: { id, projectOwners: { some: { id: user.userId } } }, select: { id: true } });
    if (!owned) return res.status(403).json({ error: 'Only project owners can change Telegram settings' });

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
      pollError: pollError || null
    });
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: e.message });
  }
}
