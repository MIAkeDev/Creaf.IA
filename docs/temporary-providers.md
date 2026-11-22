# Proveedores temporales para revisar el chat

El 9 de noviembre de 2026 se añadieron, a petición del usuario, **20 proveedores temporales** al catálogo activo. Se conservaron los registros previos sin modificarlos. Estos paquetes son ejemplos para revisar la interfaz, no negocios, tarifas ni disponibilidad reales.

Hay dos alternativas por categoría: Local, Decoración, Catering, Torta, DJ / Música, Fotografía, Video, Maestro de ceremonia, Bartender / bebidas y Animación. Cada registro tiene un paquete, un precio de prueba, inclusiones y una ilustración WebP local. Los paquetes indican «prueba» y los nombres internos comienzan por «PRUEBA TEMPORAL».

Están activos en Ilo, para los tipos de evento admitidos por el catálogo y un rango de prueba de 10–600 invitados. Las capacidades del proveedor original no se modificaron.

Para verlos, escribe por ejemplo:

> Quiero un baby shower para 70 personas en Ilo, el 18 de diciembre de 2026, con 5000 soles de presupuesto.

Después marca los servicios del formulario y confirma. La interfaz conserva su límite de hasta tres combinaciones por búsqueda: los 20 proveedores aportan alternativas para construirlas, no veinte tarjetas de propuesta simultáneas.

Se comprobó que con todos los servicios y S/5000 aparecen propuestas desde S/4400, S/4860 y S/5180. También hay resultados para 500 invitados y S/37400. Son precios ilustrativos, no cotizaciones reales.

## Identificación y eliminación posterior

Los IDs exactos de los 20 registros y sus imágenes están en `data/provider-preview.json`. El catálogo anterior tiene respaldo en `data/archive/providers-before-preview-*.json`. La carpeta `data/` sigue bloqueada por HTTP directo.

Comprobar el lote sin modificarlo:

```powershell
node scripts/preview-providers.mjs check
```

Cuando se decida retirar el lote:

```powershell
node scripts/preview-providers.mjs remove
```

La eliminación usa los IDs del manifiesto; conserva los proveedores ajenos al lote, incluidos los agregados después. Solo elimina las imágenes propias del lote que ningún registro restante utilice. No restaura el respaldo sobre el catálogo actual.

El comando `add` rechaza crear otro lote si ya hay un manifiesto. Así se evita duplicar los veinte registros al ejecutar de nuevo el script.
