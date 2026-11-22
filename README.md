# CreafIA

Para publicar en Vercel con Supabase y la API del proyecto, consulta [la guía de despliegue](docs/despliegue-vercel.md).

Documentación general de diseño, lógica, correcciones, system prompt y ahorro de tokens: [docs/CREAFIA-DOCUMENTACION-GENERAL.md](docs/CREAFIA-DOCUMENTACION-GENERAL.md).

Planificador de eventos para Ilo con un mono interactivo. React + TypeScript + CSS, construido con Vite. Conserva la interfaz acuática y ThoughtLine. La Fase 2 añade catálogo local de proveedores, panel interno y hasta tres propuestas calculadas sin IA dentro del chat. Guía, modelos, archivos y configuración en [docs/phase-2.md](docs/phase-2.md); lógica conversacional y prompt en [docs/event-planner.md](docs/event-planner.md).

El inicio muestra «¿Se viene una fecha importante? Cotízalo ;)» con BlurText y la indicación de tocar al mono. Desde el primer mensaje, el chat usa más ancho y alto; la mascota se mueve a la cabecera. Enviar y las acciones utilizan SpecularButton; «Ver propuesta» aparece destacado junto al precio. No se usa deslizador. Detalles y verificación visual en [docs/ui-conversation.md](docs/ui-conversation.md).

Detalles de registro, diagnóstico y corrección de búsqueda en [docs/catalog-search.md](docs/catalog-search.md).

En **Proveedores → Evidencias** puedes subir varias fotos del equipo. Se convierten a WebP, se ajustan hasta 1600 × 1600 y se guardan en `data/provider-images/`; el proveedor conserva las referencias en su JSON. Se mantiene la opción de URL/ruta. Guía: [docs/provider-images.md](docs/provider-images.md).

## Configurar la IA

1. Crea una clave en [Groq Console](https://console.groq.com/keys). Groq tiene un plan gratuito sujeto a [límites](https://console.groq.com/docs/rate-limits); revisa los modelos y límites disponibles en tu cuenta.
2. Abre `.env.local` en la raíz y completa `GROQ_API_KEY=`. No pegues la clave en el chat ni en archivos de `src/`.
3. Reinicia `npm.cmd run dev` después de guardar. No se requiere instalar otro paquete.

Se conserva `AI_PROVIDER=groq`, `GROQ_MODEL=openai/gpt-oss-20b` y tu clave actual en `.env.local`, sin modificarlos. `.env.example` es la plantilla sin credenciales. La planificación usa temperatura 0.15, razonamiento bajo, salida estructurada y un máximo de 350 tokens de salida por llamada.

Para Grok, cambia `AI_PROVIDER=xai` y completa `XAI_API_KEY`. Su clave se crea en [xAI Console](https://console.x.ai/). Groq y Grok son servicios diferentes; la [guía de xAI](https://docs.x.ai/developers/quickstart) requiere créditos.

La clave solo se usa en `server/chat.mjs` y está excluida de Git. No uses nombres `VITE_*` para secretos. El prompt está versionado en `server/event-planner-system.v1.mjs`, importado desde `server/system-prompt.mjs`. El cliente envía el último mensaje y ConversationState (evento, campo esperado, fecha parcial y aclaraciones pendientes), sin historial ni texto de la respuesta anterior. Groq recibe el evento compacto, expected_field, las partes de fecha si existen y el último mensaje; las categorías del catálogo solo cuando se esperan servicios. No acepta roles, claves, modelos o URL enviados desde el navegador. Se restringe el tema a eventos; estas instrucciones no equivalen a una garantía absoluta contra prompt injection. No hay herramientas ni acceso a archivos.

Verificación actual: 199 pruebas (143 de conversación, 48 de proveedores y 8 de imágenes), ESLint, TypeScript y build. Chromium a 390 y 1440 px: propuestas dentro del chat, detalle, correcciones, acciones sin Groq, CRUD persistente y carga múltiple de fotos con portada y recarga; sin errores de ejecución ni desbordamiento horizontal. Una consulta real a Groq con requisitos y servicios también llegó correctamente a las propuestas.

El panel está en `/admin/providers` (normalmente http://localhost:5173/admin/providers). Guarda negocio, contacto privado, paquetes e imágenes en `data/providers.json` mediante la API del mismo Vite. El catálogo activo contiene únicamente los proveedores registrados. El cuestionario consulta sus categorías, eventos y capacidades; los registros sintéticos originales se retiraron con respaldo privado. El admin es local y sin login. El DTO público excluye nombres comerciales y contactos; el archivo del catálogo está bloqueado por HTTP.

Al completar EventState se filtra por ciudad, categoría, tipo de evento, capacidad y precios; el motor genera ahorro, mejor ajuste y mejora con importes registrados. Los resultados explican si falta un servicio, capacidad, cobertura por ciudad/evento o presupuesto. Solo se propone subir el presupuesto si el precio mínimo registrado de todos los servicios lo requiere. Porcentajes y límites en `server/proposals/config.mjs`. Si hay menos combinaciones válidas se muestran solo las existentes. Precios iniciales y disponibilidad pendiente; no hay reservas ni pagos.

El modelo devuelve solo `reply` y `updates`, con `ambiguities` opcional. El código valida cambios por campo, calcula `missingFields` y decide `collecting/ready`. “Para 350 el 18 noviembre” pregunta qué representa 350 y de qué año es la fecha, sin guardar suposiciones. Detalles del esquema, validación y fallback en [docs/ambiguity-validation.md](docs/ambiguity-validation.md).

El servidor decide `expectedField` y el cliente lo conserva junto al evento. Tras “un quince son 50 personas tengo 500 soles”, espera fecha: “el 12” guarda el día y pregunta mes; “noviembre” guarda mes y pregunta año; “2026” completa `2026-11-12` y continúa con los servicios. Los 50 invitados y S/500 se mantienen. Tipo, prioridad, archivos y pruebas en [docs/conversation-state.md](docs/conversation-state.md).

Cada consulta usa fecha y hora actuales del servidor en `America/Lima`, la zona de Ilo. El modelo recibe `reference_date`, `reference_time` y `time_zone`. “Este año” completa el año actual; “este mes” completa mes y año actuales. El día pendiente se pregunta y los cambios de mes/año se calculan con la hora local, sin depender de la zona horaria del equipo donde corre el servidor.

“Hoy”, “ahora” y “ahora mismo” indican el día local cuando responden por la fecha. “Ahora tengo 5000 soles” modifica presupuesto sin cambiar la fecha. La [plantilla general de system prompt](docs/system-prompt-general.md) reúne las reglas para reutilizarlas en otros dominios e indica qué validación y estado deben acompañarlas en código.

`npm.cmd run dev` y `npm.cmd run preview` incluyen el endpoint **local**, ligado a 127.0.0.1. Subir únicamente `dist/` a un hosting estático no despliega el backend. Antes de publicar, será necesario un servidor con secretos y controles de acceso/cuota apropiados. Las respuestas se reciben completas, todavía sin streaming.

## Ejecutar en Windows / PowerShell

```powershell
npm.cmd install
npm.cmd run dev
```

Abre la dirección local que muestra Vite (normalmente http://localhost:5173).

```powershell
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run test:api
npm.cmd run build
npm.cmd run preview
```

Se usa `npm.cmd` porque PowerShell puede bloquear `npm.ps1`. No es necesario cambiar la política de ejecución.

## Probar

Cuando solo falta elegir servicios, aparece un formulario pequeño dentro del chat: permite marcar todos, elegir individualmente y omitir servicios después. Guardar la selección actualiza EventState y la confirmación de forma local, sin otra llamada a Groq. La selección sigue siendo editable y también puedes pedir servicios personalizados por el chat. Las preguntas de fecha usan ejemplos con día, mes y año, sin tratar esos ejemplos como datos reales. Si el usuario indica una fecha relativa interpretable, el servidor la convierte en una fecha concreta, la guarda y continúa con lo pendiente.

“¿Cuáles sugieres?” devuelve las opciones registradas del catálogo y abre el selector incluso si faltan otros datos, sin confirmar ningún servicio. “Ok” o “está bien” no significa aceptar todos ni permite completar campos inventados. Estas preguntas simples se responden localmente sin llamar a Groq; las preguntas mixtas conservan los nuevos datos explícitos y bloquean selecciones inferidas.

El chat incluye `src/components/ThoughtLine.tsx` y su CSS: respiración de texto, destello, pasos en español, cronómetro, transición de cierre de 350 ms y detalles desplegables. Cada consulta conserva su tiempo de espera antes de la respuesta. El componente admite las props del ejemplo, incluido `onSettle(seconds)`, y `activeStep` para sincronizar los pasos con el estado del mono. Es un indicador visual de espera, no un registro del razonamiento interno de una IA. No requiere dependencias nuevas.

El contexto explícito sustituye la deducción de la pregunta anterior. Con expectedField=guestCount, “500” responde invitados; con budget, responde presupuesto; con date, las cifras de una fecha se conservan como partes de fecha. Sin campo esperado, una cifra aislada requiere aclaración. Se aceptan varios datos nuevos juntos y las correcciones explícitas sustituyen los anteriores. La ruta antigua con lastAssistantMessage se mantiene solo por compatibilidad; la web ya no la utiliza. Tanto el evento como la fecha parcial sobreviven a errores del proveedor.

Verificado en Chromium: temporizador, cierre automático, expansión manual, segundo mensaje, `/error`, movimiento reducido y ausencia de errores de ejecución. Typecheck y build correctos.

1. Toca el mono dormido o actívalo con Tab y Enter/Espacio. Espera al despertar.
2. Escribe y pulsa Enter o el botón Enviar. Antes del primer mensaje también puedes tocar al mono central para enviar; después queda pequeño en la cabecera. Shift+Enter añade una línea.
3. Prueba “Tengo 5 mil soles para el cumpleaños de mi mamá, ¿qué proveedores sugieres?”. Debe conservar evento y presupuesto y preguntar fecha/invitados, sin inventar proveedores. Completa los datos y corrige después “En realidad serán 80”. Al enviar: thinking → searching → friendly; escribir también lo pone friendly.
4. Toca el mono sin texto: hace una reacción sin crear mensajes. Durante la respuesta no acepta nuevos envíos.
5. Escribe `/error` para probar el error y la recuperación.
6. Espera 45 segundos sin interacción: vuelve a dormir. Comprueba también móvil, teclado y movimiento reducido.

## Archivos

- `src/main.tsx`: entrada y composición de la aplicación.
- `src/components/`: mono con SVG de respaldo, pantalla inicial, mensajes, conversación e input.
- `src/hooks/useMonkeyState.ts`: secuencias, bloqueo de envíos, cancelación e inactividad.
- `src/services/ai.ts`: cliente del endpoint local, conserva AbortSignal y envía mensaje + ConversationState.
- `server/chat.mjs`: conexión con el proveedor, validación y errores sin exponer detalles sensibles.
- `server/system-prompt.mjs`: entrada estable del prompt versionado, separado de la clave y de los mensajes del usuario.
- `server/chat.test.mjs`: pruebas locales de la API con proveedor simulado; no usan claves reales ni créditos.
- `vite.config.mjs`: endpoint local para desarrollo y preview; bloquea solicitudes HTTP de archivos del servidor y de `.env`.
- `src/config/timings.ts`: tiempos configurables.
- `src/types/monkey.ts`: tipos de estados y mensajes.
- `src/styles/`: variables, diseño responsive y animaciones CSS.
- `public/avatar/`: lámina del mono con las expresiones.
- `index.html`, `package.json`, `package-lock.json`, `tsconfig.json`, `.gitignore`: configuración del proyecto.

## Decisiones

La carpeta solo contenía `hola.md` vacío, que se conserva. Se inicializó React y TypeScript con Vite y únicamente las dependencias necesarias para ejecutarlos; no se añadieron librerías de UI o animación. Se usa tipografía del sistema y un personaje SVG original para que los assets externos sean opcionales. No hay persistencia: recargar inicia una sesión nueva. No hay script de lint ni se instaló un linter adicional.

## Rediseño Aqua / Ghost Water

La portada sigue la referencia del saludo central con personajes que asoman por los bordes. La paleta es azul agua con reflejos animados, burbujas transparentes y ondas alrededor del mono. Se respeta movimiento reducido. En la conversación el mono aparece únicamente arriba; las respuestas tienen una pequeña firma de texto.

El personaje ahora usa `public/avatar/monkey-atlas.png`, creado a partir de la referencia del usuario mediante image_gen integrado. El mapeo de las seis expresiones está en `src/components/MonkeyAvatar.tsx`; confused reutiliza pensando con un signo de interrogación. `public/avatar/README.md` documenta el prompt y el formato de la lámina. El SVG queda como respaldo si falla el asset.

La portada coloca el saludo, la instrucción y el mono en filas de una misma cuadrícula, evitando superposiciones al cambiar la altura. Se retiraron los lemas pequeños en mayúsculas, las etiquetas de edición y las firmas repetidas. Los textos secundarios tienen tamaños legibles y espaciado normal. Ajustes en `src/styles/refinements.css`. Verificación en Chromium: sin solapamiento entre texto y mono en 1806×892, 1440×900, 390×844, 360×800, 430×932, 768×1024 y 844×390; capturas `output/refined-*.png`.

Verificación del rediseño: typecheck y build correctos. Navegador Chromium: portada, entrada al chat, envío con Enter y con el mono, respuesta, `/error`, recuperación, sin desbordamiento horizontal en 360, 390, 430, 768 y 1440 px, movimiento reducido y ausencia de errores de ejecución. Capturas en `output/`.
