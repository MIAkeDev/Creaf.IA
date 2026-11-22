import { useEffect, useState, type FormEvent } from 'react';
import { createPortal } from 'react-dom';
import type { EventState } from '../types/event';
import { createConversationState } from '../../shared/conversation-state.mjs';
import { privateApi, supabase } from './client';
import { useAuth } from './AuthProvider';
import { notify } from './toast-events';
import './auth.css';

export type PendingQuote = { event: EventState; proposalId: string; allowAlternatives: boolean; idempotencyKey: string };
export const PENDING_QUOTE_KEY = 'creafia_pending_quote';
function readPending(): PendingQuote | null {
  try { return JSON.parse(sessionStorage.getItem(PENDING_QUOTE_KEY) || 'null') as PendingQuote | null; } catch { return null; }
}
export function PendingCoordination() {
  const { user, openAuth, authMode } = useAuth();
  const [pending, setPending] = useState(readPending);
  const [whatsapp, setWhatsapp] = useState(''); const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false); const [error, setError] = useState(''); const [code, setCode] = useState('');
  useEffect(() => { const refresh = () => setPending(readPending()); window.addEventListener('creafia-pending-quote', refresh); return () => window.removeEventListener('creafia-pending-quote', refresh); }, []);
  useEffect(() => { if (!user || !supabase) return; void supabase.from('profiles').select('whatsapp').eq('user_id', user.id).maybeSingle().then(({ data }) => { if (data?.whatsapp) setWhatsapp(data.whatsapp); }); }, [user]);
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!pending || !user || busy) return;
    setBusy(true); setError('');
    try {
      const conversationState = { ...createConversationState(), event: pending.event, expectedField: null };
      const { quotation } = await privateApi<{ quotation: { request_code: string } }>('quotes', { method: 'POST', body: JSON.stringify({ conversationState, proposalId: pending.proposalId, allowAlternatives: pending.allowAlternatives, idempotencyKey: pending.idempotencyKey, whatsapp, consent }) });
      if (supabase) void supabase.from('profiles').upsert({ user_id: user.id, whatsapp: whatsapp.replace(/\D/g, '') }).then(({ error }) => { if (error) notify('La solicitud se guardó, pero no pudimos actualizar el WhatsApp del perfil.', 'info'); });
      setCode(quotation.request_code); sessionStorage.removeItem(PENDING_QUOTE_KEY); sessionStorage.removeItem('creafia_chat_draft'); setPending(null);
      notify('Solicitud recibida. Confirmaremos en breve; podrás seguirla en tu perfil o por WhatsApp.', 'success');
    } catch (cause) { const message = cause instanceof Error ? cause.message : 'No se pudo guardar la solicitud.'; setError(message); notify(message, 'error'); }
    finally { setBusy(false); }
  }
  if ((!pending && !code) || authMode) return null;
  return createPortal(<div className="auth-backdrop"><section className="auth-dialog coordination-dialog" role="dialog" aria-modal="true" aria-label="Solicitar coordinación"><button className="auth-close" type="button" aria-label="Cerrar" onClick={() => { sessionStorage.removeItem(PENDING_QUOTE_KEY); setPending(null); setCode(''); }}>×</button>
    {code ? <div className="coordination-success"><span className="coordination-success-icon" aria-hidden="true">✓</span><h2>Recibimos tu solicitud</h2><p>Confirmaremos los detalles en breve. Podrás consultar el estado en tu perfil y coordinaremos contigo por WhatsApp.</p><div className="coordination-code"><span>Código de seguimiento</span><strong>{code}</strong><small>Úsalo para identificar esta solicitud si nos escribes.</small></div><a className="coordination-profile-link" href={`${import.meta.env.BASE_URL}profile#cotizaciones`}>Ver seguimiento en mi perfil</a></div>
      : !user ? <><h2>¡Estás a un paso de coordinar tu evento!</h2><p>Identifícate para guardar tu cotización y solicitar la coordinación personalizada.</p><button type="button" onClick={() => openAuth('login')}>Iniciar sesión</button><button type="button" onClick={() => openAuth('register')}>Crear cuenta</button></>
      : <><h2>Solicitar coordinación</h2><p>Guardaremos tu propuesta y te contactaremos para confirmar disponibilidad y condiciones. El beneficio de bienvenida se coordina contigo.</p><form onSubmit={event => void submit(event)}><label>WhatsApp<input required type="tel" inputMode="tel" autoComplete="tel" placeholder="+51 999 999 999" value={whatsapp} onChange={event => setWhatsapp(event.target.value)}/></label><label className="coordination-consent"><input type="checkbox" checked={consent} onChange={event => setConsent(event.target.checked)}/>Acepto que CreafIA me contacte por esta solicitud.</label><button type="submit" disabled={busy || !consent || !/^\d{9,15}$/.test(whatsapp.replace(/\D/g, ''))}>{busy ? 'Guardando…' : 'Confirmar solicitud'}</button></form>{error && <p role="alert">{error}</p>}</>}
  </section></div>, document.body);
}

