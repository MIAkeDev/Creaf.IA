import { applyEventUpdates, getEventStatus, getMissingFields } from '../shared/event-state.mjs';
import { dateExample, formatEventDate, isStandaloneRelativeDate, resolveRelativeEventDate } from '../shared/event-dates.mjs';
import { questionFor } from '../shared/event-questions.mjs';

export function dateConfirmationResult(eventState, date) {
  const rawNext = questionFor(eventState).replace(/^(?:Excelente|Perfecto|Claro)[,.]\s*/, '');
  const next = rawNext.charAt(0).toLocaleUpperCase('es') + rawNext.slice(1);
  return { reply: `Perfecto, tomo el ${formatEventDate(date)}. ${next}`, eventState, missingFields: getMissingFields(eventState), status: getEventStatus(eventState) };
}
export function localRelativeDateResponse(state, message, reference) {
  if (isStandaloneRelativeDate(message)) {
    const date = resolveRelativeEventDate(message, reference);
    if (date) return dateConfirmationResult(applyEventUpdates(state, { date }), date);
  }
  const text = message.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().replace(/[.!¿?]/g, '');
  if (/^(?:el proximo mes|la proxima semana|la otra semana|pronto)$/.test(text)) {
    return { reply: `Para anotarlo bien, ¿qué día y mes tienes en mente? Puedes escribir una fecha como «${dateExample(reference)}».`, eventState: state, missingFields: getMissingFields(state), status: getEventStatus(state) };
  }
  return null;
}
