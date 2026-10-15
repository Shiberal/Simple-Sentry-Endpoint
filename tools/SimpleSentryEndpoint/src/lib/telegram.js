/**
 * Telegram notification helper
 * Sends error notifications to Telegram channels/chats
 */

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Send a message to a Telegram chat
 * @param {string} chatId - Telegram chat/channel ID
 * @param {string} message - Message text (supports Markdown)
 * @returns {Promise<Object>} Response from Telegram API
 */
async function sendRaw(chatId, message, { parseMode = 'Markdown' } = {}) {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn('TELEGRAM_BOT_TOKEN not configured. Skipping Telegram notification.');
    return { success: false, error: 'TELEGRAM_BOT_TOKEN not configured' };
  }

  if (!chatId) {
    console.warn('No Telegram chat ID provided. Skipping notification.');
    return { success: false, error: 'No chat ID provided' };
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        ...(parseMode ? { parse_mode: parseMode } : {}),
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();

    if (!response.ok || !data.ok) {
      console.error('Telegram API error:', data);
      return {
        success: false,
        error: data.description || 'Failed to send Telegram message',
      };
    }

    return { success: true, data };
  } catch (error) {
    console.error('Error sending Telegram message:', error);
    return {
      success: false,
      error: error.message || 'Failed to send Telegram message',
    };
  }
}

/**
 * Format an error notification for Telegram
 * @param {Object} issue - Issue object
 * @param {Object} event - Event object
 * @param {Object} project - Project object
 * @returns {string} Formatted message
 */
export function formatErrorNotification(issue, event, project) {
  const data = event.data || {};
  const level = issue.level || 'error';
  const emoji = level === 'error' ? '🔴' : level === 'warning' ? '🟡' : '🔵';
  
  let message = `${emoji} *${level.toUpperCase()}* in *${project.name}*\n\n`;
  message += `*${escapeMarkdown(issue.title)}*\n\n`;
  
  if (issue.culprit) {
    message += `📍 \`${escapeMarkdown(issue.culprit)}\`\n`;
  }
  
  if (data.exception && data.exception.values && data.exception.values[0]) {
    const exc = data.exception.values[0];
    if (exc.type) {
      message += `🐛 ${escapeMarkdown(exc.type)}\n`;
    }
    if (exc.value) {
      message += `💬 ${escapeMarkdown(exc.value.substring(0, 200))}\n`;
    }
  }
  
  if (data.environment) {
    message += `🌍 Environment: \`${escapeMarkdown(data.environment)}\`\n`;
  }
  
  if (data.release) {
    message += `📦 Release: \`${escapeMarkdown(data.release)}\`\n`;
  }
  
  if (data.user) {
    if (data.user.email) {
      message += `👤 User: ${escapeMarkdown(data.user.email)}\n`;
    } else if (data.user.id) {
      message += `👤 User ID: ${escapeMarkdown(String(data.user.id))}\n`;
    }
  }
  
  message += `\n📊 Occurrences: ${issue.count}\n`;
  message += `⏰ Last seen: ${new Date(issue.lastSeen).toLocaleString()}\n`;
  
  // Note: Telegram doesn't support clickable links in markdown mode with square brackets
  // We'll just add the URL as plain text
  message += `\n🔗 View issue: [Link to Dashboard]\n`;
  
  return message;
}

/**
 * Format a CSP violation notification for Telegram
 * @param {Object} issue - Issue object
 * @param {Object} event - Event object
 * @param {Object} project - Project object
 * @returns {string} Formatted message
 */
export function formatCSPNotification(issue, event, project) {
  let message = `🛡️ *CSP VIOLATION* in *${project.name}*\n\n`;
  message += `*${escapeMarkdown(issue.title)}*\n\n`;
  
  if (issue.violatedDirective) {
    message += `⚠️ Violated: \`${escapeMarkdown(issue.violatedDirective)}\`\n`;
  }
  
  if (issue.blockedUri) {
    message += `🚫 Blocked URI: \`${escapeMarkdown(issue.blockedUri)}\`\n`;
  }
  
  if (issue.sourceFile) {
    message += `📍 Source: \`${escapeMarkdown(issue.sourceFile)}\`\n`;
  }
  
  message += `\n📊 Occurrences: ${issue.count}\n`;
  message += `⏰ Last seen: ${new Date(issue.lastSeen).toLocaleString()}\n`;
  
  return message;
}

/**
 * Format a crash/minidump notification for Telegram
 * @param {Object} issue - Issue object
 * @param {Object} event - Event object
 * @param {Object} project - Project object
 * @returns {string} Formatted message
 */
export function formatCrashNotification(issue, event, project) {
  let message = `💥 *CRASH DETECTED* in *${project.name}*\n\n`;
  message += `*${escapeMarkdown(issue.title)}*\n\n`;
  
  if (issue.culprit) {
    message += `📍 \`${escapeMarkdown(issue.culprit)}\`\n`;
  }
  
  const data = event.data || {};
  if (data.platform) {
    message += `💻 Platform: \`${escapeMarkdown(data.platform)}\`\n`;
  }
  
  message += `\n📊 Occurrences: ${issue.count}\n`;
  message += `⏰ Last seen: ${new Date(issue.lastSeen).toLocaleString()}\n`;
  
  return message;
}

/**
 * Escape special Markdown characters for Telegram
 * @param {string} text - Text to escape
 * @returns {string} Escaped text
 */
// Telegram MarkdownV2: must escape \ _ * [ ] ( ) ~ ` > # + - = | { } . !
const MARKDOWN_V2_SPECIAL = /([\\_*[\]()~`>#+=|{}.!-])/g;

function escapeMarkdown(text) {
  if (!text) return '';
  return String(text).replace(MARKDOWN_V2_SPECIAL, '\\$1');
}

/**
 * Send error notification to Telegram
 * @param {Object} issue - Issue object
 * @param {Object} event - Event object
 * @param {Object} project - Project object with telegramChatId
 * @returns {Promise<Object>} Result of sending notification
 */
export async function sendErrorNotification(issue, event, project) {
  if (!project.telegramChatId) {
    return { success: false, error: 'No Telegram chat ID configured for project' };
  }

  let message;
  const eventType = event.eventType || 'ERROR';
  
  switch (eventType) {
    case 'CSP':
      message = formatCSPNotification(issue, event, project);
      break;
    case 'MINIDUMP':
      message = formatCrashNotification(issue, event, project);
      break;
    default:
      message = formatErrorNotification(issue, event, project);
  }
  
  return await sendTelegramMessage(project.telegramChatId, message);
}








const API = () => `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

let botUsername = null;
export async function getBotUsername() {
  if (!TELEGRAM_BOT_TOKEN) return null;
  if (!botUsername) {
    const r = await fetch(`${API()}/getMe`).then((x) => x.json()).catch(() => null);
    botUsername = r?.result?.username || null;
  }
  return botUsername;
}

let updateOffset = 0;

/**
 * Pull pending bot messages and return the ones carrying a link key:
 * `/start KEY`, `/link KEY` (also `/start@bot KEY`) or the bare key.
 * Every project's pending key arrives through the same bot, so callers must handle all returned pairs.
 * @returns {Promise<{ keys: Array<{ key: string, chatId: number, chatTitle: string }>, error?: string }>}
 */
export async function pollLinkKeys() {
  if (!TELEGRAM_BOT_TOKEN) return { keys: [], error: 'TELEGRAM_BOT_TOKEN not configured' };
  try {
    const r = await fetch(`${API()}/getUpdates?timeout=0&allowed_updates=${encodeURIComponent('["message"]')}${updateOffset ? `&offset=${updateOffset}` : ''}`).then((x) => x.json());
    if (!r.ok) return { keys: [], error: r.description || 'getUpdates failed' };
    const keys = [];
    for (const u of r.result) {
      updateOffset = Math.max(updateOffset, u.update_id + 1);
      const text = u.message?.text || '';
      const m = text.match(/^\/(?:start|link)(?:@\w+)?\s+(\S+)/i) || text.match(/^(sm_[A-Z0-9]{8})$/);
      if (m) keys.push({ key: m[1], chatId: u.message.chat.id, chatTitle: u.message.chat.title || u.message.chat.first_name || '' });
    }
    return { keys };
  } catch (e) {
    return { keys: [], error: e.message };
  }
}


/** Last deliveries from this server process (newest first), for the debug panel. Lost on restart. */
export const recentSends = [];

export async function sendTelegramMessage(chatId, message, options) {
  const result = await sendRaw(chatId, message, options);
  recentSends.unshift({ at: new Date().toISOString(), chatId: String(chatId ?? ''), ok: !!result.success, error: result.success ? null : result.error, preview: String(message).replace(/\s+/g, ' ').slice(0, 80) });
  recentSends.length = Math.min(recentSends.length, 20);
  return result;
}

/** Raw Bot API call for diagnostics; returns Telegram's JSON, or { ok: false, description } on network errors. */
export async function telegramApi(method, params = {}) {
  if (!TELEGRAM_BOT_TOKEN) return { ok: false, description: 'TELEGRAM_BOT_TOKEN not configured' };
  try {
    const res = await fetch(`${API()}/${method}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(params) });
    return await res.json();
  } catch (e) {
    return { ok: false, description: e.message };
  }
}
