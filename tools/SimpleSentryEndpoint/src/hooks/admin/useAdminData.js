import { useState } from 'react';
import Router from 'next/router';
import useMountEffect from '@/hooks/useMountEffect';

/** Admin-only data for the admin panel; sends login-required users to /login. */
export default function useAdminData({ showNotification }) {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [insights, setInsights] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  const fetchData = async () => {
    try {
      const [usersRes, projectsRes, statsRes, settingsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/projects'),
        fetch('/api/admin/stats'),
        fetch('/api/admin/settings')
      ]);

      const usersData = await usersRes.json().catch(() => ({}));
      const projectsData = await projectsRes.json().catch(() => ({}));
      const statsData = await statsRes.json().catch(() => ({}));
      const settingsData = await settingsRes.json().catch(() => ({}));

      if (usersRes.status === 403 || projectsRes.status === 403) {
        setAccessDenied(true);
        return;
      }

      if (usersData.success) {
        setUsers(usersData.users);
      }
      if (projectsData.success) {
        setProjects(projectsData.projects);
      }
      if (statsData.success) {
        setStats(statsData.stats);
        setInsights({
          stats: statsData.stats,
          storage: statsData.storage,
          ingest: statsData.ingest,
          process: statsData.process,
          workers: statsData.workers,
          alerts: statsData.alerts,
          generatedAt: statsData.generatedAt,
        });
      } else if (!statsRes.ok) {
        showNotification(statsData.error || 'Failed to load insights', 'error');
      }
      if (settingsData.success) {
        setSettings(settingsData.settings);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Error fetching data', 'error');
    }
  };

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (!data?.user) {
        Router.push('/login');
        return;
      }
      if (!data.user.isAdmin) {
        setUser(data.user);
        setAccessDenied(true);
        setLoading(false);
        return;
      }
      setAccessDenied(false);
      setUser(data.user);
      setLoading(false);
      fetchData();
    } catch (error) {
      Router.push('/login');
    }
  };

  useMountEffect(checkAuth);

  return {
    user,
    users,
    projects,
    stats,
    insights,
    settings,
    loading,
    accessDenied,
    refresh: fetchData,
  };
}
