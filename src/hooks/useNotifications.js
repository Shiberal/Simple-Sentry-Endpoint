import { useCallback, useState } from 'react';

// In-page toast queue: each toast removes itself after 10 seconds.
export default function useNotifications() {
  const [notifications, setNotifications] = useState([]);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const showNotification = useCallback((message, type = 'info', action = null) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, type, action }]);
    setTimeout(() => removeNotification(id), 10000);
  }, [removeNotification]);

  return { notifications, showNotification, removeNotification };
}
