import { createEventState, getMissingFields, validateEventState } from './event-state.mjs';
import { normalizeAmbiguities } from './event-ambiguities.mjs';
import { getSuggestedServices } from './event-presets.mjs';

export const EXPECTED_FIELDS = ['eventType', 'date', 'guestCount', 'budget', 'selectedServices', 'style'];
export function nextExpectedField(event, eventDateParts = {}, ambiguities = []) {
  const pending = normalizeAmbiguities(ambiguities);
  if (pending.some(item => item.possibleFields.length > 1)) return null;
  if (pending.length) return pending[0].possibleFields[0];
  if (Object.keys(eventDateParts).length) return 'date';
  return getMissingFields(event)[0] ?? null;
}
export function createConversationState() {
  return { event: createEventState(), expectedField: 'eventType', eventDateParts: {}, ambiguities: [] };
}
export function dateFromParts(parts) {
  if (!parts.day || !parts.month || !parts.year) return null;
  const iso = `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
  const date = new Date(`${iso}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === iso ? iso : null;
}
export function validDateParts(parts) {
  if (!parts || typeof parts !== 'object' || Array.isArray(parts)) return false;
  const limits = { day: [1, 31], month: [1, 12], year: [2000, 2100] };
  for (const [key, value] of Object.entries(parts)) {
    if (!Object.hasOwn(limits, key) || !Number.isInteger(value) || value < limits[key][0] || value > limits[key][1]) return false;
  }
  return !parts.day || !parts.month || !!dateFromParts({ ...parts, year: parts.year ?? 2000 });
}
export function validateConversationState(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.keys(value).some(key => !['event', 'expectedField', 'eventDateParts', 'ambiguities'].includes(key))) throw new Error('Invalid conversation');
  if (value.expectedField !== null && !EXPECTED_FIELDS.includes(value.expectedField)) throw new Error('Invalid expected field');
  if (!value.event || !validDateParts(value.eventDateParts ?? {})) throw new Error('Invalid conversation data');
  const event = validateEventState(value.event);
  const eventDateParts = { ...value.eventDateParts };
  if ((event.date || event.datePreference) && Object.keys(eventDateParts).length) throw new Error('Date must be complete or partial');
  return { event, expectedField: value.expectedField, eventDateParts, ambiguities: normalizeAmbiguities(value.ambiguities) };
}
export function conversationQuestion(conversation) {
  const { event, expectedField, eventDateParts: parts } = conversation;
  if (expectedField === 'date') {
    if (Object.keys(parts).length) {
      if (!parts.day) return '¿Qué día del mes sería?';
      if (!parts.month) return '¿De qué mes sería?';
      if (!parts.year) return '¿De qué año sería?';
    }
    return '¿En qué fecha te gustaría celebrar el evento? Si aún no lo sabes, dímelo y podemos cotizar sin fecha definida.';
  }
  if (expectedField === 'eventType') return '¿Qué tipo de evento te gustaría organizar?';
  if (expectedField === 'guestCount') return '¿Cuántas personas asistirían aproximadamente?';
  if (expectedField === 'budget') return '¿Con qué presupuesto aproximado cuentas en soles?';
  if (expectedField === 'selectedServices') return getSuggestedServices(event.eventType).length
    ? 'Elige los servicios en el formulario de abajo. Puedes marcar todos y desmarcar después cualquiera que no necesites.'
    : '¿Qué servicios te gustaría incluir?';
  if (expectedField === 'style') return '¿Qué estilo te gustaría para el evento?';
  return 'Ya tengo los datos necesarios de tu evento. Voy a comparar las opciones del catálogo para tu presupuesto.';
}
