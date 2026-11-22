import { categoryKey, normalize } from '../../shared/provider-validation.mjs';
import { fitsCapacity, fitsEvent } from '../providers/service-options.mjs';
import { PROPOSAL_CONFIG } from './config.mjs';

export const cents = value => Math.round(value * 100);
export function servicePrice(service) { return service.priceModel === 'fixed' ? service.fixedPrice : service.priceFrom; }
export function calculateProviderScore(provider, service, event, config = PROPOSAL_CONFIG) {
  const weight = config.weights; const price = servicePrice(service);
  const allocation = event.budget / Math.max(1, new Set(event.selectedServices.map(categoryKey)).size);
  const styleMatch = !event.style || service.styles.some(style => normalize(event.style).includes(normalize(style)));
  const components = {
    price: weight.price * Math.max(0, 1 - Math.abs(price - allocation) / allocation),
    capacity: weight.capacity * (service.guestMin !== undefined || service.guestMax !== undefined ? 1 : .6),
    eventType: weight.eventType,
    style: styleMatch ? weight.style : 0,
    rating: weight.rating * ((provider.rating ?? 0) / 5),
    verified: provider.verified ? weight.verified : 0,
  };
  return Math.round(Object.values(components).reduce((total, value) => total + value, 0) * 100) / 100;
}
export function qualityScore(provider, service, event) {
  return (provider.rating ?? 0) * 5 + (provider.verified ? 5 : 0)
    + Math.min(provider.yearsExperience ?? 0, 15) + Math.min(provider.eventsCompleted ?? 0, 200) / 20
    + service.includes.length * 2 + (event.style && service.styles.some(style => normalize(event.style).includes(normalize(style))) ? 10 : 0);
}
export function providerSearch(event, providers, { allowAlternatives = false, config = PROPOSAL_CONFIG } = {}) {
  const categories = [...new Map(event.selectedServices.map(label => [categoryKey(label), label])).entries()];
  const maxPrice = cents(event.budget * (allowAlternatives ? config.alternativeUpgradeMax : config.bands.upgrade.max));
  const groups = categories.map(([key, label]) => ({ key, label, options: [], minimum: Infinity, stages: [0, 0, 0, 0, 0, 0], capacityRanges: [] }));
  for (const provider of providers) {
    for (const service of provider.services) {
      const group = groups.find(item => item.key === categoryKey(service.category || provider.category)); if (!group) continue;
      group.stages[0]++;
      if (!provider.active) continue; group.stages[1]++;
      if (normalize(provider.city) !== normalize(event.city)) continue; group.stages[2]++;
      if (!fitsEvent(service, event.eventType)) continue; group.stages[3]++;
      const range = { min: service.guestMin ?? 0, max: service.guestMax ?? null };
      if (!group.capacityRanges.some(old => old.min === range.min && old.max === range.max)) group.capacityRanges.push(range);
      if (!fitsCapacity(service, event.guestCount)) continue; group.stages[4]++;
      if (service.priceModel === 'customQuote' && service.priceFrom === 0) continue; group.stages[5]++;
      const price = cents(servicePrice(service));
      group.minimum = Math.min(group.minimum, price);
      if (price > maxPrice) continue;
      group.options.push({ provider, service, category: group.label, price, score: calculateProviderScore(provider, service, event, config), quality: qualityScore(provider, service, event), key: `${provider.id}:${service.id}` });
    }
  }
  for (const group of groups) group.options.sort((a, b) => b.score - a.score || a.price - b.price || a.key.localeCompare(b.key));
  const candidates = groups.flatMap(group => group.options);
  return {
    groups,
    compatibleProviders: new Set(candidates.map(item => item.provider.id)).size,
    compatibleServices: candidates.length,
    missingCategories: groups.filter(group => !group.options.length).map(group => group.label),
    blockers: groups.filter(group => !group.options.length).map(group => {
      const reasons = ['not_registered', 'inactive', 'city', 'event_type', 'capacity', 'quote_required'];
      const messages = [
        'Todavía no hay paquetes registrados para este servicio.',
        'Los proveedores registrados para este servicio están inactivos.',
        `No hay paquetes de este servicio en ${event.city}.`,
        'No hay paquetes de este servicio para el tipo de evento elegido.',
        `Los paquetes registrados no cubren ${event.guestCount} invitados. Rangos disponibles: ${group.capacityRanges.map(range => range.max === null ? `desde ${range.min}` : `${range.min}–${range.max}`).join(', ')} personas.`,
        'El servicio requiere una cotización: todavía no tiene un precio inicial registrado.',
      ];
      const stage = group.stages.findIndex(count => count === 0);
      return { category: group.label, reason: stage < 0 ? 'budget' : reasons[stage], message: stage < 0 ? 'El precio inicial registrado supera el margen del presupuesto.' : messages[stage], ...(stage === 4 ? { capacityRanges: group.capacityRanges } : {}) };
    }),
    minimumTotal: groups.length && groups.every(group => Number.isFinite(group.minimum)) ? groups.reduce((total, group) => total + group.minimum, 0) : null,
  };
}
