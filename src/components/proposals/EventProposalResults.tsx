import SpecularButton from '../SpecularButton';
import { useEffect, useRef, useState } from 'react';
import type { EventState } from '../../types/event';
import type { EventProposal, ProposalResults } from '../../types/proposal';
import { EventProposalCard } from './EventProposalCard';
import { ProposalDetailsSheet } from './ProposalDetailsSheet';
import { formatMoney } from './ProposalProviderPreview';
import './proposals.css';
import { useAuth } from '../../auth/AuthProvider';
import { PENDING_QUOTE_KEY } from '../../auth/PendingCoordination';
import { privateApi } from '../../auth/client';
import { notify } from '../../auth/toast-events';
export type ProposalActions = { onBudget: (budget: number) => void; onGuestCount: (count: number) => void; onRemoveService: (service: string) => void; onAlternatives: () => void; onRetry: () => void; onChangeDate: () => void; onStartOver: () => void };
export function EventProposalResults({ data, event, actions, disabled }: { data: ProposalResults; event: EventState; actions: ProposalActions; disabled: boolean }) {
  const [selected, setSelected] = useState<EventProposal | null>(null);
  const { user, openAuth } = useAuth();
  const savedFor = useRef('');
  useEffect(() => {
    if (!user || !data.proposals.length) return;
    const key = `${user.id}:${JSON.stringify(event)}:${data.allowAlternatives}`;
    if (savedFor.current === key) return;
    savedFor.current = key;
    void privateApi('quotes/generated', { method: 'POST', body: JSON.stringify({ conversationState: { event, expectedField: null, eventDateParts: {}, ambiguities: [] }, allowAlternatives: data.allowAlternatives }) })
      .catch(() => { savedFor.current = ''; notify('No se pudo guardar esta cotización en tu cuenta. Puedes volver a comparar para intentarlo de nuevo.', 'error'); });
  }, [user, event, data.allowAlternatives, data.proposals.length]);
  function request(proposal: EventProposal) {
    sessionStorage.setItem(PENDING_QUOTE_KEY, JSON.stringify({ event, proposalId: proposal.id, allowAlternatives: data.allowAlternatives, idempotencyKey: crypto.randomUUID() }));
    setSelected(null);
    window.dispatchEvent(new Event('creafia-pending-quote'));
    if (!user) openAuth('login');
  }
  const [budget, setBudget] = useState(data.suggestedBudget ?? event.budget ?? 0);
  const [guests, setGuests] = useState(event.guestCount ?? 0);
  const count = data.proposals.length;
  return <section className="event-proposal-results" aria-label="Propuestas para tu evento"><div className="proposal-results-heading"><h2>{count ? `Encontré ${count} ${count === 1 ? 'opción' : 'opciones'}.` : 'Faltan opciones para completar tu evento.'}</h2><p>Analicé {data.compatibleProviders} {data.compatibleProviders === 1 ? 'proveedor compatible' : 'proveedores compatibles'}.</p></div>
    {data.allowAlternatives && <p className="proposal-alternatives-note">Incluye alternativas hasta un 25% por encima del presupuesto; cada diferencia se muestra en su tarjeta.</p>}
    {!!count && <div className="proposal-card-grid">{data.proposals.map(proposal => <EventProposalCard key={proposal.id} proposal={proposal} onOpen={() => setSelected(proposal)}/>)}</div>}
    {!count && <div className="proposal-empty-actions">
      {!!data.blockers.length && <ul className="proposal-blockers">{data.blockers.map(blocker => <li key={blocker.category}><strong>{blocker.category}</strong><p>{blocker.message}</p></li>)}</ul>}
      {data.suggestedBudget !== undefined ? <>
        <p>El precio inicial mínimo para cubrir todos los servicios es {formatMoney(data.minimumTotal!)}.</p>
        <div className="proposal-budget-edit"><label>Nuevo presupuesto (S/)<input type="number" min="1" max="100000000" step="1" value={budget || ''} onChange={event => setBudget(Number(event.target.value))}/></label><SpecularButton type="button" disabled={disabled || budget <= 0 || budget > 100000000 || budget === event.budget} onClick={() => actions.onBudget(budget)}>Probar con {formatMoney(budget)}</SpecularButton></div>
      </> : <p>Aumentar el presupuesto no resuelve estos criterios. Puedes ajustar tu selección o volver a comparar cuando se registren paquetes compatibles.</p>}
      {data.blockers.some(blocker => blocker.reason === 'capacity') && <div className="proposal-budget-edit"><label>Invitados previstos<input type="number" min="1" max="100000" step="1" value={guests || ''} onChange={event => setGuests(Number(event.target.value))}/></label><SpecularButton type="button" disabled={disabled || !Number.isInteger(guests) || guests < 1 || guests > 100000 || guests === event.guestCount} onClick={() => actions.onGuestCount(guests)}>Actualizar invitados</SpecularButton></div>}
      <div className="proposal-adjustments">{(data.missingCategories.length ? data.missingCategories : event.selectedServices).map(service => <SpecularButton type="button" variant="ghost" size="sm" key={service} disabled={disabled} onClick={() => actions.onRemoveService(service)}>Quitar {service}</SpecularButton>)}{data.canAllowAlternatives && <SpecularButton type="button" variant="ghost" size="sm" disabled={disabled} onClick={actions.onAlternatives}>Permitir alternativas hasta +25%</SpecularButton>}</div>
    </div>}
    <div className="proposal-results-footer"><p className="proposal-footnote">Precios iniciales registrados. Disponibilidad y cotización final pendientes.</p><SpecularButton type="button" variant="ghost" size="sm" disabled={disabled} onClick={actions.onRetry}>Volver a comparar</SpecularButton></div>
    <div className="proposal-again"><div><h3>¿Quieres cotizar otra vez?</h3><p>Puedes probar otra fecha con los mismos datos o empezar con un evento nuevo.</p></div><div className="proposal-again-actions"><SpecularButton type="button" variant="ghost" size="sm" disabled={disabled} onClick={actions.onChangeDate}>Cambiar fecha</SpecularButton><SpecularButton type="button" size="sm" disabled={disabled} onClick={actions.onStartOver}>Empezar de nuevo</SpecularButton></div></div>
    {selected && <ProposalDetailsSheet proposal={selected} onClose={() => setSelected(null)} onRequest={() => request(selected)}/>}
  </section>;
}
