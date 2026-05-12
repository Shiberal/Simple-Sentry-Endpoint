import { extractLevel } from '@/lib/fingerprint';
import { sendNewIssueAlert } from '@/lib/email';
import { createGitHubIssue, shouldAutoReport, updateGitHubIssue } from '@/lib/github';
import { sendErrorNotification } from '@/lib/telegram';
import { postGenericWebhook, postSlackIncomingWebhook } from '@/lib/webhook-alerts';

function baseUrlFromReq(req) {
  const protocol =
    req.headers['x-forwarded-proto'] || (req.connection.encrypted ? 'https' : 'http');
  const host = req.headers['x-forwarded-host'] || req.headers.host;
  return `${protocol}://${host}`;
}

export async function persistAlertAndIntegrationsAfterError({
  prisma,
  project,
  issue,
  event,
  eventData,
  isNewIssue,
  wasRegression,
  req
}) {
  const baseUrl = baseUrlFromReq(req);

  if (isNewIssue && project.telegramChatId && issue.status !== 'IGNORED') {
    try {
      await sendErrorNotification(issue, event, project);
    } catch (e) {
      console.warn('Telegram:', e.message);
    }
  }

  if (isNewIssue && project.autoGithubReport && issue.status !== 'IGNORED') {
    const filters = project.autoGithubReportFilters;
    if (shouldAutoReport({ issue, eventData, filters })) {
      const gh = await createGitHubIssue({
        issue,
        eventData,
        project,
        baseUrl
      });
      if (gh?.created) {
        await prisma.issue.update({
          where: { id: issue.id },
          data: {
            githubIssueUrl: gh.html_url,
            githubIssueNumber: gh.number
          }
        });
      }
    }
  } else if (
    !isNewIssue &&
    project.autoGithubReport &&
    issue.githubIssueNumber &&
    issue.status !== 'IGNORED'
  ) {
    const filters = project.autoGithubReportFilters;
    if (shouldAutoReport({ issue, eventData, filters })) {
      const timeSinceFirst = Date.now() - new Date(issue.firstSeen).getTime();
      const days = Math.floor(timeSinceFirst / (1000 * 60 * 60 * 24));
      const hours = Math.floor((timeSinceFirst % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const shouldComment =
        issue.count % 10 === 0 ||
        issue.count === 5 ||
        issue.count === 2 ||
        issue.count % 25 === 0;
      const comment = shouldComment
        ? `## Recurred (${issue.count} total)\n\n` +
          `- First: ${new Date(issue.firstSeen).toLocaleString()}\n` +
          `- Last: ${new Date(issue.lastSeen).toLocaleString()}\n` +
          `- Span: ${days}d ${hours}h\n` +
          (eventData.environment ? `- Env: ${eventData.environment}\n` : '') +
          `\n🔗 [Dashboard](${baseUrl}/dashboard)`
        : null;
      await updateGitHubIssue({
        issueNumber: issue.githubIssueNumber,
        project,
        issue,
        comment
      });
    }
  }

  const alertRules = await prisma.alertRule.findMany({
    where: { projectId: project.id, enabled: true }
  });

  const level = extractLevel(eventData);

  for (const rule of alertRules) {
    const condition = rule.condition || {};
    let matchLevel = true;
    if (condition.level && Array.isArray(condition.level)) {
      matchLevel = condition.level.includes(level);
    }

    let matchEnv = true;
    if (condition.environment !== undefined && condition.environment !== '') {
      matchEnv =
        String(eventData.environment || '') === String(condition.environment);
    }

    let matchTrigger = true;
    const t = condition.triggerOn;
    if (t === 'regression') {
      matchTrigger = wasRegression;
    } else if (t === 'new_issue') {
      matchTrigger = isNewIssue;
    } else if (t === 'all') {
      matchTrigger = true;
    } else if (t == null) {
      matchTrigger = isNewIssue;
    }

    if (!matchLevel || !matchEnv || !matchTrigger) continue;

    if (condition.spikeMinEvents != null) {
      const w = condition.spikeWindowMinutes ?? 60;
      const since = new Date(Date.now() - w * 60 * 1000);
      const cnt = await prisma.event.count({
        where: {
          projectId: project.id,
          createdAt: { gte: since },
          eventType: { in: ['ERROR', 'MESSAGE', 'CSP'] }
        }
      });
      if (cnt < condition.spikeMinEvents) continue;
    }

    if (rule.lastTriggered && condition.muteCooldownMinutes != null) {
      const ms = Number(condition.muteCooldownMinutes) * 60 * 1000;
      if (
        Number.isFinite(ms) &&
        ms > 0 &&
        Date.now() - new Date(rule.lastTriggered).getTime() < ms
      ) {
        continue;
      }
    } else if (rule.lastTriggered && !isNewIssue && t !== 'all') {
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
      if (new Date(rule.lastTriggered) > hourAgo) continue;
    }

    let dispatched = false;
    const recipients = (rule.emailRecipients || '')
      .split(',')
      .map((e) => e.trim())
      .filter(Boolean);

    if (recipients.length) {
      await sendNewIssueAlert({ recipients, issue, project, baseUrl });
      dispatched = true;
    }
    if (rule.slackWebhookUrl) {
      const text =
        '[' + project.name + '] ' + issue.title + '\nLevel: ' + level + '\nOpen: ' + baseUrl + '/dashboard';
      try {
        await postSlackIncomingWebhook(rule.slackWebhookUrl, text);
        dispatched = true;
      } catch (e) {
        console.warn('Slack webhook failed:', e.message);
      }
    }
    if (rule.genericWebhookUrl) {
      try {
        await postGenericWebhook(rule.genericWebhookUrl, {
          type: 'issue_notification',
          project: { id: project.id, name: project.name },
          issue,
          isNewIssue,
          wasRegression,
          environment: eventData.environment || null,
          timestamp: new Date().toISOString()
        });
        dispatched = true;
      } catch (e) {
        console.warn('Generic webhook failed:', e.message);
      }
    }

    if (dispatched) {
      await prisma.alertRule.update({
        where: { id: rule.id },
        data: { lastTriggered: new Date() }
      });
    }
  }
}
