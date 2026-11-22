import { useEffect, useState } from 'react';
import { useAuth } from './AuthProvider';
import { AuthMenu } from './AuthMenu';
import { privateApi } from './client';
import './auth.css';
import '../components/admin/quotes.css';

type EventInfo = { eventType: string; date: string | null; datePreference?: string | null; city: string; guestCount: number };
type Quote = { id: string; request_code: string; created_at: string; state: string; public_payload: { event: EventInfo; services: string[]; proposal: { title: string; total: number } } };
type GeneratedQuote = { id: string; created_at: string; event: EventInfo & { selectedServices: string[] }; proposals: { title: string; total: number }[] };
const stateLabels: Record<string, string> = { received: 'Recibida', coordinating: 'Consultando proveedores', awaiting_customer: 'Esperando tu respuesta', completed: 'Confirmada', closed: 'Cerrada' };
const stateMessages: Record<string, string> = {
  received: 'Recibimos tu solicitud. Te avisaremos aquí o por WhatsApp cuando tengamos novedades.',
  coordinating: 'Estamos consultando la disponibilidad de los proveedores.',
  awaiting_customer: 'Necesitamos tu respuesta para continuar. Revisa tu WhatsApp.',
  completed: 'Confirmamos los servicios y el precio. Nos comunicaremos contigo para coordinar el siguiente paso.',
  closed: 'Esta solicitud se cerró.',
};
const money = (amount: number) => `S/ ${amount.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateLabel = (value: string) => new Date(value).toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' });
const eventDate = (event: EventInfo) => event.date || event.datePreference || 'Fecha por definir';

export function QuotesOverview() {
  const { user, loading, openAuth } = useAuth();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [generated, setGenerated] = useState<GeneratedQuote[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!user) return;
    let current = true;
    setBusy(true);
    void Promise.allSettled([privateApi<{ quotations: Quote[] }>('quotes'), privateApi<{ generatedQuotes: GeneratedQuote[] }>('quotes/generated')]).then(results => {
      if (!current) return;
      if (results[0].status === 'fulfilled') setQuotes(results[0].value.quotations);
      if (results[1].status === 'fulfilled') setGenerated(results[1].value.generatedQuotes);
      setError(results.find(result => result.status === 'rejected')?.reason?.message || '');
    }).finally(() => { if (current) setBusy(false); });
    return () => { current = false; };
  }, [user, revision]);
  useEffect(() => {
    if (!loading && !busy && user && window.location.hash === '#cotizaciones') document.getElementById('cotizaciones')?.scrollIntoView({ block: 'start' });
  }, [loading, busy, user]);
  return <section id="cotizaciones" className="profile-quotes" aria-labelledby="profile-quotes-title">
    <div className="profile-quotes-heading"><div><h2 id="profile-quotes-title">Mis solicitudes</h2><p>Consulta el estado de los eventos que enviaste.</p></div>{user && <button className="profile-refresh" type="button" disabled={busy} onClick={() => setRevision(value => value + 1)}>Actualizar</button>}</div>
    {loading || busy ? <p>Cargando tus solicitudes…</p> : !user ? <p>Inicia sesión para consultar tus solicitudes. <button type="button" onClick={() => openAuth()}>Iniciar sesión</button></p> : <>
      {error && <p role="alert" className="profile-error">{error}</p>}
      {quotes.length ? <div className="client-requests">{quotes.map(quote => <article className="client-request" key={quote.id}>
        <div className="client-request-main"><div className="profile-quote-top"><span className="profile-status">{stateLabels[quote.state] || quote.state}</span><time dateTime={quote.created_at}>{dateLabel(quote.created_at)}</time></div>
          <h3>{quote.public_payload.event.eventType}</h3><p><strong>{quote.public_payload.proposal.title}</strong> · {money(quote.public_payload.proposal.total)}</p>
          <p>{eventDate(quote.public_payload.event)} · {quote.public_payload.event.city} · {quote.public_payload.event.guestCount} invitados</p>
          <p>Servicios: {quote.public_payload.services.join(', ')}</p></div>
        <div className="client-request-progress"><strong>{stateMessages[quote.state] || 'Consulta aquí el estado de tu solicitud.'}</strong><small>Referencia: {quote.request_code}</small></div>
      </article>)}</div> : <p className="profile-empty">Aún no has enviado solicitudes. Cuando elijas una propuesta y solicites coordinación, aparecerá aquí.</p>}
      {generated.length > 0 && <details className="client-saved"><summary>Opciones guardadas ({generated.length})</summary><p>Estas comparaciones todavía no se enviaron para coordinar.</p><div className="client-requests">{generated.map(item => <article className="client-request" key={item.id}><div><time dateTime={item.created_at}>{dateLabel(item.created_at)}</time><h3>{item.event.eventType}</h3><p>{eventDate(item.event)} · {item.event.city}</p><p>Servicios: {item.event.selectedServices.join(', ')}</p></div><div className="client-request-progress">{item.proposals.map(proposal => <p key={proposal.title}>{proposal.title}: {money(proposal.total)}</p>)}</div></article>)}</div></details>}
    </>}
  </section>;
}

export default function MyQuotes() {
  return <main className="account-page"><header><a className="wordmark" href={import.meta.env.BASE_URL}>creaf<span>ia</span><i/></a><AuthMenu/></header><div className="profile-shell"><a className="profile-back" href={`${import.meta.env.BASE_URL}profile`}>← Mi perfil</a><QuotesOverview/></div></main>;
}
