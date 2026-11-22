import { dateFromParts, validDateParts } from '../shared/conversation-state.mjs';
import { getReferenceDate } from '../shared/event-dates.mjs';

export const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const normalize = text => text.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export function hasExplicitCorrection(message) {
  return /\b(?:en realidad|mejor|ahora|corrijo|corregir|corrige|correccion|cambia|cambio|cambiemos|actualiza|actualizar|en vez|ya no|sino|quita|elimina|agrega|anade|reemplaza)\b/.test(normalize(message));
}
export function correctsField(message, field, expectedField) {
  if (field === 'selectedServices' && /\b(?:quiero|quisiera|prefiero|elijo|selecciono|selecciona|quita|elimina|agrega|anade|incluye|confirmo|acepto)\b/.test(normalize(message))) return true;
  if (!hasExplicitCorrection(message)) return false;
  if (field === expectedField) return true;
  const text = normalize(message);
  const cues = {
    guestCount: /\b(?:personas?|invitad[oa]s?|asistentes?|pax|somos|seremos|seran)\b/,
    budget: /\b(?:presupuesto|monto|soles?|pen|dinero)\b|s\s*\//,
    date: new RegExp(`\\b(?:fecha|dia|mes|ano|el\\s+\\d{1,2}|proximo|este\\s+(?:sabado|domingo)|${MONTHS.join('|')})\\b|\\d{1,2}[/-]\\d{1,2}`),
    eventType: /\b(?:evento|fiesta|quince|quinceanero|cumple|cumpleanos|matri|matrimonio|boda|santo|graduacion|baby|corporativo)\b/,
    city: /\b(?:ciudad|ubicacion|lugar)\b/,
    style: /\b(?:estilo|tematica|elegante|informal|formal|sencillo|moderno|clasico)\b/,
    selectedServices: /\b(?:servicios|agrega|anade|quita|elimina|incluye|quiero|prefiero)\b/,
    extraRequirements: /\b(?:requisitos|necesito|requiero|agrega|anade|quita|elimina)\b/,
  };
  return cues[field]?.test(text) ?? false;
}

// Only a response to the date field may supply unlabelled date components.
export function extractPartialDate(message, parts = {}, { expectedField = null, calendar, relative, referenceDate = getReferenceDate(), allowRelativePeriods = true } = {}) {
  const text = normalize(message).split('¿')[0].trim();
  const spans = []; let next = { ...parts }; let changed = false; let invalid = false;
  if (!text || /[?]|\b(?:entre|ejemplo)\b|\bo\s+(?:el\s+)?\d|\bno\s+(?:el|dia)\b|^(?:que|como|por que|cual|cuando)\b/.test(text)) return { parts: next, iso: null, spans, changed, invalid };
  const thisMonth = allowRelativePeriods ? text.match(/\b(?:este mes|el mes actual)\b/) : null;
  const thisYear = allowRelativePeriods ? text.match(/\b(?:este ano|el ano actual)\b/) : null;
  if ((thisMonth || thisYear) && (/\b(?:o|entre)\b/.test(text) || /\bno\s+(?:de\s+)?(?:este (?:mes|ano)|el (?:mes|ano) actual)\b/.test(text))) return { parts: next, iso: null, spans, changed, invalid };
  if (calendar) {
    next = { day: calendar.day, month: calendar.month, ...(calendar.year ? { year: calendar.year } : {}) };
    spans.push(calendar); changed = true;
  } else if (relative) {
    const [year, month, day] = relative.split('-').map(Number);
    next = { year, month, day }; changed = true;
  } else if (expectedField === 'date' || (expectedField === null && Object.keys(parts).length) || thisMonth || thisYear) {
    const day = text.match(new RegExp(`\\b(?:el|dia)\\s+(\\d{1,2})\\b|\\b(\\d{1,2})\\s+(?:de\\s+)?(?:${MONTHS.join('|')}|este mes)\\b`));
    const month = text.match(new RegExp(`\\b(${MONTHS.join('|')})\\b`));
    const year = [...text.matchAll(/\b(\d{4})\b/g)].find(match => {
      const before = text.slice(0, match.index); const after = text.slice(match.index + match[0].length);
      return !/^\s*(?:soles?|pen|(?:de\s+)?presupuesto|personas?|invitados?|asistentes?)\b/.test(after)
        && !/(?:s\s*\/|\b(?:presupuesto|somos|seremos|seran|invitados|personas)(?:\s+de)?)\s*$/.test(before);
    });
    if (day) { next.day = Number(day[1] || day[2]); spans.push({ start: day.index, end: day.index + day[0].length }); changed = true; }
    if (month) { next.month = MONTHS.indexOf(month[1]) + 1; spans.push({ start: month.index, end: month.index + month[0].length }); changed = true; }
    if (year) { next.year = Number(year[1]); spans.push({ start: year.index, end: year.index + year[0].length }); changed = true; }
    const bare = text.match(/^(?:(?:si|seria|sera|en|el|de|mes|ano)\s+)*(\d{1,4})[.!]?$/);
    if (bare && !changed) {
      const field = !next.day ? 'day' : !next.month ? 'month' : 'year';
      next[field] = Number(bare[1]); spans.push({ start: 0, end: text.length }); changed = true;
    }
  }
  const [currentYear, currentMonth] = referenceDate.split('-').map(Number);
  if (thisMonth) {
    next.month = currentMonth; next.year = currentYear;
    spans.push({ start: thisMonth.index, end: thisMonth.index + thisMonth[0].length }); changed = true;
  }
  if (thisYear) {
    next.year = currentYear;
    spans.push({ start: thisYear.index, end: thisYear.index + thisYear[0].length }); changed = true;
  }
  if (changed && !validDateParts(next)) {
    invalid = true;
    // Preserve valid components and reject the component that makes the date impossible.
    const candidate = next; next = { ...parts };
    for (const field of ['day', 'month', 'year']) {
      if (candidate[field] !== undefined && validDateParts({ ...next, [field]: candidate[field] })) next[field] = candidate[field];
    }
  }
  const iso = changed && !invalid ? dateFromParts(next) : null;
  return { parts: iso ? {} : next, iso, spans, changed, invalid };
}
