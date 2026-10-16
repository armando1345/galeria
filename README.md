# Galería entre fases — realidad aumentada

Primera versión integral e independiente para una colección ampliable de Estrategia Publicitaria, con al menos 40 obras previstas. Identidad oficial con logo y favicon aportados por el organizador, acento #FEF605 e interfaz en español. Presentación prevista: **19 de octubre de 2026**. Exposición: **26 de noviembre de 2026**.

El reconocimiento MindAR se ejecuta en el navegador del visitante. No se envían fotogramas de la cámara al servidor ni se usa un servicio comercial por reconocimiento.

## Abrir la versión ya preparada en este equipo

1. Si el servidor sigue encendido, abre **http://127.0.0.1:8788**.
2. Si está apagado, haz doble clic en `Iniciar-galeria.cmd` y deja abierta esa ventana.
3. Portal: `http://127.0.0.1:8788/#/estudiante`.
4. Organizador: `http://127.0.0.1:8788/#/organizador`.
5. Imágenes, impresión y QR: `http://127.0.0.1:8788/#/pruebas`.

El acceso del organizador está en un archivo privado de este equipo:

- `private/organizador.txt`: código del organizador.
- `private/accesos-estudiantes.csv`: accesos anteriores, conservados por compatibilidad; no se piden en el flujo actual.

El estudiante abre «Crea tu obra», selecciona imagen y video y pulsa «Publicar», sin códigos ni registro. La referencia se prepara automáticamente; el mensaje de éxito aparece cuando la pieza ya forma parte de la galería pública. El sitio nunca sirve los archivos privados de accesos. No están incluidos en Git ni en `dist/`.

Los espacios **1–3** contienen demostraciones aprobadas y publicadas. Los espacios restantes están disponibles. Los datos locales persisten en `.wrangler/state/`. No elimines esa carpeta si quieres conservar entregas y publicaciones. Los videos originales de demo están en `demo/videos/` y las imágenes en `public/demo/`. También puedes abrir `public/demo/imprimir.html` directamente para imprimir.

`localhost` y `127.0.0.1` solo sirven en esta computadora. Para el teléfono necesitas desplegar y abrir una URL HTTPS pública; el QR local no permite conectarse desde otro dispositivo.

## Instalación desde una copia nueva

Requisitos: Node.js 24 y pnpm 11.25.0. No hacen falta una cuenta Cloudflare ni servicios de pago para el modo local.

```sh
pnpm install --frozen-lockfile
node scripts/setup.mjs
pnpm db:local
pnpm exec wrangler d1 execute galeria --local --file private/seed.sql
pnpm build
pnpm start
```

`setup` genera 40 códigos iniciales aleatorios de 256 bits y almacena solo sus hashes en la semilla de la base de datos. Si `.dev.vars` ya existe, conserva los accesos. **Copia `private/`, `.dev.vars` y `.wrangler/state/` juntos** para respaldar el entorno local; un clon de Git por sí solo genera otra galería vacía.

En este entorno de Codex, si pnpm no aparece en PATH, el ejecutable incluido está en:

```powershell
& "$env:USERPROFILE\.cache\codex-runtimes\codex-primary-runtime\dependencies\bin\fallback\pnpm.cmd" build
```

Para editar con recarga automática: deja `pnpm start` en una terminal y ejecuta `pnpm dev` en otra. Usa `http://127.0.0.1:5173`; Vite reenvía `/api` a 8788. Para la prueba del escáner usa la versión compilada en 8788.

## Cómo entregar y revisar

1. Cada estudiante abre **Crea tu obra**, selecciona la imagen inicial y el MP4 y pulsa **Publicar**. Solo hay dos campos de archivos; no se pide código, nombre ni título. Un check confirma la selección de cada archivo, sin mostrar el estado nativo ni el nombre.
2. El navegador prepara una referencia MindAR de la imagen, reducida a un máximo de 1024 px por lado. Si hay muy pocos detalles reconocibles, muestra un error. Después envía imagen, video y referencia en solicitudes separadas. El video se transmite directamente a R2; el servidor solo lee sus cabeceras y metadatos para validarlo.
3. El servidor genera una sesión privada mediante una cookie HttpOnly de 90 días. Al publicar la primera entrega, asigna atómicamente un espacio libre; si se ocupan los existentes, crea uno nuevo. Abrir el formulario no reserva espacios. El título y participante se asignan automáticamente y el organizador puede editarlos.
4. La pieza se aprueba y publica automáticamente, conservando las demás obras públicas. Se muestra **Pieza publicada con éxito. Escanéala para ver el resultado.**, con un botón que abre el escáner de toda la galería. La preparación y la subida pueden tardar; no se anuncia éxito antes de terminar.
5. **Cambiar archivos** permite publicar otra versión desde el mismo navegador. La anterior sigue visible hasta que termina la nueva publicación. Dos publicaciones simultáneas conservan ambas piezas mediante una escritura condicional en D1.
6. El organizador conserva el panel de revisión y publicación completa. Sus cambios administrativos requieren publicar de nuevo la colección para hacerse públicos. Puede cerrar o reabrir publicaciones; el servidor también aplica el cierre.

Se admite un máximo de 12 intentos de publicación por navegador al día. Las revisiones y cargas anteriores se conservan; controla el uso del bucket antes de muchas rondas de entregas. Para retirar una obra ya publicada, desactiva todas sus revisiones aprobadas y publica de nuevo desde el panel. Si hay varias aprobadas y activas para un mismo espacio, se elige la más reciente. El portal anterior con códigos sigue disponible en `#/acceso-estudiante`; sus entregas privadas requieren revisión manual y no son el flujo actual.

## Archivos aceptados

| Archivo | Reglas del servidor |
| --- | --- |
| Ilustración | PNG estándar de 8 bits o JPG; máximo 12 MiB; entre 320 y 4096 px por lado; máximo 8 megapíxeles |
| Animación | MP4 con una pista de video H.264 `avc1`; máximo 50 MiB; hasta 15 s, con 0,05 s de tolerancia de redondeo; entre 320 y 1920 px por lado; sin matriz de rotación |
| Proporción | Imagen y video coinciden con tolerancia relativa inferior a 1 % |

El servidor inspecciona firmas, estructura, dimensiones y CRC de PNG; segmentos y cierre de JPEG; cajas, códec, duración y dimensiones de MP4. No confía en extensiones, MIME ni dimensiones enviados por el formulario. No transcodifica ni decodifica todos los fotogramas. Los navegadores decodifican las imágenes en las vistas previas y al compilar. Un MP4 con metadatos manipulados no equivale a una certificación del flujo H.264 completo. Exporta material normal y comprueba su reproducción en la vista previa. Los MP4 admiten hasta 30 cajas principales y 2 MiB de metadatos `moov`; una exportación H.264 normal queda ampliamente por debajo.

Recomendación de exportación: imagen alrededor de 800–1200 px de ancho, video 640×800 o 720×900 si es vertical 4:5, H.264, píxeles cuadrados, `yuv420p`, sin rotación, 24/30 fps, inicio del video idéntico a la ilustración. No se necesita audio. No se modifica la proporción ni se recorta automáticamente.

## Compilar y publicar referencias MindAR

Este procedimiento es opcional para reorganizar o retirar obras desde el panel. **Crea tu obra** ya compila y publica cada pieza automáticamente, sin estos pasos.

1. Entra como organizador desde una computadora con WebGL y buena conexión.
2. Aprueba y activa las entregas que quieres mostrar.
3. Pulsa **Preparar publicación**.
4. Elige **Un solo escáner** para intentar todas las referencias juntas. Si el rendimiento medido en celulares es insuficiente, elige **Grupos de hasta 6**.
5. Pulsa **Compilar referencias**, espera el 100 % y mantén la ventana abierta. Con muchas imágenes puede tardar varios minutos.
6. Pulsa **Publicar esta colección**. El servidor verifica versión MindAR, número de referencias, dimensiones, orden de IDs y que las aprobaciones no cambiaron durante la compilación.
7. Prueba el escáner y las tres imágenes antes de distribuir el QR.

El `.mind` se compila mediante `Compiler.compileImageTargets()` y `exportData()` de MindAR 1.2.5. La lista ordenada de revisiones es la fuente tanto del archivo como del manifiesto. Cada índice se asocia a `addAnchor(index)` y a un único video. El archivo y el manifiesto se publican como una instantánea; una nueva entrega no modifica sus objetos.

El organizador debe recompilar **toda la selección** después de cambiar ilustraciones o de activar/desactivar obras. El botón de publicación no acepta que se cambie el orden manualmente. Una publicación de cero obras está deshabilitada para evitar vaciar accidentalmente la exposición.

El escáner principal combina en memoria las referencias públicas y reconoce todas las obras. Cada grupo conserva el orden original de sus referencias (`sourceIds`), de modo que reemplazar una pieza no desplaza la asociación de las otras con sus videos. La ruta avanzada `#/escaner` también permite seleccionar un grupo. El rendimiento con 40 o más referencias todavía necesita medición en teléfonos reales.

## Escáner y recursos

Al entrar aparece una sola indicación: «Apunta la cámara hacia la pieza», con **Entendido**. Al aceptarla se elimina del documento. No aparecen títulos, autores, estados ni instrucciones sobre la animación; se mantienen el logo, una X de cierre y un icono para cambiar de cámara. La repetición solo aparece como icono cuando termina el video. El cambio frontal/trasera reinicia el contexto de cámara, detiene las pistas anteriores y conserva la aceptación de Entendido.

- Cámara trasera cuando esté disponible; permisos solo al pulsar el inicio.
- Videos silenciados y `playsinline`. Se asigna una URL de video únicamente al reconocer su imagen.
- `maxTrack: 1`, un solo video reproduciéndose. Al perder el objetivo se pausa y al recuperarlo continúa. Hay repetición y botón de reproducción si el navegador bloquea el inicio.
- Planos de Three.js de ancho 1 y alto `imagen.height / imagen.width`, sobre la matriz del anclaje MindAR. Conservan posición y perspectiva con el objetivo visible. **Si el papel sale de vista, la animación se oculta**; no hay seguimiento espacial independiente del papel.
- Cerrar el escáner elimina su iframe y su contexto. Al salir de la página o mandar la aplicación al fondo se detienen pistas de cámara, videos, procesamiento, worker y WebGL. Al volver hay que reiniciar la cámara.
- Vista alternativa desde **La colección**, sin reconocimiento y sin cámara.

El adaptador de cámara de MindAR 1.2.5 se sustituye de forma acotada para conservar errores nativos de permisos y detener un stream que se conceda después del cierre. La biblioteca y ese comportamiento están fijados y cubiertos por las pruebas del proyecto.

## Cloudflare y GitHub: configuración pendiente

**No se creó infraestructura remota, no se contrató ningún servicio y no se activó un plan de pago.** No hay todavía una URL pública ni un repositorio remoto. La base y R2 usados en la demostración son simulaciones locales reales de Wrangler.

Para desplegar hacen falta tu acceso a Cloudflare, un proyecto Pages, una base D1, un bucket R2 privado y el secreto del organizador. Si la cuenta solicita habilitar facturación para R2, detente y revisa las condiciones antes de continuar. No es necesario activar Workers Paid para ejecutar los comandos de desarrollo.

Pasos en la raíz de este proyecto, cuando decidas conectar la cuenta:

```sh
pnpm exec wrangler login
pnpm exec wrangler d1 create galeria
```

Sustituye el `database_id` provisional de `wrangler.toml` por el UUID devuelto. Después:

```sh
pnpm exec wrangler r2 bucket create umbral-galeria-media
pnpm exec wrangler pages project create umbral-galeria --production-branch main
pnpm exec wrangler d1 migrations apply galeria --remote
pnpm exec wrangler d1 execute galeria --remote --file private/seed.sql
pnpm build
```

En Pages → proyecto → Settings → Variables and Secrets añade **ADMIN_CODE_SHA256** como secreto de producción. Su valor es el hash hexadecimal de `.dev.vars`, sin comillas, no el código legible de `private/organizador.txt`. Para otro código de administrador, genera primero un nuevo código aleatorio y su SHA-256 fuera del código fuente. No publiques `.dev.vars`.

Verifica los bindings **DB → galeria** y **MEDIA → umbral-galeria-media**, `nodejs_compat` y la fecha de compatibilidad de `wrangler.toml`. Mantén R2 privado, sin dominio público: la API controla el acceso a cada objeto. Los bindings también están declarados en el archivo Wrangler, que debe acompañar al proyecto.

```sh
pnpm exec wrangler pages deploy dist --project-name umbral-galeria
```

Este comando debe ejecutarse desde la raíz que contiene `functions/`; arrastrar únicamente `dist/` al panel **no instala las funciones del servidor**. Usa la URL HTTPS devuelta. Entra al panel, carga/aprueba las tres demos o las obras definitivas y compila/publica las referencias allí. La publicación local y los objetos locales no se copian automáticamente al desplegar.

Para cargar demos remotas, `scripts/seed-demo.mjs` admite `BASE_URL` con la URL HTTPS y usa los mismos accesos de `private/seed.sql`. Ejemplo PowerShell:

```powershell
$env:BASE_URL = 'https://TU-PROYECTO.pages.dev'
node scripts/seed-demo.mjs
Remove-Item Env:BASE_URL
```

Antes de publicar demos remotas, marca únicamente esas entregas como demostración:

```sh
pnpm exec wrangler d1 execute galeria --remote --command "UPDATE submissions SET demo=1 WHERE slot_id IN (1,2,3) AND name LIKE 'Estudio Umbral%';"
```

Apruébalas desde el panel de producción. Para una galería definitiva, desactiva las demos y recompila cuando lleguen las obras finales. Nunca ejecutes los scripts `test-flow`, `test-ui` o `approve-demo` contra producción.

Para GitHub: crea un repositorio **privado** nuevo, añade su URL como `origin` y sube el código ignorando `private/`, `.dev.vars`, `.wrangler/`, `output/` y `node_modules/`. Ya está incluido un workflow de compilación y pruebas. Puedes vincular ese repositorio a Pages; build `pnpm build`, salida `dist`, Node 24 y pnpm 11.25.0. Los archivos vendor necesarios ya están versionables, por lo que la compilación no consulta un CDN. La integración de GitHub Actions y el despliegue remoto no se han ejecutado.

### Presupuesto y prueba en infraestructura gratuita

No hay cobro por reconocimiento: el cómputo de cámara es del celular. El alojamiento, las funciones y el almacenamiento sí están sujetos a las cuotas de tu cuenta. No se puede garantizar gasto cero solamente por usar estos productos; revisa la cuenta y sus límites antes de habilitarlos. Las revisiones y publicaciones anteriores se conservan, por lo que R2 crece con cada reemplazo.

La validación inspecciona contenedores y evita descomprimir millones de píxeles en un Worker. **Falta medir CPU y memoria en Cloudflare Free con los tamaños máximos reales**, especialmente al subir archivos grandes o publicar 40 o más referencias. La simulación local no aplica todos los límites comerciales. Si se exceden, primero reduce tamaños y grupos y revisa la función; no actives un plan de pago automáticamente.

Fuentes oficiales consultadas el 15 de octubre de 2026:

- [Instalación MindAR y combinación Three.js 0.160.0 / MindAR 1.2.5](https://hiukim.github.io/mind-ar-js-doc/installation/).
- [Compilador MindAR](https://hiukim.github.io/mind-ar-js-doc/core-api/) y [código fuente de la versión fijada](https://github.com/hiukim/mind-ar-js/tree/v1.2.5/src/image-target).
- [Bindings Pages/D1/R2](https://developers.cloudflare.com/pages/functions/bindings/) y [configuración Wrangler de Pages](https://developers.cloudflare.com/pages/functions/wrangler-configuration/).
- [Límites Workers](https://developers.cloudflare.com/workers/platform/limits/), [cuotas/precios R2](https://developers.cloudflare.com/r2/pricing/) y [Pages Functions](https://developers.cloudflare.com/pages/functions/pricing/).

## Acceso de creación por enlace

La creación y publicación están disponibles para quien tenga la URL mientras las entregas estén abiertas. La sesión separa archivos de cada navegador, pero no identifica a una persona ni comprueba pertenencia al grupo. Comparte la dirección con los participantes; el organizador conserva el control de cierre y revisión. No hay verificación de correo ni cuenta. Si se borran las cookies o se cambia de navegador, la sesión anterior no se recupera automáticamente; el organizador puede gestionar la entrega desde su panel. La sesión del organizador es independiente de la sesión de creación.

## Branding

`src/config.ts` concentra nombre, descriptor, fecha, curso y colores. `src/theme.css` concentra tipografía, medidas y componentes. El logo y favicon oficiales están en `public/logo.svg` y `public/favicon.svg`. El logo aparece en la cabecera, pie y cámara. No usa tipografías ni imágenes remotas. Las ilustraciones son originales procedurales, temporales y marcadas DEMO. Regeneración opcional: Python con Pillow para `scripts/generate-demo.py`, después `node scripts/generate-videos.mjs`; una imagen regenerada exige volver a entregar, aprobar y compilar. No regeneres solo la imagen impresa mientras conservas referencias de una versión anterior.

## Pruebas reproducibles

```sh
pnpm test                    # contenedores, dimensiones, CRC, duración y proporciones
pnpm build                   # TypeScript del cliente y servidor + Vite
node scripts/test-flow.mjs    # requiere servidor local; usa espacios 21 y 22
node scripts/test-ui.mjs      # selección con checks, cámara mínima y cambio frontal/trasera; no publica
node scripts/test-creator.mjs # privacidad y asignación concurrente sin códigos; solo local
pnpm test:errors              # recuperación: red, imagen inválida, cámara denegada y galería vacía
pnpm test:publish             # publicación real de imagen 12 MiB y video 50 MiB + reconocimiento sintético
pnpm test:publish-api         # después del anterior: límites, privacidad, concurrencia e idempotencia
node scripts/generate-camera.mjs
node scripts/test-camera.mjs  # Chromium + cámara sintética; no usa cámara física
```

Para Chromium, instala el navegador de Playwright con `pnpm exec playwright install chromium` si no existe. `CHROME_PATH` permite especificar otro ejecutable Chromium. Las capturas e informes se guardan en `output/`, que no se despliega. Lee `VERIFICACION.md` para los resultados y las pruebas físicas pendientes. Estos scripts consumen revisiones de prueba: ejecútalos en una copia local de pruebas, no en las entregas de estudiantes.

Los scripts aceptan `BASE_URL` para apuntar a esa copia local. Herramientas verificadas el 16/10/2026: Vite 6.4.4 y Wrangler 4.151.1. La publicación completa del panel se rechaza si otra publicación cambió la galería durante el proceso; vuelve a prepararla con la selección actual.

Aplica todas las migraciones con `pnpm db:local` para el entorno local. La migración `0003_expand_spaces.sql` elimina el tope de 22 y prepara 40 espacios, conservando entregas, accesos y publicaciones. Después, la aplicación crea nuevos espacios conforme se necesiten. En Cloudflare usa `wrangler d1 migrations apply galeria --remote`.

## Estructura

```text
src/                 Interfaz, escáner, compilador y branding
server/              API, autenticación y validación de archivos
functions/api/       Entrada de Cloudflare Pages Functions
migrations/          Esquema D1
public/vendor/       MindAR y Three.js servidos desde el mismo sitio
public/demo/         Tres ilustraciones y hoja imprimible
demo/videos/         Tres MP4 de demostración, fuera del directorio público
scripts/             Instalación, demos y verificaciones
tests/               Pruebas de validación y fixtures
private/             Accesos locales: nunca publicar
.wrangler/state/     D1/R2 locales persistentes: nunca publicar
```

MindAR se incluye bajo MIT; licencia en `public/vendor/MINDAR-LICENSE.txt`. Se modificaron únicamente sus imports de Three.js para resolverlos con archivos locales y evitar un importmap inline. Three.js y las demás dependencias conservan sus licencias. FFmpeg solo se usa para generar materiales de prueba; no se incluye en la aplicación web desplegada.
