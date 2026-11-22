import SpecularButton from '../SpecularButton';
import { useEffect, useRef, useState } from 'react';
import type { Provider } from '../../types/provider';
import { validateImageSource } from '../../../shared/provider-validation.mjs';
import { uploadProviderImage } from '../../services/providers';
import { AdminImage } from './AdminImage';
import './provider-images.css';
const fileSize = (bytes: number) => bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
export function ProviderImages({ provider, onChange, onUploadingChange }: { provider: Provider; onChange: (patch: Partial<Provider>) => void; onUploadingChange: (busy: boolean) => void }) {
  const [source, setSource] = useState(''); const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false); const [status, setStatus] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => () => controller.current?.abort(), []);
  const images = [...new Set([provider.coverImage, ...provider.evidenceImages].filter((image): image is string => !!image))];
  function add() {
    try { const image = validateImageSource(source.trim()); if (!image) return; if (images.length >= 30 && !images.includes(image)) throw new Error('Puedes agregar hasta 30 fotos por proveedor.'); onChange({ coverImage: provider.coverImage || image, evidenceImages: [...new Set([...provider.evidenceImages, image])] }); setSource(''); setError(''); }
    catch (error) { setError(error instanceof Error ? error.message : 'Imagen no válida.'); }
  }
  async function upload(files: File[]) {
    if (!files.length || controller.current) return;
    if (files.length + images.length > 30) { setError('Puedes agregar hasta 30 fotos por proveedor.'); return; }
    if (files.some(file => !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 10 * 1024 * 1024 || !file.size)) { setError('Selecciona fotos JPG, PNG o WebP de hasta 10 MB cada una.'); return; }
    const ac = new AbortController(); controller.current = ac;
    setUploading(true); onUploadingChange(true); setError('');
    let coverImage = provider.coverImage; let evidenceImages = [...provider.evidenceImages];
    let completed = 0; let originalBytes = 0; let bytes = 0;
    try {
      for (const file of files) {
        setStatus(`Optimizando y guardando foto ${completed + 1} de ${files.length}…`);
        const image = await uploadProviderImage(file, ac.signal);
        if (ac.signal.aborted) return;
        coverImage ||= image.source; evidenceImages = [...evidenceImages, image.source];
        onChange({ coverImage, evidenceImages }); completed++;
        originalBytes += image.originalBytes; bytes += image.bytes;
      }
      setStatus(`${completed === 1 ? 'Foto guardada' : `${completed} fotos guardadas`} en WebP: ${fileSize(originalBytes)} → ${fileSize(bytes)}. Guarda el proveedor para confirmar los cambios.`);
    } catch (error) {
      if (!ac.signal.aborted) { setError(error instanceof Error ? error.message : 'No se pudo subir la foto.'); setStatus(completed ? `${completed} fotos ya añadidas. Puedes guardar el proveedor y reintentar las restantes.` : ''); }
    } finally { if (!ac.signal.aborted) { controller.current = null; setUploading(false); onUploadingChange(false); } }
  }
  function remove(image: string) { const remaining = images.filter(item => item !== image); onChange({ coverImage: provider.coverImage === image ? remaining[0] : provider.coverImage, evidenceImages: provider.evidenceImages.filter(item => item !== image) }); }
  return <section className="admin-image-editor"><h2>Una primera impresión que cuente</h2><p className="admin-help">Sube fotos de tu equipo y las guardaremos optimizadas en WebP. Usa fotos sin logos, nombres ni contactos; se mostrarán al cliente.</p>
    <fieldset className="admin-photo-controls" disabled={uploading}>
    <label className="admin-photo-upload">Subir fotos del equipo<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={event => { const files = Array.from(event.target.files ?? []); event.target.value = ''; void upload(files); }}/><span className="admin-help">JPG, PNG o WebP · Hasta 10 MB por foto y 30 fotos por proveedor. Puedes elegir varias a la vez.</span></label>
    <p className="admin-help">También puedes añadir una URL de images.unsplash.com / images.pexels.com o una ruta pública existente.</p>
    <div className="admin-inline"><label>URL o ruta pública de imagen<input value={source} onChange={event => setSource(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); add(); } }}/></label><SpecularButton type="button" onClick={add}>+ Agregar foto</SpecularButton></div>
    {error && <p role="alert" className="admin-error">{error}</p>}
    <div className="admin-image-grid">{images.map((image, index) => <figure key={image}><AdminImage source={image} alt={`Evidencia ${index + 1}`}/><label className="admin-check"><input type="radio" name="cover-image" checked={provider.coverImage === image} onChange={() => onChange({ coverImage: image })}/>Imagen principal</label><SpecularButton type="button" variant="ghost" size="sm" className="admin-quiet" onClick={() => remove(image)}>Quitar foto</SpecularButton></figure>)}</div>
    {!images.length && <div className="admin-empty">Las evidencias aparecerán aquí. Puedes guardar el proveedor sin fotos y agregarlas después.</div>}
    </fieldset>{status && <p role="status" className="admin-notice">{status}</p>}
  </section>;
}
