import { useEffect, useState } from 'react';
import type { NoticeKind } from './toast-events';
import './notifications.css';

type Notice = { id: number; message: string; kind: NoticeKind };
let nextId = 0;

export function Notifications() {
  const [notices, setNotices] = useState<Notice[]>([]);
  useEffect(() => {
    const timers = new Set<number>();
    const receive = (event: Event) => {
      const { message, kind } = (event as CustomEvent<{ message: string; kind: NoticeKind }>).detail;
      const id = ++nextId;
      setNotices(current => [...current.slice(-2), { id, message, kind }]);
      const timer = window.setTimeout(() => { setNotices(current => current.filter(item => item.id !== id)); timers.delete(timer); }, kind === 'error' ? 8500 : 6000);
      timers.add(timer);
    };
    window.addEventListener('creafia-notification', receive);
    return () => { window.removeEventListener('creafia-notification', receive); timers.forEach(window.clearTimeout); };
  }, []);
  return <div className="notification-stack" aria-live="polite" aria-relevant="additions">{notices.map(item => <div key={item.id} className={`notification notification-${item.kind}`} role={item.kind === 'error' ? 'alert' : 'status'}><span>{item.message}</span><button type="button" aria-label="Cerrar notificación" onClick={() => setNotices(current => current.filter(notice => notice.id !== item.id))}>×</button></div>)}</div>;
}

