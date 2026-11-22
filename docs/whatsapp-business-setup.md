# WhatsApp automático para solicitudes

El panel permite abrir WhatsApp con un mensaje específico para cada proveedor. «Preparar mensajes para todos» crea una lista para abrirlos uno por uno. WhatsApp usa la cuenta que esté iniciada en el dispositivo; CreafIA no puede forzar el número remitente ni pulsar Enviar por ti. Para usar el número del propietario, inicia WhatsApp con **+51 920 632 668** antes de abrir esos enlaces. Al confirmar una solicitud, el estado cambia en el perfil del cliente y el panel ofrece otro mensaje preparado para él.

La integración automática con Meta también está implementada en el servidor, pero requiere la configuración siguiente. No hace falta configurarla para usar los enlaces manuales del panel. Abrir un enlace no prueba que el mensaje haya sido enviado.

## Configuración en Meta

1. Activa [WhatsApp Business Platform (Cloud API)](https://developers.facebook.com/documentation/business-messaging/whatsapp/overview/) y registra un número emisor. Copia su **Phone Number ID** y un token de acceso válido para ese número. No uses el número visible como Phone Number ID.
2. Crea y consigue la aprobación de dos plantillas en español de Perú (`es_PE`). Usa los nombres aprobados en las variables de entorno. El texto y el número de parámetros deben coincidir con lo siguiente.
3. Configura las variables en `.env.local` y en el entorno del servidor desplegado; reinicia el servidor. El token es secreto y nunca debe tener prefijo `VITE_`.

### Plantilla para proveedores: seis parámetros

> Hola, te escribimos de CreafIA. Estamos coordinando un {{1}} para {{2}} en {{3}}, con {{4}} invitados. Queremos consultar tu servicio {{5}} (solicitud {{6}}). ¿Puedes confirmar disponibilidad, precio y condiciones? Te agradeceríamos responder dentro de las próximas 2 horas. Gracias.

Los parámetros son: tipo de evento, fecha o preferencia, ciudad, número de invitados, categoría y paquete, código de solicitud. En la vía automática se envía un mensaje individual a cada proveedor seleccionado. Si falla uno, los demás continúan y el servidor indica cuáles quedaron pendientes. Un mensaje registrado como aceptado por Meta no se repite. Si Meta lo aceptó pero falló el registro posterior en la base de datos, revisa el historial antes de reintentar.

### Plantilla para el cliente: cinco parámetros

> Confirmamos la disponibilidad y el precio de tu propuesta para {{1}}. Fecha: {{2}}. Servicios: {{3}}. Precio de la propuesta: {{4}}. Código: {{5}}. Próximo paso: nos pondremos en contacto contigo para coordinar los detalles finales. Consulta el estado en tu perfil de CreafIA. Esto no representa una reserva ni un pago.

Los parámetros son: tipo de evento, fecha o preferencia, servicios, importe público y código de solicitud. El panel exige marcar todos los proveedores como disponibles antes de confirmar. La confirmación manual actualiza el estado público y prepara un enlace de WhatsApp que el administrador debe abrir y enviar. En la vía automática, el servidor envía esta plantilla después de actualizar el estado. Si Meta rechaza el mensaje, el estado queda confirmado y la API permite reintentar el aviso. La aceptación de Meta no demuestra que el destinatario haya leído el mensaje.

## Variables

```dotenv
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PROVIDER_TEMPLATE=
WHATSAPP_CUSTOMER_TEMPLATE=
WHATSAPP_TEMPLATE_LANGUAGE=es_PE
WHATSAPP_API_VERSION=v27.0
```

Los números de Perú de nueve dígitos se completan con `51` antes de enviarlos. Los números de otros países deben guardarse con su código internacional. Cada contacto necesita un WhatsApp válido y las plantillas deben estar aprobadas por Meta. La API de CreafIA nunca devuelve el token al navegador.
