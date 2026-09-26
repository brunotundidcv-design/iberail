# Iberail — notas del proyecto

Web de **Iberail** (iberail.com): agencia española de rutas Interrail a medida, con Split / Ultra Europe
como parada estrella. Fundador: Bruno Tundidor. Idioma de la web y del trabajo: **español**.

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
- `payment.js` — Stripe (sin activar: falta `STRIPE_PUBLIC_KEY` en config).

## Supabase

Tablas: `rutas`, `rutas_notas`, `grupos`, `grupo_miembros`, `documentos`, `avisos`, `avisos_leidos`,
`pagos`, `comisiones`, `referidos`, `rrpp_codigos`, `wa_config`, `wa_chats`, `wa_mensajes`.
RPC: `is_admin`, `buscar_clientes`, `pagos_grupo`, `companeros_grupo`, `mi_invita`,
`registrar_referido`, `rrpp_reglas`, `delete_my_account`.
Storage: bucket `documentos`. Edge functions: `whatsapp`, `stripe-checkout`.
El esquema SQL / políticas RLS **no están en el repo**.

## Pendientes detectados

- **Pagos Stripe sin terminar** (`payment.js`):
  - el importe se calcula en el navegador y se envía al servidor → la edge function debe recalcularlo;
  - la llamada a `stripe-checkout` no envía `Authorization`/`apikey` (Supabase la rechazará con 401);
  - usa `stripe.redirectToCheckout`, que Stripe ha retirado → mejor devolver `session.url` y redirigir;
  - `data-stripe-payment="${id}-${importe}"` se parte con `split('-')`: falla si el id tiene guiones.
- Falta `build.py` y el esquema de Supabase para tener el proyecto completo.
- `sitemap.xml` sin `lastmod`.
