import { createClient } from '@supabase/supabase-js';

export class ApiAuthError extends Error {
  constructor(message, status = 401) { super(message); this.status = status; }
}

export function supabaseConfig(env = process.env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL;
  const publishable = env.SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const secret = env.SUPABASE_SECRET_KEY;
  return { url, publishable, secret };
}

export function supabaseClients(env = process.env) {
  const { url, publishable, secret } = supabaseConfig(env);
  if (!url || !publishable || !secret) throw new ApiAuthError('Configura Supabase para usar cuentas y administración.', 503);
  const options = { auth: { autoRefreshToken: false, persistSession: false } };
  return { auth: createClient(url, publishable, options), db: createClient(url, secret, options) };
}

export async function authenticatedRequest(request, env = process.env) {
  const token = /^Bearer (\S+)$/i.exec(request.headers.authorization || '')?.[1];
  if (!token) throw new ApiAuthError('Inicia sesión para continuar.');
  const clients = supabaseClients(env);
  const { data, error } = await clients.auth.auth.getUser(token);
  if (error || !data.user || !data.user.email_confirmed_at) throw new ApiAuthError('Tu sesión no es válida o falta verificar tu correo.');
  return { ...clients, user: data.user };
}

export async function administratorRequest(request, env = process.env) {
  const context = await authenticatedRequest(request, env);
  const { data, error } = await context.db.from('admin_users').select('user_id').eq('user_id', context.user.id).maybeSingle();
  if (error) throw new ApiAuthError('No se pudo comprobar el acceso administrativo.', 503);
  if (!data) throw new ApiAuthError('Esta cuenta no tiene acceso al panel.', 403);
  return context;
}
