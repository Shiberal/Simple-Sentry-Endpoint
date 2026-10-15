/**
 * GitHub Integration Helper Functions
 */

/**
 * Parse GitHub repo string (URL or owner/repo) with safe URL validation.
 * Only accepts URLs whose host is exactly github.com.
 * @param {string} repoStr - URL (https://github.com/owner/repo) or "owner/repo"
 * @returns {{ owner: string, repo: string } | null}
 */
export function parseGitHubRepo(repoStr) {
  if (!repoStr || typeof repoStr !== 'string') return null;
  const trimmed = repoStr.trim();
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    try {
      const url = new URL(trimmed);
      if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') return null;
      const pathMatch = url.pathname.match(/^\/([^/]+)\/([^/]+?)(?:\.git)?\/?$/);
      if (!pathMatch) return null;
      return { owner: pathMatch[1], repo: pathMatch[2].replace(/\.git$/, '') };
    } catch {
      return null;
    }
  }
  if (trimmed.includes('/')) {
    const [owner, repo] = trimmed.split('/').map(s => s.trim());
    if (owner && repo) return { owner, repo: repo.replace(/\.git$/, '') };
  }
  return null;
}

/**
 * Check if an error should auto-create a GitHub issue based on filters
 * @param {Object} params
 * @param {Object} params.issue - The issue object from database
 * @param {Object} params.eventData - The event data
 * @param {Object} params.filters - Filter configuration { levels: [], environments: [] }
 * @returns {boolean} - True if error matches filters
 */
export function shouldAutoReport({ issue, eventData, filters }) {
  if (!filters) return true; // No filters means report all
  
  // Check level filter
  if (filters.levels && filters.levels.length > 0) {
    if (!filters.levels.includes(issue.level)) {
      console.log(`⏭️  Skipping auto-report: level "${issue.level}" not in filter [${filters.levels.join(', ')}]`);
      return false;
    }
  }
  
  // Check environment filter
  if (filters.environments && filters.environments.length > 0) {
    const eventEnv = eventData.environment || '';
    if (!filters.environments.includes(eventEnv)) {
      console.log(`⏭️  Skipping auto-report: environment "${eventEnv}" not in filter [${filters.environments.join(', ')}]`);
      return false;
    }
  }
  
  return true;
}

/**
 * Create a GitHub issue from an error event
 * @param {Object} params
 * @param {Object} params.issue - The issue object from database
 * @param {Object} params.eventData - The event data
 * @param {Object} params.project - The project object with githubRepo and githubToken
 * @param {string} params.baseUrl - Base URL for linking back to the dashboard
 * @returns {Promise<Object|null>} - Created GitHub issue or null if failed
 */
export async function createGitHubIssue({ issue, eventData, project, baseUrl }) {
  // Check if GitHub issue already exists for this error
  if (issue.githubIssueUrl) {
    console.log('ℹ️  GitHub issue already exists for this error:', issue.githubIssueUrl);
    return { html_url: issue.githubIssueUrl, number: issue.githubIssueNumber, exists: true };
  }

  // Validate GitHub configuration
  if (!project.githubRepo) {
    console.log('⚠️  GitHub repo not configured for project:', project.name);
    return null;
  }

  try {
    const parsed = parseGitHubRepo(project.githubRepo);
    if (!parsed) {
      console.error('❌ Invalid GitHub repository format:', project.githubRepo);
      return null;
    }
    const { owner, repo } = parsed;

    // Build the issue title with occurrence count
    const countSuffix = issue.count > 1 ? ` (${issue.count}x)` : '';
    const title = `🐛 ${issue.title}${countSuffix}`;
    
    // Generate enhanced issue body
    let body = `## 🚨 Error Report\n\n`;
    body += `This issue was automatically created from [${project.name}](${baseUrl}/dashboard).\n\n`;
    body += `**Error Fingerprint:** \`${issue.fingerprint}\`\n`;
    body += `**Occurrences:** ${issue.count} time${issue.count !== 1 ? 's' : ''}\n\n`;
    
    // Error summary
    if (eventData.exception?.values?.[0]) {
      const exc = eventData.exception.values[0];
      body += `### Exception Details\n\n`;
      body += `**Type:** \`${exc.type}\`\n`;
      body += `**Message:** ${exc.value}\n`;
      if (eventData.culprit) body += `**Culprit:** \`${eventData.culprit}\`\n`;
      body += `\n`;
      
      // Stack trace with better formatting
      if (exc.stacktrace?.frames) {
        body += `### 📍 Stack Trace\n\n`;
        body += `\`\`\`${eventData.platform || 'text'}\n`;
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
    } else if (eventData.message) {
      body += `**Message:** ${eventData.message}\n\n`;
    }
    
    // Occurrence information
    body += `### 📊 Occurrence Information\n\n`;
    body += `- **Times Occurred:** ${issue.count} time${issue.count !== 1 ? 's' : ''}\n`;
    body += `- **First Seen:** ${new Date(issue.firstSeen).toLocaleString()}\n`;
    body += `- **Last Seen:** ${new Date(issue.lastSeen).toLocaleString()}\n`;
    body += `- **Severity Level:** ${issue.level.toUpperCase()}\n`;
    body += `- **Status:** ${issue.status}\n`;
    body += `\n`;
    
    // Environment info
    if (eventData.environment || eventData.release || eventData.platform) {
      body += `### 🔧 Environment\n\n`;
      if (eventData.environment) body += `- **Environment:** ${eventData.environment}\n`;
      if (eventData.release) body += `- **Release:** ${eventData.release}\n`;
      if (eventData.platform) body += `- **Platform:** ${eventData.platform}\n`;
      
      // SDK info
      if (eventData.sdk) {
        body += `- **SDK:** ${eventData.sdk.name} ${eventData.sdk.version || ''}\n`;
      }
      
      // User info
      if (eventData.user) {
        body += `\n**User Context:**\n`;
        if (eventData.user.id) body += `- ID: ${eventData.user.id}\n`;
        if (eventData.user.email) body += `- Email: ${eventData.user.email}\n`;
        if (eventData.user.username) body += `- Username: ${eventData.user.username}\n`;
        if (eventData.user.ip_address) body += `- IP: ${eventData.user.ip_address}\n`;
      }
      body += `\n`;
    }
    
    // Add tags if available
    if (eventData.tags && Object.keys(eventData.tags).length > 0) {
      body += `### 🏷️ Tags\n\n`;
      Object.entries(eventData.tags).forEach(([key, value]) => {
        body += `- **${key}:** ${value}\n`;
      });
      body += `\n`;
    }
    
    // Link back to dashboard
    body += `---\n\n`;
    body += `[View in Error Dashboard](${baseUrl}/dashboard) · Issue ID: ${issue.id}\n`;

    // Create the GitHub issue via API
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues`;
    
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Sentry-Clone-Error-Reporter'
    };

    // Add authentication if token is provided
    if (project.githubToken) {
      headers['Authorization'] = `token ${project.githubToken}`;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        title,
        body,
        labels: ['bug', 'auto-reported', `level:${issue.level}`]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('❌ GitHub API error:', response.status, errorData);
      
      if (response.status === 401) {
        console.error('   Authentication failed. Check GitHub token.');
      } else if (response.status === 404) {
        console.error('   Repository not found:', `${owner}/${repo}`);
      } else if (response.status === 403) {
        console.error('   Permission denied. Token may need "repo" scope.');
      }
      
      return null;
    }

    const githubIssue = await response.json();
    console.log('✅ GitHub issue created:', githubIssue.html_url);
    
    return {
      html_url: githubIssue.html_url,
      number: githubIssue.number,
      id: githubIssue.id,
      created: true
    };
  } catch (error) {
    console.error('❌ Error creating GitHub issue:', error.message);
    return null;
  }
}

/**
 * Update a GitHub issue title and optionally add a comment
 * @param {Object} params
 * @param {number} params.issueNumber - GitHub issue number
 * @param {Object} params.project - Project with githubRepo and githubToken
 * @param {Object} params.issue - Issue object from database
 * @param {string} params.comment - Optional comment to add
 * @returns {Promise<boolean>} - True if successful
 */
export async function updateGitHubIssue({ issueNumber, project, issue, comment }) {
  try {
    const parsed = parseGitHubRepo(project.githubRepo);
    if (!parsed) {
      console.error('❌ Invalid GitHub repository format:', project.githubRepo);
      return false;
    }
    const { owner, repo } = parsed;

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
    
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Sentry-Clone-Error-Reporter'
    };

    if (project.githubToken) {
      headers['Authorization'] = `token ${project.githubToken}`;
    }

    // Update the issue title with new count
    const countSuffix = issue.count > 1 ? ` (${issue.count}x)` : '';
    const newTitle = `🐛 ${issue.title}${countSuffix}`;

    const response = await fetch(apiUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ title: newTitle })
    });

    if (!response.ok) {
      console.error('❌ Failed to update GitHub issue:', response.status);
      return false;
    }

    console.log('✅ GitHub issue title updated:', newTitle);

    // Add comment if provided
    if (comment) {
      await addGitHubComment({ issueNumber, project, comment });
    }

    return true;
  } catch (error) {
    console.error('❌ Error updating GitHub issue:', error.message);
    return false;
  }
}

/**
 * Close or reopen a GitHub issue
 * @param {Object} params
 * @param {number} params.issueNumber - GitHub issue number
 * @param {Object} params.project - Project with githubRepo and githubToken
 * @param {string} params.state - 'closed' or 'open'
 * @param {string} params.comment - Optional comment to add when closing/reopening
 * @returns {Promise<boolean>} - True if successful
 */
export async function updateGitHubIssueState({ issueNumber, project, state, comment }) {
  try {
    const parsed = parseGitHubRepo(project.githubRepo);
    if (!parsed) {
      console.error('❌ Invalid GitHub repository format:', project.githubRepo);
      return false;
    }
    const { owner, repo } = parsed;

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}`;
    
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Sentry-Clone-Error-Reporter'
    };

    if (project.githubToken) {
      headers['Authorization'] = `token ${project.githubToken}`;
    }

    const response = await fetch(apiUrl, {
      method: 'PATCH',
      headers,
      body: JSON.stringify({ state })
    });

    if (!response.ok) {
      console.error(`❌ Failed to ${state === 'closed' ? 'close' : 'reopen'} GitHub issue:`, response.status);
      return false;
    }

    console.log(`✅ GitHub issue ${state === 'closed' ? 'closed' : 'reopened'}: #${issueNumber}`);

    // Add comment if provided
    if (comment) {
      await addGitHubComment({ issueNumber, project, comment });
    }

    return true;
  } catch (error) {
    console.error(`❌ Error ${state === 'closed' ? 'closing' : 'reopening'} GitHub issue:`, error.message);
    return false;
  }
}

/**
 * Add a comment to an existing GitHub issue
 * @param {Object} params
 * @param {number} params.issueNumber - GitHub issue number
 * @param {Object} params.project - Project with githubRepo and githubToken
 * @param {string} params.comment - Comment text to add
 * @returns {Promise<boolean>} - True if successful
 */
export async function addGitHubComment({ issueNumber, project, comment }) {
  try {
    const parsed = parseGitHubRepo(project.githubRepo);
    if (!parsed) {
      console.error('❌ Invalid GitHub repository format:', project.githubRepo);
      return false;
    }
    const { owner, repo } = parsed;

    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/issues/${issueNumber}/comments`;
    
    const headers = {
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'Sentry-Clone-Error-Reporter'
    };

    if (project.githubToken) {
      headers['Authorization'] = `token ${project.githubToken}`;
    }

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({ body: comment })
    });

    if (!response.ok) {
      console.error('❌ Failed to add GitHub comment:', response.status);
      return false;
    }

    console.log('✅ Comment added to GitHub issue #' + issueNumber);
    return true;
  } catch (error) {
    console.error('❌ Error adding GitHub comment:', error.message);
    return false;
  }
}

