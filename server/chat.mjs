import { SYSTEM_PROMPT } from './system-prompt.mjs';
import { applyEventUpdates, validateEventState } from '../shared/event-state.mjs';
import { buildPlannerContext, finishPlannerResult, safePlannerResult, validateModelResult } from './event-planner.mjs';
import { EVENT_RESPONSE_FORMAT } from './event-response-schema.mjs';
import { localServiceResponse } from './service-intent.mjs';
import { localGreetingResponse } from './greetings.mjs';
import { localRelativeDateResponse } from './date-intent.mjs';
import { getTemporalReference } from '../shared/event-dates.mjs';
import { localEventTypeResponse, localEventTypeUncertaintyResponse } from './event-type-intent.mjs';
import { extractMessageFacts, localFactsResponse } from './message-facts.mjs';
import { conversationQuestion, validateConversationState } from '../shared/conversation-state.mjs';
import { completeConversationResult } from './conversation-planner.mjs';
import { hasExplicitCorrection } from './partial-date.mjs';
import { localDatePreferenceResponse } from './date-preference.mjs';
import { allowedEventDate, datePolicyIssue } from './date-policy.mjs';
import { localMissingDataGuidance } from './missing-data-guidance.mjs';

class RequestError extends Error {
  constructor(status, message, recoverable = false) { super(message); this.status = status; this.recoverable = recoverable; }
}

function reply(response, status, body) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  response.end(JSON.stringify(body));
}

async function readPlannerRequest(request) {
  if (!request.headers['content-type']?.startsWith('application/json')) throw new RequestError(415, 'La solicitud debe ser JSON.');
  if (request.body !== undefined) {
    const serialized = JSON.stringify(request.body);
    if (Buffer.byteLength(serialized) > 48000) throw new RequestError(413, 'La conversación es demasiado larga. Prueba con un mensaje más corto.');
    return validatePlannerBody(request.body);
  }
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += Buffer.byteLength(chunk);
    if (size > 48000) throw new RequestError(413, 'La conversación es demasiado larga. Prueba con un mensaje más corto.');
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  let parsed;
  try { parsed = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw new RequestError(400, 'Solicitud no válida.'); }
  return validatePlannerBody(parsed);
}
function validatePlannerBody(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed) || Object.keys(parsed).some(key => !['message', 'eventState', 'conversationState', 'expectedField', 'eventDateParts', 'conversationStarted', 'lastAssistantMessage'].includes(key))) throw new RequestError(400, 'Solicitud de evento no válida.');
  if (typeof parsed.message !== 'string' || !parsed.message.trim() || parsed.message.length > 6000) throw new RequestError(400, 'Escribe un mensaje de entre 1 y 6000 caracteres.');
  if (parsed.conversationStarted !== undefined && typeof parsed.conversationStarted !== 'boolean') throw new RequestError(400, 'El estado de conversación no es válido.');
  if (parsed.lastAssistantMessage !== undefined && (typeof parsed.lastAssistantMessage !== 'string' || parsed.lastAssistantMessage.length > 1000)) throw new RequestError(400, 'El contexto de conversación no es válido.');
  let eventState; let conversationState;
  try {
    if (parsed.conversationState !== undefined) {
      if (parsed.eventState !== undefined || parsed.expectedField !== undefined || parsed.eventDateParts !== undefined) throw new Error('Conflicting states');
      conversationState = validateConversationState(parsed.conversationState);
      eventState = conversationState.event;
    } else {
      eventState = validateEventState(parsed.eventState);
      if (Object.hasOwn(parsed, 'expectedField')) conversationState = validateConversationState({ event: eventState, expectedField: parsed.expectedField, eventDateParts: parsed.eventDateParts ?? {} });
      else if (parsed.eventDateParts !== undefined) throw new Error('Date parts require conversation context');
    }
  } catch { throw new RequestError(400, 'Los datos del evento o de la conversación no son válidos.'); }
  return { message: parsed.message.trim(), eventState, conversationState, conversationStarted: parsed.conversationStarted === true, lastAssistantMessage: parsed.lastAssistantMessage || '' };
}

export function createChatHandler(env, { fetchImpl = fetch, timeoutMs = 45000, now = () => new Date(), loadServiceOptions } = {}) {
  let running = 0;
  const configuredLimit = Number(env.CHAT_MAX_CONCURRENT);
  const maxConcurrent = Number.isInteger(configuredLimit) && configuredLimit >= 1 && configuredLimit <= 32 ? configuredLimit : 8;
  return async (request, response, next) => {
    if (request.url?.split('?')[0] !== '/api/chat') return next();
    if (request.method !== 'POST') { response.setHeader('Allow', 'POST'); return reply(response, 405, { error: 'Usa POST para conversar.' }); }
    // Same-origin browser requests; the chat remains available without an account.
    if (request.headers.origin) {
      let allowed = false;
      try {
        const origin = new URL(request.headers.origin);
        allowed = origin.host === (request.headers['x-forwarded-host'] || request.headers.host) && ['http:', 'https:'].includes(origin.protocol);
      } catch { /* Invalid origin. */ }
      if (!allowed) return reply(response, 403, { error: 'Origen no permitido.' });
    }
    if (running >= maxConcurrent) return reply(response, 429, { error: 'Hay muchas conversaciones en curso. Espera un momento y vuelve a intentar.' });
    const controller = new AbortController();
    const disconnect = () => { if (!response.writableEnded) controller.abort(); };
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    response.on('close', disconnect);
    running++;
    let preservedState; let preservedConversation; let sendSafeFallback;
    try {
      const { message, eventState, conversationState, conversationStarted, lastAssistantMessage } = await readPlannerRequest(request);
      const temporal = getTemporalReference(now());
      const referenceDate = temporal.reference_date;
      const options = { referenceDate, referenceTime: temporal.reference_time, conversationStarted, lastAssistantMessage,
        ...(conversationState ? { expectedField: conversationState.expectedField, eventDateParts: conversationState.eventDateParts, pendingAmbiguities: conversationState.ambiguities } : {}) };
      let policyIssue = datePolicyIssue(message, referenceDate, conversationState?.expectedField);
      const facts = extractMessageFacts(eventState, message, options);
      if (facts.updates.date && !allowedEventDate(facts.updates.date, referenceDate)) {
        delete facts.updates.date;
        facts.eventDateParts = conversationState?.eventDateParts ?? {};
        facts.partialDateChanged = false;
        facts.ambiguities = [];
        policyIssue ||= 'Esa fecha ya pasó o queda fuera del periodo de cotización. Indícame una fecha válida.';
      }
      const groundedState = applyEventUpdates(eventState, facts.updates);
      preservedState = groundedState;
      const catalog = loadServiceOptions && groundedState.eventType ? await loadServiceOptions(groundedState) : undefined;
      if (catalog) options.suggestedServices = catalog.options.map(item => item.category);
      preservedConversation = completeConversationResult({ reply: '', eventState: groundedState, ambiguities: facts.ambiguities }, conversationState, facts).conversationState;
      const respond = result => {
        const completed = completeConversationResult(result, conversationState, facts, { explicitContext: !!conversationState });
        if (catalog && !result.suppressServiceSelectorReply && (completed.showServiceSelector || completed.conversationState.expectedField === 'selectedServices') && !completed.ambiguities.length && !Object.keys(completed.conversationState.eventDateParts).length) {
          completed.showServiceSelector = true;
          const confirmation = completed.reply.match(/^(?:Perfecto, anoté|Perfecto, tomo|Listo, anoté|Listo, cambié)[^.]*\./)?.[0];
          completed.reply = `${confirmation ? `${confirmation} ` : ''}${facts.datePreference ? 'Podemos cotizar sin fecha exacta; la disponibilidad se confirmará después. ' : ''}${catalog.options.length
            ? `Puedes elegir ${options.suggestedServices.join(', ')} en el formulario. Marca los que necesites y confirma; puedes omitir cualquiera después.`
            : 'Todavía no hay servicios registrados para este evento en tu ciudad. Puedes contarme qué necesitas; la comparación requiere paquetes compatibles en el catálogo.'}`;
        }
        reply(response, 200, completed);
      };
      sendSafeFallback = () => respond(safePlannerResult(groundedState, { ...options, message }));
      if (policyIssue) {
        respond({ reply: `${policyIssue} ${conversationQuestion({ event: groundedState, expectedField: 'date', eventDateParts: {} })}`, eventState: groundedState, preserveReply: true, suppressServiceSelectorReply: true });
        return;
      }
      const correction = !conversationState || hasExplicitCorrection(message);
      const localResponse = (facts.datePreference && localDatePreferenceResponse(groundedState, facts.datePreference))
        || localFactsResponse(eventState, facts)
        || ((!eventState.eventType || correction) && localEventTypeResponse(eventState, message))
        || localEventTypeUncertaintyResponse(eventState, message, conversationState?.expectedField, lastAssistantMessage)
        || localMissingDataGuidance(groundedState, message, conversationState?.expectedField, lastAssistantMessage)
        || ((!eventState.date || correction) && localRelativeDateResponse(eventState, message, referenceDate))
        || localGreetingResponse(eventState, message, conversationStarted) || localServiceResponse(eventState, message);
      if (localResponse) { respond(localResponse); return; }
      const provider = env.AI_PROVIDER || 'groq';
      if (!['groq', 'xai'].includes(provider)) throw new RequestError(503, 'Configura AI_PROVIDER como groq o xai en .env.local.');
      const keyName = provider === 'groq' ? 'GROQ_API_KEY' : 'XAI_API_KEY';
      const key = env[keyName]?.trim();
      if (!key) throw new RequestError(503, `Falta configurar ${keyName} en .env.local. Añade la clave y reinicia el servidor.`);
      const url = provider === 'groq' ? 'https://api.groq.com/openai/v1/chat/completions' : 'https://api.x.ai/v1/chat/completions';
      const model = provider === 'groq' ? (env.GROQ_MODEL || 'openai/gpt-oss-20b') : (env.XAI_MODEL || 'grok-4.7');
      // Una petición normal; solo un retry si el contenido JSON no es válido.
      for (let attempt = 0; attempt < 2; attempt++) {
        const upstream = await fetchImpl(url, {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
          body: JSON.stringify({
            model,
            messages: [{ role: 'system', content: SYSTEM_PROMPT }, { role: 'user', content: buildPlannerContext(eventState, message, { ...options, retry: attempt > 0 }) }],
            stream: false, temperature: 0.15,
            response_format: provider === 'groq' && model.startsWith('openai/gpt-oss') ? EVENT_RESPONSE_FORMAT : { type: 'json_object' },
            ...(provider === 'groq' ? { max_completion_tokens: 350, ...(model.startsWith('openai/gpt-oss') ? { reasoning_effort: 'low', include_reasoning: false } : {}) } : { max_tokens: 350 }),
          }),
        });
        if (!upstream.ok) {
          const detail = await upstream.json().catch(() => ({}));
          const errorCode = detail?.error?.code;
          if ([400, 422].includes(upstream.status) && ['json_validate_failed', 'schema_validation_failed'].includes(errorCode)) {
            if (attempt === 0) continue;
            respond(safePlannerResult(groundedState, { ...options, message })); return;
          }
          // No devolver errores originales: podrían incluir detalles sensibles del proveedor.
          if ([401, 403].includes(upstream.status)) throw new RequestError(502, 'El proveedor no aceptó la clave o los permisos. Revisa tu configuración.');
          if (upstream.status === 429) throw new RequestError(429, 'Se alcanzó el límite del proveedor. Espera un poco o revisa tu cuota.', true);
          if (upstream.status === 402) throw new RequestError(502, 'El proveedor requiere créditos para continuar. Revisa el saldo de tu cuenta.');
          if (upstream.status === 404 || errorCode === 'model_not_found') throw new RequestError(502, 'Revisa el modelo configurado y que esté disponible para tu cuenta.');
          if ([400, 422].includes(upstream.status)) throw new RequestError(502, 'El proveedor no pudo procesar esta solicitud. Inténtalo de nuevo; no es necesario cambiar tus datos.');
          throw new RequestError(502, 'El servicio de IA no está disponible ahora. Inténtalo de nuevo en un momento.', true);
        }
        const data = await upstream.json();
        const answer = data?.choices?.[0]?.message?.content;
        let validated;
        try { validated = validateModelResult(answer); } catch {
          if (attempt === 0) continue;
          respond(safePlannerResult(groundedState, { ...options, message }));
          return;
        }
        respond(finishPlannerResult(eventState, validated, message, options));
        return;
      }
    } catch (error) {
      if (sendSafeFallback && (controller.signal.aborted || !(error instanceof RequestError) || error.recoverable)) {
        sendSafeFallback();
        return;
      }
      const partial = preservedState ? { eventState: preservedState, conversationState: preservedConversation } : {};
      if (controller.signal.aborted) reply(response, 504, { error: 'La respuesta tardó demasiado. ¿Lo intentamos de nuevo?', ...partial });
      else if (error instanceof RequestError) reply(response, error.status, { error: error.message, ...partial });
      else reply(response, 502, { error: 'No pude conectar con la IA. Comprueba tu conexión e inténtalo de nuevo.', ...partial });
    } finally {
      clearTimeout(timeout);
      response.off('close', disconnect);
      running--;
    }
  };
}
