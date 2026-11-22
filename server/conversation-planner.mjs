import { conversationQuestion, nextExpectedField } from '../shared/conversation-state.mjs';
import { getEventStatus, getMissingFields } from '../shared/event-state.mjs';
import { normalizeAmbiguities, ambiguityQuestions } from '../shared/event-ambiguities.mjs';
import { correctsField } from './partial-date.mjs';

const questionHints = {
  eventType: /tipo de evento|qu[eé] (?:evento|celebra|ocasi[oó]n|fiesta)|qu[eé] quieres celebrar|qu[eé] te gustar[ií]a celebrar/i,
  date: /fecha|cu[aá]ndo|qu[eé] d[ií]a|qu[eé] mes|qu[eé] a[nñ]o/i,
  guestCount: /invitad|persona|asistent|cu[aá]ntos? (?:ser[aá]n|ir[aá]n|van)/i,
  budget: /presupuesto|monto|dinero|soles|cu[aá]nto (?:puedes|quieres) gastar/i,
  selectedServices: /servicios|qu[eé] (?:necesitas|incluimos|quieres incluir)/i,
};
function asksCurrentQuestion(reply, expectedField, event) {
  if (!expectedField || !questionHints[expectedField] || !/[¿?]/.test(reply)) return false;
  const question = reply.slice(Math.max(0, reply.indexOf('¿')));
  if (!questionHints[expectedField].test(question)) return false;
  return Object.entries(questionHints).every(([field, pattern]) => field === expectedField || !pattern.test(question) ||
    (field === 'date' ? !event.date && !event.datePreference : field === 'selectedServices' ? !event.selectedServices.length : event[field] == null));
}

export function guardConfirmedUpdates(state, updates, message, options, facts) {
  if (options.expectedField === undefined) return updates;
  const safe = { ...updates };
  for (const [field, value] of Object.entries(safe)) {
    const known = state[field];
    if (known !== null && (!Array.isArray(known) || known.length) && JSON.stringify(known) !== JSON.stringify(value)
      && !correctsField(message, field, options.expectedField) && !Object.hasOwn(facts.updates, field)) delete safe[field];
  }
  if (!facts.updates.date) delete safe.date;
  if (facts.partialDateChanged) {
    for (const field of ['guestCount', 'budget']) if (!Object.hasOwn(facts.updates, field)) delete safe[field];
  }
  return safe;
}

export function completeConversationResult(result, previous, facts, { explicitContext = false } = {}) {
  const event = result.eventState;
  const eventDateParts = event.date || event.datePreference ? {} : facts.eventDateParts ?? previous?.eventDateParts ?? {};
  const olderAmbiguities = (previous?.ambiguities || []).filter(item => !(facts.datePreference && item.possibleFields.includes('date')) && !(facts.partialDateChanged && item.possibleFields.length === 1 && item.possibleFields[0] === 'date'));
  const pending = normalizeAmbiguities([...(result.ambiguities || []), ...olderAmbiguities]);
  const ambiguities = [...new Map(pending.filter(item => {
    if (item.possibleFields.includes('date') && (event.date || event.datePreference)) return false;
    if (item.possibleFields.length > 1 && item.possibleFields.some(field => Object.hasOwn(facts.updates, field))) return false;
    return true;
  }).map(item => [`${item.value}:${item.possibleFields.join(',')}`, item])).values()];
  let expectedField = nextExpectedField(event, eventDateParts, ambiguities);
  if (result.focusField === 'guestCount' && event.guestCount == null && !ambiguities.length) expectedField = 'guestCount';
  if (result.showServiceSelector && event.eventType && !ambiguities.length && !Object.keys(eventDateParts).length) expectedField = 'selectedServices';
  const conversationState = { event, expectedField, eventDateParts, ambiguities };
  const status = ambiguities.length || Object.keys(eventDateParts).length ? 'collecting' : getEventStatus(event);
  let reply = result.reply;
  if (explicitContext && !result.error && status === 'collecting') {
    const question = ambiguities.some(item => item.possibleFields.length > 1) ? ambiguityQuestions(ambiguities) : conversationQuestion(conversationState);
    if (ambiguities.some(item => item.possibleFields.length > 1)) reply = question;
    else if (facts.partialDateChanged && !facts.updates.date) reply = `${facts.invalidDatePart ? 'Esa fecha no es válida.' : 'Perfecto.'} ${question}`;
    else if (result.preserveReply || result.naturalReply && asksCurrentQuestion(reply, expectedField, event)) { /* Keep a relevant, natural question. */ }
    else if (facts.datePreference) { /* Keep the date guidance and the next question. */ }
    else if (result.showServiceSelector && expectedField === 'selectedServices') { /* Keep service advice. */ }
    else {
      const prefix = reply.includes('¿') ? reply.slice(0, reply.indexOf('¿')).trim()
        : reply.match(/^Perfecto, (?:anoté|tomo)[^.]*\./)?.[0]
        || (!/formulario|ya tengo|datos necesarios|elige los servicios/i.test(reply) ? reply : '');
      // The next question is always chosen by code, never by the model.
      reply = `${prefix || (result.naturalReply ? 'Te ayudo.' : 'Perfecto.')} ${question}`;
    }
  }
  const { preserveReply: _preserveReply, naturalReply: _naturalReply, suppressServiceSelectorReply: _suppressServiceSelectorReply, focusField: _focusField, ...publicResult } = result;
  return { ...publicResult, reply, missingFields: getMissingFields(event), status, ambiguities, conversationState };
}
