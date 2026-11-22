import test from 'node:test';
import assert from 'node:assert/strict';
import { validateProvider } from '../../shared/provider-validation.mjs';
import { salePrice } from '../../shared/pricing.mjs';
import { createEventState } from '../../shared/event-state.mjs';
import { generateProposals } from '../proposals/proposalEngine.mjs';
import { buildQuote, QuoteInputError, providerWhatsappUrl } from './logic.mjs';

const event = { ...createEventState(), eventType: 'cumpleaños', date: '2026-12-18', guestCount: 20, budget: 1000, selectedServices: ['Catering'] };
const provider = validateProvider({ id: 'one', businessName: 'Empresa Privada', category: 'Catering', city: 'Ilo', active: true, verified: false, phone: '51987654321', whatsapp: '51987654321', evidenceImages: [], services: [{ id: 'food', name: 'Cena', eventTypes: ['cumpleaños'], priceFrom: 200, providerCost: 200, markupType: 'percent', markupValue: 10, styles: [], includes: ['Cena'] }] });
const proposal = generateProposals(event, [provider]).proposals[0];
const body = { conversationState: { event, expectedField: null, eventDateParts: {}, ambiguities: [] }, proposalId: proposal.id, allowAlternatives: false, idempotencyKey: '123e4567-e89b-42d3-a456-426614174000', whatsapp: '51920632668', consent: true };
const user = { email: 'client@example.com', user_metadata: {} };

test('el recargo usa céntimos y conserva los precios públicos heredados', () => {
  assert.equal(salePrice(200, 'percent', 10), 220);
  assert.equal(salePrice(19.99, 'percent', 10), 21.99);
  assert.equal(salePrice(200, 'fixed', 15.5), 215.5);
  assert.equal(provider.services[0].priceFrom, 220);
  const legacy = validateProvider({ ...provider, services: [{ ...provider.services[0], providerCost: undefined, markupValue: undefined, markupType: undefined, priceFrom: 200 }] });
  assert.equal(legacy.services[0].priceFrom, 200);
});

test('la solicitud deriva precio y proveedor del catálogo, separando la vista pública', () => {
  const quote = buildQuote(body, [provider], user);
  assert.equal(quote.publicPayload.proposal.total, 220);
  assert.equal(quote.privateSnapshot.items[0].providerCost, 200);
  assert.equal(quote.privateSnapshot.expectedGrossMargin, 20);
  assert.equal(JSON.stringify(quote.publicPayload).includes('Empresa Privada'), false);
  assert.equal(JSON.stringify(quote.publicPayload).includes('51987654321'), false);
  assert.equal(JSON.stringify(quote.publicPayload).includes('providerCost'), false);
  assert.equal(JSON.stringify(quote.publicPayload).includes('providerId'), false);
  const url = providerWhatsappUrl({ public_payload: quote.publicPayload }, quote.privateSnapshot.items[0]);
  assert.match(url, /wa\.me\/51987654321/);
  assert.match(decodeURIComponent(url), /Precio registrado del proveedor: S\/200\.00/);
  assert.doesNotMatch(decodeURIComponent(url), /51920632668|220\.00/);
});

test('rechaza ID, precio y proveedor manipulados, y consentimiento ausente', () => {
  assert.throws(() => buildQuote({ ...body, proposalId: 'recommended-deadbeef0000' }, [provider], user), QuoteInputError);
  assert.throws(() => buildQuote({ ...body, price: 1 }, [provider], user), QuoteInputError);
  assert.throws(() => buildQuote({ ...body, providerId: 'other' }, [provider], user), QuoteInputError);
  assert.throws(() => buildQuote({ ...body, consent: false }, [provider], user), QuoteInputError);
  assert.throws(() => buildQuote(body, [{ ...provider, active: false }], user), QuoteInputError);
});

test('una cotizaciÃ³n sin fecha exacta conserva la preferencia para cliente y proveedor', () => {
  const flexibleEvent = { ...event, date: null, datePreference: 'Entre el 25 y 28 de noviembre' };
  const flexibleProposal = generateProposals(flexibleEvent, [provider]).proposals[0];
  const quote = buildQuote({ ...body, conversationState: { ...body.conversationState, event: flexibleEvent }, proposalId: flexibleProposal.id }, [provider], user);
  assert.equal(quote.publicPayload.event.date, null);
  assert.equal(quote.publicPayload.event.datePreference, 'Entre el 25 y 28 de noviembre');
  assert.match(decodeURIComponent(providerWhatsappUrl({ public_payload: quote.publicPayload }, quote.privateSnapshot.items[0])), /Entre el 25 y 28 de noviembre/);
});

test('prepara un mensaje por paquete y acepta WhatsApp peruano sin costo registrado', () => {
  const quote = buildQuote(body, [provider], user);
  const item = { ...quote.privateSnapshot.items[0], whatsapp: '987654321', providerCost: null };
  const url = providerWhatsappUrl({ request_code: quote.code, public_payload: quote.publicPayload }, item);
  assert.match(url, /wa\.me\/51987654321/);
  assert.match(decodeURIComponent(url), /Paquete cotizado: Cena/);
  assert.match(decodeURIComponent(url), /dentro de las próximas 2 horas/);
  assert.doesNotMatch(decodeURIComponent(url), /Precio registrado/);
});
