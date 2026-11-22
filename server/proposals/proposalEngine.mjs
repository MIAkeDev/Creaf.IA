import { createHash } from 'node:crypto';
import { PROPOSAL_CONFIG } from './config.mjs';
import { providerSearch, cents } from './providerSearch.mjs';
import { publicProviderPreview } from './public-preview.mjs';
import { categoryKey } from '../../shared/provider-validation.mjs';

const money = value => new Intl.NumberFormat('es-PE', { style: 'currency', currency: 'PEN', maximumFractionDigits: 2 }).format(value);
const titles = { saving: 'Ahorra un poco', recommended: 'Mejor ajuste', upgrade: 'Mejora tu evento' };
function improvements(combo, reference) {
  if (!reference) return [];
  return combo.items.filter(item => {
    const prior = reference.items.find(old => categoryKey(old.category) === categoryKey(item.category));
    if (!prior || item.key === prior.key) return false;
    const extra = item.service.includes.some(value => !prior.service.includes.includes(value));
    return item.quality > prior.quality + .5 || extra;
  }).map(item => item.category);
}
export function generateProposals(event, providers, { allowAlternatives = false, config = PROPOSAL_CONFIG } = {}) {
  const search = providerSearch(event, providers, { allowAlternatives, config });
  const budget = cents(event.budget); const ceiling = Math.round(budget * (allowAlternatives ? config.alternativeUpgradeMax : config.bands.upgrade.max));
  const combinations = []; let visited = 0; let searchLimited = false;
  const minimumRemaining = search.groups.map((_, index) => search.groups.slice(index).reduce((total, group) => total + Math.min(...group.options.map(item => item.price)), 0));
  function visit(index, items, total, score) {
    if (++visited > config.maxSearchNodes) { searchLimited = true; return; }
    if (total > ceiling) return;
    if (index === search.groups.length) {
      const signature = items.map(item => item.key).sort().join('|');
      combinations.push({ items: [...items], total, score: score / items.length, signature }); return;
    }
    if (total + minimumRemaining[index] > ceiling) return;
    for (const item of search.groups[index].options) { if (searchLimited) break; visit(index + 1, [...items, item], total + item.price, score + item.score); }
  }
  if (search.groups.length && !search.missingCategories.length) visit(0, [], 0, 0);
  const selected = []; const used = new Set();
  function choose(type, pool, reference) {
    const target = config.bands[type].target;
    const ranked = pool.filter(combo => !used.has(combo.signature)).map(combo => {
      const differences = reference ? combo.items.filter(item => !reference.items.some(old => old.provider.id === item.provider.id)).length / combo.items.length : 0;
      return { combo, rank: combo.score - Math.abs(combo.total / budget - target) * 100 + differences * config.diversityBonus };
    }).sort((a, b) => b.rank - a.rank || Math.abs(a.combo.total / budget - target) - Math.abs(b.combo.total / budget - target) || a.combo.signature.localeCompare(b.combo.signature));
    const found = ranked[0]?.combo;
    if (found) { used.add(found.signature); selected.push({ type, combo: found }); }
    return found;
  }
  const inBand = type => combinations.filter(combo => combo.total >= Math.round(budget * config.bands[type].min) && combo.total <= Math.round(budget * config.bands[type].max));
  const recommended = choose('recommended', inBand('recommended').length ? inBand('recommended') : combinations.filter(combo => combo.total <= budget));
  const savings = inBand('saving').filter(combo => !recommended || combo.total < recommended.total);
  choose('saving', savings.length ? savings : combinations.filter(combo => combo.total < (recommended?.total ?? budget) && combo.total <= budget), recommended);
  const upgrades = combinations.filter(combo => combo.total > budget && combo.total <= ceiling && (!recommended || improvements(combo, recommended).length));
  const upgradeBand = upgrades.filter(combo => combo.total >= budget * config.bands.upgrade.min && combo.total <= budget * config.bands.upgrade.max);
  choose('upgrade', upgradeBand.length ? upgradeBand : upgrades, recommended);
  // If real alternatives share the same budget band, show them without inventing savings/upgrades.
  while (selected.length < Math.min(3, combinations.length)) {
    const remaining = combinations.filter(combo => !used.has(combo.signature)).sort((a, b) => Math.abs(a.total - budget) - Math.abs(b.total - budget) || b.score - a.score || a.signature.localeCompare(b.signature));
    const combo = remaining[0]; if (!combo) break;
    used.add(combo.signature); selected.push({ type: combo.total <= budget ? 'recommended' : 'upgrade', combo, alternative: true });
  }
  const proposals = selected.map(({ type, combo, alternative = false }) => {
    const difference = (combo.total - budget) / 100; const improvedCategories = type === 'upgrade' ? improvements(combo, recommended) : [];
    let reason = difference < 0 ? `Incluye todos los servicios seleccionados y deja ${money(-difference)} disponibles para extras o imprevistos.`
      : difference === 0 ? 'Incluye todos los servicios seleccionados y aprovecha tu presupuesto completo.'
      : `Supera tu presupuesto en ${money(difference)}${improvedCategories.length ? ` y añade una alternativa con mejores características registradas en ${improvedCategories.join(', ')}` : ' para cubrir los servicios seleccionados'}.`;
    if (type === 'recommended' && combo.total / budget >= config.bands.recommended.min && difference < 0) reason = `Es una de las combinaciones que mejor aprovecha tu presupuesto; quedan ${money(-difference)} disponibles.`;
    const isAlternative = alternative || (type === 'upgrade' && !recommended);
    return { id: `${type}-${createHash('sha256').update(combo.signature).digest('hex').slice(0, 12)}`, type, title: isAlternative ? 'Otra combinación compatible' : titles[type], isAlternative, budget: event.budget, total: combo.total / 100, difference, reason, improvedCategories, providers: combo.items.map(publicProviderPreview) };
  }).sort((a, b) => ['saving', 'recommended', 'upgrade'].indexOf(a.type) - ['saving', 'recommended', 'upgrade'].indexOf(b.type));
  return {
    proposals, compatibleProviders: search.compatibleProviders, compatibleServices: search.compatibleServices,
    combinationsEvaluated: combinations.length, searchLimited, missingCategories: search.missingCategories,
    selectedServices: event.selectedServices, allowAlternatives,
    blockers: search.blockers,
    ...(search.minimumTotal !== null && !proposals.length && search.minimumTotal > ceiling ? { suggestedBudget: Math.ceil(search.minimumTotal / 100) } : {}),
    canAllowAlternatives: !allowAlternatives && !proposals.length && search.minimumTotal !== null && search.minimumTotal > ceiling && search.minimumTotal <= Math.round(budget * config.alternativeUpgradeMax),
    ...(search.minimumTotal !== null ? { minimumTotal: search.minimumTotal / 100 } : {}),
  };
}
