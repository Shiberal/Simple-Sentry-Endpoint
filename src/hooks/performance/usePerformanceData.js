import { useEffect, useRef, useState } from 'react';
import useMountEffect from '@/hooks/useMountEffect';
import { buildPerformanceSeries } from '@/lib/performance-series';

const DETAILED_LIVE_REFRESH_INTERVAL_MS = 1000;
const TIMESERIES_LIVE_REFRESH_INTERVAL_MS = 5000;
const HOUR_MS = 60 * 60 * 1000;
export const DETAILED_WINDOWS = [['1h', HOUR_MS], ['6h', 6 * HOUR_MS], ['24h', 24 * HOUR_MS], ['7d', 168 * HOUR_MS], ['30d', 720 * HOUR_MS]];
export const DETAILED_ROW_CAP = 2000; // keep in sync with the API's result limit for date-bounded requests

/**
 * All state and data fetching for the performance page: projects, the filters, the detailed
 * (raw transactions) and time-series views, and live refresh.
 */
export default function usePerformanceData({ router }) {
  const [transactions, setTransactions] = useState([]);
  const [monitorCheckIns, setMonitorCheckIns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [analytics, setAnalytics] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);
  const [projects, setProjects] = useState([]);
  const [viewMode, setViewMode] = useState('detailed'); // 'detailed' or 'timeseries'
  const [timeRange, setTimeRange] = useState('30d'); // '7d', '30d', 'custom'
  const [interval, setAggregationInterval] = useState('day'); // 'hour' or 'day'
  const [timeSeriesData, setTimeSeriesData] = useState(null);
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [performanceSeries, setPerformanceSeries] = useState([]);
  const [selectedEndpoint, setSelectedEndpoint] = useState('all'); // Filter by endpoint/transaction name
  const [pageUrlFilter, setPageUrlFilter] = useState('');
  const [originFilter, setOriginFilter] = useState('all'); // host events came from
  const [origins, setOrigins] = useState([]);
  const [selectedMetric, setSelectedMetric] = useState('duration'); // duration, memory, cpu
  const [availableEndpoints, setAvailableEndpoints] = useState([]);
  const [error, setError] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [detailedWindow, setDetailedWindow] = useState('6h');
  const [overview, setOverview] = useState(null);
  const overviewRef = useRef({ key: '', at: 0 });
  const windowMs = DETAILED_WINDOWS.find(([k]) => k === detailedWindow)[1];
  const refreshInFlightRef = useRef(false);
  const selectedProjectRef = useRef(selectedProject);

  const fetchProjects = async () => {
    try {
      const response = await fetch('/api/projects');
      const data = await response.json();
      const projectsList = data.projects || [];
      setProjects(projectsList);
      if (projectsList.length > 0 && selectedProject === null) {
        setSelectedProject(projectsList[0].id);
      }
    } catch (error) {
      console.error('Error fetching projects:', error);
      setProjects([]);
    }
  };

  const fetchTransactions = async (optionalProjectId) => {
    let projectId = optionalProjectId !== undefined ? optionalProjectId : selectedProject;

    // Safety check for [object Object] or other invalid IDs
    if (typeof projectId === 'object' && projectId !== null) {
      console.warn('[fetchTransactions] Received object as projectId, attempting to extract id', projectId);
      projectId = projectId.id || null;
    }

    if (projectId === null || projectId === undefined || projectId === '[object Object]') {
      setTransactions([]);
      setMonitorCheckIns([]);
      setAnalytics(null);
      setPerformanceSeries([]);
      setAvailableEndpoints([]);
      setLoading(false);
      return;
    }

    const isBackgroundRefresh = optionalProjectId !== undefined;
    if (!isBackgroundRefresh) {
      setLoading(true);
    }
    setError(null);
    try {
      const end = new Date();
      const start = new Date(end.getTime() - windowMs);
      const params = new URLSearchParams({
        projectId: String(projectId),
        startDate: start.toISOString(),
        endDate: end.toISOString()
      });
      const pageUrl = typeof pageUrlFilter === 'string' ? pageUrlFilter.trim() : '';
      if (pageUrl) params.set('pageUrl', pageUrl);
      if (originFilter !== 'all') params.set('origin', originFilter);

      // Overview numbers are aggregated server-side over the whole period; the row fetch below is capped
      // Background refreshes re-run the SQL at most every 10s for the same view
      const overviewKey = `${projectId}|${detailedWindow}|${pageUrl}|${originFilter}`;
      const overviewFresh = isBackgroundRefresh && overviewRef.current.key === overviewKey && Date.now() - overviewRef.current.at < 10000;
      const overviewRequest = overviewFresh ? Promise.resolve() : fetch(`/api/analytics/performance/overview?${params}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => { overviewRef.current = { key: overviewKey, at: Date.now() }; setOverview(j?.summary ?? null); })
        .catch(() => {});
      const response = await fetch(`/api/analytics/performance?${params}`);
      await overviewRequest;
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to fetch: ${response.statusText}`);
      }
      const data = await response.json();
      setTransactions(data.transactions || []);
      setMonitorCheckIns(data.monitorCheckIns || []);
      setAnalytics(data.analytics || null);

      const { series, endpoints } = buildPerformanceSeries(data.transactions);
      setPerformanceSeries(series);
      setAvailableEndpoints(endpoints);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      setError(error.message || 'Failed to load performance data');
      setTransactions([]);
      setMonitorCheckIns([]);
      setAnalytics(null);
      setPerformanceSeries([]);
      setAvailableEndpoints([]);
    } finally {
      if (!isBackgroundRefresh) setLoading(false);
    }
  };

  const fetchTimeSeries = async (optionalProjectId) => {
    let projectId = optionalProjectId !== undefined ? optionalProjectId : selectedProject;

    // Safety check for [object Object] or other invalid IDs
    if (typeof projectId === 'object' && projectId !== null) {
      console.warn('[fetchTimeSeries] Received object as projectId, attempting to extract id', projectId);
      projectId = projectId.id || null;
    }

    if (!projectId || projectId === '[object Object]') return;

    const isBackgroundRefresh = optionalProjectId !== undefined;
    if (!isBackgroundRefresh) {
      setLoading(true);
    }
    try {
      let startDate, endDate;
      const end = new Date();

      if (timeRange === '7d') {
        startDate = new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (timeRange === '30d') {
        startDate = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      } else if (timeRange === 'custom') {
        startDate = customStartDate ? new Date(customStartDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
        endDate = customEndDate ? new Date(customEndDate) : end;
      } else {
        startDate = new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      if (!endDate) {
        endDate = end;
      }

      const params = new URLSearchParams({
        projectId: String(projectId),
        interval: interval,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString()
      });

      const pqTrim =
        typeof pageUrlFilter === 'string' ? pageUrlFilter.trim() : '';
      if (pqTrim) params.set('pageUrl', pqTrim);
      if (originFilter !== 'all') params.set('origin', originFilter);

      const response = await fetch(`/api/analytics/performance/timeseries?${params}`);
      const data = await response.json();
      setTimeSeriesData(data);
    } catch (error) {
      console.error('Error fetching time series:', error);
    } finally {
      if (!isBackgroundRefresh) setLoading(false);
    }
  };

  // Effects below call the newest fetchers (they close over the current filters)
  const fetchersRef = useRef({ fetchTransactions, fetchTimeSeries });
  useEffect(() => {
    fetchersRef.current = { fetchTransactions, fetchTimeSeries };
    selectedProjectRef.current = selectedProject;
  });

  useMountEffect(fetchProjects);

  // Hosts that sent transactions for the selected project
  useEffect(() => {
    if (selectedProject == null) return;
    setOriginFilter('all');
    fetch(`/api/issues/origins?projectId=${selectedProject}&eventType=TRANSACTION`)
      .then((r) => r.json())
      .then((j) => setOrigins(j.origins || []))
      .catch(() => setOrigins([]));
  }, [selectedProject]);

  useEffect(() => {
    if (!router.isReady || !projects.length || !router.query.projectId) return;

    const projectId = parseInt(router.query.projectId, 10);
    if (!isNaN(projectId) && projects.some((project) => project.id === projectId)) {
      setSelectedProject(projectId);
    }
  }, [projects, router.isReady, router.query.projectId]);

  useEffect(() => {
    if (viewMode === 'timeseries') {
      if (selectedProject) {
        fetchersRef.current.fetchTimeSeries();
      }
    } else {
      fetchersRef.current.fetchTransactions();
    }
  }, [selectedProject, viewMode, timeRange, interval, customStartDate, customEndDate, pageUrlFilter, originFilter, detailedWindow]);

  const hasProject = selectedProject != null;
  const refreshIntervalMs = viewMode === 'detailed'
    ? (windowMs > 6 * HOUR_MS ? 15000 : DETAILED_LIVE_REFRESH_INTERVAL_MS)
    : TIMESERIES_LIVE_REFRESH_INTERVAL_MS;

  useEffect(() => {
    if (!autoRefresh || !hasProject) return;

    const refreshLiveData = async () => {
      if (refreshInFlightRef.current) return;

      const projectId = selectedProjectRef.current;
      if (projectId == null) return;

      refreshInFlightRef.current = true;
      try {
        const { fetchTransactions, fetchTimeSeries } = fetchersRef.current;
        await (viewMode === 'timeseries' ? fetchTimeSeries(projectId) : fetchTransactions(projectId));
      } finally {
        refreshInFlightRef.current = false;
      }
    };

    refreshLiveData();
    const id = window.setInterval(refreshLiveData, refreshIntervalMs);

    return () => clearInterval(id);
  }, [autoRefresh, hasProject, viewMode, refreshIntervalMs]);

  return {
    transactions, monitorCheckIns, loading, analytics, selectedProject, setSelectedProject, projects,
    viewMode, setViewMode, timeRange, setTimeRange, interval, setAggregationInterval, timeSeriesData,
    customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, performanceSeries,
    selectedEndpoint, setSelectedEndpoint, pageUrlFilter, setPageUrlFilter, originFilter, setOriginFilter,
    origins, selectedMetric, setSelectedMetric, availableEndpoints, error, setError, autoRefresh, setAutoRefresh,
    detailedWindow, setDetailedWindow, overview, windowMs, fetchTransactions, fetchTimeSeries,
  };
}
