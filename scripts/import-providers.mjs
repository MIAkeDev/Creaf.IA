import { readFile } from 'node:fs/promises';
import { createClient } from '@supabase/supabase-js';
import { loadEnv } from 'vite';
import { validateProvider } from '../shared/provider-validation.mjs';
import { uploadedImageName } from '../server/providers/images.mjs';

const localEnv = loadEnv('development', process.cwd(), '');
const url = process.env.SUPABASE_URL || localEnv.SUPABASE_URL;
const key = process.env.SUPABASE_SECRET_KEY || localEnv.SUPABASE_SECRET_KEY;
if (!url || !key) throw new Error('Configura SUPABASE_URL y SUPABASE_SECRET_KEY en el entorno del proceso.');
const records = JSON.parse(await readFile(new URL('../data/providers.json', import.meta.url), 'utf8')).map(validateProvider);
const db = createClient(url, key, { auth: { persistSession: false } });
const { data: existing, error: readError } = await db.from('provider_records').select('id');
if (readError) throw readError;
if (existing.length) throw new Error('La tabla provider_records ya contiene datos. No se sobrescribe automáticamente.');
const localNames = new Set(records.flatMap(record => [record.coverImage, ...record.evidenceImages]).map(source => uploadedImageName(source || '')).filter(Boolean));
for (const name of localNames) {
  const bytes = await readFile(new URL(`../data/provider-images/${name}`, import.meta.url));
  const { error: imageError } = await db.storage.from('provider-images').upload(name, bytes, { contentType: 'image/webp', upsert: false });
  if (imageError && String(imageError.statusCode) !== '409' && !/already exists|duplicate/i.test(imageError.message)) throw imageError;
}
const { error } = await db.from('provider_records').insert(records.map(record => ({ id: record.id, record })));
if (error) throw error;
console.log(`Importados ${records.length} proveedores y ${localNames.size} fotos sin modificar los precios públicos.`);
