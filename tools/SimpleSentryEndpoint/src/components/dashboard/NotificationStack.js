import Icon from '@/components/Icon';
import styles from '@/styles/Dashboard.module.css';

export default function NotificationStack({ notifications, onDismiss }) {
  return (
    <div className={styles.notificationContainer} role="status" aria-live="polite">
      {notifications.map((notification) => (
        <div 
          key={notification.id} 
          className={`${styles.notification} ${styles[`notification${notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}`]}`}
        >
          <div className={styles.notificationContent}>
            <span className={styles.notificationIcon}>
              <Icon name={notification.type === 'success' ? 'checkCircle' : notification.type === 'error' ? 'x' : notification.type === 'warning' ? 'alert' : 'info'} size={16} />
            </span>
            <span className={styles.notificationMessage}>{notification.message}</span>
            {notification.action && (
              <button
                className={styles.notificationAction}
                onClick={() => {
                  notification.action.onClick();
                  onDismiss(notification.id);
                }}
              >
                {notification.action.label}
              </button>
            )}
          </div>
          <button 
            className={styles.notificationClose}
            onClick={() => onDismiss(notification.id)}
            aria-label="Close notification"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
