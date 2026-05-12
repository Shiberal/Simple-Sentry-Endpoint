import { useTheme } from '../contexts/ThemeContext';
import styles from './ThemeToggle.module.css';

function IconSun() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={styles.svgIcon}>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconMoon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={styles.svgIcon}>
      <path
        d="M21 14.5A8.5 8.5 0 0 1 9.5 3 6.5 6.5 0 1 0 21 14.5Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconSystem() {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={styles.svgIcon}>
      <rect x="3" y="4" width="18" height="12" rx="2" stroke="currentColor" strokeWidth="1.75" />
      <path d="M8 20h8M12 16v4" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
    </svg>
  );
}

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const themes = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const getIcon = () => {
    switch (theme) {
      case 'light':
        return <IconSun />;
      case 'dark':
        return <IconMoon />;
      case 'system':
        return <IconSystem />;
      default:
        return <IconSun />;
    }
  };

  const getLabel = () => {
    switch (theme) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      case 'system':
        return 'System';
      default:
        return 'Theme';
    }
  };

  return (
    <button
      type="button"
      onClick={cycleTheme}
      className={styles.toggle}
      aria-label={`Theme: ${getLabel()}. Click to cycle appearance.`}
      title={`Theme: ${getLabel()} (click to cycle)`}
    >
      <span className={styles.icon} aria-hidden="true">
        {getIcon()}
      </span>
      <span className={styles.label}>{getLabel()}</span>
    </button>
  );
}
