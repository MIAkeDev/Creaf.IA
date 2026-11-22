import type { Provider } from '../src/types/provider';
export const PROVIDER_CATEGORIES: string[];
export const PROVIDER_EVENT_TYPES: string[];
export const PROVIDER_STYLES: string[];
export const IMAGE_HOSTS: string[];
export function normalize(value: string): string;
export function categoryKey(value: string): string;
export function categoryLabel(value: string): string;
export class ProviderValidationError extends Error {}
export function validateProvider(value: unknown): Provider;
export function validateImageSource(value: string): string;
