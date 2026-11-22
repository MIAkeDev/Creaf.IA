# Catálogo y búsqueda de servicios

El formulario del chat consulta `GET /api/service-options` con el tipo de evento, la ciudad y la cantidad de invitados. Usa el mismo `data/providers.json` y las mismas reglas de evento/capacidad que el motor de propuestas; no depende de una lista fija de servicios por evento. No consulta a Groq para cargar categorías ni comparar paquetes.

## Registrar un servicio

Abre `/admin/providers`. En **Negocio**, elige la categoría general del proveedor. En **Servicios**, agrega cada paquete con precio, capacidad y eventos compatibles. La categoría del paquete es opcional: si no la cambias, hereda la del negocio. Por ejemplo: categoría **Bartender / bebidas**, paquete **Barra libre**, evento **Baby shower**. El tipo de evento no es una categoría de servicio.

Guardar actualiza `data/providers.json` mediante escritura atómica. Al volver al chat se recargan los servicios; también puedes pulsar **Actualizar servicios**. Los paquetes desactivados o de otra ciudad/evento no se ofrecen. Un paquete con capacidad incompatible sigue visible con su rango y un aviso; no se recomienda para más invitados que los registrados. Las selecciones anteriores se conservan y se marcan si dejaron de tener paquetes compatibles.

`Barman`, `bartender`, `barra libre`, `barra de tragos` y `bebidas` se comparan como una misma categoría. Baby shower acepta espacios y la representación `babyShower`. Las categorías personalizadas también aparecen si tienen paquetes registrados compatibles.

## Resultados sin combinaciones

`server/proposals/providerSearch.mjs` distingue servicio sin registrar, proveedor inactivo, ciudad, tipo de evento, capacidad, cotización pendiente y presupuesto. El DTO público solo entrega categorías, rangos y explicaciones; no revela contactos ni nombres comerciales.

Solo se sugiere otro presupuesto si se conoce el precio mínimo de **todos** los servicios, compatibles con ciudad/evento/capacidad, y ese total supera el margen permitido. La sugerencia es ese mínimo, sin aumentos repetidos del 20%. La alternativa de +25% solo aparece si ese margen realmente permitiría cubrir el total. También se aceptan combinaciones cuyo precio quede muy por debajo del presupuesto.

Ante un problema de capacidad puedes corregir explícitamente los invitados. Se conservan la fecha, servicios y presupuesto; la búsqueda se repite sin pedir otra respuesta a IA. También puedes quitar un servicio o volver a comparar después de registrar nuevos paquetes.

## Datos conservados

El 6 de noviembre de 2026 se archivaron los 24 registros sintéticos originales después de compararlos completos con el generador original. Se conservó íntegro el proveedor registrado manualmente, sin modificar sus precios ni su capacidad. La copia anterior está en `data/archive/providers-before-catalog-fix-2026-11-06T19-17-27-255Z.json`, bloqueada por HTTP junto con `data/`. El generador y las imágenes sintéticas dejaron de formar parte de la aplicación.

El paquete registrado «Barra libre» cubre **10–25 personas**, desde **S/200**. Para eventos mayores se necesitan paquetes con capacidad suficiente, registrados desde el panel. Subir el presupuesto no cambia ese aforo.

## Verificación

191 pruebas de servidor: conversación, formularios, persistencia, privacidad, categorías por paquete, alias, carga del catálogo, diagnósticos y presupuestos. Las pruebas del motor usan registros aislados y no dependen del catálogo real.

ESLint, TypeScript y compilación verificados. Chromium a 390 y 1440 px: baby shower → marcar todo → bartender → propuesta desde S/200 con S/5000 y S/37400; corrección a 500 invitados → aviso de capacidad sin incremento de presupuesto; corrección explícita a 20 → propuesta encontrada. Se revisó el panel sin alterar el proveedor. Informe: `output/catalog-browser-verification.json`.
