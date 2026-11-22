export const REQUIRED_FIELDS = ['eventType', 'date', 'guestCount', 'budget', 'selectedServices'];
const textFields = ['eventType', 'date', 'datePreference', 'city', 'style'];
const arrayFields = ['selectedServices', 'extraRequirements'];
const allowedFields = [...textFields, ...arrayFields, 'guestCount', 'budget'];
export function createEventState() {
  return { eventType: null, date: null, datePreference: null, guestCount: null, budget: null, city: 'Ilo', style: null, selectedServices: [], extraRequirements: [] };
}
export function validateUpdates(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid updates');
  const result = {};
  for (const [field, item] of Object.entries(value)) {
    if (!allowedFields.includes(field)) throw new Error('Unknown event field');
    if (textFields.includes(field)) {
      if (item !== null && (typeof item !== 'string' || !item.trim() || item.length > 160)) throw new Error('Invalid text');
      if (field === 'city' && item === null) throw new Error('Invalid city');
      result[field] = item === null ? null : item.trim();
    } else if (arrayFields.includes(field)) {
      if (!Array.isArray(item) || item.length > 20 || item.some(text => typeof text !== 'string' || !text.trim() || text.length > 160)) throw new Error('Invalid list');
      result[field] = [...new Map(item.map(text => [text.trim().toLocaleLowerCase('es'), text.trim()])).values()];
    } else {
      const maximum = field === 'guestCount' ? 100000 : 100000000;
      if (item !== null && (typeof item !== 'number' || !Number.isFinite(item) || item <= 0 || item > maximum || (field === 'guestCount' && !Number.isInteger(item)))) throw new Error('Invalid number');
      result[field] = item;
    }
  }
  return result;
}
export function validateEventState(value = {}) {
  const event = { ...createEventState(), ...validateUpdates(value) };
  if (event.date && event.datePreference) throw new Error('Date and date preference cannot coexist');
  return event;
}
export function applyEventUpdates(state, updates) {
  const safe = validateUpdates(updates);
  if (safe.date) safe.datePreference = null;
  else if (safe.datePreference) safe.date = null;
  return validateEventState({ ...state, ...safe });
}
export function getMissingFields(state) {
  return REQUIRED_FIELDS.filter(field => field === 'selectedServices' ? state[field].length === 0 : field === 'date' ? state.date === null && state.datePreference === null : state[field] === null);
}
export function getEventStatus(state) { return getMissingFields(state).length ? 'collecting' : 'ready'; }
export function compactEventState(state) {
  return Object.fromEntries(Object.entries(state).filter(([, value]) => value !== null && (!Array.isArray(value) || value.length)));
}
