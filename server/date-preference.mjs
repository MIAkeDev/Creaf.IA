import { getEventStatus, getMissingFields } from '../shared/event-state.mjs';
import { questionFor } from '../shared/event-questions.mjs';

const normalize = value => value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();

export function detectDatePreference(message, expectedField) {
  const text = normalize(message);
  const explicitlyUndecided = /\b(?:no tengo (?:una )?fecha|sin fecha|fecha (?:por definir|pendiente|flexible)|aun no (?:tengo|decido) (?:la )?fecha|todavia no (?:tengo|decido) (?:la )?fecha|solo quiero cotizar|solo estoy cotizando|quiero (?:solo )?una cotizacion)\b/.test(text);
  const shortUndecided = /^(?:(?:aun|todavia|por ahora) )?no (?:lo )?se(?: todavia| aun)?$|^no tengo(?: idea| fecha)?$|^no estoy seguro$|^por definir$/.test(text);
  if (explicitlyUndecided || (expectedField === 'date' && shortUndecided)) return 'Fecha por definir';

  const dateContext = expectedField === 'date' || /\b(?:fecha|dia|dias|mes|enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/.test(text);
  const range = text.match(/^(?:seria |seria del |del |para |la fecha seria )?(?:entre |del )?(?:el )?(\d{1,2})(?: de [a-z]+)? (?:y|al) (?:el )?(\d{1,2})(?: de [a-z]+)?(?: de \d{4})?$/);
  if (dateContext && range && Number(range[1]) >= 1 && Number(range[1]) <= 31 && Number(range[2]) >= 1 && Number(range[2]) <= 31) {
    return `Rango aproximado: ${message.trim().slice(0, 140)}`;
  }
  return null;
}

export function localDatePreferenceResponse(eventState, preference) {
  const introductory = preference === 'Fecha por definir'
    ? 'Claro, podemos cotizar aunque todavía no tengas una fecha.'
    : 'Claro, tomo ese rango como referencia para la cotización.';
  const note = 'La disponibilidad se confirmará cuando definas el día.';
  return {
    reply: `${introductory} ${note} ${getEventStatus(eventState) === 'ready' ? 'Ya puedo comparar las opciones registradas.' : questionFor(eventState)}`,
    eventState,
    missingFields: getMissingFields(eventState),
    status: getEventStatus(eventState),
  };
}
