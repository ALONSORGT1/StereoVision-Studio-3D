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
- **Emil Design Engineering**. Los botones responden al presionar con una escala de 0.97 y transiciones breves. Los estados hover se limitan a dispositivos con puntero fino. Con movimiento reducido, se elimina el desplazamiento visual de los botones.
