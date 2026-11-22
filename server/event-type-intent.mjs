import { detectEventType, isStandaloneEventType } from '../shared/event-presets.mjs';
import { applyEventUpdates, getEventStatus, getMissingFields } from '../shared/event-state.mjs';
import { questionFor } from '../shared/event-questions.mjs';

export function resolveExplicitEventType(state, message) {
  const correction = message.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const replacement = correction.match(/\b(?:sino(?: que)?|en vez de|mejor(?: para)?|cambi(?:amos|o|ar) a)\s+(?:para\s+)?(?:un(?:a)?\s+)?(.+)$/);
  if (replacement) {
    const target = replacement[1].replace(/[.!?]+$/, '').trim();
    if (/^(?:fiesta|celebracion|evento)(?: general)?$/.test(target)) return 'otro';
    const changedType = detectEventType(target);
    if (changedType) return changedType;
  }
  const type = detectEventType(message);
  if (!type) return null;
  if (type === 'quinceañero' && state.eventType && state.eventType !== type && /^(?:el )?quince[.!]?$/i.test(message.trim())) return null;
  if (!state.eventType || isStandaloneEventType(message) || /\b(?:en realidad|mejor|cambio|cambiemos|ahora quiero|en vez|sino)\b/i.test(message)) return type;
  return null;
}
export function eventTypeConfirmation(state) {
  const label = state.eventType === 'otro' ? 'una fiesta general' : state.eventType === 'graduación' ? 'una graduación' : state.eventType === 'babyShower' ? 'un baby shower' : state.eventType === 'corporativo' ? 'un evento corporativo' : `un ${state.eventType}`;
  const next = questionFor(state).replace(/^(?:Excelente|Perfecto|Claro)[,.]\s*/, '');
  return `Perfecto, organizamos ${label}. ${next}`;
}
export function localEventTypeResponse(state, message) {
  if (!isStandaloneEventType(message)) return null;
  const eventType = resolveExplicitEventType(state, message);
  if (!eventType) return null;
  const eventState = applyEventUpdates(state, { eventType });
  return { reply: eventTypeConfirmation(eventState), eventState, missingFields: getMissingFields(eventState), status: getEventStatus(eventState) };
}
export function localEventTypeUncertaintyResponse(state, message, expectedField, lastAssistantMessage = '') {
  if (state.eventType || expectedField !== 'eventType') return null;
  const text = message.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!/^(?:nose|(?:(?:aun|todavia|por ahora) )?no (?:lo )?se(?: todavia| aun)?|no (?:tengo claro|he decidido)(?: el tipo de evento)?)$/.test(text)) return null;
  const alreadyAsked = /tipo de evento|qu[eé] (?:quieres|te gustar[ií]a) celebrar/i.test(lastAssistantMessage);
  return {
    reply: `${alreadyAsked ? 'Disculpa la insistencia. ' : 'No pasa nada. '}Para mostrarte servicios y precios adecuados sí necesito saber qué tipo de celebración imaginas. Puede ser cumpleaños, boda, quinceañero o una fiesta general; con una idea aproximada basta.`,
    eventState: state,
    missingFields: getMissingFields(state),
    status: getEventStatus(state),
    preserveReply: true,
  };
}
