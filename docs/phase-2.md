# Fase 2 · Catálogo y propuestas de eventos

## Arquitectura implementada

Se conserva React 19 + TypeScript + Vite y el backend de middleware que ya atendía /api/chat. No se crea otro servidor. El panel es una ruta de la SPA cargada de forma diferida; los formularios y las propuestas reutilizan los colores, tipografía, radios, fondos acuáticos y avatar existentes. No se modifican los archivos CSS del chat ni la mascota.

```text
Chat → ConversationState validado → ready sin aclaraciones
  → POST /api/proposals → providers.json → filtros + scoring + combinaciones
  → DTO público → mensaje event_proposals dentro de la conversación

/admin/providers → API interna → validar → escritura atómica de providers.json
```

Groq mantiene su función de interpretar conversación. No recibe el catálogo ni genera recomendaciones, importes, explicaciones o tarjetas. El motor es determinista y no importa clientes de IA. La interfaz conserva el ciclo thinking → searching → friendly y ThoughtLine durante la comparación. Las búsquedas se deduplican por requisitos, modo de alternativas y revisión; un cambio de presupuesto/servicios vuelve a comparar. Los resultados anteriores quedan consultables, pero sus acciones se deshabilitan cuando ya no corresponden al estado actual.

EventState, expectedField, partes de fecha, ambigüedad y sus validadores conservan sus campos y reglas. Solo se actualizan los textos que anunciaban la búsqueda para una futura fase, ahora ya disponible.

## Abrir y usar el panel

```powershell
npm.cmd install
npm.cmd run dev
```

Abre `/admin/providers` en la dirección que muestre Vite, normalmente `http://localhost:5173/admin/providers`. Funciona también con `npm.cmd run preview`, junto a las APIs del backend local.

El panel permite buscar por nombre/categoría/ciudad, filtrar categoría y estado, crear, editar, activar/desactivar y eliminar. El formulario se divide en Negocio, Contacto privado, Servicios y Evidencias. Una categoría nueva se escribe directamente en el campo de categoría. Se pueden añadir varios paquetes por proveedor y varias inclusiones por paquete.

En Evidencias se pueden subir fotos JPG, PNG y WebP desde el equipo, con conversión a WebP, orientación y dimensiones máximas 1600 × 1600. Se guardan en `data/provider-images/` y el proveedor conserva sus referencias. También se aceptan rutas existentes bajo public o URL HTTPS de `images.unsplash.com` / `images.pexels.com`. Se muestra preview y se puede elegir la portada. No hay almacenamiento externo. Las fotos deben revisarse y no contener logos, nombres ni contactos. Límites y persistencia en [provider-images.md](provider-images.md).

## Persistencia y endpoints

La fuente de verdad es `data/providers.json`, fuera de public. El adaptador `createProviderStore()` expone list/create/update/remove y puede sustituirse por otro almacenamiento sin cambiar el motor.

| Método | Ruta | Uso |
|---|---|---|
| GET | /api/admin/providers | Lista privada del panel |
| POST | /api/admin/providers | Crear proveedor con ID del servidor |
| PUT | /api/admin/providers/:id | Reemplazar datos validados de un proveedor |
| DELETE | /api/admin/providers/:id | Eliminar proveedor |
| GET | /api/service-options | Categorías públicas por evento, ciudad y capacidad |
| POST | /api/proposals | Comparar un ConversationState completo |
| GET | /api/proposal-images/:providerId/:index | Evidencia por ID sin publicar la ruta original |

Guardar ejecuta la misma validación en frontend y backend, serializa las mutaciones y escribe primero un archivo temporal que se renombra sobre el catálogo. Una búsqueda posterior lee los datos actualizados sin reiniciar. Los archivos temporales se limpian. Los precios, capacidades, rating, textos, listas, IDs y fuentes de imágenes se validan; hay límites de tamaño de solicitud y de registro. Los errores de catálogo no entregan su contenido al navegador.

El servidor se mantiene en loopback. Las APIs nuevas comprueban host, origen y dirección local; el panel no tiene login, conforme al alcance del MVP local. Una persona con acceso al panel local puede consultar los datos internos: no se presenta esto como autenticación de producción. Antes de publicar ese panel fuera del equipo necesitará control de acceso. Vite bloquea la lectura directa de data y server. El resultado público no depende de ocultar campos con CSS.

## Catálogo activo

El catálogo contiene los proveedores registrados desde el panel. El cuestionario consulta sus categorías por ciudad y tipo de evento; las capacidades se muestran cuando no cubren la cantidad solicitada. La actualización del catálogo y los diagnósticos se documentan en [catalog-search.md](catalog-search.md).

## Búsqueda y puntuación

`server/proposals/providerSearch.mjs` filtra proveedor activo, ciudad normalizada, categoría/alias, tipo de evento, capacidad mínima/máxima y precio individual compatible con el margen permitido. No relaja ciudad, tipo o aforo al permitir alternativas. Los estilos son una preferencia puntuable, no una restricción que elimine todas las opciones.

`calculateProviderScore()` devuelve una puntuación reproducible con estos máximos, modificables en config.mjs:

| Factor | Peso máximo |
|---|---:|
| Precio próximo a una asignación orientativa por categoría | 30 |
| Capacidad compatible documentada | 25 |
| Tipo de evento compatible | 20 |
| Estilo | 10 |
| Rating registrado | 10 |
| Verificado | 5 |

Los contadores públicos son proveedores únicos y paquetes realmente compatibles. Un proveedor con dos paquetes cuenta una vez en proveedores y dos en servicios. No se anuncian cientos de empresas ni estadísticas inventadas.

## Combinaciones y porcentajes

`server/proposals/proposalEngine.mjs` elige un paquete por servicio/categoría requerida. Trabaja en céntimos para evitar errores de suma. Utiliza exclusivamente priceFrom o un fixedPrice explícito; priceTo no se interpola ni se convierte en un precio inventado. El formulario captura el precio del paquete para su rango de personas, no un precio por persona. Un servicio de cotización sin precio conocido no se trata como gratuito. Los precios se muestran como iniciales/estimados, sin afirmar disponibilidad ni cotización final.

Los porcentajes están en **`server/proposals/config.mjs`**:

```javascript
bands: {
  saving:      { min: .80, max: .92, target: .88 },
  recommended: { min: .95, max: 1, target: .99 },
  upgrade:     { min: 1.03, max: 1.15, target: 1.09 },
},
alternativeUpgradeMax: 1.25
```

Primero busca mejor ajuste, después ahorro y mejora. Usa precio, score y una bonificación por diversidad para no repetir proveedores sin necesidad. Una mejora se explica comparando características registradas, inclusiones y puntuación de calidad con la recomendada; no se considera mejora simplemente cobrar más. Las razones, diferencias y etiquetas son plantillas de código.

Los rangos son objetivos. Cuando no hay una combinación dentro del rango, se puede mostrar una combinación completa más cercana respetando el presupuesto/margen y su diferencia real. Si hay varias opciones de la misma banda, se etiquetan como alternativas; no se inventan ahorros o mejoras para forzar tres etiquetas distintas. Solo se muestran combinaciones distintas disponibles: una, dos o hasta tres. Si faltan servicios o el coste no cabe, se muestra el estado vacío.

El motor tiene un límite configurable de 100000 nodos para evitar bloquear el proceso si el catálogo crece mucho; `searchLimited` informa si se alcanzó. Es suficiente para el catálogo MVP y no pretende ser un optimizador global para catálogos grandes.

Caso verificado con el catálogo registrado: baby shower en Ilo, 20 invitados, Bartender / bebidas, presupuesto S/5000 o S/37400. En ambos casos aparece el paquete registrado desde S/200. Para 500 invitados se informa la capacidad de 10–25 personas sin recomendar aumentos de presupuesto.

## Privacidad de la respuesta pública

`Provider` y `PublicProviderPreview` son tipos separados. La proyección pública en `server/proposals/public-preview.mjs` construye una lista explícita de campos, sin propagar el proveedor privado con spread.

No incluye businessName, phone, whatsapp, instagram ni address. También limpia esos valores conocidos y patrones de contacto de los textos públicos. Las imágenes se referencian por IDs y el proxy no publica la URL original. El navegador del chat no solicita `/api/admin/providers` ni descarga providers.json. Las fotos siguen requiriendo revisión visual para que no revelen identidad por su contenido.

## Acciones y resultados en el chat

Los mensajes ahora distinguen text y event_proposals. EventProposalResults dibuja las tarjetas, EventProposalCard muestra importes e inclusiones y ProposalDetailsSheet abre el detalle en un dialog/bottom sheet, sin cambiar de página. Se puede cerrar por botón, Escape o fondo. En móvil las tarjetas se apilan y la recomendada aparece primero; el input del chat sigue disponible fuera del modal.

Sin coincidencias se explica la causa concreta. Solo se ofrece cambiar presupuesto o ampliar el margen si los precios conocidos lo justifican; por capacidad se permite corregir invitados. Quitar servicios y volver a comparar siguen disponibles. Son acciones locales con EventState + /api/proposals, sin /api/chat ni Groq. Si se quitan todos los servicios, vuelve el selector y la conversación deja de estar ready hasta confirmar una selección.

## Archivos creados

- `data/providers.json`.
- `shared/provider-validation.mjs` y `.d.mts`.
- `server/providers/store.mjs`, `server/providers/api.mjs` y `server/providers/service-options.mjs`.
- `server/proposals/config.mjs`, `providerSearch.mjs`, `public-preview.mjs` y `proposalEngine.mjs`.
- `server/providers.test.mjs`.
- `src/types/provider.ts`, `src/types/proposal.ts` y `src/services/providers.ts`.
- `src/components/admin/ProviderAdmin.tsx`, `ProviderList.tsx`, `ProviderForm.tsx`, `ProviderServiceForm.tsx`, `ProviderImages.tsx` y `providers.css`.
- `src/components/proposals/EventProposalResults.tsx`, `EventProposalCard.tsx`, `ProposalProviderPreview.tsx`, `ProposalDetailsSheet.tsx` y `proposals.css`.
- `eslint.config.mjs` y este documento.

## Archivos modificados

- `vite.config.mjs`: incorpora las APIs al mismo servidor y bloquea data.
- `src/main.tsx`: ruta admin diferida y props de resultados.
- `src/types/monkey.ts`, `src/components/ChatMessage.tsx`, `ChatWindow.tsx` y `src/hooks/useMonkeyState.ts`: mensajes ricos, búsqueda al estar ready y acciones simples.
- `src/services/ai.ts`: preserva cause al envolver un error para pasar el lint, sin alterar el contrato.
- `shared/event-questions.mjs`, `shared/conversation-state.mjs`, `server/event-planner.mjs` y `server/event-planner-system.v1.mjs`: textos de transición a la búsqueda actual; no cambia la lógica de requisitos.
- `server/chat.test.mjs`: una expectativa de texto que antes decía que no había catálogo.
- `package.json`, `package-lock.json`, `.gitignore`, README y documentación: scripts, herramientas de lint, archivos temporales y guía de Fase 2.

## Verificación

```powershell
npm.cmd run lint
npm.cmd run typecheck
npm.cmd run test:api
npm.cmd run build
```

182 pruebas: las 143 de conversación existentes y 39 del catálogo/motor/API. Se cubren compatibilidad, ciudad, capacidad, tipo de evento, inactivos, scoring, las tres bandas, presupuesto bajo, una/dos/cero combinaciones, precios registrados, DTO sin identidad/contactos, formularios inválidos, creación/edición/desactivación/eliminación, escritura concurrente, fecha manipulada y catálogo corrupto.

Chromium a 390×844 y 1440×1000: tres propuestas, evidencias, detalle y Escape, corrección de invitados y búsqueda nueva, presupuesto bajo, ajuste de presupuesto, quitar servicios y alternativas sin consultas al chat. Panel: formulario inválido, creación, persistencia al recargar, edición, desactivación, filtros y eliminación del registro temporal. Sin errores de ejecución ni desbordamiento horizontal. Una consulta real de Groq con requisitos y servicios también llegó al motor y a sus tarjetas; las búsquedas y detalles no añadieron peticiones de IA. Vite preview también se verificó con panel, propuestas e imágenes.

Evidencias en `output/phase2-verification.json`, `phase2-proposals-390.png`, `phase2-proposals-1440.png`, `phase2-detail-390.png`, `phase2-detail-1440.png`, `phase2-admin-390.png`, `phase2-admin-1440.png` y `phase2-admin-form-390.png`. Los registros temporales de QA se eliminan; el catálogo conserva los proveedores registrados; los datos sintéticos originales se archivaron.

No se incorporan pagos, reservas, cuentas de proveedores, PostgreSQL, embeddings, RAG, WhatsApp ni infraestructura externa. Además de las herramientas de desarrollo, Sharp procesa las fotos subidas únicamente en el servidor.

## Modelo Provider completo

```typescript
export type ProviderService = {
  id: string;
  name: string;
  category?: string;
  eventTypes: string[];
  priceFrom: number;
  priceTo?: number;
  priceModel?: 'from' | 'fixed' | 'range' | 'customQuote';
  fixedPrice?: number;
  guestMin?: number;
  guestMax?: number;
  styles: string[];
  includes: string[];
  description?: string;
  availableForCustomQuote?: boolean;
};
export type Provider = {
  id: string;
  businessName: string;
  category: string;
  city: string;
  verified: boolean;
  active: boolean;
  yearsExperience?: number;
  eventsCompleted?: number;
  rating?: number;
  description?: string;
  phone?: string;
  whatsapp?: string;
  instagram?: string;
  address?: string;
  coverImage?: string;
  evidenceImages: string[];
  services: ProviderService[];
};

```

## Modelo EventProposal y DTO público

El tipo vigente en `src/types/proposal.ts` añade `blockers`, `minimumTotal` y `canAllowAlternatives` al resultado siguiente.

```typescript
export type PublicProviderPreview = {
  providerId: string;
  serviceId: string;
  category: string;
  serviceName: string;
  price: number;
  priceKind: 'from' | 'fixed';
  yearsExperience?: number;
  eventsCompleted?: number;
  rating?: number;
  shortDescription?: string;
  evidenceImage?: string;
  evidenceImages: string[];
  includes: string[];
};
export type EventProposal = {
  id: string;
  type: 'saving' | 'recommended' | 'upgrade';
  title: string;
  budget: number;
  total: number;
  difference: number;
  reason: string;
  providers: PublicProviderPreview[];
  improvedCategories: string[];
  isAlternative: boolean;
};
export type ProposalResults = {
  proposals: EventProposal[];
  compatibleProviders: number;
  compatibleServices: number;
  combinationsEvaluated: number;
  missingCategories: string[];
  selectedServices: string[];
  suggestedBudget?: number;
  allowAlternatives: boolean;
  searchLimited: boolean;
};

```
