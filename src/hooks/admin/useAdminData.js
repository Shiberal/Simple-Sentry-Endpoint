import { useState } from 'react';
import Router from 'next/router';
import useMountEffect from '@/hooks/useMountEffect';

/** Admin-only data for the admin panel; sends everyone else to /login or /dashboard. */
export default function useAdminData({ showNotification }) {
  const [user, setUser] = useState(null);
  const [users, setUsers] = useState([]);
  const [projects, setProjects] = useState([]);
  const [stats, setStats] = useState(null);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, projectsRes, statsRes, settingsRes] = await Promise.all([
        fetch('/api/admin/users'),
        fetch('/api/admin/projects'),
        fetch('/api/admin/stats'),
        fetch('/api/admin/settings')
      ]);

      const usersData = await usersRes.json();
      const projectsData = await projectsRes.json();
      const statsData = await statsRes.json();
      const settingsData = await settingsRes.json();

      if (usersData.success) {
        setUsers(usersData.users);
      }
      if (projectsData.success) {
        setProjects(projectsData.projects);
      }
      if (statsData.success) {
        setStats(statsData.stats);
      }
      if (settingsData.success) {
        setSettings(settingsData.settings);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      showNotification('Error fetching data', 'error');
    } finally {
      setLoading(false);
    }
  };

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me');
      const data = await response.json();
      if (!data?.user || !data.user.isAdmin) {
        if (!data?.user) Router.push('/login');
        else Router.push('/dashboard');
        return;
      }
      setUser(data.user);
      fetchData();
    } catch (error) {
      Router.push('/login');
    }
  };

  useMountEffect(checkAuth);

  return { user, users, projects, stats, settings, loading, refresh: fetchData };
}
