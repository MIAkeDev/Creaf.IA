import { QuoteInputError } from './logic.mjs';

export function whatsappConfiguration(env = process.env) {
  const required = ['WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PROVIDER_TEMPLATE', 'WHATSAPP_CUSTOMER_TEMPLATE'];
  const missing = required.filter(key => !env[key]?.trim());
  return { ready: missing.length === 0, missing };
}

export function whatsappNumber(value) {
  const digits = String(value || '').replace(/\D/g, '');
  const international = /^9\d{8}$/.test(digits) ? `51${digits}` : digits;
  return /^\d{10,15}$/.test(international) ? international : null;
}

export function providerTemplateValues(quote, item) {
  const event = quote.public_payload.event;
  return [
    String(event.eventType),
    String(event.date || event.datePreference || 'Por definir'),
    String(event.city),
    String(event.guestCount),
    `${item.category}: ${item.packageName}`,
    String(quote.request_code),
  ];
}

export function customerTemplateValues(quote) {
  const payload = quote.public_payload;
  return [
    String(payload.event.eventType),
    String(payload.event.date || payload.event.datePreference || 'Por definir'),
    payload.services.join(', ').slice(0, 200),
    `S/ ${Number(payload.proposal.total).toFixed(2)}`,
    String(quote.request_code),
  ];
}

export async function sendWhatsappTemplate(to, audience, values, env = process.env, fetcher = fetch) {
  const config = whatsappConfiguration(env);
  if (!config.ready) throw new QuoteInputError('Configura WhatsApp Business y sus plantillas antes de enviar mensajes.', 503);
  const number = whatsappNumber(to);
  if (!number) throw new QuoteInputError('Este contacto no tiene un WhatsApp válido. Corrige el número antes de enviar.');
  const version = /^v\d+\.\d+$/.test(env.WHATSAPP_API_VERSION || '') ? env.WHATSAPP_API_VERSION : 'v27.0';
  const name = audience === 'provider' ? env.WHATSAPP_PROVIDER_TEMPLATE : env.WHATSAPP_CUSTOMER_TEMPLATE;
  const response = await fetcher(`https://graph.facebook.com/${version}/${env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.WHATSAPP_ACCESS_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', to: number, type: 'template', template: {
      name, language: { code: env.WHATSAPP_TEMPLATE_LANGUAGE || 'es_PE' },
      components: [{ type: 'body', parameters: values.map(value => ({ type: 'text', text: String(value) })) }],
    } }),
    signal: AbortSignal.timeout(15000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.messages?.[0]?.id) throw new QuoteInputError('WhatsApp no aceptó el mensaje. Revisa la plantilla y el número antes de reintentar.', 502);
  return data.messages[0].id;
}
