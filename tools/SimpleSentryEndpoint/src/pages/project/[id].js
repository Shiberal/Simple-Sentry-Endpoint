import { useEffect } from 'react';
import Router, { useRouter } from 'next/router';
import Head from 'next/head';
import Icon from '@/components/Icon';
import AppNav from '@/components/shared/AppNav';
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
import shell from '@/styles/AppShell.module.css';
import styles from '@/styles/ProjectSettings.module.css';

export default function ProjectSettings() {
  const router = useRouter();
  const { id } = router.query;

  // Validate project id to prevent SSRF/path traversal: only allow positive integer
  const projectId = (typeof id === 'string' && /^\d+$/.test(id) && parseInt(id, 10) > 0)
    ? id
    : null;

  useEffect(() => {
    if (id && !projectId) Router.push('/hub/sentry');
  }, [id, projectId]);

  const {
    user, project, loading, isProjectOwner, projectMembers, ignoredIssues,
    refreshProject, refreshMembers, refreshIgnored,
  } = useProject(projectId);

  if (!projectId || loading || !project) {
    return (
      <>
        <Head>
          <title>Project settings · EDT</title>
        </Head>
        <div className={shell.container}>
          <AppNav active="projects" isAdmin={user?.isAdmin} user={user} />
          <div className={shell.main}>
            <ProjectSettingsSkeleton />
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Head>
        <title>{project.name} · Settings · EDT</title>
      </Head>

      <div className={shell.container}>
        <AppNav active="projects" isAdmin={user?.isAdmin} user={user} />

        <div className={shell.main}>
          <header className={shell.header}>
            <div className={shell.headerContent}>
              <h1 className={shell.logo}>
                <span className={shell.logoIcon}><Icon name="folder" size={16} strokeWidth={2} /></span>
                {project.name}
              </h1>
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
      </div>
    </>
  );
}
