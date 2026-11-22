export const EVENT_PRESETS: Record<string, string[]>;
export const EVENT_ALIASES: Record<string, string>;
export function isStandaloneEventType(message: string): boolean;
export function detectEventType(text?: string): string | null;
export function getSuggestedServices(eventType: string | null): string[];
