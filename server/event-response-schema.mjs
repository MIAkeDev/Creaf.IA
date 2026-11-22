import { REQUIRED_FIELDS } from '../shared/event-state.mjs';
const text = { type: ['string', 'null'] };
const list = { type: 'array', items: { type: 'string' } };
// The model interprets; application code owns completeness and status.
export const EVENT_RESPONSE_SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['reply', 'updates'],
  properties: {
    reply: { type: 'string' },
    updates: {
      type: ['object', 'null'], additionalProperties: false,
      properties: {
        eventType: text, date: text, datePreference: text,
        guestCount: { type: ['integer', 'string', 'null'] }, budget: { type: ['number', 'string', 'null'] },
        city: text, style: text,
        selectedServices: { anyOf: [list, { type: 'null' }] }, extraRequirements: { anyOf: [list, { type: 'null' }] },
      },
    },
    ambiguities: {
      type: ['array', 'null'],
      items: {
        type: 'object', additionalProperties: false,
        required: ['value', 'possibleFields'],
        properties: { value: { type: 'string' }, possibleFields: { type: 'array', items: { type: 'string', enum: REQUIRED_FIELDS } } },
      },
    },
  },
};
export const EVENT_RESPONSE_FORMAT = {
  type: 'json_schema',
  json_schema: { name: 'event_planner', strict: false, schema: EVENT_RESPONSE_SCHEMA },
};
