# Verificación de Galería entre fases

## Capacidad ampliable y título — 16 de octubre de 2026

Se retiró el tope de 22 obras. La migración 0003 conserva los IDs, códigos existentes, entregas, sesiones y publicación, y prepara 40 espacios iniciales. Cuando se ocupan, el servidor crea y reserva un espacio adicional en una transacción D1. El panel calcula sus totales con los datos reales. La publicación del organizador admite más de 22 grupos. Se mantienen las protecciones de sesión y los límites de intentos por IP.

Verificación: 16 pruebas unitarias aprobadas, incluida una migración repetida que preserva una entrega del espacio 22, 50 asignaciones simultáneas únicas y publicación administrativa de 45 grupos. Además, en una copia aislada se publicaron 50 obras mediante las rutas reales de carga y publicación con D1/R2 locales. Se conservaron las tres demos previas y se llegó al espacio 53. Informe: `output/capacity-tests.json`. Esta prueba repite una referencia de demostración para comprobar capacidad; no mide reconocimiento de 50 imágenes distintas ni rendimiento físico de cámara.

El panel local mostró 40 espacios y conservó las tres demos. El título de la pestaña principal se comprobó como **Galería entre fases**, sin descriptor, en portada, creación y organizador. El código y la carpeta de subida se sincronizan con GitHub. Falta aplicar la migración en D1 remoto y comprobar 40 imágenes distintas definitivas en celulares.


## Revisión previa a Cloudflare — 16 de octubre de 2026

**Resultado: flujo local aprobado para iniciar un despliegue de prueba.** La revisión se ejecutó sobre una copia de D1/R2 en `.wrangler/review-20261016`, servida en `127.0.0.1:8790`. Los datos de la galería habitual en 8788 no se usaron para publicar material de prueba. No se creó ni conectó infraestructura remota.

- **104 comprobaciones aprobadas**: 13 pruebas unitarias (validadores y concurrencia del organizador), 22 de API administrativa, 22 de creación/sesiones, 23 de publicación automática/reemplazo/cierre, 15 de interfaz/cámara y 9 de recuperación ante errores controlados.
- Publicación real desde la interfaz con PNG de 12 MiB y MP4 de 50 MiB exactos, usando los fixtures descritos más abajo. Pantalla de éxito persistente al recargar; desde su botón se abrió el escáner y la nueva imagen activó su propio video.
- Las tres demos volvieron a reconocerse con el detector real de MindAR y cámara sintética. No hubo dos videos de obra reproduciéndose a la vez. La cámara liberó sus pistas al cerrar; el cambio trasera/frontal/trasera mantuvo Entendido.
- Publicaciones simultáneas conservaron ambas obras. Reemplazar una pieza mantuvo su espacio y todas las obras de los demás. Los endpoints rechazaron archivos falsos, tamaños superiores al máximo, modificaciones ajenas, referencias incompletas y nuevas publicaciones con el cierre activo.
- Se verificaron los mensajes y recuperación ante falta de red, imagen inválida, permiso de cámara denegado y colección vacía. Los errores de esta prueba se provocaron de manera controlada; no equivalen a una matriz de dispositivos físicos.
- **Corrección aplicada:** la publicación completa del organizador ahora exige que la versión pública siga siendo la que leyó antes de preparar la escritura. Si otra pieza se publica durante ese proceso, devuelve 409 y pide preparar de nuevo, en vez de sobrescribirla. Dos pruebas con SQLite reproducen el caso y la publicación normal.
- **Herramientas actualizadas:** Vite 6.4.4 y Wrangler 4.151.1. La auditoría del árbol completo de dependencias reportó **cero vulnerabilidades conocidas**, frente a 33 avisos en las versiones anteriores; los avisos anteriores estaban en herramientas de desarrollo y sus dependencias. Esto no certifica ausencia de vulnerabilidades desconocidas.
- TypeScript de cliente/servidor, Vite y el paquete real de Pages Functions compilaron correctamente. El paquete estático contiene 29 archivos, el mayor de 2.2 MB. No se encontraron los códigos privados en `dist/`.

Evidencia actual: `output/review-2026-10-16.json`, `output/dependency-audit.json`, `output/deploy-review.json`, los informes de pruebas listados abajo y `output/cloudflare-review/index.js` (paquete de Functions, sin desplegar).

**Límite del resultado:** falta el primer despliegue HTTPS con los bindings reales DB/MEDIA y el secreto del organizador, medir CPU/memoria en la cuenta de Cloudflare y probar Safari/iPhone y Chrome/Android físicos. Tampoco se ha medido el seguimiento con 22 ilustraciones distintas definitivas. El funcionamiento local está comprobado; el evento público necesita esas pruebas en el entorno final. Los límites actuales de Cloudflare separan tamaño por solicitud, CPU y memoria; que un archivo entre en el límite de subida no certifica los demás ([documentación oficial](https://developers.cloudflare.com/workers/platform/limits/), consultada el 16/10/2026).

Las pruebas admiten `BASE_URL` para dirigirlas a un entorno aislado. `pnpm test:errors` reproduce los nueve casos de recuperación. La copia de revisión conserva únicamente datos locales de prueba y queda fuera de Git y del despliegue.

## Verificación anterior — 15 de octubre de 2026

Fecha: **15 de octubre de 2026**, hora local de El Salvador. Proyecto independiente: `galeria-ar/`. Pruebas ejecutadas en Windows con Node 24, Wrangler local y Chromium.

## Resultado comprobado

Actualización del flujo: creación sin códigos, nombre ni título; dos selectores con checks y botón **Publicar**. El navegador compila la referencia y el servidor publica la pieza sin revisión manual. Se comprobó el flujo completo con una imagen válida de **12 MiB exactos** y un MP4 de **50 MiB exactos**, ampliados mediante bloques legales del contenedor: validan transferencia y límites, no representan 50 MiB de complejidad de codificación. Desde el botón de éxito se abrió la cámara, se reconoció esa imagen y se reprodujo su propio video. No se simularon eventos de reconocimiento.

**15 comprobaciones adicionales de publicación aprobadas**: límites, sesión/propiedad, archivos falsos, publicación incompleta, dos publicaciones simultáneas sin pérdida de obras e idempotencia. Las 22 comprobaciones de creación de la versión previa corresponden al endpoint de entrega privada conservado por compatibilidad. Las pruebas de cambio de cámara usan un dispositivo sintético; falta probar las dos cámaras físicas de un teléfono.

| Área | Resultado |
| --- | --- |
| TypeScript del cliente | Sin errores |
| TypeScript del servidor y Pages Functions | Sin errores |
| Compilación Vite de producción | Correcta |
| Validación de archivos | **11 pruebas aprobadas**: PNG/CRC, JPEG, archivos truncados/falsos, dimensiones, MP4/H.264, duración y proporciones |
| Integración API + D1 + R2 locales | **22 verificaciones aprobadas**: autenticación, privacidad, carga, aprobación, reemplazo, cierre, CSRF, publicación independiente y rangos de video |
| Interfaz en Chromium | **15 verificaciones aprobadas** del formulario actual: checks, ausencia de nombres nativos, ancho móvil, Entendido, cámara sin textos, cambio frontal/trasera y cierre |
| Publicación automática | Flujo real con 12 MiB + 50 MiB, pantalla de éxito, persistencia al recargar, reconocimiento de la pieza nueva y cierre de cámara; obras anteriores conservadas |
| API de publicación automática | **15 verificaciones aprobadas**, incluidas publicaciones simultáneas y rechazo de 12 MiB + 1 / 50 MiB + 1 |
| Compilación integrada del organizador | Tres imágenes compiladas por el compilador real de MindAR, publicadas desde la ventana del panel y recuperadas desde R2 local |
| Reconocimiento MindAR real | **3 de 3 demos** reconocidas otra vez con la referencia nueva incorporada; además, la nueva pieza publicada activó exclusivamente su propio MP4 de 50 MiB en su prueba |
| Carga de videos | Cero solicitudes de video al abrir la portada; no se descargan los 22 al entrar |
| Reproducción simultánea | La prueba de cámara comprobó que nunca hubiera más de un video de obra reproduciéndose |
| Cierre de cámara desde la interfaz | Todas las pistas capturadas quedaron en estado `ended` después de cerrar el escáner integrado |
| Diseño adaptable | Capturas revisadas de escritorio de 1280 px y móvil de 390 px; sin desbordamiento horizontal en la prueba móvil |
| Protección de marcos internos | Escáner y compilador comprobados dentro de la aplicación con la política CSP final; solo se permite enmarcado del propio origen |
| Publicación inicial local | Tres demos aprobadas y publicadas, un solo archivo de referencias |

La prueba de reconocimiento **no disparó eventos falsos de detección**. Se generó un video Y4M con las tres ilustraciones, se utilizó como dispositivo de cámara de Chromium y se ejecutaron el detector, seguimiento, anclajes, renderizado y reproductor reales de MindAR/Three.js. Esto comprueba la correspondencia de objetivos y videos con esa entrada controlada. No demuestra todavía el rendimiento de una cámara física, impresión, iluminación o procesador móvil.

La primera versión de la imagen «Órbita interior» fue menos fiable en esa prueba. Se añadieron detalles asimétricos, se regeneró su video y se volvió a entregar, aprobar y compilar. La publicación final y `public/demo/01.png` corresponden a la versión que pasó la prueba.

Los espacios usados para pruebas automatizadas de entregas se limpiaron después; solo quedaron las entregas de demostración de los espacios 1–3. Los objetos huérfanos de pruebas pueden seguir en el R2 **local**, privados y sin publicación. No se eliminaron recursos remotos ni se generaron gastos.

## Evidencia local

- `output/api-tests.json`: resultado de las 22 comprobaciones de API.
- `output/ui-tests.json`: resultado de las 15 comprobaciones de la interfaz actual.
- `output/autopublish-tests.json`: publicación automática de 12 MiB + 50 MiB y reconocimiento real sintético.
- `output/publication-api-tests.json`: 15 comprobaciones de la nueva API.
- `output/publicar-formulario.png`, `output/publicar-archivos-listos.png`, `output/pieza-publicada.png`, `output/pieza-publicada-ar.png`: formulario, checks, éxito y reconocimiento de la publicación nueva.
- `output/creator-tests.json`: 22 comprobaciones adicionales de creación sin códigos.
- `output/camera-tests.json`: tres correspondencias verificadas y cierre de las pistas.
- `output/manifest.json`: instantánea de la publicación local.
- `output/escritorio.png`, `output/movil.png`: vistas públicas.
- `output/ar-1.png`, `output/ar-2.png`, `output/ar-3.png`: reconocimiento y video de cada ilustración.
- `output/portal-estudiante.png`, `output/panel-organizador.png`: flujo de gestión en navegador.

Los archivos de `output/` son evidencia local y no se incluyen en el despliegue. Los videos originales están en `demo/videos/`; las imágenes imprimibles, en `public/demo/`.

## Pendiente de validar antes de presentar

1. **Desplegar en Cloudflare mediante HTTPS.** Faltan crear/conectar los recursos y configurar los bindings y el secreto, según README. No se ha probado ninguna cuenta remota ni el workflow de GitHub Actions.
2. Probar en **Safari de iPhone y Chrome de Android** reales: consentimiento y denegación de cámara, reproducción silenciada, repetición, seguimiento al mover el teléfono, pérdida/recuperación del papel y cierre/reapertura.
3. Imprimir las tres imágenes en papel mate, sin recortar ni cambiar proporciones; escanearlas con buena luz y después con las condiciones de la exposición.
4. Confirmar que al bloquear el teléfono, cambiar de pestaña y salir de la experiencia se apaga el indicador físico de cámara. La prueba automática de cierre fue en Chromium de escritorio con cámara sintética.
5. Medir memoria, fluidez y tiempo de detección con las **22 ilustraciones definitivas**. Los 22 espacios están implementados; se han compilado/reconocido cuatro objetivos distintos. Si el conjunto grande no rinde bien, usar la ruta avanzada por grupos y verificar cada grupo.
6. Medir carga/CPU/memoria de Pages Functions en el **plan gratuito real**, con imágenes y videos de tamaño representativo y máximo. La validación local no certifica las cuotas comerciales de Cloudflare. No se autoriza automáticamente un cambio de plan.
7. Probar conexión lenta, pérdida de red, permisos bloqueados permanentemente y navegadores sin WebGL. Hay mensajes y alternativas implementados; la matriz completa de errores físicos no se ha ejecutado.
8. Revisar y reemplazar el branding provisional, compartir el enlace de creación con el grupo, cargar las obras definitivas y generar el QR con la URL HTTPS final.

## Ensayo recomendado para el lunes 19 de octubre

- Abrir las referencias en otra pantalla o imprimir `public/demo/imprimir.html`.
- Entrar a la URL HTTPS desde el celular, permitir la cámara y escanear 01, 02 y 03.
- Comprobar el título y movimiento correctos en cada una; retirar el papel, recuperarlo y repetir la animación.
- Cerrar la cámara y comprobar que se apaga el indicador del sistema.
- Publicar una imagen y video sin códigos, esperar «Pieza publicada con éxito», abrir su botón de cámara y escanearla. Comprobar que las obras previas siguen funcionando.
- Al terminar, conservar la publicación conocida que funciona. Para el evento del 26 de noviembre, repetir el ensayo con **cada obra definitiva** y la conexión del lugar.

La primera versión está verificada de extremo a extremo **en el entorno local descrito**. La aprobación definitiva de la experiencia física requiere completar estas comprobaciones en celulares con HTTPS.

## Recorte del video — 16 de octubre de 2026

Se eliminó el bloqueo por diferencia de proporción entre imagen y video. La referencia sigue obligada a coincidir con la imagen original. La vista previa y la textura del escáner recortan el video desde el centro para llenar la imagen, sin deformación ni transcodificación.

Verificado: 17 pruebas unitarias, TypeScript de cliente y servidor, compilación Vite, y publicación real en una base local aislada con imagen 640×800 y video 640×820. La cámara sintética reconoció la pieza, reprodujo el video y detuvo las pistas al cerrar. Evidencias locales: `output/video-frame/result.json`, `preview.png` y `scanner.png`. No se subieron obras de prueba a producción.

## Tipografía responsive y video de 100 MB — 16 de octubre de 2026

Crea tu obra pierde el punto final e incorpora debajo la indicación de proporción. Portada y formulario aumentan sus titulares y subtítulos en móvil; en escritorio los titulares son menores y los subtítulos mayores. Revisadas visualmente las capturas y comprobados 12 diseños (portada y formulario a 320, 390, 430, 768, 1366 y 1920 px), sin desbordamiento.

Se elimina el máximo de duración y se aceptan videos de hasta 100 000 000 bytes en la carga principal por streaming. Se comprueban duraciones positivas finitas, sin un tope temporal. Verificados un MP4 real de 30 segundos y 100 MB exactos, imagen de 12 MiB, publicación y reconocimiento con cámara sintética. Se añade un reintento idempotente del paso final ante errores temporales de red o servidor (sin repetir las cargas ni reintentar errores 4xx).

Validación: 18 pruebas unitarias; tipos de cliente y servidor; compilación; 23 comprobaciones de la API (incluido rechazo de 100 MB + 1 byte y publicaciones simultáneas). Evidencias locales: `output/responsive/results.json`, `output/autopublish-tests.json`, `output/publication-api-tests.json`. Todas las cargas de esta verificación se hicieron en `.wrangler/video-100-regression`, separadas de producción.

## Descripción al compartir y simplificación — 16 de octubre de 2026

Descripción y Open Graph: «Galería de imágenes que se mueven gracias a la realidad aumentada». Se conserva el título de pestaña Galería entre fases. Titular de portada móvil ampliado (51,09 px a 390 px); logo móvil reducido sutilmente de 140 a 134 px; escritorio permanece en 84 px y logo 172 px. Colección: «Imágenes y sus animaciones» y «Aquí verás la colección de imágenes con sus respectivas animaciones», sin contador. Se retiran pie de página, acceso, pantalla de inicio de sesión y panel de organización. La ruta antigua vuelve al inicio; el antiguo portal con código deriva al creador sencillo. Las operaciones internas del servidor siguen protegidas.

Verificados los metadatos en HTML sin ejecutar JavaScript, 15 diseños (3 pantallas a 320, 390, 430, 768 y 1366 px), ausencia de desbordamiento y errores de JavaScript, retirada de pie y enlaces, y acceso directo a la antigua ruta sin formularios ni llamadas a administración. Galería y sesión simuladas en navegador: no se añadieron obras ni archivos a producción. Evidencias locales: `output/simplified/results.json` y capturas en esa carpeta. Tipos de cliente/servidor y compilación correctos.

## Cámara abierta sin obras y acceso a colección — 16 de octubre de 2026

La cámara se abre antes de consultar la colección. Si no hay referencias, el video del dispositivo continúa activo con la indicación inicial y Entendido; no se carga MindAR ni se muestra un error por colección vacía. La misma cámara se reutiliza al iniciar el reconocimiento cuando sí hay obras. Se retiran del escáner Reiniciar cámara y Ver animaciones sin cámara. El encabezado incorpora Ver colección, alineado a la derecha.

Verificado: tipos de cliente/servidor y compilación; 15 comprobaciones de cámara vacía y navegación (320, 390 y 1366 px, reproducción de cámara, Entendido, cambio de cámara y liberación de pistas); reconocimiento real de las tres ilustraciones locales con cámara sintética y video correcto; errores reales de permisos y red sin botones retirados. Evidencias: `output/empty-camera/results.json`, `output/camera-tests.json`, `output/error-tests.json`. No se añadieron obras a producción.

## Botón de marca y borrado de parejas — 16 de octubre de 2026

Ver colección adopta el borde amarillo #FEF605 y el relleno circular animado de la referencia; el texto conserva el color oscuro para ser legible sobre el amarillo. Incluye foco de teclado y respeta movimiento reducido. La biblioteca vacía muestra exactamente «Aún no hay contenido publicado». Cada tarjeta agrupa una imagen con su respectivo video. Cualquier visitante puede borrar cualquier pareja publicada, conforme a la elección explícita del usuario, después de confirmar Borrar imagen y video.

La eliminación actualiza la publicación de forma atómica, borra los dos archivos de R2 y retira las referencias que dejaron de usarse; conserva las referencias compartidas por otra pareja. Registros de borrado impiden resucitar parejas en publicaciones simultáneas y permiten reintentar una limpieza interrumpida. Los espacios sin otras revisiones se liberan. Subir otra pareja inicia una publicación independiente; se conserva el resto de la colección. Se añadió la migración 0004, aplicada en la base pública sin añadir obras.

Validación: 28 pruebas unitarias (incluidas 10 de colección), tipos de cliente y servidor y compilación. Flujo real en base local aislada: 15 comprobaciones con dos parejas publicadas; un tercer visitante cancela y luego borra la primera, imagen y video dejan de responder, la segunda se conserva, se publica un reemplazo reutilizando el espacio y se borran ambas hasta quedar vacía. Revisadas capturas a 320, 390 y 1366 px y animación del botón. Evidencias locales: `output/collection/results.json`, `pairs-390.png`, `pairs-1366.png` y `button-hover.png`. No se subieron obras de prueba a producción.

## PIN de acceso y cabecera más compacta — 16 de octubre de 2026

Estado actual: colección, creación, publicación, borrado e imágenes requieren el PIN compartido validado en el servidor. El formulario tiene un único campo. Cookie HttpOnly con ocho horas de vigencia y Secure en HTTPS; límite de intentos de PIN por IP. El secreto se configura fuera de Git. La cámara y los recursos mínimos de reconocimiento permanecen públicos. Esta política sustituye las referencias anteriores a creación o colección sin código.

Validación: 35 pruebas unitarias, tipos de cliente y servidor y compilación. Flujo completo con publicación real en una base local aislada: entradas directas protegidas, PIN incorrecto y correcto, publicación autorizada, bloqueo de API e imágenes sin PIN, cookie anterior insuficiente, reconocimiento y reproducción sin PIN y borrado autorizado hasta dejar la colección vacía. Sin errores de JavaScript. Evidencias: `output/pin-access/results.json` y capturas del formulario a 320, 390 y 1366 px.

Se reduce sutilmente la cabecera en móvil y escritorio, según la última indicación: 82→76 px en móvil y 112→106 px en escritorio; logo 134→128 y 172→164 px; texto de Ver colección 12→11,5 y 14→13,5 px. No cambia el tamaño de titulares ni de los botones principales.
