import { useEffect, useState } from 'react';
import { accessToken } from '../../auth/client';

export function AdminImage({ source, alt, loading }: { source: string; alt: string; loading?: 'lazy' | 'eager' }) {
  const protectedImage = source.startsWith('/api/provider-images/');
  const [resolved, setResolved] = useState(protectedImage ? '' : source);
  useEffect(() => {
    if (!protectedImage) { setResolved(source); return; }
    setResolved('');
    let active = true; let objectUrl = '';
    void (async () => {
      try {
        const token = await accessToken();
        const response = await fetch(source, { headers: { Authorization: `Bearer ${token}` }, cache: 'no-store' });
        if (!response.ok) return;
        objectUrl = URL.createObjectURL(await response.blob());
        if (active) setResolved(objectUrl); else URL.revokeObjectURL(objectUrl);
      } catch { /* Leave a neutral placeholder when the image is unavailable. */ }
    })();
    return () => { active = false; if (objectUrl) URL.revokeObjectURL(objectUrl); };
  }, [source, protectedImage]);
  return resolved ? <img src={resolved} alt={alt} loading={loading}/> : <span aria-label={alt} className="admin-image-loading">Cargando foto…</span>;
}
