import test from 'node:test';
import assert from 'node:assert/strict';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import { createQuoteApi } from './api.mjs';
import { ApiAuthError } from '../supabase.mjs';
import { validateProvider } from '../../shared/provider-validation.mjs';
import { createEventState } from '../../shared/event-state.mjs';
import { generateProposals } from '../proposals/proposalEngine.mjs';
import { buildGeneratedQuote } from './generated.mjs';
import { whatsappNumber, providerTemplateValues, customerTemplateValues, sendWhatsappTemplate } from './whatsapp.mjs';

async function invoke(api, method, path, body) {
  const req = Readable.from(body ? [JSON.stringify(body)] : []);
  req.method = method; req.url = path; req.headers = { 'content-type': 'application/json' };
  const res = new EventEmitter();
  res.writeHead = status => { res.status = status; };
  res.end = payload => { res.body = JSON.parse(payload); res.writableEnded = true; };
  await api(req, res, () => { res.next = true; });
  return res;
}

test('cada usuario solo recibe sus solicitudes y una cuenta normal no abre el panel', async () => {
  const rows = [{ id: 'a', user_id: 'user-a' }, { id: 'b', user_id: 'user-b' }];
  const db = { from(name) { assert.equal(name, 'quotations'); return {
    select() { return this; },
    eq(column, value) { assert.equal(column, 'user_id'); this.owner = value; return this; },
    order() { return this; },
    limit() { return Promise.resolve({ data: rows.filter(row => row.user_id === this.owner), error: null }); },
  }; } };
  const api = createQuoteApi({ store: { list: async () => [] }, authenticate: async () => ({ user: { id: 'user-a' }, db }), authorize: async () => { throw new ApiAuthError('Sin acceso.', 403); } });
  const mine = await invoke(api, 'GET', '/api/quotes');
  assert.equal(mine.status, 200);
  assert.deepEqual(mine.body.quotations.map(row => row.id), ['a']);
  const admin = await invoke(api, 'GET', '/api/admin/quotes');
  assert.equal(admin.status, 403);
  assert.equal(JSON.stringify(admin.body).includes('user-b'), false);
});

test('una solicitud privada exige sesión antes de consultar la base', async () => {
  const api = createQuoteApi({ store: { list: async () => { throw new Error('Should not run'); } }, authenticate: async () => { throw new ApiAuthError('Inicia sesión.'); } });
  const result = await invoke(api, 'POST', '/api/quotes', { proposalId: 'recommended-deadbeef0000' });
  assert.equal(result.status, 401);
});

test('public and private quote are saved by one database transaction', async () => {
  const event = { ...createEventState(), eventType: 'cumpleaños', date: '2026-12-18', guestCount: 20, budget: 1000, selectedServices: ['Catering'] };
  const provider = validateProvider({ id: 'one', businessName: 'Negocio', category: 'Catering', city: 'Ilo', active: true, verified: false, services: [{ id: 'food', name: 'Cena', eventTypes: ['cumpleaños'], priceFrom: 200, providerCost: 200, markupType: 'percent', markupValue: 10, includes: ['Cena'] }] });
  const proposal = generateProposals(event, [provider]).proposals[0];
  const body = { conversationState: { event, expectedField: null, eventDateParts: {}, ambiguities: [] }, proposalId: proposal.id, allowAlternatives: false, idempotencyKey: '123e4567-e89b-42d3-a456-426614174000', whatsapp: '51920632668', consent: true };
  let calls = 0;
  const db = {
    from(name) {
      assert.equal(name, 'quotations');
      return { select() { return this; }, eq() { return this; }, gte() { return Promise.resolve({ count: 0, error: null }); }, maybeSingle() { return Promise.resolve({ data: null, error: null }); } };
    },
    rpc(name, args) {
      calls++;
      assert.equal(name, 'create_quotation_atomic');
      assert.equal(args.p_user_id, 'user-a');
      assert.equal(args.p_public_payload.proposal.total, 220);
      assert.equal(args.p_snapshot.items[0].providerCost, 200);
      return Promise.resolve({ data: { id: 'saved', request_code: args.p_request_code }, error: null });
    },
  };
  const api = createQuoteApi({ store: { list: async () => [provider] }, authenticate: async () => ({ user: { id: 'user-a', email: 'client@example.com' }, db }) });
  const result = await invoke(api, 'POST', '/api/quotes', body);
  assert.equal(result.status, 201, JSON.stringify(result.body));
  assert.equal(result.body.quotation.id, 'saved');
  assert.equal(calls, 1);
});

test('las cotizaciones generadas se recalculan en el servidor y se guardan con la cuenta', async () => {
  const event = { ...createEventState(), eventType: 'cumpleaños', date: '2026-12-18', guestCount: 20, budget: 1000, selectedServices: ['Catering'] };
  const provider = validateProvider({ id: 'one', businessName: 'Negocio', category: 'Catering', city: 'Ilo', active: true, verified: false, services: [{ id: 'food', name: 'Cena', eventTypes: ['cumpleaños'], priceFrom: 200, providerCost: 200, markupType: 'percent', markupValue: 10, includes: ['Cena'] }] });
  const body = { conversationState: { event, expectedField: null, eventDateParts: {}, ambiguities: [] }, allowAlternatives: false };
  const user = { id: 'user-a', email: 'cliente@example.com' };
  const built = buildGeneratedQuote(body, [provider], user);
  assert.equal(built.customer_email, user.email);
  assert.equal(built.proposals[0].total, 220);
  assert.equal(JSON.stringify(built).includes('providerCost'), false);
  assert.equal(buildGeneratedQuote(body, [provider], user).fingerprint, built.fingerprint);
  let inserted;
  const db = { from(name) { assert.equal(name, 'generated_quotes'); return { upsert(row, options) { inserted = row; assert.equal(options.onConflict, 'user_id,fingerprint'); return Promise.resolve({ error: null }); } }; } };
  const api = createQuoteApi({ store: { list: async () => [provider] }, authenticate: async () => ({ user, db }) });
  const response = await invoke(api, 'POST', '/api/quotes/generated', body);
  assert.equal(response.status, 200);
  assert.equal(response.body.saved, true);
  assert.equal(inserted.user_id, user.id);
});

test('los mensajes automáticos usan plantillas y números internacionales, sin revelar el token', async () => {
  assert.equal(whatsappNumber('920 632 668'), '51920632668');
  assert.equal(whatsappNumber('abc'), null);
  const quote = { request_code: 'CF-2026-ABC', public_payload: { event: { eventType: 'cumpleaños', date: null, datePreference: 'sábado', city: 'Ilo', guestCount: 40 }, services: ['Catering'], proposal: { total: 500 } } };
  assert.equal(providerTemplateValues(quote, { category: 'Catering', packageName: 'Cena' })[4], 'Catering: Cena');
  assert.equal(customerTemplateValues(quote)[3], 'S/ 500.00');
  let sent;
  const env = { WHATSAPP_PHONE_NUMBER_ID: '123', WHATSAPP_ACCESS_TOKEN: 'private-token', WHATSAPP_PROVIDER_TEMPLATE: 'consulta', WHATSAPP_CUSTOMER_TEMPLATE: 'confirmacion' };
  const id = await sendWhatsappTemplate('920632668', 'provider', providerTemplateValues(quote, { category: 'Catering', packageName: 'Cena' }), env, async (url, options) => {
    sent = { url, options };
    return { ok: true, json: async () => ({ messages: [{ id: 'wamid-1' }] }) };
  });
  assert.equal(id, 'wamid-1');
  assert.match(sent.url, /graph\.facebook\.com\/v27\.0\/123\/messages/);
  assert.equal(JSON.parse(sent.options.body).to, '51920632668');
  assert.equal(JSON.parse(sent.options.body).template.name, 'consulta');
  assert.equal(JSON.stringify(JSON.parse(sent.options.body)).includes('private-token'), false);
});

test('confirmar exige que todos los proveedores estén disponibles y avisa al cliente después de cambiar estado', async () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  const quote = { id, state: 'coordinating', request_code: 'CF-2026-ABC', public_payload: { event: { eventType: 'cumpleaños', date: '2026-12-18' }, services: ['Catering'], proposal: { total: 500 } } };
  const item = { providerId: 'one', serviceId: 'food', whatsapp: '920632668', category: 'Catering', packageName: 'Cena' };
  const privateQuote = { snapshot: { items: [item] }, customer_whatsapp: '920632668', provider_status: {} };
  const writes = [];
  const db = { from(name) { return {
    select() { return this; }, eq() { return this; },
    maybeSingle() { return Promise.resolve({ data: name === 'quotations' ? quote : privateQuote, error: null }); },
    update(value) { writes.push(name); if (name === 'quotations') Object.assign(quote, value); else Object.assign(privateQuote, value); return this; },
  }; } };
  const api = createQuoteApi({ store: {}, authorize: async () => ({ db }), getWhatsappConfig: () => ({ ready: true, missing: [] }), sendWhatsapp: async () => { writes.push('send'); return 'wamid-2'; } });
  const blocked = await invoke(api, 'POST', `/api/admin/quotes/${id}/confirm`, {});
  assert.equal(blocked.status, 400);
  assert.equal(writes.length, 0);
  privateQuote.provider_status['one:food'] = { status: 'available' };
  const done = await invoke(api, 'POST', `/api/admin/quotes/${id}/confirm`, {});
  assert.equal(done.status, 200, JSON.stringify(done.body));
  assert.equal(done.body.state, 'completed');
  assert.equal(done.body.customerNotification.sent, true);
  assert.deepEqual(writes, ['quotations', 'send', 'quotation_private']);
  const duplicate = await invoke(api, 'POST', `/api/admin/quotes/${id}/notify-customer`, {});
  assert.equal(duplicate.body.customerNotification.alreadySent, true);
  assert.equal(writes.length, 3);
});

test('contactar a todos continúa ante un número inválido y evita repetir los mensajes guardados', async () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  const quote = { id, state: 'received', request_code: 'CF-2026-XYZ', public_payload: { event: { eventType: 'boda', date: '2026-12-20', city: 'Ilo', guestCount: 30 } } };
  const good = { providerId: 'one', serviceId: 'food', whatsapp: '920632668', category: 'Catering', packageName: 'Cena' };
  const bad = { providerId: 'two', serviceId: 'music', whatsapp: '', category: 'Música', packageName: 'DJ' };
  const privateQuote = { snapshot: { items: [good, bad] }, provider_status: {} };
  let sends = 0;
  const db = { from(name) { return {
    select() { return this; }, eq() { return this; },
    maybeSingle() { return Promise.resolve({ data: name === 'quotations' ? quote : privateQuote, error: null }); },
    update(value) { Object.assign(name === 'quotations' ? quote : privateQuote, value); return this; },
  }; } };
  const api = createQuoteApi({ store: {}, authorize: async () => ({ db }), getWhatsappConfig: () => ({ ready: true, missing: [] }), sendWhatsapp: async () => { sends++; return 'wamid-provider'; } });
  const first = await invoke(api, 'POST', `/api/admin/quotes/${id}/notify-providers`, {});
  assert.equal(first.status, 200);
  assert.deepEqual(first.body.sent, ['one:food']);
  assert.equal(first.body.failed[0].key, 'two:music');
  assert.equal(privateQuote.provider_status['one:food'].status, 'consulted');
  assert.equal(quote.state, 'coordinating');
  const second = await invoke(api, 'POST', `/api/admin/quotes/${id}/notify-providers`, {});
  assert.deepEqual(second.body.alreadySent, ['one:food']);
  assert.equal(sends, 1);
});

test('confirmación manual cambia el estado y prepara WhatsApp sin credenciales de Meta', async () => {
  const id = '123e4567-e89b-42d3-a456-426614174000';
  const quote = { id, state: 'coordinating', request_code: 'CF-2026-MAN', public_payload: { event: { eventType: 'boda', date: '2026-12-20' }, services: ['Catering'], proposal: { total: 500 } } };
  const privateQuote = { snapshot: { items: [{ providerId: 'one', serviceId: 'food' }] }, customer_whatsapp: '920632668', provider_status: { 'one:food': { status: 'available' } } };
  let sends = 0;
  const db = { from(name) { return { select() { return this; }, eq() { return this; }, maybeSingle() { return Promise.resolve({ data: name === 'quotations' ? quote : privateQuote, error: null }); }, update(value) { Object.assign(quote, value); return this; } }; } };
  const api = createQuoteApi({ store: {}, authorize: async () => ({ db }), getWhatsappConfig: () => ({ ready: false, missing: ['WHATSAPP_ACCESS_TOKEN'] }), sendWhatsapp: async () => { sends++; } });
  const result = await invoke(api, 'POST', `/api/admin/quotes/${id}/confirm`, { delivery: 'manual' });
  assert.equal(result.status, 200, JSON.stringify(result.body));
  assert.equal(result.body.state, 'completed');
  assert.match(result.body.customerWhatsappUrl, /wa\.me\/51920632668/);
  assert.match(decodeURIComponent(result.body.customerWhatsappUrl), /Precio de la propuesta: S\/ 500\.00/);
  assert.equal(sends, 0);
});
