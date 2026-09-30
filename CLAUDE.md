# Iberail — notas del proyecto

Web de **Iberail** (iberail.com): agencia española de rutas Interrail a medida, con Split / Ultra Europe
como parada estrella. Fundador: Bruno Tundidor. **Titular legal** (autónoma, IAE 755 agencias de viajes,
alta 25/09/2026): Andrea Tundidor San Juan, NIF 54214649S (aviso legal, privacidad, rutas.html, contrato). Idioma de la web y del trabajo: **español**.

Versión importada: `iberail-web-v6.4` (zip subido el 2026-09-26).

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

- `app.js` — capa común `window.IB`: cliente Supabase, enlaces WhatsApp, sesión, utilidades.
- `site.js` — menú, animaciones, comportamiento común.
- `data.js` — ciudades, orígenes, trayectos de tren (`IB_DATA`).
- `map.js` / `gmap.js` — mapa SVG de Europa (Natural Earth vía jsDelivr) y mapa de ruta del grupo.
- `planner.js` — planificador (guarda borrador en localStorage `ib-draft-v2`).
- `cuenta.js` — cuenta del cliente.
- `panel.js` — panel del equipo: solicitudes en directo, clientes, grupos, documentos, pagos,
  comisiones/RRPP, bot de WhatsApp.
- `notif.js` — campana de notificaciones.
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
  Firma con RPC `firmar_contrato` (solo el propio, solo pendiente). PDF = ventana de impresión. SQL: `supabase/sql/contratos.sql`.
  Teléfono del tutor obligatorio (≥9 cifras); en el panel sale con enlace a WhatsApp y botón «Copiar teléfonos
  de los padres». Pestaña «Contratos» del panel (`#conView`, `IBContratos.show()`): todos los contratos por grupo,
  filtros, PDF y teléfonos de tutores. Botón «Repetir» (grupo y pestaña): anula (queda guardado) y envía uno nuevo con aviso. `live.js` apunta `contrato_abierto`, `contrato_firmado`, `contrato_descargado`.
  Vista `contactos_tutores` (security_invoker) con todos los tutores que han firmado.

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
  grupo (rota ejemplos) y cinta de tipos de viaje. Menú completo desde 1100 px (1260 px con sesión); barra inferior en móvil.
- **Marca en el JS común**: `IB.BRANDS` / `IB.brand` / `IB.brandOf(marca)` en `app.js` (nombre, web, correo, «Protect»,
  pase, textos). Iberail sigue igual por defecto (sin `MARCA` en config). Contratos: la marca sale de `grupos.marca`
  (en `condiciones.marca` al enviarlo). `live.js` antepone «Zarping · » a la página en «En directo».
- **Festivales** (`festivales.html`): se genera desde `tools/zarping/festivales.json` (fechas oficiales, revisado el
  30/09/2026). Los que ya han terminado se ocultan solos; filtro España / Europa / Resto del mundo. «Ir con Zarping» abre
  «Monta tu viaje» con `?tipo=festival&dest=…`. Para añadir o cambiar festivales: editar el JSON y volver a ejecutar el build.
  Ultra Europe (Split) no sale: es de Iberail.
- **Destinos** (`destinos.html`): 132 destinos (España, Europa, resto del mundo) con actividades, época y días, desde
  `tools/zarping/destinos.json`. Buscador + filtros por zona y tipo (playa, islas, ciudad…); `?q=` precarga la búsqueda.
  «Pedir precio» → `monta-tu-viaje.html?tipo=escapada|nieve&dest=…`. Para añadir destinos: editar el JSON y volver a ejecutar el build.
- **Monta tu viaje** (`zp-viaje.js`): 3 pasos → fila en `rutas` con `ref` ZP-XXXXXX, `marca: 'zarping'`, destino en
  `paradas[0]`, tipo e «incluir» en `estilo`, resto en `notas`. Pide cuenta para enviar. Borrador `zp-draft-v1` (30 días).
  Netlify Forms «viaje» de respaldo.
- **Base de datos**: `supabase/sql/marca.sql` (columna `marca` en `rutas` y `grupos`; amplía límites de días/personas).
  Sin ejecutarlo, las solicitudes se guardan igual y el panel las reconoce por la ref ZP-.
- **Panel**: filtro «Iberail / Zarping» en solicitudes, etiqueta Zarping, marca al crear grupo y en la ficha del grupo;
  rutas creadas por el equipo heredan la marca. Correos: selector de marca (plantilla, remitente y audiencia).
- **Stripe** (`stripe-checkout`): con `grupos.marca = 'zarping'` el pago/seguro sale como Zarping y vuelve a zarping.com
  (`ZARPING_URL` opcional). **Correos**: plantilla Zarping (tinta/lima/violeta) para solicitudes ZP- y grupos Zarping;
  remitente `CORREOS_FROM_ZARPING` (por defecto «Zarping <misma dirección que CORREOS_FROM>»), `CORREOS_REPLY_TO_ZARPING`.
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
  **zarping.com y zarping.es comprados el 30/09/2026**). Lema: «Suelta amarras.» Pendiente: marca en la OEPM (clase 39) y @zarping en redes. Marca: tinta #0E0E12, lima #D4FF3A, violeta #7B5CFF,
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
