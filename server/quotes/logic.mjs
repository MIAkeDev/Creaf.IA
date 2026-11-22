import { randomBytes } from 'node:crypto';
import { validateConversationState, dateFromParts } from '../../shared/conversation-state.mjs';
import { getEventStatus } from '../../shared/event-state.mjs';
import { generateProposals } from '../proposals/proposalEngine.mjs';
import { servicePrice } from '../proposals/providerSearch.mjs';
import { grossMargin } from '../../shared/pricing.mjs';

export class QuoteInputError extends Error {
  constructor(message, status = 400) { super(message); this.status = status; }
}
export function buildQuote(body, providers, user) {
  if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => !['conversationState', 'proposalId', 'allowAlternatives', 'idempotencyKey', 'whatsapp', 'consent'].includes(key))) throw new QuoteInputError('Solicitud no válida.');
  let conversation;
  try { conversation = validateConversationState(body.conversationState); } catch { throw new QuoteInputError('Los datos del evento no son válidos.'); }
  const event = conversation.event;
  if (getEventStatus(event) !== 'ready' || conversation.ambiguities.length || Object.keys(conversation.eventDateParts).length) throw new QuoteInputError('Completa los datos del evento antes de solicitar coordinación.');
  if (event.date !== null) {
    const [year, month, day] = event.date.split('-').map(Number);
    if (dateFromParts({ year, month, day }) !== event.date) throw new QuoteInputError('La fecha del evento no es válida.');
  }
  if (typeof body.proposalId !== 'string' || !/^[a-z]+-[a-f0-9]{12}$/.test(body.proposalId)) throw new QuoteInputError('Elige una propuesta válida.');
  if (typeof body.idempotencyKey !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.idempotencyKey)) throw new QuoteInputError('Clave de solicitud no válida.');
  if (body.allowAlternatives !== true && body.allowAlternatives !== false) throw new QuoteInputError('Alternativas no válidas.');
  const whatsapp = String(body.whatsapp || '').replace(/[^\d]/g, '');
  if (!/^\d{9,15}$/.test(whatsapp) || body.consent !== true) throw new QuoteInputError('Indica un WhatsApp válido y acepta el contacto sobre tu solicitud.');
  const current = generateProposals(event, providers, { allowAlternatives: body.allowAlternatives });
  const proposal = current.proposals.find(item => item.id === body.proposalId);
  if (!proposal) throw new QuoteInputError('La propuesta cambió. Vuelve a comparar antes de solicitar coordinación.');
  const items = proposal.providers.map(preview => {
    const provider = providers.find(item => item.id === preview.providerId && item.active);
    const service = provider?.services.find(item => item.id === preview.serviceId);
    if (!provider || !service || servicePrice(service) !== preview.price) throw new QuoteInputError('La propuesta cambió. Vuelve a comparar.');
    return {
      providerId: provider.id, serviceId: service.id, businessName: provider.businessName,
      phone: provider.phone || '', whatsapp: provider.whatsapp || '', category: preview.category,
      packageName: service.name, description: service.description || provider.description || '',
      includes: service.includes, excludes: service.excludes || [], providerCost: service.providerCost ?? null,
      markupType: service.markupType ?? null, markupValue: service.markupValue ?? null,
      publicPrice: preview.price, grossMargin: grossMargin(service),
      conditions: service.conditions || '', availability: 'pending',
    };
  });
  const code = `CF-${new Date().getUTCFullYear()}-${randomBytes(4).toString('hex').toUpperCase()}`;
  return {
    idempotencyKey: body.idempotencyKey, whatsapp, code,
    publicPayload: { event: { eventType: event.eventType, date: event.date, datePreference: event.datePreference, city: event.city, guestCount: event.guestCount, budget: event.budget }, services: proposal.providers.map(item => item.category), proposal: { id: proposal.id, title: proposal.title, type: proposal.type, total: proposal.total, providers: proposal.providers.map(item => ({ category: item.category, serviceName: item.serviceName, price: item.price, priceKind: item.priceKind })) } },
    privateSnapshot: { event, proposalId: proposal.id, items, totalPublic: proposal.total, totalProviderCost: items.every(item => item.providerCost !== null) ? items.reduce((sum, item) => sum + item.providerCost, 0) : null, expectedGrossMargin: items.every(item => item.grossMargin !== null) ? items.reduce((sum, item) => sum + item.grossMargin, 0) : null, customerEmail: user.email || '', customerName: user.user_metadata?.full_name || user.user_metadata?.name || '' },
  };
}

export function providerWhatsappUrl(quote, item) {
  const number = String(item.whatsapp || item.phone || '').replace(/\D/g, '');
  const digits = /^9\d{8}$/.test(number) ? `51${number}` : number;
  if (!/^\d{10,15}$/.test(digits)) return null;
  const lines = [
    `Hola, ${item.businessName || 'buen día'}. Te escribo de CreafIA para consultar tu servicio de ${item.category}.`,
    `Paquete cotizado: ${item.packageName}.`,
    ...(typeof item.providerCost === 'number' ? [`Precio registrado del proveedor: S/${item.providerCost.toFixed(2)}`] : []),
    `Evento: ${quote.public_payload.event.eventType}`, `Fecha: ${quote.public_payload.event.date || quote.public_payload.event.datePreference || 'Por definir'}`,
    `Ciudad: ${quote.public_payload.event.city}`, `Invitados: ${quote.public_payload.event.guestCount}`,
    `Solicitud: ${quote.request_code || 'CreafIA'}.`,
    '¿Puedes confirmar disponibilidad, precio y condiciones para este paquete?',
    'Si puedes responder dentro de las próximas 2 horas, podremos avanzar con la coordinación. ¡Gracias!',
  ];
  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`;
}

export function customerWhatsappUrl(quote, phone) {
  const number = String(phone || '').replace(/\D/g, '');
  const digits = /^9\d{8}$/.test(number) ? `51${number}` : number;
  if (!/^\d{10,15}$/.test(digits)) return null;
  const payload = quote.public_payload;
  const lines = [
    `Hola. Confirmamos la disponibilidad y el precio de la propuesta para tu ${payload.event.eventType}.`,
    `Fecha: ${payload.event.date || payload.event.datePreference || 'Por definir'}.`,
    `Servicios: ${payload.services.join(', ')}.`,
    `Precio de la propuesta: S/ ${Number(payload.proposal.total).toFixed(2)}.`,
    `Código de seguimiento: ${quote.request_code}.`,
    'Próximo paso: nos pondremos en contacto contigo para coordinar los detalles finales. Esta confirmación no es una reserva ni un pago.',
  ];
  return `https://wa.me/${digits}?text=${encodeURIComponent(lines.join('\n'))}`;
}
