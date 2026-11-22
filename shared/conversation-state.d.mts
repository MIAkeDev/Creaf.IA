import type { ConversationState, EventAmbiguity, EventState, ExpectedField, PartialDate } from '../src/types/event';
export const EXPECTED_FIELDS: Exclude<ExpectedField, null>[];
export function createConversationState(): ConversationState;
export function validateConversationState(value: unknown): ConversationState;
export function nextExpectedField(event: EventState, eventDateParts?: PartialDate, ambiguities?: EventAmbiguity[]): ExpectedField;
export function dateFromParts(parts: PartialDate): string | null;
export function validDateParts(parts: unknown): boolean;
export function conversationQuestion(conversation: ConversationState): string;
