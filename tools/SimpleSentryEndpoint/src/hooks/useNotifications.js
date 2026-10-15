import { useCallback, useState } from 'react';

// In-page toast queue: each toast removes itself after `timeoutMs`.
export default function useNotifications(timeoutMs = 10000) {
  const [notifications, setNotifications] = useState([]);

  const removeNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const showNotification = useCallback((message, type = 'info', action = null) => {
    const id = Date.now() + Math.random();
    setNotifications(prev => [...prev, { id, message, type, action }]);
    setTimeout(() => removeNotification(id), timeoutMs);
  }, [removeNotification, timeoutMs]);

  return { notifications, showNotification, removeNotification };
}
