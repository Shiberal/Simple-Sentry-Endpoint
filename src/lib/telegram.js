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
export async function sendTelegramMessage(chatId, message) {
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
        parse_mode: 'Markdown',
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
function escapeMarkdown(text) {
  if (!text) return '';
  return String(text)
    .replace(/\_/g, '\\_')
    .replace(/\*/g, '\\*')
    .replace(/\[/g, '\\[')
    .replace(/\]/g, '\\]')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)')
    .replace(/\~/g, '\\~')
    .replace(/\`/g, '\\`')
    .replace(/\>/g, '\\>')
    .replace(/\#/g, '\\#')
    .replace(/\+/g, '\\+')
    .replace(/\-/g, '\\-')
    .replace(/\=/g, '\\=')
    .replace(/\|/g, '\\|')
    .replace(/\{/g, '\\{')
    .replace(/\}/g, '\\}')
    .replace(/\./g, '\\.')
    .replace(/\!/g, '\\!');
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







