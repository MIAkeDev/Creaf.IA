import test from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, mkdtemp, rm } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { validateProvider, validateImageSource } from '../shared/provider-validation.mjs';
import { createEventState } from '../shared/event-state.mjs';
import { providerSearch, calculateProviderScore } from './proposals/providerSearch.mjs';
import { generateProposals } from './proposals/proposalEngine.mjs';
import { createProviderStore } from './providers/store.mjs';
import { createProviderApi } from './providers/api.mjs';
import { PROPOSAL_CONFIG } from './proposals/config.mjs';
import { createChatHandler } from './chat.mjs';
import { serviceOptions } from './providers/service-options.mjs';

const event = { ...createEventState(), eventType: 'quinceañero', date: '2026-12-18', guestCount: 70, budget: 1000, selectedServices: ['Local'], style: 'elegante' };
function provider(id = 'p1', price = 990, patch = {}) {
  return validateProvider({ id, businessName: `Negocio Privado ${id}`, category: 'Local', city: 'Ilo', active: true, verified: true, yearsExperience: 5, eventsCompleted: 80, rating: 4.5, phone: '+51 987654321', whatsapp: '987654321', instagram: '@privado', address: 'Calle privada 123', coverImage: '/avatar/monkey-atlas.png', evidenceImages: [], services: [{ id: `s-${id}`, name: 'Local para celebrar', eventTypes: ['quinceañero'], priceFrom: price, guestMin: 30, guestMax: 120, styles: ['Elegante'], includes: ['Mesas y sillas'] }], ...patch });
}
async function withStore(run) {
  const root = resolve(fileURLToPath(new URL('../output', import.meta.url)));
  const directory = await mkdtemp(join(root, 'provider-tests-'));
  try { await run(createProviderStore(join(directory, 'providers.json')), directory); }
  finally { assert(directory.startsWith(root + sep)); assert(directory.split(sep).at(-1).startsWith('provider-tests-')); await rm(directory, { recursive: true, force: true }); }
}
async function invoke(handler, method, path, body, headers = {}) {
  const request = Readable.from(body === undefined ? [] : [JSON.stringify(body)]);
  request.method = method; request.url = path; request.headers = { host: 'localhost:5173', 'content-type': 'application/json', ...headers };
  const response = new EventEmitter(); response.headers = {}; response.setHeader = (name, value) => { response.headers[name] = value; };
  response.writeHead = (status, values) => { response.status = status; Object.assign(response.headers, values); };
  response.end = body => { response.body = response.headers['Content-Type']?.startsWith('application/json') ? JSON.parse(body) : body; };
  await handler(request, response, () => { response.next = true; }); return response;
}
const conversation = current => ({ event: current, expectedField: null, eventDateParts: {}, ambiguities: [] });
function bartender() {
  const item = provider('bar', 200, { category: 'Bartender / bebidas' });
  Object.assign(item.services[0], { name: 'Barra libre', eventTypes: ['babyShower'], guestMin: 10, guestMax: 25 });
  return item;
}
const shower = { ...event, eventType: 'baby shower', selectedServices: ['Barman'], guestCount: 20 };

for (const budget of [5000, 37400]) test(`baby shower encuentra bartender con S/${budget} sin exigir gastar todo`, () => {
  const result = generateProposals({ ...shower, budget }, [bartender()]);
  assert.equal(result.proposals.length, 1); assert.equal(result.proposals[0].total, 200);
  assert.equal(result.suggestedBudget, undefined); assert.deepEqual(result.blockers, []);
});

test('la capacidad bloquea sin ofrecer aumentos de presupuesto ni ampliar rangos', () => {
  const item = bartender();
  for (const budget of [5000, 37400]) {
    const result = generateProposals({ ...shower, guestCount: 500, budget }, [item]);
    assert.equal(result.proposals.length, 0); assert.equal(result.suggestedBudget, undefined);
    assert.equal(result.canAllowAlternatives, false); assert.equal(result.blockers[0].reason, 'capacity');
    assert.match(result.blockers[0].message, /10–25/); assert.equal(item.services[0].guestMax, 25);
  }
});

test('un servicio sin registrar no se arregla subiendo el presupuesto', () => {
  const result = generateProposals({ ...shower, budget: 37400, selectedServices: ['Barman', 'Catering'] }, [bartender()]);
  assert.equal(result.proposals.length, 0); assert.equal(result.suggestedBudget, undefined);
  assert.equal(result.canAllowAlternatives, false); assert.equal(result.blockers[0].reason, 'not_registered');
});

test('diagnóstico distingue ciudad, evento, inactivo y precio pendiente', () => {
  for (const [reason, change] of [
    ['city', item => { item.city = 'Tacna'; }],
    ['event_type', item => { item.services[0].eventTypes = ['matrimonio']; }],
    ['inactive', item => { item.active = false; }],
    ['quote_required', item => { item.services[0].priceFrom = 0; item.services[0].priceModel = 'customQuote'; }],
  ]) {
    const item = bartender(); change(item);
    const result = generateProposals(shower, [item]);
    assert.equal(result.blockers[0].reason, reason); assert.equal(result.suggestedBudget, undefined);
  }
});

test('el mínimo total conocido guía el presupuesto sin incrementos interminables', () => {
  const result = generateProposals(event, [provider('a', 1200)]);
  assert.deepEqual(result, { proposals: [], budgetInsufficient: true, minimumTotal: 1200 });
  const retry = generateProposals({ ...event, budget: result.minimumTotal }, [provider('a', 1200)]);
  assert.equal(retry.proposals.length, 1); assert.equal(retry.suggestedBudget, undefined);
  const combined = generateProposals({ ...event, selectedServices: ['Local', 'Catering'] }, [provider('a', 700), provider('b', 700, { category: 'Catering' })]);
  assert.deepEqual(combined, { proposals: [], budgetInsufficient: true, minimumTotal: 1400 });
});

test('categoría por paquete admite negocios con servicios de varias categorías', () => {
  const item = bartender(); item.category = 'Otros'; item.services[0].category = 'Barman';
  const valid = validateProvider(item);
  assert.equal(valid.services[0].category, 'Barman');
  assert.equal(generateProposals(shower, [valid]).proposals.length, 1);
  assert.equal(serviceOptions([valid], shower).options[0].category, 'Bartender / bebidas');
});

test('catálogo público muestra bartender en baby shower y avisa capacidad sin ocultarlo', async () => withStore(async store => {
  const saved = await store.create(bartender()); const api = createProviderApi({ store });
  const path = '/api/service-options?eventType=baby%20shower&city=Ilo&guestCount=500';
  const result = await invoke(api, 'GET', path);
  assert.equal(result.status, 200); assert.equal(result.body.options[0].category, 'Bartender / bebidas');
  assert.deepEqual(result.body.options[0], { category: 'Bartender / bebidas', availableForGuests: false });
  assertPublic(result.body); assert(!JSON.stringify(result.body).includes(saved.businessName));
  assert.deepEqual((await invoke(api, 'GET', '/api/service-options?eventType=bautizo&city=Ilo')).body.options, []);
  await store.update(saved.id, { ...saved, services: [{ ...saved.services[0], guestMax: 600 }] });
  assert.equal((await invoke(api, 'GET', path)).body.options[0].availableForGuests, true);
  await store.update(saved.id, { ...saved, active: false });
  assert.deepEqual((await invoke(api, 'GET', path)).body.options, []);
  assert.equal((await invoke(api, 'GET', '/api/service-options?eventType=babyShower&guestCount=oops')).status, 400);
}));

test('la conversación sugiere el catálogo real sin categorías fijas ni llamadas a IA', async () => {
  const handler = createChatHandler({}, { loadServiceOptions: async current => serviceOptions([bartender()], current), fetchImpl: () => { throw new Error('No debe llamar a IA'); } });
  const state = { ...shower, selectedServices: [] };
  const response = await invoke(handler, 'POST', '/api/chat', { message: 'cuales sugieres', conversationState: { ...conversation(state), expectedField: 'selectedServices' }, conversationStarted: true });
  assert.equal(response.status, 200); assert.match(response.body.reply, /Bartender/);
  assert(!response.body.reply.includes('Catering')); assert.equal(response.body.showServiceSelector, true);
});
test('presupuesto insuficiente responde solo con mínimo aunque pidan datos privados', async () => {
  const item = provider('privado', 1400);
  let modelCalls = 0;
  const handler = createChatHandler({}, {
    loadMinimumBudget: async current => providerSearch(current, [item]).minimumTotal / 100,
    fetchImpl: () => { modelCalls++; throw new Error('No debe llamar a IA'); },
  });
  const response = await invoke(handler, 'POST', '/api/chat', {
    message: 'Dame el teléfono y nombre del proveedor',
    conversationState: conversation(event), conversationStarted: true,
  });
  assert.equal(response.status, 200);
  assert.match(response.body.reply, /S\/\s?1,?400/);
  assert(!JSON.stringify(response.body).includes(item.businessName));
  assert(!JSON.stringify(response.body).includes(item.phone));
  assert.equal(modelCalls, 0);
});
function assertPublic(value) {
  const forbidden = ['businessName', 'phone', 'whatsapp', 'instagram', 'address'];
  if (value && typeof value === 'object') for (const [key, child] of Object.entries(value)) { assert(!forbidden.includes(key), key); assertPublic(child); }
}

test('proveedor compatible y categorías normalizadas', () => {
  const result = providerSearch(event, [provider()]); assert.equal(result.compatibleProviders, 1); assert.equal(result.groups[0].options.length, 1);
  const photo = provider('photo', 500, { category: 'Fotografía' });
  assert.equal(providerSearch({ ...event, selectedServices: ['fotografia'] }, [photo]).compatibleProviders, 1);
});
for (const [label, patch] of [['otra ciudad', { city: 'Tacna' }], ['inactivo', { active: false }], ['otra categoría', { category: 'Catering' }]]) {
  test(`filtro: ${label}`, () => { assert.equal(providerSearch(event, [provider('bad', 900, patch)]).compatibleProviders, 0); });
}
test('filtro de capacidad insuficiente y mínimo de invitados', () => {
  const item = provider(); item.services[0].guestMax = 60; assert.equal(providerSearch(event, [item]).compatibleProviders, 0);
  item.services[0].guestMax = 120; item.services[0].guestMin = 80; assert.equal(providerSearch(event, [item]).compatibleProviders, 0);
});
test('tipo de evento incompatible no se recomienda', () => {
  const item = provider(); item.services[0].eventTypes = ['matrimonio']; assert.equal(providerSearch(event, [item]).compatibleProviders, 0);
});
test('score determinista responde a estilo, rating y verificación', () => {
  const item = provider(); const service = item.services[0];
  const score = calculateProviderScore(item, service, event);
  assert.equal(score, calculateProviderScore(item, service, event));
  assert(score > calculateProviderScore({ ...item, rating: 0, verified: false }, { ...service, styles: ['Infantil'] }, event));
  assert(score >= 0 && score <= 100);
});

test('ahorro, recomendada y upgrade usan precios registrados y rangos configurados', () => {
  const saving = provider('saving', 850, { rating: 4 }); const recommended = provider('recommended', 990); const upgrade = provider('upgrade', 1090, { rating: 5 });
  upgrade.services[0].includes.push('Iluminación adicional');
  const result = generateProposals(event, [saving, recommended, upgrade]);
  assert.equal(result.proposals.length, 3);
  for (const proposal of result.proposals) {
    const band = PROPOSAL_CONFIG.bands[proposal.type];
    assert(proposal.total >= event.budget * band.min && proposal.total <= event.budget * band.max);
    assert.equal(proposal.total, proposal.providers.reduce((total, item) => total + item.price, 0));
    assert.equal(proposal.difference, proposal.total - event.budget);
  }
  assert.deepEqual(result.proposals.find(item => item.type === 'upgrade').improvedCategories, ['Local']);
  assert.deepEqual(result, generateProposals(event, [saving, recommended, upgrade]));
});
test('un catálogo aislado genera tres alternativas diferenciadas para S/5000', () => {
  const seed = ['Local', 'Decoración', 'Catering', 'DJ'].flatMap((category, index) => [1100, 1230, 1380].map((price, variant) => provider(`fixture-${index}-${variant}`, price, { category, rating: 4 + variant * .4 })));
  const result = generateProposals({ ...event, budget: 5000, selectedServices: ['Local', 'Decoración', 'Catering', 'DJ'] }, seed);
  assert.equal(result.proposals.length, 3); assert.equal(result.compatibleProviders, 12); assert.equal(result.compatibleServices, 12);
  assert.equal(new Set(result.proposals.map(item => item.id)).size, 3);
  for (const proposal of result.proposals) assert.equal(proposal.providers.length, 4);
  assertPublic(result);
});
test('un presupuesto demasiado bajo no inventa combinaciones ni altera precios', () => {
  const result = generateProposals({ ...event, budget: 10 }, [provider()]);
  assert.deepEqual(result, { proposals: [], budgetInsufficient: true, minimumTotal: 990 });
});
test('una única combinación produce una propuesta, sin duplicados artificiales', () => {
  const result = generateProposals(event, [provider()]); assert.equal(result.proposals.length, 1); assert.equal(result.proposals[0].total, 990);
});
test('dos combinaciones del mismo precio se muestran honestamente como alternativas', () => {
  const result = generateProposals(event, [provider('a'), provider('b')]);
  assert.equal(result.proposals.length, 2); assert(result.proposals.some(item => item.isAlternative));
  assert(result.proposals.every(item => item.total === 990));
});
test('ningún proveedor produce cero propuestas y categorías faltantes reales', () => {
  const result = generateProposals(event, []); assert.deepEqual(result.proposals, []); assert.equal(result.compatibleProviders, 0); assert.deepEqual(result.missingCategories, ['Local']);
});
test('cada combinación cubre todos los servicios sin reutilizar el mismo servicio', () => {
  const catering = provider('catering', 400, { category: 'Catering' });
  const result = generateProposals({ ...event, budget: 1500, selectedServices: ['Local', 'Catering'] }, [provider('local'), catering]);
  assert.equal(result.proposals.length, 1); assert.equal(result.proposals[0].total, 1390);
  assert.deepEqual(result.proposals[0].providers.map(item => item.category), ['Local', 'Catering']);
});
test('priceTo no se usa para inventar importes; fixedPrice explícito sí se respeta', () => {
  const item = provider('a', 850); item.services[0].priceTo = 9000;
  assert.equal(generateProposals(event, [item]).proposals[0].total, 850);
  item.services[0].priceModel = 'fixed'; item.services[0].fixedPrice = 990;
  assert.equal(generateProposals(event, [item]).proposals[0].total, 990);
});
test('alternativas amplían solo el margen de precio, nunca ciudad o capacidad', () => {
  const item = provider('a', 1200);
  assert.equal(generateProposals(event, [item]).proposals.length, 0);
  assert.deepEqual(generateProposals(event, [item], { allowAlternatives: true }), { proposals: [], budgetInsufficient: true, minimumTotal: 1200 });
  assert.equal(generateProposals(event, [provider('b', 1200, { city: 'Tacna' })], { allowAlternatives: true }).proposals.length, 0);
});

test('DTO público excluye contactos, nombres comerciales y URLs originales', () => {
  const item = provider('secret'); item.services[0].name = `Paquete de ${item.businessName}`;
  item.services[0].providerCost = 600; item.services[0].markupType = 'percent'; item.services[0].markupValue = 10;
  item.services[0].description = `${item.businessName} ${item.phone} ${item.whatsapp} ${item.instagram} ${item.address} contacto@example.com`;
  item.services[0].includes.push(`Coordinar en ${item.phone}`);
  const result = generateProposals(event, [item]); assertPublic(result);
  const serialized = JSON.stringify(result);
  assert.equal(serialized.includes('providerCost'), false);
  assert.equal(serialized.includes('markupValue'), false);
  for (const secret of [item.businessName, item.phone, item.whatsapp, item.instagram, item.address, 'contacto@example.com', '/avatar/monkey-atlas.png']) assert(!serialized.includes(secret), secret);
  assert.match(result.proposals[0].providers[0].evidenceImage, /^\/api\/proposal-images\/secret\/0$/);
});
test('contador usa proveedores únicos aunque existan varios paquetes compatibles', () => {
  const item = provider(); item.services.push({ ...item.services[0], id: 'second', priceFrom: 900 });
  const result = generateProposals(event, [item]); assert.equal(result.compatibleProviders, 1); assert.equal(result.compatibleServices, 2);
});
for (const [label, change] of [
  ['nombre vacío', item => { item.businessName = ''; }], ['servicios vacíos', item => { item.services = []; }],
  ['precio negativo', item => { item.services[0].priceFrom = -1; }], ['mínimo negativo', item => { item.services[0].guestMin = -1; }],
  ['máximo menor', item => { item.services[0].guestMax = 20; }], ['rating mayor que cinco', item => { item.rating = 6; }],
  ['tipo de evento vacío', item => { item.services[0].eventTypes = []; }], ['servicio sin nombre', item => { item.services[0].name = ''; }],
  ['precio máximo menor', item => { item.services[0].priceTo = 1; }], ['imagen con traversal', item => { item.coverImage = '/../data/secret.svg'; }],
]) test(`validación de formulario: ${label}`, () => { const item = provider(); change(item); assert.throws(() => validateProvider(item)); });
test('categorías personalizadas se conservan y las URLs inseguras se rechazan', () => {
  assert.equal(validateProvider(provider('a', 100, { category: 'Show de magia' })).category, 'Show de magia');
  for (const source of ['javascript:alert(1)', 'http://127.0.0.1/a.png', 'https://example.com/a.png', '/%5c..%5csecret.png', '/%.png']) assert.throws(() => validateImageSource(source));
});

test('API y JSON: crear, editar, desactivar, recargar y eliminar proveedor', async () => withStore(async (store, directory) => {
  const api = createProviderApi({ store, authorizeAdmin: async () => ({}) });
  const created = await invoke(api, 'POST', '/api/admin/providers', provider());
  assert.equal(created.status, 201); const id = created.body.provider.id;
  assert.equal((await invoke(api, 'GET', '/api/admin/providers')).body.providers.length, 1);
  const changed = await invoke(api, 'PUT', `/api/admin/providers/${id}`, { ...created.body.provider, businessName: 'Nombre editado', active: false });
  assert.equal(changed.status, 200); assert.equal(changed.body.provider.active, false);
  const fresh = await createProviderStore(join(directory, 'providers.json')).list(); assert.equal(fresh[0].businessName, 'Nombre editado');
  assert.equal(generateProposals(event, fresh).proposals.length, 0);
  assert.equal((await invoke(api, 'DELETE', `/api/admin/providers/${id}`)).status, 200);
  assert.deepEqual(await store.list(), []);
}));
test('escrituras concurrentes conservan todos los proveedores y un JSON íntegro', async () => withStore(async store => {
  await Promise.all([store.create(provider('a')), store.create(provider('b')), store.create(provider('c'))]);
  assert.equal((await store.list()).length, 3);
}));
test('API rechaza formularios inválidos sin escribir un registro parcial', async () => withStore(async store => {
  const response = await invoke(createProviderApi({ store, authorizeAdmin: async () => ({}) }), 'POST', '/api/admin/providers', { businessName: 'Incompleto' });
  assert.equal(response.status, 400); assert.deepEqual(await store.list(), []);
}));
test('endpoint de propuestas solo entrega el DTO público, sin usar IA', async () => withStore(async store => {
  await store.create(provider());
  const response = await invoke(createProviderApi({ store }), 'POST', '/api/proposals', { conversationState: conversation(event) });
  assert.equal(response.status, 200); assertPublic(response.body); assert.equal(response.body.proposals.length, 1);
}));
test('la API limita búsquedas de propuestas simultáneas por instancia', async () => {
  let release; let entered = 0; let allEntered;
  const gate = new Promise(resolve => { release = resolve; });
  const ready = new Promise(resolve => { allEntered = resolve; });
  const store = { async list() { if (++entered === 4) allEntered(); await gate; return [provider()]; } };
  const api = createProviderApi({ store });
  const body = { conversationState: conversation(event) };
  const pending = Array.from({ length: 4 }, () => invoke(api, 'POST', '/api/proposals', body));
  await ready;
  const excess = await invoke(api, 'POST', '/api/proposals', body);
  assert.equal(excess.status, 429);
  assert.equal(excess.headers['Retry-After'], '2');
  release();
  const results = await Promise.all(pending);
  assert(results.every(result => result.status === 200));
  assert.equal((await invoke(api, 'POST', '/api/proposals', body)).status, 200);
});
test('rechaza búsquedas antes de ready o con ambigüedades pendientes', async () => withStore(async store => {
  const api = createProviderApi({ store });
  assert.equal((await invoke(api, 'POST', '/api/proposals', { conversationState: conversation({ ...event, date: null }) })).status, 409);
  assert.equal((await invoke(api, 'POST', '/api/proposals', { conversationState: { ...conversation(event), ambiguities: [{ value: '500', possibleFields: ['guestCount', 'budget'] }] } })).status, 409);
}));
test('permite cotizar con fecha por definir sin inventar disponibilidad', async () => withStore(async store => {
  await store.create(provider());
  const flexible = { ...event, date: null, datePreference: 'Fecha por definir' };
  const response = await invoke(createProviderApi({ store }), 'POST', '/api/proposals', { conversationState: conversation(flexible) });
  assert.equal(response.status, 200);
  assert.equal(response.body.proposals.length, 1);
  assert.equal(response.body.proposals[0].total, 990);
}));
test('administración y propuestas rechazan solicitudes de otros orígenes', async () => withStore(async store => {
  assert.equal((await invoke(createProviderApi({ store }), 'GET', '/api/admin/providers', undefined, { origin: 'https://otro-sitio.example' })).status, 403);
}));

test('el catálogo administrativo exige una sesión incluso desde localhost', async () => withStore(async store => {
  const response = await invoke(createProviderApi({ store }), 'GET', '/api/admin/providers');
  assert.equal(response.status, 401);
  assert.equal(JSON.stringify(response.body).includes('businessName'), false);
}));
test('evidencia pública se sirve por ID y no contiene metadatos privados', async () => withStore(async store => {
  const saved = await store.create(provider());
  const response = await invoke(createProviderApi({ store }), 'GET', `/api/proposal-images/${saved.id}/0`);
  assert.equal(response.status, 200); assert.equal(response.headers['Content-Type'], 'image/png');
  assert(!response.body.toString().includes(saved.businessName));
}));

test('un registro de cotización sin precio conocido no se presenta como gratuito', () => {
  const item = provider('quote', 0); item.services[0].priceModel = 'customQuote';
  assert.equal(generateProposals(event, [item]).proposals.length, 0);
  item.services[0].priceModel = 'from'; assert.equal(generateProposals(event, [item]).proposals[0].total, 0);
});
test('una fecha inválida no puede habilitar propuestas por modificar el JSON del cliente', async () => withStore(async store => {
  const response = await invoke(createProviderApi({ store }), 'POST', '/api/proposals', { conversationState: conversation({ ...event, date: '2026-11-31' }) });
  assert.equal(response.status, 400);
}));
test('un catálogo corrupto produce un error controlado y no filtra su contenido', async () => withStore(async (store, directory) => {
  await writeFile(join(directory, 'providers.json'), JSON.stringify([{ businessName: 'Secreto que no debe salir' }]));
  const response = await invoke(createProviderApi({ store }), 'POST', '/api/proposals', { conversationState: conversation(event) });
  assert.equal(response.status, 500); assert(!JSON.stringify(response.body).includes('Secreto'));
}));
