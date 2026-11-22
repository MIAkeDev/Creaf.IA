import { authenticatedRequest, administratorRequest, ApiAuthError } from '../supabase.mjs';
import { buildQuote, QuoteInputError, providerWhatsappUrl, customerWhatsappUrl } from './logic.mjs';
import { buildGeneratedQuote } from './generated.mjs';
import { whatsappConfiguration, whatsappNumber, providerTemplateValues, customerTemplateValues, sendWhatsappTemplate } from './whatsapp.mjs';

function send(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}
async function jsonBody(req) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new QuoteInputError('La solicitud debe ser JSON.');
  if (req.body !== undefined) {
    if (Buffer.byteLength(JSON.stringify(req.body)) > 100000) throw new QuoteInputError('Solicitud demasiado grande.');
    return req.body;
  }
  const parts = []; let length = 0;
  for await (const part of req) { length += Buffer.byteLength(part); if (length > 100000) throw new QuoteInputError('Solicitud demasiado grande.'); parts.push(Buffer.from(part)); }
  try { return JSON.parse(Buffer.concat(parts).toString('utf8')); } catch { throw new QuoteInputError('JSON no válido.'); }
}
async function privateRow(db, id) {
  const { data, error } = await db.from('quotation_private').select('*').eq('quotation_id', id).maybeSingle();
  if (error) throw error;
  return data;
}
export function createQuoteApi({ store, authenticate = authenticatedRequest, authorize = administratorRequest, sendWhatsapp = sendWhatsappTemplate, getWhatsappConfig = whatsappConfiguration } = {}) {
  return async (req, res, next) => {
    const path = req.url?.split('?')[0];
    const adminItem = path?.match(/^\/api\/admin\/quotes\/([0-9a-f-]{36})$/i);
    const adminAction = path?.match(/^\/api\/admin\/quotes\/([0-9a-f-]{36})\/(notify-providers|confirm|notify-customer)$/i);
    if (!['/api/me', '/api/quotes', '/api/admin/quotes', '/api/quotes/generated', '/api/admin/generated-quotes'].includes(path) && !adminItem && !adminAction) return next();
    try {
      if (path === '/api/me' && req.method === 'GET') {
        const context = await authenticate(req);
        const { data } = await context.db.from('admin_users').select('user_id').eq('user_id', context.user.id).maybeSingle();
        return send(res, 200, { user: { id: context.user.id, email: context.user.email, name: context.user.user_metadata?.full_name || context.user.user_metadata?.name || '' }, isAdmin: !!data });
      }
      if (path === '/api/quotes' && req.method === 'GET') {
        const { db, user } = await authenticate(req);
        const { data, error } = await db.from('quotations').select('id,request_code,public_payload,state,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        return send(res, 200, { quotations: data });
      }
      if (path === '/api/quotes/generated' && req.method === 'GET') {
        const { db, user } = await authenticate(req);
        const { data, error } = await db.from('generated_quotes').select('id,event,proposals,created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        return send(res, 200, { generatedQuotes: data });
      }
      if (path === '/api/quotes/generated' && req.method === 'POST') {
        const { db, user } = await authenticate(req);
        const quote = buildGeneratedQuote(await jsonBody(req), await store.list(), user);
        if (!quote) return send(res, 200, { saved: false });
        const { error } = await db.from('generated_quotes').upsert(quote, { onConflict: 'user_id,fingerprint', ignoreDuplicates: true });
        if (error) throw error;
        return send(res, 200, { saved: true });
      }
      if (path === '/api/quotes' && req.method === 'POST') {
        const { db, user } = await authenticate(req);
        const body = await jsonBody(req);
        if (!body || typeof body.idempotencyKey !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.idempotencyKey)) throw new QuoteInputError('Clave de solicitud no válida.');
        const { data: previous, error: previousError } = await db.from('quotations').select('id,request_code,public_payload,state,created_at').eq('user_id', user.id).eq('idempotency_key', body.idempotencyKey).maybeSingle();
        if (previousError) throw previousError;
        if (previous && await privateRow(db, previous.id)) return send(res, 200, { quotation: previous });
        if (previous) throw new QuoteInputError('La solicitud se está guardando. Vuelve a intentar en unos segundos.', 409);
        const { count, error: countError } = await db.from('quotations').select('id', { count: 'exact', head: true }).eq('user_id', user.id).gte('created_at', new Date(Date.now() - 3600000).toISOString());
        if (countError) throw countError;
        if ((count ?? 0) >= 5) throw new QuoteInputError('Puedes enviar hasta cinco solicitudes por hora. Inténtalo más tarde.', 429);
        const quote = buildQuote(body, await store.list(), user);
        const { data: inserted, error: insertError } = await db.rpc('create_quotation_atomic', {
          p_user_id: user.id,
          p_idempotency_key: quote.idempotencyKey,
          p_request_code: quote.code,
          p_public_payload: quote.publicPayload,
          p_snapshot: quote.privateSnapshot,
          p_customer_whatsapp: quote.whatsapp,
          p_consent_at: new Date().toISOString(),
        });
        if (insertError) {
          if (insertError.code === '23505') {
            const { data: retry } = await db.from('quotations').select('id,request_code,public_payload,state,created_at').eq('user_id', user.id).eq('idempotency_key', quote.idempotencyKey).maybeSingle();
            if (retry && await privateRow(db, retry.id)) return send(res, 200, { quotation: retry });
          }
          throw insertError;
        }
        return send(res, 201, { quotation: inserted });
      }
      if (path === '/api/admin/quotes' && req.method === 'GET') {
        const { db } = await authorize(req);
        const { data, error } = await db.from('quotations').select('id,user_id,request_code,public_payload,state,created_at').order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        return send(res, 200, { quotations: data });
      }
      if (path === '/api/admin/generated-quotes' && req.method === 'GET') {
        const { db } = await authorize(req);
        const { data, error } = await db.from('generated_quotes').select('id,user_id,customer_email,customer_name,event,proposals,created_at').order('created_at', { ascending: false }).limit(100);
        if (error) throw error;
        return send(res, 200, { generatedQuotes: data });
      }
      if (adminItem || adminAction) {
        const { db } = await authorize(req);
        const id = (adminItem || adminAction)[1];
        const { data: quotation, error } = await db.from('quotations').select('*').eq('id', id).maybeSingle();
        if (error) throw error;
        if (!quotation) return send(res, 404, { error: 'Solicitud no encontrada.' });
        const detail = await privateRow(db, id);
        if (!detail) return send(res, 409, { error: 'El detalle de esta solicitud no está disponible.' });
        const configuration = getWhatsappConfig();
        async function saveProviderStatus(next) {
          const { error: updateError } = await db.from('quotation_private').update({ provider_status: next }).eq('quotation_id', id);
          if (updateError) throw updateError;
          detail.provider_status = next;
        }
        async function notifyCustomer() {
          const current = detail.provider_status || {};
          if (current.$customer?.whatsappMessageId) return { sent: false, alreadySent: true };
          if (!configuration.ready) throw new QuoteInputError('Configura WhatsApp Business antes de confirmar o enviar mensajes.', 503);
          const messageId = await sendWhatsapp(detail.customer_whatsapp, 'customer', customerTemplateValues(quotation));
          await saveProviderStatus({ ...current, $customer: { whatsappMessageId: messageId, whatsappSentAt: new Date().toISOString() } });
          return { sent: true, alreadySent: false };
        }
        if (adminAction && req.method === 'POST') {
          const action = adminAction[2];
          if (action === 'notify-providers') {
            if (!configuration.ready) throw new QuoteInputError('Configura WhatsApp Business antes de contactar proveedores.', 503);
            const body = await jsonBody(req);
            if (!body || typeof body !== 'object' || Array.isArray(body) || Object.keys(body).some(key => key !== 'providerKey') || (body.providerKey !== undefined && typeof body.providerKey !== 'string')) throw new QuoteInputError('Selección de proveedores no válida.');
            const items = body.providerKey ? detail.snapshot.items.filter(item => `${item.providerId}:${item.serviceId}` === body.providerKey) : detail.snapshot.items;
            if (!items.length) throw new QuoteInputError('No se encontró ese proveedor en la solicitud.');
            const result = { sent: [], alreadySent: [], failed: [] };
            for (const item of items) {
              const key = `${item.providerId}:${item.serviceId}`;
              const current = detail.provider_status || {};
              if (current[key]?.whatsappMessageId) { result.alreadySent.push(key); continue; }
              if (!whatsappNumber(item.whatsapp || item.phone)) { result.failed.push({ key, reason: 'Sin WhatsApp válido' }); continue; }
              try {
                const messageId = await sendWhatsapp(item.whatsapp || item.phone, 'provider', providerTemplateValues(quotation, item));
                await saveProviderStatus({ ...current, [key]: { ...current[key], status: current[key]?.status === 'available' ? 'available' : 'consulted', updatedAt: new Date().toISOString(), whatsappMessageId: messageId, whatsappSentAt: new Date().toISOString() } });
                result.sent.push(key);
              } catch (error) { result.failed.push({ key, reason: error instanceof QuoteInputError ? error.message : 'No se pudo enviar' }); }
            }
            if (result.sent.length && quotation.state === 'received') {
              const { error: updateError } = await db.from('quotations').update({ state: 'coordinating', updated_at: new Date().toISOString() }).eq('id', id);
              if (updateError) throw updateError;
            }
            return send(res, 200, result);
          }
          if (action === 'confirm') {
            if (quotation.state === 'closed') throw new QuoteInputError('Esta solicitud está cerrada.');
            if (!detail.snapshot.items.length || detail.snapshot.items.some(item => detail.provider_status?.[`${item.providerId}:${item.serviceId}`]?.status !== 'available')) throw new QuoteInputError('Marca todos los proveedores como disponibles antes de confirmar.');
            const confirmBody = await jsonBody(req);
            if (!confirmBody || typeof confirmBody !== 'object' || Array.isArray(confirmBody) || Object.keys(confirmBody).some(key => key !== 'delivery') || (confirmBody.delivery !== undefined && confirmBody.delivery !== 'manual')) throw new QuoteInputError('Forma de confirmación no válida.');
            const manual = confirmBody.delivery === 'manual';
            const customerLink = customerWhatsappUrl(quotation, detail.customer_whatsapp);
            if (manual && !customerLink) throw new QuoteInputError('El cliente no tiene un WhatsApp válido.');
            if (!manual && !configuration.ready) throw new QuoteInputError('Configura WhatsApp Business antes de confirmar y avisar al cliente.', 503);
            if (!whatsappNumber(detail.customer_whatsapp)) throw new QuoteInputError('El cliente no tiene un WhatsApp válido.');
            if (quotation.state !== 'completed') {
              const { error: updateError } = await db.from('quotations').update({ state: 'completed', updated_at: new Date().toISOString() }).eq('id', id);
              if (updateError) throw updateError;
              quotation.state = 'completed';
            }
            if (manual) return send(res, 200, { state: 'completed', customerWhatsappUrl: customerLink, customerNotification: { sent: false, manual: true } });
            try { return send(res, 200, { state: 'completed', customerNotification: await notifyCustomer() }); }
            catch { return send(res, 200, { state: 'completed', customerNotification: { sent: false, failed: true }, warning: 'La solicitud quedó confirmada, pero WhatsApp no aceptó el aviso. Reintenta el mensaje al cliente.' }); }
          }
          if (action === 'notify-customer') {
            if (quotation.state !== 'completed') throw new QuoteInputError('Confirma la solicitud antes de avisar al cliente.');
            return send(res, 200, { customerNotification: await notifyCustomer() });
          }
        }
        if (adminItem && req.method === 'GET') {
          return send(res, 200, { quotation, whatsapp: configuration, customerWhatsappUrl: customerWhatsappUrl(quotation, detail.customer_whatsapp), detail: { ...detail, snapshot: { ...detail.snapshot, items: detail.snapshot.items.map(item => ({ ...item, whatsappUrl: providerWhatsappUrl(quotation, item) })) } } });
        }
        if (adminItem && req.method === 'PATCH') {
          const body = await jsonBody(req);
          if (body && Object.keys(body).length === 1 && ['received', 'coordinating', 'awaiting_customer', 'closed'].includes(body.state)) {
            const { error: updateError } = await db.from('quotations').update({ state: body.state, updated_at: new Date().toISOString() }).eq('id', id);
            if (updateError) throw updateError;
            return send(res, 200, { state: body.state });
          }
          if (body && Object.keys(body).length === 2 && typeof body.providerKey === 'string' && ['pending', 'consulted', 'available', 'unavailable'].includes(body.status)) {
            if (!detail.snapshot.items.some(item => `${item.providerId}:${item.serviceId}` === body.providerKey)) throw new QuoteInputError('Proveedor no incluido en la solicitud.');
            const prior = detail.provider_status || {};
            const providerStatus = { ...prior, [body.providerKey]: { ...prior[body.providerKey], status: body.status, updatedAt: new Date().toISOString() } };
            await saveProviderStatus(providerStatus);
            return send(res, 200, { providerStatus });
          }
          throw new QuoteInputError('Cambio no válido.');
        }
      }
      return send(res, 405, { error: 'Método no permitido.' });
    } catch (error) {
      return send(res, error instanceof ApiAuthError || error instanceof QuoteInputError ? error.status : 503, { error: error instanceof ApiAuthError || error instanceof QuoteInputError ? error.message : 'No se pudo completar la solicitud. Inténtalo de nuevo.' });
    }
  };
}
