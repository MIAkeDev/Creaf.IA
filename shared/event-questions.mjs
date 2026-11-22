import { getMissingFields } from './event-state.mjs';
import { getSuggestedServices } from './event-presets.mjs';
import { dateExample } from './event-dates.mjs';

export function questionFor(state) {
  const missing = getMissingFields(state);
  if (missing.includes('eventType')) return 'Claro. ¿Qué tipo de evento te gustaría organizar?';
  if (missing.includes('date') && missing.includes('guestCount')) return `Excelente. ¿Qué fecha (día, mes y año) tienes en mente y cuántas personas asistirían? Puedes dar un rango o decir que aún no lo sabes. Por ejemplo, «${dateExample()}».`;
  if (missing.includes('date')) return `Perfecto. ¿Qué fecha (día, mes y año) tienes en mente? Puedes dar un rango o decir que aún no lo sabes. Por ejemplo, «${dateExample()}».`;
  if (missing.includes('guestCount')) return 'Excelente. ¿Cuántas personas asistirían aproximadamente?';
  if (missing.includes('budget')) return 'Perfecto. ¿Con qué presupuesto aproximado cuentas en soles?';
  if (missing.includes('selectedServices')) return getSuggestedServices(state.eventType).length
    ? 'Excelente. Elige los servicios que te gustaría incluir en el formulario de abajo. Puedes marcar todos y desmarcar después cualquiera que no necesites.'
    : 'Excelente. ¿Qué servicios te gustaría incluir en tu evento? Puedes escribirlos aquí.';
  return 'Excelente, ya tengo los datos necesarios de tu evento. Voy a comparar las opciones del catálogo para tu presupuesto.';
}
