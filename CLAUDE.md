# Iberail — notas del proyecto

Web de **Iberail** (iberail.com): agencia española de rutas Interrail a medida, con Split / Ultra Europe
como parada estrella. Fundador: Bruno Tundidor. **Titular legal** (autónoma, IAE 755 agencias de viajes,
alta 25/09/2026): Andrea Tundidor San Juan, NIF 54214649S (aviso legal, privacidad, rutas.html, contrato). Idioma de la web y del trabajo: **español**.

Versión importada: `iberail-web-v6.4` (zip subido el 2026-09-26). **Fusionada con `iberail-web-v7.16`** (30/09/2026, hecha en otra
sesión: sorteo del Ultra). Si Bruno trae otra versión hecha fuera, fusionarla con git (base = el commit del que partió), no pisar.
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

- `cola.js` — **sala de espera simulada al entrar** (proyecto de la FP; la web aún no está publicada). En el `<head>` de todas las
  páginas públicas (no el panel), justo después de `config.js`. Entre 15 y 55 personas delante y de 45 s a 4 min de espera,
  tren que avanza, «¡Es tu turno!» → entra solo a los 6 s o con el botón. Una vez por visita (`sessionStorage` `ib-cola-ok`;
  recargar durante la cola la reinicia). **Modo demo** `?cola=demo`: 30–55 personas y 2–4 min, sale siempre. No sale a buscadores ni vistas previas de enlaces, ni en Zarping.
  **Quitarla cuando lo diga Bruno**: `COLA_ON = false` arriba del archivo (o borrar el archivo y las líneas `<script src="assets/cola.js">`).
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
  **Si no toca, no hay «casi» forzados** (decisión de Bruno): para cerca del centro de la pieza, nunca al borde, y sin
  ninguna entrada del Ultra a ±6 huecos del resultado (`construir` en `ruleta.js`).
  En la cinta **solo salen premios que existen de verdad** (decisión consciente: nada de premios imposibles) más
  huecos «Sigue en el sorteo». Catálogo por defecto: 3 entradas Ultra, 300 €, 2×100 €, 3×50 €, 5 bonos de copas,
  5×25 €, 10×5 €. Arriba, contador en directo «quedan X de N entradas por salir» (RPC `sorteo_restantes`).
  Tablas `sorteo_config` (fecha, hora, entradas, total, publicado, acta, `premios` jsonb) y `sorteo_ganadores`
  (`premio`, `visto`); RLS: cada uno solo ve su propia fila y solo si está publicado, así que **nadie sabe qué le
  ha tocado a los demás**. RPC `sorteo_visto` marca que ya lo abrió.
  **Tiradas nuevas después del sorteo**: se cuenta cuántas ha abierto cada uno (`ib-srt-tir-<fecha>-<uid>` en localStorage = `{u, p}`,
  lo apunta `onTirada` de la ruleta). Si el equipo le suma tiradas después (+1 en el panel), sale «Abrir tu tirada nueva» y la
  cinta empieza en esa (`desde`). El premio sale **una sola vez**: si ya lo vio, las nuevas son «Sigue en el sorteo», salvo que
  el equipo le ponga el premio en una tirada nueva (`sorteo_ganadores.tirada`). La web vuelve a mirar las tiradas cada 2 min.
  Si lo abrió en otro dispositivo (`visto`) o con la versión antigua (`ib-srt-visto-<fecha>`), cuentan como abiertas las que tenía. SQL: `supabase/sql/sorteo-ruleta.sql` +
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
  En iPhone (WebKit) los rayos animados tapaban el texto del aviso: `.srtk-in`/`.srtk-art` van en su propia capa (z-index + translateZ).
  **Llegar a la cuenta atrás** (`sorteo.html`): reloj en directo en la barra de arriba (`.srtbar-cd`, botón «Cuenta atrás») y en
  «Sorteo 🎟️» del menú del móvil (`.mm-srt-cd`) y botón flotante abajo en el centro (`.srt-fl`, sube sobre la `.mbar` en móvil),
  de 3 días antes a 12 h después (`reloj()` en `sorteo.js`; en ese tiempo la barra no tiene ✕); el «Nuevo» de la
  portada y «Ver la cuenta atrás» del apartado `#sorteo` llevan a `sorteo.html`; enlace corto `iberail.com/cuenta-atras` (`_redirects`).
  **Fecha del próximo sorteo**: constante `DRAW = { fecha, entradas }` arriba de `sorteo.js` (vacía = «muy pronto»).
  Rellena `[data-srt-when]` y `[data-srt-tag]` de la portada, la barra de arriba y la tarjeta de la cuenta
  («Sorteamos mañana las 3 primeras entradas»). Pasada la fecha deja de salir solo.
  **Sorteo 2** (02/10/2026): esta noche a las 00:00 (`DRAW` = 2026-10-03 00:00, tanda 2, 3 entradas). Textos según la tanda
  (`ord()`, `cuandoTxt()`: 00:00 = «esta noche a las 12»; `quedanAntes()` = total − entradas × tandas anteriores); en el aviso,
  las entradas ya sorteadas salen en verde (`.is-gone`) y `DRAW.novedad` («Nuevos premios: Paysafecard…»).
  Una configuración del panel de una tanda **anterior** a `DRAW.tanda` no pisa la web (salvo los sonidos), y un premio de
  `sorteo_ganadores` con `tanda` anterior no cuenta.
  **Panel → «Preparar el sorteo N»** (`nextHtml` / `nuevaTanda` en `sorteo-panel.js`): descarga `sorteo-<t>-premios.csv`
  (copia también en localStorage `ib-srt-copia-sorteo-<t>`), borra `sorteo_ganadores`, pone tanda+1, fecha, hora, entradas,
  sin publicar y sin acta, y añade las Paysafecard. Inscripciones, tiradas extra y sonidos se quedan.
  **Paysafecard** (desde el sorteo 2): `psc75` ×1, `psc50` ×2, `psc25` ×3, `psc10` ×5 (icono 💳). El catálogo del panel enseña
  también los premios conocidos que no están (con 0) para poder añadirlos. Bases: segunda tanda + Paysafecard en los apartados 4 y 6.
  **Repetir la tirada ganadora** (para grabar la pantalla): botón «🎬 Repetir mi tirada ganadora del sorteo N» (`.srt-repe`) en
  «Mi cuenta»/«Mis grupos» y en `sorteo.html`, solo para quien ganó algo en un sorteo anterior. Vuelve a abrir la cinta en esa
  tirada con el mismo premio y la etiqueta «Repetición · sorteo N»; no apunta nada. Los datos salen del navegador del ganador
  (`ib-srt-hist-<uid>` = `{fecha: {tanda, premio, tirada, tiradas, catalogo}}`; se rellena al abrir el premio, de
  `ib-srt-tir-…`/`ib-srt-visto-…` y de su fila de `sorteo_ganadores` mientras exista). `PASADOS` = fecha → nº de sorteo.
  Si abrió el premio en otro dispositivo y ya se han borrado los premios, en ese dispositivo no sale.
  **Paysafecard al ganar** (`esPsc`/`epico` en `ruleta.js`): suena la **canción del Ultra** (`cancionGanar(true)`, golpe 'ultra') y la
  celebración es la de pantalla completa (`IBFiesta.ultra(el, { psc: { euros } })`: «¡25 € PARA TI!» + tarjeta azul `.ru-tk--psc`,
  sin botón de compartir). La cinta **hace como que no toca**: alrededor del premio solo hay «Sigue en el sorteo», se queda
  clavada en el de antes (`.is-fake`, «Vaya…» 2 s) y da un tirón con rebote al premio («¡¡ESPERA!!», `.is-jolt`). Con **psc25**
  el engaño es completo: «Esta vez no ha salido premio» + el sonido de perder durante 2,7 s. (Esto es solo para cuando sí toca;
  cuando no toca sigue sin haber «casi» forzados.)
  SQL `12-sorteo.sql` no está en el repo.
- `seguro.js` — «Iberail Protect» (seguro de viaje con marca propia; la aseguradora solo en letra pequeña si se
  rellena). **Se paga aparte del viaje**: no toca `grupo_miembros.importe` ni `pagos`. «Mis grupos» (`[data-seguro]`):
  tarjeta con coberturas y «Contratar y pagar» → `IBPay.start(btn, gid, null, { seguro: true })` → stripe-checkout
  (`pagarSeguro`, precio de `seguro_ofertas`) → webhook (metadata `tipo: 'seguro'`) apunta en `seguros` estado `pagado`.
  Vuelta: `grupos.html?seguro=ok|cancelado`. Panel (`[data-seguro-admin]`): oferta (plan, cancelación, precio, límite,
  aseguradora); por viajero: Marcar pagado (Bizum) / nº póliza → Contratado / Anular. Coberturas en `PLANES`
  (Totaltravel / mini de InterMundial; aseguradora Sompo). SQL: `supabase/sql/seguros.sql`. `live.js`: `seguro_pedido`.

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
- **WhatsApp**: si `WA_APP_SECRET` no está puesto, el webhook acepta peticiones sin firmar (cualquiera puede
  hacer que el bot escriba y gaste). Debería ser obligatorio.
- **WhatsApp**: la fecha con minutos va al principio del prompt del sistema → la caché de prompts de la IA
  se invalida cada minuto. Mover la fecha a un bloque aparte, después de la parte cacheada.
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
