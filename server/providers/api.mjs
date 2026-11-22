import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { ProviderValidationError, IMAGE_HOSTS } from '../../shared/provider-validation.mjs';
import { validateConversationState, dateFromParts } from '../../shared/conversation-state.mjs';
import { getEventStatus } from '../../shared/event-state.mjs';
import { generateProposals } from '../proposals/proposalEngine.mjs';
import { createProviderStore } from './store.mjs';
import { serviceOptions } from './service-options.mjs';
import { createImageStore, readImageUpload, uploadedImageName } from './images.mjs';
import { ApiAuthError, administratorRequest } from '../supabase.mjs';

const publicRoot = fileURLToPath(new URL('../../public', import.meta.url));
function send(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}
async function bodyOf(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new ProviderValidationError('La solicitud debe ser JSON.');
  if (request.body !== undefined) {
    if (Buffer.byteLength(JSON.stringify(request.body)) > 200000) throw new ProviderValidationError('El formulario es demasiado grande.');
    return request.body;
  }
  const chunks = []; let size = 0;
  for await (const chunk of request) { size += Buffer.byteLength(chunk); if (size > 200000) throw new ProviderValidationError('El formulario es demasiado grande.'); chunks.push(Buffer.from(chunk)); }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new ProviderValidationError('JSON no válido.'); }
}
function localRequest(request) {
  try {
    const host = request.headers['x-forwarded-host'] || request.headers.host;
    if (!host) return false;
    if (request.headers.origin) { const origin = new URL(request.headers.origin); if (origin.host !== host || !['http:', 'https:'].includes(origin.protocol)) return false; }
    return true;
  } catch { return false; }
}
async function imageResponse(source, response, images) {
  let bytes; let mime;
  if (uploadedImageName(source)) {
    bytes = await images.read(source); mime = 'image/webp';
  } else if (source.startsWith('/')) {
    const path = resolve(publicRoot, `.${decodeURIComponent(source)}`);
    if (!path.startsWith(publicRoot + sep)) throw new Error('Invalid image path');
    bytes = await readFile(path);
    mime = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' }[extname(path).toLowerCase()];
  } else {
    const url = new URL(source);
    if (url.protocol !== 'https:' || !IMAGE_HOSTS.includes(url.hostname)) throw new Error('Invalid image host');
    const result = await fetch(url, { redirect: 'error', signal: AbortSignal.timeout(7000) });
    mime = result.headers.get('content-type')?.split(';')[0];
    if (!result.ok || !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(mime)) throw new Error('Invalid image response');
    const chunks = []; let size = 0;
    for await (const chunk of result.body) { size += chunk.length; if (size > 5000000) throw new Error('Image too large'); chunks.push(chunk); }
    bytes = Buffer.concat(chunks);
  }
  if (!mime || bytes.length > 5000000) throw new Error('Invalid image');
  response.writeHead(200, { 'Content-Type': mime, 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; sandbox", 'Cache-Control': 'no-store' }); response.end(bytes);
}

export function createProviderApi({ store = createProviderStore(), images = createImageStore(), authorizeAdmin = administratorRequest, defaultMarkupPercent = 10 } = {}) {
  const applyDefaultMarkup = body => body && Array.isArray(body.services) ? { ...body, services: body.services.map(service => service && service.providerCost !== undefined && service.markupValue === undefined ? { ...service, markupValue: defaultMarkupPercent } : service) } : body;
  return async (request, response, next) => {
    const path = request.url?.split('?')[0];
    const collection = path === '/api/admin/providers';
    const item = path?.match(/^\/api\/admin\/providers\/([a-zA-Z0-9_-]{1,80})$/);
    const media = path?.match(/^\/api\/proposal-images\/([a-zA-Z0-9_-]{1,80})\/(\d)$/);
    const upload = path === '/api/admin/provider-images';
    const storedImage = path && uploadedImageName(path);
    if (!collection && !item && !media && !upload && !storedImage && path !== '/api/proposals' && path !== '/api/service-options' && path !== '/api/admin/pricing') return next();
    if (!localRequest(request)) return send(response, 403, { error: 'Origen no permitido.' });
    try {
      if (collection || item || upload || storedImage || path === '/api/admin/pricing') await authorizeAdmin(request);
      if (path === '/api/admin/pricing' && request.method === 'GET') return send(response, 200, { defaultMarkupPercent });
      if (upload && request.method === 'POST') return send(response, 201, { image: await images.save(await readImageUpload(request)) });
      if (storedImage && request.method === 'GET') {
        try { await imageResponse(path, response, images); } catch { send(response, 404, { error: 'Imagen no disponible.' }); } return;
      }
      if (path === '/api/service-options' && request.method === 'GET') {
        const query = new URL(request.url, 'http://localhost').searchParams;
        const eventType = query.get('eventType'); const city = query.get('city') || '';
        const guestCount = query.has('guestCount') ? Number(query.get('guestCount')) : undefined;
        if (!eventType || eventType.length > 100 || city.length > 100 || (guestCount !== undefined && (!Number.isInteger(guestCount) || guestCount < 1 || guestCount > 100000))) throw new ProviderValidationError('Los filtros de servicios no son válidos.');
        return send(response, 200, serviceOptions(await store.list(), { eventType, city, guestCount }));
      }
      if (media && request.method === 'GET') {
        const record = (await store.list()).find(provider => provider.id === media[1] && provider.active);
        const source = record && [...new Set([record.coverImage, ...record.evidenceImages].filter(Boolean))][Number(media[2])];
        if (!source) return send(response, 404, { error: 'Imagen no disponible.' });
        try { await imageResponse(source, response, images); } catch { send(response, 404, { error: 'Imagen no disponible.' }); } return;
      }
      if (path === '/api/proposals' && request.method === 'POST') {
        const body = await bodyOf(request);
        if (!body || typeof body !== 'object' || Object.keys(body).some(key => !['conversationState', 'allowAlternatives'].includes(key))) throw new ProviderValidationError('Solicitud de propuestas no válida.');
        let conversation;
        try { conversation = validateConversationState(body.conversationState); } catch { throw new ProviderValidationError('Los requisitos del evento no son válidos.'); }
        if (getEventStatus(conversation.event) !== 'ready' || conversation.ambiguities.length || Object.keys(conversation.eventDateParts).length) return send(response, 409, { error: 'Completa los requisitos y las aclaraciones antes de buscar propuestas.' });
        const date = conversation.event.date;
        if (date !== null) {
          const [year, month, day] = date.split('-').map(Number);
          if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || dateFromParts({ year, month, day }) !== date) throw new ProviderValidationError('Confirma una fecha completa y válida antes de comparar opciones.');
        }
        if (body.allowAlternatives !== undefined && typeof body.allowAlternatives !== 'boolean') throw new ProviderValidationError('Alternativas no válidas.');
        return send(response, 200, generateProposals(conversation.event, await store.list(), { allowAlternatives: body.allowAlternatives === true }));
      }
      if (collection && request.method === 'GET') return send(response, 200, { providers: await store.list() });
      if (collection && request.method === 'POST') return send(response, 201, { provider: await store.create(applyDefaultMarkup(await bodyOf(request))) });
      if (item && request.method === 'PUT') {
        const provider = await store.update(item[1], applyDefaultMarkup(await bodyOf(request)));
        return send(response, provider ? 200 : 404, provider ? { provider } : { error: 'Proveedor no encontrado.' });
      }
      if (item && request.method === 'DELETE') {
        const removed = await store.remove(item[1]); return send(response, removed ? 200 : 404, removed ? { removed: true } : { error: 'Proveedor no encontrado.' });
      }
      return send(response, 405, { error: 'Método no permitido.' });
    } catch (error) {
      return send(response, error instanceof ApiAuthError ? error.status : error instanceof ProviderValidationError ? 400 : 500, { error: error instanceof ApiAuthError || error instanceof ProviderValidationError ? error.message : upload ? 'No se pudo guardar la foto. Inténtalo de nuevo.' : 'No se pudo acceder al catálogo. Revisa el archivo de proveedores y vuelve a intentar.' });
    }
  };
}
