import { defineConfig, loadEnv } from 'vite';
import { createChatHandler } from './server/chat.mjs';
import { createProviderApi } from './server/providers/api.mjs';
import { createProviderStore } from './server/providers/store.mjs';
import { serviceOptions } from './server/providers/service-options.mjs';
import { createSupabaseProviderStore } from './server/providers/supabase-store.mjs';
import { createImageStore, createSupabaseImageStore } from './server/providers/images.mjs';
import { supabaseClients, administratorRequest, authenticatedRequest } from './server/supabase.mjs';
import { createQuoteApi } from './server/quotes/api.mjs';
import { sendWhatsappTemplate, whatsappConfiguration } from './server/quotes/whatsapp.mjs';
import { configuredMarkup } from './shared/pricing.mjs';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const cloud = !!env.SUPABASE_SECRET_KEY;
  const store = cloud ? createSupabaseProviderStore(env) : createProviderStore();
  const images = cloud ? createSupabaseImageStore(supabaseClients(env).db) : createImageStore();
  const authorizeAdmin = request => administratorRequest(request, env);
  const quotes = createQuoteApi({ store, authenticate: request => authenticatedRequest(request, env), authorize: authorizeAdmin, getWhatsappConfig: () => whatsappConfiguration(env), sendWhatsapp: (to, audience, values) => sendWhatsappTemplate(to, audience, values, env) });
  const providers = createProviderApi({ store, images, authorizeAdmin, defaultMarkupPercent: configuredMarkup(env.DEFAULT_MARKUP_PERCENT) });
  const loadServiceOptions = async event => serviceOptions(await store.list(), event);
  return {
    server: {
      host: '127.0.0.1', port: 5173,
      fs: { deny: ['.env', '.env.*', '*.{crt,pem}', '**/.git/**', '**/server/**', '**/data/**'] },
    },
    preview: { host: '127.0.0.1', port: 4173 },
    plugins: [{
      name: 'creafia-local-api',
      configureServer(server) { server.middlewares.use(quotes); server.middlewares.use(providers); server.middlewares.use(createChatHandler(env, { loadServiceOptions })); },
      configurePreviewServer(server) { server.middlewares.use(quotes); server.middlewares.use(providers); server.middlewares.use(createChatHandler(env, { loadServiceOptions })); },
    }],
  };
});
