import Icon from '@/components/Icon';
import { useRouter } from 'next/router';
import Head from 'next/head';
import { useState } from 'react';
import AppNav from '@/components/shared/AppNav';
import PerformancePageSkeleton from '@/components/performance/PerformancePageSkeleton';
import PerformanceSidebar from '@/components/performance/PerformanceSidebar';
import PerformanceToolbar from '@/components/performance/PerformanceToolbar';
import DetailedView from '@/components/performance/DetailedView';
import TimeSeriesView from '@/components/performance/TimeSeriesView';
import { EmptyPanel } from '@/components/performance/PerformancePanels';
import usePerformanceData, { DETAILED_WINDOWS, DETAILED_ROW_CAP } from '@/hooks/performance/usePerformanceData';
import useMediaQuery from '@/hooks/useMediaQuery';
import shell from '@/styles/AppShell.module.css';

export default function PerformancePage() {
  const router = useRouter();
  const {
    transactions, monitorCheckIns, loading, analytics, selectedProject, setSelectedProject, projects,
    viewMode, setViewMode, timeRange, setTimeRange, interval, setAggregationInterval, timeSeriesData,
    customStartDate, setCustomStartDate, customEndDate, setCustomEndDate, performanceSeries,
    selectedEndpoint, setSelectedEndpoint, pageUrlFilter, setPageUrlFilter, originFilter, setOriginFilter,
    origins, selectedMetric, setSelectedMetric, availableEndpoints, error, setError, autoRefresh, setAutoRefresh,
    detailedWindow, setDetailedWindow, overview, windowMs, fetchTransactions, fetchTimeSeries,
  } = usePerformanceData({ router });

  // Filter sidebar: starts closed on phone-sized screens until the user toggles it
  const isPhone = useMediaQuery('(max-width: 768px)');
  const [sidebarChoice, setSidebarChoice] = useState(null);
  const sidebarCollapsed = sidebarChoice ?? isPhone;

  const refresh = () => (viewMode === 'timeseries' ? fetchTimeSeries() : fetchTransactions());

  // Filter performance series based on selected endpoint
  const filteredPerformanceSeries = Array.isArray(performanceSeries)
    ? (selectedEndpoint === 'all'
        ? performanceSeries
        : performanceSeries.filter(series => series && series.name === selectedEndpoint))
    : [];

  if (loading && !analytics && !timeSeriesData) {
    return (
      <>
        <Head>
          <title>Performance - Sentry Monitor</title>
        </Head>
        <PerformancePageSkeleton />
      </>
    );
  }

  return (
    <div className={shell.container}>
      <AppNav active="performance">
        {/* Project Selector (Discord-like) */}
        {projects.map(project => (
          <div
            key={project.id}
            className={`${shell.navProjectItem} ${selectedProject === project.id ? shell.navProjectItemActive : ''}`}
            onClick={() => setSelectedProject(project.id)}
            title={project.name}
          >
            {project.name.substring(0, 2).toUpperCase()}
            <div className={shell.navItemTooltip}>{project.name}</div>
          </div>
        ))}
      </AppNav>

      <div className={shell.main}>
        <header className={shell.header}>
          <div className={shell.headerContent}>
            <h1 className={shell.logo}>
              <span className={shell.logoIcon}><Icon name="bolt" size={16} strokeWidth={2} /></span>
              Performance Analytics
            </h1>
            <div className={shell.headerActions}>
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={shell.headerButton}
                title={autoRefresh ? 'Pause auto-refresh' : 'Resume auto-refresh'}
              >
                {autoRefresh ? '●' : '○'} {autoRefresh ? 'Live' : 'Paused'}
              </button>
              <button
                onClick={refresh}
                className={shell.headerButton}
                title="Refresh data"
              >
                <Icon name="refresh" size={14} /> Refresh
              </button>
            </div>
          </div>
        </header>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          {!sidebarCollapsed && (
            <PerformanceSidebar
              projects={projects}
              selectedProject={selectedProject}
              selectedEndpoint={selectedEndpoint}
              setSelectedEndpoint={setSelectedEndpoint}
              availableEndpoints={availableEndpoints}
              origins={origins}
              originFilter={originFilter}
              setOriginFilter={setOriginFilter}
              pageUrlFilter={pageUrlFilter}
              setPageUrlFilter={setPageUrlFilter}
              selectedMetric={selectedMetric}
              setSelectedMetric={setSelectedMetric}
            />
          )}

          <div className={shell.contentWrapper} style={{ position: 'relative' }}>
            <button
              onClick={() => setSidebarChoice(!sidebarCollapsed)}
              className={shell.sidebarToggle}
              aria-label={sidebarCollapsed ? 'Show filters' : 'Hide filters'}
              title={sidebarCollapsed ? 'Show sidebar' : 'Hide sidebar'}
            >
              <Icon name={sidebarCollapsed ? 'chevronRight' : 'chevronLeft'} size={14} strokeWidth={2} />
            </button>

            <div style={{
              flex: 1,
              overflowY: 'auto',
              padding: 'var(--space-4)',
              height: 'calc(100vh - 36px)'
            }}>
              <PerformanceToolbar
                viewMode={viewMode}
                setViewMode={setViewMode}
                timeRange={timeRange}
                setTimeRange={setTimeRange}
                interval={interval}
                setAggregationInterval={setAggregationInterval}
                customStartDate={customStartDate}
                setCustomStartDate={setCustomStartDate}
                customEndDate={customEndDate}
                setCustomEndDate={setCustomEndDate}
                onRefresh={refresh}
              />

              {viewMode === 'timeseries' && timeSeriesData && (
                <TimeSeriesView data={timeSeriesData} interval={interval} />
              )}

              {viewMode === 'detailed' && (
                <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)' }}>Period</span>
                  <div role="group" aria-label="Period" style={{ display: 'inline-flex', border: '1px solid var(--border-primary)', borderRadius: 'var(--radius-md)', overflow: 'hidden' }}>
                    {DETAILED_WINDOWS.map(([k]) => (
                      <button
                        key={k}
                        type="button"
                        aria-pressed={detailedWindow === k}
                        onClick={() => setDetailedWindow(k)}
                        style={{ padding: '6px 14px', border: 0, cursor: 'pointer', background: detailedWindow === k ? 'var(--accent-primary)' : 'transparent', color: detailedWindow === k ? 'white' : 'var(--text-secondary)' }}
                      >Last {k}</button>
                    ))}
                  </div>
                  {transactions.length >= DETAILED_ROW_CAP && (
                    <span style={{ fontSize: 'var(--font-xs)', color: 'var(--warning)' }}>Overview covers the whole period; the charts below show the newest {DETAILED_ROW_CAP} transactions.</span>
                  )}
                </div>
              )}

              {viewMode === 'detailed' && analytics && (
                <DetailedView
                  analytics={analytics}
                  overview={overview}
                  selectedEndpoint={selectedEndpoint}
                  onSelectEndpoint={setSelectedEndpoint}
                  filteredPerformanceSeries={filteredPerformanceSeries}
                  selectedMetric={selectedMetric}
                  windowMs={windowMs}
                  windowLabel={detailedWindow}
                  transactions={transactions}
                  monitorCheckIns={monitorCheckIns}
                />
              )}

              {error && (
                <div style={{
                  background: 'var(--bg-primary)',
                  padding: 'var(--space-4)',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                  border: '1px solid var(--error)',
                  boxShadow: 'var(--shadow-sm)',
                  marginBottom: 'var(--space-4)'
                }}>
                  <p style={{ fontSize: 'var(--font-base)', color: 'var(--error)' }}>Error: {error}</p>
                  <button
                    onClick={() => {
                      setError(null);
                      if (selectedProject) {
                        fetchTransactions();
                      }
                    }}
                    style={{
                      marginTop: 'var(--space-2)',
                      padding: 'var(--space-2) var(--space-4)',
                      borderRadius: 'var(--radius-sm)',
                      border: 'none',
                      background: 'var(--accent-primary)',
                      color: 'white',
                      cursor: 'pointer'
                    }}
                  >
                    Retry
                  </button>
                </div>
              )}

              {viewMode === 'detailed' && !analytics && !loading && !error && (
                selectedProject === null || selectedProject === undefined ? (
                  <EmptyPanel
                    title="Please select a project to view performance data."
                    hint="Choose a project from the sidebar to get started."
                  />
                ) : (
                  <EmptyPanel
                    title="No transaction data available yet."
                    hint="Send some transaction events to see performance analytics."
                  />
                )
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
