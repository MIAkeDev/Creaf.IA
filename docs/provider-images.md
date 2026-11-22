# Fotos de proveedores: carga y WebP

En `/admin/providers`, crea o edita un proveedor y abre **Evidencias**. En **Subir fotos del equipo** selecciona una o varias imágenes. Al terminar puedes elegir la imagen principal y pulsar **Guardar proveedor**. Las imágenes siguen disponibles al recargar y se utilizan en las tarjetas y el detalle de propuestas.

## Procesamiento

- Entrada: JPG, PNG o WebP estático; hasta 10 MB por archivo y 40 megapíxeles.
- Editor: hasta 30 fotos, con selección múltiple y estados de carga/error.
- Salida: WebP con calidad 82, esfuerzo 4, dimensiones máximas 1600 × 1600, conservando proporciones y transparencia, sin ampliar imágenes pequeñas.
- La orientación EXIF se aplica antes de redimensionar; no se conservan metadatos en la salida.
- Se muestra el tamaño original y el final. No hay un porcentaje de reducción garantizado; imágenes pequeñas o ya comprimidas pueden no disminuir.
- No se utiliza IA ni se consumen tokens para procesar fotos.

Se usa Sharp únicamente en el servidor. Referencias oficiales: [salida WebP y metadatos](https://sharp.pixelplumbing.com/api-output/), [redimensionado](https://sharp.pixelplumbing.com/api-resize/) y [orientación](https://sharp.pixelplumbing.com/api-operation/).

## Almacenamiento

Los bytes optimizados se guardan en **`data/provider-images/<uuid>.webp`**, fuera de `public`. El nombre es generado por el servidor; no usa el nombre del negocio ni del archivo original. No se conserva el archivo original.

`data/providers.json` guarda las referencias en `coverImage` y `evidenceImages`. La carga guarda la foto inmediatamente; **Guardar proveedor** confirma su asociación con el negocio. Quitarla del formulario o cancelar no elimina el archivo físico. No se implementa limpieza automática de archivos sin referencia ni de fotos de proveedores eliminados; no se borran archivos que otros registros puedan utilizar.

La cola de guardado del proveedor y su escritura atómica se conservan. La carga no altera precios, paquetes, contactos ni registros de otros proveedores.

## API

`POST /api/admin/provider-images` recibe el archivo como cuerpo binario con MIME `image/jpeg`, `image/png` o `image/webp`. No utiliza base64, no modifica el límite JSON de los formularios y no requiere crear el proveedor antes de subir una foto.

El servidor valida también el contenido real, rechaza SVG u otros formatos, archivos dañados, animados, vacíos o demasiado grandes. Solo escribe el archivo después de convertir correctamente la imagen. Devuelve `image` con `source`, `originalBytes`, `bytes`, `width` y `height`.

`GET /api/provider-images/:uuid.webp` permite previsualizar la foto. Las propuestas continúan utilizando `GET /api/proposal-images/:providerId/:index`, que sirve la imagen guardada como `image/webp`. Se mantienen los controles de acceso local de las APIs y el bloqueo de lectura directa de `data/`.

Se mantiene la opción de URL/ruta para imágenes existentes. Esas referencias no se descargan ni convierten automáticamente; la optimización corresponde a archivos subidos desde el equipo.

## Interfaz y fallos

Durante la carga se bloquean el guardado del proveedor, el cambio de pestaña y la edición de fotos para evitar referencias incompletas. Se muestra qué foto se está procesando. Si falla una carga de varias fotos, las que ya terminaron permanecen añadidas y el usuario puede guardar o reintentar las restantes. Al desmontar el componente se cancela la petición del navegador; una petición cancelada puede haber alcanzado el servidor y generado un archivo todavía no asociado.

## Verificación

Ocho pruebas específicas junto a las 191 anteriores: persistencia y lectura WebP, transparencia, orientación, límite de dimensiones, retirada de metadatos, reducción de una imagen PNG con detalle, archivos inválidos y vacíos, MIME, límites de tamaño, origen, rutas seguras, IDs únicos, compatibilidad con entrada WebP y vinculación al proveedor y proxy público. Se utilizan directorios temporales aislados.

La revisión en navegador verifica carga múltiple, bloqueo mientras se procesa, portada, persistencia tras recargar, eliminación de una referencia, rechazo de archivos incorrectos y ausencia de desbordamiento a 390 y 1440 px. El catálogo real no se utiliza para crear registros de prueba. Informe: `output/provider-image-upload-verification.json`.
