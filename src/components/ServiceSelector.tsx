import { useEffect, useId, useRef, useState } from 'react';
import { categoryKey } from '../../shared/provider-validation.mjs';
import { getServiceOptions } from '../services/providers';
import type { ServiceOptions } from '../types/proposal';
import './ServiceSelector.css';
import SpecularButton from './SpecularButton';

type Props = { eventType: string; city: string | null; guestCount: number | null; selectedServices: string[]; busy: boolean; onConfirm: (services: string[]) => void };
export function ServiceSelector({ eventType, city, guestCount, selectedServices, busy, onConfirm }: Props) {
  const [selection, setSelection] = useState(selectedServices);
  const [catalog, setCatalog] = useState<ServiceOptions['options']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  const allRef = useRef<HTMLInputElement>(null);
  const id = useId();
  useEffect(() => setSelection(selectedServices), [selectedServices, eventType]);
  useEffect(() => {
    const refresh = () => setRevision(value => value + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);
  useEffect(() => {
    const controller = new AbortController(); setLoading(true); setError(''); setCatalog([]);
    getServiceOptions(eventType, city, guestCount, controller.signal)
      .then(result => { if (!controller.signal.aborted) setCatalog(result.options); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : 'No pude cargar los servicios.'); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [eventType, city, guestCount, revision]);
  const options = [...new Map([...catalog.map(item => item.category), ...selectedServices].map(service => [categoryKey(service), service])).values()];
  const selected = new Set(selection.map(categoryKey));
  const allSelected = options.length > 0 && options.every(service => selected.has(categoryKey(service)));
  const changed = selection.length !== selectedServices.length || selection.some(service => !selectedServices.some(saved => categoryKey(saved) === categoryKey(service)));
  useEffect(() => { if (allRef.current) allRef.current.indeterminate = selection.length > 0 && !allSelected; }, [selection.length, allSelected]);
  return <form className="service-selector" onSubmit={event => { event.preventDefault(); if (!busy && !loading && !error && changed && selection.length) onConfirm(selection); }}>
    <fieldset disabled={busy || loading || !!error} aria-describedby={`${id}-help`}>
      <legend>¿Qué servicios te gustaría incluir?</legend>
      <p className="service-help" id={`${id}-help`}>Servicios registrados para tu evento{city ? ` en ${city}` : ''}. Puedes marcar todos y omitir cualquiera después.</p>
      {loading && <p role="status">Consultando servicios…</p>}
      {!loading && !error && !options.length && <p className="service-help">Todavía no hay servicios registrados para este evento{city ? ` en ${city}` : ''}. Puedes indicar en el chat qué necesitas.</p>}
      {!!options.length && !loading && !error && <>
        <label className="service-all"><input ref={allRef} type="checkbox" checked={allSelected} onChange={event => setSelection(event.target.checked ? options : [])}/><span>Marcar todo</span></label>
        <div className="service-options">{options.map(service => {
          const registered = catalog.find(item => categoryKey(item.category) === categoryKey(service));
          const hint = !registered ? 'Sin opciones para estos criterios.' : guestCount && !registered.availableForGuests
            ? 'No hay opciones para la cantidad de invitados indicada.' : '';
          return <label key={categoryKey(service)}><input type="checkbox" checked={selected.has(categoryKey(service))} onChange={event => setSelection(current => event.target.checked ? [...current.filter(item => categoryKey(item) !== categoryKey(service)), service] : current.filter(item => categoryKey(item) !== categoryKey(service)))}/><span>{service}{hint && <small className="service-capacity">{hint}</small>}</span></label>;
        })}</div>
        <div className="service-selector-footer"><SpecularButton type="submit" disabled={!selection.length || !changed}>{selectedServices.length ? 'Guardar cambios' : 'Confirmar servicios'}</SpecularButton><span className="service-help" role="status">{selection.length ? `${selection.length} ${selection.length === 1 ? 'servicio seleccionado' : 'servicios seleccionados'}` : 'Elige al menos un servicio.'}</span></div>
      </>}
    </fieldset>
    {error && <p role="alert" className="service-help">{error}</p>}
    <SpecularButton type="button" variant="ghost" size="sm" disabled={busy || loading} onClick={() => setRevision(value => value + 1)}>Actualizar servicios</SpecularButton>
    <p className="service-help service-custom">¿Necesitas otro servicio? Puedes pedirlo por el chat.</p>
  </form>;
}
