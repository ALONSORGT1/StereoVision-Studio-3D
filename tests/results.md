# Evidencias de validación

La suite usa Playwright con Google Chrome instalado. Ejecuta las pruebas desde la raíz del proyecto.

```powershell
npm --prefix tests ci
npm --prefix tests test
```

La ejecución local sirve la aplicación en una ruta equivalente al subdirectorio de GitHub Pages. Para comprobar la publicación con las mismas pruebas, usa la URL HTTPS.

```powershell
$env:STUDIO_URL = 'https://alonsorgt1.github.io/StereoVision-Studio-3D/'
npm --prefix tests test
Remove-Item Env:STUDIO_URL
```

Las capturas de cada ejecución quedan en `test-results/`. Las muestras se crearon para este proyecto mediante dos cámaras virtuales separadas. Cada cámara proyecta los mismos objetos 3D desde su posición. El anaglifo codifica la luminancia izquierda en rojo y la derecha en verde y azul. El video conserva las dos vistas en cada fotograma y usa H.264 y AAC. Para regenerar los archivos instala NumPy e imageio-ffmpeg y ejecuta `python tests/generate-fixtures.py`.

## Matriz de comprobaciones

| ID | Evidencia técnica |
| --- | --- |
| P-01 | La pantalla inicial deshabilita importación, calibración y VR. Tabulador, Enter y Escape permiten abrir y cerrar la ayuda. |
| P-02 | Con `orbital-anaglifo.png` se comparan capturas del lienzo al aplicar escala 130 %, brillo 125 % y contraste 125 %. El restablecimiento reproduce la captura inicial. |
| P-03 | Con `orbital-sbs.png` se comparan muestras de píxeles en ambas mitades. Se comprueba el intercambio, desplazamiento horizontal de 8 %, alineación vertical de 4 %, escala de 135 % y restauración. |
| P-04 | Con `orbital-sbs.mp4` se comprueba que el video inicia pausado, reproduce al pulsar el control, pausa, busca a 2.50 s, salta hacia atrás y adelante e informa duración y volumen. |
| P-05 | Durante reproducción, el desplazamiento horizontal de 8 % cambia el destino del recorte y la escala de 135 % cambia su anchura. Las dos vistas se dibujan con regiones distintas de una única captura al mismo tiempo del video. |
| P-06 | Cambiar de video a imagen detiene el video, limpia su fuente y revoca su URL. Sustituir la imagen conserva el documento y restablece la calibración. |
| P-07 | Se prueba una extensión no admitida y un PNG con cabecera válida y datos incompletos. La vista anterior permanece disponible y una importación válida recupera el Studio. |
| P-08 | En emulación táctil se comprueban la rotación, el aviso vertical, la salida y la continuidad de imagen, ajustes y video. La solicitud de pantalla completa se rechaza deliberadamente para probar la alternativa integrada. |
| P-09 | Se comprueban errores de consola y solicitudes HTTP, incluyendo el subdirectorio de publicación. |

## Dispositivos y alcance

La prueba de escritorio se ejecuta a 1440 × 900. La prueba móvil se ejecuta en Chrome con un perfil táctil de iPhone 13 a 390 × 664 y con el visor a 844 × 390 en horizontal. Quedan pendientes la comprobación en un teléfono físico, la observación con filtros rojo/cian y la evaluación binocular con un visor Cardboard.

## Resultado y capturas

En Google Chrome 139.0.7258.155 para Windows, la ejecución HTTP local completó P-01 a P-08 y la comprobación de rutas bajo el prefijo del repositorio. La ejecución contra GitHub Pages por HTTPS completó P-01 a P-09 en escritorio y en la emulación móvil, sin errores de consola, respuestas HTTP fallidas ni solicitudes a otros orígenes. [Aplicación publicada](https://alonsorgt1.github.io/StereoVision-Studio-3D/)

- [Imagen SBS calibrada en escritorio](evidence/escritorio-sbs.png)
- [Studio con imagen SBS en móvil emulado](evidence/movil-sbs.png)
- [Visor VR horizontal en móvil emulado](evidence/vr-horizontal.png)

## Incidencias durante la validación

1. Al mostrar por primera vez el lienzo, la comparación de píxeles detectó dimensiones iniciales distintas a las del monitor. El renderizador actualiza el tamaño al cargar el medio y la prueba confirma el cuadro estable antes de comparar.
2. Un fallo en la generación inicial dejó la muestra de video incompleta y el navegador rechazó el MP4. Se regeneró el archivo de seis segundos con H.264 y AAC y se comprobó su reproducción, calibración y búsqueda en el navegador.

## Calibración avanzada de Imagen SBS

Las comprobaciones de tests/calibration-checks.mjs se ejecutan desde la suite de navegador. Se verificaron en HTTP local los siguientes casos.

- Paralaje y desnivel de −4,2 y +4,2 %, con destinos en sentidos opuestos por ojo.
- Mover X y Mover Y de −4,2 y +4,2 %, con idéntico desplazamiento para ambos ojos.
- Escala de 145 %, con anchura y altura multiplicadas por 1,45 y recortes de origen intactos.
- Creación de una imagen Half-SBS comprimida a partir del par Full-SBS y recuperación de proporción 16/9 por ojo. La selección de formato conserva las regiones de origen.
- Intercambio de regiones L/R y restablecimiento individual de los cinco parámetros numéricos, el formato y el intercambio.
- Sincronización slider/campo, límites numéricos, recuperación de entradas vacías y persistencia al plegar.
- Conservación de todos los campos en VR y comprobación de los desplazamientos aplicados al raster inmersivo.
- Restablecimiento completo, carga de otra demo y liberación de recursos en sustituciones.
- Entrada táctil en móvil emulado, campos de desplazamiento, selector Half-SBS y retorno desde VR.
- Distribución sin desplazamiento horizontal a 320, 768, 1024 y 1440 px.
- Regresión de anaglifo, video y las seis demos mediante P-01 a P-08.

El perfil móvil usa emulación de Chrome. La validación con teléfono y gafas físicos sigue pendiente.

La versión publicada también completó P-01 a P-09 y la comprobación avanzada en Chrome 139 por HTTPS. Se verificaron las secciones mediante Enter y Espacio y el cambio del slider con flecha de teclado. Una prueba táctil adicional sobre la demo Arrecife azul confirmó que una pulsación del slider cambia el raster y el campo numérico. La sustitución de imagen con un campo todavía enfocado fuerza la actualización a los valores iniciales.

Las descargas iniciales de los videos de demostración superaron el límite de 30 segundos de la primera ejecución remota. La comprobación directa respondió HTTP 200 para los seis recursos y el Studio los abrió correctamente. La suite usa ahora hasta 120 segundos para esperar la descarga de una demo y conserva diagnósticos de estado en caso de fallo. La ejecución posterior terminó correctamente.

- [Inspector avanzado en escritorio](evidence/calibracion-avanzada.png)
- [Inspector avanzado en móvil emulado](evidence/calibracion-movil.png)

## Anaglifo avanzado

La suite incluye tests/anaglyph-checks.mjs. Usa una imagen PNG con fondo RGB conocido y marcadores independientes para rojo y cian. En HTTP local, Chrome 139 completó las siguientes comprobaciones con el renderizador WebGL y con WebGL deshabilitado deliberadamente para usar Canvas.

- Convergencia de −1,2 y +1,2 % y alineación vertical de −1,2 y +1,2 %. Los centroides de los marcadores se desplazan en sentidos opuestos, conservando la otra coordenada.
- Intensidad roja al 50 % sin cambios en verde/azul, y cian al 50 % sin cambios en rojo.
- Gamma de 0,5, 1,05 y 2 comparada con los valores RGB calculados mediante la convención documentada.
- Combinación de desplazamientos, balance y gamma. Rojo y cian aislados conservan exactamente los componentes seleccionados y anulan los demás.
- Retorno al modo completo y restablecimiento sin acumulación de procesamiento.
- Restablecimiento individual de los ocho parámetros numéricos y del modo de inspección.
- Entrada de gamma en pasos de 0,05 y conservación al plegar mediante teclado.
- Imagen de 4096 × 3072. La instrumentación de texImage2D confirmó que ajustar gamma no vuelve a subir la textura. Los tiempos medidos corresponden al envío síncrono de cambios y no equivalen a una medición de FPS ni de latencia física de la pantalla.
- Sustitución por una demo con un campo numérico enfocado, restablecimiento de valores y eliminación de la textura anterior.
- Pulsación táctil del slider gamma en móvil emulado, inspección roja, entrada numérica y restablecimiento global.

También se completó la regresión de escala, brillo, contraste, calibración SBS, video, VR y las seis demos. Los filtros rojo/cian y el confort con gafas físicas siguen pendientes de comprobación presencial.

La prueba adicional de pérdida del contexto WebGL confirmó que el visor continúa mediante Canvas y vuelve al shader después de restaurar el contexto, conservando la representación. El balance por encima de 100 % y la combinación de brillo 115 %, contraste 90 %, intensidades 80/110 % y gamma 1,2 se comparan con valores RGB calculados de antemano.

- [Inspector e inspección roja en escritorio](evidence/anaglifo-inspeccion.png)
- [Inspector anaglifo en móvil emulado](evidence/anaglifo-movil.png)

## Revisión de las restricciones de carga

Se retiró el rechazo por extensión, la validación parcial obligatoria de cabeceras MP4 y la exigencia de ancho par en SBS. Las firmas conocidas se usan para normalizar el MIME, mientras la decodificación efectiva decide si el medio puede abrirse. El cargador reintenta una vez con una copia de bytes cuando falla la lectura inicial y conserva el archivo anterior ante un error definitivo.

Las pruebas de tests/import-checks.mjs cargan archivos reales mediante el mismo input del Studio. La matriz local en Chrome 139 comprobó JPEG, PNG RGB de 16 bits, WebP, GIF, BMP y AVIF de 129 × 97 en ambos módulos de imagen. También comprobó nombres con mayúsculas y espacios, JFIF con MIME genérico, JPEG sin extensión y WebP con un nombre PNG.

En video se comprobaron el MP4 H.264 de referencia, una variante válida con un átomo free de tamaño extendido antes de ftyp y un archivo M4V con MIME genérico. Las pruebas forzaron un fallo inicial de una URL respaldada por File en los tres módulos y comprobaron la recuperación desde la copia de bytes. Los archivos incompletos siguen produciendo errores recuperables.

Las muestras adicionales se regeneran mediante python tests/generate-import-fixtures.py con imageio-ffmpeg instalado. La suite completa sigue verificando calibración, restablecimiento, sustitución, reproducción y VR. La compatibilidad de archivos particulares depende también de los códecs instalados y del navegador. Los archivos concretos que motivaron el reporte no se proporcionaron para esta revisión.

## Corrección del selector Android

La captura del usuario mostró el error de lectura completa, después de que fallara la URL inicial. Se encontró que la aplicación consultaba size, hacía slice antes de la lectura completa y vaciaba el input inmediatamente. El flujo corregido inicia arrayBuffer dentro de change/drop, antes de consultar metadatos, crea una copia independiente y limpia el selector al terminar. Una selección nueva conserva su input mientras finaliza una anterior. El selector solicita */* para usar la ruta general de documentos. La entrada y los módulos modificados incluyen una versión en la URL para evitar reutilizar el código anterior en caché.

Se añadió una simulación del proveedor Android que invalida el archivo si se consulta size/slice antes de leerlo, si la lectura se inicia fuera del evento o si el input se vacía mientras está pendiente.

| Ejecución | Resultado |
|---|---|
| Código anterior b7e8bf3 | Reproduce exactamente «No se pudo leer el archivo completo. Descárgalo al dispositivo y vuelve a seleccionarlo.». Registra dos accesos tempranos a metadatos, una limpieza temprana y una URL del archivo original. |
| Código corregido | Carga la misma imagen. Registra una lectura completa y cero accesos tempranos, limpiezas tempranas o URL del proveedor. |

La suite local completó las pruebas de ese modelo en anaglifo, imagen SBS y video, así como dos selecciones consecutivas durante la lectura. También completó la matriz de formatos, reproducción, calibración, VR y las seis demos.

El fallo del proveedor está descrito en el [reporte de Chromium](https://issues.chromium.org/issues/40123366). La prueba automatizada modela ese comportamiento en Chrome de escritorio. El teléfono físico del usuario sigue pendiente de comprobación.

## Inicio progresivo de las demos de video

La versión anterior descargaba cada MP4 entero con fetch, lo convertía a Blob/File y volvía a copiar sus bytes antes de prepararlo. Con caché desactivada, 4 Mbps de descarga y 80 ms de latencia configurados en Chrome, GitHub Pages tardó 16.777 ms para Cañón y 18.131 ms para Metrópolis.

La nueva ruta entrega la URL publicada al mismo cargador multimedia. El elemento video solicita sus datos progresivamente y el resto del Studio utiliza los mismos controles, calibración, reloj y raster compartido por los ojos. La importación de archivos locales conserva la captura inmediata de bytes. La cancelación de una demo limpia el elemento de video y detiene su lectura.

Se recodificaron los dos recursos con H.264, CRF 27, límite de tasa, GOP de un segundo y faststart. Los tamaños bajaron de 8.028.357 a 3.531.945 bytes y de 8.677.249 a 3.547.880 bytes. La comparación SSIM con las versiones previas dio 0,979410 y 0,982930. Se inspeccionaron visualmente fotogramas de ambos y se conservan 360 fotogramas, 1920 × 540, 24 FPS y 15,00 segundos.

tests/video-startup-checks.mjs comprueba ambos videos con caché desactivada y red limitada a 4 Mbps / 80 ms. Mide el tiempo hasta el primer fotograma visible, comprueba que las peticiones son de tipo media con rangos de bytes y que el código no lee la demo como File. También verifica reproducción, búsqueda a 10 segundos y cancelación al seleccionar otra demo.

| Servidor local bajo la red limitada | Cañón | Metrópolis |
|---|---|---|
| Escritorio | 725 ms | 788 ms |
| Móvil emulado | 556 ms | 782 ms |

El primer fotograma apareció con entre 0,6 y 1,2 segundos de contenido almacenado en búfer. Las cifras corresponden al entorno medido y pueden variar según la conexión, caché y dispositivo. El servidor de pruebas implementa respuestas HTTP 206 para reproducir la carga por rangos de GitHub Pages.
