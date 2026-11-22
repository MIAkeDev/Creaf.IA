import { applyEventUpdates, getMissingFields, getEventStatus } from '../shared/event-state.mjs';
import { formatEventDate, getReferenceDate, resolveRelativeEventDate } from '../shared/event-dates.mjs';
import { resolveExplicitEventType } from './event-type-intent.mjs';
import { questionFor } from '../shared/event-questions.mjs';
import { ambiguityQuestions } from '../shared/event-ambiguities.mjs';
import { extractPartialDate, hasExplicitCorrection } from './partial-date.mjs';
import { conversationQuestion } from '../shared/conversation-state.mjs';
import { detectDatePreference } from './date-preference.mjs';

const normalize = text => text.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\u00a0\u202f]/g, ' ');
const months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const words = { uno: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7, ocho: 8, nueve: 9, diez: 10, quince: 15, veinte: 20, cien: 100, doscientos: 200, trescientos: 300, cuatrocientos: 400, quinientos: 500 };
const numberPattern = new RegExp(`\\b(?:\\d+(?:[.,]\\d+)*|${Object.keys(words).join('|')})(?:\\s*mil\\b|\\s*k\\b|\\b)`, 'g');
function numberValue(raw) {
  let text = raw.trim(); const multiplier = /(?:mil|k)$/.test(text) ? 1000 : 1;
  text = text.replace(/\s*(?:mil|k)$/, '');
  if (Object.hasOwn(words, text)) return words[text] * multiplier;
  const pieces = text.split(/[.,]/); const decimal = pieces.length > 1 && pieces.at(-1).length !== 3;
  const value = decimal ? Number(pieces.slice(0, -1).join('') + '.' + pieces.at(-1)) : Number(pieces.join(''));
  return value * multiplier;
}
export function askedFields(text = '') {
  const questions = [...text.matchAll(/¿([^?]+)\?/g)].map(match => match[1]).join(' ') || text;
  const value = normalize(questions); const fields = [];
  if (/(?:cuant[oa]s?|cantidad|numero).{0,45}(?:personas|invitados|asistentes)|^(?:invitados|personas)[?\s]*$/.test(value)) fields.push('guestCount');
  if (/presupuesto|(?:que|cuanto).{0,25}(?:monto|dinero|soles)/.test(value)) fields.push('budget');
  if (/que fecha|en que fecha|para que fecha|que dia|dia, mes|cuando/.test(value)) fields.push('date');
  if (/(?:tipo|clase) de evento|que evento/.test(value)) fields.push('eventType');
  return fields;
}

function explicitDate(text) {
  const patterns = [
    /\b(\d{4})-(\d{2})-(\d{2})\b/g,
    /\b(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?\b/g,
    new RegExp(`\\b(\\d{1,2})\\s+(?:de\\s+)?(${months.join('|')})(?:\\s+(?:de\\s+)?(\\d{4}))?\\b`, 'g'),
  ];
  const candidates = [];
  patterns.forEach((pattern, kind) => {
    for (const match of text.matchAll(pattern)) {
      const before = text.slice(0, match.index);
      if (/\b(?:no|ejemplo|por ejemplo)\s*(?:el\s*)?$/.test(before)) continue;
      const year = kind === 0 ? Number(match[1]) : match[3] ? Number(match[3]) : null;
      const month = kind === 2 ? months.indexOf(match[2]) + 1 : Number(match[2]);
      const day = Number(kind === 0 ? match[3] : match[1]);
      const isoFor = selectedYear => `${selectedYear}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      // Leap-year placeholder checks day/month without assigning an event year.
      const checkIso = isoFor(year ?? 2000); const date = new Date(`${checkIso}T12:00:00Z`);
      if ((year !== null && (year < 2000 || year > 2100)) || !Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== checkIso) continue;
      candidates.push({ iso: year === null ? null : checkIso, day, month, year, value: `${day} de ${months[month - 1]}`, start: match.index, end: match.index + match[0].length });
    }
  });
  return candidates.length === 1 ? candidates[0] : null;
}

export function extractMessageFacts(state, message, { referenceDate = getReferenceDate(), lastAssistantMessage = '', expectedField, eventDateParts = {}, pendingAmbiguities = [] } = {}) {
  const explicitContext = expectedField !== undefined;
  const text = normalize(message); const fields = explicitContext ? expectedField ? [expectedField] : [] : askedFields(lastAssistantMessage);
  const updates = {}; const spans = []; const ambiguities = [];
  const datePreference = detectDatePreference(message, expectedField);
  const pendingNumber = pendingAmbiguities.find(item => item.possibleFields.includes('guestCount') && item.possibleFields.includes('budget'));
  const pending = pendingNumber ? [null, pendingNumber.value] : !explicitContext ? normalize(lastAssistantMessage).match(/te refieres a (\d+) invitados o a s\/\s*\1 de presupuesto/) : null;
  const personAnswer = /\b(?:personas|invitados|asistentes)\b/.test(text);
  const budgetAnswer = /\b(?:soles|presupuesto)\b/.test(text);
  if (pending && personAnswer !== budgetAnswer) {
    updates[personAnswer ? 'guestCount' : 'budget'] = Number(pending[1]);
  }
  const dateMessage = explicitContext ? message.split('¿')[0] : message;
  const rawCalendar = explicitDate(normalize(dateMessage));
  const mayChangeDate = !explicitContext || !state.date || hasExplicitCorrection(message);
  const calendar = mayChangeDate && !datePreference ? rawCalendar : null;
  const pendingDate = !explicitContext && /(?:que ano|de que ano)/.test(normalize(lastAssistantMessage)) ? explicitDate(normalize(lastAssistantMessage)) : null;
  const relative = mayChangeDate && !datePreference ? resolveRelativeEventDate(dateMessage, referenceDate, { expectedField }) : null;
  const dateCorrection = hasExplicitCorrection(message) && /\b(?:el|dia|mes|ano)\b/.test(text);
  const relativePeriod = /\b(?:este (?:mes|ano)|el (?:mes|ano) actual)\b/.test(normalize(dateMessage));
  const partialDate = !datePreference && (explicitContext || relativePeriod) ? extractPartialDate(message, !explicitContext && pendingDate ? { day: pendingDate.day, month: pendingDate.month } : eventDateParts, { expectedField: mayChangeDate ? dateCorrection ? 'date' : expectedField : null, calendar, relative, referenceDate, allowRelativePeriods: mayChangeDate }) : null;
  if (partialDate) {
    spans.push(...partialDate.spans);
    if (rawCalendar && !mayChangeDate) spans.push(rawCalendar);
    if (partialDate.iso) updates.date = partialDate.iso;
    else if (partialDate.changed && !partialDate.invalid && Object.keys(partialDate.parts).length) {
      if (state.date) updates.date = null;
      if (partialDate.parts.day && partialDate.parts.month && !partialDate.parts.year) ambiguities.push({ value: `${partialDate.parts.day} de ${months[partialDate.parts.month - 1]}`, possibleFields: ['date'], reason: 'missing_year' });
    }
  }
  else if (calendar) {
    spans.push(calendar);
    if (calendar.iso) updates.date = calendar.iso;
    else ambiguities.push({ value: calendar.value, possibleFields: ['date'], reason: 'missing_year' });
  }
  else if (relative) updates.date = relative;
  else if (pendingDate && !pendingDate.year) {
    const yearMatch = text.match(/\b(20\d{2}|2100)\b/);
    if (yearMatch) {
      const date = explicitDate(`${pendingDate.value} de ${yearMatch[1]}`);
      if (date?.iso) {
        updates.date = date.iso; spans.push({ start: yearMatch.index, end: yearMatch.index + 4 });
      }
    }
    if (!updates.date) ambiguities.push({ value: pendingDate.value, possibleFields: ['date'], reason: 'missing_year' });
  }
  if (datePreference) updates.datePreference = datePreference;
  else if (partialDate?.changed && !partialDate.iso && state.datePreference) updates.datePreference = null;
  const tokens = [...text.matchAll(numberPattern)].map(match => ({ raw: match[0], value: numberValue(match[0]), start: match.index, end: match.index + match[0].length }));
  const bareNumber = tokens.length === 1 && text.replace(/[.!?¿¡]/g, '').trim() === tokens[0].raw;
  const contextualNumber = bareNumber && state.eventType && fields.some(field => ['guestCount', 'budget'].includes(field));
  const type = contextualNumber ? null : resolveExplicitEventType(state, message);
  if (type) updates.eventType = type;
  const used = new Set(); const guests = []; const budgets = [];
  tokens.forEach((token, index) => {
    const before = text.slice(0, token.start); const after = text.slice(token.end);
    if (spans.some(span => token.start >= span.start && token.end <= span.end) || /^\s*(?:dias?|meses|anos|de\s+(?:enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre))\b/.test(after) || /-\s*$/.test(before)) { used.add(index); return; }
    const people = /^\s*(?:personas?|invitad[oa]s?|asistentes?|pax)\b/.test(after) || /\b(?:somos|seremos|seran|asistiran)\s*(?:(?:unas?|aproximadamente)\s*)?$/.test(before);
    const money = /^\s*(?:sol(?:es)?|pen|(?:de\s+)?presupuesto)\b/.test(after) || /(?:s\s*\/\.?|\bpen)\s*$/.test(before) || /\b(?:presupuesto|monto)(?:\s+(?:de|es|seria|sera|aproximado|aproximadamente|maximo|hasta|podria|llegar|a|disponible|unos|unas|tengo|ahora)){0,7}\s*$/.test(before) || (!people && /(?:mil|k)$/.test(token.raw) && (/\btengo\b/.test(before) || fields.includes('budget')));
    if (people && Number.isInteger(token.value) && token.value > 0 && token.value <= 100000) { guests.push(token); used.add(index); }
    else if (money && token.value > 0 && token.value <= 100000000) { budgets.push(token); used.add(index); }
  });
  const chosen = candidates => new Set(candidates.map(item => item.value)).size === 1 ? candidates[0] : /\b(?:en realidad|mejor|ahora)\b/.test(text) ? candidates.at(-1) : undefined;
  const guest = chosen(guests); const budget = chosen(budgets);
  if (guest) updates.guestCount = guest.value;
  if (budget) updates.budget = budget.value;
  used.forEach(index => spans.push(tokens[index]));
  const remaining = tokens.map((token, index) => ({ ...token, index })).filter(token => !used.has(token.index));
  let ambiguousNumber;
  if (remaining.length === 1 && !/\bo\b|\bentre\b/.test(text)) {
    const token = remaining[0];
    const requestedNumeric = fields.filter(field => ['guestCount', 'budget'].includes(field));
    const shortAnswer = bareNumber || /^(?:si|son|tengo|unas?|unos?|aproximadamente|seremos|somos|seran)\s+/.test(text);
    let target = !calendar && shortAnswer && requestedNumeric.length === 1 ? requestedNumeric[0] : null;
    if (!target && updates.budget && !updates.guestCount && (!explicitContext || fields.includes('guestCount'))) target = 'guestCount';
    let scrub = text.slice(0, token.start) + ' '.repeat(token.end - token.start) + text.slice(token.end);
    [...spans].sort((a, b) => b.start - a.start).forEach(span => { scrub = scrub.slice(0, span.start) + ' '.repeat(span.end - span.start) + scrub.slice(span.end); });
    const simple = scrub.replace(/\b(?:si|el|la|dia|para|de|son|tengo|unas?|unos?|aproximadamente|en realidad|seremos|somos|seran)\b/g, '').replace(/[.!?¿¡\s]/g, '') === '';
    const dateShorthand = !!calendar && /\bpara\s*$/.test(text.slice(0, token.start));
    if ((simple || dateShorthand || updates.budget) && !updates[target] && !(type && bareNumber)) {
      if (target && token.value > 0 && token.value <= (target === 'guestCount' ? 100000 : 100000000) && (target !== 'guestCount' || Number.isInteger(token.value))) { updates[target] = token.value; spans.push(token); }
      else if (simple || dateShorthand) { ambiguousNumber = token.value; spans.push(token); }
    }
  }
  if (ambiguousNumber !== undefined) ambiguities.unshift({ value: String(ambiguousNumber), possibleFields: ['guestCount', 'budget'] });
  else if (pending && !updates.guestCount && !updates.budget && !personAnswer && !budgetAnswer) {
    ambiguities.unshift({ value: pending[1], possibleFields: ['guestCount', 'budget'] });
  }
  if (explicitContext && !hasExplicitCorrection(message)) {
    for (const field of Object.keys(updates)) {
      const known = state[field];
      const clarifiedNumber = pending && ((field === 'guestCount' && personAnswer && !budgetAnswer) || (field === 'budget' && budgetAnswer && !personAnswer));
      if (field !== 'datePreference' && !clarifiedNumber && known !== null && (!Array.isArray(known) || known.length) && JSON.stringify(known) !== JSON.stringify(updates[field])) delete updates[field];
    }
  }
  let residual = text;
  [...spans].sort((a, b) => b.start - a.start).forEach(span => { residual = residual.slice(0, span.start) + ' '.repeat(span.end - span.start) + residual.slice(span.end); });
  residual = residual.replace(/\b(?:si|el|la|dia|sera|seria|para|en|de|y|son|tengo|tenemos|somos|seremos|seran|unas?|unos?|aproximadamente|alrededor|presupuesto|monto|soles?|pen|personas?|invitad[oa]s?|asistentes?|pax|maximo|hasta|es|mi|ahora|realidad|mejor|a|disponible)\b/g, '').replace(/s\s*\/\.?/g, '').replace(/[.!?,;:¿¡\s]/g, '');
  if (explicitContext && type) residual = residual.replace(/(?:quiero|hacer|organizar|un|una|quinceanero|quinceanera|quince|cumpleanos|cumple|santo|matrimonio|matri|boda)/g, '');
  const onlyFacts = !!(Object.keys(updates).length > 0 || partialDate?.changed) && residual === '';
  return { updates, onlyFacts, ambiguousNumber, ambiguities, clarificationOnly: ambiguities.length > 0 && residual === '', datePreference,
    ...(datePreference ? { eventDateParts: {} } : partialDate ? { eventDateParts: partialDate.parts, partialDateChanged: partialDate.changed, invalidDatePart: partialDate.invalid } : {}) };
}

export function ambiguityResult(state, ambiguities) {
  return { reply: ambiguityQuestions(ambiguities), eventState: state, missingFields: getMissingFields(state), status: 'collecting', ambiguities };
}

export function factsResult(eventState, updates) {
  const pieces = [];
  if (updates.eventType) pieces.push(eventState.eventType === 'otro' ? 'una fiesta general' : `un ${eventState.eventType}`);
  if (updates.guestCount) pieces.push(`${eventState.guestCount} invitados`);
  if (updates.budget) pieces.push(`S/ ${eventState.budget.toLocaleString('es-PE')} de presupuesto`);
  if (updates.date) pieces.push(`fecha ${formatEventDate(eventState.date)}`);
  const rawNext = questionFor(eventState).replace(/^(?:Excelente|Perfecto|Claro)[,.]\s*/, '');
  const next = rawNext.charAt(0).toLocaleUpperCase('es') + rawNext.slice(1);
  return { reply: `${pieces.length ? `Perfecto, anoté ${pieces.join(' y ')}.` : 'Perfecto.'} ${next}`, eventState, missingFields: getMissingFields(eventState), status: getEventStatus(eventState) };
}
export function localFactsResponse(state, facts) {
  if (facts.ambiguities?.length && facts.clarificationOnly) return ambiguityResult(applyEventUpdates(state, facts.updates), facts.ambiguities);
  if (!facts.onlyFacts) return null;
  const eventState = applyEventUpdates(state, facts.updates);
  if (facts.partialDateChanged && !facts.updates.date) return { reply: `${facts.invalidDatePart ? 'Esa fecha no es válida.' : 'Perfecto.'} ${conversationQuestion({ event: eventState, expectedField: 'date', eventDateParts: facts.eventDateParts })}`, eventState, missingFields: getMissingFields(eventState), status: 'collecting' };
  return factsResult(eventState, facts.updates);
}
