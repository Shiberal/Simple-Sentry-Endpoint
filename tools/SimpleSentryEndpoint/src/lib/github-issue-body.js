// Markdown body and labels for a manually created GitHub issue from a dashboard event.
export function buildGitHubIssueBody({ event, issue, data }) {
  let body = `## 🚨 Error Report\n\n`;
  body += `This issue was manually created from the error dashboard.\n\n`;
  if (issue?.fingerprint) {
    body += `**Error Fingerprint:** \`${issue.fingerprint}\`\n`;
  }
  if (issue?.count) {
    body += `**Occurrences:** ${issue.count} time${issue.count !== 1 ? 's' : ''}\n`;
  }
  body += `\n`;
  
  // Error summary
  if (data.exception?.values?.[0]) {
    const exc = data.exception.values[0];
    body += `### Exception Details\n\n`;
    body += `**Type:** \`${exc.type}\`\n`;
    body += `**Message:** ${exc.value}\n`;
    if (data.culprit) body += `**Culprit:** \`${data.culprit}\`\n`;
    body += `\n`;
    
    // Stack trace with better formatting
    if (exc.stacktrace?.frames) {
      body += `### 📍 Stack Trace\n\n`;
      body += `\`\`\`${data.platform || 'text'}\n`;
      exc.stacktrace.frames.slice().reverse().forEach((frame, idx) => {
        const fn = frame.function || frame.module || 'anonymous';
        const file = frame.filename || frame.abs_path || 'unknown';
        const line = frame.lineno || '?';
        const col = frame.colno ? `:${frame.colno}` : '';
        body += `${idx + 1}. ${fn}\n   at ${file}:${line}${col}\n`;
        
        // Add context lines if available
        if (frame.context_line) {
          body += `   > ${frame.context_line.trim()}\n`;
        }
      });
      body += `\`\`\`\n\n`;
    }
  } else if (data.message) {
    body += `**Message:** ${data.message}\n\n`;
  }
  
  // Occurrence information
  if (issue) {
    body += `### 📊 Occurrence Information\n\n`;
    body += `- **Times Occurred:** ${issue.count} time${issue.count !== 1 ? 's' : ''}\n`;
    body += `- **First Seen:** ${new Date(issue.firstSeen).toLocaleString()}\n`;
    body += `- **Last Seen:** ${new Date(issue.lastSeen).toLocaleString()}\n`;
    body += `- **Severity Level:** ${issue.level.toUpperCase()}\n`;
    body += `- **Status:** ${issue.status}\n\n`;
  }
  
  // Environment & Context
  body += `### 🔧 Environment\n\n`;
  if (data.environment) body += `- **Environment:** ${data.environment}\n`;
  if (data.platform) body += `- **Platform:** ${data.platform}\n`;
  if (data.release) body += `- **Release:** ${data.release}\n`;
  if (data.server_name) body += `- **Server:** ${data.server_name}\n`;
  if (data.sdk) body += `- **SDK:** ${data.sdk.name} ${data.sdk.version}\n`;
  body += `\n`;
  
  // User context
  if (data.user) {
    body += `### 👤 User Context\n\n`;
    if (data.user.id) body += `- **User ID:** ${data.user.id}\n`;
    if (data.user.username) body += `- **Username:** ${data.user.username}\n`;
    if (data.user.email) body += `- **Email:** ${data.user.email}\n`;
    if (data.user.ip_address) body += `- **IP Address:** ${data.user.ip_address}\n`;
    body += `\n`;
  }
  
  // Tags
  if (data.tags && Object.keys(data.tags).length > 0) {
    body += `### 🏷️ Tags\n\n`;
    Object.entries(data.tags).forEach(([key, value]) => {
      body += `- **${key}:** ${value}\n`;
    });
    body += `\n`;
  }
  
  // Breadcrumbs (last 10)
  const breadcrumbs = Array.isArray(data.breadcrumbs) ? data.breadcrumbs : data.breadcrumbs?.values;
  if (breadcrumbs && breadcrumbs.length > 0) {
    body += `### 🍞 Breadcrumbs (Last 10)\n\n`;
    breadcrumbs.slice(-10).forEach((crumb, idx) => {
      // Handle different timestamp formats
      let time = '';
      if (crumb.timestamp) {
        if (typeof crumb.timestamp === 'number' && crumb.timestamp > 1000000000000) {
          time = new Date(crumb.timestamp).toLocaleTimeString();
        } else if (typeof crumb.timestamp === 'number' && crumb.timestamp > 1000000000) {
          time = new Date(crumb.timestamp * 1000).toLocaleTimeString();
        } else {
          time = crumb.timestamp;
        }
      }
      body += `${idx + 1}. **[${crumb.category || crumb.level || 'default'}]** ${crumb.message || crumb.type} `;
      if (time) body += `_(${time})_`;
      body += `\n`;
    });
    body += `\n`;
  }
  
  // Extra context
  if (data.contexts && Object.keys(data.contexts).length > 0) {
    body += `### 📦 Additional Context\n\n`;
    Object.entries(data.contexts).forEach(([key, value]) => {
      if (key !== 'trace' && typeof value === 'object') {
        body += `**${key}:**\n\`\`\`json\n${JSON.stringify(value, null, 2)}\n\`\`\`\n\n`;
      }
    });
  }
  
  // Request info
  if (data.request) {
    body += `### 🌐 Request Information\n\n`;
    if (data.request.url) body += `- **URL:** ${data.request.url}\n`;
    if (data.request.method) body += `- **Method:** ${data.request.method}\n`;
    if (data.request.headers?.['User-Agent']) body += `- **User Agent:** ${data.request.headers['User-Agent']}\n`;
    body += `\n`;
  }
  
  // Footer with links
  body += `---\n\n`;
  body += `📅 **Event ID:** \`${event.id}\`\n`;
  body += `⏰ **Timestamp:** ${new Date(event.createdAt).toLocaleString()}\n`;
  body += `📁 **Project:** ${event.project?.name || 'Unknown Project'}\n`;
  
  // Add link to dashboard if available
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000';
  if (issue) {
    body += `🔗 **[View in Dashboard](${baseUrl}/dashboard?issue=${issue.id})**\n`;
  }
  return body;
}

export function buildGitHubLabels(data) {
  const labels = [];
  if (data.level) labels.push(data.level);
  if (data.platform) labels.push(data.platform);
  if (data.environment) labels.push(data.environment);
  labels.push('sentry');
  labels.push('automated');
  return labels;
}
