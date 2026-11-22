import type { ConversationState, EventResult, EventState } from '../types/event';
import { validateEventState, getMissingFields, getEventStatus } from '../../shared/event-state.mjs';
import { normalizeAmbiguities } from '../../shared/event-ambiguities.mjs';
import { validateConversationState } from '../../shared/conversation-state.mjs';

export class AIServiceError extends Error {
  constructor(message: string, readonly eventState?: EventState, readonly conversationState?: ConversationState) { super(message); this.name = 'AIServiceError'; }
}

// La clave y el system prompt viven en el servidor. Nunca usar claves VITE_*.
export async function sendMessageToAI(message: string, conversationState: ConversationState, signal?: AbortSignal, conversationStarted = false, lastAssistantMessage = ''): Promise<EventResult> {
  let response: Response;
  try {
    response = await fetch(`${import.meta.env.BASE_URL}api/chat`, {
      method: 'POST', signal, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ message, conversationState, conversationStarted, lastAssistantMessage: lastAssistantMessage.slice(0, 300) }),
    });
  } catch (error) {
    if (signal?.aborted) throw error;
    throw new Error('No pude conectar con el servidor. Comprueba que esté ejecutándose.', { cause: error });
  }
  let data: Partial<EventResult> & { error?: string };
  try { data = await response.json(); } catch { throw new Error('El servidor de IA no está disponible. Reinicia el proyecto con npm.cmd run dev.'); }
  if (!response.ok) {
    let saved: EventState | undefined;
    let savedConversation: ConversationState | undefined;
    try { if (data.eventState) saved = validateEventState(data.eventState); } catch { /* Ignore invalid partial data. */ }
    try { if (data.conversationState) savedConversation = validateConversationState(data.conversationState); } catch { /* Ignore invalid context. */ }
    throw new AIServiceError(data.error || 'Uy, no pude obtener una respuesta. ¿Lo intentamos de nuevo?', saved, savedConversation);
  }
  if (typeof data.reply !== 'string' || !data.reply.trim()) throw new Error('La IA devolvió una respuesta vacía. ¿Lo intentamos de nuevo?');
  if (!data.eventState) throw new Error('La respuesta del planificador no tiene datos válidos. Inténtalo de nuevo.');
  let nextConversation: ConversationState;
  try { nextConversation = validateConversationState(data.conversationState); } catch { throw new Error('No pude validar los datos del evento. Inténtalo de nuevo.'); }
  const nextState = nextConversation.event;
  const ambiguities = normalizeAmbiguities(nextConversation.ambiguities);
  return { reply: data.reply, eventState: nextState, conversationState: nextConversation, status: ambiguities.length || Object.keys(nextConversation.eventDateParts).length ? 'collecting' : getEventStatus(nextState), missingFields: getMissingFields(nextState), degraded: data.degraded === true, showServiceSelector: data.showServiceSelector === true, ambiguities };
}
