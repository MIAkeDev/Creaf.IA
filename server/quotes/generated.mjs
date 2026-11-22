import { createHash } from 'node:crypto';
import { validateConversationState, dateFromParts } from '../../shared/conversation-state.mjs';
import { getEventStatus } from '../../shared/event-state.mjs';
import { generateProposals } from '../proposals/proposalEngine.mjs';
import { QuoteInputError } from './logic.mjs';

export function buildGeneratedQuote(body, providers, user) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['conversationState', 'allowAlternatives'].includes(key)) || typeof body.allowAlternatives !== 'boolean') throw new QuoteInputError('Solicitud no válida.');
  let conversation;
  try { conversation = validateConversationState(body.conversationState); } catch { throw new QuoteInputError('Los datos del evento no son válidos.'); }
  const event = conversation.event;
  if (getEventStatus(event) !== 'ready' || conversation.ambiguities.length || Object.keys(conversation.eventDateParts).length) throw new QuoteInputError('Completa los datos del evento antes de cotizar.');
  if (event.date !== null) {
    const [year, month, day] = event.date.split('-').map(Number);
    if (dateFromParts({ year, month, day }) !== event.date) throw new QuoteInputError('La fecha del evento no es válida.');
  }
  const result = generateProposals(event, providers, { allowAlternatives: body.allowAlternatives });
  if (!result.proposals.length) return null;
  const proposals = result.proposals.map(({ id, title, type, total, providers: items }) => ({ id, title, type, total, services: items.map(({ category, serviceName, price }) => ({ category, serviceName, price })) }));
  const eventSnapshot = { eventType: event.eventType, date: event.date, datePreference: event.datePreference, city: event.city, guestCount: event.guestCount, budget: event.budget, selectedServices: event.selectedServices };
  const fingerprint = createHash('sha256').update(JSON.stringify({ eventSnapshot, proposals, allowAlternatives: body.allowAlternatives })).digest('hex');
  return { user_id: user.id, fingerprint, customer_email: user.email || '', customer_name: user.user_metadata?.full_name || user.user_metadata?.name || '', event: eventSnapshot, proposals };
}
