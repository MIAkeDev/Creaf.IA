# Guía del formulario de proveedores de CreafIA

Esta guía describe el formulario actual de **Agregar proveedor** y **Editar proveedor** en `/admin/providers`. Un proveedor es un negocio; cada **paquete** es una opción concreta que puede aparecer en una cotización. Puedes registrar varios paquetes para el mismo negocio.

## Cómo completar el registro

1. Indica el nombre, la categoría principal y la ciudad del negocio.
2. Completa al menos un paquete con nombre, precio y tipos de evento compatibles.
3. Si conoces el costo que te cobra el proveedor, abre **Precio interno y ganancia** para calcular el precio al cliente.
4. Añade fotos y datos adicionales si los tienes.
5. Revisa el resumen **Antes de guardar** y pulsa **Guardar proveedor**. Los campos con `*` son obligatorios. Puedes editar el registro más adelante.

El resumen lateral señala si hay datos básicos del **Negocio**, un **Paquete** con precio y al menos un tipo de **Evento**. La validación completa ocurre al guardar; un indicador marcado no sustituye esa comprobación.

## 1. Datos del negocio

| Campo | Qué significa y cómo usarlo |
|---|---|
| **Nombre comercial \*** | Nombre interno del negocio, por ejemplo, «Eventos del Sur». Identifica al proveedor en el panel. No se entrega como nombre comercial en las propuestas públicas. |
| **Categoría principal \*** | Servicio que ofrece el negocio por defecto: Local, Decoración, Catering, Torta, DJ / Música, Fotografía, Video, Maestro de ceremonia, Movilidad, Bartender / bebidas, Animación u Otros. Abre el selector para ver todas las opciones. |
| **Otra categoría…** | Permite escribir una categoría que no esté en la lista. Si la eliges, debes poner el nombre de la nueva categoría. |
| **Ciudad \*** | Ciudad donde se ofrece el servicio. Empieza en «Ilo». La búsqueda exige que coincida con la ciudad del evento, sin distinguir mayúsculas ni tildes. |
| **WhatsApp del proveedor** | Número privado para que el administrador prepare un mensaje de coordinación. Es opcional; sin él no se puede abrir el contacto directo de ese proveedor desde el panel. No aparece en la propuesta pública. |
| **Disponible para las búsquedas** | Si está marcado, los paquetes pueden entrar en la búsqueda cuando cumplan los demás criterios. Si lo desmarcas, el proveedor queda guardado pero sus paquetes no se proponen. |

La categoría principal se aplica a todos los paquetes salvo que un paquete tenga su propia **Categoría distinta a la principal**. Por ejemplo, un negocio cuya categoría principal es «Local» puede registrar un paquete de «Decoración» asignándole esa categoría específica.

## 2. Servicios y precios

Pulsa **+ Añadir paquete** para registrar otra opción del mismo negocio. Cada paquete se abre como un bloque independiente; **Quitar paquete** elimina ese bloque del formulario. Debe quedar **entre 1 y 30 paquetes** para poder guardar el proveedor. Un paquete no representa necesariamente un precio por persona: el precio se registra como importe del paquete para el rango de invitados indicado.

| Campo | Qué significa y cómo usarlo |
|---|---|
| **Nombre del paquete \*** | Título de la oferta concreta, por ejemplo, «Barra libre por 4 horas». Debe describir lo que recibe el cliente; puede verse en la propuesta tras la limpieza de datos privados. |
| **Precio al cliente desde (S/) \*** | Importe inicial que se usa para comparar este paquete. Escríbelo directamente si no registras un costo interno. Si registras el costo, el sistema lo calcula y el campo queda solo de lectura. |
| **Desde cuántas personas** | Capacidad mínima del paquete. Déjalo vacío cuando no haya un mínimo registrado. |
| **Hasta cuántas personas** | Capacidad máxima. Déjalo vacío cuando no haya un máximo registrado. El máximo no puede ser menor que el mínimo. |
| **¿Para qué eventos ofreces este paquete? \*** | Marca al menos un tipo de evento. Las opciones actuales son quinceañero, cumpleaños, matrimonio, baby shower, evento corporativo, graduación, bautizo y otro. El paquete solo se considera para eventos compatibles. |

La categoría, el evento y la capacidad cumplen funciones distintas: **Bartender / bebidas** identifica qué servicio busca la persona; **baby shower** indica para qué evento se ofrece; **10–25 personas** indica el tamaño que puede cubrir. Un presupuesto alto no hace compatible un paquete que no cubre el número de invitados.

### Precio interno y ganancia

Este bloque es **opcional**. Úsalo cuando conoces cuánto te cobrará el proveedor y quieres calcular un precio de venta. Sus datos sirven para administrar el margen; no se envían al cliente como costo interno.

| Campo | Qué significa y cómo usarlo |
|---|---|
| **Costo del proveedor (S/)** | Lo que pagarías al proveedor por ese paquete. Al rellenarlo se activa el cálculo automático del precio al cliente. Si queda vacío, no se calcula la ganancia. |
| **Tipo de recargo** | **Porcentaje sobre costo** suma un porcentaje del costo. **Monto fijo en soles** suma una cantidad de soles. |
| **Valor del recargo** | Número que se aplica según el tipo anterior. El porcentaje inicial se obtiene de la configuración administrativa; si no hay otro valor válido, el predeterminado en código es **10 %**. |
| **Precio al cliente** | Resultado calculado a partir del costo y el recargo. Sustituye el valor de «Precio al cliente desde» al guardar. |
| **Ganancia bruta estimada** | Precio al cliente menos costo registrado del proveedor. No descuenta impuestos, comisiones, otros gastos ni cambios posteriores de precio. |
| **Confirmo este precio al cliente** | Debes marcarlo al crear un paquete con costo interno o al cambiar el costo/recargo de uno existente. Si cambias esos datos después de marcarlo, tendrás que confirmarlo otra vez. |
| **Última actualización** | En paquetes que ya la tienen, muestra la fecha de actualización del precio calculado. Se actualiza cuando se guardan cambios relevantes de costo, recargo o precio. |

**Ejemplo con porcentaje:** costo S/ 200, recargo 10 % → precio al cliente S/ 220; ganancia bruta estimada S/ 20.

**Ejemplo con monto fijo:** costo S/ 200, recargo fijo S/ 35 → precio al cliente S/ 235; ganancia bruta estimada S/ 35.

Los cálculos se redondean a céntimos. El valor es un precio del **paquete**, no una multiplicación automática por la cantidad de invitados. Si el costo interno no está registrado, puedes ofrecer el paquete con un precio público, pero la aplicación no puede calcular tu ganancia. Si editas un paquete que ya tenía costo interno, revisa también el precio máximo opcional: debe ser igual o mayor que el nuevo precio calculado.

### Detalles del paquete

Este bloque también es **opcional**. Sirve para describir mejor la oferta y mejorar su comparación.

| Campo | Qué significa y cómo usarlo |
|---|---|
| **Categoría distinta a la principal** | Cambia la categoría solo de este paquete. Si dejas «Usar la categoría del negocio», hereda la categoría principal. Es útil cuando el proveedor ofrece servicios diferentes. |
| **Precio máximo (S/)** | Límite superior informativo del rango de precios, si existe. Debe ser igual o mayor que el precio inicial o el precio calculado. El motor de propuestas usa el precio inicial registrado, no inventa un valor intermedio del rango. |
| **Estilos** | Preferencias como Elegante, Moderno, Minimalista, Temático, Infantil, Premium o Personalizado. Ayudan a puntuar la coincidencia con el estilo pedido; no sustituyen los filtros de evento y capacidad. |
| **Qué incluye** | Elementos incluidos en el paquete, uno por campo. Pueden mostrarse al cliente y sirven para comparar lo ofrecido. No incluyas contactos, nombres comerciales, enlaces ni datos privados. |
| **No incluye** | Elementos excluidos, separados por comas. Ayudan a registrar los límites de la oferta; actualmente no son una garantía automática en la explicación pública de la propuesta. |
| **Condiciones** | Reglas comerciales o logísticas del paquete. El motor no convierte automáticamente cualquier texto de este campo en un filtro comprobado. |
| **Descripción adicional** | Texto descriptivo del paquete. Puede aparecer resumido en la propuesta pública después de limpiar contactos y enlaces. |
| **También acepta cotización personalizada** | Indica que se pueden coordinar condiciones particulares. Marcarlo no inventa un importe: para mostrar el paquete en una comparación automática sigue haciendo falta un precio inicial válido. |

### Precio que usa la búsqueda

En los paquetes creados por este formulario se utiliza normalmente el **precio desde**. En registros antiguos que tengan un modelo de **precio fijo**, se utiliza su `fixedPrice`. Las propuestas combinan un paquete por cada categoría solicitada y suman sus importes. Además del precio, comprueban que el proveedor esté activo, que la ciudad y el tipo de evento correspondan y que la capacidad cubra a los invitados. Una cotización personalizada sin precio inicial conocido no aparece como si fuera gratis.

## 3. Fotos

Las fotos son opcionales. Puedes subir varias imágenes JPG, PNG o WebP de hasta **10 MB cada una**, con un máximo de **30 fotos por proveedor**. El servidor las convierte a WebP, limita sus dimensiones a 1600 × 1600 y muestra el peso antes y después. Selecciona **Imagen principal** para elegir la portada; **Quitar foto** retira su referencia del formulario.

También puedes abrir **Usar una URL o ruta existente**. Admite rutas públicas del proyecto o URL HTTPS de `images.unsplash.com` y `images.pexels.com`. Esa opción guarda una referencia; no convierte automáticamente la imagen externa a WebP.

Las fotos subidas se guardan al cargarlas, pero **Guardar proveedor** confirma su asociación con el registro. Si ejecutas el proyecto sin la clave de servidor de Supabase, los archivos se almacenan en `data/provider-images/`; con Supabase configurado se usa el bucket privado `provider-images`, también al ejecutar Vite en local. Revisa que las imágenes no contengan logos, nombres o contactos: pueden mostrarse en las propuestas.

## 4. Más datos del negocio

Abre este bloque si necesitas registrar información complementaria. Todos estos campos son opcionales.

| Campo | Qué significa y cómo usarlo |
|---|---|
| **Teléfono** | Contacto interno alternativo. No se publica como dato de contacto. |
| **Instagram** | Referencia interna del perfil del negocio. No se publica como enlace de contacto. |
| **Dirección** | Ubicación interna del proveedor. No se publica como dirección de contacto. |
| **Años de experiencia** | Número entero entre 0 y 150. Puede contribuir a la valoración de calidad y mostrarse como dato resumido en la propuesta. |
| **Eventos realizados** | Número entero entre 0 y 1 000 000. Puede contribuir a la valoración de calidad y mostrarse como dato resumido. |
| **Valoración (0 a 5)** | Calificación numérica registrada. Influye en la puntuación de las opciones y puede mostrarse públicamente. Registra solo una valoración que tengas sustento para usar. |
| **Descripción del negocio** | Texto general que puede usarse como descripción breve si el paquete no tiene una propia. No escribas datos de contacto en él. |
| **Proveedor verificado** | Marca administrativa que influye en la puntuación. Márcala solo después de verificar el proveedor por tu proceso interno. |

## Guardado, edición y privacidad

Al guardar, el servidor vuelve a validar campos, precios, capacidades, listas e imágenes. Los errores aparecen en la sección correspondiente. Los datos registrados se usan en las búsquedas siguientes; puedes desactivar el proveedor o editar sus paquetes desde el panel.

Las propuestas públicas se construyen con una lista limitada de campos. El nombre comercial, teléfono, WhatsApp, Instagram, dirección y costo interno no se entregan como datos de contacto. Los textos libres se limpian para retirar patrones de contacto, pero **una foto o una descripción puede identificar a un negocio por sí misma**; revísalas antes de publicarlas.

**Archivos de referencia:** `src/components/admin/ProviderForm.tsx`, `ProviderServiceForm.tsx` y `ProviderImages.tsx`; reglas en `shared/provider-validation.mjs` y `shared/pricing.mjs`; búsqueda en `server/proposals/providerSearch.mjs`.
