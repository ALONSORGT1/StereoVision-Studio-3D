# StereoVision Studio 3D

Banco óptico digital para visualizar y calibrar material estereoscópico local. El procesamiento ocurre en el navegador. El Studio conserva los archivos originales y mantiene un solo medio activo.

## Ejecución local

Desde la raíz, ejecuta `python -m http.server 8000` y abre `http://localhost:8000/`. La aplicación de producción usa HTML, CSS, módulos ES, Canvas 2D y APIs multimedia del navegador. Funciona con un servidor estático y prescinde de paquetes de ejecución.

Para preparar el sitio manualmente, copia `index.html` y `assets/` a una carpeta vacía. El workflow [Publicar Studio](.github/workflows/pages.yml) realiza ese empaquetado al actualizar `main`. En GitHub, selecciona **Settings → Pages → Build and deployment → Source → GitHub Actions** y ejecuta el workflow si aún no hay un despliegue. La URL esperada es [StereoVision Studio 3D en GitHub Pages](https://alonsorgt1.github.io/StereoVision-Studio-3D/). Las rutas relativas permiten servir el mismo artefacto en la raíz local y bajo el prefijo del repositorio.

## Uso

Selecciona un módulo y abre una escena en **Demos del módulo**.

| Módulo | Demos | Formato |
|---|---|---|
| Anaglifo | Bosque umbrío y Ciudad nocturna | JPG de 960 × 540 |
| Imagen SBS | Arrecife azul y Galería de luz | JPG de 1920 × 540 |
| Video SBS | Cañón estratificado y Metrópolis futura | MP4 H.264 de 1920 × 540, 24 FPS, 15 s cada uno |

Los recursos son originales del proyecto. Las seis escenas y sus miniaturas se renderizan con Three.js desde geometría y materiales propios, sin modelos, fotografías, texturas ni pistas externas. Cada par usa cámaras paralelas con desplazamiento binocular y frústums compensados. En anaglifo, el rojo conserva la luminancia izquierda y verde y azul la derecha. En video, ambas cámaras renderizan la misma escena en el mismo instante y el resultado se codifica como un único MP4 sin audio.

El generador y Three.js se usan solo en desarrollo. Para reproducir la biblioteca, ejecuta `npm --prefix tests ci` y `node tests/generate-demos.mjs` con Chrome, Python e imageio-ffmpeg instalados. Ejecuta `python tests/verify-demos.py` con NumPy e imageio-ffmpeg para comprobar formatos, duración y diferencias de píxeles, y generar hojas de contacto en `test-results/`.

1. Elige **Anaglifo**, **Imagen SBS** o **Video SBS**. Selecciona un archivo o arrástralo al monitor.
2. Usa lentes rojo-cian con un anaglifo existente. Ajusta escala, brillo y contraste. Se admiten JPG/JPEG/JFIF, PNG, WebP y otros formatos que el navegador pueda decodificar.
3. En SBS cada mitad contiene una perspectiva. En imágenes, calibra el par en el inspector y activa **Intercambiar L/R** si el orden del medio es inverso.
4. En video selecciona un MP4 u otro video compatible con el navegador y pulsa **Reproducir**. Usa la línea de tiempo, los saltos de cinco segundos y el volumen. En navegadores con volumen controlado por el sistema, usa los botones físicos para el nivel y el extremo cero del control para silenciar.
5. Con contenido SBS, pulsa **Visor VR** y coloca el teléfono horizontalmente. Para regresar, toca **Salir de VR**. Puedes usar Esc con teclado. El visor conserva el contenido y la calibración y funciona en la página si el navegador deniega pantalla completa.

## Compatibilidad de importación

La decodificación nativa del navegador determina si se puede abrir el archivo. El nombre, la extensión, el MIME informado por el sistema y una cabecera parcial aportan pistas para la lectura. La importación acepta contenido decodificable aunque esos datos estén incompletos o no coincidan. Las pruebas incluyen JPEG, PNG de 16 bits, WebP, GIF, BMP y AVIF en anaglifo e imagen SBS, con archivos de ancho impar y variaciones de nombre y MIME.

En SBS se calculan ambas mitades mediante coordenadas fraccionarias cuando el ancho es impar. El archivo conserva sus píxeles y proporción. Para MP4 se usa el demultiplexor del navegador, que admite las estructuras de contenedor que pueda interpretar. La compatibilidad del códec sigue dependiendo del navegador y del dispositivo. H.264 con audio AAC es una opción habitual para MP4. HEIC/HEIF, TIFF y otros formatos pueden necesitar conversión a JPG, PNG o WebP cuando el navegador no los admita.

Si falla la lectura de la URL inicial, el Studio realiza un único reintento desde una copia de los bytes en memoria. Esto permite separar la decodificación de la referencia al archivo seleccionado. Al sustituir el contenido se liberan ambas URL cuando corresponde. Los errores distinguen archivo vacío, lectura desde almacenamiento, espera agotada y formato o códec incompatible. Un archivo inválido mantiene disponible el medio anterior.

El tiempo inicial de lectura es de hasta 60 segundos. Conviene seleccionar archivos que estén descargados en el dispositivo. Un video con dimensiones válidas puede abrirse mientras el navegador aún determina su duración. En ese caso se muestra un guion para la duración y la búsqueda usa los intervalos disponibles del medio.

## Calibración de anaglifo

El inspector agrupa **Imagen**, **Calibración estereoscópica**, **Balance cromático** e **Inspección**. Las secciones de alineación y balance comienzan plegadas. Los valores se conservan al abrirlas o cerrarlas. Cada parámetro tiene slider, entrada numérica y restablecimiento individual.

| Parámetro | Valor inicial y rango |
|---|---|
| Escala, brillo y contraste | 100 %. Conservan sus rangos anteriores de 50–200 %, 50–150 % y 50–150 %. |
| Gamma | 1,0. De 0,5 a 2,0 en pasos de 0,05. |
| Convergencia horizontal | 0. De −3 a +3 % del ancho del visor. Un valor positivo mueve el rojo a la derecha y el cian a la izquierda, cada uno por la mitad del desplazamiento relativo. |
| Alineación vertical | 0. De −2 a +2 % del alto del visor. Un valor positivo baja el rojo y sube el cian, cada uno por la mitad del desplazamiento relativo. |
| Intensidad roja y cian | 100 %. De 0 a 150 %, independientes. El cian modifica verde y azul conjuntamente. |
| Inspección | Anaglifo completo, Canal rojo o Canales cian. Las vistas parciales se identifican en el monitor como inspección. |

La textura de la imagen original se carga una vez. El shader calcula el encuadre proporcional y obtiene dos muestras con desplazamientos opuestos. Usa el rojo de la primera y verde/azul de la segunda, con transparencia independiente y margen transparente fuera de la imagen. El muestreo evita que los bordes reaparezcan por el lado contrario.

La canalización trabaja sobre valores RGB normalizados entre 0 y 1. Para cada componente aplica brillo y contraste con `v = clamp((entrada × brillo/100 − 0,5) × contraste/100 + 0,5, 0, 1)`. Después aplica la intensidad `g`. Hasta 100 %, usa `v × g`. Por encima de 100 %, usa `v × g / (1 + v × (g − 1))`, una curva continua que realza los tonos medios conservando los blancos y evita recortes adicionales del balance. La gamma aplica `salida = v^(1/gamma)`. Así, gamma mayor que 1 aclara los tonos medios conservando negro y blanco, mientras el brillo multiplica las intensidades.

La inspección enmascara los componentes que no se están examinando. Volver al anaglifo completo conserva todos los ajustes. El encuadre y los desplazamientos se resuelven en la misma pasada, calculando las coordenadas de origen para cada píxel visible. Cada actualización usa la textura original y el estado actual, sin acumular transformaciones.

El renderizador WebGL conserva programa y buffer y cambia uniformes al calibrar. Al sustituir el archivo elimina su textura y las cachés anteriores. Si WebGL no está disponible o se pierde el contexto, una alternativa Canvas usa muestreo bilineal, tablas de color y una previsualización de hasta 1280 px en su dimensión mayor, con una copia de entrada de hasta 2048 px. La textura WebGL conserva la resolución de entrada hasta el límite que informe la GPU. Esos límites afectan a la previsualización y el archivo original permanece intacto.

Los ajustes operan sobre los componentes ya codificados en el anaglifo. El confort binocular y el resultado con unas gafas concretas requieren validación física. El balance puede compensar diferencias de luminosidad percibida. Las separaciones grandes pueden causar incomodidad visual.

## Calibración de imágenes SBS

El inspector organiza los ajustes en **Paralaje y tamaño**, **Alineación** y **Formato SBS**. Puedes plegar cada sección conservando los valores y editar los parámetros mediante el slider o el campo numérico. El icono junto a cada ajuste lo restablece individualmente. **Restablecer calibración** recupera todos los valores iniciales.

| Ajuste | Efecto y rango |
|---|---|
| Paralaje | De −8 a +8 % del ancho por ojo. Reparte la separación horizontal entre las dos vistas en sentidos opuestos. |
| Escala | De 50 a 200 %. A 100 % ajusta cada vista a su región, conservando la proporción correspondiente al formato. |
| Mover X | De −25 a +25 % del ancho por ojo. Mueve ambas vistas juntas hacia la izquierda o derecha. |
| Mover Y | De −25 a +25 % del alto por ojo. Mueve ambas vistas juntas hacia arriba o abajo. |
| Desnivel | De −5 a +5 % del alto por ojo. Reparte la corrección vertical entre las vistas en sentidos opuestos. |
| Tipo de SBS | Full conserva la proporción de cada mitad. Half recupera el ancho de una perspectiva comprimida horizontalmente a la mitad. El recorte de origen sigue usando exactamente la mitad del archivo. |
| Intercambiar L/R | Invierte qué mitad recibe cada ojo. Comienza desactivado. |

Por ejemplo, un Full-SBS de 3840 × 1080 contiene vistas de 1920 × 1080. Un Half-SBS de 1920 × 1080 almacena vistas de 960 × 1080 que se presentan con proporción 1920 × 1080 al seleccionar Half. Full es el valor inicial. Todos los desplazamientos comienzan en cero y la escala en 100 %. Al cargar otra imagen se restablecen esos valores. Las secciones plegadas mantienen su estado al sustituirla.

Los controles modifican el encuadre y mantienen cada ojo dentro de su región. Al ampliar por encima del ajuste inicial o desplazar el contenido, las partes que exceden esa región quedan fuera del encuadre. El archivo original y su resolución se conservan. VR usa los mismos parámetros y los devuelve al inspector al salir.

## Arquitectura

| Módulo | Responsabilidad |
|---|---|
| `main.js` | Selección de fuente, coordinación de estado, controles y mensajes del Studio |
| `media.js` | Validación del formato y decodificación, cancelación de importaciones y liberación de URL locales |
| `anaglyph.js` | Shader anaglifo, procesamiento por componentes, gamma, inspección y alternativa Canvas |
| `renderer.js` y `sbs.js` | Canvas adaptable, recortes por ojo y composición desde un único fotograma de video |
| `calibration.js` | Valores iniciales, rangos y escala proporcional |
| `calibration-panel.js` | Inspector compartido de anaglifo e imágenes SBS, secciones, entradas numéricas y restablecimiento individual |
| `playback.js` | Fuente temporal nativa, transporte, volumen y estados de reproducción |
| `vr.js` | Presentación binocular, pantalla completa opcional y retorno al Studio |

## Alcance

El editor trabaja con material que ya contiene información estereoscópica. La calibración modifica el encuadre en pantalla. La disparidad del contenido, el desplazamiento digital y la distancia interpupilar física son parámetros distintos. SBS admite dos mitades de ancho igual. En imágenes puedes seleccionar Full-SBS o Half-SBS para interpretar la proporción por ojo. La compatibilidad de MP4 depende de los códecs del navegador. El visor Cardboard presenta dos perspectivas fijas sin seguimiento de movimiento. El Studio no requiere conexión para procesar el medio una vez cargados sus recursos.

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

Consulta [los resultados y las capturas](tests/results.md), [el sistema visual y las decisiones aplicadas](DESIGN.md) y [el contexto de producto](PRODUCT.md).

Las muestras procedurales de `tests/fixtures` contienen perspectivas generadas por separado. El anaglifo combina el canal rojo de la izquierda y los canales verde y azul de la derecha. El video y la imagen SBS concatenan ambas vistas.

La arquitectura permite comparar la asignación de ojos y los ajustes mediante el propio raster que ve el usuario. La reproducción usa el reloj y los estados de un solo elemento de video, y ambas vistas se componen a partir de la misma copia del fotograma. La entrada y salida del visor modifica la presentación del mismo medio en memoria.

La comprobación física de los lentes rojo-cian, el confort binocular y la reproducción en el teléfono de evaluación requiere una sesión presencial.

Creado por Alonso Ramírez Gutiérrez
