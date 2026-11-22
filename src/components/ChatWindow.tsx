import SpecularButton from './SpecularButton';
import { useLayoutEffect, useRef } from 'react';
import type { Message, MonkeyState } from '../types/monkey';
import { ChatMessage } from './ChatMessage';
import ThoughtLine from './ThoughtLine';
import { ServiceSelector } from './ServiceSelector';
import type { EventState } from '../types/event';
import { getMissingFields } from '../../shared/event-state.mjs';
import type { ProposalActions } from './proposals/EventProposalResults';

const steps = ['Leyendo tu mensaje', 'Preparando una respuesta', 'Un momento más…'];
export function ChatWindow({ messages, state, busy, eventState, servicePickerRequested, onConfirmServices, proposalLoading, proposalError, proposalActions }: { messages: Message[]; state: MonkeyState; busy: boolean; eventState: EventState; servicePickerRequested: boolean; onConfirmServices: (services: string[]) => void; proposalLoading: boolean; proposalError: string; proposalActions: ProposalActions }) {
  const ref = useRef<HTMLDivElement>(null);
  const shownMessage = useRef<number | undefined>(undefined);
  const lastAssistant = messages.map(message => message.role === 'assistant' && message.type === 'text').lastIndexOf(true);
  const lastProposal = messages.filter(message => message.type === 'event_proposals').at(-1)?.id;
  const showServices = !!eventState.eventType && (servicePickerRequested || eventState.selectedServices.length > 0 || getMissingFields(eventState).every(field => field === 'selectedServices'));
  useLayoutEffect(() => {
    const container = ref.current; const latest = messages.at(-1);
    if (!container || !latest || shownMessage.current === latest.id) return;
    shownMessage.current = latest.id;
    const node = container.querySelector<HTMLElement>(`[data-message-id="${latest.id}"]`);
    container.scrollTop = latest.role === 'assistant' && node
      ? node.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop - 16
      : container.scrollHeight;
  }, [messages]);
  return <div className="conversation" ref={ref} role="log" aria-live="polite" aria-relevant="additions text" aria-label="Conversación">{messages.map((message, index) => <div key={message.id}>
    <ChatMessage message={message} proposalActions={proposalActions} proposalDisabled={busy || message.id !== lastProposal || (message.type === 'event_proposals' && JSON.stringify(message.event) !== JSON.stringify(eventState))}/>
    {index === lastAssistant && showServices && <ServiceSelector eventType={eventState.eventType!} city={eventState.city} guestCount={eventState.guestCount} selectedServices={eventState.selectedServices} busy={busy} onConfirm={onConfirmServices}/>}
    {message.role === 'user' && <ThoughtLine
      working={busy && !proposalLoading && index === messages.length - 1}
      steps={steps}
      activeStep={state === 'searching' ? 2 : state === 'thinking' ? 1 : 0}
      label="Pensando…"
      doneLabel="Tiempo de preparación:"
      glyph="sparkle"
      fontSize={16}
      breathPeriod={1.6}
      breathDepth={0.45}
      settleDuration={350}
      settleBlur={2}
      collapsible
      collapseOnSettle
      showTimer
    />}
  </div>)}{proposalLoading && <div className="proposal-loading"><ThoughtLine working steps={['Revisando tus servicios', 'Comparando las opciones', 'Preparando tus propuestas']} activeStep={state === 'searching' ? 2 : 1} label="Buscando combinaciones…" showTimer/></div>}{proposalError && <div role="alert" className="proposal-search-error">{proposalError}<SpecularButton type="button" className="proposal-retry" disabled={busy} onClick={proposalActions.onRetry}>Reintentar comparación</SpecularButton></div>}</div>;
}
