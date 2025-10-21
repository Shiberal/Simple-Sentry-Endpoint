import { useState, useEffect } from 'react';
import Head from "next/head";
import { useRouter } from 'next/router';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';
import styles from '@/styles/Dashboard.module.css';

export default function Dashboard() {
  const router = useRouter();
  const [events, setEvents] = useState([]);
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
  const [filterLevel, setFilterLevel] = useState('all');
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
      const eventsUrl = selectedProject 
        ? `/api/events?projectId=${selectedProject}` 
        : `/api/events`;
        
      const [eventsRes, projectsRes] = await Promise.all([
        fetch(eventsUrl),
        fetch('/api/projects')
      ]);
      
      const eventsData = await eventsRes.json();
      const projectsData = await projectsRes.json();
      
      if (eventsData.success) {
        setEvents(eventsData.events);
      }
      if (projectsData.success) setProjects(projectsData.projects);
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
        if (selectedIssue?.id === deletingIssue.id) {
          setSelectedIssue(null);
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
      // Delete all selected events
      const deletePromises = selectedEvents.map(eventId =>
        fetch(`/api/events/${eventId}`, { method: 'DELETE' })
      );
      
      const results = await Promise.all(deletePromises);
      const allSuccessful = results.every(res => res.ok);
      
      if (allSuccessful) {
        // Close detail panel if selected event was deleted
        if (selectedEvent && selectedEvents.includes(selectedEvent.id)) {
          setSelectedEvent(null);
        }
        // Clear selection and refresh
        setSelectedEvents([]);
        setIsSelectionMode(false);
        fetchData();
        setShowDeleteConfirm(false);
      } else {
        alert('Some events failed to delete');
      }
    } catch (error) {
      console.error('Error deleting events:', error);
      alert('Error deleting events');
    }
  };

  const toggleEventSelection = (eventId) => {
    setSelectedEvents(prev => 
      prev.includes(eventId) 
        ? prev.filter(id => id !== eventId)
        : [...prev, eventId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedEvents.length === filteredEvents.length) {
      setSelectedEvents([]);
    } else {
      setSelectedEvents(filteredEvents.map(e => e.id));
    }
  };

  const exitSelectionMode = () => {
    setIsSelectionMode(false);
    setSelectedEvents([]);
  };

  const handleCreateGitHubIssue = async (event) => {
    const title = `🐛 ${getEventTitle(event)}`;
    const data = event.data;
    const issue = event.issue;
    
    // Generate enhanced issue body
    let body = `## 🚨 Error Report\n\n`;
    
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
      body += `- **Times occurred:** ${issue.count}\n`;
      body += `- **First seen:** ${new Date(issue.firstSeen).toLocaleString()}\n`;
      body += `- **Last seen:** ${new Date(issue.lastSeen).toLocaleString()}\n`;
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
    if (data.breadcrumbs?.values?.length > 0) {
      body += `### 🍞 Breadcrumbs (Last 10)\n\n`;
      data.breadcrumbs.values.slice(-10).forEach((crumb, idx) => {
        const time = crumb.timestamp ? new Date(crumb.timestamp * 1000).toLocaleTimeString() : '';
        body += `${idx + 1}. **[${crumb.category || 'default'}]** ${crumb.message || crumb.type} `;
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
    body += `📁 **Project:** ${event.project.name}\n`;
    
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
    if (event.project.githubRepo) {
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
        
        if (event.project.githubToken) {
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

  const getEventType = (event) => {
    // Support both event and issue data structures
    const data = event.data || event;
    if (data.level === 'error' || event.level === 'error' || data.exception) return 'error';
    if (data.level === 'warning' || event.level === 'warning') return 'warning';
    if (data.level === 'info' || event.level === 'info') return 'info';
    return 'event';
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

  const filteredEvents = events.filter(event => {
    const matchesSearch = !searchQuery || 
      getEventTitle(event).toLowerCase().includes(searchQuery.toLowerCase()) ||
      event.project.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesLevel = filterLevel === 'all' || 
      getEventType(event) === filterLevel;
    
    return matchesSearch && matchesLevel;
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
            <button 
              onClick={() => handleCreateGitHubIssue(selectedEvent)}
              className={styles.githubButton}
              title="Create GitHub issue"
            >
              🐙
            </button>
            <button 
              onClick={() => {
                setDeletingEvent(selectedEvent);
                setShowDeleteConfirm(true);
              }}
              className={styles.deleteButton}
              title="Delete this event"
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
          {data.exception && (
            <button
              onClick={() => setActiveTab('stacktrace')}
              className={`${styles.tab} ${activeTab === 'stacktrace' ? styles.tabActive : ''}`}
            >
              Stack Trace
            </button>
          )}
          {data.breadcrumbs?.values?.length > 0 && (
            <button
              onClick={() => setActiveTab('breadcrumbs')}
              className={`${styles.tab} ${activeTab === 'breadcrumbs' ? styles.tabActive : ''}`}
            >
              Breadcrumbs
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
                                       getEventType(selectedEvent) === 'warning' ? 'var(--warning-bg)' : 'var(--info-bg)',
                        color: getEventType(selectedEvent) === 'error' ? 'var(--error)' : 
                               getEventType(selectedEvent) === 'warning' ? 'var(--warning)' : 'var(--info)'
                      }}
                    >
                      {getEventType(selectedEvent).toUpperCase()}
                    </span>
                  </div>

                  <div className={styles.overviewItem}>
                    <span className={styles.overviewLabel}>Project</span>
                    <span className={styles.overviewValue}>{selectedEvent.project.name}</span>
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

              {data.exception && (
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
              )}

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

          {activeTab === 'breadcrumbs' && data.breadcrumbs?.values && (
            <div className={styles.detailSection}>
              <h4 className={styles.detailSectionTitle}>Breadcrumbs</h4>
              <div className={styles.breadcrumbsContainer}>
                {data.breadcrumbs.values.map((crumb, idx) => (
                  <div key={idx} className={styles.breadcrumb}>
                    <div className={styles.breadcrumbHeader}>
                      <span className={styles.breadcrumbType}>{crumb.type || 'default'}</span>
                      <span className={styles.breadcrumbTime}>{crumb.timestamp}</span>
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
                ))}
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
                    <span className={styles.badge}>{events.length}</span>
                  </button>
                  {projects.map(project => (
                    <div key={project.id} className={styles.projectItemContainer}>
                      <button
                        onClick={() => setSelectedProject(project.id)}
                        className={`${styles.projectItem} ${selectedProject === project.id ? styles.projectItemActive : ''}`}
                      >
                        <span>{project.name}</span>
                        <span className={styles.badge}>{project._count.events}</span>
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
                        checked={selectedEvents.length === filteredEvents.length && filteredEvents.length > 0}
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
                          setDeletingEvent({ bulk: true, count: selectedEvents.length });
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
                    Events ({filteredEvents.length})
                  </h2>
                  <div className={styles.filterButtons}>
                    {!isSelectionMode && (
                      <>
                        <button
                          onClick={() => setFilterLevel('all')}
                          className={`${styles.filterButton} ${filterLevel === 'all' ? styles.filterButtonActive : ''}`}
                        >
                          All Levels
                        </button>
                        <button
                          onClick={() => setFilterLevel('error')}
                          className={`${styles.filterButton} ${filterLevel === 'error' ? styles.filterButtonActive : ''}`}
                        >
                          🔴 Errors
                        </button>
                        <button
                          onClick={() => setFilterLevel('warning')}
                          className={`${styles.filterButton} ${filterLevel === 'warning' ? styles.filterButtonActive : ''}`}
                        >
                          🟡 Warnings
                        </button>
                        <button
                          onClick={() => setFilterLevel('info')}
                          className={`${styles.filterButton} ${filterLevel === 'info' ? styles.filterButtonActive : ''}`}
                        >
                          🔵 Info
                        </button>
                        <button
                          onClick={() => setIsSelectionMode(true)}
                          className={styles.selectButton}
                        >
                          ☑️ Select
                        </button>
                      </>
                    )}
                  </div>
                </div>
                <input
                  type="text"
                  placeholder="Search events..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className={styles.searchInput}
                />
              </div>

              {loading ? (
                <div className={styles.loading}>Loading events...</div>
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
              ) : filteredEvents.length === 0 ? (
                <div className={styles.empty}>
                  <div className={styles.emptyIcon}>📊</div>
                  <h3 className={styles.emptyTitle}>
                    {events.length === 0 ? 'No events yet' : 'No matching events'}
                  </h3>
                  <p className={styles.emptyText}>
                    {events.length === 0 
                      ? 'Send your first error to see it appear here.'
                      : 'Try adjusting your search or filter criteria.'
                    }
                  </p>
                </div>
              ) : (
                <div className={styles.eventsContainer}>
                  {filteredEvents.map(event => {
                    const type = getEventType(event);
                    const isSelected = selectedEvents.includes(event.id);
                    return (
                      <div
                        key={event.id}
                        onClick={() => {
                          if (isSelectionMode) {
                            toggleEventSelection(event.id);
                          } else {
                            setSelectedEvent(event);
                          }
                        }}
                        className={`${styles.eventCard} ${isSelected ? styles.eventCardSelected : ''}`}
                        style={{
                          borderLeftColor: type === 'error' ? 'var(--error)' : 
                                         type === 'warning' ? 'var(--warning)' : 'var(--info)',
                        }}
                      >
                        {isSelectionMode && (
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => toggleEventSelection(event.id)}
                            className={styles.eventCheckbox}
                            onClick={(e) => e.stopPropagation()}
                          />
                        )}
                        <div className={styles.eventHeader}>
                          <span 
                            className={styles.eventType}
                            style={{
                              backgroundColor: type === 'error' ? 'var(--error-bg)' : 
                                             type === 'warning' ? 'var(--warning-bg)' : 'var(--info-bg)',
                              color: type === 'error' ? 'var(--error)' : 
                                     type === 'warning' ? 'var(--warning)' : 'var(--info)'
                            }}
                          >
                            {type.toUpperCase()}
                          </span>
                          <span className={styles.eventTime}>{formatDate(event.createdAt)}</span>
                        </div>
                        <h4 className={styles.eventTitle}>{getEventTitle(event)}</h4>
                        <div className={styles.eventMeta}>
                          <span>{event.project.name}</span>
                          {event.data.environment && (
                            <span>• {event.data.environment}</span>
                          )}
                          {event.data.platform && (
                            <span>• {event.data.platform}</span>
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
                  ? 'Delete Issue'
                  : (deletingEvent?.bulk ? 'Delete Multiple Events' : 'Delete Event')
                }
              </h3>
              <p className={styles.modalText}>
                {deletingIssue 
                  ? `Are you sure you want to delete this issue? This will also delete ${deletingIssue.count} associated event${deletingIssue.count > 1 ? 's' : ''}. This action cannot be undone.`
                  : (deletingEvent?.bulk 
                      ? `Are you sure you want to delete ${deletingEvent.count} event${deletingEvent.count > 1 ? 's' : ''}? This action cannot be undone.`
                      : 'Are you sure you want to delete this event? This action cannot be undone.'
                  )
                }
              </p>
              {deletingIssue && (
                <div className={styles.modalEventPreview}>
                  <strong>{getEventTitle(deletingIssue)}</strong>
                  <br />
                  <span className={styles.modalEventMeta}>
                    {deletingIssue.project?.name} • {deletingIssue.count} occurrence{deletingIssue.count > 1 ? 's' : ''}
                  </span>
                </div>
              )}
              {!deletingIssue && deletingEvent && !deletingEvent.bulk && (
                <div className={styles.modalEventPreview}>
                  <strong>{getEventTitle(deletingEvent)}</strong>
                  <br />
                  <span className={styles.modalEventMeta}>
                    {deletingEvent.project.name} • {new Date(deletingEvent.createdAt).toLocaleString()}
                  </span>
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
                    ? handleDeleteIssue 
                    : (deletingEvent?.bulk ? handleBulkDelete : handleDeleteEvent)
                  }
                  className={styles.modalButtonDelete}
                >
                  Delete {deletingIssue 
                    ? 'Issue'
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

