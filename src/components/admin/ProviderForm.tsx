import SpecularButton from '../SpecularButton';
import { useEffect, useState } from 'react';
import type { Provider, ProviderService } from '../../types/provider';
import { PROVIDER_CATEGORIES, validateProvider } from '../../../shared/provider-validation.mjs';
import { saveProvider } from '../../services/providers';
import { ProviderImages } from './ProviderImages';
import { ProviderServiceForm } from './ProviderServiceForm';
import { privateApi } from '../../auth/client';

const newService = (): ProviderService => ({ id: crypto.randomUUID(), name: '', priceFrom: 0, priceModel: 'from', eventTypes: [], styles: [], includes: [], availableForCustomQuote: false });
export function ProviderForm({ initial, onSaved, onCancel }: { initial?: Provider; onSaved: () => void; onCancel: () => void }) {
  const [draft, setDraft] = useState<Provider>(() => initial ?? { id: crypto.randomUUID(), businessName: '', category: 'Local', city: 'Ilo', active: true, verified: false, evidenceImages: [], services: [newService()] });
  const [step, setStep] = useState(0); const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [defaultMarkup, setDefaultMarkup] = useState(10);
  const [confirmedPrices, setConfirmedPrices] = useState<Set<string>>(new Set());
  useEffect(() => { void privateApi<{ defaultMarkupPercent: number }>('admin/pricing').then(data => setDefaultMarkup(data.defaultMarkupPercent)).catch(() => {}); }, []);
  const locked = busy || uploading;
  const update = (patch: Partial<Provider>) => { setDraft(current => ({ ...current, ...patch })); setError(''); };
  const optionalNumber = (value: string) => value === '' ? undefined : Number(value);
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (locked) return;
    try {
      const unconfirmed = draft.services.find(service => service.providerCost !== undefined && !confirmedPrices.has(service.id) && (!initial || ['providerCost', 'markupType', 'markupValue'].some(field => service[field as keyof ProviderService] !== initial.services.find(item => item.id === service.id)?.[field as keyof ProviderService])));
      if (unconfirmed) { setStep(2); throw new Error(`Confirma el precio público de ${unconfirmed.name || 'este paquete'} antes de guardar.`); }
      const valid = validateProvider(draft); setBusy(true); setError('');
      await saveProvider(valid, !initial); onSaved();
    } catch (error) { const message = error instanceof Error ? error.message : 'No se pudo guardar.'; setError(message); if (/Nombre comercial|Categoría|Ciudad|rating|yearsExperience|eventsCompleted/.test(message)) setStep(0); else if (/servicio|Precio|capacidad|evento|Incluye/i.test(message)) setStep(2); }
    finally { setBusy(false); }
  }
  return <form className="admin-form" onSubmit={event => void save(event)} noValidate>
    <div className="admin-form-top"><div><p className="admin-kicker">Catálogo interno</p><h1>{initial ? 'Editar proveedor' : 'Un nuevo proveedor'}</h1></div><SpecularButton type="button" variant="ghost" size="sm" className="admin-quiet" onClick={onCancel} disabled={locked}>Volver</SpecularButton></div>
    <nav className="admin-tabs" aria-label="Bloques del proveedor">{['Negocio', 'Contacto privado', 'Servicios', 'Evidencias'].map((title, index) => <SpecularButton variant="ghost" size="sm" key={title} type="button" disabled={locked} aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}><span>{index + 1}</span>{title}</SpecularButton>)}</nav>
    <fieldset className="admin-form-fields" disabled={busy}>
      {step === 0 && <section><h2>Conozcamos el negocio</h2><div className="admin-grid"><label>Nombre comercial *<input autoComplete="organization" required maxLength={160} value={draft.businessName} onChange={event => update({ businessName: event.target.value })}/></label><label>Categoría *<input list="provider-categories" required maxLength={100} value={draft.category} onChange={event => update({ category: event.target.value })}/><datalist id="provider-categories">{PROVIDER_CATEGORIES.map(category => <option key={category} value={category}/>)}</datalist><span className="admin-help">La categoría aparece en el cuestionario como servicio. También puedes escribir una categoría nueva.</span></label><label>Ciudad *<input required maxLength={100} value={draft.city} onChange={event => update({ city: event.target.value })}/></label><label>Años de experiencia<input type="number" min="0" max="150" value={draft.yearsExperience ?? ''} onChange={event => update({ yearsExperience: optionalNumber(event.target.value) })}/></label><label>Eventos realizados<input type="number" min="0" value={draft.eventsCompleted ?? ''} onChange={event => update({ eventsCompleted: optionalNumber(event.target.value) })}/></label><label>Rating (0 a 5)<input type="number" min="0" max="5" step="0.1" value={draft.rating ?? ''} onChange={event => update({ rating: optionalNumber(event.target.value) })}/></label></div><label>Descripción<textarea rows={4} maxLength={1500} value={draft.description ?? ''} onChange={event => update({ description: event.target.value })}/></label><div className="admin-inline"><label className="admin-check"><input type="checkbox" checked={draft.verified} onChange={event => update({ verified: event.target.checked })}/>Verificado</label><label className="admin-check"><input type="checkbox" checked={draft.active} onChange={event => update({ active: event.target.checked })}/>Activo para búsquedas</label></div></section>}
      {step === 1 && <section><h2>Un contacto entre nosotros</h2><p className="admin-private">Información privada. No se mostrará al cliente antes de una futura reserva.</p><div className="admin-grid">{(['whatsapp', 'phone', 'instagram', 'address'] as const).map((field, index) => <label key={field}>{['WhatsApp', 'Teléfono', 'Instagram', 'Dirección'][index]}<input maxLength={200} value={draft[field] ?? ''} onChange={event => update({ [field]: event.target.value })}/></label>)}</div></section>}
      {step === 2 && <section><div className="admin-section-top"><div><h2>Lo que puede ofrecer</h2><p className="admin-help">Paquetes con precios y capacidades registrados.</p></div><SpecularButton type="button" onClick={() => update({ services: [...draft.services, newService()] })}>+ Agregar servicio</SpecularButton></div>{draft.services.map((service, index) => <ProviderServiceForm key={service.id} service={service} index={index} defaultMarkup={defaultMarkup} confirmed={confirmedPrices.has(service.id)} onConfirm={value => setConfirmedPrices(current => { const next = new Set(current); if (value) next.add(service.id); else next.delete(service.id); return next; })} onChange={value => { if (['providerCost', 'markupType', 'markupValue'].some(field => service[field as keyof ProviderService] !== value[field as keyof ProviderService])) setConfirmedPrices(current => { const next = new Set(current); next.delete(service.id); return next; }); update({ services: draft.services.map(old => old.id === service.id ? value : old) }); }} onRemove={() => update({ services: draft.services.filter(old => old.id !== service.id) })}/>)}</section>}
      {step === 3 && <ProviderImages provider={draft} onChange={update} onUploadingChange={setUploading}/>}
    </fieldset>
    {error && <p role="alert" className="admin-error">{error}</p>}
    <div className="admin-form-footer"><SpecularButton type="button" variant="ghost" size="sm" className="admin-quiet" disabled={locked || step === 0} onClick={() => setStep(current => current - 1)}>Anterior</SpecularButton>{step < 3 && <SpecularButton type="button" variant="ghost" size="sm" className="admin-quiet" disabled={locked} onClick={() => setStep(current => current + 1)}>Continuar</SpecularButton>}<SpecularButton type="submit" disabled={locked}>{uploading ? 'Procesando fotos…' : busy ? 'Guardando…' : 'Guardar proveedor'}</SpecularButton></div>
  </form>;
}
