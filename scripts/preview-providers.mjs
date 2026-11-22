import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { readFile, writeFile, rename, mkdir, unlink } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, sep } from 'node:path';
import sharp from 'sharp';
import { validateProvider, PROVIDER_EVENT_TYPES } from '../shared/provider-validation.mjs';
import { createImageStore, uploadedImageName } from '../server/providers/images.mjs';
import { generateProposals } from '../server/proposals/proposalEngine.mjs';
import { createEventState } from '../shared/event-state.mjs';

const catalogFile = new URL('../data/providers.json', import.meta.url);
const manifestFile = new URL('../data/provider-preview.json', import.meta.url);
const imageDirectory = fileURLToPath(new URL('../data/provider-images', import.meta.url));
const action = process.argv[2];
if (!['add', 'remove', 'check'].includes(action)) throw new Error('Usa: node scripts/preview-providers.mjs add | check | remove');
const categories = [
  ['Local', 800, 'Salón para celebrar', ['Mesas y sillas', 'Espacio para pista de baile'], 'Iluminación ambiental', '<path d="M260 350V220l220-110 220 110v130M310 350V240h340v110M370 350v-75h220v75"/><path d="M240 350h480M330 220h300"/><circle cx="480" cy="170" r="18"/>'],
  ['Decoración', 400, 'Ambientación de celebración', ['Arco decorativo', 'Mesa principal'], 'Panel personalizado', '<ellipse cx="350" cy="180" rx="42" ry="55"/><ellipse cx="445" cy="145" rx="42" ry="55"/><ellipse cx="540" cy="180" rx="42" ry="55"/><path d="M350 235q80 10 95 110M445 200v145M540 235q-80 10-95 110M320 350h310M565 285h65v65h-65z"/>'],
  ['Catering', 900, 'Buffet para compartir', ['Servicio de buffet', 'Vajilla de servicio'], 'Mesa de aperitivos', '<path d="M290 305h380M315 290a165 140 0 0 1 330 0M280 330h400M465 135h30M480 135v20"/><path d="M340 110q-25 25 0 50M620 110q-25 25 0 50"/>'],
  ['Torta', 180, 'Torta de celebración', ['Decoración a elección', 'Base de presentación'], 'Porciones individuales adicionales', '<path d="M320 340v-90h320v90M365 250v-80h230v80M300 350h360M320 278q40 40 80 0t80 0t80 0t80 0M365 195q38 35 77 0t77 0t76 0M435 160v-35M480 160v-35M525 160v-35"/><path d="M435 105v-8M480 105v-8M525 105v-8"/>'],
  ['DJ / Música', 300, 'Música para tu celebración', ['Sonido', 'Selección musical'], 'Luces para la pista', '<rect x="265" y="200" width="430" height="145" rx="25"/><circle cx="370" cy="273" r="43"/><circle cx="590" cy="273" r="43"/><path d="M450 230v85M480 230v85M510 230v85M390 165v-55l70-15v55M390 165h-15M460 150h-15M565 155v-50l60-12v47M565 155h-12M625 140h-12"/>'],
  ['Fotografía', 250, 'Recuerdos en fotografía', ['Cobertura del evento', 'Galería digital'], 'Sesión de retratos', '<path d="M310 195h85l30-50h110l30 50h85v145H310z"/><circle cx="480" cy="265" r="65"/><circle cx="480" cy="265" r="38"/><path d="M585 220h30M330 170h45"/>'],
  ['Video', 250, 'Video de momentos especiales', ['Cobertura de video', 'Resumen editado'], 'Clip vertical para compartir', '<rect x="290" y="180" width="285" height="160" rx="25"/><path d="M575 230l95-45v145l-95-45M360 340l-35 35M510 340l35 35"/><circle cx="365" cy="130" r="40"/><circle cx="475" cy="130" r="40"/>'],
  ['Maestro de ceremonia', 180, 'Conducción de la celebración', ['Presentación de momentos', 'Coordinación del programa'], 'Dinámicas participativas', '<rect x="435" y="110" width="90" height="145" rx="45"/><path d="M400 195v25a80 80 0 0 0 160 0v-25M480 300v55M420 355h120M460 145h40M460 175h40M460 205h40"/>'],
  ['Bartender / bebidas', 220, 'Barra de bebidas para compartir', ['Preparación de bebidas', 'Opciones sin alcohol'], 'Carta personalizada de bebidas', '<path d="M330 155h300L480 285zM480 285v70M420 355h120M525 195l75-100M345 150l-35-45"/><circle cx="310" cy="105" r="38"/><path d="M405 185h150"/>'],
  ['Animación', 220, 'Momentos de diversión', ['Juegos dirigidos', 'Dinámicas para invitados'], 'Bloque temático adicional', '<path d="M350 325l85-155 115 155zM330 340h240M580 155l16 32 36 5-26 25 6 36-32-17-32 17 6-36-26-25 36-5zM315 175l-25-20M635 310l25 15M360 110l15 20"/><circle cx="430" cy="268" r="15"/><circle cx="465" cy="310" r="12"/>'],
];

async function readOptional(url) { try { return await readFile(url, 'utf8'); } catch (error) { if (error.code === 'ENOENT') return null; throw error; } }
const before = await readFile(catalogFile, 'utf8');
const records = JSON.parse(before); records.forEach(validateProvider);
const manifestText = await readOptional(manifestFile);
const manifest = manifestText ? JSON.parse(manifestText) : null;

async function writeCatalog(next) {
  if (await readFile(catalogFile, 'utf8') !== before) throw new Error('El catálogo cambió durante la operación. Inténtalo de nuevo para conservar la edición más reciente.');
  const temporary = new URL(`../data/providers.preview-${randomUUID()}.tmp`, import.meta.url);
  try { await writeFile(temporary, JSON.stringify(next, null, 2) + '\n'); await rename(temporary, catalogFile); }
  finally { await unlink(temporary).catch(() => {}); }
}

function check(current, ids) {
  assert.equal(current.filter(record => ids.includes(record.id)).length, 20);
  const cases = [];
  for (const eventType of ['cumpleaños', 'quinceañero', 'babyShower']) {
    for (const [guestCount, budget] of [[70, 5000], [500, 37400]]) {
      const event = { ...createEventState(), eventType, date: '2026-12-18', guestCount, budget, selectedServices: categories.map(item => item[0]), style: 'Elegante' };
      const result = generateProposals(event, current);
      assert.equal(result.proposals.length, 3); assert.deepEqual(result.missingCategories, []);
      assert(result.proposals.every(proposal => proposal.providers.length === 10));
      cases.push({ eventType, guestCount, budget, proposals: result.proposals.map(proposal => ({ type: proposal.type, total: proposal.total })) });
    }
  }
  return cases;
}

if (action === 'check') {
  if (!manifest) throw new Error('No hay un lote temporal registrado.');
  const cases = check(records, manifest.ids);
  for (const source of manifest.images) await createImageStore().read(source);
  console.log(JSON.stringify({ temporaryProviders: 20, cases, localImages: manifest.images.length }));
} else if (action === 'remove') {
  if (!manifest) throw new Error('No hay un lote temporal registrado para eliminar.');
  const ids = new Set(manifest.ids);
  const remaining = records.filter(record => !ids.has(record.id));
  await writeCatalog(remaining);
  for (const source of manifest.images) {
    if (JSON.stringify(remaining).includes(source)) continue;
    const name = uploadedImageName(source); if (!name) continue;
    const path = resolve(imageDirectory, name);
    assert(path.startsWith(imageDirectory + sep));
    await unlink(path).catch(error => { if (error.code !== 'ENOENT') throw error; });
  }
  await unlink(manifestFile);
  console.log(JSON.stringify({ removed: records.length - remaining.length, preserved: remaining.length }));
} else {
  if (manifest) throw new Error('Ya existe un lote temporal. Usa check para revisarlo o remove antes de crear otro.');
  const backup = new URL(`../data/archive/providers-before-preview-${new Date().toISOString().replace(/[:.]/g, '-')}.json`, import.meta.url);
  await mkdir(dirname(fileURLToPath(backup)), { recursive: true });
  await writeFile(backup, before, { flag: 'wx' });
  const batch = randomUUID().slice(0, 8); const added = []; const images = [];
  const imageStore = createImageStore();
  for (const [index, [category, price, title, includes, extra, drawing]] of categories.entries()) {
    for (let variant = 0; variant < 2; variant++) {
      const id = `preview-${batch}-${String(index * 2 + variant + 1).padStart(2, '0')}`;
      const accent = variant ? '#9e8867' : '#467f87'; const bg = variant ? '#f2ebe1' : '#e4f0f2';
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="600" viewBox="0 0 960 600"><defs><linearGradient id="bg" x2="1" y2="1"><stop stop-color="${bg}"/><stop offset="1" stop-color="#f9fcfc"/></linearGradient></defs><rect width="960" height="600" fill="url(#bg)"/><circle cx="820" cy="80" r="190" fill="${accent}" opacity=".07"/><circle cx="90" cy="550" r="200" fill="${accent}" opacity=".08"/><ellipse cx="480" cy="470" rx="250" ry="32" fill="${accent}" opacity=".08"/><g transform="translate(0 50)" stroke="${accent}" stroke-width="11" stroke-linecap="round" stroke-linejoin="round" fill="none">${drawing}</g></svg>`;
      const png = await sharp(Buffer.from(svg)).png().toBuffer(); const photo = await imageStore.save(png); images.push(photo.source);
      added.push(validateProvider({ id, businessName: `PRUEBA TEMPORAL ${index * 2 + variant + 1} · ${category}`, category, city: 'Ilo', active: true, verified: false, description: 'Registro temporal creado para revisar la presentación del catálogo y las propuestas. No representa un negocio real.', coverImage: photo.source, evidenceImages: [photo.source], services: [{ id: `${id}-package`, name: `${title} ${variant ? 'Especial' : 'Esencial'} · prueba`, eventTypes: PROVIDER_EVENT_TYPES, priceFrom: variant ? Math.round(price * 1.4) : price, priceModel: 'from', guestMin: 10, guestMax: 600, styles: variant ? ['Elegante', 'Premium', 'Temático'] : ['Elegante', 'Moderno', 'Infantil'], includes: [...includes, ...(variant ? [extra] : [])], description: 'Paquete temporal de ejemplo para comprobar cómo se ve la propuesta. Imagen ilustrativa y precio de prueba.' }] }));
    }
  }
  const next = [...records, ...added]; const ids = added.map(record => record.id);
  const cases = check(next, ids);
  await writeFile(manifestFile, JSON.stringify({ version: 1, createdAt: new Date().toISOString(), ids, images, backup: fileURLToPath(backup) }, null, 2) + '\n', { flag: 'wx' });
  await writeCatalog(next);
  const saved = JSON.parse(await readFile(catalogFile, 'utf8'));
  for (const original of records) assert.deepEqual(saved.find(record => record.id === original.id), original);
  console.log(JSON.stringify({ added: added.length, preserved: records.length, images: images.length, categories: categories.map(item => item[0]), cases }));
}
