# Ambigüedad y validación

La validación anterior exigía metadatos del modelo aunque reply/updates fueran útiles y descartaba toda una respuesta cuando un campo fallaba. Esto podía agotar el único retry y mostrar un fallback técnico. Además, el extractor completaba automáticamente el año de fechas absolutas incompletas. Ahora los cambios seguros se conservan por campo y las ambigüedades se preguntan antes de aplicar valores.

## Contrato final del modelo

El JSON Schema utilizado por Groq está en [server/event-response-schema.mjs](../server/event-response-schema.mjs). Solo exige reply y updates; cada campo de updates es opcional. Se usa strict=false para permitir cambios parciales. La validación de la aplicación es la autoridad final y tolera también la ausencia de updates.

```typescript
type ModelOutput = {
  reply: string;
  updates: {
    eventType?: string | null;
    date?: string | null;
    guestCount?: number | string | null;
    budget?: number | string | null;
    city?: string | null;
    style?: string | null;
    selectedServices?: string[] | null;
    extraRequirements?: string[] | null;
  } | null;
  ambiguities?: Array<{
    value: string;
    possibleFields: Array<'eventType' | 'date' | 'guestCount' | 'budget' | 'selectedServices'>;
  }> | null;
};
```

No se solicita missing_fields, selected_services ni status al modelo. Los metadatos de respuestas antiguas se ignoran. null significa sin cambio; una lista vacía explícita puede vaciar una selección. updates ausente, null o [] se normaliza a {}. Un campo inválido se descarta conservando los demás; si el texto podría confirmar ese campo rechazado, se reemplaza por una pregunta natural sobre lo que realmente falta. Si falta reply pero existen cambios válidos, también se genera esa pregunta.

La coerción se limita a guestCount/budget ya identificados, por ejemplo "350" → 350 y "3,500" → 3500. No convierte booleanos, null, texto con unidades ni una cifra libre en datos de un campo. Se mantienen los límites numéricos existentes y los invitados deben ser enteros positivos.

## Campos faltantes y estado

La misma implementación se comparte entre el backend y el cliente TypeScript, sin duplicar reglas. Se conserva el módulo .mjs y sus declaraciones .d.mts para que ambos entornos puedan ejecutarlo directamente.

```javascript
const REQUIRED_FIELDS = ['eventType', 'date', 'guestCount', 'budget', 'selectedServices'];
function getMissingFields(state) {
  return REQUIRED_FIELDS.filter(field =>
    field === 'selectedServices' ? state[field].length === 0 : state[field] === null
  );
}
function getEventStatus(state) {
  return getMissingFields(state).length ? 'collecting' : 'ready';
}
```

Cuando quedan aclaraciones pendientes se devuelve collecting aunque los campos anteriores ya estuvieran completos: una corrección ambigua no reemplaza lo confirmado ni permite dar por cerrada la conversación. El cliente respeta también esa condición al guardar servicios.

## Caso solicitado

Entrada: `para 350 el 18 noviembre`.

```json
{
  "reply": "¿Te refieres a 350 invitados o a S/ 350 de presupuesto? ¿De qué año sería el 18 de noviembre?",
  "updates": {},
  "ambiguities": [
    { "value": "350", "possibleFields": ["guestCount", "budget"] },
    { "value": "18 de noviembre", "possibleFields": ["date"] }
  ]
}
```

Es la representación mínima de la interpretación. La respuesta real de /api/chat contiene el EventState actualizado, missingFields y status calculados por el servidor. La ambigüedad local de fecha añade reason="missing_year" para construir la pregunta del año; no se exige ese campo al modelo.

No se guarda guestCount, budget ni date en este caso. Una respuesta "personas" guarda 350 invitados y mantiene la pregunta del año. "2026" completa 2026-11-18. También funciona contestar primero el año y después "personas". Las aclaraciones simples se resuelven localmente sin tokens; las frases que incluyen preferencias o servicios pasan por Groq para extraer el resto. Los datos locales inequívocos prevalecen sobre el modelo.

`serán 350 personas el 18 de noviembre de 2026` guarda invitados y fecha juntos. `tengo 3500 de presupuesto` guarda solo presupuesto. `en realidad serán 80` reemplaza invitados conservando el resto. Una cifra sola solo responde a una pregunta anterior inequívoca; no se asigna por ser el único campo pendiente.

## Recuperación y comprobación

Primero se intenta parsear JSON, luego extraer un objeto equilibrado aunque exista texto alrededor. Se respetan llaves y comillas escapadas dentro del texto. Si falla, hay como máximo un retry. Un segundo fallo produce una pregunta natural según los datos conservados y las ambigüedades, sin mostrar el mensaje técnico anterior. Los errores de cuota o autorización no se reintentan como si fueran errores de formato.

143 pruebas pasan con `npm.cmd run test:api`; `npm.cmd run typecheck` y `npm.cmd run build` también pasan. El contexto ahora utiliza un estado explícito de campo esperado y fecha parcial, descrito en [conversation-state.md](conversation-state.md). La validación y los límites de recuperación JSON se mantienen. Chromium verificó el flujo progresivo hasta servicios a 390 y 1440 px; Groq real reconoció preferencias y servicios con el contexto reducido.

Archivos de esta corrección: server/event-planner-system.v1.mjs, server/event-response-schema.mjs, server/model-validation.mjs (nuevo), server/event-planner.mjs, server/message-facts.mjs, server/chat.mjs; shared/event-ambiguities.mjs y .d.mts (nuevos); src/types/event.ts, src/services/ai.ts y src/hooks/useMonkeyState.ts; server/ambiguity.test.mjs (nuevo), las dos suites existentes y package.json; README.md y documentación. No se cambian estilos, componentes visuales ni dependencias.
