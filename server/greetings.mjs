import { getEventStatus, getMissingFields } from '../shared/event-state.mjs';
import { questionFor } from '../shared/event-questions.mjs';

export function removeRepeatedGreeting(text) {
  let result = text.trim();
  const prefix = /^¡?\s*(?:hola(?:[,\s]+(?:mucho gusto|un gusto(?: saludarte)?))?|buenos días|buenas tardes|buenas noches|mucho gusto|un gusto(?: saludarte)?)\s*[!.,;:]\s*/i;
  while (prefix.test(result)) result = result.replace(prefix, '').trim();
  return result;
}

export function localGreetingResponse(state, message, conversationStarted = false) {
  const greeting = message.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¡!¿?.,👋]/gu, ' ').replace(/\s+/g, ' ').trim();
  // Only standalone greetings are local: "Hola, quiero un cumpleaños" still needs extraction.
  if (!/^(?:hola(?: (?:que tal|buenas|mucho gusto))?|buenas|buenos dias|buenas tardes|buenas noches|hey|holi)$/.test(greeting)) return null;
  const status = getEventStatus(state);
  const next = questionFor(state).replace(/^(?:Excelente|Perfecto|Claro)[,.]\s*/, '');
  return {
    reply: conversationStarted
      ? status === 'ready' ? 'Ya tengo los datos de tu evento; dime si quieres cambiar algo.' : next
      : status === 'ready'
      ? '¡Hola, mucho gusto! Ya tengo los datos de tu evento; puedes decirme si quieres cambiar algo.'
      : `¡Hola, mucho gusto! ${next}`,
    eventState: state, missingFields: getMissingFields(state), status,
  };
}
