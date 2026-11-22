# Despliegue de CreafIA en Vercel

El repositorio incluye `vercel.json`, la aplicación Vite y `api/index.js` para ejecutar las rutas `/api/*` como función de Vercel.

## Configuración del proyecto

1. Importa `MIAkeDev/Creaf.IA` en Vercel. Usa el framework **Vite**, la raíz del repositorio como directorio y el comando `npm run build`.
2. Configura estas variables en **Project Settings → Environment Variables** para Production (y Preview si vas a usar despliegues de prueba):

| Variable | Uso |
|---|---|
| `VITE_SUPABASE_URL` | URL pública de tu proyecto Supabase; se incluye en el frontend |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Clave publicable de Supabase; se incluye en el frontend |
| `SUPABASE_URL` | La misma URL, para la función API |
| `SUPABASE_PUBLISHABLE_KEY` | La misma clave publicable, para la función API |
| `SUPABASE_SECRET_KEY` | Clave secreta, solo para la función API |
| `GROQ_API_KEY` | Clave de Groq, solo para la función API |
| `AI_PROVIDER` | `groq` |
| `GROQ_MODEL` | Modelo habilitado para tu cuenta, por ejemplo `openai/gpt-oss-20b` |
| `VITE_PROVIDER_WHATSAPP` | Número público para el botón de WhatsApp, con código de país |

No añadas `VITE_` a una clave secreta. Las variables usadas en el build deben configurarse antes de desplegar; después de cambiarlas, vuelve a desplegar.

3. Ejecuta en Supabase las migraciones de `supabase/migrations/` si no están aplicadas. Los proveedores de producción se guardan en Supabase, no en `data/providers.json`. El catálogo local y las imágenes locales están excluidos del repositorio.
4. En **Supabase → Authentication → URL Configuration**, establece **Site URL** con el dominio de Vercel y añádelo a **Redirect URLs**. Conserva la URL local si también trabajas en tu equipo.
5. Comprueba portada, conversación, registro/inicio de sesión, perfil, panel y una propuesta. El acceso de administración depende de `admin_users` en Supabase.

El acceso con Google requiere configurar además el proveedor Google en Supabase y el cliente OAuth en Google Cloud. El botón aparece cuando Supabase informa que Google está habilitado.

Los enlaces de WhatsApp del panel abren mensajes preparados al número de cada proveedor. El envío se hace manualmente desde la sesión de WhatsApp abierta en el navegador.
