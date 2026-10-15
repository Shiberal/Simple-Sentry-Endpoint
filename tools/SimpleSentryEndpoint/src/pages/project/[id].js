import { useEffect } from 'react';
import Router, { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import ProjectSettingsSkeleton from '@/components/ProjectSettingsSkeleton';
import ConnectionSections from '@/components/project/ConnectionSections';
import ProjectInfoSection from '@/components/project/ProjectInfoSection';
import TeamSection from '@/components/project/TeamSection';
import GitHubSection from '@/components/project/GitHubSection';
import IngestSection from '@/components/project/IngestSection';
import TelegramSection from '@/components/project/TelegramSection';
import IgnoredIssuesSection from '@/components/project/IgnoredIssuesSection';
import ClearDataSection from '@/components/project/ClearDataSection';
import DeleteProjectSection from '@/components/project/DeleteProjectSection';
import useProject from '@/hooks/project/useProject';
import styles from '@/styles/ProjectSettings.module.css';

export default function ProjectSettings() {
  const router = useRouter();
  const { id } = router.query;

  // Validate project id to prevent SSRF/path traversal: only allow positive integer
  const projectId = (typeof id === 'string' && /^\d+$/.test(id) && parseInt(id, 10) > 0)
    ? id
    : null;

  useEffect(() => {
    if (id && !projectId) Router.push('/dashboard');
  }, [id, projectId]);

  const {
    project, loading, isProjectOwner, projectMembers, ignoredIssues,
    refreshProject, refreshMembers, refreshIgnored,
  } = useProject(projectId);

  if (!projectId || loading || !project) {
    return (
      <>
        <Head>
          <title>Project settings - Sentry Monitor</title>
        </Head>
        <ProjectSettingsSkeleton />
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{project.name} - Settings</title>
      </Head>

      <div className={styles.container}>
        <header className={styles.header}>
          <div className={styles.headerContent}>
            <Link href="/dashboard" className={styles.backLink}>
              ← Back to Dashboard
            </Link>
            <h1 className={styles.title}>{project.name}</h1>
          </div>
        </header>

        <div className={styles.main}>
          <ConnectionSections project={project} />
          <ProjectInfoSection project={project} />
          {isProjectOwner && (
            <TeamSection
              projectId={projectId}
              projectMembers={projectMembers}
              refreshMembers={refreshMembers}
              refreshProject={refreshProject}
            />
          )}
          <GitHubSection project={project} projectId={projectId} />
          <IngestSection project={project} projectId={projectId} />
          <TelegramSection project={project} projectId={projectId} />
          <IgnoredIssuesSection ignoredIssues={ignoredIssues} onChanged={refreshIgnored} />
          <ClearDataSection project={project} projectId={projectId} onCleared={refreshProject} />
          <DeleteProjectSection project={project} projectId={projectId} />
        </div>
      </div>
    </>
  );
}
