import { createClient } from '@supabase/supabase-js';
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';

const digest = bytes => createHash('sha256').update(bytes).digest('hex');
const outputDirectory = resolve('output/backups');
const passphrase = process.env.BACKUP_PASSPHRASE;
if (!passphrase || passphrase.length < 24) throw new Error('Configura BACKUP_PASSPHRASE con al menos 24 caracteres en el entorno.');

function key(salt) { return scryptSync(passphrase, salt, 32); }
function decrypt(archive) {
  if (archive.version !== 1) throw new Error('Versión de respaldo desconocida.');
  const decipher = createDecipheriv('aes-256-gcm', key(Buffer.from(archive.salt, 'base64')), Buffer.from(archive.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(archive.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(archive.data, 'base64')), decipher.final()]);
}

async function verify(path) {
  const archive = JSON.parse(await readFile(path, 'utf8'));
  const payload = JSON.parse(decrypt(archive).toString('utf8'));
  if (!Array.isArray(payload.providers) || !Array.isArray(payload.images)) throw new Error('Respaldo incompleto.');
  for (const image of payload.images) if (digest(Buffer.from(image.data, 'base64')) !== image.sha256) throw new Error('Imagen dañada en el respaldo.');
  console.log(`Respaldo íntegro: ${payload.providers.length} proveedores y ${payload.images.length} imágenes.`);
}

async function allImages(bucket, prefix = '') {
  const images = [];
  for (let offset = 0;; offset += 100) {
    const { data, error } = await bucket.list(prefix, { limit: 100, offset });
    if (error) throw new Error('No se pudo listar el almacenamiento de imágenes.', { cause: error });
    for (const entry of data) {
      const name = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.id === null) images.push(...await allImages(bucket, name));
      else {
        const result = await bucket.download(name);
        if (result.error) throw new Error('No se pudo respaldar una imagen.', { cause: result.error });
        const bytes = Buffer.from(await result.data.arrayBuffer());
        images.push({ name, sha256: digest(bytes), data: bytes.toString('base64') });
      }
    }
    if (data.length < 100) break;
  }
  return images;
}

async function backup() {
  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SECRET_KEY) throw new Error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY.');
  const db = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const providers = [];
  for (let offset = 0;; offset += 1000) {
    const { data, error } = await db.from('provider_records').select('id,record,updated_at').order('id').range(offset, offset + 999);
    if (error) throw new Error('No se pudo leer el catálogo.', { cause: error });
    providers.push(...data);
    if (data.length < 1000) break;
  }
  const images = await allImages(db.storage.from('provider-images'));
  const plain = Buffer.from(JSON.stringify({ version: 1, createdAt: new Date().toISOString(), providers, images }));
  const salt = randomBytes(16); const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(salt), iv);
  const encrypted = Buffer.concat([cipher.update(plain), cipher.final()]);
  const archive = { version: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), data: encrypted.toString('base64') };
  await mkdir(outputDirectory, { recursive: true });
  const path = join(outputDirectory, `providers-${new Date().toISOString().replace(/[:.]/g, '-')}.enc.json`);
  await writeFile(path, JSON.stringify(archive), { mode: 0o600, flag: 'wx' });
  await verify(path);
  console.log(`Guardado en ${path}. Copia este archivo cifrado fuera del equipo.`);
}

if (process.argv[2] === 'verify' && process.argv[3]) await verify(resolve(process.argv[3]));
else if (process.argv.length === 2) await backup();
else throw new Error('Uso: node --env-file=.env.local scripts/backup-provider-data.mjs [verify archivo.enc.json]');
