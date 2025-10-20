import { useTheme } from '../contexts/ThemeContext';
import styles from './ThemeToggle.module.css';

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
        return '☀️';
      case 'dark':
        return '🌙';
      case 'system':
        return '💻';
      default:
        return '☀️';
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
      onClick={cycleTheme}
      className={styles.toggle}
      aria-label={`Current theme: ${getLabel()}. Click to change theme.`}
      title={`Theme: ${getLabel()} (click to cycle)`}
    >
      <span className={styles.icon} role="img" aria-hidden="true">
        {getIcon()}
      </span>
      <span className={styles.label}>{getLabel()}</span>
    </button>
  );
}

