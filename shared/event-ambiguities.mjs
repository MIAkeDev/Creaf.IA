import { REQUIRED_FIELDS } from './event-state.mjs';
export function normalizeAmbiguities(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 5).flatMap(item => {
    if (!item || typeof item !== 'object' || typeof item.value !== 'string' || !item.value.trim() || item.value.length > 160 || !Array.isArray(item.possibleFields)) return [];
    const possibleFields = [...new Set(item.possibleFields.filter(field => REQUIRED_FIELDS.includes(field)))];
    return possibleFields.length ? [{ value: item.value.trim(), possibleFields, ...(item.reason === 'missing_year' ? { reason: 'missing_year' } : {}) }] : [];
  });
}
export function ambiguityQuestions(ambiguities) {
  return normalizeAmbiguities(ambiguities).slice(0, 2).map(item => item.reason === 'missing_year'
    ? `¿De qué año sería el ${item.value}?`
    : item.possibleFields.includes('guestCount') && item.possibleFields.includes('budget')
      ? `¿Te refieres a ${item.value} invitados o a S/ ${item.value} de presupuesto?`
      : `¿Qué significa «${item.value}» para tu evento?`).join(' ');
}
