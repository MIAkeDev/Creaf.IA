import test from 'node:test';
import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { mkdtemp, rm, readdir, readFile } from 'node:fs/promises';
import { resolve, join, sep } from 'node:path';
import { Readable } from 'node:stream';
import sharp from 'sharp';
import { createImageStore, MAX_IMAGE_BYTES } from './providers/images.mjs';
import { createProviderStore } from './providers/store.mjs';
import { createProviderApi } from './providers/api.mjs';
import { createEventState } from '../shared/event-state.mjs';

async function isolated(run) {
  const root = resolve('output'); const directory = await mkdtemp(join(root, 'image-tests-'));
  try {
    const images = createImageStore(join(directory, 'images')); const store = createProviderStore(join(directory, 'providers.json'));
    await run({ images, store, directory, api: createProviderApi({ images, store, authorizeAdmin: async () => ({}) }) });
  } finally {
    assert(directory.startsWith(root + sep) && directory.split(sep).at(-1).startsWith('image-tests-'));
    await rm(directory, { recursive: true, force: true });
  }
}
async function invoke(api, method, path, body = Buffer.alloc(0), headers = {}) {
  const request = Readable.from(body.length ? [body] : []);
  Object.assign(request, { method, url: path, headers: { host: 'localhost:5173', 'content-type': 'image/png', ...headers } });
  const response = { writeHead(status, headers) { this.status = status; this.headers = headers; }, end(body) { this.body = this.headers['Content-Type'].startsWith('application/json') ? JSON.parse(body) : body; } };
  await api(request, response, () => { response.next = true; }); return response;
}
const png = () => sharp({ create: { width: 80, height: 60, channels: 4, background: { r: 30, g: 140, b: 150, alpha: .4 } } }).png().toBuffer();

test('la foto almacenada no se entrega sin autorización administrativa', async () => isolated(async ({ images, store }) => {
  const api = createProviderApi({ images, store });
  const response = await invoke(api, 'GET', '/api/provider-images/123e4567-e89b-42d3-a456-426614174000.webp');
  assert.equal(response.status, 401);
}));

test('subida PNG persiste WebP, conserva transparencia y no amplía fotos pequeñas', async () => isolated(async ({ api, directory, images }) => {
  const source = await png(); const upload = await invoke(api, 'POST', '/api/admin/provider-images', source);
  assert.equal(upload.status, 201); const image = upload.body.image;
  assert.match(image.source, /^\/api\/provider-images\/[a-f0-9-]{36}\.webp$/);
  assert.equal(image.originalBytes, source.length); assert.equal(image.width, 80); assert.equal(image.height, 60);
  const bytes = await images.read(image.source); const metadata = await sharp(bytes).metadata();
  assert.equal(metadata.format, 'webp'); assert.equal(metadata.hasAlpha, true); assert.equal(image.bytes, bytes.length);
  assert.equal((await readdir(join(directory, 'images'))).length, 1);
  const served = await invoke(api, 'GET', image.source);
  assert.equal(served.status, 200); assert.equal(served.headers['Content-Type'], 'image/webp'); assert.deepEqual(served.body, bytes);
}));

test('normaliza orientación EXIF, limita tamaño a 1600 y elimina metadatos', async () => isolated(async ({ images }) => {
  const jpeg = await sharp({ create: { width: 2400, height: 1200, channels: 3, background: '#498b9a' } }).withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const image = await images.save(jpeg); const metadata = await sharp(await images.read(image.source)).metadata();
  assert.equal(image.width, 800); assert.equal(image.height, 1600); assert.equal(metadata.exif, undefined); assert.equal(metadata.icc, undefined); assert.equal(metadata.orientation, undefined);
}));

test('optimización reduce el peso de una foto PNG con detalle', async () => isolated(async ({ images }) => {
  const source = await sharp(randomBytes(1200 * 800 * 3), { raw: { width: 1200, height: 800, channels: 3 } }).png().toBuffer();
  const image = await images.save(source);
  assert(image.bytes < source.length); assert.equal(image.originalBytes, source.length);
}));

test('rechaza archivos falsos, SVG, fotos truncadas y cargas vacías sin guardar archivos', async () => isolated(async ({ api, directory }) => {
  for (const body of [Buffer.from('no es una imagen'), Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"/>'), (await png()).subarray(0, 25), Buffer.alloc(0)]) {
    const response = await invoke(api, 'POST', '/api/admin/provider-images', body);
    assert.equal(response.status, 400);
  }
  assert.deepEqual(await readdir(directory), []);
}));

test('valida MIME y tamaño declarado y real antes de persistir', async () => isolated(async ({ api, directory }) => {
  assert.equal((await invoke(api, 'POST', '/api/admin/provider-images', await png(), { 'content-type': 'text/html' })).status, 400);
  assert.equal((await invoke(api, 'POST', '/api/admin/provider-images', await png(), { 'content-length': String(MAX_IMAGE_BYTES + 1) })).status, 400);
  assert.equal((await invoke(api, 'POST', '/api/admin/provider-images', Buffer.alloc(MAX_IMAGE_BYTES + 1))).status, 400);
  assert.deepEqual(await readdir(directory), []);
}));

test('subidas de otro origen se rechazan y las rutas no permiten traversal', async () => isolated(async ({ api, images }) => {
  assert.equal((await invoke(api, 'POST', '/api/admin/provider-images', await png(), { origin: 'https://externo.example' })).status, 403);
  await assert.rejects(images.read('/api/provider-images/../../.env.local'));
  assert.equal((await invoke(api, 'GET', '/api/provider-images/00000000-0000-0000-0000-000000000000.webp')).status, 404);
  assert.equal((await invoke(api, 'DELETE', '/api/admin/provider-images')).status, 405);
}));

test('subidas simultáneas tienen nombres distintos y admiten WebP como entrada', async () => isolated(async ({ images, directory }) => {
  const source = await png(); const photos = await Promise.all([images.save(source), images.save(source)]);
  assert.notEqual(photos[0].source, photos[1].source);
  const third = await images.save(await images.read(photos[0].source));
  assert.equal(third.width, 80); assert.equal((await readdir(join(directory, 'images'))).length, 3);
}));

test('proveedor guarda la referencia de foto y el detalle público usa el proxy', async () => isolated(async ({ api, store, directory }) => {
  const uploaded = (await invoke(api, 'POST', '/api/admin/provider-images', await png())).body.image;
  const provider = await store.create({ businessName: 'Negocio de prueba', category: 'Bartender / bebidas', city: 'Ilo', active: true, verified: false, coverImage: uploaded.source, evidenceImages: [uploaded.source], services: [{ id: 'bar', name: 'Barra libre', priceFrom: 200, eventTypes: ['babyShower'], guestMin: 10, guestMax: 25, includes: [], styles: [] }] });
  assert.equal((await createProviderStore(join(directory, 'providers.json')).list())[0].coverImage, uploaded.source);
  const state = { event: { ...createEventState(), eventType: 'babyShower', date: '2026-12-18', guestCount: 20, budget: 5000, selectedServices: ['Bartender'] }, expectedField: null, eventDateParts: {}, ambiguities: [] };
  const result = await invoke(api, 'POST', '/api/proposals', Buffer.from(JSON.stringify({ conversationState: state })), { 'content-type': 'application/json' });
  assert.equal(result.status, 200);
  const preview = result.body.proposals[0].providers[0];
  assert.equal(preview.evidenceImage, `/api/proposal-images/${provider.id}/0`);
  assert(!JSON.stringify(result.body).includes(uploaded.source));
  const publicImage = await invoke(api, 'GET', preview.evidenceImage);
  assert.equal(publicImage.status, 200); assert.equal(publicImage.headers['Content-Type'], 'image/webp');
  assert.deepEqual(publicImage.body, await readFile(join(directory, 'images', uploaded.source.split('/').at(-1))));
}));
