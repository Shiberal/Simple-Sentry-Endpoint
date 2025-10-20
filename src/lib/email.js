import nodemailer from 'nodemailer';

/**
 * Create email transporter
 */
function createTransporter() {
  // Check if SMTP configuration is available
  const smtpHost = process.env.SMTP_HOST;
  const smtpPort = process.env.SMTP_PORT || 587;
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;

  if (!smtpHost || !smtpUser || !smtpPass) {
    console.warn('SMTP configuration not found. Email alerts will be logged to console.');
    return null;
  }

  return nodemailer.createTransport({
    host: smtpHost,
    port: parseInt(smtpPort),
    secure: smtpPort == 465, // true for 465, false for other ports
    auth: {
      user: smtpUser,
      pass: smtpPass,
    },
  });
}

/**
 * Send email alert for new issue
 * @param {Object} params
 * @param {Array<string>} params.recipients - Email addresses
 * @param {Object} params.issue - Issue data
 * @param {Object} params.project - Project data
 * @param {string} params.baseUrl - Base URL for links
 */
export async function sendNewIssueAlert({ recipients, issue, project, baseUrl = 'http://localhost:3000' }) {
  const transporter = createTransporter();

  const subject = `[${project.name}] New ${issue.level.toUpperCase()}: ${issue.title}`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #1a1a2e; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px; }
        .badge { display: inline-block; padding: 4px 8px; border-radius: 4px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
        .badge-error { background: #dc3545; color: white; }
        .badge-warning { background: #ffc107; color: #000; }
        .badge-info { background: #17a2b8; color: white; }
        .issue-title { font-size: 18px; margin: 10px 0; }
        .button { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin-top: 15px; }
        .footer { margin-top: 20px; font-size: 12px; color: #666; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>🚨 New Issue Detected</h2>
        </div>
        <div class="content">
          <p><strong>Project:</strong> ${project.name}</p>
          <p>
            <span class="badge badge-${issue.level}">${issue.level}</span>
          </p>
          <div class="issue-title">${issue.title}</div>
          ${issue.culprit ? `<p><strong>Location:</strong> ${issue.culprit}</p>` : ''}
          <p><strong>First Seen:</strong> ${new Date(issue.firstSeen).toLocaleString()}</p>
          <a href="${baseUrl}/dashboard?issue=${issue.id}" class="button">View Issue Details</a>
          <div class="footer">
            <p>You're receiving this because you have alert rules configured for this project.</p>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
New ${issue.level.toUpperCase()} Issue Detected

Project: ${project.name}
Level: ${issue.level}
Title: ${issue.title}
${issue.culprit ? `Location: ${issue.culprit}` : ''}
First Seen: ${new Date(issue.firstSeen).toLocaleString()}

View details: ${baseUrl}/dashboard?issue=${issue.id}
  `;

  if (!transporter) {
    console.log('📧 [EMAIL ALERT - Not Configured]');
    console.log('To:', recipients.join(', '));
    console.log('Subject:', subject);
    console.log('Content:', text);
    return { success: true, message: 'Email logged to console (SMTP not configured)' };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: recipients.join(', '),
      subject,
      text,
      html,
    });

    console.log('✅ Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send email alert for issue spike
 * @param {Object} params
 * @param {Array<string>} params.recipients - Email addresses
 * @param {Object} params.issue - Issue data
 * @param {Object} params.project - Project data
 * @param {number} params.recentCount - Number of recent occurrences
 * @param {string} params.baseUrl - Base URL for links
 */
export async function sendIssueSpikeAlert({ recipients, issue, project, recentCount, baseUrl = 'http://localhost:3000' }) {
  const transporter = createTransporter();

  const subject = `[${project.name}] Issue Spike: ${issue.title} (${recentCount} occurrences)`;
  
  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #333; }
        .container { max-width: 600px; margin: 0 auto; padding: 20px; }
        .header { background: #ff6b6b; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
        .content { background: #f5f5f5; padding: 20px; border-radius: 0 0 8px 8px; }
        .stats { background: white; padding: 15px; border-radius: 4px; margin: 15px 0; }
        .button { display: inline-block; padding: 10px 20px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; margin-top: 15px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h2>📈 Issue Spike Detected</h2>
        </div>
        <div class="content">
          <p><strong>Project:</strong> ${project.name}</p>
          <div class="stats">
            <h3>${issue.title}</h3>
            <p><strong>Recent Occurrences:</strong> ${recentCount}</p>
            <p><strong>Total Count:</strong> ${issue.count}</p>
            <p><strong>Last Seen:</strong> ${new Date(issue.lastSeen).toLocaleString()}</p>
          </div>
          <a href="${baseUrl}/dashboard?issue=${issue.id}" class="button">Investigate Now</a>
        </div>
      </div>
    </body>
    </html>
  `;

  const text = `
Issue Spike Detected

Project: ${project.name}
Title: ${issue.title}
Recent Occurrences: ${recentCount}
Total Count: ${issue.count}
Last Seen: ${new Date(issue.lastSeen).toLocaleString()}

View details: ${baseUrl}/dashboard?issue=${issue.id}
  `;

  if (!transporter) {
    console.log('📧 [EMAIL ALERT - Not Configured]');
    console.log('To:', recipients.join(', '));
    console.log('Subject:', subject);
    return { success: true, message: 'Email logged to console (SMTP not configured)' };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: recipients.join(', '),
      subject,
      text,
      html,
    });

    console.log('✅ Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send test email
 * @param {Object} params
 * @param {string} params.recipient - Email address
 * @param {string} params.projectName - Project name
 */
export async function sendTestAlert({ recipient, projectName }) {
  const transporter = createTransporter();

  const subject = `[${projectName}] Test Alert`;
  const text = `This is a test alert from your Sentry Monitor.\n\nIf you received this email, your alert configuration is working correctly!`;
  const html = `
    <!DOCTYPE html>
    <html>
    <body style="font-family: sans-serif; padding: 20px;">
      <h2>✅ Test Alert</h2>
      <p>This is a test alert from your Sentry Monitor.</p>
      <p>If you received this email, your alert configuration is working correctly!</p>
      <p><strong>Project:</strong> ${projectName}</p>
    </body>
    </html>
  `;

  if (!transporter) {
    console.log('📧 [TEST EMAIL - Not Configured]');
    console.log('To:', recipient);
    console.log('Subject:', subject);
    return { success: true, message: 'Test email logged to console (SMTP not configured)' };
  }

  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || process.env.SMTP_USER,
      to: recipient,
      subject,
      text,
      html,
    });

    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('❌ Error sending test email:', error);
    return { success: false, error: error.message };
  }
}


