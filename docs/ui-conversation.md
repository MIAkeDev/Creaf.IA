# Inicio animado y conversación amplia

El inicio conserva el mono como entrada. No se crea SlideCommit ni se añaden deslizadores, pagos o acciones de cobro. El saludo ahora dice «¿Se viene una fecha importante? Cotízalo ;)» e indica «Toca al mono y cuéntanos qué estás planeando».

BlurText anima las palabras con drift, entrada desde la izquierda, desenfoque y stagger desde el final. Se activa al entrar en vista y no se repite por defecto. El texto conserva una lectura accesible completa; con movimiento reducido se muestra sin animación. La copia y el mono siguen en filas separadas y se comprueba que no se superponen.

Cuando aparece el primer mensaje —no al tocar el mono por primera vez— se retira el escenario central y se coloca una versión pequeña del avatar a la derecha de la cabecera. El chat comienza debajo de una cabecera de 64 px en móvil y 76 px en escritorio, utiliza hasta 1320/1420 px de ancho y conserva la entrada fija en su distribución. La vista horizontal elimina el mínimo de altura que antes forzaba desplazamiento fuera de la pantalla.

El cuadro de texto añade un botón Enviar real con estados deshabilitados cuando no hay texto o se está respondiendo. Enter sigue enviando y Shift+Enter añade una línea. La mascota pequeña es decorativa y mantiene sus estados de actividad.

SpecularButton implementa el API de apariencia solicitado: size, radius, tint/tintOpacity, textColor, lineColor, baseColor, intensity, idleIntensity, shineSize, shineFade, thickness, glow, followMouse y proximity, además de las props nativas de button. Añade variantes primaria, ghost y danger para mantener la jerarquía de los formularios. Conserva type=submit, disabled, foco y teclado. El seguimiento del puntero usa un único listener compartido y requestAnimationFrame para los botones registrados, sin actualizar React en cada movimiento. Con movimiento reducido se desactiva el seguimiento y el barrido animado.

Se aplica a las acciones de chat, selector de servicios, propuestas y panel interno. El mono y los desplegables de ThoughtLine conservan sus controles originales. «Ver propuesta» tiene fondo oscuro de agua, texto claro, reflejo, flecha y tamaño grande; se sitúa junto al precio para poder abrir el detalle sin bajar al final de la tarjeta.

## Archivos

- Nuevos: src/components/BlurText.tsx y .css, src/components/SpecularButton.tsx y .css, src/styles/conversation-layout.css.
- Modificados: src/main.tsx, SplashScreen.tsx, ChatInput.tsx, ServiceSelector.tsx y ChatWindow.tsx; los componentes de acciones de propuestas y admin para usar SpecularButton; README y este documento.
- No cambian EventState, expectedField, Groq, el catálogo ni el motor de propuestas. No se añaden dependencias.

## Verificación

Chromium: 1806×892, 1440×900, 390×844, 360×800, 430×932, 768×1024 y 844×390. Inicio sin superposición de copia y mono en vertical; entrada por teclado/tap; crecimiento del área conversacional; sin scroll horizontal ni contenido fuera del viewport; botón Ver propuesta visible, detalle y cierre; reflejo con puntero, movimiento reducido y envío por botón/Enter. Se comprobó también guardar y eliminar un proveedor temporal para validar los nuevos botones submit; el registro de prueba se elimina.

Evidencias: output/wide-chat-verification.json, welcome-blur-1440.png, welcome-blur-390.png, welcome-blur-844.png, wide-chat-1440.png y wide-chat-390.png. Lint, TypeScript, las 182 pruebas existentes y build se ejecutan como comprobaciones de regresión.
