export const EVENT_PRESETS = {
  quinceañero: ['Local', 'Decoración', 'Catering', 'Torta', 'DJ', 'Fotografía', 'Maestro de ceremonia'],
  cumpleaños: ['Local', 'Decoración', 'Catering', 'Torta', 'DJ'],
  matrimonio: ['Local', 'Decoración', 'Catering', 'Torta', 'DJ', 'Fotografía', 'Video', 'Maestro de ceremonia'],
  babyShower: ['Local', 'Decoración', 'Catering', 'Torta', 'Fotografía'],
  graduación: ['Local', 'Decoración', 'Catering', 'DJ', 'Fotografía'],
  corporativo: ['Local', 'Catering', 'Sonido', 'Fotografía'],
};
export const EVENT_ALIASES = { quince: 'quinceañero', cumple: 'cumpleaños', matri: 'matrimonio', santo: 'cumpleaños' };
const normalized = text => text.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¡!¿?.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
function positiveMatch(value, pattern) {
  return [...value.matchAll(new RegExp(pattern.source, 'g'))].some(match => !/\bno(?:\s+(?:quiero|sera|es|un|una|el|hacer|organizar|celebrar))*\s*$/.test(value.slice(0, match.index)));
}
export function detectEventType(text = '') {
  const value = normalized(text);
  if (Object.hasOwn(EVENT_ALIASES, value)) return EVENT_ALIASES[value];
  const matches = [];
  if (positiveMatch(value, /\bquincean\w*|\b15\s*anos\b|\bquince\b(?!\s+(?:personas|invitados|asistentes|soles|mil|dias|meses|anos|por ciento|de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))\b)/)) matches.push('quinceañero');
  if (positiveMatch(value, /\b(?:matrimonio|boda|casamiento|matri)\b/)) matches.push('matrimonio');
  if (positiveMatch(value, /\bbaby\s*shower\b/)) matches.push('babyShower');
  const birthday = /\bcumpleanos\b/.test(value) || value === 'cumple' || /\b(?:un|el|mi|su|tu|organizar|hacer|celebrar) cumple\b/.test(value);
  const saint = !/\bsanto domingo\b|\bsemana santa\b/.test(value) && (value === 'santo' || /\b(?:mi|su|tu|el|un) santo\b/.test(value));
  if ((birthday || saint) && positiveMatch(value, /\b(?:cumpleanos|cumple|santo)\b/)) matches.push('cumpleaños');
  if (positiveMatch(value, /\bgraduacion\b|\bpromocion escolar\b/)) matches.push('graduación');
  if (positiveMatch(value, /\bcorporativ\w*|\bempresarial\b/)) matches.push('corporativo');
  if (matches.length > 1 && /\bo\b|\bu\b/.test(value)) return null;
  return matches[0] || null;
}
export function isStandaloneEventType(message) {
  const value = normalized(message).replace(/^(?:(?:un|una|el|mi|su|tu) |(?:es|sera|seria|quiero) (?:un |una )?)/, '');
  if (Object.hasOwn(EVENT_ALIASES, value)) return true;
  return /^(?:quince|quinceanero|quinceanera|15 anos|cumple|cumpleanos|santo|matri|matrimonio|boda|casamiento|baby shower|graduacion|corporativo)$/.test(value);
}
export function getSuggestedServices(eventType) {
  return [...(EVENT_PRESETS[eventType] || EVENT_PRESETS[detectEventType(eventType || '')] || [])];
}
