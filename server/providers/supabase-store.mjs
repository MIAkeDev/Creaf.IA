import { randomUUID } from 'node:crypto';
import { validateProvider } from '../../shared/provider-validation.mjs';
import { stampProviderPrices } from '../../shared/pricing.mjs';
import { supabaseClients } from '../supabase.mjs';

export function createSupabaseProviderStore(env = process.env) {
  const db = () => supabaseClients(env).db;
  async function list() {
    const { data, error } = await db().from('provider_records').select('record').order('id');
    if (error) throw new Error('No se pudo cargar el catálogo.', { cause: error });
    return data.map(row => validateProvider(row.record));
  }
  async function save(value, id, previous = null) {
    const provider = stampProviderPrices(validateProvider({ ...value, id }), previous);
    const { error } = await db().from('provider_records').upsert({ id, record: provider, updated_at: new Date().toISOString() });
    if (error) throw new Error('No se pudo guardar el proveedor.', { cause: error });
    return provider;
  }
  return {
    list,
    create(value) { return save(value, randomUUID()); },
    async update(id, value) {
      const { data, error } = await db().from('provider_records').select('record').eq('id', id).maybeSingle();
      if (error) throw error;
      return data ? save(value, id, validateProvider(data.record)) : null;
    },
    async remove(id) {
      const { data, error } = await db().from('provider_records').delete().eq('id', id).select('id');
      if (error) throw error;
      return !!data?.length;
    },
  };
}
