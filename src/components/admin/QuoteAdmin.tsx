import { useEffect, useState } from 'react';
import { privateApi } from '../../auth/client';
import './quotes.css';
import './crm.css';

type EventInfo = { eventType: string; date: string | null; datePreference?: string | null; city: string; guestCount: number; budget: number };
type Quote = { id: string; request_code: string; state: string; created_at: string; public_payload: { event: EventInfo; services: string[]; proposal: { title: string; total: number } } };
type Generated = { id: string; customer_email: string; customer_name: string; created_at: string; event: EventInfo & { selectedServices: string[] }; proposals: { title: string; total: number }[] };
type Item = { providerId: string; serviceId: string; businessName: string; whatsapp: string; phone: string; whatsappUrl: string | null; category: string; packageName: string; providerCost: number | null; publicPrice: number };
type Detail = { quotation: Quote; customerWhatsappUrl: string | null; detail: { snapshot: { customerName: string; customerEmail: string; items: Item[] }; customer_whatsapp: string; provider_status: Record<string, { status: string; whatsappMessageId?: string }> } };
const labels: Record<string, string> = { received: 'Recibida', coordinating: 'En coordinación', awaiting_customer: 'Esperando al cliente', completed: 'Confirmada', closed: 'Cerrada', pending: 'Pendiente', consulted: 'Consultado', available: 'Disponible', unavailable: 'No disponible' };
const money = (value: number | null) => value === null ? 'Por registrar' : `S/ ${value.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const when = (value: string) => new Date(value).toLocaleDateString('es-PE');
const eventDate = (event: EventInfo) => event.date || event.datePreference || 'Fecha por definir';

export function QuoteAdmin({ view }: { view: 'requests' | 'generated' }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [generated, setGenerated] = useState<Generated[]>([]);
  const [selected, setSelected] = useState<Detail | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function load() {
    setBusy(true);
    try {
      if (view === 'requests') setQuotes((await privateApi<{ quotations: Quote[] }>('admin/quotes')).quotations);
      else setGenerated((await privateApi<{ generatedQuotes: Generated[] }>('admin/generated-quotes')).generatedQuotes);
      setError('');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo cargar la información.'); }
    finally { setBusy(false); }
  }
  useEffect(() => { void load(); }, [view]);
  async function open(id: string) {
    setBusy(true); setError(''); setNotice('');
    try { setSelected(await privateApi<Detail>(`admin/quotes/${id}`)); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo abrir la solicitud.'); }
    finally { setBusy(false); }
  }
  async function update(body: object, action = '') {
    if (!selected) return;
    setBusy(true); setError(''); setNotice('');
    try {
      await privateApi(`admin/quotes/${selected.quotation.id}${action}`, { method: action ? 'POST' : 'PATCH', body: JSON.stringify(body) });
      const [detail, list] = await Promise.all([privateApi<Detail>(`admin/quotes/${selected.quotation.id}`), privateApi<{ quotations: Quote[] }>('admin/quotes')]);
      setSelected(detail); setQuotes(list.quotations);
      setNotice(action ? 'Solicitud confirmada. Abre el WhatsApp del cliente para enviarle el aviso.' : 'Estado guardado.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'No se pudo guardar el cambio.'); }
    finally { setBusy(false); }
  }
  const items = selected?.detail.snapshot.items || [];
  const statuses = selected?.detail.provider_status || {};
  const allAvailable = items.length > 0 && items.every(item => statuses[`${item.providerId}:${item.serviceId}`]?.status === 'available');
  return <section className="crm">
    <div className="crm-top"><div><h1>{view === 'requests' ? 'Solicitudes' : 'Opciones generadas'}</h1><p>{view === 'requests' ? 'Cotizaciones que los clientes enviaron para coordinar.' : 'Comparaciones guardadas que aún no son solicitudes.'}</p></div><button type="button" disabled={busy} onClick={() => void load()}>Actualizar</button></div>
    {error && <p className="admin-error" role="alert">{error}</p>}{notice && <p className="admin-notice" role="status">{notice}</p>}
    {view === 'generated' ? generated.length ? <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Cliente</th><th>Evento</th><th>Fecha</th><th>Opciones</th></tr></thead><tbody>{generated.map(item => <tr key={item.id}><td><strong>{item.customer_name || 'Sin nombre'}</strong><small>{item.customer_email}</small></td><td>{item.event.eventType}<small>{item.event.guestCount} invitados</small></td><td>{when(item.created_at)}</td><td>{item.proposals.map(proposal => `${proposal.title}: ${money(proposal.total)}`).join(' · ')}</td></tr>)}</tbody></table></div> : <p className="crm-empty">Aún no hay opciones generadas.</p>
      : selected ? <div className="crm-detail"><button className="crm-back" type="button" onClick={() => setSelected(null)}>← Volver a solicitudes</button>
        <div className="crm-title"><div><span className="crm-code">{selected.quotation.request_code}</span><h2>{selected.quotation.public_payload.event.eventType}</h2><p>Paquete elegido: <strong>{selected.quotation.public_payload.proposal.title}</strong> · {eventDate(selected.quotation.public_payload.event)} · {selected.quotation.public_payload.event.guestCount} invitados</p></div><span className="crm-status">{labels[selected.quotation.state] || selected.quotation.state}</span></div>
        <div className="crm-facts"><div><span>Cliente</span><strong>{selected.detail.snapshot.customerName || 'Sin nombre'}</strong><small>{selected.detail.snapshot.customerEmail}<br/>{selected.detail.customer_whatsapp}</small></div><div><span>Precio del paquete</span><strong>{money(selected.quotation.public_payload.proposal.total)}</strong></div><div><span>Presupuesto del cliente</span><strong>{money(selected.quotation.public_payload.event.budget)}</strong></div></div>
        <div className="crm-section-title"><h3>Proveedores seleccionados</h3><span>{items.length} {items.length === 1 ? 'servicio' : 'servicios'}</span></div>
        <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Proveedor</th><th>Servicio</th><th>Costo del proveedor</th><th>Precio al cliente</th><th>Respuesta</th><th>Contacto</th></tr></thead><tbody>{items.map(item => { const key = `${item.providerId}:${item.serviceId}`; return <tr key={key}><td data-label="Proveedor"><strong>{item.businessName}</strong><small>{item.category}</small></td><td data-label="Servicio">{item.packageName}</td><td data-label="Costo del proveedor">{money(item.providerCost)}</td><td data-label="Precio al cliente">{money(item.publicPrice)}</td><td data-label="Respuesta"><select aria-label={`Respuesta de ${item.businessName}`} value={statuses[key]?.status || 'pending'} disabled={busy} onChange={event => void update({ providerKey: key, status: event.target.value })}>{['pending', 'consulted', 'available', 'unavailable'].map(value => <option key={value} value={value}>{labels[value]}</option>)}</select></td><td data-label="Contacto">{item.whatsappUrl ? <a className="crm-send" href={item.whatsappUrl} target="_blank" rel="noopener noreferrer">Enviar información ↗</a> : <span className="crm-missing">Agrega su WhatsApp</span>}</td></tr>; })}</tbody></table></div>
        <div className="crm-actions"><div><h3>Confirmar solicitud</h3><p>{allAvailable ? 'Todos los proveedores están disponibles. Confirma para actualizar el estado del cliente.' : 'Marca como disponible a cada proveedor después de recibir su respuesta.'}</p></div><button type="button" disabled={busy || !allAvailable || !selected.customerWhatsappUrl || ['completed', 'closed'].includes(selected.quotation.state)} onClick={() => void update({ delivery: 'manual' }, '/confirm')}>Confirmar</button>{selected.quotation.state === 'completed' && selected.customerWhatsappUrl && <a className="crm-send" href={selected.customerWhatsappUrl} target="_blank" rel="noopener noreferrer">Avisar al cliente por WhatsApp ↗</a>}</div>
      </div> : quotes.length ? <div className="crm-table-wrap"><table className="crm-table"><thead><tr><th>Solicitud</th><th>Evento y paquete</th><th>Precio</th><th>Estado</th><th></th></tr></thead><tbody>{quotes.map(quote => <tr key={quote.id}><td><strong>{quote.request_code}</strong><small>{when(quote.created_at)}</small></td><td>{quote.public_payload.event.eventType}<small>{quote.public_payload.proposal.title}</small></td><td>{money(quote.public_payload.proposal.total)}</td><td><span className="crm-status">{labels[quote.state] || quote.state}</span></td><td><button type="button" onClick={() => void open(quote.id)}>Ver solicitud →</button></td></tr>)}</tbody></table></div> : <p className="crm-empty">Aún no hay solicitudes enviadas.</p>}
  </section>;
}
