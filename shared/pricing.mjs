export const DEFAULT_MARKUP_PERCENT = 10;
export function configuredMarkup(value) {
  const parsed = Number(value);
  return value !== undefined && Number.isFinite(parsed) && parsed >= 0 && parsed <= 1000 ? parsed : DEFAULT_MARKUP_PERCENT;
}

export function moneyCents(value) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > 100000000) throw new Error('Importe no válido.');
  return Math.round(value * 100);
}

export function salePrice(providerCost, markupType = 'percent', markupValue = DEFAULT_MARKUP_PERCENT) {
  const cost = moneyCents(providerCost);
  if (typeof markupValue !== 'number' || !Number.isFinite(markupValue) || markupValue < 0 || markupValue > 100000000) throw new Error('Recargo no válido.');
  if (markupType !== 'percent' && markupType !== 'fixed') throw new Error('Tipo de recargo no válido.');
  if (markupType === 'percent' && markupValue > 1000) throw new Error('El porcentaje de recargo es demasiado alto.');
  const surcharge = markupType === 'percent' ? Math.round(cost * markupValue / 100) : moneyCents(markupValue);
  if (cost + surcharge > 10000000000) throw new Error('El precio público calculado supera el máximo permitido.');
  return (cost + surcharge) / 100;
}

export function grossMargin(service) {
  return service.providerCost === undefined ? null : Math.round((service.priceModel === 'fixed' ? service.fixedPrice : service.priceFrom) * 100 - moneyCents(service.providerCost)) / 100;
}

export function stampProviderPrices(next, previous = null) {
  return { ...next, services: next.services.map(service => {
    if (service.providerCost === undefined) return service;
    const prior = previous?.services.find(item => item.id === service.id);
    const changed = !prior || ['providerCost', 'markupType', 'markupValue', 'priceFrom', 'fixedPrice'].some(field => prior[field] !== service[field]);
    return changed ? { ...service, priceUpdatedAt: new Date().toISOString() } : service;
  }) };
}
