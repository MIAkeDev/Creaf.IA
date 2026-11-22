// Explicit allowlist: never spread a private Provider or ProviderService into a public DTO.
const escape = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function safeText(text, provider) {
  let value = text || '';
  for (const field of ['businessName', 'phone', 'whatsapp', 'instagram', 'address']) {
    if (provider[field]) value = value.replace(new RegExp(escape(provider[field]), 'gi'), '');
  }
  return value.replace(/https?:\/\/\S+|www\.\S+|[\w.+-]+@[\w.-]+\.[a-z]{2,}|@[\w.]+|(?:\+?\d[\s().-]*){7,}/gi, '').replace(/\s{2,}/g, ' ').trim().slice(0, 450);
}
export function publicProviderPreview(candidate) {
  const { provider, service, category } = candidate;
  const images = [...new Set([provider.coverImage, ...provider.evidenceImages].filter(Boolean))];
  return {
    providerId: provider.id, serviceId: service.id, category,
    serviceName: safeText(service.name, provider) || category,
    price: candidate.price / 100, priceKind: service.priceModel === 'fixed' ? 'fixed' : 'from',
    ...(provider.yearsExperience !== undefined ? { yearsExperience: provider.yearsExperience } : {}),
    ...(provider.eventsCompleted !== undefined ? { eventsCompleted: provider.eventsCompleted } : {}),
    ...(provider.rating !== undefined ? { rating: provider.rating } : {}),
    shortDescription: safeText(service.description || provider.description, provider),
    evidenceImage: images.length ? `/api/proposal-images/${provider.id}/0` : undefined,
    evidenceImages: images.slice(0, 4).map((_, index) => `/api/proposal-images/${provider.id}/${index}`),
    includes: service.includes.map(item => safeText(item, provider)).filter(Boolean),
  };
}
