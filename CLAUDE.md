# Iberail — notas del proyecto

Web de **Iberail** (iberail.com): agencia española de rutas Interrail a medida, con Split / Ultra Europe
como parada estrella. Fundador: Bruno Tundidor. **Titular legal** (autónoma, IAE 755 agencias de viajes,
alta 25/09/2026): Andrea Tundidor San Juan, NIF 54214649S (aviso legal, privacidad, rutas.html, contrato). Idioma de la web y del trabajo: **español**.

Versión importada: `iberail-web-v6.4` (zip subido el 2026-09-26). **Fusionada con `iberail-web-v7.16`** (30/09/2026, hecha en otra
sesión: sorteo del Ultra). Si Bruno trae otra versión hecha fuera, fusionarla con git (base = el commit del que partió), no pisar.
**Importada `iberail-web-v9.1`** (07/10/2026, partía de 4803f14 = v8.8: sorteos sueltos, contratos por correo — fuera `contratos.js` y la firma en la web, también en Zarping —, «correo a un cliente» en el panel). **v9.2** (07/10/2026): sorteo discreto (ver `sorteo.js`), y `tools/demo/` para la versión de demo del panel. **v9.3** (07/10/2026): revisión de bugs de toda la web, panel y funciones (ver «v9.3» más abajo).
**Importada `iberail-web-v8.8`** (02/10/2026, partía de b01e727: página `sorteo.html` con cuenta atrás, `bases-sorteo.html`,
`condiciones-generales.html`, `fiesta.js`, `musica.js`, `cuenta-atras.js`, `sorteo-pagina.js`, pagos en pausa `PAGOS_PAUSA` en `payment.js`).

## Arquitectura

- **Web estática** (HTML + CSS + JS vanilla, sin framework ni bundler). Se sirve tal cual.
- **Hosting**: Netlify (lo indica `_redirects`: redirige iberail.es y www → iberail.com).
- **Backend**: Supabase (auth, base de datos, storage, realtime, edge functions).
  Configuración pública en `assets/config.js` (URL + clave *publishable*, que es pública por diseño;
  la seguridad depende de las políticas RLS de Supabase).
- `assets/config.js` y `assets/data.js` dicen «generado por build.py», pero **build.py no está en el zip**.
  Hasta tenerlo, se editan a mano.
- Supabase JS se carga desde jsDelivr solo en las páginas con cuenta (`cuenta`, `grupos`, `rutas`, `panel`).

## Marca

- Logo oficial en `assets/img/marca/` (los PNG originales). Recreado en vector: `assets/img/logo.svg` (fiel)
  e `icon.svg` (mismo dibujo con el símbolo más grande, para cabecera y favicon).
- Colores del logo: rojo `#C43730`, ámbar `#F0B02A`, crema `#F7F0E3`, casi negro `#1A1614`.
- Logotipo en texto: `<span class="brand-word">ibe<b>rail</b></span>` en Poppins 800 minúscula
  («rail» rojo sobre claro, ámbar sobre oscuro). Lema: «Tu Europa en tren, desde España».
- `logo.png`, `favicon.png`, `apple-touch-icon.png` y `og.jpg` se generan desde esos archivos.

## Páginas

| Página | Qué es |
|---|---|
| `index.html` | Portada |
| `paises.html` | Destinos (+30 países) |
| `split.html` | Split y Ultra Europe (vídeo `ultra.mp4`) |
| `rutas.html` | Planificador de rutas en 4 pasos → crea una fila en `rutas` |
| `contacto.html` | Contacto (WhatsApp 24 h) |
| `cuenta.html` | Registro/login con código por correo, mis rutas, grupos, avisos |
| `grupos.html` | «Mis grupos» (usa `cuenta.js` en modo `grupos`) |
| `panel.html` | Panel interno del equipo (acceso con `rpc('is_admin')`) |
| legales + `404.html` | Aviso legal, privacidad, cookies |

## JavaScript (`assets/`)

- `cola.js` (sala de espera simulada) **quitada el 08/10/2026** a petición del equipo (archivo y `<script>` borrados).
- `mantenimiento.js` — **web cerrada por mantenimiento** hasta `HASTA` (10/10/2026 13:30, hora de Madrid); después se abre sola
  (y recarga a quien la tenga abierta). En el `<head>` de todas las páginas públicas tras `config.js`; el panel no lo lleva.
  El equipo entra con `?equipo=1`. Para otra vez: cambiar `HASTA` (la hora del texto sale de ahí). Zarping no lo lleva.
- `app.js` — capa común `window.IB`: cliente Supabase, enlaces WhatsApp, sesión, utilidades.
- `site.js` — menú, animaciones, comportamiento común.
- `data.js` — ciudades, orígenes, trayectos de tren (`IB_DATA`).
- `map.js` / `gmap.js` — mapa SVG de Europa (Natural Earth vía jsDelivr) y mapa de ruta del grupo.
- `planner.js` — planificador (guarda borrador en localStorage `ib-draft-v2`).
- `cuenta.js` — cuenta del cliente. **Móvil obligatorio al registrarse** (`#rePhone`, `normPhone`: 9 cifras 6/7 o +prefijo;
  se guarda en `user_metadata.telefono`, sirve para WhatsApp y sorteos). Cuentas sin móvil: tarjeta «Añade tu móvil» en el
  panel del cliente hasta que lo guardan (`askPhone`). Sin verificación por SMS (cuesta dinero por mensaje).
- `panel.js` — panel del equipo: solicitudes en directo, clientes, grupos, documentos, pagos,
  comisiones/RRPP, bot de WhatsApp.
- `notif.js` — campana de notificaciones.
- **Fecha límite de pago por grupo** — el equipo la pone en la ficha del grupo del panel (`#grLim` + nota `#grLimTxt`,
  columnas `grupos.limite_pago` / `grupos.nota_pago`, `supabase/sql/limite-pago.sql`). Sale en pequeño en «Mis grupos»
  debajo de «Tu parte del viaje» (`.gx-lim`, ámbar a ≤7 días, rojo si ya pasó) y se apunta `limite_pago_visto` en
  `actividad` (una vez por sesión), para poder demostrar que lo vieron.
- `payment.js` — pago con tarjeta (Stripe Checkout): llama a `stripe-checkout` con la sesión y redirige a Stripe.
  Se activa con `STRIPE_ON: true` en `config.js`. Al volver (`grupos.html?pago=ok|cancelado`) muestra un aviso.
  «Pagar una parte» (mínimo 20 €). Enlace desde los correos: `grupos.html?pagar=ID` (`&parte=1` abre el pago parcial).
- `correos-panel.js` — pestaña «Correos» del panel: ver los correos automáticos y mandar campañas.
- `live.js` — (todas las páginas públicas, no el panel) presencia en tiempo real en el canal `iberail-en-directo`,
  una fila en `visitas` por página (sin identificar) y, con sesión, acciones en `actividad`. El equipo no cuenta.
- `live-panel.js` — pestaña «En directo» del panel: quién está ahora, últimas visitas, lo más visto hoy y
  actividad de clientes con filtro. SQL: `supabase/sql/actividad.sql` (borrado automático a 90 días).
  Recogido en la política de privacidad (apartados 2 y 3) y en la de cookies.
- `alojamientos.js` — alojamientos del grupo: tarjetas por ciudad + galería en «Mis grupos» (`[data-aloj]`)
  y editor con subida de fotos en el panel (`[data-aloj-admin]`). Se engancha solo con un MutationObserver.
  Tabla `alojamientos` + bucket privado `alojamientos/<grupo>/…` (`supabase/sql/alojamientos.sql`).
  **Las fechas de los alojamientos mandan** (`syncRoute`): se reescriben `paradas[].dias`, el orden, `fecha_salida`
  y `dias` de las rutas del grupo. Paradas sin alojamiento: solo se quedan si caben en un hueco de fechas.
  Se ejecuta al abrir el panel (todos los grupos), al abrir un grupo y al guardar/borrar un alojamiento.

- `contratos.js` — contratos de viaje firmados en la web. En el panel (`[data-contratos-admin]`, en cada grupo):
  «¿Qué incluye este grupo?» (casillas: vuelo ida / vuelta, maleta, pase, alojamientos, buses/ferris → cambia servicios
  incluidos y «No incluido»; al enviar pide confirmación con la lista) + «Más condiciones» (gastos de cancelación, pase, calendario de pagos, seguro de viaje opcional + precio; se guardan en el
  navegador). Partes: «IBERAIL» (sin registro de agencia ni garantía de insolvencia, por decisión de Bruno) y, por viajero, elegir **Mayor / Menor de edad** → Enviar (crea fila en `contratos` + aviso al viajero).
  En «Mis grupos» (`[data-contrato]`): «Leer y firmar» → datos + firma con el dedo (canvas). Si es menor firma el
  padre/madre/tutor y el contrato lleva la autorización. Si un «mayor» tiene <18 **al firmar**, no le deja (cuenta la edad al firmar, no la del viaje).
  **«Borrador PDF»** (por viajero, en el grupo del panel): contrato con lo que incluye el grupo, mayor/menor según el selector, huecos y casillas de firma en blanco para imprimir y firmar a mano.
  Firma con RPC `firmar_contrato` (solo el propio, solo pendiente). PDF = ventana de impresión. SQL: `supabase/sql/contratos.sql`.
  Teléfono del tutor obligatorio (≥9 cifras); en el panel sale con enlace a WhatsApp y botón «Copiar teléfonos
  de los padres». Pestaña «Contratos» del panel (`#conView`, `IBContratos.show()`): todos los contratos por grupo,
  filtros, PDF y teléfonos de tutores. Botón «Repetir» (grupo y pestaña): anula (queda guardado) y envía uno nuevo con aviso. `live.js` apunta `contrato_abierto`, `contrato_firmado`, `contrato_descargado`.
  Vista `contactos_tutores` (security_invoker) con todos los tutores que han firmado.

- `sorteo.js` / `sorteo-panel.js` (v7.16) — sorteo de 10 entradas para el Ultra Europe: barra arriba, apartado en la portada
  (`#sorteo`) y en «Mi cuenta»/«Mis grupos» (`[data-srt-me]`), «Participar gratis» → tabla `sorteo_inscritos` (`extra` = tiradas
  extra por story de Instagram, las suma el equipo en la pestaña «Sorteo» del panel), cartel 1080×1920 para stories.
  **Hace falta móvil para participar**: si la cuenta no lo tiene, sale «Falta tu móvil» (`askTel`) antes de apuntarse.
  **Quitar inscritos**: solo el equipo, botón «Quitar» en la pestaña Sorteo del panel (dos toques). Los participantes NO pueden
  salirse solos (decisión de Bruno). Necesita `supabase/sql/sorteo-baja.sql` (borrar solo con is_admin).
  **Revelación del premio** (`assets/ruleta.js`, `IBRuleta.show({premio, catalogo, restantes, …})`, CSS `.rul`):
  el sorteo se celebra fuera de la web; el equipo asigna en el panel qué le ha tocado a cada uno y publica.
  A partir de la hora, cada inscrito ve «Abrir mi premio» y una **cinta horizontal estilo caja** (flecha fija en el
  centro, 64 huecos, frena en 6,2 s con un pequeño descentrado) que para en su premio, con confeti si gana.
  En la cinta **solo salen premios que existen de verdad** (decisión consciente: nada de premios imposibles) más
  huecos «Sigue en el sorteo». Catálogo por defecto: 3 entradas Ultra, 300 €, 2×100 €, 3×50 €, 5 bonos de copas,
  5×25 €, 10×5 €. Arriba, contador en directo «quedan X de N entradas por salir» (RPC `sorteo_restantes`).
  Tablas `sorteo_config` (fecha, hora, entradas, total, publicado, acta, `premios` jsonb) y `sorteo_ganadores`
  (`premio`, `visto`); RLS: cada uno solo ve su propia fila y solo si está publicado, así que **nadie sabe qué le
  ha tocado a los demás**. RPC `sorteo_visto` marca que ya lo abrió. SQL: `supabase/sql/sorteo-ruleta.sql` +
  `supabase/sql/sorteo-premios.sql`.
  **Sonido**: se suben **desde el panel** (pestaña Sorteo → «Sonidos»: entrada del Ultra / cualquier premio / tic),
  van al bucket público `sorteo` y las URL se guardan en `sorteo_config.sonidos`. SQL: `supabase/sql/sorteo-sonidos.sql`.
  Si no hay subido ninguno, usa los archivos opcionales de `assets/snd/` — `premio.mp3` (cualquier premio), `ultra.mp3` (entrada del
  Ultra; si falta usa premio.mp3) y `tic.mp3` (cada premio que pasa por la flecha). Si no están, suena un tono
  sintetizado con WebAudio. Botón 🔊 arriba a la derecha; el silencio se recuerda (`ib-srt-mute`).
  **Panel** (pestaña Sorteo): fecha y hora, nº de entradas, acta, catálogo de premios con cantidades, un
  **desplegable por persona** para asignarle su premio, simulación de lo que verá (elige premio, no cuenta) y
  «Publicar resultado». La configuración del panel manda sobre la constante `DRAW`.
  **Aviso a pantalla completa** (`takeover` en `sorteo.js`, CSS `.srtk`): al entrar en cualquier página pública sale
  un modal oscuro con cuenta atrás al segundo, entrada dorada y «Participar gratis» (o «Ya estás dentro» si ya lo está).
  Solo en los 3 días previos al sorteo y una vez al día por visitante (`ib-srt-tk-<fecha>-<día>` en localStorage).
  **Fecha del próximo sorteo**: constante `DRAW = { fecha, entradas }` arriba de `sorteo.js` (vacía = «muy pronto»).
  Rellena `[data-srt-when]` y `[data-srt-tag]` de la portada, la barra de arriba y la tarjeta de la cuenta
  («Sorteamos mañana las 3 primeras entradas»). Pasada la fecha deja de salir solo.
  SQL `12-sorteo.sql` no está en el repo.
- `seguro.js` — «Iberail Protect» (seguro de viaje con marca propia; la aseguradora solo en letra pequeña si se
  rellena). **Se paga aparte del viaje**: no toca `grupo_miembros.importe` ni `pagos`. «Mis grupos» (`[data-seguro]`):
  tarjeta con coberturas y «Contratar y pagar» → `IBPay.start(btn, gid, null, { seguro: true })` → stripe-checkout
  (`pagarSeguro`, precio de `seguro_ofertas`) → webhook (metadata `tipo: 'seguro'`) apunta en `seguros` estado `pagado`.
  Vuelta: `grupos.html?seguro=ok|cancelado`. Panel (`[data-seguro-admin]`): oferta (plan, cancelación, precio, límite,
  aseguradora); por viajero: Marcar pagado (Bizum) / nº póliza → Contratado / Anular. Coberturas en `PLANES`
  (Totaltravel / mini de InterMundial; aseguradora Sompo). SQL: `supabase/sql/seguros.sql`. `live.js`: `seguro_pedido`.

## Diseño v11 «andén» (10/10/2026)

- Rediseño de la web pública de Iberail (mismo logo). Pedido: «distinto, futurista, que no parezca hecho con IA». La v10 (todo
  cuadrado, letras anchas en mayúsculas) no gustó por **demasiado cuadrada**: la v11 mantiene los colores y la idea de estación
  (hormigón claro con rejilla, bloques negros, ámbar `#FFB81C`, rojo `#EF4130`) pero **redondeada** (tarjetas 22 px, bloques 30 px,
  botones 14 px, cabecera y pie con esquinas grandes) y con títulos en minúscula.
- **Letras alojadas en la web** (`assets/fonts/`, OFL, sacadas de Fontsource en npm): **Funnel Display** (títulos), **Funnel Sans**
  (texto y etiquetas), **Doto** (solo paneles LED: salidas, reloj, cuentas atrás) y Poppins 800 (logotipo). Las páginas públicas
  ya **no cargan Google Fonts** (el panel sí); privacidad y cookies lo dicen (en Zarping, `rebrand()` deja el texto de Google Fonts).
- Capa aparte: `assets/tema.css` (después de `site.css`) + `assets/tema.js`, en todas las páginas públicas de Iberail.
  **El panel y Zarping no lo cargan.** Volver atrás = quitar `tema.*`, las precargas de fuentes y restaurar la portada desde git.
- Portada (orden nuevo): cabecera negra con reloj de Madrid, «Europa en tren, *a tu manera.*» (subrayado en forma de vía) y
  **panel de salidas de ejemplo** (`[data-board]`, destinos y trenes reales, horas de ejemplo, letras que giran, se inclina con el
  ratón) → cifras en una barra blanca que monta sobre la cabecera (`.dock`) → cintas cruzadas → Cómo funciona (paradas unidas por
  una vía) → Destinos en **mosaico** (Split grande con el vídeo del Ultra, que solo se carga al verse: `video[data-src]`) →
  Split (foto a la derecha) → sorteo → «Sales desde tu ciudad» → temporada → contacto. Secciones con «Vía 01…05» (`data-via`).
- Interiores: cabecera negra con esquinas redondeadas abajo y una curva de vía en la esquina.
- `.cta` lo usan dos cosas (bloque rojo de la portada y la cuenta atrás de `sorteo.html`): en `tema.css` el de la portada va
  como `.container > .cta`.

## v12 (10/10/2026): contraste, láminas de color y funciones nuevas

- Pedido: «hay letras que no se leen», «funciones guays» y «que no parezca la misma web». Contraste revisado con un análisis
  automático (Playwright, todas las páginas, móvil y ordenador, con y sin sesión): todo ≥ 4,5:1 (≥ 3:1 en letra grande).
  Rojo pasa a `#D7301E` (texto blanco 4,85:1) y el rojo de texto a `#B42818`. En el panel de salidas solo las horas y la vía
  van en LED (Doto); destinos, trenes y estados en Funnel Sans, que se lee mejor.
- **Cabecera flotante** (cápsula con margen): se esconde al bajar y vuelve al subir (`html.tx-hdr-off`), con un **trenecito**
  que marca lo leído. Cabeceras negras y la portada empiezan por detrás (`margin-top:-74px`).
- **Portada en láminas** a todo el ancho que se montan unas sobre otras (`.sheet--amber/--light/--dark/--red`): Cómo funciona →
  **test** (ámbar) → Destinos (mosaico) → Split + sorteo (negra) → Salidas → Temporada (roja, cuenta atrás LED) → contacto (negra, unida al pie).
- ~~Buscador «¿A dónde quieres ir?»~~ (sustituido en la v12.4 por «Toca las ciudades que te apetecen»). La portada carga `data.js`.
- **Test «¿Qué Interrail va contigo?»** (4 preguntas, `[data-quiz]` en `tema.js`): el resultado es una de las rutas hechas del
  planificador (`IB_DATA.presets`: fiesta, ultra, clásica), con «Abrir esta ruta» → `rutas.html?preset=<id>` (nuevo en `planner.js`)
  y «Compartir» (menú del móvil o copia el enlace).
- **Destinos**: botón «Tarjetas / Tablero» (vista de panel de salidas; se recuerda en `ib-vista-destinos`).
- **Split**: la foto del Ultra ocupa toda la cabecera. Títulos que aparecen desde abajo; botones principales que siguen un poco al ratón.

## v12.2 (10/10/2026): móvil y portada más unida

- **iPhone**: con sesión (campana + cuenta + menú) la cabecera no cabía y Safari alejaba la vista: la página «bailaba» de
  lado a lado con una franja blanca. Ahora `html,body{overflow-x:clip}`, cabecera compacta en móvil y el logo de Zarping se
  oculta por debajo de 400 px si sale la campana. Comprobado sin desbordes de 320 a 414 px, con y sin sesión (`anchos.mjs` en
  las pruebas). Menú del móvil más compacto (se ve entero).
- **Portada menos «partida»** (pedido de marketing: «faltan cosas y sobran cosas»): fuera el «Mejor precio garantizado», el
  botón «Ver destinos» de la cabecera, la segunda cinta, el bloque «Sales desde tu ciudad», el bloque de Split repetido y el
  «¿Hablamos de tu ruta?» (la temporada ya lleva los botones). Nuevo: **preguntas frecuentes** en la portada (las mismas de
  Contacto). Orden: cabecera → cifras → cinta → Cómo funciona → test (ámbar) → Destinos (con Split en grande y su vídeo) →
  sorteo (tarjeta, sin lámina propia) → Dudas → Temporada (roja) → pie montado encima.
- **Pie**: la firma de Bruno es una línea discreta (avatar pequeño · «Bruno Tundidor» · «Founder»), sin tarjeta. Se pidió quitar
  «CEO»: pone solo **Founder** (también en el `aria-label` y en el `jobTitle` de los datos estructurados). El bot de WhatsApp
  (`CONOCIMIENTO`) todavía dice «Fundador y CEO».

## v12.4 (10/10/2026): «Toca las ciudades que te apetecen»

- El buscador «¿A dónde quieres ir?» confundía (campo vacío). Ahora, en la cabecera de la portada (`[data-hx-pick]` en `tema.js`):
  **8 ciudades para tocar** (Ámsterdam, Berlín, Praga, Budapest, Viena, Split, París, Roma) + «+ Otra ciudad» (todas las de
  `IB_DATA.cities`). El orden en que las tocas es el de la ruta (número en cada una; máx. 8).
- Debajo se dibuja **tu ruta** con las **horas de tren** entre paradas: mismos datos que el planificador (`IB_DATA.rail`; si no hay
  tramo conocido, estimación por distancia marcada con «≈»; el primer tramo desde España, en avión). Total de horas y aviso del
  Ultra si va Split. Las 3 primeras paradas salen arriba del **panel de salidas** como «Tu ruta».
- **Sorpréndeme**: carga una de las rutas hechas del planificador (`IB_DATA.presets`) parada a parada.
- **Sales desde** (las 8 ciudades de salida; se recuerda en `ib-hx-desde`, recogido en la política de cookies).
- «Diseñar esta ruta» → `rutas.html?desde=<ciudad>&ruta=A,B,C` (nuevo en `planner.js`: solo ciudades conocidas, 3 días por
  parada si son ≤4, si no 2; Split con los días del Ultra).

## Sorteo discreto (v9.2) y panel de demo

- **Sorteo «menos canteo»** (lo pidió marketing): fuera el aviso a pantalla completa; la barra de arriba solo sale la semana
  del sorteo (`BAR_DIAS`) o cuando ya puedes ver tu resultado; la ruleta ya no se abre sola fuera de `sorteo.html`.
  Cinta con un solo frenado de ~6 s, sin parón de tensión, sin música de fondo y **sin colocar el Ultra al lado a propósito
  cuando no toca** (las piezas de alrededor salen al azar); celebración corta (confeti, sin fuegos ni destellos). Debajo de la
  cinta: «Los ganadores se eligen al azar antes de esta hora; aquí solo ves tu resultado» (lo mismo que dicen las bases, punto 5).
  Textos: «participaciones» en vez de «tiradas», «Ver mi resultado» en vez de «Abrir mi premio». `ruleta.js` y `fiesta.js`
  solo se cargan en `sorteo.html` y en el panel; en el resto los descarga `sorteo.js` cuando hace falta. La música de la cuenta
  atrás solo suena si se pulsa «Activar sonido».
- **Un solo cliente de Supabase por página**: `IB.ensureSb()` en `app.js` (antes `sorteo.js` y `live.js` podían crear dos).
- **Panel de demo** (`tools/demo/`): `python3 tools/demo/build.py <carpeta> [versión]` crea el zip normal y el `-demo`, cuyo
  `panel.html` funciona sin Supabase con `supabase-demo.js` (Supabase en memoria) y `datos-demo.js` (datos inventados con semilla
  fija: 2.190 clientes, 74 grupos, 260.180 € pendientes, solicitudes, WhatsApp, avisos, «En directo» que se mueve…). Lleva la
  etiqueta «Demo · datos de ejemplo» y **no se activa en iberail.com / zarping.com**. Es solo para presentar: no subirlo a Netlify.
  También sirve para probar la web en un navegador sin tocar la base de datos real (ver cómo se usa en las pruebas con Playwright).

## v9.3 (revisión completa)

- Panel: Grupos con filtros «Con pagos pendientes / Todo cobrado», orden «Lo que más deben» y buscador; Clientes con gráfica
  de altas por semana y «Exportar CSV»; atajo «/» al buscador; dinero en céntimos (`r2`); pagos en directo; mensajes con la
  marca del grupo (`IB.marcaGrupo`); borradores que no se pierden al repintar (Sorteo y seguro).
- Sorteo: «Añadir al calendario» (.ics) en sorteo.html; si se abre después de la hora, espera al resultado; la música se apaga
  tras el drop final (la cinta no lleva música).
- `correos`: acciones `manual`, `manual_pendientes`, `manual_plantilla` y `ejemplo` tipo `manual` («Correo a un cliente» de la
  v9.1; los textos preparados por persona aún no se guardan). Ruta recibida / presupuesto van al correo de la cuenta.
- `stripe-checkout`: las sesiones caducan a los 30 min. `stripe-webhook`: avisa en `actividad` de `pago_de_mas` y
  `seguro_duplicado` (salen en «En directo») y no pisa un seguro ya pagado.
- `whatsapp`: **el webhook exige `WA_APP_SECRET` (Meta) o `WA_WEBHOOK_KEY` (360dialog/Dualhook); sin ninguno responde 503.**
  Firma comparada en tiempo constante. Prompt fijo cacheado + bloque aparte con fecha/nombre; `max_tokens` 4000 con
  `effort: low`; si se corta o se niega, avisa al equipo.
- 404.html con `<base href="/">`. Planificador: combinaciones del Ultra solo hasta 7 paradas (con 9 bloqueaba 2 s por clic).

## Supabase

Tablas: `rutas`, `rutas_notas`, `grupos`, `grupo_miembros`, `documentos`, `avisos`, `avisos_leidos`,
`pagos`, `comisiones`, `referidos`, `rrpp_codigos`, `wa_config`, `wa_chats`, `wa_mensajes`.
RPC: `is_admin`, `buscar_clientes`, `pagos_grupo`, `companeros_grupo`, `mi_invita`,
`registrar_referido`, `rrpp_reglas`, `delete_my_account`.
Storage: bucket `documentos`. Edge functions: `whatsapp`, `stripe-checkout`, `stripe-webhook`, `correos`.
Tablas nuevas: `correos_enviados`, `bajas_publicidad`, `alojamientos`, `visitas`, `actividad`, `contratos` (RPC `firmar_contrato`), `seguro_ofertas`, `seguros` (RPC `anular_seguro`); columna `pagos.stripe_session`; bucket `alojamientos`.
El esquema SQL / políticas RLS **no están en el repo**.

### Pagos con Stripe (Checkout alojado por Stripe)

- `supabase/functions/stripe-checkout`: comprueba la sesión, **recalcula lo que falta** (`grupo_miembros.importe`
  − suma de `pagos`) y crea la sesión de Checkout. Nunca se fía del importe del navegador.
- `supabase/functions/stripe-webhook`: verifica la firma de Stripe y apunta el pago en `pagos`
  (una vez por sesión: columna `stripe_session` única, ver `supabase/sql/stripe.sql`).
- Secretos: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SITE_URL` (opcional, por defecto https://iberail.com).
- Ambas se despliegan con `--no-verify-jwt`.

### Correos (`supabase/functions/correos` + Resend)

- Plantilla HTML con la estética de la web (granate, coral, ámbar, billete). Remitente `CORREOS_FROM`.
- Seguimiento (a todos): ruta recibida, presupuesto listo, bienvenida al grupo, precio con botón de pago,
  pago recibido; y con el cron diario: cuenta atrás (30/7/1 días) y recordatorio de pago los lunes.
  Los disparan triggers de `supabase/sql/correos.sql` (pg_net) con la cabecera `x-iberail-key` = `CORREOS_KEY`.
- Publicidad: campañas desde el panel solo a `rutas.acepta_publicidad = true` menos `bajas_publicidad`.
  Cada correo lleva enlace de baja firmado (HMAC) y cabecera List-Unsubscribe.
- Nunca se repite un correo automático: tabla `correos_enviados` (clave única).
- Secretos: `RESEND_API_KEY`, `CORREOS_KEY`, `CORREOS_FROM`, `CORREOS_REPLY_TO` (opcionales los dos últimos).

### Edge function `whatsapp` (`supabase/functions/whatsapp/index.ts`)

Asistente de WhatsApp con IA (API de Anthropic, modelo en `AI_MODEL`, por defecto `claude-sonnet-5`).
- Recibe el webhook de Meta (o Dualhook / 360dialog según `WA_PROVIDER`), guarda en `wa_chats` / `wa_mensajes`
  y responde. Herramientas: `consultar_mi_viaje`, `crear_solicitud`, `avisar_equipo`, `pasar_a_humano`.
- Si el equipo contesta desde el móvil (eco), el bot se aparta de ese chat `horas_pausa` horas.
- Acciones del panel (`enviar`, `aviso`, `probar`) solo para el equipo: comprueba la tabla `admins`.
- Usa además: tabla `admins`, RPC `wa_cliente`, `wa_crear_solicitud`, `wa_destinatarios`.
- El texto `CONOCIMIENTO` lo genera `tools/build_conocimiento.py` (no está en el repo): si cambia la web,
  hay que regenerarlo. Es también la mejor descripción de cómo funciona la web para el cliente.
- Secretos: `WA_TOKEN`, `WA_PHONE_ID`, `WA_APP_SECRET`, `WA_VERIFY_TOKEN`, `WA_WEBHOOK_KEY`,
  `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`.
- Desplegar: `supabase functions deploy whatsapp --no-verify-jwt`.

## Zarping (segunda web, misma titular) — carpeta `zarping/`

- **Qué es**: agencia hermana que vende **todo menos Interrail** (nieve, fin de curso, despedidas, festivales, escapadas,
  a medida). zarping.com / zarping.es. Misma titular y mismo backend (Supabase) que Iberail; el panel es el de iberail.com.
- **Se genera**: `python3 tools/zarping/build.py` → escribe `zarping/*.html`, copia el JS común de `assets/`
  (`app, site, notif, live, payment, cuenta, alojamientos, contratos, seguro`) y `site.css` recoloreado, y crea
  `config.js` (mismas claves + `MARCA: "zarping"`), `_redirects`, `robots.txt`, `sitemap.xml`.
  **Si cambias un JS común o `site.css` de Iberail, vuelve a ejecutar el build.** Fuentes: `tools/zarping/pages/*.html`
  (solo el `<main>`), cabecera/pie en `build.py`. Propios de Zarping (no se copian): `zarping/assets/zarping.css`,
  `zp-viaje.js`, `img/`. Cuenta, grupos y legales salen de las de Iberail con `rebrand()`.
- **Estética propia** (`zarping/assets/zarping.css`, por encima de `site.css`): estilo «cartel» — bordes de tinta de 2 px,
  sombras duras (`--hard`), pegatinas en lugar de la rayita de los títulos, cabecera negra, pie lima, portada con un chat de
  grupo (rota ejemplos) y cinta de tipos de viaje. Menú completo desde 1100 px (1260 px con sesión).
  «zarping by iberail» junto al logo (cabecera y pie) y «de los creadores de iberail» en la portada.
- **Portada**: buscador (→ `destinos.html?q=`), atajos (destinos, festivales, precio, pagar, firmar, WhatsApp) y carrusel de
  destinos destacados (`DESTACADOS` en `build.py`, datos de `destinos.json`), «Viajes listos» (`VIAJES` en `build.py`, también
  arriba en «Viajes», sin precios: «Lo quiero» → Monta tu viaje) y banda de festivales top (`FEST_TOP`, se ocultan los pasados). **Móvil**: barra de pestañas fija
  (Destinos, Festivales, Monta tu viaje, Mis grupos, WhatsApp), salvo en el formulario; en Destinos, 3 planes por tarjeta + «+N planes más».
- **Marca en el JS común**: `IB.BRANDS` / `IB.brand` / `IB.brandOf(marca)` en `app.js` (nombre, web, correo, «Protect»,
  pase, textos). Iberail sigue igual por defecto (sin `MARCA` en config). Contratos: la marca sale de `grupos.marca`
  (en `condiciones.marca` al enviarlo). `live.js` antepone «Zarping · » a la página en «En directo».
- **Festivales** (`festivales.html`): se genera desde `tools/zarping/festivales.json` (fechas oficiales, revisado el
  30/09/2026; 46 de España + los grandes de Europa y del mundo; nada de festivales raros o lejanos). Buscador + filtros de zona y estilo; `?q=` precarga.
  Tira de nombres de festivales estilo «logos» (`FEST_LOGOS` en `build.py`, texto, no logos oficiales) en portada y festivales. **Todas las de 2027 van con `confirmado: false`** (fechas previstas, sin anuncio oficial
  verificado: las webs oficiales no se pueden abrir desde el entorno de Claude). Al confirmarse, corregir y quitar el campo.
  Días de destinos y viajes listos ajustados a lo realista desde España (larga distancia ≥ 7-10 días). Los que ya han terminado se ocultan solos; filtro España / Europa / Resto del mundo. «Ir con Zarping» abre
  «Monta tu viaje» con `?tipo=festival&dest=…`. Para añadir o cambiar festivales: editar el JSON y volver a ejecutar el build.
  Ultra Europe (Split) no sale: es de Iberail.
- **Destinos** (`destinos.html`): 132 destinos (España, Europa, resto del mundo) con actividades, época y días, desde
  `tools/zarping/destinos.json`. Buscador + filtros por zona y tipo (playa, islas, ciudad…); `?q=` precarga la búsqueda.
  «Pedir precio» → `monta-tu-viaje.html?tipo=escapada|nieve&dest=…`. Para añadir destinos: editar el JSON y volver a ejecutar el build.
- **Monta tu viaje** (`zp-viaje.js`): 3 pasos → fila en `rutas` con `ref` ZP-XXXXXX, `marca: 'zarping'`, destino en
  `paradas[0]`, tipo e «incluir» en `estilo`, resto en `notas`. Pide cuenta para enviar. Borrador `zp-draft-v1` (30 días).
  Casi sin escribir: botones de destino según el tipo (`SUGIERE`, + «Aconsejadnos»), ciudad de salida, próximos 8 meses (`S.mes`,
  vale como fecha aproximada → «Mes:» en notas), atajos de días/personas y «¿Qué os apetece?» (`S.gustos` → notas).
  Netlify Forms «viaje» de respaldo.
- **Base de datos**: `supabase/sql/marca.sql` (columna `marca` en `rutas` y `grupos`; amplía límites de días/personas).
  Sin ejecutarlo, las solicitudes se guardan igual y el panel las reconoce por la ref ZP-.
- **Panel**: filtro «Iberail / Zarping» en solicitudes, etiqueta Zarping, marca al crear grupo y en la ficha del grupo;
  rutas creadas por el equipo heredan la marca. Correos: selector de marca (plantilla, remitente y audiencia).
- **Stripe** (`stripe-checkout`): con `grupos.marca = 'zarping'` el pago/seguro sale como Zarping y vuelve a zarping.com
  (`ZARPING_URL` opcional). **Correos**: plantilla Zarping (tinta/lima/violeta) para solicitudes ZP- y grupos Zarping;
  remitente `CORREOS_FROM_ZARPING` (por defecto «Zarping <misma dirección que CORREOS_FROM>»), `CORREOS_REPLY_TO_ZARPING`.
- **Logos** (`zarping-marca/`): símbolo, icono, logo horizontal/vertical, «by iberail», palabra y redes, en SVG (texto en
  trazos) y PNG transparente (1x y @3x). Se generan con `tools/zarping/logos.py <carpeta con Unbounded/Manrope/Poppins .ttf>`
  y `node tools/zarping/logos_png.mjs`. No es parte de la web (no se sube a Netlify).
- **Zarping en Iberail**: solo el logo pequeño [zarping ↗] junto al de Iberail en la cabecera de todas las páginas (menos el panel;
  `.brand-zp`, `assets/img/zarping-negro.svg`; oculto entre 1101 y 1240 px y por debajo de 380 px, donde no cabe).
  Cabecera de Iberail: hamburguesa por debajo de 1100 px (antes se salía entre 880 y 1100). Bruno no quiere franjas ni textos («nada de cosas npc»). Zarping v2.4 = esta versión.
- **Pendiente**: bot de WhatsApp solo conoce Iberail; los correos de Supabase Auth (código de acceso) dicen Iberail;
  crear el buzón info@zarping.com (sale en contratos y en la web) y verificar zarping.com en Resend.

## Pendientes detectados

- Falta `build.py` y el esquema de Supabase para tener el proyecto completo.
- `sitemap.xml` sin `lastmod`.
- Tiempo de respuesta incoherente: la barra superior, portada y contacto dicen «máx. 30 min»; el aviso emergente
  (`site.js`, `BUSY`: clientes 1 h / nuevos 3 h) y el planificador dicen «hasta 3 h»; el bot «hasta 1 hora».

## Otros proyectos de Bruno (guardados para más adelante)

- ⭐ **NUEVO (29/09/2026): segunda agencia de viajes** con la misma titular (Andrea, IAE 755: mismo alta, REAV,
  registro y garantía; solo nombre comercial nuevo + marca OEPM + póliza RC que la incluya). Vende **todo menos Interrail**
  (exclusivo de Iberail): nieve, fin de curso, despedidas, festivales, escapadas, viajes a medida. **Nombre: ZARPING** (zarpar + -ing, como Vueling;
  **zarping.com y zarping.es comprados el 30/09/2026**). Lema: «Tú pones el grupo. Nosotros, todo lo demás.» (antes «Suelta amarras», descartado por Bruno) Pendiente: marca en la OEPM (clase 39) y @zarping en redes. Marca: tinta #0E0E12, lima #D4FF3A, violeta #7B5CFF,
  rosa #FF6BB5; Unbounded + Manrope; símbolo = arco de «salto» punteado. Web hecha en `zarping/` (ver sección «Zarping»).
- (descartado 29/09 por saturado) **«Energía en casa todo en uno»** — nombre propuesto Solneda (solneda.es/.com libres) — = placas + baterías + aerotermia + clima + ventanas +
  cargadores + certificados + subvenciones. Modelo: captar y gestionar; la instalación la hacen instaladores subcontratados.

- **Autoescuela en Madrid** (guardada el 29/09/2026). Idea: autoescuela más barata y rápida, con el teórico online
  con IA (tests, profe virtual por WhatsApp 24 h) y prácticas reservadas por app. Requisitos: autorización de la DGT
  (Jefatura Provincial de Tráfico), local, coches de doble mando, profesores con título de formación vial y director.
- **Placas solares y cargadores de coche eléctrico** (guardada el 29/09/2026). Idea: captar clientes y gestionarlo
  todo (presupuesto, subvenciones, papeles), subcontratando la instalación a instaladores; 500-2.000 € de comisión por venta.
- **Baterías y aerotermia en casas** (guardada el 29/09/2026). Continuación de las placas: baterías, aerotermia y
  ventanas eficientes, con subvenciones y el mismo modelo de comisión (captar, gestionar y subcontratar).
- Le gustó también: **clases particulares por barrios** (plataforma que conecta universitarios con familias, comisión 20-25 %).
