export const DEFAULT_MARKUP_PERCENT: number;
export function configuredMarkup(value: unknown): number;
export function moneyCents(value: number): number;
export function salePrice(providerCost: number, markupType?: 'percent' | 'fixed', markupValue?: number): number;
export function grossMargin(service: { providerCost?: number; priceModel?: string; priceFrom: number; fixedPrice?: number }): number | null;
export function stampProviderPrices<T>(next: T, previous?: T | null): T;
