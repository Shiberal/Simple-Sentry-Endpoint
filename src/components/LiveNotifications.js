import dashboardStyles from '@/styles/Dashboard.module.css';
import adminStyles from '@/styles/Admin.module.css';

function isAssertiveType(type) {
  return type === 'error' || type === 'warning';
}

/**
 * Toast list with a single live region (assertive when any error/warning is present).
 */
export function LiveNotifications({ notifications, onRemove, variant = 'dashboard' }) {
  const s = variant === 'admin' ? adminStyles : dashboardStyles;
  const containerClass = variant === 'admin' ? s.notifications : s.notificationContainer;
  const live = notifications.some((n) => isAssertiveType(n.type)) ? 'assertive' : 'polite';

  const renderToast = (notification) => {
    if (variant === 'admin') {
      return (
        <div
          key={notification.id}
          className={`${s.notification} ${s[`notification${notification.type}`] || s.notificationinfo}`}
        >
          {notification.message}
        </div>
      );
    }

    return (
      <div
        key={notification.id}
        className={`${s.notification} ${s[`notification${notification.type.charAt(0).toUpperCase() + notification.type.slice(1)}`]}`}
      >
        <div className={s.notificationContent}>
          <span className={s.notificationIcon} aria-hidden>
            {notification.type === 'success' && '✅'}
            {notification.type === 'error' && '❌'}
            {notification.type === 'warning' && '⚠️'}
            {notification.type === 'info' && 'ℹ️'}
          </span>
          <span className={s.notificationMessage}>{notification.message}</span>
        </div>
        <button
          type="button"
          className={s.notificationClose}
          onClick={() => onRemove(notification.id)}
          aria-label="Dismiss notification"
        >
          ×
        </button>
      </div>
    );
  };

  return (
    <div className={containerClass} aria-live={live} aria-relevant="additions text">
      {notifications.map(renderToast)}
    </div>
  );
}
