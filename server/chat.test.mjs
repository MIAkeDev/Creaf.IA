import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createChatHandler as createHandler } from './chat.mjs';
import { SYSTEM_PROMPT } from './system-prompt.mjs';
import { createEventState, getMissingFields, validateEventState } from '../shared/event-state.mjs';
import { EVENT_PRESETS, detectEventType, getSuggestedServices } from '../shared/event-presets.mjs';
import { buildPlannerContext, finishPlannerResult } from './event-planner.mjs';
import { questionFor } from '../shared/event-questions.mjs';
import { getReferenceDate, resolveRelativeEventDate, dateExample } from '../shared/event-dates.mjs';

const config = { AI_PROVIDER: 'groq', GROQ_API_KEY: 'test-only-not-a-real-secret' };
const createChatHandler = (env, options = {}) => createHandler(env, { now: () => new Date('2026-11-05T15:00:00Z'), ...options });
const question = { message: 'Quiero hacer un quinceañero', eventState: createEventState() };
function output(updates = {}, reply = '¿Para qué fecha y cuántas personas asistirán?', extra = {}) {
  return JSON.stringify({ reply, updates, ...extra });
}
function provider(content) { return Response.json({ choices: [{ message: { content } }] }); }
function fakeHandler(updates, reply, extra) { return createChatHandler(config, { fetchImpl: async () => provider(output(updates, reply, extra)) }); }
async function invoke(handler, body = question, options = {}) {
  const request = Readable.from([options.raw ?? JSON.stringify(body)]);
  request.url = options.url || '/api/chat'; request.method = options.method || 'POST';
  request.headers = { host: 'localhost:5173', origin: 'http://localhost:5173', 'content-type': 'application/json', ...options.headers };
  const response = new EventEmitter(); response.setHeader = () => {};
  response.writeHead = status => { response.status = status; };
  response.end = text => { response.body = text ? JSON.parse(text) : null; response.writableEnded = true; };
  await handler(request, response, () => { response.next = true; }); return response;
}

test('quince, cumple, matri y santo se guardan como tipos canónicos sin llamar a Groq', async () => {
  const handler = createChatHandler(config, { fetchImpl: () => assert.fail('Un alias claro no necesita Groq') });
  for (const [message, type] of [['quince', 'quinceañero'], ['¡QUINCE!', 'quinceañero'], ['cumple', 'cumpleaños'], ['matri', 'matrimonio'], ['santo', 'cumpleaños']]) {
    const response = await invoke(handler, { message, eventState: createEventState(), conversationStarted: true });
    assert.equal(response.body.eventState.eventType, type); assert(!response.body.missingFields.includes('eventType'));
    assert.doesNotMatch(response.body.reply, /tipo de evento|hola/i); assert.match(response.body.reply, /fecha/);
    assert.deepEqual(response.body.eventState.selectedServices, []);
  }
});

test('repetir quince conserva datos y continúa solo con lo pendiente', async () => {
  const eventState = { ...createEventState(), eventType: 'quinceañero', date: '20 de diciembre', budget: 5000 };
  const handler = createChatHandler(config, { fetchImpl: () => assert.fail('No llamar') });
  const response = await invoke(handler, { message: 'quince', eventState });
  assert.deepEqual(response.body.eventState, eventState); assert.match(response.body.reply, /personas/);
  assert.doesNotMatch(response.body.reply, /tipo de evento|qué fecha|presupuesto/i);
});

test('un alias con invitados queda en contexto y resultado aunque el modelo omita el tipo', async () => {
  const message = 'Quiero hacer un quince para mi hija, son 40 personas.';
  const handler = createChatHandler(config, { fetchImpl: async (_, options) => {
    const context = JSON.parse(JSON.parse(options.body).messages[1].content);
    assert.equal(context.event_state.eventType, 'quinceañero'); assert(!context.missing_fields.includes('eventType'));
    assert.deepEqual(context.suggested_services, EVENT_PRESETS.quinceañero);
    return provider(output({ guestCount: 40 }, '¿Qué tipo de evento planeas y en qué fecha?'));
  } });
  const response = await invoke(handler, { message, eventState: createEventState(), conversationStarted: true });
  assert.equal(response.body.eventState.eventType, 'quinceañero'); assert.equal(response.body.eventState.guestCount, 40);
  assert.doesNotMatch(response.body.reply, /tipo de evento/); assert.match(response.body.reply, /fecha/);
});

test('alias en frases normales y presets adecuados', () => {
  for (const [text, type] of [['Un quince para mi hija', 'quinceañero'], ['El cumple de mi mamá', 'cumpleaños'], ['Quiero un matri sencillo', 'matrimonio'], ['Es el santo de mi mamá', 'cumpleaños']]) {
    assert.equal(detectEventType(text), type); assert.deepEqual(getSuggestedServices(type), EVENT_PRESETS[type]);
  }
  assert.deepEqual(getSuggestedServices('matri'), EVENT_PRESETS.matrimonio);
});

test('no confunde cantidades, fechas, lugares, negaciones o alternativas con un alias elegido', () => {
  for (const text of ['Serán quince personas', 'Tengo quince mil soles', 'El quince de diciembre', 'Santo Domingo', 'El contrato cumple el plazo', 'No quiero un matri', 'Un cumple o un matri']) assert.equal(detectEventType(text), null, text);
});

test('una corrección explícita cambia el tipo y conserva presupuesto e invitados', async () => {
  const eventState = { ...createEventState(), eventType: 'cumpleaños', budget: 5000, guestCount: 40 };
  const response = await invoke(fakeHandler({}, '¿Qué tipo de evento?'), { message: 'Mejor un matri.', eventState });
  assert.equal(response.body.eventState.eventType, 'matrimonio'); assert.equal(response.body.eventState.budget, 5000);
  assert.equal(response.body.eventState.guestCount, 40); assert.doesNotMatch(response.body.reply, /tipo de evento/);
});

test('normaliza también los alias devueltos por el modelo', async () => {
  const response = await invoke(fakeHandler({ eventType: 'santo' }, '¿Para qué fecha?'), { message: 'El de mi mamá.', eventState: createEventState() });
  assert.equal(response.body.eventState.eventType, 'cumpleaños');
});

test('solo tipo de evento: extrae el dato, no selecciona servicios por defecto', async () => {
  const result = await invoke(fakeHandler({ eventType: 'quinceañero' }));
  assert.equal(result.status, 200); assert.equal(result.body.eventState.eventType, 'quinceañero');
  assert.equal(result.body.eventState.city, 'Ilo'); assert.deepEqual(result.body.eventState.selectedServices, []);
  assert.deepEqual(result.body.missingFields, ['date', 'guestCount', 'budget', 'selectedServices']); assert.equal(result.body.status, 'collecting');
});

test('saludos simples reciben un saludo sin Excelente ni llamadas a Groq', async () => {
  const handler = createChatHandler(config, { fetchImpl: () => assert.fail('Un saludo no necesita Groq') });
  for (const message of ['Hola', '¡Hola!', 'Hola 👋', 'buenos días', 'Buenas tardes']) {
    const response = await invoke(handler, { message, eventState: createEventState() });
    assert.equal(response.status, 200); assert.match(response.body.reply, /^¡Hola, mucho gusto!/);
    assert.doesNotMatch(response.body.reply, /Excelente|Perfecto/);
    assert.deepEqual(response.body.eventState, createEventState()); assert.equal(response.body.status, 'collecting');
  }
});

test('saludar durante el evento no pierde datos ni vuelve a preguntar su tipo', async () => {
  const eventState = { ...createEventState(), eventType: 'cumpleaños', budget: 5000 };
  const handler = createChatHandler(config, { fetchImpl: () => assert.fail('No llamar a Groq') });
  const response = await invoke(handler, { message: 'Hola', eventState });
  assert.deepEqual(response.body.eventState, eventState); assert.match(response.body.reply, /fecha/);
  assert.doesNotMatch(response.body.reply, /tipo de evento/);
});

test('un saludo con datos del evento sí pasa por extracción', async () => {
  let calls = 0;
  const handler = createChatHandler(config, { fetchImpl: async () => {
    calls++; return provider(output({ eventType: 'cumpleaños', budget: 5000 }, '¡Hola, mucho gusto! ¿Para qué fecha y cuántas personas asistirían?'));
  } });
  const response = await invoke(handler, { message: 'Hola, quiero un cumpleaños con 5000 soles.', eventState: createEventState() });
  assert.equal(calls, 1); assert.equal(response.body.eventState.budget, 5000); assert.equal(response.body.eventState.eventType, 'cumpleaños');
});

test('después de saludar, el siguiente mensaje continúa sin repetir la presentación', async () => {
  const greetingHandler = createChatHandler(config, { fetchImpl: () => assert.fail('No llamar') });
  const first = await invoke(greetingHandler, { message: 'Hola', eventState: createEventState(), conversationStarted: false });
  assert.match(first.body.reply, /^¡Hola, mucho gusto!/);
  let context;
  const handler = createChatHandler(config, { fetchImpl: async (_, options) => {
    context = JSON.parse(JSON.parse(options.body).messages[1].content);
    return provider(output({ eventType: 'quinceañero', guestCount: 40 }, '¡Hola, mucho gusto! Para continuar, ¿qué fecha tienes en mente para el quinceañero?'));
  } });
  const next = await invoke(handler, { message: 'Quiero hacer un quince para mi hija, son 40 personas.', eventState: first.body.eventState, conversationStarted: true });
  assert.equal(context.conversation_started, true);
  assert.equal(next.body.eventState.guestCount, 40); assert.equal(next.body.eventState.eventType, 'quinceañero');
  assert.doesNotMatch(next.body.reply, /hola|mucho gusto/i); assert.match(next.body.reply, /qué fecha/);
});

test('un segundo hola no vuelve a saludar, aunque todavía no haya datos de evento', async () => {
  const handler = createChatHandler(config, { fetchImpl: () => assert.fail('No llamar') });
  const response = await invoke(handler, { message: 'Hola', eventState: createEventState(), conversationStarted: true });
  assert.doesNotMatch(response.body.reply, /hola|mucho gusto/i); assert.match(response.body.reply, /tipo de evento/);
});

test('si el modelo solo repite un saludo, continúa con una pregunta útil', async () => {
  const response = await invoke(fakeHandler({}, 'Hola. Mucho gusto!'), { message: 'Quiero organizar algo.', eventState: createEventState(), conversationStarted: true });
  assert(response.body.reply.trim().length); assert.doesNotMatch(response.body.reply, /hola|mucho gusto/i);
  assert.match(response.body.reply, /tipo de evento/);
});

test('el indicador de conversación debe ser un booleano', async () => {
  const handler = createChatHandler(config, { fetchImpl: () => assert.fail('No llamar') });
  assert.equal((await invoke(handler, { ...question, conversationStarted: 'false' })).status, 400);
});

test('todos los datos en un mensaje pasan a ready aunque el modelo diga collecting', async () => {
  const updates = { eventType: 'cumpleaños', date: '2026-12-20', guestCount: 70, budget: 5000, selectedServices: ['Catering', 'Torta'] };
  const result = await invoke(fakeHandler(updates, undefined, { status: 'collecting' }), { ...question, message: 'Cumpleaños el 20 de diciembre de 2026, 70 invitados, S/5000, catering y torta.' });
  assert.equal(result.body.status, 'ready'); assert.deepEqual(result.body.missingFields, []);
  assert.equal(result.body.eventState.budget, 5000); assert.match(result.body.reply, /ya tengo .*necesari/i);
});

test('presupuesto aproximado y personas se mantienen como datos, sin calcular precios', async () => {
  const result = await invoke(fakeHandler({ budget: 3500, guestCount: 70 }), { ...question, message: 'Tengo hasta S/3500 para unas 70 personas.' });
  assert.equal(result.body.eventState.budget, 3500); assert.equal(result.body.eventState.guestCount, 70);
});

test('corregir invitados reemplaza el valor anterior y conserva el resto', async () => {
  const eventState = { ...createEventState(), eventType: 'cumpleaños', guestCount: 60, budget: 5000 };
  const result = await invoke(fakeHandler({ guestCount: 80 }), { message: 'En realidad serán 80.', eventState });
  assert.equal(result.body.eventState.guestCount, 80); assert.equal(result.body.eventState.budget, 5000);
});

test('eliminar un servicio no borra los demás ni lo repone desde el preset', async () => {
  const eventState = { ...createEventState(), eventType: 'quinceañero', selectedServices: ['Local', 'Fotografía', 'DJ'] };
  const result = await invoke(fakeHandler({ selectedServices: ['Local', 'DJ'] }), { message: 'No quiero fotógrafo.', eventState });
  assert.deepEqual(result.body.eventState.selectedServices, ['Local', 'DJ']);
});

test('agregar servicios personalizados conserva la selección previa', async () => {
  const eventState = { ...createEventState(), selectedServices: ['Local'] };
  const result = await invoke(fakeHandler({ selectedServices: ['Local', 'Maestro de ceremonia', 'Show de magia'] }), { message: 'Agrega maestro de ceremonia y un show de magia.', eventState });
  assert.deepEqual(result.body.eventState.selectedServices, ['Local', 'Maestro de ceremonia', 'Show de magia']);
});

test('mensaje ambiguo: pide aclaración y no modifica datos conocidos', async () => {
  const eventState = { ...createEventState(), eventType: 'cumpleaños', guestCount: 60 };
  const result = await invoke(fakeHandler({}, '¿Te refieres al presupuesto o a la cantidad de invitados?'), { message: 'Mejor más o menos.', eventState });
  assert.deepEqual(result.body.eventState, eventState); assert.match(result.body.reply, /Te refieres/);
});

test('consulta por proveedores: retiene presupuesto/tipo, no devuelve recomendaciones inventadas', async () => {
  const result = await invoke(fakeHandler({ eventType: 'cumpleaños', budget: 5000 }, 'Contrata a Proveedor Inventado.'), { ...question, message: 'Tengo 5 mil soles para el cumpleaños de mi mamá, ¿qué proveedores me sugieres?' });
  assert.equal(result.body.eventState.budget, 5000); assert.match(result.body.reply, /no comparto listas ni contactos de proveedores/);
  assert.doesNotMatch(result.body.reply, /Inventado/); assert.match(result.body.reply, /fecha/);
});

test('JSON inválido: un solo retry, fallback seguro, estado intacto', async () => {
  let calls = 0;
  const handler = createChatHandler(config, { fetchImpl: async () => { calls++; return provider('no es JSON'); } });
  const response = await invoke(handler);
  assert.equal(calls, 2); assert.equal(response.status, 200); assert.equal(response.body.degraded, true);
  assert.deepEqual(response.body.eventState, { ...question.eventState, eventType: 'quinceañero' }); assert.match(response.body.reply, /fecha/);
  assert.doesNotMatch(response.body.reply, /No pude completar|JSON|modelo/);
});

test('recupera un bloque JSON trivial sin gastar otro request', async () => {
  let calls = 0;
  const handler = createChatHandler(config, { fetchImpl: async () => { calls++; return provider('```json\n' + output({ style: 'elegante' }, 'Perfecto, un estilo elegante.') + '\n```'); } });
  const result = await invoke(handler); assert.equal(calls, 1); assert.equal(result.body.eventState.style, 'elegante');
});

test('ready y missingFields los decide código aunque el modelo los falsee', async () => {
  const response = await invoke(fakeHandler({ eventType: 'cumpleaños' }, 'Listo, ya está completo.', { status: 'ready', missing_fields: [] }));
  assert.equal(response.body.status, 'collecting'); assert.match(response.body.reply, /fecha/);
  assert.deepEqual(response.body.missingFields, getMissingFields(response.body.eventState));
});

test('compacta contexto, envía solo preset relevante y último mensaje, nunca historial', async () => {
  const handler = createChatHandler(config, { fetchImpl: async (url, options) => {
    const body = JSON.parse(options.body); const context = JSON.parse(body.messages[1].content);
    assert.equal(url, 'https://api.groq.com/openai/v1/chat/completions');
    assert.equal(options.headers.Authorization, `Bearer ${config.GROQ_API_KEY}`);
    assert.equal(body.messages.length, 2); assert.equal(body.messages[0].content, SYSTEM_PROMPT);
    assert.deepEqual(context.suggested_services, EVENT_PRESETS.quinceañero);
    assert.deepEqual(context.event_state, { city: 'Ilo', eventType: 'quinceañero' }); assert.equal(context.last_message, question.message);
    assert.equal(body.max_completion_tokens, 350); assert.equal(body.temperature, .15); assert.equal(body.reasoning_effort, 'low');
    assert.equal(body.response_format.type, 'json_schema'); assert.equal(body.response_format.json_schema.strict, false);
    assert.deepEqual(body.response_format.json_schema.schema.required, ['reply', 'updates']);
    assert.equal(body.response_format.json_schema.schema.properties.status, undefined);
    return provider(output({ eventType: 'quinceañero' }));
  } });
  assert.equal((await invoke(handler)).status, 200);
  const context = JSON.parse(buildPlannerContext({ ...createEventState(), eventType: 'babyShower' }, 'Algo elegante'));
  assert.deepEqual(context.suggested_services, EVENT_PRESETS.babyShower);
});

test('no muestra HTML, Markdown ni JSON técnico en reply', async () => {
  const response = await invoke(fakeHandler({}, '**Perfecto**<br>¿Qué fecha prefieres?'), { message: 'algo especial', eventState: createEventState() });
  assert.doesNotMatch(response.body.reply, /<br>|\*\*|\{"reply"/);
});

test('pregunta por fecha de forma amable con ejemplos sin convertirlos en datos', async () => {
  const state = { ...createEventState(), eventType: 'cumpleaños', guestCount: 70, budget: 5000, selectedServices: ['Torta'] };
  const text = questionFor(state);
  assert.match(text, /^Perfecto/); assert.match(text, /día, mes y año/); assert.match(text, /\d{4}/);
  assert.doesNotMatch(text, /próximo sábado/);
  assert.equal(state.date, null); assert.doesNotMatch(text, /presupuesto|cuántas/);
});

test('resuelve el próximo sábado y conserva el día local de Perú', () => {
  assert.equal(getReferenceDate(new Date('2026-11-06T02:00:00Z')), '2026-11-05');
  assert.equal(resolveRelativeEventDate('el proximo sabado', '2026-11-05'), '2026-11-07');
  assert.equal(resolveRelativeEventDate('el próximo sábado', '2026-11-07'), '2026-11-14');
  assert.equal(resolveRelativeEventDate('este sábado', '2026-11-07'), '2026-11-07');
  assert.equal(resolveRelativeEventDate('mañana', '2026-12-31'), '2027-01-01');
  assert.equal(resolveRelativeEventDate('pasado mañana', '2026-12-31'), '2027-01-02');
  assert.match(dateExample('2026-12-31'), /2027/);
});

test('no convierte ejemplos, preguntas, alternativas ni horarios en fechas del evento', () => {
  for (const text of ['Por ejemplo, el próximo sábado', '¿Qué fecha es el próximo sábado?', 'No el próximo sábado', 'El próximo sábado o domingo', 'Será el 20 de diciembre por la mañana', 'Será por la mañana']) {
    assert.equal(resolveRelativeEventDate(text, '2026-11-05'), null, text);
  }
});

test('respuesta el próximo sábado se guarda sin Groq y pregunta solo lo pendiente', async () => {
  const eventState = { ...createEventState(), eventType: 'cumpleaños', budget: 5000 };
  const handler = createChatHandler(config, { fetchImpl: () => assert.fail('La fecha relativa simple se resuelve localmente') });
  const response = await invoke(handler, { message: 'el proximo sabado', eventState });
  assert.equal(response.body.eventState.date, resolveRelativeEventDate('el proximo sabado', '2026-11-05'));
  assert.match(response.body.reply, /sábado.*\d{4}/); assert.match(response.body.reply, /personas/);
  assert.doesNotMatch(response.body.reply, /qué fecha|indicarme la fecha|día, mes y año/);
  assert.equal(response.body.eventState.budget, 5000);
});

test('fecha relativa con otros datos: contexto y estado final la conservan aunque el modelo la omita', () => {
  const state = { ...createEventState(), eventType: 'cumpleaños', budget: 5000 };
  const message = 'el próximo sábado, unas 70 personas';
  const context = JSON.parse(buildPlannerContext(state, message, { referenceDate: '2026-11-05' }));
  assert.equal(context.event_state.date, '2026-11-07'); assert(!context.missing_fields.includes('date'));
  const result = finishPlannerResult(state, { updates: { guestCount: 70, date: 'fecha errónea' }, reply: '¿Qué fecha?', claimedStatus: 'collecting' }, message, { referenceDate: '2026-11-05' });
  assert.equal(result.eventState.date, '2026-11-07'); assert.equal(result.eventState.guestCount, 70);
  assert(!result.missingFields.includes('date')); assert.doesNotMatch(result.reply, /Qué fecha/);
});

test('una fecha demasiado vaga pide aclaración concreta sin completar el campo', async () => {
  const handler = createChatHandler(config, { fetchImpl: () => assert.fail('No necesita Groq') });
  const response = await invoke(handler, { message: 'el próximo mes', eventState: createEventState() });
  assert.equal(response.body.eventState.date, null); assert.match(response.body.reply, /qué día y mes/);
  assert.match(response.body.reply, /\d{4}/);
});

test('solo faltan servicios: invita al selector y permite omitir después', async () => {
  const eventState = { ...createEventState(), eventType: 'cumpleaños', date: '20 de diciembre', guestCount: 70, budget: 5000 };
  const response = await invoke(fakeHandler({}, '¿Qué servicios deseas incluir de la lista sugerida?'), { message: 'Eso es todo.', eventState });
  assert.match(response.body.reply, /^Excelente/); assert.match(response.body.reply, /formulario/);
  assert.match(response.body.reply, /marcar todos/); assert.match(response.body.reply, /desmarcar/);
  assert.equal(response.body.status, 'collecting'); assert.deepEqual(response.body.eventState.selectedServices, []);
});

test('cuáles sugieres muestra opciones sin seleccionar ni gastar una llamada a Groq', async () => {
  const eventState = { ...createEventState(), eventType: 'cumpleaños', date: '20 de diciembre', guestCount: 70, budget: 5000 };
  const handler = createChatHandler(config, { fetchImpl: () => assert.fail('Una sugerencia simple no necesita llamar al modelo') });
  for (const message of ['cuales sugieres', '¿Cuáles me recomiendas?', 'Qué servicios sugieres']) {
    const response = await invoke(handler, { message, eventState });
    assert.equal(response.status, 200); assert.equal(response.body.status, 'collecting');
    assert.deepEqual(response.body.eventState.selectedServices, []);
    assert.match(response.body.reply, /Catering/); assert.match(response.body.reply, /Son sugerencias/);
    assert.equal(response.body.showServiceSelector, true); assert.deepEqual(response.body.missingFields, ['selectedServices']);
  }
});

test('está bien u ok después de sugerencias pide elección y no declara listo', async () => {
  const eventState = { ...createEventState(), eventType: 'cumpleaños', date: '20 de diciembre', guestCount: 70, budget: 5000 };
  const handler = createChatHandler(config, { fetchImpl: () => assert.fail('No debe llamar al modelo') });
  for (const message of ['está bien', 'OK', 'Perfecto, gracias']) {
    const response = await invoke(handler, { message, eventState });
    assert.equal(response.body.status, 'collecting'); assert.deepEqual(response.body.eventState.selectedServices, []);
    assert.match(response.body.reply, /prefieres elegir algunos/); assert.doesNotMatch(response.body.reply, /ya tengo|estamos listos/);
  }
});

test('bloquea servicios alucinados en una pregunta mixta y conserva datos explícitos nuevos', async () => {
  const eventState = { ...createEventState(), eventType: 'cumpleaños', date: '20 de diciembre', guestCount: 70, budget: 5000 };
  const response = await invoke(fakeHandler({ budget: 6000, selectedServices: ['Local', 'Catering', 'Torta'] }, 'Perfecto, estamos listos.', { status: 'ready' }), { message: 'Mi presupuesto ahora es 6000 soles, ¿cuáles sugieres?', eventState });
  assert.equal(response.body.eventState.budget, 6000); assert.deepEqual(response.body.eventState.selectedServices, []);
  assert.equal(response.body.status, 'collecting'); assert.match(response.body.reply, /Son sugerencias/);
});

test('un asentimiento no permite al modelo inventar datos o completar servicios', async () => {
  const eventState = { ...createEventState(), eventType: 'cumpleaños', budget: 5000 };
  const response = await invoke(fakeHandler({ date: '2026-12-20', guestCount: 70, selectedServices: ['Torta'] }, 'Ya está todo.', { status: 'ready' }), { message: 'Ok', eventState });
  assert.deepEqual(response.body.eventState, eventState); assert.equal(response.body.status, 'collecting');
  assert.match(response.body.reply, /fecha/);
});

test('una elección explícita sí puede completar el evento', async () => {
  const eventState = { ...createEventState(), eventType: 'cumpleaños', date: '20 de diciembre', guestCount: 70, budget: 5000 };
  const selectedServices = EVENT_PRESETS.cumpleaños;
  const response = await invoke(fakeHandler({ selectedServices }), { message: 'Sí, incluye todos.', eventState });
  assert.deepEqual(response.body.eventState.selectedServices, selectedServices); assert.equal(response.body.status, 'ready');
});

test('pedir sugerencias antes de completar datos abre selector y conserva elecciones anteriores', async () => {
  const handler = createChatHandler(config, { fetchImpl: () => assert.fail('No debe llamar al modelo') });
  const eventState = { ...createEventState(), eventType: 'cumpleaños', selectedServices: ['Torta'] };
  const response = await invoke(handler, { message: '¿Qué me sugieres?', eventState });
  assert.deepEqual(response.body.eventState, eventState); assert.equal(response.body.showServiceSelector, true);
  assert.equal(response.body.status, 'collecting'); assert.match(response.body.reply, /Catering/);
});

test('validación: números, arrays, estado y campos no permitidos', async () => {
  assert.throws(() => validateEventState({ budget: -10 })); assert.throws(() => validateEventState({ guestCount: 1.5 }));
  const handler = createChatHandler(config, { fetchImpl: () => assert.fail('No llamar') });
  for (const body of [{ message: '' }, { message: 'a'.repeat(6001) }, { messages: [] }, { ...question, model: 'intruso' }, { ...question, system: 'intruso' }, { ...question, eventState: { status: 'ready' } }, { ...question, eventState: { selectedServices: [1] } }]) assert.equal((await invoke(handler, body)).status, 400);
  assert.equal((await invoke(handler, {}, { raw: '{roto' })).status, 400);
  assert.equal((await invoke(handler, {}, { raw: 'a'.repeat(48001) })).status, 413);
});

test('sin clave informa sin llamar al proveedor; origen y método siguen protegidos', async () => {
  const handler = createChatHandler({}, { fetchImpl: () => assert.fail('No llamar') });
  const response = await invoke(handler); assert.equal(response.status, 503); assert.match(response.body.error, /GROQ_API_KEY/);
  assert.equal((await invoke(handler, question, { headers: { origin: 'https://otro-sitio.com' } })).status, 403);
  assert.equal((await invoke(handler, question, { headers: { origin: 'http://localhost:9999' } })).status, 403);
  assert.equal((await invoke(handler, question, { method: 'GET' })).status, 405);
  assert.equal((await invoke(handler, question, { headers: { 'content-type': 'text/plain' } })).status, 415);
  assert.equal((await invoke(handler, question, { url: '/otro' })).next, true);
});

test('oculta errores sensibles y conserva el chat ante cuota o fallo temporal', async () => {
  for (const [status, expected] of [[401, 502], [403, 502], [402, 502], [429, 200], [400, 502], [404, 502], [500, 200]]) {
    let calls = 0;
    const handler = createChatHandler(config, { fetchImpl: async () => { calls++; return Response.json({ error: config.GROQ_API_KEY }, { status }); } });
    const response = await invoke(handler); assert.equal(response.status, expected); assert.equal(calls, 1);
    assert.equal(JSON.stringify(response.body).includes(config.GROQ_API_KEY), false);
    if (expected === 200) assert.equal(response.body.degraded, true);
  }
});

test('no cambia de proveedor/modelo; xAI conserva su configuración si estaba elegido', async () => {
  const handler = createChatHandler({ AI_PROVIDER: 'xai', XAI_API_KEY: 'fake-xai', XAI_MODEL: 'configured-model' }, { fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.x.ai/v1/chat/completions'); assert.equal(options.headers.Authorization, 'Bearer fake-xai');
    assert.equal(JSON.parse(options.body).model, 'configured-model'); assert.equal(JSON.parse(options.body).max_tokens, 350);
    return provider(output());
  } });
  assert.equal((await invoke(handler)).status, 200);
});

test('timeout cancela la llamada y conserva el estado con una pregunta segura', async () => {
  const handler = createChatHandler(config, { timeoutMs: 10, fetchImpl: (_, options) => new Promise((resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true })) });
  const response = await invoke(handler);
  assert.equal(response.status, 200);
  assert.equal(response.body.degraded, true);
  assert.equal(response.body.eventState.eventType, 'quinceañero');
  assert.match(response.body.reply, /fecha/);
});

test('secuencia real: fecha, 500 invitados y cinco mil soles, sin llamadas a Groq', async () => {
  const handler = createChatHandler(config, { fetchImpl: () => assert.fail('Los datos claros no necesitan IA') });
  const first = await invoke(handler, { message: 'quince', eventState: createEventState(), conversationStarted: true });
  const partialDate = await invoke(handler, { message: 'si el dia 15 de noviembre', eventState: first.body.eventState, lastAssistantMessage: first.body.reply, conversationStarted: true });
  assert.equal(partialDate.body.eventState.date, null); assert.match(partialDate.body.reply, /qué año/);
  const date = await invoke(handler, { message: '2026', eventState: partialDate.body.eventState, lastAssistantMessage: partialDate.body.reply, conversationStarted: true });
  assert.equal(date.body.eventState.date, '2026-11-15');
  assert.match(date.body.reply, /personas|invitados/);
  const numeric = await invoke(handler, { message: '500 tengo 5 mil soles', eventState: date.body.eventState, lastAssistantMessage: date.body.reply, conversationStarted: true });
  assert.equal(numeric.body.eventState.guestCount, 500); assert.equal(numeric.body.eventState.budget, 5000);
  assert(!numeric.body.missingFields.includes('guestCount')); assert(!numeric.body.missingFields.includes('budget'));
  assert.match(numeric.body.reply, /formulario/);
});

test('500 responde a la última pregunta de invitados sin error de modelo', async () => {
  const handler = createChatHandler(config, { fetchImpl: () => assert.fail('No llamar') });
  const eventState = { ...createEventState(), eventType: 'quinceañero', date: '2026-11-15' };
  const result = await invoke(handler, { message: '500', eventState, lastAssistantMessage: '¿Cuántos invitados planeas?', conversationStarted: true });
  assert.equal(result.status, 200); assert.equal(result.body.eventState.guestCount, 500);
  assert.match(result.body.reply, /presupuesto/); assert.doesNotMatch(result.body.reply, /modelo|cuántos invitados/i);
});

test('un error de validación JSON del proveedor permite un retry y conserva los datos claros', async () => {
  let calls = 0;
  const handler = createChatHandler(config, { fetchImpl: async (_, options) => {
    calls++;
    const context = JSON.parse(JSON.parse(options.body).messages[1].content);
    assert.equal(context.event_state.guestCount, 500); assert.equal(context.event_state.budget, 5000);
    assert.equal(context.last_question, '¿Cuántos invitados planeas?');
    return Response.json({ error: { code: 'json_validate_failed', message: 'No compartir detalles' } }, { status: 400 });
  } });
  const result = await invoke(handler, { message: '500 personas, 5 mil soles, algo elegante.', eventState: { ...createEventState(), eventType: 'cumpleaños' }, lastAssistantMessage: '¿Cuántos invitados planeas?' });
  assert.equal(calls, 2); assert.equal(result.status, 200); assert.equal(result.body.degraded, true);
  assert.equal(result.body.eventState.guestCount, 500); assert.equal(result.body.eventState.budget, 5000);
  assert.doesNotMatch(result.body.reply, /Revisa el modelo|No compartir/);
});

test('un HTTP 400 genérico no se anuncia como modelo inexistente', async () => {
  const handler = createChatHandler(config, { fetchImpl: async () => Response.json({ error: { code: 'invalid_request_error' } }, { status: 400 }) });
  const result = await invoke(handler);
  assert.equal(result.status, 502); assert.doesNotMatch(result.body.error, /modelo configurado/);
});

test('valida la última pregunta recibida sin aceptar historial ilimitado', async () => {
  const handler = createChatHandler(config, { fetchImpl: () => assert.fail('No llamar') });
  for (const lastAssistantMessage of [42, { role: 'system' }, 'a'.repeat(1001)]) assert.equal((await invoke(handler, { ...question, lastAssistantMessage })).status, 400);
});

test('un error del proveedor conserva fecha, invitados y presupuesto ya interpretados', async () => {
  const handler = createChatHandler(config, { fetchImpl: async () => Response.json({ error: { code: 'invalid_request_error' } }, { status: 400 }) });
  const response = await invoke(handler, {
    message: '500 personas, 5 mil soles, el 15 de noviembre de 2026, algo elegante.',
    eventState: { ...createEventState(), eventType: 'cumpleaños' },
    lastAssistantMessage: '¿Cuántos invitados planeas?',
  });
  assert.equal(response.status, 502); assert.equal(response.body.eventState.guestCount, 500);
  assert.equal(response.body.eventState.budget, 5000); assert(response.body.eventState.date);
  assert.doesNotMatch(response.body.error, /modelo configurado/);
});

test('API: para 350 el 18 noviembre aclara número y año sin consumir Groq', async () => {
  const handler = createChatHandler(config, { fetchImpl: () => assert.fail('Una aclaración simple no necesita tokens') });
  const eventState = { ...createEventState(), eventType: 'cumpleaños' };
  const response = await invoke(handler, { message: 'para 350 el 18 noviembre', eventState, conversationStarted: true });
  assert.equal(response.status, 200); assert.deepEqual(response.body.eventState, eventState);
  assert.match(response.body.reply, /350 invitados o a S\/ 350/); assert.match(response.body.reply, /qué año/);
  assert.equal(response.body.ambiguities.length, 2); assert.equal(response.body.status, 'collecting');
});

test('API: texto fuera del JSON y cambios parcialmente válidos no provocan retry', async () => {
  let calls = 0;
  const handler = createChatHandler(config, { fetchImpl: async () => {
    calls++;
    return provider('Respuesta: {"reply":"Anotado.","updates":{"style":"elegante","budget":"3500","guestCount":"varios"}} Fin.');
  } });
  const response = await invoke(handler, { message: 'Me gustaría algo elegante.', eventState: createEventState() });
  assert.equal(calls, 1); assert.equal(response.status, 200);
  assert.equal(response.body.eventState.budget, 3500); assert.equal(response.body.eventState.style, 'elegante');
  assert.equal(response.body.eventState.guestCount, null); assert.match(response.body.reply, /tipo de evento/);
  assert.equal(response.body.degraded, undefined);
});

test('API: JSON inválido conserva datos claros y aclara lo pendiente tras un solo retry', async () => {
  let calls = 0;
  const handler = createChatHandler(config, { fetchImpl: async () => { calls++; return provider('Formato inválido'); } });
  const response = await invoke(handler, { message: 'Quiero un cumple elegante para 350 el 18 noviembre', eventState: createEventState() });
  assert.equal(calls, 2); assert.equal(response.status, 200); assert.equal(response.body.degraded, true);
  assert.equal(response.body.eventState.eventType, 'cumpleaños'); assert.equal(response.body.eventState.guestCount, null);
  assert.match(response.body.reply, /350 invitados/); assert.match(response.body.reply, /qué año/);
  assert.doesNotMatch(response.body.reply, /No pude completar|JSON|Formato inválido/);
});
