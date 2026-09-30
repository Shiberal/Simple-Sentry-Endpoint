import { useTheme } from '../contexts/ThemeContext';
import Icon from './Icon';
import styles from './ThemeToggle.module.css';

export default function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const cycleTheme = () => {
    const themes = ['light', 'dark', 'system'];
    const currentIndex = themes.indexOf(theme);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  const iconName = theme === 'dark' ? 'moon' : theme === 'light' ? 'sun' : 'monitor';

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
      <Icon name={iconName} size={16} />
      <span className={styles.label}>{getLabel()}</span>
    </button>
  );
}
