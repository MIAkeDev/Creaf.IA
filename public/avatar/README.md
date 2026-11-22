# Mascota de peluche · CreafIA

`plush-monkey-atlas.webp` es la hoja activa de expresiones. Conserva seis poses en una cuadrícula de tres columnas por dos filas, con fondo transparente. `plush-monkey.webp` es la pose sentada que aparece en la vista inicial del chat. Ambos archivos proceden de las dos imágenes entregadas por el usuario, editadas con la herramienta integrada `image_gen` para retirar el fondo y codificadas en WebP. El atlas anterior `monkey-atlas.png` se conserva como referencia de la versión previa, pero ya no se carga en la interfaz.

`src/components/MonkeyAvatar.tsx` asigna las expresiones a los estados del chat y precarga las imágenes. Las transiciones entre capas, respiración, flotación, despertar, reacción, búsqueda y movimiento reducido siguen en `MonkeyAvatar.css` y `src/styles/animations.css`. Los estados que no tienen una pose exclusiva reutilizan la expresión más cercana de la hoja.

Prompts de edición empleados:

> Eliminar solo el fondo claro y las sombras del suelo de la hoja de seis expresiones del mono de peluche; conservar las seis poses, el orden 3 × 2, las proporciones, la textura y las marcas de expresión, con transparencia real.

> Eliminar solo el fondo claro y la sombra del suelo del mono sentado; conservar la cara, sonrisa, ojos, pelo, cola, patas y encuadre completo, con transparencia real.

Se hizo una segunda pasada de limpieza de bordes en la hoja. Las imágenes se muestran a tamaño de interfaz; la salida generada conserva algunos píxeles finos en el contorno que conviene revisar si se amplía mucho la mascota.

`creafia-hero-desk.webp` es el recurso transparente de la portada nueva: el mismo mono de peluche con auriculares, portátil, taza y libreta. Se generó a partir de la portada de referencia y la imagen original del peluche con la herramienta integrada `image_gen`, y se optimizó a WebP. El texto, botones, tarjeta inclinada, navegación y enlaces sociales se dibujan en HTML/CSS desde `src/components/LandingPage.tsx` para que sigan siendo accesibles y adaptables.

Prompt final de la portada: recrear únicamente el grupo visual del lado derecho de la referencia, conservando la identidad del mono de peluche y la composición de auriculares, portátil, taza y libreta; iluminación suave, textura de peluche, fondo realmente transparente; sin titulares, menú, tarjeta de eventos ni botones.
