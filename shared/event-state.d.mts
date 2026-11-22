import type { EventState, RequiredEventField } from '../src/types/event';
export const REQUIRED_FIELDS: RequiredEventField[];
export function createEventState(): EventState;
export function validateUpdates(value: unknown): Partial<EventState>;
export function validateEventState(value?: unknown): EventState;
export function applyEventUpdates(state: EventState, updates: unknown): EventState;
export function getMissingFields(state: EventState): RequiredEventField[];
export function getEventStatus(state: EventState): 'collecting' | 'ready';
export function compactEventState(state: EventState): Partial<EventState>;
