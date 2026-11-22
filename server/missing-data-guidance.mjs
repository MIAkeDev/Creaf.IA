import { getEventStatus, getMissingFields } from '../shared/event-state.mjs';

const normalize = value => value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¿?¡!.,;:]/g, ' ').replace(/\s+/g, ' ').trim();

export function localMissingDataGuidance(state, message, expectedField, lastAssistantMessage = '') {
  if (!expectedField || (expectedField === 'date' && (state.date || state.datePreference))) return null;
  const text = normalize(message);
  const uncertain = /^(?:no (?:tengo|se|estoy seguro|tengo idea)(?: (?:claro|todavia|aun|nada))?|aun no (?:lo )?se|todavia no (?:lo )?se|no estoy seguro(?: solo quiero (?:precios|cotizar))?|solo quiero (?:precios|cotizar|una cotizacion)|quiero (?:ver )?precios)(?: por ahora)?$/.test(text);
  if (!uncertain) return null;
  const prices = /precios|cotizar|cotizacion/.test(text);
  const repeated = /para (?:darte|mostrarte|comparar) (?:mejores )?opciones|para mostrarte precios/i.test(lastAssistantMessage);
  const replies = {
    eventType: repeated
      ? 'Puedes decirme si piensas en un cumpleaños, boda, quinceañero o una fiesta general. Con una idea aproximada puedo seguir.'
      : prices
        ? 'Para mostrarte precios que sí correspondan a tu celebración, necesito saber qué tipo de evento imaginas. ¿Es un cumpleaños, boda, quinceañero o una fiesta general?'
        : 'No pasa nada si aún no lo tienes claro. Para encontrar opciones adecuadas, ¿qué te gustaría celebrar? Puede ser un cumpleaños, boda o una fiesta general.',
    date: 'La fecha puede quedar por definir. Dime «aún no sé la fecha» y seguimos con los demás datos para cotizar.',
    guestCount: 'Para elegir paquetes que puedan atender a todos, necesito una cantidad aproximada. ¿Cuántas personas crees que asistirían?',
    budget: 'Para comparar opciones dentro de lo que puedes gastar, necesito un monto aproximado en soles. ¿Qué presupuesto o rango tienes en mente?',
    selectedServices: 'Para calcular precios necesito saber qué servicios quieres incluir. Puedes marcar los que te interesen en el formulario y cambiar tu selección después.',
  };
  return { reply: replies[expectedField] || replies.eventType, eventState: state, missingFields: getMissingFields(state), status: getEventStatus(state), preserveReply: true, suppressServiceSelectorReply: true };
}
