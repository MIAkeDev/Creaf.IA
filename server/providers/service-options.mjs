import { categoryKey, categoryLabel, normalize } from '../../shared/provider-validation.mjs';
import { detectEventType } from '../../shared/event-presets.mjs';

export const eventTypeKey = value => normalize(detectEventType(value) || value).replace(/ /g, '');
export const fitsEvent = (service, eventType) => service.eventTypes.some(type => eventTypeKey(type) === eventTypeKey(eventType));
export const fitsCapacity = (service, guests) => (service.guestMin ?? 0) <= guests && (service.guestMax ?? Infinity) >= guests;
export function serviceOptions(providers, { eventType, city = '', guestCount } = {}) {
  const options = new Map();
  for (const provider of providers) {
    if (!provider.active || (city && normalize(provider.city) !== normalize(city))) continue;
    for (const service of provider.services) {
      if (!fitsEvent(service, eventType)) continue;
      const label = categoryLabel(service.category || provider.category); const key = categoryKey(label);
      if (!options.has(key)) options.set(key, { category: label, packages: 0, compatiblePackages: 0, capacityRanges: [] });
      const item = options.get(key); item.packages++;
      if (guestCount == null || fitsCapacity(service, guestCount)) item.compatiblePackages++;
      const range = { min: service.guestMin ?? 0, max: service.guestMax ?? null };
      if (!item.capacityRanges.some(old => old.min === range.min && old.max === range.max)) item.capacityRanges.push(range);
    }
  }
  return { options: [...options.values()].sort((a, b) => a.category.localeCompare(b.category, 'es')) };
}
