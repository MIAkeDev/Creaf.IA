import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { ProviderValidationError } from '../../shared/provider-validation.mjs';

export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_PIXELS = 40000000;
const MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);
export const uploadedImageName = source => source.match(/^\/api\/provider-images\/([a-f0-9-]{36}\.webp)$/)?.[1];

export async function readImageUpload(request) {
  if (!MIME_TYPES.has(request.headers['content-type']?.split(';')[0])) throw new ProviderValidationError('Selecciona una foto JPG, PNG o WebP.');
  if (Number(request.headers['content-length']) > MAX_IMAGE_BYTES) throw new ProviderValidationError('Cada foto puede pesar hasta 10 MB.');
  if (Buffer.isBuffer(request.body)) {
    if (!request.body.length || request.body.length > MAX_IMAGE_BYTES) throw new ProviderValidationError('Cada foto puede pesar hasta 10 MB.');
    return request.body;
  }
  const chunks = []; let size = 0;
  for await (const chunk of request) {
    size += Buffer.byteLength(chunk);
    if (size > MAX_IMAGE_BYTES) throw new ProviderValidationError('Cada foto puede pesar hasta 10 MB.');
    chunks.push(Buffer.from(chunk));
  }
  if (!size) throw new ProviderValidationError('La foto está vacía.');
  return Buffer.concat(chunks);
}

export async function optimizeImage(input) {
  if (!Buffer.isBuffer(input) || !input.length || input.length > MAX_IMAGE_BYTES) throw new ProviderValidationError('Selecciona una foto válida de hasta 10 MB.');
  let data; let info;
  try {
    const pipeline = sharp(input, { limitInputPixels: MAX_PIXELS, failOn: 'warning' });
    const metadata = await pipeline.metadata();
    if (!['jpeg', 'png', 'webp'].includes(metadata.format) || (metadata.pages ?? 1) > 1) throw new Error('Unsupported image');
    ({ data, info } = await pipeline.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 82, effort: 4 }).toBuffer({ resolveWithObject: true }));
  } catch {
    throw new ProviderValidationError('No pude procesar la foto. Usa un JPG, PNG o WebP estático válido de hasta 40 megapíxeles.');
  }
  if (data.length > 5000000) throw new ProviderValidationError('La foto optimizada sigue siendo demasiado grande. Prueba con otra imagen.');
  return { data, info };
}

export function createImageStore(directory = fileURLToPath(new URL('../../data/provider-images', import.meta.url))) {
  return {
    async save(input) {
      const { data, info } = await optimizeImage(input);
      const name = `${randomUUID()}.webp`;
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, name), data, { flag: 'wx' });
      return { source: `/api/provider-images/${name}`, originalBytes: input.length, bytes: data.length, width: info.width, height: info.height };
    },
    async read(source) {
      const name = uploadedImageName(source);
      if (!name) throw new Error('Invalid stored image');
      return readFile(join(directory, name));
    },
  };
}

export function createSupabaseImageStore(db) {
  const bucket = () => db.storage.from('provider-images');
  return {
    async save(input) {
      const { data, info } = await optimizeImage(input);
      const name = `${randomUUID()}.webp`;
      const { error } = await bucket().upload(name, data, { contentType: 'image/webp', cacheControl: '3600', upsert: false });
      if (error) throw new Error('No se pudo guardar la foto.', { cause: error });
      return { source: `/api/provider-images/${name}`, originalBytes: input.length, bytes: data.length, width: info.width, height: info.height };
    },
    async read(source) {
      const name = uploadedImageName(source);
      if (!name) throw new Error('Invalid stored image');
      const { data, error } = await bucket().download(name);
      if (error) throw error;
      return Buffer.from(await data.arrayBuffer());
    },
  };
}
