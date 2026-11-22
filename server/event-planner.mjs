import { applyEventUpdates, compactEventState, getEventStatus, getMissingFields } from '../shared/event-state.mjs';
import { detectEventType, getSuggestedServices } from '../shared/event-presets.mjs';
import { questionFor } from '../shared/event-questions.mjs';
import { asksForServiceAdvice, guardServiceUpdates, isBareAcknowledgment, serviceAdviceResult } from './service-intent.mjs';
import { dateExample, formatEventDate, getReferenceDate, getTemporalReference, EVENT_TIME_ZONE } from '../shared/event-dates.mjs';
import { dateConfirmationResult } from './date-intent.mjs';
import { removeRepeatedGreeting } from './greetings.mjs';
import { eventTypeConfirmation } from './event-type-intent.mjs';
import { ambiguityResult, askedFields, extractMessageFacts, factsResult } from './message-facts.mjs';
import { normalizeModelUpdates } from './model-validation.mjs';
import { normalizeAmbiguities } from '../shared/event-ambiguities.mjs';
import { guardConfirmedUpdates } from './conversation-planner.mjs';
import { conversationQuestion, nextExpectedField } from '../shared/conversation-state.mjs';
import { allowedEventDate } from './date-policy.mjs';

export function recoverJSON(text) {
  if (typeof text !== 'string' || !text.trim()) throw new Error('Empty model output');
  const trimmed = text.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try { return JSON.parse(trimmed); } catch {
    // Balanced object extraction respects braces inside quoted reply text.
    for (let start = trimmed.indexOf('{'); start >= 0; start = trimmed.indexOf('{', start + 1)) {
      let depth = 0; let quoted = false; let escaped = false;
      for (let i = start; i < trimmed.length; i++) {
        const char = trimmed[i];
        if (quoted) { if (escaped) escaped = false; else if (char === '\\') escaped = true; else if (char === '"') quoted = false; }
        else if (char === '"') quoted = true;
        else if (char === '{') depth++;
        else if (char === '}' && --depth === 0) {
          try { return JSON.parse(trimmed.slice(start, i + 1)); } catch { break; }
        }
      }
    }
    throw new Error('Invalid model JSON');
  }
}

export function cleanReply(text) {
  return text.replace(/<br\s*\/?\s*>|\bbr>/gi, '\n').replace(/<[^>]*>/g, '').replace(/^#{1,6}\s+/gm, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\n{3,}/g, '\n\n').trim();
}

export function validateModelResult(text) {
  const value = recoverJSON(text);
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid result');
  const { updates, droppedFields } = normalizeModelUpdates(value.updates);
  const reply = typeof value.reply === 'string' ? cleanReply(value.reply.slice(0, 700)) : '';
  if (!reply && !Object.keys(updates).length) throw new Error('Empty result');
  // Legacy status/missing_fields are ignored, never required or authoritative.
  return { reply, updates, ambiguities: normalizeAmbiguities(value.ambiguities), needsNaturalReply: !reply || droppedFields.length > 0 };
}

export function buildPlannerContext(state, message, options = {}) {
  const temporal = getTemporalReference();
  const { retry = false, referenceDate = temporal.reference_date, referenceTime = temporal.reference_time, conversationStarted = false, lastAssistantMessage = '', expectedField } = options;
  const facts = extractMessageFacts(state, message, { ...options, referenceDate });
  const knownState = applyEventUpdates(state, facts.updates);
  const type = knownState.eventType;
  const context = expectedField !== undefined ? {
    reference_date: referenceDate, reference_time: referenceTime, time_zone: EVENT_TIME_ZONE,
    event_state: compactEventState(knownState),
    expected_field: expectedField,
    last_message: message,
    ...(message.length <= 50 && lastAssistantMessage ? { last_assistant_reply: lastAssistantMessage.slice(0, 300) } : {}),
    ...(!conversationStarted ? { conversation_started: false } : {}),
    ...(Object.keys(facts.eventDateParts || {}).length ? { event_date_parts: facts.eventDateParts } : {}),
    ...(expectedField === 'selectedServices' ? { suggested_services: options.suggestedServices ?? getSuggestedServices(type) } : {}),
  } : {
    conversation_started: conversationStarted,
    event_state: compactEventState(knownState),
    missing_fields: getMissingFields(knownState),
    suggested_services: options.suggestedServices ?? getSuggestedServices(type),
    reference_date: referenceDate,
    reference_time: referenceTime, time_zone: EVENT_TIME_ZONE,
    date_example: dateExample(referenceDate),
    last_message: message,
    ...(facts.ambiguities.length ? { ambiguities: facts.ambiguities } : {}),
    ...(lastAssistantMessage ? { last_question: lastAssistantMessage } : {}),
  };
  if (retry) context.format_reminder = 'Devuelve solo JSON con reply y updates; ambiguities es opcional. No asumas datos ambiguos.';
  return JSON.stringify(context);
}

export function finishPlannerResult(state, modelResult, message, options = {}) {
  const { referenceDate = getReferenceDate(), conversationStarted = false } = options;
  const facts = extractMessageFacts(state, message, options);
  const asksForProviders = /proveedor(?:es)?|recomi[eé]ndame.*(?:catering|fot[oó]grafo|dj)|qu[eé].*(?:catering|dj).*recomiendas/i.test(message);
  const asksForContact = /(?:n[uú]mero|tel[eé]fono|whatsapp|contacto|direcci[oó]n|instagram|lista|nombre).{0,60}(?:proveedor|negocio|empresa|catering|bartender|fot[oó]graf|dj)|(?:proveedor|negocio|empresa|catering|bartender|fot[oó]graf|dj).{0,60}(?:n[uú]mero|tel[eé]fono|whatsapp|contacto|direcci[oó]n|instagram|lista|nombre)/i.test(message);
  const offeredUpdates = guardServiceUpdates(modelResult.updates, message);
  if (asksForProviders || asksForContact) delete offeredUpdates.selectedServices;
  const updates = { ...guardConfirmedUpdates(state, offeredUpdates, message, options, facts) };
  if (Object.keys(offeredUpdates).some(field => !Object.hasOwn(updates, field))) modelResult = { ...modelResult, needsNaturalReply: true };
  const ambiguities = normalizeAmbiguities([...facts.ambiguities, ...(modelResult.ambiguities || [])])
    .filter(item => !item.possibleFields.every(field => Object.hasOwn(facts.updates, field)));
  const unique = new Map();
  for (const item of ambiguities) {
    const key = `${item.value}:${[...item.possibleFields].sort().join(',')}`;
    if (!unique.has(key)) unique.set(key, item);
  }
  const uniqueAmbiguities = [...unique.values()];
  for (const ambiguity of uniqueAmbiguities) for (const field of ambiguity.possibleFields) delete updates[field];
  const resolvedDate = facts.updates.date;
  const resolvedEventType = facts.updates.eventType;
  if (updates.eventType) updates.eventType = detectEventType(updates.eventType) || updates.eventType;
  if (updates.eventType && /^(?:f+i+e+s+t+a+|evento|celebraci[oó]n)(?: general)?$/i.test(updates.eventType)) updates.eventType = 'otro';
  if (updates.eventType && !['quinceañero', 'cumpleaños', 'matrimonio', 'babyShower', 'graduación', 'corporativo', 'bautizo', 'otro'].includes(updates.eventType)) {
    const detail = `Tipo de celebración: ${updates.eventType}`;
    updates.extraRequirements = [...new Set([...(updates.extraRequirements || state.extraRequirements), detail])].slice(0, 20);
    updates.eventType = 'otro';
  }
  Object.assign(updates, facts.updates);
  if (updates.date && !facts.updates.date && updates.date !== state.date) {
    const checked = extractMessageFacts(state, updates.date, { referenceDate });
    const year = checked.updates.date?.slice(0, 4);
    if (year && new RegExp(`\\b${year}\\b`).test(message)) updates.date = checked.updates.date;
    else { delete updates.date; modelResult = { ...modelResult, needsNaturalReply: true }; }
  }
  if (updates.date && !allowedEventDate(updates.date, referenceDate)) {
    delete updates.date;
    modelResult = { ...modelResult, needsNaturalReply: true };
  }
  const eventState = applyEventUpdates(state, updates);
  const missingFields = getMissingFields(eventState);
  const status = getEventStatus(eventState);
  if (uniqueAmbiguities.length) return ambiguityResult(eventState, uniqueAmbiguities);
  if (eventState.guestCount == null && /\b(?:pocas personas|pocos invitados|poquitos invitados|grupo pequeñ[oa]|reunión íntima)\b/i.test(message)) {
    const eventLabel = updates.eventType ? eventState.eventType === 'otro' ? 'la fiesta' : `el ${eventState.eventType}` : 'el evento';
    const dateNote = updates.date ? ` para el ${formatEventDate(updates.date)}` : '';
    return { reply: `Listo, anoté ${eventLabel}${dateNote} y que será para pocas personas. ¿Cuántas aproximadamente? Con una cifra estimada podré buscar paquetes adecuados.`, eventState, missingFields, status, preserveReply: true, focusField: 'guestCount' };
  }
  let reply = modelResult.needsNaturalReply ? questionFor(eventState) : modelResult.reply;
  if (isBareAcknowledgment(message) && status === 'collecting' && options.expectedField === 'eventType') {
    reply = '¡Vamos! Cuéntame qué te gustaría celebrar: un cumpleaños, una boda, un quinceañero o una fiesta general.';
  }
  if (asksForProviders || asksForContact) return {
    reply: status === 'ready'
      ? 'Puedes revisar las propuestas en CreafIA y solicitar la opción que prefieras. No comparto listas ni contactos de proveedores.'
      : `Puedo comparar opciones registradas, pero no comparto listas ni contactos de proveedores. ${conversationQuestion({ event: eventState, expectedField: nextExpectedField(eventState), eventDateParts: {} })}`,
    eventState, missingFields, status, preserveReply: true, suppressServiceSelectorReply: true,
  };
  if (/(?:system\s*prompt|prompt\s*(?:interno|del sistema)|clave (?:api|secreta)|api[_ -]?key|instrucciones internas|datos privados)/i.test(message)) {
    return { reply: `Coticemos tu evento; buscaremos una opción adecuada. ${conversationQuestion({ event: eventState, expectedField: nextExpectedField(eventState), eventDateParts: {} })}`, eventState, missingFields, status, preserveReply: true, suppressServiceSelectorReply: true };
  }
  if (/^(?:[¿?\s]*)?(?:de qu[eé] trata|c[oó]mo(?: as[ií])?|no entiendo|expl[ií]came|qu[eé] hago)(?:[¿?!.\s]*)$/i.test(message.trim())) {
    let explanation = /cotiz|presupuesto|evento|opciones|servicios/i.test(reply) && reply.length > 40
      ? reply : `Te ayudo a cotizar un evento según tu presupuesto y lo que necesitas. ${conversationQuestion({ event: eventState, expectedField: nextExpectedField(eventState), eventDateParts: {} })}`;
    if (!/[?¿]/.test(explanation) && status === 'collecting') explanation += ` ${conversationQuestion({ event: eventState, expectedField: nextExpectedField(eventState), eventDateParts: {} })}`;
    return { reply: explanation, eventState, missingFields, status, preserveReply: true, suppressServiceSelectorReply: true };
  }
  if (resolvedDate && (updates.eventType || updates.guestCount || updates.budget)) return { ...factsResult(eventState, updates), preserveReply: true };
  if (asksForServiceAdvice(message)) return serviceAdviceResult(eventState);
  else if (resolvedDate) return dateConfirmationResult(eventState, resolvedDate);
  else if (Object.keys(updates).length && askedFields(reply).some(field => eventState[field] !== null)) {
    if (facts.updates.guestCount || facts.updates.budget) return factsResult(eventState, facts.updates);
    reply = questionFor(eventState);
  }
  else if (resolvedEventType && /(?:tipo|clase) de evento|qu[eé] evento.*(?:planeas|organizar|celebrar)/i.test(reply)) reply = eventTypeConfirmation(eventState);
  else if (isBareAcknowledgment(message) && status === 'collecting' && options.expectedField === undefined) reply = questionFor(eventState);
  else if (status === 'ready' && getEventStatus(state) !== 'ready') reply = 'Perfecto, ya tengo lo necesario para comparar opciones del catálogo para tu evento.';
  else if (status === 'ready' && Object.keys(updates).length) reply = 'Listo, actualicé los datos de tu evento. Compararemos las opciones con los nuevos requisitos.';
  else if (status === 'ready' && /[?¿]/.test(reply)) reply = 'Ya tengo los datos necesarios de tu evento. Podemos comparar las opciones del catálogo.';
  else if (status === 'collecting' && /(?:ya|todo|estamos).{0,20}(?:list[oa]s?|complet[oa])|ya tengo (?:lo necesario|todos los datos)/i.test(reply)) reply = questionFor(eventState);
  else if (missingFields.length === 1 && missingFields[0] === 'selectedServices') reply = questionFor(eventState);
  if (/https?:\/\/|wa\.me|\b\d{9,15}\b|[\w.+-]+@[\w.-]+\.[a-z]{2,}/i.test(reply)) reply = questionFor(eventState);
  if (conversationStarted) reply = removeRepeatedGreeting(reply) || questionFor(eventState);
  if (updates.eventType && state.eventType !== eventState.eventType) {
    const custom = eventState.extraRequirements.find(item => item.startsWith('Tipo de celebración: '))?.slice('Tipo de celebración: '.length);
    const label = eventState.eventType === 'otro' ? custom ? `una celebración de ${custom}` : 'una fiesta general' : `un ${eventState.eventType}`;
    reply = `${state.eventType ? 'Listo, cambié el evento a' : 'Listo, anoté'} ${label}. ${conversationQuestion({ event: eventState, expectedField: nextExpectedField(eventState), eventDateParts: {} })}`;
  }
  return { reply, eventState, missingFields, status, naturalReply: true, preserveReply: !!(updates.eventType && state.eventType !== eventState.eventType) || isBareAcknowledgment(message) && options.expectedField === 'eventType' };
}

export function safePlannerResult(state, options = {}) {
  const facts = extractMessageFacts(state, options.message || '', options);
  if (facts.ambiguities.length) return { ...ambiguityResult(state, facts.ambiguities), degraded: true };
  const genericParty = !state.eventType && /^(?:una?\s+)?f+i+e+s+t+a+[.!?\s]*$/i.test(options.message || '');
  const eventState = genericParty ? applyEventUpdates(state, { eventType: 'otro' }) : state;
  const parts = facts.eventDateParts ?? options.eventDateParts ?? {};
  const question = conversationQuestion({ event: eventState, expectedField: nextExpectedField(eventState, parts), eventDateParts: parts });
  const acknowledgment = isBareAcknowledgment(options.message || '');
  const intro = genericParty ? 'Podemos cotizar una fiesta general.' : acknowledgment ? 'Claro, te sigo.' : 'No capté todo con seguridad; conservé los datos claros que me diste.';
  return { reply: `${intro} ${question}`, eventState, missingFields: getMissingFields(eventState), status: getEventStatus(eventState), degraded: true, preserveReply: true };
}
