import { useState } from 'react';
import { parseGitHubRepo } from '@/lib/github';
import { buildGitHubIssueBody, buildGitHubLabels } from '@/lib/github-issue-body';
import { getEventTitle } from '@/lib/event-display';

/** Creates a GitHub issue for an event (API when the project has a repo, otherwise a copy-paste dialog). */
export default function useGitHubIssue({ setIssues, showNotification }) {
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [githubIssueData, setGithubIssueData] = useState({ title: '', body: '' });

  const handleCreateGitHubIssue = async (event) => {
    const data = event.data;
    const issue = event.issue;
    const countSuffix = issue?.count > 1 ? ` (${issue.count}x)` : '';
    const title = `🐛 ${getEventTitle(event)}${countSuffix}`;
    
    // Check if issue is ignored
    if (issue?.status === 'IGNORED') {
      showNotification(
        `Cannot Create GitHub Issue - This issue is currently ignored. Please unignore it first before creating a GitHub issue.`,
        'warning'
      );
      return;
    }
    
    // Check if GitHub issue already exists for this error
    if (issue?.githubIssueUrl) {
      const confirmed = confirm(
        `GitHub Issue Already Exists!\n\n` +
        `This error already has a GitHub issue:\n` +
        `${issue.githubIssueUrl}\n\n` +
        `Would you like to open it?`
      );
      
      if (confirmed) {
        window.open(issue.githubIssueUrl, '_blank');
      }
      return;
    }
    
    const body = buildGitHubIssueBody({ event, issue, data });
    const labels = buildGitHubLabels(data);

    // Check if project has GitHub configuration
    if (event.project?.githubRepo) {
      try {
        const parsed = parseGitHubRepo(event.project.githubRepo);
        if (!parsed) {
          throw new Error('Invalid GitHub repository format');
        }
        const { owner, repo: repoName } = parsed;

        // Create issue via GitHub API
        const headers = {
          'Accept': 'application/vnd.github.v3+json',
          'Content-Type': 'application/json',
        };
        
        if (event.project?.githubToken) {
          headers['Authorization'] = `Bearer ${event.project.githubToken}`;
        }
        
        const response = await fetch(`https://api.github.com/repos/${owner}/${repoName}/issues`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ 
            title, 
            body,
            labels: labels.filter(Boolean) // Add labels to the issue
          })
        });
        
        if (response.ok) {
          const githubIssue = await response.json();
          
          // Save GitHub issue info to database to prevent duplicates
          if (issue?.id) {
            try {
              await fetch(`/api/issues/${issue.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  githubIssueUrl: githubIssue.html_url,
                  githubIssueNumber: githubIssue.number
                })
              });
              
              // Update local state to reflect the change
              setIssues(prevIssues => 
                prevIssues.map(iss => 
                  iss.id === issue.id 
                    ? {
                        ...iss,
                        githubIssueUrl: githubIssue.html_url,
                        githubIssueNumber: githubIssue.number
                      }
                    : iss
                )
              );
            } catch (err) {
              console.error('Failed to save GitHub issue info:', err);
            }
          }
          
          showNotification(
            `✅ GitHub Issue #${githubIssue.number} created successfully! Opening in new tab...`,
            'success'
          );
          
          // Open the issue in a new tab
          window.open(githubIssue.html_url, '_blank');
          return;
        } else {
          const error = await response.json();
          const errorMsg = error.message || error.errors?.[0]?.message || 'Failed to create issue';
          throw new Error(errorMsg);
        }
      } catch (error) {
        console.error('Error creating GitHub issue:', error);
        const errorDetails = error.message.includes('Bad credentials') 
          ? 'Invalid GitHub token. Please check your project settings.'
          : error.message.includes('Not Found')
          ? 'Repository not found. Please check the repository name in project settings.'
          : error.message;
        showNotification(`❌ Failed to create GitHub issue: ${errorDetails}. Falling back to manual mode...`, 'error');
      }
    }
    
    // Fallback to manual mode if no GitHub config or API call failed
    setGithubIssueData({ title, body, labels: labels.join(', ') });
    setShowGitHubModal(true);
  };

  return { showGitHubModal, setShowGitHubModal, githubIssueData, setGithubIssueData, handleCreateGitHubIssue };
}
