import { createEventState, validateUpdates } from '../shared/event-state.mjs';
export function normalizeModelUpdates(value) {
  if (value == null || (Array.isArray(value) && value.length === 0)) return { updates: {}, droppedFields: [] };
  if (typeof value !== 'object' || Array.isArray(value)) throw new Error('Invalid updates object');
  const updates = {}; const droppedFields = [];
  const allowed = createEventState();
  for (const [field, raw] of Object.entries(value)) {
    if (!Object.hasOwn(allowed, field) || raw == null) continue;
    let item = raw;
    if (['guestCount', 'budget'].includes(field) && typeof item === 'string') {
      const numeric = item.trim();
      // Coercion applies only to an already named field, never to an unassigned number.
      if (/^\d+(?:\.\d+)?$/.test(numeric)) item = Number(numeric);
      else if (/^\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$/.test(numeric)) item = Number(numeric.replace(/,/g, ''));
    }
    try { Object.assign(updates, validateUpdates({ [field]: item })); }
    catch { droppedFields.push(field); }
  }
  return { updates, droppedFields };
}
