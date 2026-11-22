const weekdays = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const normalize = text => text.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[¡!¿?.,;:]/g, ' ').replace(/\s+/g, ' ').trim();
export const EVENT_TIME_ZONE = 'America/Lima';
export function getTemporalReference(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: EVENT_TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  const part = name => parts.find(item => item.type === name).value;
  return { reference_date: `${part('year')}-${part('month')}-${part('day')}`, reference_time: `${part('hour')}:${part('minute')}:${part('second')}`, time_zone: EVENT_TIME_ZONE };
}
export function getReferenceDate(now = new Date()) { return getTemporalReference(now).reference_date; }
function referenceDay(reference) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(reference)) throw new Error('Invalid reference date');
  const date = new Date(`${reference}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== reference) throw new Error('Invalid reference date');
  return date;
}
export function dateExample(reference = getReferenceDate()) {
  const date = referenceDay(reference); date.setUTCDate(date.getUTCDate() + 14);
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', day: 'numeric', month: 'long', year: 'numeric' }).format(date);
}
export function formatEventDate(iso) {
  return new Intl.DateTimeFormat('es-PE', { timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(referenceDay(iso));
}
export function isStandaloneRelativeDate(message) {
  return /^(?:(?:sera|seria|mejor|para|lo quiero para) )?(?:(?:el )?(?:proximo|este) (?:lunes|martes|miercoles|jueves|viernes|sabado|domingo)|hoy(?: mismo)?|el dia de hoy|ahora(?: mismo)?|en este momento|manana|pasado manana|pasadomanana|dentro de \d{1,3} dias?)$/.test(normalize(message));
}
export function resolveRelativeEventDate(message, reference = getReferenceDate(), { expectedField } = {}) {
  const text = normalize(message);
  // Questions, negated choices and alternatives are not a committed event date.
  if (/^(?:que (?:dia|fecha)|cuando|cual es|por ejemplo|ejemplo)/.test(text)) return null;
  const mentions = text.match(/\b(?:domingo|lunes|martes|miercoles|jueves|viernes|sabado|hoy|ahora|en este momento|manana|pasadomanana)\b/g) || [];
  if (mentions.length > 1 && !/\bpasado manana\b/.test(text)) return null;
  const weekday = text.match(/\b(?:el )?(proximo|este) (domingo|lunes|martes|miercoles|jueves|viernes|sabado)\b/);
  const relative = text.match(/\b(pasado manana|pasadomanana|manana|hoy(?: mismo)?|ahora(?: mismo)?|en este momento|dentro de (\d{1,3}) dias?)\b/);
  const match = weekday || relative;
  if (!match) return null;
  const before = text.slice(0, match.index);
  if (/\bno(?: sera| quiero| prefiero)?\s*(?:el\s*)?$/.test(before)) return null;
  if (!weekday && /\b(?:la|de la|por la|esta)\s*$/.test(before)) return null;
  const instant = relative && /^(?:hoy|ahora|en este momento)/.test(relative[1]);
  if (instant) {
    if (/[¿?]/.test(message) || /\bo\b/.test(text) || /\bno(?:\s+\w+){0,5}\s*$/.test(before)) return null;
    const after = text.slice(match.index + match[0].length).trim();
    const direct = isStandaloneRelativeDate(message);
    const dateCue = /\b(?:para|sera|seria|fecha|evento|cumpleanos|fiesta|celebracion|reunion|boda)\s*(?:es|sera|seria)?\s*$/.test(before);
    const dateAnswer = expectedField === 'date' && !before.trim() && /^(?:con\b|$)/.test(after);
    // "Ahora tengo S/5000" updates a budget; it does not schedule today's event.
    if (!direct && !dateCue && !dateAnswer) return null;
  }
  if (/\b(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b|\b\d{1,2}[/-]\d{1,2}/.test(text)) return null;
  const date = referenceDay(reference);
  let days;
  if (weekday) {
    days = (weekdays.indexOf(weekday[2]) - date.getUTCDay() + 7) % 7;
    if (weekday[1] === 'proximo' && days === 0) days = 7;
  } else {
    days = relative[2] ? Number(relative[2]) : instant ? 0 : relative[1] === 'manana' ? 1 : 2;
  }
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}
