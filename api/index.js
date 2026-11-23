/* global process, URL */
import { createChatHandler } from '../server/chat.mjs';
import { createProviderApi } from '../server/providers/api.mjs';
import { createSupabaseProviderStore } from '../server/providers/supabase-store.mjs';
import { serviceOptions } from '../server/providers/service-options.mjs';
import { createSupabaseImageStore } from '../server/providers/images.mjs';
import { supabaseClients, administratorRequest, authenticatedRequest } from '../server/supabase.mjs';
import { createQuoteApi } from '../server/quotes/api.mjs';
import { sendWhatsappTemplate, whatsappConfiguration } from '../server/quotes/whatsapp.mjs';
import { configuredMarkup } from '../shared/pricing.mjs';
import { providerSearch } from '../server/proposals/providerSearch.mjs';

const env = process.env;
const store = createSupabaseProviderStore(env);
const imageStore = env.SUPABASE_SECRET_KEY ? createSupabaseImageStore(supabaseClients(env).db) : null;
const authorize = request => administratorRequest(request, env);
const routes = [
  createQuoteApi({ store, authenticate: request => authenticatedRequest(request, env), authorize, getWhatsappConfig: () => whatsappConfiguration(env), sendWhatsapp: (to, audience, values) => sendWhatsappTemplate(to, audience, values, env) }),
  createProviderApi({ store, images: imageStore, authorizeAdmin: authorize, defaultMarkupPercent: configuredMarkup(env.DEFAULT_MARKUP_PERCENT) }),
  createChatHandler(env, {
    loadServiceOptions: async event => serviceOptions(await store.list(), event),
    loadMinimumBudget: async event => {
      const cents = providerSearch(event, await store.list()).minimumTotal;
      return cents === null ? null : cents / 100;
    },
  }),
];

export default async function handler(request, response) {
  const route = request.query?.route;
  if (typeof route !== 'string' || !/^[a-zA-Z0-9_/-]+$/.test(route) || route.includes('..')) {
    response.status(404).json({ error: 'Ruta no encontrada.' }); return;
  }
  const original = new URL(request.url, 'https://creafia.invalid');
  original.searchParams.delete('route');
  request.url = `/api/${route}${original.search}`;
  let index = 0;
  const next = async () => {
    const middleware = routes[index++];
    if (middleware) await middleware(request, response, next);
    else if (!response.writableEnded) response.status(404).json({ error: 'Ruta no encontrada.' });
  };
  await next();
}
