export type EventState = {
  eventType: string | null;
  date: string | null;
  datePreference: string | null;
  guestCount: number | null;
  budget: number | null;
  city: string;
  style: string | null;
  selectedServices: string[];
  extraRequirements: string[];
};
export type RequiredEventField = 'eventType' | 'date' | 'guestCount' | 'budget' | 'selectedServices';
export type EventAmbiguity = { value: string; possibleFields: RequiredEventField[]; reason?: 'missing_year' };
export type ExpectedField = RequiredEventField | 'style' | null;
export type PartialDate = { day?: number; month?: number; year?: number };
export type ConversationState = {
  event: EventState;
  expectedField: ExpectedField;
  eventDateParts: PartialDate;
  ambiguities: EventAmbiguity[];
};
export type EventResult = {
  reply: string;
  eventState: EventState;
  missingFields: RequiredEventField[];
  status: 'collecting' | 'ready';
  degraded?: boolean;
  showServiceSelector?: boolean;
  ambiguities?: EventAmbiguity[];
  conversationState: ConversationState;
};
