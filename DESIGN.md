# Sistema visual de StereoVision

El Studio toma como referencia un banco óptico. El monitor, los selectores de fuente y el inspector comparten un marco continuo. El fondo oscuro reduce la distracción alrededor del contenido y las divisiones finas separan tareas. La retícula del estado inicial anticipa la división binocular del monitor.

## Color y tipografía

| Rol | Valor |
|---|---|
| Fondo general | `#101316` |
| Superficie de instrumentos | `#171c21` |
| Límite de superficie | `#303b43` |
| Texto principal | `#e7eef1` |
| Texto secundario | `#a0b0ba` |
| Acción, selección y foco | `#a2ebd7` |
| Ojo izquierdo | `#ffb0b3` |
| Ojo derecho | `#a1eff0` |

La tipografía de sistema mantiene una jerarquía compacta y prescinde de solicitudes de fuentes externas. Los valores, tiempos y etiquetas del instrumento usan monoespaciado. Las etiquetas IZQ y DER identifican cada región junto con el color.

## Disposición y estados

- Escritorio presenta fuente, monitor e inspector en tres columnas. A partir de 850 px hacia abajo, la fuente pasa a una fila de tres opciones y la calibración queda debajo del monitor.
- Cada módulo tiene un estado seleccionado visible y expuesto con `aria-pressed`. Los ajustes y la reproducción aparecen según la fuente y el contenido disponible.
- Los controles táctiles principales tienen 44 px de alto. Los controles de rango conservan su comportamiento nativo y ganan superficie de contacto con puntero grueso.
- El visor VR ocupa la pantalla y conserva una salida táctil dentro de las áreas seguras. En vertical muestra una indicación de orientación.

## Criterios aplicados

- **Impeccable**. El modo Operate orientó la composición de banco óptico, la eliminación de rótulos y numeración ornamentales, y el énfasis en el monitor. Se preservaron las decisiones visuales ya presentes en el código.
- **UI/UX Pro Max**. La consulta de sistema de diseño sugirió una retícula técnica y contraste de superficies. La interfaz limita el recurso óptico al monitor, usa anillos de foco visibles y ajusta la composición y los tamaños táctiles por dispositivo.
- **Emil Design Engineering y Review Animations**. La presión por puntero reduce el botón a 0.97 en 90 ms y la liberación recupera el tamaño en 160 ms. La revisión excluyó la transformación al activar por teclado y con movimiento reducido. Los estados hover se limitan a dispositivos con puntero fino. El lienzo, la línea de tiempo y el cambio de modo VR responden sin transiciones.

## Inspector avanzado de Imagen SBS

El panel conserva los colores, las divisiones finas y los números monoespaciados del Studio. Las tres secciones usan el elemento nativo details, de modo que plegarlas funciona con teclado y mantiene los controles y sus valores en el documento.

UI/UX Pro Max se consultó con «properties inspector numeric input progressive disclosure slider». Se aplicaron sus recomendaciones sobre etiquetas visibles, tipos de entrada adecuados y agrupación progresiva. Cada parámetro tiene slider, campo number con porcentaje y acción individual de restablecimiento. El formulario emite cambios al estado del Studio y el renderizador responde en el mismo evento.

La revisión de Impeccable preservó el inspector existente y evitó contenedores anidados. Se ajustaron el ancho lateral, los saltos a dos columnas en tableta y el flujo vertical en móvil. Los bordes de campos y selector usan el token control-border con contraste mínimo de 3,16 sobre las superficies adyacentes. El foco mantiene el contorno de acento.

La revisión de Emil Design Engineering y Review Animations se aplicó a los ajustes frecuentes y al plegado.

| Before | After | Why |
|---|---|---|
| Valor de solo lectura junto al slider | Campo numérico con borradores de edición y normalización al confirmar | Permite valores precisos y escribir signos o decimales sin interrumpir la entrada |
| Herramientas SBS en una sola lista | Tres secciones plegables nativas | Reduce la carga visual sin descartar valores |
| Acción global como único restablecimiento | Acción por parámetro con SVG y nombre accesible | Recupera una referencia sin perder el resto de la calibración |
| Controles sin tamaño táctil específico para entradas numéricas | Campos de 16 px y objetivos de 44 px con puntero grueso | Evita el zoom automático de entrada y facilita la pulsación |
| Sin indicador de expansión | Flecha con transición de transform de 120 ms solo por puntero fino y sin movimiento reducido | Expresa el estado sin animar el alto del panel ni retrasar el visor |

El lienzo y los valores se actualizan directamente. Las activaciones por teclado y el movimiento reducido mantienen el plegado inmediato. La inspección visual incluyó el panel abierto en escritorio y móvil emulado, y se comprobó que no aparece desbordamiento horizontal en 320, 768, 1024 y 1440 px.

## Inspector avanzado de anaglifo

Se reutilizaron las secciones, campos, sliders y botones de calibración de Imagen SBS. El componente compartido admite unidades vacías para gamma y normaliza los valores según la precisión de cada paso, incluido 0,05. El anaglifo presenta Imagen e Inspección abiertas y las secciones de calibración y balance plegadas inicialmente.

UI/UX Pro Max se consultó con «numeric input color inspector grouped controls accessibility». Se aplicó la identificación textual del modo de inspección en el selector y en el monitor, además de conservar el contraste y los nombres accesibles. Impeccable orientó la revisión de las cuatro secciones dentro del inspector existente, con los mismos bordes, ritmo vertical y tipografía. Se inspeccionaron capturas de escritorio y móvil con el panel abierto y con valores activos.

La revisión de Emil Design Engineering conserva la interacción ya verificada del inspector compartido.

| Before | After | Why |
|---|---|---|
| Tres sliders con valores de salida | Campos numéricos y sliders agrupados en Imagen, calibración, balance e inspección | Reúne los controles relacionados y permite escribir valores precisos |
| Normalización decimal fija | Precisión derivada del paso de cada parámetro | Conserva incrementos de gamma de 0,05 y los pasos existentes del SBS |
| Modo anaglifo como única presentación | Selector de diagnóstico y rótulo textual sobre el monitor | Identifica la inspección sin depender del color de la imagen |
| Ajustes anaglifo en una lista siempre abierta | Secciones secundarias plegadas inicialmente | Reduce la altura inicial del inspector manteniendo visibles los ajustes de imagen |
| Actualización de imagen por filtro global | Shader con estado actual y respuesta directa a la entrada | Evita movimiento decorativo y mantiene la separación de componentes durante la calibración |

Los controles táctiles conservan objetivos de 44 px y campos de 16 px. El plegado usa detalles nativos, la flecha mantiene la transición breve solo por puntero fino y se respetan las preferencias de movimiento reducido.
