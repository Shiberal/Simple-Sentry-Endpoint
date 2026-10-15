import { useCallback, useEffect, useState } from 'react';
import Router from 'next/router';

/**
 * Signed-in user plus the project's settings, members and ignored issues.
 * Redirects to /login for anonymous visitors and to /dashboard when the project cannot be loaded.
 */
export default function useProject(projectId) {
  const [user, setUser] = useState(null);
  const [project, setProject] = useState(null);
  const [projectMembers, setProjectMembers] = useState([]);
  const [ignoredIssues, setIgnoredIssues] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchProjectMembers = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/projects/${projectId}/users`);
      if (response.ok) {
        const data = await response.json();
        setProjectMembers(data.members || []);
      }
    } catch (error) {
      console.error('Error fetching project members:', error);
    }
  }, [projectId]);

  const fetchIgnoredIssues = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/issues?projectId=${projectId}&status=ignored&pageSize=100`);
      if (response.ok) {
        const data = await response.json();
        setIgnoredIssues(data.issues || []);
      }
    } catch (error) {
      console.error('Error fetching ignored issues:', error);
    }
  }, [projectId]);

  const fetchProject = useCallback(async () => {
    if (!projectId) return;
    try {
      const response = await fetch(`/api/projects/${projectId}`);
      if (!response.ok) {
        Router.push('/dashboard');
        return;
      }
      const data = await response.json();
      setProject(data.project);
      fetchProjectMembers();
      fetchIgnoredIssues();
    } catch (error) {
      console.error('Error fetching project:', error);
      Router.push('/dashboard');
    } finally {
      setLoading(false);
    }
  }, [projectId, fetchProjectMembers, fetchIgnoredIssues]);

  useEffect(() => {
    if (!projectId) return;
    (async () => {
      try {
        const response = await fetch('/api/auth/me');
        const data = await response.json();
        if (!data?.user) {
          Router.push('/login');
          return;
        }
        setUser(data.user);
        fetchProject();
      } catch (error) {
        Router.push('/login');
      }
    })();
  }, [projectId, fetchProject]);

  const isProjectOwner = !!(user && project?.projectOwners?.some(owner => owner.id === user.id));

  return {
    user, project, loading, isProjectOwner, projectMembers, ignoredIssues,
    refreshProject: fetchProject, refreshMembers: fetchProjectMembers, refreshIgnored: fetchIgnoredIssues,
  };
}
