export const PROVIDER_CATEGORIES = ['Local', 'Decoración', 'Catering', 'Torta', 'DJ / Música', 'Fotografía', 'Video', 'Maestro de ceremonia', 'Movilidad', 'Bartender / bebidas', 'Animación', 'Otros'];
export const PROVIDER_EVENT_TYPES = ['quinceañero', 'cumpleaños', 'matrimonio', 'babyShower', 'corporativo', 'graduación', 'bautizo', 'otro'];
export const PROVIDER_STYLES = ['Elegante', 'Moderno', 'Minimalista', 'Temático', 'Infantil', 'Premium', 'Personalizado'];
export const IMAGE_HOSTS = ['images.unsplash.com', 'images.pexels.com'];
import { DEFAULT_MARKUP_PERCENT, salePrice } from './pricing.mjs';
export const normalize = value => value.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const aliases = { local: 'local', salon: 'local', lugar: 'local', decoracion: 'decoracion', ambientacion: 'decoracion', catering: 'catering', comida: 'catering', buffet: 'catering', torta: 'torta', pastel: 'torta', dj: 'musica', musica: 'musica', 'dj musica': 'musica', sonido: 'musica', fotografia: 'fotografia', fotografo: 'fotografia', video: 'video', videografia: 'video', 'maestro de ceremonia': 'maestro de ceremonia', movilidad: 'movilidad', transporte: 'movilidad', 'bartender bebidas': 'bebidas', bebidas: 'bebidas', bartender: 'bebidas', animacion: 'animacion', otros: 'otros' };
Object.assign(aliases, { barman: 'bebidas', bar: 'bebidas', 'barra libre': 'bebidas', 'barra de tragos': 'bebidas', 'servicio de bartender': 'bebidas' });
export const categoryKey = value => { const key = normalize(value); return Object.hasOwn(aliases, key) ? aliases[key] : key; };
export const categoryLabel = value => PROVIDER_CATEGORIES.find(label => categoryKey(label) === categoryKey(value)) || value;
export class ProviderValidationError extends Error {}
function fail(message) { throw new ProviderValidationError(message); }
function text(value, label, required = false, max = 1000) {
  if (value == null || value === '') { if (required) fail(`${label} es obligatorio.`); return undefined; }
  if (typeof value !== 'string' || !value.trim() || value.length > max) fail(`${label} no es válido.`);
  return value.trim();
}
function number(value, label, max = 100000000, integer = false) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max || (integer && !Number.isInteger(value))) fail(`${label} no es válido.`);
  return value;
}
function list(value, label, required = false) {
  if (!Array.isArray(value) || value.length > 30) fail(`${label} debe ser una lista de hasta 30 elementos.`);
  const clean = [...new Set(value.map(item => text(item, label, true, 180)))];
  if (required && !clean.length) fail(`${label}: elige al menos una opción.`);
  return clean;
}
export function validateImageSource(value) {
  if (!value) return '';
  if (typeof value !== 'string' || value.length > 2000) fail('La imagen no es válida.');
  if (/^\/(?!\/)[a-zA-Z0-9_./% -]+\.(?:png|jpe?g|webp|gif|svg)$/i.test(value)) {
    try { const decoded = decodeURIComponent(value); if (!decoded.includes('\\') && !decoded.includes('\0') && !decoded.split('/').includes('..') && !decoded.startsWith('//')) return value; } catch { /* Invalid encoding. */ }
  }
  try {
    const url = new URL(value);
    if (url.protocol === 'https:' && IMAGE_HOSTS.includes(url.hostname) && !url.username && !url.password && !url.port) return url.href;
  } catch { /* Invalid source. */ }
  fail('Usa una ruta de imagen del proyecto o una URL HTTPS de images.unsplash.com / images.pexels.com.');
}
function id(value, label) { if (typeof value !== 'string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value)) fail(`${label} no es válido.`); return value; }
export function validateProvider(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) fail('Proveedor no válido.');
  if (value.evidenceImages !== undefined && (!Array.isArray(value.evidenceImages) || value.evidenceImages.length > 30)) fail('Evidencias debe ser una lista de hasta 30 imágenes.');
  const result = { id: id(value.id, 'ID'), businessName: text(value.businessName, 'Nombre comercial', true, 160), category: text(value.category, 'Categoría', true, 100), city: text(value.city, 'Ciudad', true, 100), verified: value.verified, active: value.active, evidenceImages: (value.evidenceImages ?? []).map(validateImageSource) };
  if (typeof result.verified !== 'boolean' || typeof result.active !== 'boolean') fail('Verificado y activo deben ser booleanos.');
  for (const [field, max, integer] of [['yearsExperience', 150, true], ['eventsCompleted', 1000000, true], ['rating', 5, false]]) if (value[field] !== undefined) result[field] = number(value[field], field, max, integer);
  for (const field of ['description', 'phone', 'whatsapp', 'instagram', 'address']) { const clean = text(value[field], field, false, field === 'description' ? 1500 : 200); if (clean !== undefined) result[field] = clean; }
  if (value.coverImage) result.coverImage = validateImageSource(value.coverImage);
  if (!Array.isArray(value.services) || !value.services.length || value.services.length > 30) fail('Agrega entre 1 y 30 servicios.');
  const ids = new Set();
  result.services = value.services.map(service => {
    if (!service || typeof service !== 'object' || Array.isArray(service)) fail('Servicio no válido.');
    const clean = { id: id(service.id, 'ID del servicio'), name: text(service.name, 'Nombre del servicio', true, 180), eventTypes: list(service.eventTypes, 'Tipos de evento', true), priceFrom: number(service.priceFrom, 'Precio desde'), styles: list(service.styles ?? [], 'Estilos'), includes: list(service.includes ?? [], 'Incluye') };
    if (service.excludes !== undefined) clean.excludes = list(service.excludes, 'No incluye');
    if (service.conditions !== undefined) clean.conditions = text(service.conditions, 'Condiciones', false, 1500);
    if (service.category !== undefined) clean.category = text(service.category, 'Categoría del servicio', true, 100);
    if (ids.has(clean.id)) fail('Los servicios deben tener IDs distintos.'); ids.add(clean.id);
    if (service.priceTo !== undefined) { clean.priceTo = number(service.priceTo, 'Precio máximo'); if (clean.priceTo < clean.priceFrom) fail('Precio máximo debe ser mayor o igual al precio desde.'); }
    for (const field of ['guestMin', 'guestMax']) if (service[field] !== undefined) clean[field] = number(service[field], field, 100000, true);
    if (clean.guestMin !== undefined && clean.guestMax !== undefined && clean.guestMax < clean.guestMin) fail('La capacidad máxima no puede ser menor que la mínima.');
    if (service.priceModel !== undefined) { if (!['from', 'fixed', 'range', 'customQuote'].includes(service.priceModel)) fail('Modelo de precio no válido.'); clean.priceModel = service.priceModel; }
    if (service.fixedPrice !== undefined) clean.fixedPrice = number(service.fixedPrice, 'Precio fijo');
    if (clean.priceModel === 'fixed' && clean.fixedPrice === undefined) fail('Agrega el precio fijo.');
    if (service.description) clean.description = text(service.description, 'Descripción del servicio', false, 1500);
    if (service.availableForCustomQuote !== undefined) { if (typeof service.availableForCustomQuote !== 'boolean') fail('Cotización personalizada no válida.'); clean.availableForCustomQuote = service.availableForCustomQuote; }
    if (service.providerCost !== undefined) {
      clean.providerCost = number(service.providerCost, 'Costo real del proveedor');
      clean.markupType = service.markupType ?? 'percent';
      if (!['percent', 'fixed'].includes(clean.markupType)) fail('Tipo de recargo no válido.');
      clean.markupValue = number(service.markupValue ?? DEFAULT_MARKUP_PERCENT, 'Valor del recargo');
      clean.currency = service.currency ?? 'PEN';
      if (clean.currency !== 'PEN') fail('La moneda debe ser PEN.');
      if (service.priceUpdatedAt !== undefined) {
        if (typeof service.priceUpdatedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(service.priceUpdatedAt) || Number.isNaN(Date.parse(service.priceUpdatedAt))) fail('Fecha de precio no válida.');
        clean.priceUpdatedAt = service.priceUpdatedAt;
      }
      let computed;
      try { computed = salePrice(clean.providerCost, clean.markupType, clean.markupValue); } catch (error) { fail(error.message); }
      clean.priceFrom = computed;
      if (clean.priceModel === 'fixed') clean.fixedPrice = computed;
      if (clean.priceTo !== undefined && clean.priceTo < computed) fail('Precio máximo debe ser mayor o igual al precio público calculado.');
    }
    return clean;
  });
  return result;
}
