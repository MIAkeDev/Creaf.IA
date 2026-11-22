import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventState, getMissingFields, getEventStatus } from '../shared/event-state.mjs';
import { extractMessageFacts, localFactsResponse } from './message-facts.mjs';
import { finishPlannerResult, recoverJSON, validateModelResult, safePlannerResult } from './event-planner.mjs';
import { EVENT_RESPONSE_SCHEMA } from './event-response-schema.mjs';

const state = { ...createEventState(), eventType: 'cumpleaños' };
const options = { referenceDate: '2026-11-05', conversationStarted: true };
const factsFor = (message, current = state, lastAssistantMessage = '') => extractMessageFacts(current, message, { ...options, lastAssistantMessage });

test('caso exacto: para 350 el 18 noviembre aclara cifra y año sin asumir datos', () => {
  const facts = factsFor('para 350 el 18 noviembre');
  assert.deepEqual(facts.updates, {});
  assert.deepEqual(facts.ambiguities, [
    { value: '350', possibleFields: ['guestCount', 'budget'] },
    { value: '18 de noviembre', possibleFields: ['date'], reason: 'missing_year' },
  ]);
  const result = localFactsResponse(state, facts);
  assert.deepEqual(result.eventState, state);
  assert.equal(result.status, 'collecting');
  assert.match(result.reply, /350 invitados o a S\/ 350 de presupuesto/);
  assert.match(result.reply, /qué año sería el 18 de noviembre/);
  assert.doesNotMatch(result.reply, /2026|No pude completar/);
});

test('la pregunta previa y un presupuesto conocido no permiten adivinar el 350 de una frase mixta', () => {
  const current = { ...state, budget: 5000 };
  const facts = factsFor('para 350 el 18 noviembre', current, '¿Cuántos invitados y en qué fecha?');
  assert.deepEqual(facts.updates, {});
  assert.equal(facts.ambiguities[0].value, '350');
  assert.equal(localFactsResponse(current, facts).eventState.budget, 5000);
});

test('una frase con tipo y estilo conserva datos seguros y bloquea las suposiciones del modelo', () => {
  const message = 'Quiero un cumple elegante para 350 el 18 noviembre';
  const model = validateModelResult(JSON.stringify({ reply: 'Listo.', updates: { guestCount: 350, budget: 350, date: '2026-11-18', style: 'elegante' } }));
  const result = finishPlannerResult(createEventState(), model, message, options);
  assert.equal(result.eventState.eventType, 'cumpleaños');
  assert.equal(result.eventState.style, 'elegante');
  assert.equal(result.eventState.guestCount, null); assert.equal(result.eventState.budget, null); assert.equal(result.eventState.date, null);
  assert.equal(result.ambiguities.length, 2);
});

for (const order of [['personas', '2026'], ['2026', 'personas']]) {
  test(`aclaraciones en orden ${order.join(' → ')} conservan la otra pregunta pendiente`, () => {
    let result = localFactsResponse(state, factsFor('para 350 el 18 noviembre'));
    for (const answer of order) result = localFactsResponse(result.eventState, factsFor(answer, result.eventState, result.reply));
    assert.equal(result.eventState.guestCount, 350);
    assert.equal(result.eventState.date, '2026-11-18');
    assert.equal(result.eventState.budget, null);
    assert.match(result.reply, /presupuesto/);
    assert.equal(result.ambiguities, undefined);
  });
}

test('invitados y fecha completos se aplican juntos, luego se pregunta presupuesto', () => {
  const facts = factsFor('serán 350 personas el 18 de noviembre de 2026');
  assert.deepEqual(facts.updates, { date: '2026-11-18', guestCount: 350 });
  assert.deepEqual(facts.ambiguities, []);
  assert.match(localFactsResponse(state, facts).reply, /presupuesto/);
});

test('presupuesto explícito no se confunde con invitados y una corrección sustituye invitados', () => {
  assert.deepEqual(factsFor('tengo 3500 de presupuesto').updates, { budget: 3500 });
  const current = { ...state, guestCount: 350, budget: 3500 };
  const result = localFactsResponse(current, factsFor('en realidad serán 80', current));
  assert.equal(result.eventState.guestCount, 80); assert.equal(result.eventState.budget, 3500);
});

test('el contrato solicita solo reply y updates, con ambiguities opcional', () => {
  assert.deepEqual(EVENT_RESPONSE_SCHEMA.required, ['reply', 'updates']);
  assert.equal(EVENT_RESPONSE_SCHEMA.properties.status, undefined);
  assert.equal(EVENT_RESPONSE_SCHEMA.properties.missing_fields, undefined);
  assert.equal(EVENT_RESPONSE_SCHEMA.properties.updates.required, undefined);
});

for (const updates of [{}, null, [], undefined]) {
  test(`updates ${JSON.stringify(updates)} permite una respuesta natural sin borrar datos`, () => {
    const parsed = validateModelResult(JSON.stringify({ reply: '¿Cuántas personas asistirían?', updates }));
    assert.deepEqual(parsed.updates, {});
    const result = finishPlannerResult({ ...state, budget: 5000 }, parsed, 'Todavía lo estoy viendo.', options);
    assert.equal(result.eventState.budget, 5000);
    assert.equal(result.status, 'collecting');
  });
}

test('coerción controlada solo en campos identificados y sin convertir null a cero', () => {
  const parsed = validateModelResult(JSON.stringify({ reply: 'Perfecto.', updates: { guestCount: '350', budget: '3,500', city: null, style: null, selectedServices: null, extraRequirements: [] } }));
  assert.deepEqual(parsed.updates, { guestCount: 350, budget: 3500, extraRequirements: [] });
});

test('una respuesta parcialmente válida conserva sus campos válidos y evita confirmar los rechazados', () => {
  const parsed = validateModelResult(JSON.stringify({ reply: 'Anoté 350 personas y el presupuesto.', updates: { guestCount: '350 personas', budget: '3500', style: 'elegante', selectedServices: false, irrelevant: 'ignored' } }));
  assert.deepEqual(parsed.updates, { budget: 3500, style: 'elegante' });
  const result = finishPlannerResult(state, parsed, 'Que sea elegante, con ese presupuesto.', options);
  assert.equal(result.eventState.budget, 3500); assert.equal(result.eventState.guestCount, null);
  assert.doesNotMatch(result.reply, /Anoté 350 personas/);
  assert.match(result.reply, /fecha.*personas/);
});

test('sin reply pero con cambios válidos se genera una pregunta basada en el estado', () => {
  const result = finishPlannerResult(state, validateModelResult('{"updates":{"style":"elegante"}}'), 'Estilo elegante.', options);
  assert.equal(result.eventState.style, 'elegante'); assert.match(result.reply, /fecha/);
});

test('recupera texto externo al JSON, comillas escapadas y llaves dentro del reply', () => {
  const value = { reply: 'El estilo "elegante" {opcional}. ¿Cuántas personas?', updates: {} };
  const text = `Respuesta: ${JSON.stringify(value)} Fin.`;
  assert.deepEqual(recoverJSON(text), value);
  assert.equal(validateModelResult(text).reply, value.reply);
});

test('no inventa un año aunque el modelo lo incluya en updates', () => {
  const parsed = validateModelResult('{"reply":"Anotado.","updates":{"date":"2026-11-18"}}');
  const result = finishPlannerResult(state, parsed, 'el 18 noviembre', options);
  assert.equal(result.eventState.date, null); assert.match(result.reply, /qué año/);
});

test('ambiguities del modelo bloquea updates incompatibles y un estado lleno sigue collecting', () => {
  const current = { ...state, date: '2026-11-18', budget: 5000, guestCount: 80, selectedServices: ['Local'] };
  const parsed = validateModelResult(JSON.stringify({ reply: 'Listo.', updates: { guestCount: 350, budget: 350 }, ambiguities: [{ value: '350', possibleFields: ['guestCount', 'budget'] }] }));
  const result = finishPlannerResult(current, parsed, 'Mejor aproximadamente unos 350.', options);
  assert.deepEqual(result.eventState, current); assert.equal(result.status, 'collecting'); assert.deepEqual(result.missingFields, []);
});

test('completitud la calcula el código incluso con metadatos falsos del modelo', () => {
  const current = { ...state, date: '2026-11-18', budget: 5000, guestCount: 80, selectedServices: ['Local'] };
  const parsed = validateModelResult('{"reply":"Perfecto.","updates":{},"missing_fields":["budget"],"status":"collecting"}');
  const result = finishPlannerResult(current, parsed, 'Gracias por la ayuda.', options);
  assert.deepEqual(result.missingFields, []); assert.equal(result.status, 'ready');
  assert.equal(getEventStatus(current), 'ready'); assert.deepEqual(getMissingFields(state), ['date', 'guestCount', 'budget', 'selectedServices']);
});

test('fallback natural conserva datos y pregunta por la ambigüedad concreta', () => {
  const result = safePlannerResult(state, { ...options, message: 'para 350 el 18 noviembre' });
  assert.deepEqual(result.eventState, state); assert.equal(result.degraded, true);
  assert.match(result.reply, /350 invitados/); assert.match(result.reply, /qué año/);
  assert.doesNotMatch(result.reply, /No pude completar|JSON|fallback/);
  for (const invalid of ['no es JSON', '{}', '{"reply":null,"updates":null}', '{"reply":"Hola","updates":42}']) assert.throws(() => validateModelResult(invalid));
});
