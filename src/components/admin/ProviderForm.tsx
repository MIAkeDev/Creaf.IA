import SpecularButton from '../SpecularButton';
import { useEffect, useRef, useState } from 'react';
import type { Provider, ProviderService } from '../../types/provider';
import { PROVIDER_CATEGORIES, validateProvider } from '../../../shared/provider-validation.mjs';
import { saveProvider } from '../../services/providers';
import { ProviderImages } from './ProviderImages';
import { ProviderServiceForm } from './ProviderServiceForm';
import { privateApi } from '../../auth/client';

const newService = (): ProviderService => ({ id: crypto.randomUUID(), name: '', priceFrom: 0, priceModel: 'from', eventTypes: [], styles: [], includes: [], availableForCustomQuote: false });

export function ProviderForm({ initial, onSaved, onCancel }: { initial?: Provider; onSaved: () => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Provider>(() => initial ?? { id: crypto.randomUUID(), businessName: '', category: 'Local', city: 'Ilo', active: true, verified: false, evidenceImages: [], services: [newService()] });
  const [customCategory, setCustomCategory] = useState(() => initial && !PROVIDER_CATEGORIES.includes(initial.category) ? initial.category : '');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false); const [uploading, setUploading] = useState(false);
  const [defaultMarkup, setDefaultMarkup] = useState(10);
  const [confirmedPrices, setConfirmedPrices] = useState<Set<string>>(new Set());
  const businessRef = useRef<HTMLElement>(null); const servicesRef = useRef<HTMLElement>(null); const extraRef = useRef<HTMLDetailsElement>(null);
  useEffect(() => { void privateApi<{ defaultMarkupPercent: number }>('admin/pricing').then(data => setDefaultMarkup(data.defaultMarkupPercent)).catch(() => {}); }, []);
  const locked = busy || uploading;
  const update = (patch: Partial<Provider>) => { setDraft(current => ({ ...current, ...patch })); setError(''); };
  const optionalNumber = (value: string) => value === '' ? undefined : Number(value);
  const checks = [
    { label: 'Negocio', ready: !!draft.businessName.trim() && !!draft.category.trim() && !!draft.city.trim() },
    { label: 'Paquete', ready: draft.services.length > 0 && draft.services.every(service => !!service.name.trim() && (service.priceFrom > 0 || service.providerCost !== undefined)) },
    { label: 'Eventos', ready: draft.services.length > 0 && draft.services.every(service => service.eventTypes.length > 0) },
  ];
  const businessError = /Nombre comercial|Categoría|Ciudad|whatsapp/i.test(error);
  const extraError = /rating|yearsExperience|eventsCompleted|phone|instagram|address|Descripción/i.test(error);
  function showError(message: string) {
    setError(message);
    const advanced = /rating|yearsExperience|eventsCompleted|phone|instagram|address|Descripción/i.test(message);
    if (advanced && extraRef.current) extraRef.current.open = true;
    const target = advanced ? extraRef.current : /Nombre comercial|Categoría|Ciudad|whatsapp/i.test(message) ? businessRef.current : servicesRef.current;
    if (target === servicesRef.current) target?.querySelectorAll('details').forEach(item => { item.open = true; });
    requestAnimationFrame(() => target?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (locked) return;
    try {
      const valid = validateProvider(draft);
      const unconfirmed = draft.services.find(service => service.providerCost !== undefined && !confirmedPrices.has(service.id) && (!initial || ['providerCost', 'markupType', 'markupValue'].some(field => service[field as keyof ProviderService] !== initial.services.find(item => item.id === service.id)?.[field as keyof ProviderService])));
      if (unconfirmed) throw new Error(`Confirma el precio público de ${unconfirmed.name || 'este paquete'} antes de guardar.`);
      setBusy(true); setError(''); await saveProvider(valid, !initial); onSaved();
    } catch (cause) { showError(cause instanceof Error ? cause.message : 'No se pudo guardar el proveedor.'); }
    finally { setBusy(false); }
  }
  return <form className="admin-form admin-provider-editor" onSubmit={event => void save(event)} noValidate>
    <div className="admin-form-top"><div><p className="admin-kicker">Catálogo de proveedores</p><h1>{initial ? 'Editar proveedor' : 'Agregar proveedor'}</h1><p className="admin-editor-intro">Registra el negocio y al menos un paquete. Las fotos y los datos adicionales pueden añadirse después.</p></div><SpecularButton type="button" variant="ghost" size="sm" className="admin-quiet" onClick={onCancel} disabled={locked}>Volver al catálogo</SpecularButton></div>
    <div className="admin-editor-layout"><div className="admin-editor-main"><fieldset className="admin-editor-fields" disabled={busy}>
      <section className="admin-editor-section" id="provider-business" ref={businessRef}><div className="admin-editor-section-head"><span className="admin-editor-number">01</span><div><h2>Datos del negocio</h2><p>Lo necesario para identificarlo y encontrar sus servicios.</p></div></div>{error && businessError && <p role="alert" className="admin-error">{error}</p>}
        <div className="admin-grid"><label>Nombre comercial *<input autoComplete="organization" required maxLength={160} placeholder="Ej. Eventos del Sur" value={draft.businessName} onChange={event => update({ businessName: event.target.value })}/></label><div className="admin-category-field"><label>Categoría principal *<select required value={PROVIDER_CATEGORIES.includes(draft.category) ? draft.category : '__custom__'} onChange={event => update({ category: event.target.value === '__custom__' ? customCategory : event.target.value })}>{PROVIDER_CATEGORIES.map(category => <option key={category} value={category}>{category}</option>)}<option value="__custom__">Otra categoría…</option></select><span className="admin-help">Abre la lista para ver todos los servicios disponibles.</span></label>{!PROVIDER_CATEGORIES.includes(draft.category) && <label>Nombre de la nueva categoría *<input required maxLength={100} placeholder="Ej. Show de magia" value={customCategory} onChange={event => { setCustomCategory(event.target.value); update({ category: event.target.value }); }}/></label>}</div><label>Ciudad *<input required maxLength={100} value={draft.city} onChange={event => update({ city: event.target.value })}/></label><label>WhatsApp del proveedor<input type="tel" autoComplete="tel" maxLength={200} placeholder="Ej. 999 999 999" value={draft.whatsapp ?? ''} onChange={event => update({ whatsapp: event.target.value })}/><span className="admin-help">Privado; sirve para coordinar directamente con el proveedor.</span></label></div>
        <div className="admin-editor-status"><label className="admin-check"><input type="checkbox" checked={draft.active} onChange={event => update({ active: event.target.checked })}/>Disponible para las búsquedas</label><span>Desactívalo si aún no quieres mostrar sus paquetes.</span></div>
      </section>
      <section className="admin-editor-section" id="provider-services" ref={servicesRef}><div className="admin-editor-section-head"><span className="admin-editor-number">02</span><div><h2>Servicios y precios</h2><p>Un paquete por cada opción que quieras cotizar.</p></div></div>{error && !businessError && !extraError && <p role="alert" className="admin-error">{error}</p>}
        <div className="admin-service-toolbar"><p>{draft.services.length} {draft.services.length === 1 ? 'paquete registrado' : 'paquetes registrados'}</p><SpecularButton type="button" size="sm" disabled={locked || draft.services.length >= 30} onClick={() => update({ services: [...draft.services, newService()] })}>+ Añadir paquete</SpecularButton></div>
        {draft.services.map((service, index) => <ProviderServiceForm key={service.id} service={service} index={index} defaultMarkup={defaultMarkup} confirmed={confirmedPrices.has(service.id)} onConfirm={value => setConfirmedPrices(current => { const next = new Set(current); if (value) next.add(service.id); else next.delete(service.id); return next; })} onChange={value => { if (['providerCost', 'markupType', 'markupValue'].some(field => service[field as keyof ProviderService] !== value[field as keyof ProviderService])) setConfirmedPrices(current => { const next = new Set(current); next.delete(service.id); return next; }); update({ services: draft.services.map(old => old.id === service.id ? value : old) }); }} onRemove={() => update({ services: draft.services.filter(old => old.id !== service.id) })}/>)}
      </section>
      <section className="admin-editor-section admin-editor-section-optional"><div className="admin-editor-section-head"><span className="admin-editor-number">03</span><div><h2>Fotos</h2><p>Opcional. Puedes subirlas ahora o después de guardar.</p></div></div><ProviderImages provider={draft} onChange={update} onUploadingChange={setUploading}/></section>
      <details className="admin-editor-extra" ref={extraRef}><summary>Más datos del negocio <span>Opcional · contacto, experiencia y descripción</span></summary><div className="admin-editor-extra-body">{error && extraError && <p role="alert" className="admin-error">{error}</p>}<p className="admin-private">El teléfono, Instagram y la dirección quedan en el panel privado.</p><div className="admin-grid"><label>Teléfono<input type="tel" maxLength={200} value={draft.phone ?? ''} onChange={event => update({ phone: event.target.value })}/></label><label>Instagram<input maxLength={200} value={draft.instagram ?? ''} onChange={event => update({ instagram: event.target.value })}/></label><label>Dirección<input maxLength={200} value={draft.address ?? ''} onChange={event => update({ address: event.target.value })}/></label><label>Años de experiencia<input type="number" min="0" max="150" value={draft.yearsExperience ?? ''} onChange={event => update({ yearsExperience: optionalNumber(event.target.value) })}/></label><label>Eventos realizados<input type="number" min="0" value={draft.eventsCompleted ?? ''} onChange={event => update({ eventsCompleted: optionalNumber(event.target.value) })}/></label><label>Valoración (0 a 5)<input type="number" min="0" max="5" step="0.1" value={draft.rating ?? ''} onChange={event => update({ rating: optionalNumber(event.target.value) })}/></label></div><label>Descripción del negocio<textarea rows={3} maxLength={1500} value={draft.description ?? ''} onChange={event => update({ description: event.target.value })}/></label><label className="admin-check"><input type="checkbox" checked={draft.verified} onChange={event => update({ verified: event.target.checked })}/>Proveedor verificado</label></div></details>
    </fieldset></div><aside className="admin-editor-aside" aria-label="Estado del registro"><strong>Antes de guardar</strong><p>Estos datos permiten incluir al proveedor en las cotizaciones.</p><ul>{checks.map(item => <li key={item.label} className={item.ready ? 'is-ready' : ''}><span aria-hidden="true">{item.ready ? '✓' : '○'}</span>{item.label}</li>)}</ul><small>Los campos con * son obligatorios. El precio se indica por paquete, no por persona.</small></aside></div>
    <div className="admin-editor-footer"><div><span>{uploading ? 'Terminando la carga de fotos…' : 'Puedes editar estos datos más adelante.'}</span><SpecularButton type="submit" disabled={locked}>{uploading ? 'Procesando fotos…' : busy ? 'Guardando…' : initial ? 'Guardar cambios' : 'Guardar proveedor'}</SpecularButton></div></div>
  </form>;
}
