# Seguridad y respaldo del catálogo

## Qué se publica

El chat y la búsqueda de propuestas deben funcionar sin iniciar sesión, por lo que `/api/chat`, `/api/service-options`, `/api/proposals` y las imágenes de propuestas son rutas públicas. Las rutas `/api/admin/*` requieren una cuenta incluida en `admin_users`; las cotizaciones del cliente requieren su sesión. Supabase mantiene el catálogo y las imágenes en almacenamiento privado. El cliente nunca recibe la clave secreta ni el registro completo de un proveedor.

Si el presupuesto no cubre todos los servicios elegidos, `/api/proposals` entrega únicamente `budgetInsufficient`, `minimumTotal` y una lista vacía. El chat también responde con ese mínimo antes de llamar al modelo. El selector público entrega categorías y un indicador de compatibilidad, sin contar paquetes ni mostrar rangos de capacidad. Las propuestas suficientes conservan los datos de presentación necesarios para el producto; revisa sus imágenes y textos antes de publicar un proveedor, pues una foto o descripción puede revelar su identidad.

La configuración de Vercel añade CSP, `nosniff`, restricción de marcos, política de referencias y de permisos. Además, la regla activa del firewall `Limite API CreafIA` limita las rutas `/api/` a 60 solicitudes por 60 segundos y por IP; al superar el límite responde 429. La API de propuestas permite hasta cuatro comparaciones simultáneas por instancia, y el chat conserva su propio límite de concurrencia. El límite del firewall es el control distribuido; los contadores del servidor solo protegen cada instancia. Revisa el tráfico y los 429 en el panel Firewall de Vercel para ajustar el umbral sin perjudicar a usuarios que comparten IP.

## Respaldo cifrado de proveedores e imágenes

El script `scripts/backup-provider-data.mjs` exporta todos los registros de `provider_records` y las imágenes del bucket privado `provider-images`, cifra el archivo con AES-256-GCM y comprueba que pueda descifrarse. No respalda las cuentas de Auth, otras tablas ni toda la base de datos. El archivo cifrado queda en `output/backups/`, ignorado por Git.

En PowerShell, guarda una frase secreta larga en una variable de entorno de la sesión y ejecuta:

```powershell
$env:BACKUP_PASSPHRASE = Read-Host 'Frase de respaldo'
npm.cmd run backup:providers
```

La frase debe tener al menos 24 caracteres y guardarse separada del archivo de respaldo. Copia el archivo cifrado fuera del equipo. Comprueba una copia cuando la recibas:

```powershell
node --env-file=.env.local scripts/backup-provider-data.mjs verify output/backups/ARCHIVO.enc.json
```

Para una recuperación completa también se necesita un volcado de la base de datos y una copia del almacenamiento de objetos. Programa el respaldo y prueba periódicamente la restauración en un proyecto separado. Las copias automáticas dependen del plan de Supabase; comprueba el plan y las políticas vigentes antes de confiar en ellas.

## Alcance de ISO 27001

Estas medidas técnicas no equivalen a una certificación ISO/IEC 27001. Esa norma requiere un sistema de gestión de seguridad, evaluación de riesgos, políticas, responsables, evidencias, revisión y auditoría. Hay que mantener inventario de activos, control de accesos, rotación de claves, respuesta a incidentes y pruebas de restauración además del código.
