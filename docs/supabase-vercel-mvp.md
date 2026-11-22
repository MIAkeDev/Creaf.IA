# CreafIA: cuentas, solicitudes y despliegue

Estado al 17 de noviembre de 2026: la migración se ejecutó en Supabase y se importaron 21 proveedores con 21 fotos WebP sin modificar precios públicos. Se comprobó que la clave pública no puede leer `provider_records` ni `quotation_private`; la API pública devolvió servicios y propuestas sin costos ni contactos. Una cuenta temporal confirmada permitió probar login, perfil, cotización persistente, reintento idempotente, historial, cierre de sesión y permisos; se eliminó junto con su cotización al terminar. Google sigue desactivado en Supabase y la entrega real de correos de confirmación no se ha probado. Vercel sigue pendiente. La clave secreta se compartió en la conversación; se recomendó reemplazarla y el propietario decidió conservarla.

### Revisión de publicación del 20 de noviembre de 2026

El chat ahora usa el modelo para interpretar respuestas breves y mensajes mixtos con más contexto, mientras el código conserva los datos confirmados y bloquea contactos de proveedores. Una caída temporal del modelo devuelve una respuesta segura sin perder lo entendido. Pasaron 223 pruebas de API, TypeScript, ESLint y build; se probaron tres turnos con el modelo real. Las variables requeridas están configuradas en `.env.local`, pero deben configurarse también en Vercel: el proyecto todavía no está vinculado ni desplegado. Una consulta de solo lectura confirmó 21 proveedores y cero filas en `admin_users`. Antes de abrir el panel al público, el propietario debe crear su cuenta y agregar su UUID verificado a `admin_users`. Google permanece pendiente para una fase posterior.

### Registro actualizado

El alta pide nombre, correo válido, contraseña y una suma sencilla con un campo oculto para frenar automatizaciones básicas. El nombre se guarda en los metadatos de Auth y se copia a las cotizaciones generadas y solicitudes. Cambiarlo en el perfil actualiza esos metadatos. El 20 de noviembre se consultó la configuración pública de Supabase: `mailer_autoconfirm=true` y `disable_signup=false`, por lo que el alta nueva no requiere enlace de confirmación. Si esa configuración cambia, el frontend no puede omitir la confirmación impuesta por Supabase. La suma del formulario no sustituye un CAPTCHA verificado por Supabase; para protección contra bots a escala debe configurarse Turnstile o hCaptcha en Auth y pasar `captchaToken` desde el formulario.

### Actualización posterior: registro y cotizaciones generadas

El registro ahora vuelve al formulario de inicio de sesión con el correo conservado y un aviso que explica si debe confirmarse el correo. Cuando Supabase devuelve una sesión inmediata, la interfaz la cierra para que el siguiente paso sea entrar con la misma contraseña. Si el correo no está confirmado, se puede solicitar otro enlace desde el formulario. Este comportamiento no modifica la opción **Confirm Email** del proyecto: con ella activa, Supabase exige abrir el enlace antes de entrar. Para permitir entrada inmediata, el propietario puede desactivar **Confirm Email** en **Authentication → Providers → Email**. Eso implica aceptar cuentas con direcciones no verificadas; una cuenta ya creada y pendiente puede requerir confirmar su enlace o resolverla desde **Authentication → Users**.

Antes de usar el guardado de cotizaciones generadas, ejecuta en **SQL Editor** [202611170001_generated_quotes.sql](../supabase/migrations/202611170001_generated_quotes.sql). La aplicación guarda las opciones calculadas de una cuenta autenticada en `generated_quotes`, deduplicadas por evento y resultado, y las muestra en **Mis cotizaciones** y en la sección administrativa **Cotizaciones generadas**. El servidor recalcula las opciones desde el catálogo antes de guardarlas. Las solicitudes de coordinación siguen en `quotations`. Sin esta segunda migración, el guardado de opciones generadas devolverá un error y la interfaz lo notificará.

Google OAuth requiere un Client ID y Client Secret de Google Cloud configurados en **Authentication → Providers → Google** de Supabase. Hasta habilitarlo allí, la web muestra que no está disponible. La URL de callback de Google para este proyecto es `https://egyktelwelomnyafzkyh.supabase.co/auth/v1/callback`; la URL final de la web se configura por separado en **Authentication → URL Configuration**.

### Cómo se registra una persona en la web

Las personas solo usan **Cuenta → Registrarse** en CreafIA. Pueden escribir una dirección Gmail, Outlook u otra dirección válida y una contraseña creada para CreafIA. No necesitan entrar al panel de Supabase. **Continuar con Google** es otra forma de entrar: usa la cuenta de Google y no requiere crear una contraseña para CreafIA. Supabase mantiene la sesión entre recargas mediante `persistSession`.

La comprobación del proyecto el 17 de noviembre devolvió `email: true`, `google: false`, `disable_signup: false` y `mailer_autoconfirm: false`: el registro está permitido, Google no está habilitado y el correo debe confirmarse. Un enlace con `error_code=otp_expired` venció o ya se utilizó; ahora la web limpia ese error de la URL, abre el acceso y ofrece reenviar la confirmación. El botón **Iniciar sesión** solo aparece cuando no existe una sesión; durante la carga del estado se muestra «Comprobando sesión…».

Para hacer registro público con confirmación, configura un SMTP propio en **Authentication → SMTP Settings**. Según la documentación actual de Supabase, el servicio de correo incluido en proyectos alojados solo envía a miembros del equipo y tiene un límite bajo de correos; no es suficiente para clientes. Para una prueba rápida sin correos, desactiva **Confirm Email** en **Authentication → Providers → Email**: las cuentas nuevas entran directamente, pero la dirección de correo no queda verificada. Si una cuenta existente sigue pendiente, confirma su enlace o resuelve ese usuario pendiente desde **Authentication → Users** antes de probar de nuevo.

En **Authentication → URL Configuration**, registra la dirección exacta usada por el navegador. Si Vite abre `http://127.0.0.1:5174/`, añade esa URL a **Redirect URLs**; una entrada para `5173` no cubre `5174`. Cuando se despliegue la web, usa su URL HTTPS real como **Site URL** y en Redirect URLs. Para Google crea una aplicación OAuth de tipo Web en Google Cloud, añade la URL de la web a **Authorized JavaScript origins** y `https://egyktelwelomnyafzkyh.supabase.co/auth/v1/callback` a **Authorized redirect URIs**. Después pega el Client ID y Client Secret en **Authentication → Providers → Google** y activa el proveedor. Esta configuración se hace una vez para todos los usuarios.

## Acción requerida del propietario: crear y configurar Supabase

1. Crea un proyecto en [Supabase](https://supabase.com/dashboard). En **Connect** o **Settings → API Keys**, copia la Project URL, la publishable key y una secret key. La secret key es solo de servidor: nunca lleva prefijo `VITE_` ni se pega en el navegador.
2. En **SQL Editor** ejecuta [la migración](../supabase/migrations/202611160001_creafia_mvp.sql). Crea `profiles`, `admin_users`, `provider_records`, `quotations`, `quotation_private`, políticas RLS y el bucket privado `provider-images`. Para probar el esquema localmente con Supabase CLI, ejecuta `supabase test db`; las aserciones están en [0001_security.sql](../supabase/tests/0001_security.sql). La prueba real queda pendiente hasta tener un proyecto o stack local de Supabase.
3. En **Authentication → Providers → Email**, activa confirmación de correo. En **Authentication → URL Configuration**, define la Site URL de producción y añade las URL permitidas `http://127.0.0.1:5173/**` y `https://TU-DOMINIO/**`. Si usas otro puerto local, añádelo. Los enlaces de registro y recuperación regresan a la raíz de cada origen.
4. Para Google, crea credenciales OAuth en Google Cloud. En Google Cloud configura como Authorized redirect URI `https://TU-REFERENCIA.supabase.co/auth/v1/callback`. Copia Client ID y Client Secret a **Authentication → Providers → Google** en Supabase y habilítalo. La redirección final a la web se controla con las URL permitidas del paso anterior.
5. Copia [.env.example](../.env.example) a `.env.local` y completa `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` y la clave de Groq que ya usa el proyecto. Las variables `VITE_` contienen únicamente datos publicables. Reinicia `npm.cmd run dev` después de cambiar variables.
6. Con la migración aplicada y las claves en `.env.local`, ejecuta **una vez** `npm.cmd run import:providers`. Importa los 21 registros actuales y sus fotos WebP guardadas en `data/provider-images/`; se niega a sobrescribir una tabla que ya contiene proveedores. Conserva el JSON original como copia local. No se interpreta ningún precio existente como costo real.
7. Regístrate con tu correo y confírmalo. En **Authentication → Users**, copia el UUID de tu usuario. En SQL Editor ejecuta `insert into public.admin_users(user_id) values ('TU-UUID');`. Solo el propietario con acceso al Dashboard debe hacer este paso. Cierra sesión y vuelve a entrar para actualizar el menú. No uses un correo escrito en el frontend como comprobación de administrador.

La documentación oficial de [Supabase Auth para React](https://supabase.com/docs/guides/auth/quickstarts/react), [claves](https://supabase.com/docs/guides/getting-started/api-keys) y [RLS](https://supabase.com/docs/guides/database/postgres/row-level-security) explica estos controles y dónde encontrarlos.

## Uso del producto

- El visitante conversa y recibe propuestas sin registrarse.
- En el detalle de la propuesta elegida pulsa **🎁 Obtén un beneficio con tu primera cotización**. Si no tiene sesión, puede registrarse o entrar con Google/correo. El chat y la propuesta pública se guardan temporalmente en `sessionStorage` para volver tras OAuth; el servidor vuelve a comprobar la propuesta antes de guardar.
- Introduce WhatsApp y consentimiento. El número se valida por formato, no por OTP. La confirmación aparece solo cuando `quotations` y el snapshot privado se han guardado en una misma transacción SQL. Un UUID de idempotencia evita duplicados por reintento.
- El servidor permite hasta cinco solicitudes nuevas por usuario y hora; un reintento de la misma solicitud no consume otra cuota.
- **Mis cotizaciones** (`/my-quotes`) solo muestra solicitudes del usuario autenticado; **Mi perfil** (`/profile`) permite guardar el nombre y el WhatsApp. Si ya existe un WhatsApp en el perfil, se propone en la siguiente solicitud para no volver a pedirlo desde cero.
- **Panel** (`/admin/providers`) exige sesión y presencia en `admin_users`, verificadas también en cada API de administración. La nueva sección **Solicitudes de cotización** lista solicitudes, estados y detalle privado. En cada proveedor se ve el paquete exacto, costo registrado, precio público, margen esperado y contacto. El enlace WhatsApp prepara un mensaje; una persona debe pulsar Enviar. Si falta el costo real, el enlace no se ofrece para evitar inventarlo.

## Precios

Los precios anteriores (`priceFrom` y `fixedPrice`) ya son públicos y siguen iguales. En **Panel → Proveedor → Servicios → Precio interno y recargo** se puede introducir el costo real. El recargo predeterminado es `DEFAULT_MARKUP_PERCENT=10`, un **10 % sobre el costo**. También se puede elegir un monto fijo por paquete. El formulario muestra costo, precio público y margen bruto antes de guardar y exige confirmar los cambios de precio. El cálculo se hace en céntimos y el servidor vuelve a calcular el precio público. La fecha de actualización se guarda solo al cambiar datos de precio.

`DEFAULT_MARKUP_PERCENT` se cambia en `.env.local` localmente o en las variables de Vercel para nuevos paquetes. Los paquetes que ya tienen `markupValue` explícito conservan su valor. Si el costo de un paquete antiguo no está registrado, su margen queda **sin registrar**; no se deduce retrospectivamente del precio público.

## Datos y permisos

La salida pública de propuestas sigue usando un DTO permitido: categorías, precio de venta, descripción y evidencias; no devuelve nombre comercial, contacto, costo real ni margen. `quotation_private` y `provider_records` no tienen permisos de lectura para `anon` o `authenticated`. `quotations` permite al usuario leer únicamente filas cuyo `user_id` coincide con `auth.uid()`; solo el servidor escribe. Las APIs privadas validan el token con Supabase Auth y el rol con `admin_users` en el servidor. No se usa un flag de admin modificable desde el navegador.

La secret key de Supabase evita RLS, por lo que **solo** se usa en el backend después de comprobar permisos. Mantén acceso al Dashboard y a las variables de despliegue limitado a administradores. El diseño sigue buenas prácticas de mínimo privilegio; no constituye una certificación ISO/IEC 27001 ni una evaluación OWASP ASVS formal.

## Vercel

El proyecto sigue siendo Vite. [vercel.json](../vercel.json) dirige `/api/*` a una función Node y las rutas de la SPA a `index.html`. La función usa Supabase para escrituras y fotos, pues el sistema de archivos de Vercel no sirve para persistencia. En Vercel selecciona la raíz del proyecto, framework **Vite**, comando `npm run build` y salida `dist`. Configura las mismas variables de entorno; `SUPABASE_SECRET_KEY` y `GROQ_API_KEY` son exclusivamente de servidor. Añade el dominio real a las URL de Auth de Supabase y al proveedor OAuth antes de probar login.

La función y sus rewrites aún requieren una prueba real en Vercel. Los límites y cuotas de los planes gratuitos pueden cambiar; revísalos al elegir plan, especialmente ejecución de funciones, Storage, Auth y correos de confirmación. El archivo `data/providers.json` permanece como respaldo local; en Vercel se usa `provider_records` y el bucket privado.

## Verificación pendiente al conectar Supabase

Prueba en un proyecto separado antes de producción: registro y confirmación por correo, Google OAuth, recuperación de contraseña, regreso a la propuesta tras redirección, creación y reintento de solicitud, lectura de **Mis cotizaciones** tras cerrar y abrir la web, acceso de A frente a B, usuario normal frente a panel, modificación manual de IDs/precios, cambios posteriores de catálogo, fotos y detalles de una solicitud histórica, enlace WhatsApp y actualización de estados. Ejecuta `supabase test db` y comprueba el tráfico de Network: las respuestas públicas no deben contener nombres, teléfonos ni costos de proveedores.

El código no implementa pagos, reservas, envíos automáticos de WhatsApp ni un descuento no definido. El beneficio de bienvenida se consulta durante la coordinación manual.

## Archivos de esta ampliación

| Área | Archivos principales |
|---|---|
| Autenticación y páginas de usuario | `src/auth/`, `src/main.tsx`, `src/components/LandingPage.tsx` |
| Botón de beneficio y retorno a propuesta | `src/components/proposals/EventProposalResults.tsx`, `ProposalDetailsSheet.tsx`, `src/hooks/useMonkeyState.ts` |
| Costos y recargos | `shared/pricing.mjs`, `shared/provider-validation.mjs`, `src/components/admin/ProviderServiceForm.tsx`, `ProviderForm.tsx` |
| Solicitudes y autorización | `server/supabase.mjs`, `server/quotes/`, `src/components/admin/QuoteAdmin.tsx` |
| Catálogo y fotos desplegados | `server/providers/supabase-store.mjs`, `server/providers/images.mjs`, `scripts/import-providers.mjs` |
| Vercel y Supabase | `api/index.js`, `vercel.json`, `supabase/migrations/`, `supabase/tests/`, `.env.example` |

## Comprobaciones hechas sin credenciales

`npm.cmd run test:api` (**215 pruebas**), `npm.cmd run typecheck`, `npm.cmd run lint` y `npm.cmd run build` pasaron en la revisión de esta ampliación. Las pruebas incluyen precio con céntimos, conservación del precio antiguo, rechazo de un ID o precio manipulado, separación del snapshot, acceso por propietario, denegación de API administrativa sin sesión y enrutamiento básico de la función Vercel. `npm audit` informó **0 vulnerabilidades** después de actualizar dependencias compatibles de desarrollo. En Edge a 1440×900 y 390×844 se revisó la portada con el icono de cuenta, el chat anónimo y una respuesta local; no hubo errores JavaScript ni desbordamiento horizontal móvil. `GET /api/admin/providers` sin sesión devolvió 401. El diálogo de acceso se comprobó centrado en móvil. Capturas: `output/mvp-landing-1440.png` y `output/mvp-landing-390.png`.

No se ejecutó OAuth real, confirmación de correo con buzón real, `supabase test db` ni despliegue Vercel. Google está desactivado en la configuración del proyecto; la interfaz consulta esa configuración y muestra el botón como no disponible. El intento de registro con `example.com` fue rechazado por Supabase como correo inválido, de modo que la entrega de confirmación requiere un correo real del propietario. La ruta de API de Vercel se probó con una petición simulada, no con una URL desplegada. La lectura del catálogo y del bucket en Supabase confirmó 21 proveedores y 21 fotos; una petición sin sesión al panel devolvió 401. La prueba temporal de Auth y cotizaciones usó una cuenta creada y confirmada por la API administrativa, sin enviar correo, y comprobó persistencia y permisos reales antes de eliminarla.




