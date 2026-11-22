import { getEventStatus, getMissingFields } from '../shared/event-state.mjs';
import { getSuggestedServices } from '../shared/event-presets.mjs';

const normalize = text => text.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
export function isBareAcknowledgment(message) {
  return /^(?:ok|okay|vale|esta bien|de acuerdo|si|dale|bien|perfecto|excelente|listo)(?: gracias)?$/.test(normalize(message));
}
function hasExplicitChoice(message) {
  return /\b(?:quiero|quisiera|prefiero|elijo|selecciono|selecciona|agrega|anade|incluye|incluyelos|incluyamos|quita|elimina|confirmo|acepto)\b|\b(?:me quedo|vamos) con\b/.test(normalize(message));
}
export function asksForServiceAdvice(message) {
  const text = normalize(message);
  if (/\bproveedores?\b/.test(text) || hasExplicitChoice(message)) return false;
  return /\b(?:cual|cuales|que)(?: \w+){0,4} (?:sugieres|recomiendas|aconsejas|sugeririas|recomendarias)\b|\b(?:sugiereme|recomiendame)\b|\bque opciones (?:hay|tengo)\b|\bno se (?:cual|cuales|que) elegir\b/.test(text);
}

export function guardServiceUpdates(updates, message) {
  // A question or acknowledgment is not consent to select or finish the event.
  if (isBareAcknowledgment(message)) return {};
  if (!asksForServiceAdvice(message)) return updates;
  const { selectedServices, ...otherUpdates } = updates;
  return otherUpdates;
}

export function serviceAdviceResult(state) {
  const options = getSuggestedServices(state.eventType);
  const reply = options.length
    ? `Claro, podrías considerar ${options.join(', ')}. Son sugerencias: marca en el formulario solo los que quieras incluir y confirma tu selección; puedes cambiarla después.`
    : state.eventType
      ? 'Claro, podrías contarme qué te gustaría ofrecer a tus invitados y te ayudo a definir los servicios, sin dar ninguno por elegido.'
      : 'Claro. ¿Qué tipo de evento quieres organizar? Así puedo sugerirte servicios adecuados.';
  return { reply, eventState: state, missingFields: getMissingFields(state), status: getEventStatus(state), showServiceSelector: options.length > 0 };
}

export function localServiceResponse(state, message) {
  const text = normalize(message);
  // Only short, standalone questions bypass extraction; mixed messages may contain new facts.
  const simpleAdvice = /^(?:y |ok |entonces )?(?:(?:cual|cuales|que)(?: (?:servicios|opciones))?(?: me)? (?:sugieres|recomiendas|aconsejas|sugeririas|recomendarias)|(?:sugiereme|recomiendame)(?: (?:algunos|servicios|opciones|algo)){0,2}|que opciones (?:hay|tengo)|no se (?:cual|cuales|que) elegir)$/.test(text);
  if (simpleAdvice) return serviceAdviceResult(state);
  const missing = getMissingFields(state);
  if (isBareAcknowledgment(message) && missing.length === 1 && missing[0] === 'selectedServices') {
    return { ...serviceAdviceResult(state), reply: 'Perfecto. ¿Quieres incluir todos o prefieres elegir algunos? Márcalos en el formulario y confirma tu selección para continuar.' };
  }
  return null;
}
