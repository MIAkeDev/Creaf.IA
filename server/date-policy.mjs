import { getReferenceDate } from '../shared/event-dates.mjs';

export function allowedEventDate(iso, referenceDate = getReferenceDate()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const date = new Date(`${iso}T12:00:00Z`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== iso) return false;
  const currentYear = Number(referenceDate.slice(0, 4));
  const allowedYear = currentYear + (referenceDate.slice(5, 7) === '12' ? 1 : 0);
  return iso >= referenceDate && Number(iso.slice(0, 4)) <= allowedYear;
}

export function datePolicyIssue(message, referenceDate = getReferenceDate(), expectedField = null) {
  const text = message.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const dateContext = expectedField === 'date' || /\b(?:fecha|evento|celebrar|sera|seria|para el|el dia|cumpleanos|boda|fiesta)\b/.test(text);
  if (!dateContext || /[¿?]/.test(message)) return null;
  if (/\b(?:ayer|anteayer|antier|ano pasado|mes pasado)\b/.test(text)) return 'La fecha del evento debe ser desde hoy en adelante.';
  const impossibleDay = text.match(/\b(?:el|dia)?\s*(\d{3,})\s+de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)\b/);
  if (impossibleDay && Number(impossibleDay[1]) > 31) return 'Ese día no existe en el calendario. Indícame una fecha real, por ejemplo día, mes y año.';
  const years = [...text.matchAll(/\b(20\d{2}|2100)\b/g)].filter(match =>
    !/\b(?:soles|presupuesto|personas|invitados)\s*$/.test(text.slice(0, match.index))
    && !/^\s*(?:soles|de presupuesto|personas|invitados)\b/.test(text.slice(match.index + match[0].length)));
  const maxYear = Number(referenceDate.slice(0, 4)) + (referenceDate.slice(5, 7) === '12' ? 1 : 0);
  if (years.some(match => Number(match[1]) < Number(referenceDate.slice(0, 4)) || Number(match[1]) > maxYear))
    return referenceDate.slice(5, 7) === '12' ? `Por ahora puedo cotizar fechas de ${referenceDate.slice(0, 4)} o ${maxYear}.` : `Por ahora puedo cotizar fechas de ${referenceDate.slice(0, 4)}.`;
  return null;
}
