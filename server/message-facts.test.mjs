import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventState } from '../shared/event-state.mjs';
import { askedFields, extractMessageFacts, localFactsResponse } from './message-facts.mjs';
import { buildPlannerContext, finishPlannerResult } from './event-planner.mjs';

const state = { ...createEventState(), eventType: 'cumpleaños', date: '2026-11-15' };
const options = { referenceDate: '2026-11-05', lastAssistantMessage: '¿Cuántos invitados planeas?' };

test('caso real: 500 tengo 5 mil soles captura invitados y presupuesto juntos', () => {
  const facts = extractMessageFacts(state, '500 tengo 5 mil soles', options);
  assert.equal(facts.updates.guestCount, 500); assert.equal(facts.updates.budget, 5000); assert.equal(facts.onlyFacts, true);
  const result = localFactsResponse(state, facts);
  assert.equal(result.eventState.date, '2026-11-15'); assert.match(result.reply, /500 invitados/);
  assert(!result.missingFields.includes('guestCount')); assert(!result.missingFields.includes('budget'));
});

test('los mismos datos llegan en cualquier orden y con formatos comunes', () => {
  for (const message of ['Tengo 5 mil soles y 500 personas', '500 personas y S/5000', 'S/ 5,000 para 500 invitados', 'quinientos invitados y cinco mil soles', 'tengo 5mil soles para 500']) {
    const facts = extractMessageFacts(state, message, options);
    assert.equal(facts.updates.guestCount, 500, message); assert.equal(facts.updates.budget, 5000, message);
  }
});

test('cifra sola según la última pregunta: invitados o presupuesto', () => {
  assert.deepEqual(extractMessageFacts(state, '500', options).updates, { guestCount: 500 });
  assert.deepEqual(extractMessageFacts(state, '500', { ...options, lastAssistantMessage: '¿Con qué presupuesto cuentas?' }).updates, { budget: 500 });
  assert.deepEqual(extractMessageFacts(state, 'quince', options).updates, { guestCount: 15 });
});

test('una cifra ambigua pide una sola aclaración concreta y entiende personas como continuación', () => {
  const facts = extractMessageFacts(state, '500', { ...options, lastAssistantMessage: '¿Cuántos invitados y qué presupuesto tienes?' });
  assert.equal(facts.ambiguousNumber, 500); assert.deepEqual(facts.updates, {});
  const result = localFactsResponse(state, facts); assert.match(result.reply, /500 invitados o a S\/ 500/);
  const clarified = extractMessageFacts(state, 'personas', { ...options, lastAssistantMessage: result.reply });
  assert.equal(clarified.updates.guestCount, 500); assert.equal(clarified.onlyFacts, true);
});

test('tener un único campo numérico pendiente no basta para asignar una cifra', () => {
  const facts = extractMessageFacts({ ...state, budget: 5000 }, '500');
  assert.equal(facts.updates.guestCount, undefined); assert.equal(facts.updates.budget, undefined);
  assert.equal(facts.ambiguousNumber, 500);
  const result = localFactsResponse({ ...state, budget: 5000 }, facts);
  assert.equal(result.eventState.budget, 5000);
});

test('la fecha sin año requiere aclaración y sus cifras no se vuelven invitados', () => {
  const facts = extractMessageFacts({ ...state, date: null }, 'si el dia 15 de noviembre', options);
  assert.equal(facts.updates.date, undefined); assert.equal(facts.updates.guestCount, undefined);
  assert.deepEqual(facts.ambiguities, [{ value: '15 de noviembre', possibleFields: ['date'], reason: 'missing_year' }]);
  assert.match(localFactsResponse({ ...state, date: null }, facts).reply, /qué año/);
  const numeric = extractMessageFacts(state, '15/11/2026', options);
  assert.equal(numeric.updates.date, '2026-11-15'); assert.equal(numeric.updates.guestCount, undefined);
});

test('varios datos con servicios o preferencias no omiten la extracción del resto', () => {
  const message = 'Quiero un matri elegante el 15 de noviembre de 2026, 500 invitados y 5 mil soles, con catering y fotografía.';
  const facts = extractMessageFacts(createEventState(), message, options);
  assert.equal(facts.updates.eventType, 'matrimonio'); assert.equal(facts.updates.guestCount, 500);
  assert.equal(facts.updates.budget, 5000); assert.equal(facts.updates.date, '2026-11-15'); assert.equal(facts.onlyFacts, false);
  const context = JSON.parse(buildPlannerContext(createEventState(), message, options));
  assert.equal(context.last_question, options.lastAssistantMessage); assert.equal(context.event_state.budget, 5000);
});

test('una corrección reemplaza invitados sin modificar el presupuesto guardado', () => {
  const facts = extractMessageFacts({ ...state, budget: 5000, guestCount: 70 }, 'En realidad serán 500', options);
  assert.equal(facts.updates.guestCount, 500); assert.equal(facts.updates.budget, undefined);
});

test('evita repreguntar invitados que el modelo omitió y respeta las cifras claras', () => {
  const result = finishPlannerResult(state, { updates: { budget: 5 }, reply: '¿Cuántos invitados esperas?', claimedStatus: 'collecting' }, '500 tengo 5 mil soles', options);
  assert.equal(result.eventState.guestCount, 500); assert.equal(result.eventState.budget, 5000);
  assert.doesNotMatch(result.reply, /cuántos invitados/i); assert.match(result.reply, /500 invitados/);
});

test('no confunde cantidades monetarias, fechas ni preguntas generales con invitados', () => {
  assert.equal(extractMessageFacts(state, 'Tengo 500 soles', options).updates.guestCount, undefined);
  assert.equal(extractMessageFacts(state, 'Será el 15 de noviembre de 2026', options).updates.guestCount, undefined);
  assert.equal(extractMessageFacts(state, '¿Cuánto es 500 + 5000?', { referenceDate: '2026-11-05' }).onlyFacts, false);
  assert.equal(extractMessageFacts(state, '5 mil personas', options).updates.budget, undefined);
  assert.deepEqual(askedFields('¿Cuántos invitados planeas?'), ['guestCount']);
});
