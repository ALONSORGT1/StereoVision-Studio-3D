# StereoVision Studio 3D

Banco óptico digital para visualizar y calibrar material estereoscópico local. El procesamiento ocurre en el navegador. El Studio conserva los archivos originales y mantiene un solo medio activo.

## Ejecución local

Desde la raíz, ejecuta `python -m http.server 8000` y abre `http://localhost:8000/`. La aplicación de producción usa HTML, CSS, módulos ES, Canvas 2D y APIs multimedia del navegador. Funciona con un servidor estático y prescinde de paquetes de ejecución.

Para preparar el sitio manualmente, copia `index.html` y `assets/` a una carpeta vacía. El workflow [Publicar Studio](.github/workflows/pages.yml) realiza ese empaquetado al actualizar `main`. En GitHub, selecciona **Settings → Pages → Build and deployment → Source → GitHub Actions** y ejecuta el workflow si aún no hay un despliegue. La URL esperada es [StereoVision Studio 3D en GitHub Pages](https://alonsorgt1.github.io/StereoVision-Studio-3D/). Las rutas relativas permiten servir el mismo artefacto en la raíz local y bajo el prefijo del repositorio.

## Uso

1. Elige **Anaglifo**, **Imagen SBS** o **Video SBS**. Selecciona un archivo o arrástralo al monitor.
2. Usa lentes rojo-cian con un anaglifo existente. Ajusta escala, brillo y contraste. Se admiten JPG, JPEG, PNG y WebP.
3. En SBS cada mitad contiene una perspectiva. Ajusta escala y alineación en el inspector y activa **Intercambiar ojos** si el orden del medio es inverso. El desplazamiento se reparte entre ambas vistas y se expresa como porcentaje de la región de cada ojo.
4. En video selecciona un MP4 compatible y pulsa **Reproducir**. Usa la línea de tiempo, los saltos de cinco segundos y el volumen. En navegadores con volumen controlado por el sistema, usa los botones físicos para el nivel y el extremo cero del control para silenciar.
5. Con contenido SBS, pulsa **Visor VR** y coloca el teléfono horizontalmente. Para regresar, toca **Salir de VR**. Puedes usar Esc con teclado. El visor conserva el contenido y la calibración y funciona en la página si el navegador deniega pantalla completa.

## Arquitectura

| Módulo | Responsabilidad |
|---|---|
| `main.js` | Selección de fuente, coordinación de estado, controles y mensajes del Studio |
| `media.js` | Validación del formato y decodificación, cancelación de importaciones y liberación de URL locales |
| `anaglyph.js` | Ajuste proporcional de la vista anaglifo y filtros de brillo y contraste |
| `renderer.js` y `sbs.js` | Canvas adaptable, recortes por ojo y composición desde un único fotograma de video |
| `calibration.js` | Valores iniciales, rangos y escala proporcional |
| `playback.js` | Fuente temporal nativa, transporte, volumen y estados de reproducción |
| `vr.js` | Presentación binocular, pantalla completa opcional y retorno al Studio |

## Alcance

El editor trabaja con material que ya contiene información estereoscópica. La calibración modifica el encuadre en pantalla. La disparidad del contenido, el desplazamiento digital y la distancia interpupilar física son parámetros distintos. SBS admite dos mitades de ancho igual y conserva su proporción codificada por ojo. La compatibilidad de MP4 depende de los códecs del navegador. El visor Cardboard presenta dos perspectivas fijas sin seguimiento de movimiento. El Studio no requiere conexión para procesar el medio una vez cargados sus recursos.

## Matriz de implementación

| Reglas | Implementación | Pruebas |
|---|---|---|
| RN-01 a RN-04 | Selección previa de módulo, formato, decodificación y errores recuperables | P-01 a P-04, P-07 |
| RN-05 y RN-06 | Sustitución de medio, liberación de recursos y herramientas según el estado | P-01, P-06, P-07 |
| RN-07 a RN-10 | Ajustes de vista, valores iniciales al cargar y restablecimiento | P-02, P-03, P-05, P-06 |
| RN-11 a RN-13 | Separación, intercambio real y encuadre proporcional | P-03 a P-05 |
| RN-14 | Una fuente temporal y un fotograma compartido | P-04, P-05 |
| RN-15 a RN-17 | Visor de dos regiones, orientación, salida táctil y conservación | P-08 |
| RN-18 | Reproducción por interacción y video en línea | P-04 |
| RN-19 | Aplicación estática y archivos gestionados mediante URL locales | Inspección de código y tráfico durante las pruebas |
| RN-20 | Empaquetado estático y rutas relativas | P-09 |

## Pruebas y conclusiones

Ejecuta `npm --prefix tests ci` y `npm --prefix tests test` con Chrome instalado. El script sirve el proyecto bajo el prefijo de GitHub Pages y guarda capturas en `test-results/`. Para verificar la publicación, establece `STUDIO_URL` en la dirección HTTPS del sitio antes de repetir el comando.

Consulta [el sistema visual y las decisiones aplicadas](DESIGN.md) y [el contexto de producto](PRODUCT.md).

Las muestras procedurales de `tests/fixtures` contienen perspectivas generadas por separado. El anaglifo combina el canal rojo de la izquierda y los canales verde y azul de la derecha. El video y la imagen SBS concatenan ambas vistas.

La arquitectura permite comparar la asignación de ojos y los ajustes mediante el propio raster que ve el usuario. La reproducción usa el reloj y los estados de un solo elemento de video, y ambas vistas se componen a partir de la misma copia del fotograma. La entrada y salida del visor modifica la presentación del mismo medio en memoria.

La comprobación física de los lentes rojo-cian, el confort binocular y la reproducción en el teléfono de evaluación requiere una sesión presencial.

Creado por Alonso Ramírez Gutiérrez
