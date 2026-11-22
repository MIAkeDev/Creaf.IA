# Estado conversacional y fechas progresivas

El problema era deducir el campo esperado a partir del texto de la respuesta anterior. Una expresión como “el 12” no tenía una fecha completa y terminaba en la aclaración de invitados/presupuesto. Ahora el backend decide expectedField, el cliente lo conserva y los componentes de fecha se guardan entre turnos.

## Tipo

```typescript
type ExpectedField = 'eventType' | 'date' | 'guestCount' | 'budget'
  | 'selectedServices' | 'style' | null;
type PartialDate = { day?: number; month?: number; year?: number };
type ConversationState = {
  event: EventState;
  expectedField: ExpectedField;
  eventDateParts: PartialDate;
  ambiguities: EventAmbiguity[];
};
```

EventState mantiene date=null mientras falten componentes. Con los tres componentes válidos, date pasa al formato YYYY-MM-DD y eventDateParts se vacía. No se infiere el año. Las aclaraciones ambiguas se guardan aparte para no depender de repetir la última pregunta como texto.

## Prioridad

```javascript
function nextExpectedField(event, eventDateParts = {}, ambiguities = []) {
  const pending = normalizeAmbiguities(ambiguities);
  if (pending.some(item => item.possibleFields.length > 1)) return null;
  if (pending.length) return pending[0].possibleFields[0];
  if (Object.keys(eventDateParts).length) return 'date';
  return getMissingFields(event)[0] ?? null;
}
```

El orden de getMissingFields es eventType → date → guestCount → budget → selectedServices. Style es opcional y puede usarse como campo esperado, pero no impide completar el evento. Cuando el usuario pide sugerencias de servicios y no quedan partes de fecha o aclaraciones pendientes, el backend puede dar prioridad al selector. Guardar el formulario recalcula la siguiente pregunta con la misma función compartida.

El backend construye la siguiente pregunta según ese campo, aunque el modelo proponga preguntar otra cosa. Así no vuelve a pedir invitados o presupuesto confirmados cuando se está completando la fecha.

## Caso real probado

| Mensaje | Cambio | expectedField | Pregunta siguiente |
|---|---|---|---|
| un quince son 50 personas tengo 500 soles | quinceañero, 50 invitados, S/500 | date | ¿En qué fecha te gustaría celebrar el evento? |
| el 12 | eventDateParts={day:12}, date=null | date | Perfecto. ¿De qué mes sería? |
| noviembre | eventDateParts={day:12,month:11}, date=null | date | Perfecto. ¿De qué año sería? |
| 2026 | date=2026-11-12, eventDateParts={} | selectedServices | Elegir servicios en el formulario |

La secuencia completa se resuelve sin llamadas a Groq. Los 50 invitados y S/500 permanecen en todos los turnos. Luego se verificó marcar todo, confirmar servicios y corregir a 80 invitados, manteniendo fecha, presupuesto y selección.

## Reglas de interpretación

- expectedField=date: “el 12” guarda día; “noviembre” guarda mes; “2026” guarda año. También acepta mes numérico cuando se espera mes, fechas completas, día/mes sin año y fechas relativas deterministas.
- expectedField=budget + “5000” guarda presupuesto si el campo está pendiente; guestCount + “80” guarda invitados. Un campo confirmado solo cambia con corrección explícita.
- expectedField=null + “500” no se asigna: pregunta qué significa. La aclaración “personas” puede confirmar el número sin enviar la pregunta anterior al modelo.
- Unidades explícitas permiten extraer varios campos nuevos juntos, independientemente del campo esperado. Una cifra identificada como presupuesto no se consume como año.
- “En realidad serán 80 personas” sustituye invitados. “Ahora tengo 5000 soles de presupuesto” sustituye presupuesto. Corregir uno no autoriza cambios del modelo al otro.
- Se rechazan días, meses, años y combinaciones imposibles; se conservan los componentes válidos y se pregunta por la parte pendiente. No se normaliza 31 de noviembre al mes siguiente ni 29 de febrero de un año no bisiesto.
- Las preguntas, ejemplos, negaciones y alternativas de fechas no son confirmaciones. La fecha solo se guarda a partir de una interpretación determinista válida.

## Contrato y tokens

La web envía `{message, conversationState, conversationStarted}`. /api/chat valida el estado y responde con el EventResult existente y conversationState. Se conservan eventState/missingFields/status para los consumidores actuales. Los errores del proveedor también devuelven conversationState parcial y el cliente lo guarda.

Groq recibe system prompt + event_state compacto + expected_field + last_message y la referencia temporal actual (reference_date, reference_time y time_zone). event_date_parts se añade solo si existe; suggested_services, solo cuando se esperan servicios. En el primer turno se añade conversation_started=false. No se envía historial, last_question, ejemplos de fecha ni listas de campos faltantes en este flujo. La respuesta del modelo sigue siendo reply/updates con ambiguities opcional. La API anterior con eventState/lastAssistantMessage permanece compatible; las prioridades nuevas se activan con el estado explícito, que usa ya la web.

Las fechas relativas se resuelven fuera del LLM con la fecha actual en America/Lima (mismo horario que America/Bogota). La lógica anterior de recuperación de JSON y máximo un retry se conserva. No cambian proveedor, modelo, clave, temperatura, límite de salida ni dependencias.

La fecha y hora se toman una vez por petición, con zona explícita America/Lima y formato de 24 horas; el único retry conserva la misma referencia. La petición siguiente obtiene una referencia nueva. “Este año”/“el año actual” aportan solo el año, y “este mes”/“el mes actual” aportan mes y año; no asignan un día arbitrario. Funcionan tanto solos como junto a un día o mes explícitos, por ejemplo “el 12 de este mes” y “12 de noviembre de este año”. shared/event-dates.mjs genera la referencia; server/partial-date.mjs completa esas partes sin consultar al modelo. Se comprueba el cambio local de 23:59:59 del 31 de diciembre a 00:00:00 del 1 de enero, aunque en UTC ya sea enero antes de medianoche en Ilo.

“Hoy”, “ahora”, “ahora mismo”, “hoy mismo”, “el día de hoy” y “en este momento” pueden confirmar el día actual al responder por la fecha. No añaden una hora de inicio al evento. El uso discursivo de ahora/hoy para actualizar presupuesto, invitados o servicios no cambia la fecha. Las preguntas, alternativas y negaciones temporales no la confirman. Plantilla independiente del dominio: [system-prompt-general.md](system-prompt-general.md).

## Archivos

- Nuevos: shared/conversation-state.mjs y .d.mts (validación, prioridad y preguntas); server/partial-date.mjs (partes de fecha y correcciones); server/conversation-planner.mjs (protección de campos y respuesta determinista); server/conversation.test.mjs.
- Modificados: server/message-facts.mjs, server/event-planner.mjs y server/chat.mjs; server/event-planner-system.v1.mjs; src/types/event.ts, src/services/ai.ts y src/hooks/useMonkeyState.ts; package.json, README.md y documentación.
- Evidencias: output/conversation-flow.json, output/conversation-390.png y output/conversation-1440.png.

## Verificación

143 pruebas aprobadas con `npm.cmd run test:api`; `npm.cmd run typecheck` y `npm.cmd run build` correctos. No existe script de lint ni linter instalado; no se añade una dependencia para esta corrección. Chromium verificó el flujo real a 390×844 y 1440×900, sin errores de ejecución ni desbordamiento horizontal. Groq real reconoció estilo y servicios con el contexto compacto. No se modifican componentes visuales ni CSS; el archivo CSS compilado conserva el mismo hash.
