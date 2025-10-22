import { useState, useEffect } from 'react';
import Head from "next/head";
import { useRouter } from 'next/router';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import styles from '@/styles/Dashboard.module.css';

export default function Dashboard() {
  const router = useRouter();
  const [issues, setIssues] = useState([]); // Changed from events to issues
  const [standaloneEvents, setStandaloneEvents] = useState([]); // For transactions and other standalone events
  const [projects, setProjects] = useState([]);
  const [user, setUser] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [showNewProjectModal, setShowNewProjectModal] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [activeTab, setActiveTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterLevel, setFilterLevel] = useState('error');
  const [filterStatus, setFilterStatus] = useState('active'); // 'all', 'active' (not resolved/ignored), 'unresolved', 'resolved', 'ignored', 'in_progress'
  const [filterEventType, setFilterEventType] = useState('all'); // 'all', 'ERROR', 'CSP', 'MINIDUMP', 'TRANSACTION', 'MESSAGE'
  const [projectsCollapsed, setProjectsCollapsed] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletingEvent, setDeletingEvent] = useState(null);
  const [deletingIssue, setDeletingIssue] = useState(null);
  const [selectedIssue, setSelectedIssue] = useState(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedEvents, setSelectedEvents] = useState([]); // Keep for backward compatibility
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [showGitHubModal, setShowGitHubModal] = useState(false);
  const [githubIssueData, setGithubIssueData] = useState({ title: '', body: '' });
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [analyticsData, setAnalyticsData] = useState(null);
  const [isDeduplicating, setIsDeduplicating] = useState(false);
  const [issueEventIndices, setIssueEventIndices] = useState({}); // Track current event index per issue

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      if (!response.ok) {
        router.push('/login');
        return;
      }
      const data = await response.json();
      setUser(data.user);
      fetchData();
    } catch (error) {
      router.push('/login');
    }
  };

  const fetchData = async () => {
    try {
      // Fetch issues instead of events to avoid duplicates
      const issuesUrl = selectedProject 
        ? `/api/issues?projectId=${selectedProject}&sortBy=lastSeen&sortOrder=desc` 
        : `/api/issues?sortBy=lastSeen&sortOrder=desc`;
      
      // Fetch standalone events (transactions, etc.) that don't have issues
      const eventsUrl = selectedProject
        ? `/api/events?projectId=${selectedProject}&limit=100`
        : `/api/events?limit=100`;
        
      const [issuesRes, projectsRes, eventsRes] = await Promise.all([
        fetch(issuesUrl),
        fetch('/api/projects'),
        fetch(eventsUrl)
      ]);
      
      const issuesData = await issuesRes.json();
      const projectsData = await projectsRes.json();
      const eventsData = await eventsRes.json();
      
      if (issuesData.success) {
        setIssues(issuesData.issues);
      }
      if (projectsData.success) setProjects(projectsData.projects);
      if (eventsData.success) {
        // Filter to only standalone events (those without issueId)
        const standalone = eventsData.events.filter(event => !event.issueId);
        setStandaloneEvents(standalone);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAnalytics = async () => {
    try {
      const params = selectedProject ? `?projectId=${selectedProject}` : '';
      const [trendsRes, topIssuesRes, breakdownRes] = await Promise.all([
        fetch(`/api/analytics/trends${params}&days=7`),
        fetch(`/api/analytics/top-issues${params}&limit=10`),
        fetch(`/api/analytics/breakdown${params}`)
      ]);

      const [trends, topIssues, breakdown] = await Promise.all([
        trendsRes.json(),
        topIssuesRes.json(),
        breakdownRes.json()
      ]);

      setAnalyticsData({
        trends: trends.success ? trends.trends : [],
        topIssues: topIssues.success ? topIssues.topIssues : [],
        breakdown: breakdown.success ? breakdown.breakdown : null
      });
    } catch (error) {
      console.error('Error fetching analytics:', error);
    }
  };

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [selectedProject, user, filterLevel, activeTab]);

  useEffect(() => {
    if (autoRefresh && user) {
      const interval = setInterval(fetchData, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, selectedProject, user, filterLevel]);

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/login');
  };

  const handleDeduplicate = async () => {
    if (isDeduplicating) return;
    
    setIsDeduplicating(true);
    try {
      const response = await fetch('/api/admin/merge-duplicates', {
        method: 'POST'
      });
      
      const data = await response.json();
      
      if (data.success) {
        alert(`✅ Successfully merged ${data.duplicatesMerged} duplicate issue${data.duplicatesMerged !== 1 ? 's' : ''}!`);
        // Refresh the dashboard
        fetchData();
      } else {
        alert(`❌ Failed to merge duplicates: ${data.message || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error deduplicating:', error);
      alert('❌ Error deduplicating issues');
    } finally {
      setIsDeduplicating(false);
    }
  };

  const handleCreateProject = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newProjectName })
      });

      if (response.ok) {
        setNewProjectName('');
        setShowNewProjectModal(false);
        fetchData();
      }
    } catch (error) {
      console.error('Error creating project:', error);
    }
  };

  const handleDeleteIssue = async () => {
    if (!deletingIssue) return;
    
    try {
      const response = await fetch(`/api/issues/${deletingIssue.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Close the detail panel if the deleted issue is currently selected
        if (selectedEvent?.issue?.id === deletingIssue.id) {
          setSelectedEvent(null);
        }
        // Refresh the issues list
        fetchData();
        setShowDeleteConfirm(false);
        setDeletingIssue(null);
      } else {
        console.error('Failed to delete issue');
        alert('Failed to delete issue');
      }
    } catch (error) {
      console.error('Error deleting issue:', error);
      alert('Error deleting issue');
    }
  };

  const handleDeleteEvent = async () => {
    if (!deletingEvent) return;
    
    try {
      const response = await fetch(`/api/events/${deletingEvent.id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Close the detail panel if the deleted event is currently selected
        if (selectedEvent?.id === deletingEvent.id) {
          setSelectedEvent(null);
        }
        // Refresh the events list
        fetchData();
        setShowDeleteConfirm(false);
        setDeletingEvent(null);
      } else {
        console.error('Failed to delete event');
        alert('Failed to delete event');
      }
    } catch (error) {
      console.error('Error deleting event:', error);
      alert('Error deleting event');
    }
  };

  const handleBulkDelete = async () => {
    if (selectedEvents.length === 0) return;
    
    try {
      // Delete all selected issues (since we're now working with issues)
      const deletePromises = selectedEvents.map(issueId =>
        fetch(`/api/issues/${issueId}`, { method: 'DELETE' })
      );
      
      const results = await Promise.all(deletePromises);
      const allSuccessful = results.every(res => res.ok);
      
      if (allSuccessful) {
        // Close detail panel if selected issue was deleted
        if (selectedEvent?.issue && selectedEvents.includes(selectedEvent.issue.id)) {
          setSelectedEvent(null);
        }
        // Clear selection and refresh
        setSelectedEvents([]);
        setIsSelectionMode(false);
        fetchData();
        setShowDeleteConfirm(false);
        setDeletingIssue(null);
      } else {
        alert('Some issues failed to delete');
      }
    } catch (error) {
      console.error('Error deleting issues:', error);
      alert('Error deleting issues');
    }
  };

  const toggleEventSelection = (issueId) => {
    setSelectedEvents(prev => 
      prev.includes(issueId) 
        ? prev.filter(id => id !== issueId)
        : [...prev, issueId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedEvents.length === filteredIssues.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(filteredIssues.map(e => e.id));
    }
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedEvents([]);
  };

  const handleCreateGitHubIssue = async (event) => {
    const data = event.data;
    const issue = event.issue;
    const countSuffix = issue?.count > 1 ? ` (${issue.count}x)` : '';
    const title = `🐛 ${getEventTitle(event)}${countSuffix}`;
    
    // Check if issue is ignored
    if (issue?.status === 'IGNORED') {
      alert(
        `Cannot Create GitHub Issue\n\n` +
        `This issue is currently ignored. Please unignore it first before creating a GitHub issue.`
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
    
    // Generate enhanced issue body
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
    
    // Generate labels
    const labels = [];
    if (data.level) labels.push(data.level);
    if (data.platform) labels.push(data.platform);
    if (data.environment) labels.push(data.environment);
    labels.push('sentry');
    labels.push('automated');
    
    // Check if project has GitHub configuration
    if (event.project?.githubRepo) {
      try {
        // Parse the GitHub repo (extract owner/repo from URL if needed)
        let repo = event.project.githubRepo;
        if (repo.includes('github.com/')) {
          repo = repo.split('github.com/')[1].replace(/\.git$/, '');
        }
        
        const [owner, repoName] = repo.split('/');
        
        if (!owner || !repoName) {
          throw new Error('Invalid GitHub repository format');
        }
        
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
          
          const successMsg = `✅ GitHub Issue Created Successfully!\n\n` +
            `📝 Issue #${githubIssue.number}\n` +
            `🏷️  Labels: ${labels.join(', ')}\n` +
            `🔗 ${githubIssue.html_url}\n\n` +
            `Opening in new tab...`;
          alert(successMsg);
          
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
        alert(`❌ Failed to create GitHub issue:\n\n${errorDetails}\n\nFalling back to manual mode...`);
      }
    }
    
    // Fallback to manual mode if no GitHub config or API call failed
    setGithubIssueData({ title, body, labels: labels.join(', ') });
    setShowGitHubModal(true);
  };

  // Issue workflow handlers
  const handleStatusChange = async (issueId, newStatus) => {
    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        // Update selected issue if it's the one being updated
        if (selectedIssue?.id === issueId) {
          const data = await response.json();
          setSelectedIssue(data.issue);
        }
        // Refresh issues list
        fetchData();
      } else {
        alert('Failed to update status');
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('Error updating status');
    }
  };

  const handleAssignIssue = async (issueId, userId) => {
    try {
      const response = await fetch(`/api/issues/${issueId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedToId: userId })
      });

      if (response.ok) {
        // Update selected issue if it's the one being updated
        if (selectedIssue?.id === issueId) {
          const data = await response.json();
          setSelectedIssue(data.issue);
        }
        // Refresh issues list
        fetchData();
      } else {
        alert('Failed to assign issue');
      }
    } catch (error) {
      console.error('Error assigning issue:', error);
      alert('Error assigning issue');
    }
  };

  const handleResolveIssue = async (issue) => {
    if (!issue) return;

    try {
      // Toggle between RESOLVED and UNRESOLVED
      const newStatus = issue.status === 'RESOLVED' ? 'UNRESOLVED' : 'RESOLVED';
      
      const response = await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update the selected event's issue
        if (selectedEvent?.issue?.id === issue.id) {
          setSelectedEvent({
            ...selectedEvent,
            issue: data.issue
          });
        }
        
        // Update selected issue if it's the one being updated
        if (selectedIssue?.id === issue.id) {
          setSelectedIssue(data.issue);
        }
        
        // Update issues list
        setIssues(prevIssues => 
          prevIssues.map(iss => 
            iss.id === issue.id ? data.issue : iss
          )
        );
        
        // Show success message with GitHub info if applicable
        let message = `Issue ${newStatus === 'RESOLVED' ? 'resolved' : 'reopened'} successfully!`;
        if (issue.githubIssueNumber) {
          message += `\n\nGitHub issue #${issue.githubIssueNumber} has been ${newStatus === 'RESOLVED' ? 'closed' : 'reopened'}.`;
        }
        alert(message);
        
        // Refresh data
        fetchData();
      } else {
        const errorData = await response.json();
        alert(`Failed to ${newStatus === 'RESOLVED' ? 'resolve' : 'reopen'} issue: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error resolving issue:', error);
      alert('Error updating issue status');
    }
  };

  const handleIgnoreIssue = async (issue) => {
    if (!issue) return;

    try {
      // Toggle between IGNORED and UNRESOLVED
      const newStatus = issue.status === 'IGNORED' ? 'UNRESOLVED' : 'IGNORED';
      
      const response = await fetch(`/api/issues/${issue.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus })
      });

      if (response.ok) {
        const data = await response.json();
        
        // Update the selected event's issue
        if (selectedEvent?.issue?.id === issue.id) {
          setSelectedEvent({
            ...selectedEvent,
            issue: data.issue
          });
        }
        
        // Update selected issue if it's the one being updated
        if (selectedIssue?.id === issue.id) {
          setSelectedIssue(data.issue);
        }
        
        // Update issues list
        setIssues(prevIssues => 
          prevIssues.map(iss => 
            iss.id === issue.id ? data.issue : iss
          )
        );
        
        // Show success message
        alert(`Issue ${newStatus === 'IGNORED' ? 'ignored - will not appear in main view or auto-report to GitHub' : 'unignored'} successfully!`);
        
        // Refresh data
        fetchData();
      } else {
        const errorData = await response.json();
        alert(`Failed to ${newStatus === 'IGNORED' ? 'ignore' : 'unignore'} issue: ${errorData.error || 'Unknown error'}`);
      }
    } catch (error) {
      console.error('Error ignoring issue:', error);
      alert('Error updating issue status');
    }
  };

  const handleAddComment = async (issueId) => {
    if (!newComment.trim()) return;

    try {
      const response = await fetch(`/api/issues/${issueId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: newComment })
      });

      if (response.ok) {
        const data = await response.json();
        setComments([...comments, data.comment]);
        setNewComment('');
        
        // Refresh issue details to get updated comment count
        if (selectedIssue?.id === issueId) {
          const issueRes = await fetch(`/api/issues/${issueId}`);
          const issueData = await issueRes.json();
          if (issueData.success) {
            setSelectedIssue(issueData.issue);
            setComments(issueData.issue.comments || []);
          }
        }
      } else {
        alert('Failed to add comment');
      }
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Error adding comment');
    }
  };

  const loadIssueDetails = async (issueId) => {
    try {
      const response = await fetch(`/api/issues/${issueId}`);
      const data = await response.json();
      
      if (data.success) {
        setSelectedIssue(data.issue);
        setComments(data.issue.comments || []);
      }
    } catch (error) {
      console.error('Error loading issue details:', error);
    }
  };

  // Navigate to previous duplicate event
  const navigateToPreviousEvent = async (issue, e) => {
    e.stopPropagation();
    if (!issue || issue.count <= 1) return;
    
    const currentIndex = issueEventIndices[issue.id] || 0;
    const newIndex = currentIndex > 0 ? currentIndex - 1 : issue.count - 1;
    
    setIssueEventIndices(prev => ({ ...prev, [issue.id]: newIndex }));
    
    // Fetch and show the event at this index
    await showEventAtIndex(issue, newIndex);
  };

  // Navigate to next duplicate event
  const navigateToNextEvent = async (issue, e) => {
    e.stopPropagation();
    if (!issue || issue.count <= 1) return;
    
    const currentIndex = issueEventIndices[issue.id] || 0;
    const newIndex = (currentIndex + 1) % issue.count;
    
    setIssueEventIndices(prev => ({ ...prev, [issue.id]: newIndex }));
    
    // Fetch and show the event at this index
    await showEventAtIndex(issue, newIndex);
  };

  // Show event at specific index for an issue
  const showEventAtIndex = async (issue, index) => {
    try {
      const response = await fetch(`/api/issues/${issue.id}`);
      const data = await response.json();
      if (data.success && data.issue.events && data.issue.events.length > index) {
        setSelectedEvent({
          ...data.issue.events[index],
          issue: issue
        });
        setActiveTab('overview');
      }
    } catch (error) {
      console.error('Error fetching issue event:', error);
    }
  };

  const getEventType = (event) => {
    // Support both event and issue data structures
    const data = event.data || event;
    
    // Check if it's a message event (has message but no exception)
    if (data.message && !data.exception) return 'message';
    
    // Otherwise check by level
    if (data.level === 'error' || event.level === 'error' || data.exception) return 'error';
    if (data.level === 'warning' || event.level === 'warning') return 'warning';
    if (data.level === 'info' || event.level === 'info') return 'info';
    return 'event';
  };

  // Get event type badge info (for CSP, minidump, etc.)
  const getEventTypeBadge = (issue) => {
    // Check if issue has CSP-specific fields
    if (issue.violatedDirective || issue.blockedUri) {
      return { icon: '🛡️', label: 'CSP', color: '#f97316' }; // Orange
    }
    // Check events array for event type if available
    if (issue.events && issue.events.length > 0) {
      const latestEvent = issue.events[0];
      if (latestEvent.eventType === 'MINIDUMP') {
        return { icon: '💥', label: 'Crash', color: '#9333ea' }; // Purple
      }
      if (latestEvent.eventType === 'TRANSACTION') {
        return { icon: '⚡', label: 'Perf', color: '#3b82f6' }; // Blue
      }
      if (latestEvent.eventType === 'MESSAGE') {
        return { icon: '💬', label: 'Message', color: '#10b981' }; // Green
      }
      if (latestEvent.eventType === 'CSP') {
        return { icon: '🛡️', label: 'CSP', color: '#f97316' }; // Orange
      }
    }
    // Default for regular errors
    return null;
  };

  const getEventTitle = (event) => {
    // If it's an issue object (has title field)
    if (event.title) {
      return event.title;
    }
    // Otherwise it's an event object
    const data = event.data || {};
    if (data.exception?.values?.[0]?.value) {
      return data.exception.values[0].value;
    }
    if (data.message) return data.message;
    if (data.transaction) return data.transaction;
    return 'Unknown Event';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    return `${diffDays}d ago`;
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
  };

  // Combine issues and standalone events for filtering and display
  const combinedItems = [
    ...issues,
    ...standaloneEvents.map(event => ({
      id: `event-${event.id}`,
      _isStandaloneEvent: true,
      _event: event,
      title: event.data?.transaction || event.data?.message || 'Unnamed Event',
      level: event.data?.level || 'info',
      status: 'ACTIVE', // Standalone events don't have status
      lastSeen: event.createdAt,
      createdAt: event.createdAt,
      project: event.project,
      events: [event],
      eventType: event.eventType
    }))
  ].sort((a, b) => new Date(b.lastSeen) - new Date(a.lastSeen));

  const filteredIssues = combinedItems.filter(issue => {
    const matchesSearch = !searchQuery || 
      issue.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (issue.project?.name || '').toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLevel = filterLevel === 'all' || 
      issue.level === filterLevel;
    
    const matchesStatus = (() => {
      // Standalone events should appear in "active" and "all" filters
      if (issue._isStandaloneEvent) {
        return filterStatus === 'all' || filterStatus === 'active';
      }
      if (filterStatus === 'all') return true;
      if (filterStatus === 'active') return issue.status !== 'RESOLVED' && issue.status !== 'IGNORED';
      if (filterStatus === 'unresolved') return issue.status === 'UNRESOLVED';
      if (filterStatus === 'resolved') return issue.status === 'RESOLVED';
      if (filterStatus === 'ignored') return issue.status === 'IGNORED';
      if (filterStatus === 'in_progress') return issue.status === 'IN_PROGRESS';
      return true;
    })();

    const matchesEventType = (() => {
      if (filterEventType === 'all') return true;
      // For standalone events, check the eventType directly
      if (issue._isStandaloneEvent) {
        return issue.eventType === filterEventType;
      }
      // Check for CSP issues
      if (filterEventType === 'CSP' && (issue.violatedDirective || issue.blockedUri)) return true;
      // Check event type in events array
      if (issue.events && issue.events.length > 0) {
        return issue.events.some(event => event.eventType === filterEventType);
      }
      // Default: show ERROR type issues when filtering by ERROR
      if (filterEventType === 'ERROR' && !issue.violatedDirective && !issue.blockedUri) return true;
      return false;
    })();
    
    return matchesSearch && matchesLevel && matchesStatus && matchesEventType;
  });

  const renderStackTrace = (exception) => {
    if (!exception?.values?.[0]?.stacktrace?.frames) {
      return <pre className={styles.codeBlock}>{JSON.stringify(exception, null, 2)}</pre>;
    }

    const frames = exception.values[0].stacktrace.frames;
    const reversedFrames = frames.slice().reverse();
    
    return (
      <div className={styles.stackTraceContainer}>
        {reversedFrames.map((frame, idx) => {
          const isLast = idx === reversedFrames.length - 1;
          const indentLevel = idx;
          
          return (
            <div key={idx} className={styles.stackFrameWrapper}>
              {/* Tree connector lines */}
              <div 
                className={styles.stackFrameTreeLine}
                style={{
                  marginLeft: `${indentLevel * 1.5}rem`,
                }}
              >
                <div className={styles.treeConnector}>
                  <span className={styles.treeBranch}>{isLast ? '└─' : '├─'}</span>
                  <span className={styles.treeArrow}>▶</span>
                </div>
              </div>
              
              {/* Frame content */}
              <div 
                className={`${styles.stackFrame} ${isLast ? styles.stackFrameLast : ''}`}
                style={{
                  marginLeft: `${indentLevel * 1.5 + 2.5}rem`,
                }}
              >
                <div className={styles.stackFrameHeader}>
                  <span className={styles.stackFrameFunction}>
                    {frame.function || 'anonymous'}
                  </span>
                  {frame.filename && (
                    <span className={styles.stackFrameFile}>
                      {frame.filename}:{frame.lineno}
                    </span>
                  )}
                </div>
                {frame.context_line && (
                  <pre className={styles.stackFrameCode}>{frame.context_line.trim()}</pre>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderEventDetail = () => {
    if (!selectedEvent) {
      return (
        <div className={styles.detailPanelEmpty}>
          <div className={styles.emptyDetailContent}>
            <div className={styles.emptyDetailIcon}>🔍</div>
            <h3 className={styles.emptyDetailTitle}>Select an Event</h3>
            <p className={styles.emptyDetailText}>
              Click on any event from the list to view detailed information,
              stack traces, breadcrumbs, and more.
            </p>
          </div>
        </div>
      );
    }

    const data = selectedEvent.data;
    
    return (
      <div className={styles.detailPanel}>
        <div className={styles.detailHeader}>
          <h3 className={styles.detailTitle}>{getEventTitle(selectedEvent)}</h3>
          <div className={styles.detailHeaderActions}>
            {selectedEvent.issue && (
              <>
                <button 
                  onClick={() => handleResolveIssue(selectedEvent.issue)}
                  className={styles.resolveButton}
                  title={selectedEvent.issue.status === 'RESOLVED' ? "Reopen issue" : "Resolve issue"}
                  style={{
                    backgroundColor: selectedEvent.issue.status === 'RESOLVED' ? '#22c55e' : undefined,
                    opacity: selectedEvent.issue.status === 'RESOLVED' ? 1 : undefined
                  }}
                >
                  {selectedEvent.issue.status === 'RESOLVED' ? '✅ Resolved' : '⭕ Resolve'}
                </button>
                <button 
                  onClick={() => handleIgnoreIssue(selectedEvent.issue)}
                  className={styles.ignoreButton}
                  title={selectedEvent.issue.status === 'IGNORED' ? "Unignore issue" : "Ignore issue - won't appear in main view or auto-report to GitHub"}
                  style={{
                    backgroundColor: selectedEvent.issue.status === 'IGNORED' ? '#6b7280' : undefined,
                    opacity: selectedEvent.issue.status === 'IGNORED' ? 1 : undefined
                  }}
                >
                  {selectedEvent.issue.status === 'IGNORED' ? '🔕 Ignored' : '🔕 Ignore'}
                </button>
              </>
            )}
            <button 
              onClick={() => handleCreateGitHubIssue(selectedEvent)}
              className={styles.githubButton}
              title={selectedEvent.issue?.githubIssueUrl ? "Open existing GitHub issue" : "Create GitHub issue"}
              style={{
                backgroundColor: selectedEvent.issue?.githubIssueUrl ? '#22c55e' : undefined,
                opacity: selectedEvent.issue?.githubIssueUrl ? 1 : undefined
              }}
            >
              {selectedEvent.issue?.githubIssueUrl ? '🐙 ✓' : '🐙'}
            </button>
            <button 
              onClick={() => {
                if (selectedEvent.issue) {
                  setDeletingIssue(selectedEvent.issue);
                } else {
                  setDeletingEvent(selectedEvent);
                }
                setShowDeleteConfirm(true);
              }}
              className={styles.deleteButton}
              title={selectedEvent.issue ? "Delete this issue" : "Delete this event"}
            >
              🗑️
            </button>
            <button 
              onClick={() => {
                setSelectedEvent(null);
                setActiveTab('overview');
              }}
              className={styles.closeButton}
            >
              ✕
            </button>
          </div>
        </div>

        <div className={styles.tabsContainer}>
          <button
            onClick={() => setActiveTab('overview')}
            className={`${styles.tab} ${activeTab === 'overview' ? styles.tabActive : ''}`}
          >
            Overview
          </button>
          {data.exception?.values?.[0]?.stacktrace?.frames && (
            <button
              onClick={() => setActiveTab('stacktrace')}
              className={`${styles.tab} ${activeTab === 'stacktrace' ? styles.tabActive : ''}`}
            >
              Stack Trace
            </button>
          )}
          {((data.breadcrumbs?.values?.length > 0) || (Array.isArray(data.breadcrumbs) && data.breadcrumbs.length > 0)) && (
            <button
              onClick={() => setActiveTab('breadcrumbs')}
              className={`${styles.tab} ${activeTab === 'breadcrumbs' ? styles.tabActive : ''}`}
            >
              Breadcrumbs ({Array.isArray(data.breadcrumbs) ? data.breadcrumbs.length : data.breadcrumbs.values.length})
            </button>
          )}
          {(data.request || data.contexts) && (
            <button
              onClick={() => setActiveTab('context')}
              className={`${styles.tab} ${activeTab === 'context' ? styles.tabActive : ''}`}
            >
              Context
            </button>
          )}
          {(data.type === 'transaction' || selectedEvent.eventType === 'TRANSACTION') && (
            <button
              onClick={() => setActiveTab('performance')}
              className={`${styles.tab} ${activeTab === 'performance' ? styles.tabActive : ''}`}
            >
              ⚡ Performance
            </button>
          )}
          <button
            onClick={() => setActiveTab('raw')}
            className={`${styles.tab} ${activeTab === 'raw' ? styles.tabActive : ''}`}
          >
            Raw JSON
          </button>
        </div>
        
        <div className={styles.detailContent}>
          {activeTab === 'overview' && (
            <>
              <div className={styles.detailSection}>
                <div className={styles.overviewGrid}>
                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Event ID</span>
                    <div className={styles.overviewValueWithCopy}>
                      <span className={styles.overviewValue}>{selectedEvent.id}</span>
                      <button 
                        onClick={() => copyToClipboard(selectedEvent.id.toString())}
                        className={styles.copyIconButton}
                        title="Copy"
                      >
                        📋
                      </button>
                    </div>
                  </div>
                  
                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Type</span>
                    <span 
                      className={styles.eventType}
                      style={{
                        backgroundColor: getEventType(selectedEvent) === 'error' ? 'var(--error-bg)' : 
                                       getEventType(selectedEvent) === 'warning' ? 'var(--warning-bg)' : 
                                       getEventType(selectedEvent) === 'message' ? 'var(--success-bg)' : 'var(--info-bg)',
                        color: getEventType(selectedEvent) === 'error' ? 'var(--error)' : 
                               getEventType(selectedEvent) === 'warning' ? 'var(--warning)' : 
                               getEventType(selectedEvent) === 'message' ? 'var(--success)' : 'var(--info)'
                      }}
                    >
                      {getEventType(selectedEvent) === 'message' ? '💬 MESSAGE' : getEventType(selectedEvent).toUpperCase()}
                    </span>
                  </div>

                  {selectedEvent.issue && (
                    <div className={styles.overviewItem}>
                      <span className={styles.overviewLabel}>Status</span>
                      <span 
                        className={styles.eventType}
                        style={{
                          backgroundColor: selectedEvent.issue.status === 'RESOLVED' ? 'var(--success-bg)' : 
                                         selectedEvent.issue.status === 'IGNORED' ? 'var(--bg-tertiary)' : 
                                         selectedEvent.issue.status === 'IN_PROGRESS' ? 'var(--warning-bg)' : 'var(--error-bg)',
                          color: selectedEvent.issue.status === 'RESOLVED' ? 'var(--success)' : 
                                selectedEvent.issue.status === 'IGNORED' ? 'var(--text-secondary)' : 
                                selectedEvent.issue.status === 'IN_PROGRESS' ? 'var(--warning)' : 'var(--error)'
                        }}
                      >
                        {selectedEvent.issue.status === 'IN_PROGRESS' ? 'IN PROGRESS' : selectedEvent.issue.status}
                      </span>
                    </div>
                  )}

                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Project</span>
                    <span className={styles.overviewValue}>{selectedEvent.project?.name || 'Unknown Project'}</span>
                  </div>

                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Timestamp</span>
                    <span className={styles.overviewValue}>
                      {new Date(selectedEvent.createdAt).toLocaleString()}
                    </span>
                  </div>

                  {data.level && (
                    <div className={styles.overviewItem}>
                      <span className={styles.overviewLabel}>Level</span>
                      <span className={styles.overviewValue}>{data.level}</span>
                    </div>
                  )}

                  {data.environment && (
                    <div className={styles.overviewItem}>
                      <span className={styles.overviewLabel}>Environment</span>
                      <span className={styles.overviewValue}>{data.environment}</span>
                    </div>
                  )}

                  {data.platform && (
                    <div className={styles.overviewItem}>
                      <span className={styles.overviewLabel}>Platform</span>
                      <span className={styles.overviewValue}>{data.platform}</span>
                    </div>
                  )}

                  {data.release && (
                    <div className={styles.overviewItem}>
                      <span className={styles.overviewLabel}>Release</span>
                      <span className={styles.overviewValue}>{data.release}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* User Information */}
              {data.user && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>👤 User Information</h4>
                  <div className={styles.infoCard}>
                    <div className={styles.infoGrid}>
                      {data.user.id && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>User ID</span>
                          <span className={styles.infoValue}>{data.user.id}</span>
                        </div>
                      )}
                      {data.user.username && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Username</span>
                          <span className={styles.infoValue}>{data.user.username}</span>
                        </div>
                      )}
                      {data.user.email && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Email</span>
                          <span className={styles.infoValue}>{data.user.email}</span>
                        </div>
                      )}
                      {data.user.ip_address && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>IP Address</span>
                          <span className={styles.infoValue}>{data.user.ip_address}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Device & Browser Information */}
              {(data.contexts?.device || data.contexts?.browser || data.contexts?.os) && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>💻 Device & Browser</h4>
                  <div className={styles.infoCard}>
                    <div className={styles.infoGrid}>
                      {data.contexts?.browser?.name && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Browser</span>
                          <span className={styles.infoValue}>
                            {data.contexts.browser.name} {data.contexts.browser.version || ''}
                          </span>
                        </div>
                      )}
                      {data.contexts?.os?.name && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Operating System</span>
                          <span className={styles.infoValue}>
                            {data.contexts.os.name} {data.contexts.os.version || ''}
                          </span>
                        </div>
                      )}
                      {data.contexts?.device?.family && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Device</span>
                          <span className={styles.infoValue}>
                            {data.contexts.device.family} {data.contexts.device.model || ''}
                          </span>
                        </div>
                      )}
                      {data.contexts?.device?.screen_resolution && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Screen Resolution</span>
                          <span className={styles.infoValue}>{data.contexts.device.screen_resolution}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* SDK Information */}
              {data.sdk && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>🔧 SDK Information</h4>
                  <div className={styles.infoCard}>
                    <div className={styles.infoGrid}>
                      {data.sdk.name && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>SDK Name</span>
                          <span className={styles.infoValue}>{data.sdk.name}</span>
                        </div>
                      )}
                      {data.sdk.version && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>SDK Version</span>
                          <span className={styles.infoValue}>{data.sdk.version}</span>
                        </div>
                      )}
                      {data.sdk.packages && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Packages</span>
                          <span className={styles.infoValue}>
                            {data.sdk.packages.map(p => `${p.name}@${p.version}`).join(', ')}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Runtime Information */}
              {data.contexts?.runtime && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>⚡ Runtime Information</h4>
                  <div className={styles.infoCard}>
                    <div className={styles.infoGrid}>
                      {data.contexts.runtime.name && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Runtime</span>
                          <span className={styles.infoValue}>
                            {data.contexts.runtime.name} {data.contexts.runtime.version || ''}
                          </span>
                        </div>
                      )}
                      {data.contexts.runtime.build && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Build</span>
                          <span className={styles.infoValue}>{data.contexts.runtime.build}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* CSP Violation Details */}
              {(data.type === 'csp' || data.csp || selectedEvent.issue?.violatedDirective) && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>🛡️ CSP Violation Details</h4>
                  <div className={styles.infoCard}>
                    <div className={styles.infoGrid}>
                      {(data.contexts?.csp?.violated_directive || selectedEvent.issue?.violatedDirective) && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Violated Directive</span>
                          <span className={styles.infoValue}>
                            {data.contexts?.csp?.violated_directive || selectedEvent.issue?.violatedDirective}
                          </span>
                        </div>
                      )}
                      {(data.contexts?.csp?.blocked_uri || selectedEvent.issue?.blockedUri) && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Blocked URI</span>
                          <span className={styles.infoValue}>
                            {data.contexts?.csp?.blocked_uri || selectedEvent.issue?.blockedUri}
                          </span>
                        </div>
                      )}
                      {(data.contexts?.csp?.document_uri || data.csp?.['document-uri']) && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Document URI</span>
                          <span className={styles.infoValue}>
                            {data.contexts?.csp?.document_uri || data.csp?.['document-uri']}
                          </span>
                        </div>
                      )}
                      {(data.contexts?.csp?.source_file || selectedEvent.issue?.sourceFile) && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Source File</span>
                          <span className={styles.infoValue}>
                            {data.contexts?.csp?.source_file || selectedEvent.issue?.sourceFile}
                          </span>
                        </div>
                      )}
                      {(data.contexts?.csp?.disposition || data.csp?.disposition) && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Disposition</span>
                          <span className={styles.infoValue}>
                            {data.contexts?.csp?.disposition || data.csp?.disposition}
                          </span>
                        </div>
                      )}
                    </div>
                    {(data.contexts?.csp?.original_policy || data.csp?.['original-policy']) && (
                      <div style={{ marginTop: 'var(--space-3)' }}>
                        <span className={styles.infoLabel}>Original Policy</span>
                        <pre className={styles.codeBlock} style={{ fontSize: '10px', marginTop: 'var(--space-1)' }}>
                          {data.contexts?.csp?.original_policy || data.csp?.['original-policy']}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Minidump/Crash Details */}
              {(data.type === 'minidump' || data.minidump) && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>💥 Native Crash Details</h4>
                  <div className={styles.infoCard}>
                    <div className={styles.infoGrid}>
                      {data.minidump?.crash_reason && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Crash Reason</span>
                          <span className={styles.infoValue}>{data.minidump.crash_reason}</span>
                        </div>
                      )}
                      {data.minidump?.crash_address && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Crash Address</span>
                          <span className={styles.infoValue}>{data.minidump.crash_address}</span>
                        </div>
                      )}
                      {data.minidump?.platform && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>Platform</span>
                          <span className={styles.infoValue}>{data.minidump.platform}</span>
                        </div>
                      )}
                      {data.minidump?.os_version && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>OS Version</span>
                          <span className={styles.infoValue}>{data.minidump.os_version}</span>
                        </div>
                      )}
                      {data.minidump?.app_version && (
                        <div className={styles.infoItem}>
                          <span className={styles.infoLabel}>App Version</span>
                          <span className={styles.infoValue}>{data.minidump.app_version}</span>
                        </div>
                      )}
                    </div>
                    {data.minidump?.note && (
                      <div style={{ marginTop: 'var(--space-2)', fontSize: '11px', color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                        ℹ️ {data.minidump.note}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Message or Exception */}
              {data.exception ? (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>Exception</h4>
                  <div className={styles.exceptionBox}>
                    <div className={styles.exceptionType}>
                      {data.exception.values?.[0]?.type || 'Exception'}
                    </div>
                    <div className={styles.exceptionValue}>
                      {data.exception.values?.[0]?.value || 'No message'}
                    </div>
                  </div>
                </div>
              ) : data.message ? (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>💬 Message</h4>
                  <div className={styles.exceptionBox} style={{ backgroundColor: 'var(--success-bg)', borderColor: 'var(--success)' }}>
                    <div className={styles.exceptionValue} style={{ color: 'var(--text-primary)' }}>
                      {data.message}
                    </div>
                  </div>
                </div>
              ) : null}

              {data.tags && Object.keys(data.tags).length > 0 && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>Tags</h4>
                  <div className={styles.tagsContainer}>
                    {Object.entries(data.tags).map(([key, value]) => (
                      <div key={key} className={styles.tag}>
                        <span className={styles.tagKey}>{key}:</span>
                        <span className={styles.tagValue}>{value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}

          {activeTab === 'stacktrace' && data.exception && (
            <div className={styles.detailSection}>
              <h4 className={styles.detailSectionTitle}>Stack Trace</h4>
              {renderStackTrace(data.exception)}
            </div>
          )}

          {activeTab === 'breadcrumbs' && (data.breadcrumbs?.values || (Array.isArray(data.breadcrumbs) && data.breadcrumbs.length > 0)) && (
            <div className={styles.detailSection}>
              <h4 className={styles.detailSectionTitle}>Breadcrumbs</h4>
              <div className={styles.breadcrumbsContainer}>
                {(Array.isArray(data.breadcrumbs) ? data.breadcrumbs : data.breadcrumbs.values).map((crumb, idx) => {
                  // Format timestamp if it's a unix timestamp
                  const timestamp = crumb.timestamp 
                    ? (typeof crumb.timestamp === 'number' && crumb.timestamp > 1000000000000 
                        ? new Date(crumb.timestamp).toLocaleString()
                        : typeof crumb.timestamp === 'number' && crumb.timestamp > 1000000000
                        ? new Date(crumb.timestamp * 1000).toLocaleString()
                        : crumb.timestamp)
                    : '';
                  
                  return (
                    <div key={idx} className={styles.breadcrumb}>
                      <div className={styles.breadcrumbHeader}>
                        <span className={styles.breadcrumbType}>
                          {crumb.type || crumb.category || crumb.level || 'default'}
                        </span>
                        <span className={styles.breadcrumbTime}>{timestamp}</span>
                      </div>
                      {crumb.message && (
                        <div className={styles.breadcrumbMessage}>{crumb.message}</div>
                      )}
                      {crumb.data && (
                        <pre className={styles.breadcrumbData}>
                          {JSON.stringify(crumb.data, null, 2)}
                        </pre>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {activeTab === 'context' && (
            <>
              {data.request && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>Request</h4>
                  <pre className={styles.codeBlock}>
                    {JSON.stringify(data.request, null, 2)}
                  </pre>
                </div>
              )}
              {data.contexts && (
                <div className={styles.detailSection}>
                  <h4 className={styles.detailSectionTitle}>Contexts</h4>
                  <pre className={styles.codeBlock}>
                    {JSON.stringify(data.contexts, null, 2)}
                  </pre>
                </div>
              )}
            </>
          )}

          {activeTab === 'performance' && (
            <>
              {(() => {
                // Extract performance metrics
                const duration = data.timestamp && data.start_timestamp 
                  ? (data.timestamp - data.start_timestamp) 
                  : 0;
                
                const formatBytes = (bytes) => {
                  if (!bytes || bytes === 0) return '0 Bytes';
                  const k = 1024;
                  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
                  const i = Math.floor(Math.log(bytes) / Math.log(k));
                  return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
                };

                const formatDuration = (seconds) => {
                  if (!seconds) return '0ms';
                  if (seconds < 1) return `${Math.round(seconds * 1000)}ms`;
                  return `${seconds.toFixed(3)}s`;
                };

                // Extract metrics from breadcrumbs
                const metrics = {};
                if (data.breadcrumbs) {
                  const breadcrumbs = data.breadcrumbs.values || data.breadcrumbs;
                  if (Array.isArray(breadcrumbs)) {
                    breadcrumbs.forEach(bc => {
                      const msg = bc.message || '';
                      
                      // Memory metrics
                      if (msg.includes('Heap Used:')) {
                        const match = msg.match(/([\d.]+)\s*MB/);
                        if (match) metrics.heapUsed = parseFloat(match[1]);
                      }
                      if (msg.includes('Heap Total:')) {
                        const match = msg.match(/([\d.]+)\s*MB/);
                        if (match) metrics.heapTotal = parseFloat(match[1]);
                      }
                      if (msg.includes('RSS:')) {
                        const match = msg.match(/([\d.]+)\s*MB/);
                        if (match) metrics.rss = parseFloat(match[1]);
                      }
                      
                      // Performance metrics
                      if (msg.includes('CPU usage:')) {
                        const match = msg.match(/([\d.]+)%/);
                        if (match) metrics.cpu = parseFloat(match[1]);
                      }
                      if (msg.includes('event loop lag:')) {
                        const match = msg.match(/([\d.]+)\s*ms/);
                        if (match) metrics.eventLoopLag = parseFloat(match[1]);
                      }
                      if (msg.includes('active connections:')) {
                        const match = msg.match(/:\s*(\d+)/);
                        if (match) metrics.activeConnections = parseInt(match[1]);
                      }
                      if (msg.includes('throughput:')) {
                        const match = msg.match(/([\d.]+)\s*req\/s/);
                        if (match) metrics.throughput = parseFloat(match[1]);
                      }
                    });
                  }
                }

                // Get memory from contexts
                const appMemory = data.contexts?.app?.app_memory;
                const freeMemory = data.contexts?.device?.free_memory;
                const totalMemory = data.contexts?.device?.memory_size;

                const renderMetricCard = (label, value, color = '#3b82f6') => (
                  <div style={{
                    background: 'var(--bg-secondary)',
                    padding: '16px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-primary)'
                  }}>
                    <div style={{
                      fontSize: '12px',
                      color: 'var(--text-secondary)',
                      marginBottom: '8px',
                      fontWeight: '600',
                      textTransform: 'uppercase',
                      letterSpacing: '0.05em'
                    }}>
                      {label}
                    </div>
                    <div style={{
                      fontSize: '24px',
                      fontWeight: 'bold',
                      color: color
                    }}>
                      {value}
                    </div>
                  </div>
                );

                const renderBarChart = (label, value, max, color, unit = '') => {
                  const percentage = max > 0 ? (value / max) * 100 : 0;
                  return (
                    <div style={{ marginBottom: '16px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        marginBottom: '6px',
                        fontSize: '13px'
                      }}>
                        <span style={{ fontWeight: '500', color: 'var(--text-primary)' }}>{label}</span>
                        <span style={{ color: 'var(--text-secondary)' }}>{value.toFixed(2)}{unit}</span>
                      </div>
                      <div style={{
                        width: '100%',
                        height: '20px',
                        background: 'var(--bg-tertiary)',
                        borderRadius: '4px',
                        overflow: 'hidden'
                      }}>
                        <div style={{
                          width: `${percentage}%`,
                          height: '100%',
                          background: color,
                          transition: 'width 0.3s ease'
                        }}></div>
                      </div>
                    </div>
                  );
                };

                return (
                  <>
                    {/* Transaction Info */}
                    <div className={styles.detailSection}>
                      <h4 className={styles.detailSectionTitle}>Transaction Overview</h4>
                      <div style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                        gap: '16px',
                        marginBottom: '20px'
                      }}>
                        {renderMetricCard('Duration', formatDuration(duration), '#8b5cf6')}
                        {data.transaction && renderMetricCard('Transaction', data.transaction, '#3b82f6')}
                        {data.contexts?.trace?.status && renderMetricCard('Status', data.contexts.trace.status.toUpperCase(), '#10b981')}
                        {data.environment && renderMetricCard('Environment', data.environment, '#f59e0b')}
                      </div>
                    </div>

                    {/* Memory Metrics */}
                    {(metrics.heapUsed || metrics.heapTotal || metrics.rss || appMemory) && (
                      <div className={styles.detailSection}>
                        <h4 className={styles.detailSectionTitle}>💾 Memory Metrics</h4>
                        <div style={{
                          background: 'var(--bg-secondary)',
                          padding: '20px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-primary)'
                        }}>
                          {metrics.heapUsed && metrics.heapTotal && (
                            <>
                              {renderBarChart('Heap Used', metrics.heapUsed, metrics.heapTotal, 'linear-gradient(90deg, #00E396 0%, #00A875 100%)', ' MB')}
                              <div style={{
                                fontSize: '12px',
                                color: 'var(--text-secondary)',
                                marginBottom: '12px'
                              }}>
                                Heap Utilization: {((metrics.heapUsed / metrics.heapTotal) * 100).toFixed(1)}%
                              </div>
                            </>
                          )}
                          {metrics.rss && (
                            renderBarChart('RSS Memory', metrics.rss, metrics.rss * 1.2, 'linear-gradient(90deg, #FEB019 0%, #FF6B6B 100%)', ' MB')
                          )}
                          {appMemory && (
                            renderBarChart('App Memory', appMemory / 1024 / 1024, (appMemory / 1024 / 1024) * 1.2, 'linear-gradient(90deg, #008FFB 0%, #00E396 100%)', ' MB')
                          )}
                          
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: '12px',
                            marginTop: '16px',
                            paddingTop: '16px',
                            borderTop: '1px solid var(--border-primary)'
                          }}>
                            {metrics.heapUsed && (
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Heap Used</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.heapUsed.toFixed(2)} MB</div>
                              </div>
                            )}
                            {metrics.heapTotal && (
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Heap Total</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.heapTotal.toFixed(2)} MB</div>
                              </div>
                            )}
                            {metrics.rss && (
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>RSS</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.rss.toFixed(2)} MB</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* System Metrics */}
                    {(metrics.cpu !== undefined || metrics.eventLoopLag || metrics.activeConnections) && (
                      <div className={styles.detailSection}>
                        <h4 className={styles.detailSectionTitle}>⚡ System Performance</h4>
                        <div style={{
                          background: 'var(--bg-secondary)',
                          padding: '20px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-primary)'
                        }}>
                          {metrics.cpu !== undefined && (
                            <>
                              {renderBarChart('CPU Usage', metrics.cpu, 100, 'linear-gradient(90deg, #FF4560 0%, #FF6B6B 100%)', '%')}
                              <div style={{
                                fontSize: '12px',
                                color: metrics.cpu < 1 ? '#10b981' : metrics.cpu < 50 ? '#f59e0b' : '#ef4444',
                                marginBottom: '12px',
                                fontWeight: '500'
                              }}>
                                {metrics.cpu < 1 ? '✅ Excellent - Very Low' : metrics.cpu < 50 ? '⚠️ Moderate' : '❌ High - Needs Attention'}
                              </div>
                            </>
                          )}
                          {metrics.eventLoopLag && (
                            <>
                              {renderBarChart('Event Loop Lag', metrics.eventLoopLag, 10, 'linear-gradient(90deg, #775DD0 0%, #9B7FE8 100%)', ' ms')}
                              <div style={{
                                fontSize: '12px',
                                color: metrics.eventLoopLag < 10 ? '#10b981' : metrics.eventLoopLag < 50 ? '#f59e0b' : '#ef4444',
                                marginBottom: '12px',
                                fontWeight: '500'
                              }}>
                                {metrics.eventLoopLag < 10 ? '✅ Healthy (< 10ms)' : metrics.eventLoopLag < 50 ? '⚠️ Moderate' : '❌ High Latency'}
                              </div>
                            </>
                          )}
                          
                          <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
                            gap: '12px',
                            marginTop: '16px',
                            paddingTop: '16px',
                            borderTop: '1px solid var(--border-primary)'
                          }}>
                            {metrics.cpu !== undefined && (
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>CPU Usage</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.cpu.toFixed(2)}%</div>
                              </div>
                            )}
                            {metrics.eventLoopLag && (
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Event Loop Lag</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.eventLoopLag.toFixed(2)} ms</div>
                              </div>
                            )}
                            {metrics.activeConnections && (
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Active Connections</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.activeConnections}</div>
                              </div>
                            )}
                            {metrics.throughput && (
                              <div>
                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Throughput</div>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{metrics.throughput.toFixed(2)} req/s</div>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Device Info */}
                    {data.contexts?.device && (
                      <div className={styles.detailSection}>
                        <h4 className={styles.detailSectionTitle}>🖥️ Device Information</h4>
                        <div style={{
                          background: 'var(--bg-secondary)',
                          padding: '16px',
                          borderRadius: '8px',
                          border: '1px solid var(--border-primary)',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                          gap: '12px'
                        }}>
                          {data.contexts.device.cpu_description && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>CPU</div>
                              <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{data.contexts.device.cpu_description}</div>
                            </div>
                          )}
                          {data.contexts.device.processor_count && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Cores</div>
                              <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{data.contexts.device.processor_count}</div>
                            </div>
                          )}
                          {data.contexts.device.memory_size && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Total Memory</div>
                              <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{formatBytes(data.contexts.device.memory_size)}</div>
                            </div>
                          )}
                          {data.contexts.device.free_memory && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Free Memory</div>
                              <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{formatBytes(data.contexts.device.free_memory)}</div>
                            </div>
                          )}
                          {data.contexts.device.arch && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Architecture</div>
                              <div style={{ fontSize: '14px', color: 'var(--text-primary)' }}>{data.contexts.device.arch}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Performance Summary */}
                    <div className={styles.detailSection}>
                      <h4 className={styles.detailSectionTitle}>📊 Performance Summary</h4>
                      <div style={{
                        background: 'var(--bg-secondary)',
                        padding: '20px',
                        borderRadius: '8px',
                        border: '1px solid var(--border-primary)'
                      }}>
                        <div style={{
                          fontSize: '18px',
                          fontWeight: 'bold',
                          marginBottom: '12px',
                          color: 'var(--text-primary)'
                        }}>
                          Overall Assessment
                        </div>
                        <div style={{
                          fontSize: '14px',
                          lineHeight: '1.6',
                          color: 'var(--text-secondary)'
                        }}>
                          {metrics.cpu !== undefined && metrics.eventLoopLag ? (
                            metrics.cpu < 1 && metrics.eventLoopLag < 10 ? (
                              <div style={{ color: '#10b981', fontWeight: '600' }}>
                                ✅ EXCELLENT - System is performing optimally
                              </div>
                            ) : metrics.cpu < 5 && metrics.eventLoopLag < 50 ? (
                              <div style={{ color: '#f59e0b', fontWeight: '600' }}>
                                ⚠️ GOOD - System is performing well
                              </div>
                            ) : (
                              <div style={{ color: '#ef4444', fontWeight: '600' }}>
                                ❌ NEEDS ATTENTION - Consider optimization
                              </div>
                            )
                          ) : (
                            <div>Performance metrics available. Review individual sections above for details.</div>
                          )}
                        </div>
                        <div style={{
                          marginTop: '16px',
                          paddingTop: '16px',
                          borderTop: '1px solid var(--border-primary)',
                          display: 'grid',
                          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                          gap: '12px'
                        }}>
                          <div>
                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Transaction Duration</div>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{formatDuration(duration)}</div>
                          </div>
                          {data.spans && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Spans</div>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{data.spans.length}</div>
                            </div>
                          )}
                          {data.server_name && (
                            <div>
                              <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '4px' }}>Server</div>
                              <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-primary)' }}>{data.server_name}</div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </>
          )}

          {activeTab === 'raw' && (
            <div className={styles.detailSection}>
              <div className={styles.rawHeaderWithCopy}>
                <h4 className={styles.detailSectionTitle}>Raw Event Data</h4>
                <button 
                  onClick={() => copyToClipboard(JSON.stringify(data, null, 2))}
                  className={styles.copyButton}
                >
                  📋 Copy JSON
                </button>
              </div>
              <pre className={styles.codeBlock}>
                {JSON.stringify(data, null, 2)}
              </pre>
            </div>
          )}
        </div>
      </div>
    );
  };

  if (!user) return null;

  return (
    <>
      <Head>
        <title>Dashboard - Sentry Monitor</title>
      </Head>
      
      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <h1 className={styles.logo}>
              <span className={styles.logoIcon}>⚡</span>
              Sentry Monitor
            </h1>
            <div className={styles.headerActions}>
              <span className={styles.userEmail}>{user.email}</span>
              <ThemeToggle />
              <button 
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={styles.headerButton}
                style={{
                  backgroundColor: autoRefresh ? 'var(--accent-primary)' : 'var(--bg-secondary)',
                  color: autoRefresh ? 'white' : 'var(--text-primary)',
                  borderColor: autoRefresh ? 'var(--accent-primary)' : 'var(--border-primary)'
                }}
              >
                {autoRefresh ? '● Live' : '○ Paused'}
              </button>
              <button 
                onClick={handleDeduplicate}
                className={styles.headerButton}
                disabled={isDeduplicating}
                title="Merge duplicate issues"
                style={{
                  opacity: isDeduplicating ? 0.6 : 1,
                  cursor: isDeduplicating ? 'wait' : 'pointer'
                }}
              >
                {isDeduplicating ? '🔄 Merging...' : '🔀 Deduplicate'}
              </button>
              <button onClick={fetchData} className={styles.headerButton}>
                Refresh
              </button>
              <button 
                onClick={handleLogout} 
                className={styles.headerButton}
                style={{ backgroundColor: 'var(--error)', color: 'white', borderColor: 'var(--error)' }}
              >
                Logout
              </button>
            </div>
          </div>
        </header>

        <div className={styles.main}>
          {!sidebarCollapsed && (
            <aside className={styles.sidebar}>
              <div className={styles.sidebarSection}>
                <div className={styles.sidebarHeader}>
                  <div className={styles.sidebarTitleContainer}>
                    <button
                      onClick={() => setProjectsCollapsed(!projectsCollapsed)}
                      className={styles.collapseButton}
                      title={projectsCollapsed ? 'Expand projects' : 'Collapse projects'}
                    >
                      <span 
                        className={styles.collapseIcon}
                        style={{
                          transform: projectsCollapsed ? 'rotate(-90deg)' : 'rotate(0deg)'
                        }}
                      >
                        ▼
                      </span>
                    </button>
                    <h3 className={styles.sidebarTitle}>Projects</h3>
                  </div>
                  <button 
                    onClick={() => setShowNewProjectModal(true)}
                    className={styles.addButton}
                    title="Create new project"
                  >
                    +
                  </button>
                </div>
              {!projectsCollapsed && (
                <div className={styles.projectsList}>
                  <button
                    onClick={() => setSelectedProject(null)}
                    className={`${styles.projectItem} ${selectedProject === null ? styles.projectItemActive : ''}`}
                  >
                    <span>All Projects</span>
                    <span className={styles.badge}>
                      {issues.filter(issue => issue.status !== 'RESOLVED' && issue.status !== 'IGNORED').length}
                    </span>
                  </button>
                  {projects.map(project => (
                    <div key={project.id} className={styles.projectItemContainer}>
                      <button
                        onClick={() => setSelectedProject(project.id)}
                        className={`${styles.projectItem} ${selectedProject === project.id ? styles.projectItemActive : ''}`}
                      >
                        <span>{project.name}</span>
                        <span className={styles.badge}>{project._count.issues || 0}</span>
                      </button>
                      {selectedProject === project.id && (
                        <Link 
                          href={`/project/${project.id}`}
                          className={styles.settingsLink}
                        >
                          ⚙️ Settings
                        </Link>
                      )}
                    </div>
                  ))}
                </div>
              )}
              </div>
            </aside>
          )}

          <div className={styles.contentWrapper}>
            {/* Sidebar toggle button */}
            <button
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              className={styles.sidebarToggle}
              title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            >
              <span style={{
                transform: sidebarCollapsed ? 'rotate(0deg)' : 'rotate(180deg)',
                display: 'inline-block',
                transition: 'transform 0.3s ease'
              }}>
                ◀
              </span>
            </button>

            <div className={styles.content}>
            <div className={styles.eventsList}>
              <div className={styles.eventsHeader}>
                {isSelectionMode && (
                  <div className={styles.selectionToolbar}>
                    <div className={styles.selectionToolbarLeft}>
                      <input
                        type="checkbox"
                        checked={selectedEvents.length === filteredIssues.length && filteredIssues.length > 0}
                        onChange={toggleSelectAll}
                        className={styles.checkbox}
                      />
                      <span className={styles.selectionCount}>
                        {selectedEvents.length} selected
                      </span>
                    </div>
                    <div className={styles.selectionToolbarRight}>
                      <button
                        onClick={() => {
                          setDeletingIssue({ bulk: true, count: selectedEvents.length });
                          setShowDeleteConfirm(true);
                        }}
                        disabled={selectedEvents.length === 0}
                        className={styles.bulkDeleteButton}
                      >
                        🗑️ Delete ({selectedEvents.length})
                      </button>
                      <button
                        onClick={exitSelectionMode}
                        className={styles.cancelSelectionButton}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
                <div className={styles.eventsHeaderTop}>
                  <h2 className={styles.eventsTitle}>
                    Issues & Events ({filteredIssues.length})
                  </h2>
                  {!isSelectionMode && (
                    <div className={styles.filterToolbar}>
                      <div className={styles.filterGroup}>
                        <select 
                          value={filterLevel} 
                          onChange={(e) => setFilterLevel(e.target.value)}
                          className={styles.filterSelect}
                        >
                          <option value="all">All Levels</option>
                          <option value="error">🔴 Errors</option>
                          <option value="warning">🟡 Warnings</option>
                          <option value="info">🔵 Info</option>
                        </select>
                        <select 
                          value={filterStatus} 
                          onChange={(e) => setFilterStatus(e.target.value)}
                          className={styles.filterSelect}
                        >
                          <option value="active">⚡ Active</option>
                          <option value="unresolved">⭕ Unresolved</option>
                          <option value="resolved">✅ Resolved</option>
                          <option value="ignored">🔕 Ignored</option>
                          <option value="all">All Statuses</option>
                        </select>
                        <select 
                          value={filterEventType} 
                          onChange={(e) => setFilterEventType(e.target.value)}
                          className={styles.filterSelect}
                        >
                          <option value="all">All Types</option>
                          <option value="ERROR">🔴 Errors</option>
                          <option value="CSP">🛡️ CSP Violations</option>
                          <option value="MINIDUMP">💥 Crashes</option>
                          <option value="TRANSACTION">⚡ Performance</option>
                          <option value="MESSAGE">💬 Messages</option>
                        </select>
                      </div>
                      <button
                        onClick={() => setIsSelectionMode(true)}
                        className={styles.selectButton}
                      >
                        ☑️ Select
                      </button>
                    </div>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Search issues..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              {loading ? (
                <div className={styles.loading}>Loading issues...</div>
              ) : projects.length === 0 ? (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}>🚀</div>
                  <h3 className={styles.emptyTitle}>Get Started</h3>
                  <p className={styles.emptyText}>
                    Create your first project to start monitoring errors.
                  </p>
                  <button 
                    onClick={() => setShowNewProjectModal(true)}
                    className={styles.createButton}
                  >
                    Create Project
                  </button>
                </div>
              ) : filteredIssues.length === 0 ? (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}>📊</div>
                  <h3 className={styles.emptyTitle}>
                    {issues.length === 0 ? 'No issues yet' : 'No matching issues'}
                  </h3>
                  <p className={styles.emptyText}>
                    {issues.length === 0 
                      ? 'Send your first error to see it appear here.'
                      : 'Try adjusting your search or filter criteria.'
                    }
                  </p>
                </div>
              ) : (
                <div className={styles.eventsContainer}>
                  {filteredIssues.map(issue => {
                    const type = issue.level;
                    const isSelected = selectedEvents.includes(issue.id);
                    return (
                      <div
                        key={issue.id}
                        onClick={async () => {
                          if (isSelectionMode) {
                            toggleEventSelection(issue.id);
                          } else {
                            // Handle standalone events vs issues differently
                            if (issue._isStandaloneEvent) {
                              // For standalone events, just show the event directly
                              setSelectedEvent(issue._event);
                              setActiveTab('overview');
                            } else {
                              // Fetch the latest event for this issue to show details
                              try {
                                const response = await fetch(`/api/issues/${issue.id}`);
                                const data = await response.json();
                                if (data.success && data.issue.events && data.issue.events.length > 0) {
                                  // Show the most recent event with the issue attached
                                  setSelectedEvent({
                                    ...data.issue.events[0],
                                    issue: issue
                                  });
                                  // Reset events list when switching issues
                                  setIssueEvents([]);
                                  setActiveTab('overview');
                                }
                              } catch (error) {
                                console.error('Error fetching issue details:', error);
                              }
                            }
                          }
                        }}
                        className={`${styles.eventCard} ${isSelected ? styles.eventCardSelected : ''}`}
                        style={{
                          borderLeftColor: type === 'error' ? 'var(--error)' : 
                                         type === 'warning' ? 'var(--warning)' : 
                                         type === 'info' ? 'var(--info)' : 'var(--success)',
                        }}
                      >
                        {isSelectionMode && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEventSelection(issue.id)}
                            className={styles.eventCheckbox}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <div className={styles.eventHeader}>
                          <span 
                            className={styles.eventType}
                            style={{
                              backgroundColor: type === 'error' ? 'var(--error-bg)' : 
                                             type === 'warning' ? 'var(--warning-bg)' : 
                                             type === 'info' ? 'var(--info-bg)' : 'var(--success-bg)',
                              color: type === 'error' ? 'var(--error)' : 
                                     type === 'warning' ? 'var(--warning)' : 
                                     type === 'info' ? 'var(--info)' : 'var(--success)'
                            }}
                          >
                            {type.toUpperCase()}
                          </span>
                          <span className={styles.eventTime}>{formatDate(issue.lastSeen)}</span>
                        </div>
                        <h4 className={styles.eventTitle}>
                          {issue.title}
                          {issue.count > 1 && (
                            <span className={styles.occurrenceBadge}>
                              <button 
                                onClick={(e) => navigateToPreviousEvent(issue, e)}
                                className={styles.navButton}
                                title="Previous duplicate event"
                              >
                                &lt;
                              </button>
                              <span className={styles.eventCounter}>
                                {(issueEventIndices[issue.id] || 0) + 1}/{issue.count}
                              </span>
                              <button 
                                onClick={(e) => navigateToNextEvent(issue, e)}
                                className={styles.navButton}
                                title="Next duplicate event"
                              >
                                &gt;
                              </button>
                            </span>
                          )}
                          {(() => {
                            const typeBadge = getEventTypeBadge(issue);
                            return typeBadge ? (
                              <span 
                                className={styles.eventTypeBadge} 
                                title={`${typeBadge.label} event`}
                                style={{ backgroundColor: typeBadge.color }}
                              >
                                {typeBadge.icon} {typeBadge.label}
                              </span>
                            ) : null;
                          })()}
                          {issue.githubIssueUrl && (
                            <span className={styles.githubBadge} title="GitHub issue exists">
                              🐙
                            </span>
                          )}
                          {!issue._isStandaloneEvent && issue.status === 'RESOLVED' && (
                            <span 
                              className={styles.resolvedBadge} 
                              title="Issue resolved - click to reopen"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleResolveIssue(issue);
                              }}
                            >
                              ✅
                            </span>
                          )}
                          {!issue._isStandaloneEvent && issue.status === 'IGNORED' && (
                            <span 
                              className={styles.ignoredBadge} 
                              title="Issue ignored - click to unignore"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleIgnoreIssue(issue);
                              }}
                            >
                              🔕
                            </span>
                          )}
                        </h4>
                        <div className={styles.eventMeta}>
                          <span>{issue.project?.name || 'Unknown Project'}</span>
                          <span>• {issue.status}</span>
                          {!issue._isStandaloneEvent && issue.status !== 'RESOLVED' && issue.status !== 'IGNORED' && (
                            <>
                              <button
                                className={styles.quickResolveButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleResolveIssue(issue);
                                }}
                                title="Resolve this issue"
                              >
                                Resolve
                              </button>
                              <button
                                className={styles.quickIgnoreButton}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleIgnoreIssue(issue);
                                }}
                                title="Ignore this issue - won't appear in main view or auto-report to GitHub"
                              >
                                Ignore
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {renderEventDetail()}
            </div>
          </div>
        </div>

        {/* New Project Modal */}
        {showNewProjectModal && (
          <div className={styles.modalOverlay} onClick={() => setShowNewProjectModal(false)}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>Create New Project</h3>
              <form onSubmit={handleCreateProject}>
                <input
                  type="text"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="Project name"
                  className={styles.modalInput}
                  required
                  autoFocus
                />
                <div className={styles.modalButtons}>
                  <button type="button" onClick={() => setShowNewProjectModal(false)} className={styles.modalButtonCancel}>
                    Cancel
                  </button>
                  <button type="submit" className={styles.modalButtonSubmit}>
                    Create
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {showDeleteConfirm && (deletingIssue || deletingEvent) && (
          <div className={styles.modalOverlay} onClick={() => {
            setShowDeleteConfirm(false);
            setDeletingIssue(null);
            setDeletingEvent(null);
          }}>
            <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>
                {deletingIssue 
                  ? (deletingIssue.bulk ? 'Delete Multiple Issues' : 'Delete Issue')
                  : (deletingEvent?.bulk ? 'Delete Multiple Events' : 'Delete Event')
                }
              </h3>
              <p className={styles.modalText}>
                {deletingIssue 
                  ? (deletingIssue.bulk 
                      ? `Are you sure you want to delete ${deletingIssue.count} issue${deletingIssue.count > 1 ? 's' : ''}? This will also delete all associated events. This action cannot be undone.`
                      : `Are you sure you want to delete this issue? This will also delete ${deletingIssue.count || 1} associated event${(deletingIssue.count || 1) > 1 ? 's' : ''}. This action cannot be undone.`
                  )
                  : (deletingEvent?.bulk 
                      ? `Are you sure you want to delete ${deletingEvent.count} event${deletingEvent.count > 1 ? 's' : ''}? This action cannot be undone.`
                      : 'Are you sure you want to delete this event? This action cannot be undone.'
                  )
                }
              </p>
              {deletingIssue && !deletingIssue.bulk && (
                <div className={styles.modalEventPreview}>
                  <strong>{deletingIssue.title}</strong>
                  <br />
                  <span className={styles.modalEventMeta}>
                    {deletingIssue.project?.name || 'Unknown Project'} • {deletingIssue.count || 1} occurrence{(deletingIssue.count || 1) > 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {!deletingIssue && deletingEvent && !deletingEvent.bulk && (
                <div className={styles.modalEventPreview}>
                  <strong>{getEventTitle(deletingEvent)}</strong>
                  <br />
                  <span className={styles.modalEventMeta}>
                    {deletingEvent.project?.name || 'Unknown Project'} • {new Date(deletingEvent.createdAt).toLocaleString()}
                  </span>
                </div>
              )}
              {deletingIssue?.bulk && (
                <div className={styles.modalEventPreview}>
                  <strong>⚠️ You are about to delete {deletingIssue.count} issue{deletingIssue.count > 1 ? 's' : ''}</strong>
                </div>
              )}
              {!deletingIssue && deletingEvent?.bulk && (
                <div className={styles.modalEventPreview}>
                  <strong>⚠️ You are about to delete {deletingEvent.count} event{deletingEvent.count > 1 ? 's' : ''}</strong>
                </div>
              )}
              <div className={styles.modalButtons}>
                <button 
                  type="button" 
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    setDeletingIssue(null);
                    setDeletingEvent(null);
                  }} 
                  className={styles.modalButtonCancel}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  onClick={deletingIssue 
                    ? (deletingIssue.bulk ? handleBulkDelete : handleDeleteIssue)
                    : (deletingEvent?.bulk ? handleBulkDelete : handleDeleteEvent)
                  }
                  className={styles.modalButtonDelete}
                >
                  Delete {deletingIssue 
                    ? (deletingIssue.bulk ? `${deletingIssue.count} Issue${deletingIssue.count > 1 ? 's' : ''}` : 'Issue')
                    : (deletingEvent?.bulk ? `${deletingEvent.count} Event${deletingEvent.count > 1 ? 's' : ''}` : 'Event')
                  }
                </button>
              </div>
            </div>
          </div>
        )}

        {/* GitHub Issue Modal */}
        {showGitHubModal && (
          <div className={styles.modalOverlay} onClick={() => setShowGitHubModal(false)}>
            <div className={styles.modal} style={{ maxWidth: '600px', width: '90%' }} onClick={(e) => e.stopPropagation()}>
              <h3 className={styles.modalTitle}>🐙 Create GitHub Issue</h3>
              <p className={styles.modalText}>
                Copy the information below and create an issue on your GitHub repository.
              </p>
              
              <div className={styles.githubFormGroup}>
                <label className={styles.githubLabel}>Issue Title</label>
                <input
                  type="text"
                  value={githubIssueData.title}
                  onChange={(e) => setGithubIssueData({...githubIssueData, title: e.target.value})}
                  className={styles.modalInput}
                  placeholder="Issue title"
                />
              </div>
              
              <div className={styles.githubFormGroup}>
                <label className={styles.githubLabel}>Issue Body (Markdown)</label>
                <textarea
                  value={githubIssueData.body}
                  onChange={(e) => setGithubIssueData({...githubIssueData, body: e.target.value})}
                  className={styles.modalTextarea}
                  style={{ height: '300px' }}
                  placeholder="Issue description"
                />
              </div>
              
              <div className={styles.githubInstructions}>
                <strong>📋 Instructions:</strong>
                <ol className={styles.githubSteps}>
                  <li>Copy the title and body above</li>
                  <li>Go to your GitHub repository</li>
                  <li>Click &quot;Issues&quot; → &quot;New Issue&quot;</li>
                  <li>Paste the content and submit</li>
                </ol>
              </div>
              
              <div className={styles.modalButtons}>
                <button 
                  type="button" 
                  onClick={() => {
                    navigator.clipboard.writeText(`Title: ${githubIssueData.title}\n\n${githubIssueData.body}`);
                    alert('Copied to clipboard!');
                  }} 
                  className={styles.modalButtonSubmit}
                >
                  📋 Copy All
                </button>
                <button 
                  type="button"
                  onClick={() => setShowGitHubModal(false)}
                  className={styles.modalButtonCancel}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

