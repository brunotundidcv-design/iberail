// @ts-nocheck
// Iberail · correos (Supabase Edge Function + Resend)
//
// 1. Seguimiento (a todos, es parte del servicio). Salen solos desde los Database Webhooks de Supabase:
//    - rutas INSERT                       → «Hemos recibido tu ruta»
//    - rutas UPDATE (estado → presupuesto) → «Tu presupuesto está listo»
//    - grupo_miembros INSERT              → «Ya estás en el grupo»
//    - grupo_miembros UPDATE (importe)    → «Ya tienes el precio» + botón de pago
//    - pagos INSERT                       → «Hemos recibido tu pago»
//    y una vez al día (Supabase Cron, action «diario»): recordatorio semanal de pago y cuenta atrás del viaje.
// 2. Publicidad (solo a quien marcó «acepto publicidad» y no se ha dado de baja): campañas desde el panel.
//
// Despliegue:  supabase functions deploy correos --no-verify-jwt
// Secretos:    RESEND_API_KEY, CORREOS_KEY (clave inventada, la misma que se pone en los webhooks y el cron),
//              CORREOS_FROM (opcional, por defecto «Iberail <hola@iberail.com>»), SITE_URL (opcional)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const env = (k: string, d = '') => Deno.env.get(k) ?? d;
const SITE = env('SITE_URL', 'https://iberail.com').replace(/\/$/, '');
const FROM = env('CORREOS_FROM', 'Iberail <hola@iberail.com>');
const KEY = env('CORREOS_KEY');
const SELF = `${env('SUPABASE_URL').replace(/\/$/, '')}/functions/v1/correos`;
const WA = 'https://wa.me/34930491439';
const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-iberail-key', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/* ============================ utilidades ============================ */
const esc = (s: unknown) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const eur = (n: number) => { const [i, d] = Math.abs(Number(n) || 0).toFixed(2).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d === '00' ? '' : ',' + d) + ' €'; };
const pila = (n?: string) => String(n || '').trim().split(/\s+/)[0] || '';
const code3 = (s: string) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^A-Za-z]/g, '').slice(0, 3).toUpperCase() || '···';
const hoy = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Madrid' }));
const isoDia = (d: Date) => d.toISOString().slice(0, 10);
const dias = (iso: string) => Math.round((new Date(iso + 'T12:00:00Z').getTime() - new Date(isoDia(hoy()) + 'T12:00:00Z').getTime()) / 864e5);
const fdia = (iso: string) => new Date(iso + 'T12:00:00Z').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' });
const semana = (d: Date) => { const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())); const n = (t.getUTCDay() + 6) % 7; t.setUTCDate(t.getUTCDate() - n + 3); const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 4)); return `${t.getUTCFullYear()}-${1 + Math.round(((t.getTime() - y.getTime()) / 864e5 - 3 + ((y.getUTCDay() + 6) % 7)) / 7)}`; };

async function hmac(txt: string) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(KEY || 'iberail'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return [...new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(txt)))].map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 32);
}
const b64u = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s: string) => decodeURIComponent(escape(atob(s.replace(/-/g, '+').replace(/_/g, '/'))));
const bajaUrl = async (email: string) => `${SELF}?baja=${b64u(email.toLowerCase())}&t=${await hmac('baja:' + email.toLowerCase())}`;

/* ============================ la plantilla ============================ */
// Colores de la web: crema #F7F2E8, papel #FFFDF8, granate #260C08, coral #F0532F, ámbar #FFC53D, tinta #1F120E
const F_DISPLAY = "'Bricolage Grotesque','Helvetica Neue',Helvetica,Arial,sans-serif";
const F_BODY = "Inter,'Helvetica Neue',Helvetica,Arial,sans-serif";
const F_MONO = "'IBM Plex Mono',Menlo,Consolas,monospace";
const F_LOGO = "Poppins,'Arial Black','Helvetica Neue',Arial,sans-serif";   // tipografía del logotipo

type Correo = {
  asunto: string; previa: string; etiqueta: string; titulo: string; acento?: string;
  parrafos: string[];                                   // HTML sencillo (ya escapado)
  boton?: { texto: string; url: string };
  enlace?: { texto: string; url: string };              // enlace secundario bajo el botón
  billete?: { de: string; a: string; meta: [string, string][]; ref?: string };
  datos?: [string, string][];                           // tabla de datos (importe, pagado…)
  progreso?: { pct: number; texto: string };
  lista?: string[];                                     // checklist
  publicidad?: boolean; baja?: string;
};

function plantilla(c: Correo) {
  const P = (h: string) => `<p style="margin:0 0 16px;font-family:${F_BODY};font-size:16px;line-height:1.6;color:#3D2C24">${h}</p>`;
  const billete = c.billete ? `
    <tr><td style="padding:8px 36px 8px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7F2E8;border:1.5px dashed #E5DAC6;border-radius:18px">
        <tr><td style="padding:18px 22px 6px;font-family:${F_MONO};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#6E5D50">Billete · Interrail${c.billete.ref ? ` · ${esc(c.billete.ref)}` : ''}</td></tr>
        <tr><td style="padding:0 22px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
            <td style="font-family:${F_DISPLAY};font-size:40px;font-weight:800;letter-spacing:-1px;color:#1F120E">${esc(code3(c.billete.de))}</td>
            <td align="center" style="font-family:${F_MONO};font-size:16px;color:#F0532F;padding:0 8px">- - - ● - - -</td>
            <td align="right" style="font-family:${F_DISPLAY};font-size:40px;font-weight:800;letter-spacing:-1px;color:#1F120E">${esc(code3(c.billete.a))}</td>
          </tr><tr>
            <td style="font-family:${F_BODY};font-size:13px;color:#6E5D50">${esc(c.billete.de)}</td><td></td>
            <td align="right" style="font-family:${F_BODY};font-size:13px;color:#6E5D50">${esc(c.billete.a)}</td>
          </tr></table>
        </td></tr>
        <tr><td style="padding:14px 22px 18px">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1.5px dashed #E5DAC6"><tr>
            ${c.billete.meta.map(([v, l]) => `<td width="${Math.floor(100 / c.billete.meta.length)}%" style="padding-top:12px;font-family:${F_BODY};font-size:12px;color:#6E5D50"><b style="display:block;font-family:${F_DISPLAY};font-size:20px;color:#1F120E">${esc(v)}</b>${esc(l)}</td>`).join('')}
          </tr></table>
        </td></tr>
      </table>
    </td></tr>` : '';
  const datos = c.datos ? `
    <tr><td style="padding:8px 36px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-radius:16px;background:#F7F2E8">
        ${c.datos.map(([k, v], i) => `<tr><td style="padding:12px 18px;font-family:${F_BODY};font-size:14px;color:#6E5D50;${i ? 'border-top:1px solid #E5DAC6;' : ''}">${esc(k)}</td><td align="right" style="padding:12px 18px;font-family:${F_DISPLAY};font-size:16px;font-weight:700;color:#1F120E;${i ? 'border-top:1px solid #E5DAC6;' : ''}">${esc(v)}</td></tr>`).join('')}
      </table>
    </td></tr>` : '';
  const pct = c.progreso ? Math.max(3, Math.min(100, Math.round(c.progreso.pct))) : 0;
  const progreso = c.progreso ? `
    <tr><td style="padding:14px 36px 4px">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#EFE6D6;border-radius:99px"><tr>
        <td width="${pct}%" style="background:#F0532F;background-image:linear-gradient(90deg,#F0532F,#FFC53D);border-radius:99px;height:10px;font-size:0;line-height:0">&nbsp;</td>${pct < 100 ? '<td style="font-size:0;line-height:0">&nbsp;</td>' : ''}
      </tr></table>
      <p style="margin:8px 0 0;font-family:${F_BODY};font-size:13px;color:#6E5D50">${esc(c.progreso.texto)}</p>
    </td></tr>` : '';
  const lista = c.lista ? `
    <tr><td style="padding:4px 36px 8px">
      ${c.lista.map(l => `<table role="presentation" cellspacing="0" cellpadding="0" style="margin:0 0 10px"><tr><td valign="top" style="width:30px"><div style="width:20px;height:20px;border-radius:6px;background:#FFC53D;text-align:center;font-family:${F_BODY};font-size:13px;line-height:20px;color:#1F120E;font-weight:700">✓</div></td><td style="font-family:${F_BODY};font-size:15px;line-height:1.5;color:#3D2C24">${l}</td></tr></table>`).join('')}
    </td></tr>` : '';
  const boton = c.boton ? `
    <tr><td style="padding:18px 36px 6px">
      <table role="presentation" cellspacing="0" cellpadding="0"><tr><td style="border-radius:99px;background:#F0532F;box-shadow:0 10px 24px -10px rgba(240,83,47,.7)">
        <a href="${esc(c.boton.url)}" style="display:inline-block;padding:16px 30px;font-family:${F_BODY};font-size:16px;font-weight:700;color:#FFFFFF;text-decoration:none;border-radius:99px">${esc(c.boton.texto)} &nbsp;→</a>
      </td></tr></table>
      ${c.enlace ? `<p style="margin:14px 0 0;font-family:${F_BODY};font-size:14px"><a href="${esc(c.enlace.url)}" style="color:#6E5D50;text-decoration:underline">${esc(c.enlace.texto)}</a></p>` : ''}
    </td></tr>` : '';
  const pie = c.publicidad
    ? `Te escribimos porque aceptaste recibir novedades de Iberail. <a href="${esc(c.baja || '#')}" style="color:#D9C3B3;text-decoration:underline">Darme de baja</a>`
    : `Te escribimos por tu viaje con Iberail. Si algo no cuadra, contéstanos a este correo o por WhatsApp.`;

  return `<!doctype html>
<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light">
<title>${esc(c.asunto)}</title>
<link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,700;12..96,800&family=Inter:wght@400;600;700&family=IBM+Plex+Mono:wght@500&family=Poppins:wght@800&display=swap" rel="stylesheet">
<style>@media (max-width:620px){.card{border-radius:0!important}.pad{padding-left:22px!important;padding-right:22px!important}.h1{font-size:34px!important}}</style>
</head>
<body style="margin:0;padding:0;background:#F7F2E8">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.previa)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#F7F2E8"><tr><td align="center" style="padding:28px 12px">
  <table role="presentation" class="card" width="600" cellspacing="0" cellpadding="0" style="width:600px;max-width:100%;background:#FFFDF8;border-radius:28px;overflow:hidden;box-shadow:0 20px 50px -30px rgba(31,18,14,.35)">
    <!-- cabecera -->
    <tr><td style="background:#260C08;background-image:radial-gradient(60% 80% at 100% 0%,rgba(240,83,47,.45),transparent 70%);padding:26px 36px 34px" class="pad">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr>
        <td><a href="${SITE}" style="text-decoration:none"><img src="${SITE}/assets/img/logo.png" width="36" height="36" alt="Iberail" style="vertical-align:middle;border-radius:10px;border:0"> <span style="vertical-align:middle;font-family:${F_LOGO};font-size:24px;font-weight:800;color:#F7F0E3;letter-spacing:-1px">&nbsp;ibe<span style="color:#F0B02A">rail</span></span></a></td>
        <td align="right" style="font-family:${F_MONO};font-size:11px;letter-spacing:2px;color:#D9C3B3;text-transform:uppercase">Interrail a tu medida</td>
      </tr></table>
      <p style="margin:34px 0 10px;font-family:${F_MONO};font-size:12px;letter-spacing:2.5px;text-transform:uppercase;color:#FFC53D">— ${esc(c.etiqueta)}</p>
      <h1 class="h1" style="margin:0;font-family:${F_DISPLAY};font-size:40px;line-height:1.05;font-weight:800;letter-spacing:-1.2px;color:#F7F2E8">${esc(c.titulo)}${c.acento ? ` <span style="color:#FFC53D">${esc(c.acento)}</span>` : ''}</h1>
    </td></tr>
    <!-- cuerpo -->
    <tr><td style="padding:32px 36px 8px" class="pad">${c.parrafos.map(P).join('')}</td></tr>
    ${billete}${datos}${progreso}${lista}${boton}
    <tr><td style="padding:26px 36px 32px" class="pad">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-top:1px solid #E5DAC6"><tr>
        <td style="padding-top:18px;font-family:${F_BODY};font-size:14px;line-height:1.5;color:#6E5D50">¿Dudas? Escríbenos por <a href="${WA}" style="color:#F0532F;font-weight:700;text-decoration:none">WhatsApp</a>, estamos 24 h.<br>Un abrazo,<br><b style="color:#1F120E">El equipo de Iberail</b></td>
      </tr></table>
    </td></tr>
    <!-- pie -->
    <tr><td style="background:#260C08;padding:22px 36px;font-family:${F_BODY};font-size:12px;line-height:1.6;color:#D9C3B3" class="pad">
      <a href="${SITE}" style="color:#F7F2E8;text-decoration:none;font-weight:700">iberail.com</a> &nbsp;·&nbsp; <a href="https://www.instagram.com/iberailspain/" style="color:#F7F2E8;text-decoration:none">@iberailspain</a><br>
      ${pie}
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
}

// versión en texto plano (mejora la entrega y la leen los relojes / lectores)
function texto(c: Correo) {
  const strip = (h: string) => h.replace(/<br\s*\/?>/g, '\n').replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&');
  return [c.titulo + (c.acento ? ' ' + c.acento : ''), '', ...c.parrafos.map(strip),
    ...(c.datos || []).map(([k, v]) => `${k}: ${v}`), ...(c.lista || []).map(l => '- ' + strip(l)),
    c.boton ? `\n${c.boton.texto}: ${c.boton.url}` : '', '', '— El equipo de Iberail · iberail.com',
    c.publicidad && c.baja ? `Darte de baja: ${c.baja}` : ''].join('\n');
}

/* ============================ los correos ============================ */
const tripOf = (r: any) => {
  const paradas = r?.paradas || [];
  return { de: r?.salida || 'España', a: (paradas[paradas.length - 1] || {}).ciudad || 'Europa', paradas: paradas.length, dias: r?.dias || 0, viajeros: r?.viajeros || 0 };
};

const C = {
  ruta_recibida: (r: any): Correo => {
    const t = tripOf(r);
    return {
      asunto: `Hemos recibido tu ruta ${r.ref || ''} 🚆`.trim(), previa: `${t.de} → ${t.a}, ${t.dias} días. Te preparamos el presupuesto.`,
      etiqueta: 'Ruta recibida', titulo: `¡Hola${pila(r.nombre) ? ' ' + pila(r.nombre) : ''}!`, acento: 'Tu ruta ya está con nosotros.',
      parrafos: [
        'Ya tenemos tu idea de viaje. Ahora la revisamos a mano: el orden de las paradas, los trenes que te convienen y alojamiento cerca de cada estación.',
        'En cuanto tengamos tu presupuesto te avisamos. Diseñarla <b>no te compromete a nada</b>: solo reservamos cuando tú lo confirmas.'
      ],
      billete: { de: t.de, a: t.a, ref: r.ref, meta: [[String(t.dias), 'días'], [String(t.paradas), t.paradas === 1 ? 'parada' : 'paradas'], [String(t.viajeros), t.viajeros === 1 ? 'viajero' : 'viajeros']] },
      boton: { texto: 'Ver mi ruta', url: `${SITE}/cuenta.html#rutas` }
    };
  },
  presupuesto: (r: any): Correo => {
    const t = tripOf(r);
    return {
      asunto: 'Tu presupuesto está listo ✨', previa: `Ya tienes el presupuesto de tu ruta ${t.de} → ${t.a}.`,
      etiqueta: 'Presupuesto listo', titulo: `${pila(r.nombre) || 'Hola'},`, acento: 'tu viaje ya tiene precio.',
      parrafos: [
        'Te hemos preparado el presupuesto de tu ruta. Te lo hemos enviado también por WhatsApp para que lo comentes con quien viajas.',
        'Si quieres cambiar algo (días, alojamiento o paradas), dínoslo y lo ajustamos. <b>Los alojamientos céntricos vuelan</b>: cuanto antes lo cerremos, más donde elegir.'
      ],
      billete: { de: t.de, a: t.a, ref: r.ref, meta: [[String(t.dias), 'días'], [String(t.paradas), t.paradas === 1 ? 'parada' : 'paradas'], [String(t.viajeros), t.viajeros === 1 ? 'viajero' : 'viajeros']] },
      boton: { texto: 'Ver mi ruta', url: `${SITE}/cuenta.html#rutas` },
      enlace: { texto: 'Hablar con el equipo por WhatsApp', url: WA }
    };
  },
  grupo: (x: { nombre: string; grupo: string; gid: number }): Correo => ({
    asunto: `Ya estás en el grupo «${x.grupo}» 🙌`, previa: 'Tu ruta, tus billetes y tu parte del viaje, en un solo sitio.',
    etiqueta: 'Tu grupo de viaje', titulo: `¡Bienvenido${x.nombre ? ', ' + pila(x.nombre) : ''}!`, acento: `Ya estás en «${x.grupo}».`,
    parrafos: ['Desde ahora tienes todo el viaje en tu cuenta de Iberail, y lo ves igual que el resto del grupo:'],
    lista: ['<b>La ruta en el mapa</b>, con cada parada y cada tren', '<b>Billetes y documentos</b> en cuanto los subamos', '<b>Tu parte del viaje</b>: lo que te toca y lo que llevas pagado', '<b>Avisos</b> del viaje al momento'],
    boton: { texto: 'Ver mi grupo', url: `${SITE}/grupos.html#grupo-${x.gid}` }
  }),
  pago_pendiente: (x: { nombre: string; grupo: string; gid: number; importe: number; pagado: number; recordatorio?: boolean; salida?: string }): Correo => {
    const falta = Math.max(0, x.importe - x.pagado);
    const d = x.salida ? dias(x.salida) : null;
    return {
      asunto: x.recordatorio ? `Te quedan ${eur(falta)} de tu viaje` : `Tu viaje ya tiene precio: ${eur(x.importe)}`,
      previa: `Paga en un minuto con tarjeta, Apple Pay o Google Pay. Todo o una parte.`,
      etiqueta: x.recordatorio ? 'Recordatorio de pago' : 'Tu parte del viaje', titulo: `${pila(x.nombre) || 'Hola'},`, acento: `te ${falta === 1 ? 'queda' : 'quedan'} ${eur(falta)}.`,
      parrafos: [
        x.recordatorio
          ? `Te recordamos lo que te falta de tu parte del viaje con <b>«${esc(x.grupo)}»</b>${d && d > 0 ? `, que sale en <b>${d} días</b>` : ''}.`
          : `Ya hemos cerrado el precio de tu viaje con <b>«${esc(x.grupo)}»</b>. Puedes pagarlo ahora mismo desde aquí.`,
        'Puedes pagarlo <b>todo de una vez o por partes</b>, como mejor te venga. El pago es seguro y lo gestiona Stripe.'
      ],
      datos: [['Tu parte del viaje', eur(x.importe)], ['Ya pagado', eur(x.pagado)], ['Te queda', eur(falta)]],
      progreso: { pct: x.importe ? x.pagado / x.importe * 100 : 0, texto: `Llevas pagado el ${x.importe ? Math.round(x.pagado / x.importe * 100) : 0}%` },
      boton: { texto: `Pagar ${eur(falta)}`, url: `${SITE}/grupos.html?pagar=${x.gid}#grupo-${x.gid}` },
      enlace: { texto: 'Prefiero pagar una parte', url: `${SITE}/grupos.html?pagar=${x.gid}&parte=1#grupo-${x.gid}` }
    };
  },
  pago_recibido: (x: { nombre: string; grupo: string; gid: number; cantidad: number; importe: number; pagado: number }): Correo => {
    const falta = Math.max(0, x.importe - x.pagado), todo = x.importe > 0 && falta <= 0;
    return {
      asunto: todo ? '¡Viaje pagado! 🎉' : `Hemos recibido tu pago de ${eur(x.cantidad)}`,
      previa: todo ? 'Lo tienes todo pagado. Ya solo queda hacer la mochila.' : `Te quedan ${eur(falta)}.`,
      etiqueta: 'Pago recibido', titulo: todo ? '¡Todo pagado!' : `¡Gracias${x.nombre ? ', ' + pila(x.nombre) : ''}!`, acento: todo ? 'Ya solo queda la mochila.' : `Recibido: ${eur(x.cantidad)}.`,
      parrafos: [todo
        ? `Tienes pagada tu parte del viaje con <b>«${esc(x.grupo)}»</b>. Nosotros seguimos con las reservas y te avisamos en cuanto subamos los billetes.`
        : `Hemos apuntado tu pago en tu parte del viaje con <b>«${esc(x.grupo)}»</b>. Lo ves al momento en tu cuenta.`],
      datos: x.importe ? [['Este pago', eur(x.cantidad)], ['Llevas pagado', eur(x.pagado)], ['Te queda', todo ? '0 €' : eur(falta)]] : [['Este pago', eur(x.cantidad)]],
      progreso: x.importe ? { pct: x.pagado / x.importe * 100, texto: todo ? 'Todo pagado' : `Llevas pagado el ${Math.round(x.pagado / x.importe * 100)}%` } : undefined,
      boton: { texto: 'Ver mi grupo', url: `${SITE}/grupos.html#grupo-${x.gid}` }
    };
  },
  cuenta_atras: (x: { nombre: string; grupo: string; gid: number; salida: string; n: number }): Correo => ({
    asunto: x.n === 1 ? '¡Mañana empieza tu Interrail! 🚆' : `Faltan ${x.n} días para tu Interrail`,
    previa: `Salís el ${fdia(x.salida)}. Repasa esto antes de salir.`,
    etiqueta: 'Cuenta atrás', titulo: x.n === 1 ? '¡Es mañana!' : `Faltan ${x.n} días`, acento: x.n === 1 ? 'Buen viaje 🚆' : 'para salir.',
    parrafos: [`Tu viaje con <b>«${esc(x.grupo)}»</b> sale el <b>${fdia(x.salida)}</b>. ${x.n === 1 ? 'Última revisión antes de salir:' : 'Para que no se te escape nada, repasa esto:'}`],
    lista: ['<b>DNI o pasaporte</b> en vigor', '<b>Tarjeta Sanitaria Europea</b> (es gratis) y el seguro de viaje', '<b>App Rail Planner</b> con tu pase Interrail activado', 'Billetes y reservas descargados desde <b>tu grupo en iberail.com</b>', 'Batería externa y un candado para las taquillas del hostal'],
    boton: { texto: 'Ver mi grupo y mis billetes', url: `${SITE}/grupos.html#grupo-${x.gid}` }
  }),
  campana: (x: { asunto: string; titulo: string; texto: string; boton_texto?: string; boton_url?: string; nombre?: string; baja?: string }): Correo => ({
    asunto: x.asunto, previa: String(x.texto || '').split('\n')[0].slice(0, 110),
    etiqueta: 'Novedades Iberail', titulo: x.nombre ? `${pila(x.nombre)},` : '', acento: x.nombre ? x.titulo.charAt(0).toLowerCase() + x.titulo.slice(1) : x.titulo,
    parrafos: String(x.texto || '').split(/\n\s*\n/).map(p => esc(p.trim()).replace(/\n/g, '<br>').replace(/\*(.+?)\*/g, '<b>$1</b>')).filter(Boolean),
    boton: x.boton_texto && x.boton_url ? { texto: x.boton_texto, url: x.boton_url } : undefined,
    publicidad: true, baja: x.baja
  })
};

/* ============================ envío ============================ */
async function enviar(para: string, c: Correo, extra: Record<string, unknown> = {}) {
  if (!para) return { ok: false, error: 'sin correo' };
  const headers: Record<string, string> = {};
  if (c.publicidad && c.baja) { headers['List-Unsubscribe'] = `<${c.baja}>`; headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'; }
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: FROM, to: [para], subject: c.asunto, html: plantilla(c), text: texto(c), reply_to: env('CORREOS_REPLY_TO', 'info@iberail.com'), headers, ...extra })
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) { console.error('resend', r.status, JSON.stringify(out).slice(0, 300)); return { ok: false, error: out?.message || `Resend ${r.status}` }; }
  return { ok: true, id: out.id };
}

// cada correo automático se manda una sola vez (clave única en correos_enviados)
async function unaVez(clave: string) {
  const { error } = await sb.from('correos_enviados').insert({ clave });
  if (!error) return true;
  if (error.code === '23505' || /duplicate/i.test(error.message)) return false;
  throw error;
}
async function unaVezYEnviar(clave: string, para: string, c: Correo) {
  if (!para || !(await unaVez(clave))) return 'ya_enviado';
  const r = await enviar(para, c);
  if (!r.ok) { await sb.from('correos_enviados').delete().eq('clave', clave); return 'error: ' + r.error; }
  return 'enviado';
}

/* ============================ datos ============================ */
async function usuario(uid: string) {
  const { data } = await sb.auth.admin.getUserById(uid);
  const u = data?.user;
  return u ? { email: u.email || '', nombre: u.user_metadata?.nombre || '' } : null;
}
async function grupo(gid: number) {
  const [{ data: g }, { data: rs }] = await Promise.all([
    sb.from('grupos').select('id, nombre').eq('id', gid).maybeSingle(),
    sb.from('rutas').select('fecha_salida').eq('grupo_id', gid).not('fecha_salida', 'is', null).order('fecha_salida').limit(1)
  ]);
  return { nombre: g?.nombre || 'vuestro grupo', salida: rs?.[0]?.fecha_salida || null };
}
async function pagado(gid: number, uid: string) {
  const { data } = await sb.from('pagos').select('importe').eq('grupo_id', gid).eq('user_id', uid);
  return (data || []).reduce((a, p) => a + Number(p.importe || 0), 0);
}

/* ============================ eventos de la base de datos ============================ */
async function evento(ev: any) {
  const { type, table, record: r, old_record: o } = ev || {};
  if (table === 'rutas' && type === 'INSERT' && r?.email && !r.creada_por_equipo)
    return unaVezYEnviar(`ruta:${r.id}`, r.email, C.ruta_recibida(r));
  if (table === 'rutas' && type === 'UPDATE' && r?.estado === 'presupuesto_enviado' && o?.estado !== 'presupuesto_enviado' && r.email)
    return unaVezYEnviar(`presupuesto:${r.id}`, r.email, C.presupuesto(r));
  if (table === 'grupo_miembros' && (type === 'INSERT' || type === 'UPDATE') && r?.user_id) {
    const u = await usuario(r.user_id); if (!u) return 'sin_usuario';
    const g = await grupo(r.grupo_id), out = [];
    if (type === 'INSERT') out.push(await unaVezYEnviar(`grupo:${r.grupo_id}:${r.user_id}`, u.email, C.grupo({ nombre: u.nombre, grupo: g.nombre, gid: r.grupo_id })));
    const imp = Number(r.importe || 0), antes = Number(o?.importe || 0);
    if (imp > 0 && imp !== antes && !r.pagado) {
      const pag = await pagado(r.grupo_id, r.user_id);
      if (imp - pag > 0) out.push(await unaVezYEnviar(`precio:${r.grupo_id}:${r.user_id}:${imp}`, u.email, C.pago_pendiente({ nombre: u.nombre, grupo: g.nombre, gid: r.grupo_id, importe: imp, pagado: pag, salida: g.salida })));
    }
    return out.join(', ') || 'nada';
  }
  if (table === 'pagos' && type === 'INSERT' && r?.user_id && Number(r.importe) > 0) {
    const u = await usuario(r.user_id); if (!u) return 'sin_usuario';
    const [g, pag, { data: m }] = await Promise.all([grupo(r.grupo_id), pagado(r.grupo_id, r.user_id), sb.from('grupo_miembros').select('importe').eq('grupo_id', r.grupo_id).eq('user_id', r.user_id).maybeSingle()]);
    return unaVezYEnviar(`pago:${r.id}`, u.email, C.pago_recibido({ nombre: u.nombre, grupo: g.nombre, gid: r.grupo_id, cantidad: Number(r.importe), importe: Number(m?.importe || 0), pagado: pag }));
  }
  return 'ignorado';
}

/* ============================ una vez al día ============================ */
async function diario() {
  const { data: miembros } = await sb.from('grupo_miembros').select('grupo_id, user_id, importe, pagado');
  const hoyD = hoy(), sem = semana(hoyD), lunes = hoyD.getDay() === 1, res: Record<string, number> = {};
  const cache: Record<string, any> = {};
  for (const m of miembros || []) {
    try {
      const g = cache[m.grupo_id] ??= await grupo(m.grupo_id);
      const d = g.salida ? dias(g.salida) : null;
      // cuenta atrás: 30, 7 y 1 día antes de salir
      if (d != null && [30, 7, 1].includes(d)) {
        const u = await usuario(m.user_id);
        if (u) { const k = await unaVezYEnviar(`viaje:${m.grupo_id}:${m.user_id}:${d}`, u.email, C.cuenta_atras({ nombre: u.nombre, grupo: g.nombre, gid: m.grupo_id, salida: g.salida, n: d })); res[k] = (res[k] || 0) + 1; }
      }
      // recordatorio de pago: los lunes, si falta algo y aún no ha salido
      const imp = Number(m.importe || 0);
      if (lunes && imp > 0 && !m.pagado && (d == null || d >= 0)) {
        const pag = await pagado(m.grupo_id, m.user_id);
        if (imp - pag >= 1) {
          const u = await usuario(m.user_id);
          if (u) { const k = await unaVezYEnviar(`recordatorio:${m.grupo_id}:${m.user_id}:${sem}`, u.email, C.pago_pendiente({ nombre: u.nombre, grupo: g.nombre, gid: m.grupo_id, importe: imp, pagado: pag, recordatorio: true, salida: g.salida })); res[k] = (res[k] || 0) + 1; }
        }
      }
    } catch (e) { console.error('diario', m, e); res.error = (res.error || 0) + 1; }
  }
  return res;
}

/* ============================ campañas (solo el equipo) ============================ */
async function esEquipo(req: Request) {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return null;
  const { data } = await sb.auth.getUser(jwt);
  if (!data?.user) return null;
  const { data: adm } = await sb.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  return adm ? data.user : null;
}
async function audiencia() {
  const [{ data: rs }, { data: bajas }] = await Promise.all([
    sb.from('rutas').select('email, nombre, created_at').eq('acepta_publicidad', true).order('created_at', { ascending: false }),
    sb.from('bajas_publicidad').select('email')
  ]);
  const fuera = new Set((bajas || []).map(b => String(b.email).toLowerCase()));
  const vistos = new Map<string, string>();
  for (const r of rs || []) { const e = String(r.email || '').trim().toLowerCase(); if (e && /@/.test(e) && !fuera.has(e) && !vistos.has(e)) vistos.set(e, r.nombre || ''); }
  return [...vistos].map(([email, nombre]) => ({ email, nombre }));
}
async function campana(body: any, yo: any) {
  const x = { asunto: String(body.asunto || '').trim().slice(0, 150), titulo: String(body.titulo || '').trim().slice(0, 120), texto: String(body.texto || '').slice(0, 5000), boton_texto: String(body.boton_texto || '').trim().slice(0, 40), boton_url: String(body.boton_url || '').trim() };
  if (!x.asunto || !x.titulo || !x.texto.trim()) return { ok: false, error: 'Falta el asunto, el título o el texto.' };
  if (x.boton_url && !/^https:\/\//.test(x.boton_url)) return { ok: false, error: 'El enlace del botón tiene que empezar por https://' };
  if (body.prueba) {
    const r = await enviar(yo.email, C.campana({ ...x, nombre: yo.user_metadata?.nombre, baja: await bajaUrl(yo.email) }));
    return r.ok ? { ok: true, enviados: 1, prueba: yo.email } : r;
  }
  const gente = await audiencia();
  let enviados = 0; const fallos: string[] = [];
  // Resend admite hasta 100 correos por llamada
  for (let i = 0; i < gente.length; i += 100) {
    const lote = await Promise.all(gente.slice(i, i + 100).map(async p => {
      const c = C.campana({ ...x, nombre: p.nombre, baja: await bajaUrl(p.email) });
      return { from: FROM, to: [p.email], subject: c.asunto, html: plantilla(c), text: texto(c), reply_to: env('CORREOS_REPLY_TO', 'info@iberail.com'), headers: { 'List-Unsubscribe': `<${c.baja}>`, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' } };
    }));
    const r = await fetch('https://api.resend.com/emails/batch', { method: 'POST', headers: { Authorization: `Bearer ${env('RESEND_API_KEY')}`, 'Content-Type': 'application/json' }, body: JSON.stringify(lote) });
    if (r.ok) enviados += lote.length; else { const e = await r.json().catch(() => ({})); fallos.push(e?.message || `Resend ${r.status}`); }
  }
  await sb.from('correos_enviados').insert({ clave: `campana:${Date.now()}:${x.asunto.slice(0, 60)}:${enviados}` });
  return { ok: !fallos.length, enviados, total: gente.length, fallos };
}

// ejemplos para ver en el panel cómo queda cada correo
function ejemplo(tipo: string, body: any) {
  const ruta = { id: 0, ref: 'IB-7K2QX9', nombre: 'Alejandro García', salida: 'Madrid', dias: 20, viajeros: 5, paradas: [{ ciudad: 'Dubrovnik' }, { ciudad: 'Split' }, { ciudad: 'Budapest' }, { ciudad: 'Viena' }, { ciudad: 'Praga' }, { ciudad: 'Berlín' }, { ciudad: 'Ámsterdam' }] };
  const salida = isoDia(new Date(Date.now() + 30 * 864e5));
  const m = { nombre: 'Alejandro', grupo: 'Losrecreos', gid: 12 };
  const t: Record<string, () => Correo> = {
    ruta_recibida: () => C.ruta_recibida(ruta), presupuesto: () => C.presupuesto(ruta), grupo: () => C.grupo(m),
    pago_pendiente: () => C.pago_pendiente({ ...m, importe: 1080, pagado: 400, salida }),
    recordatorio: () => C.pago_pendiente({ ...m, importe: 1080, pagado: 400, recordatorio: true, salida }),
    pago_recibido: () => C.pago_recibido({ ...m, cantidad: 400, importe: 1080, pagado: 400 }),
    cuenta_atras: () => C.cuenta_atras({ ...m, salida, n: 30 }),
    campana: () => C.campana({ asunto: body.asunto || 'Asunto', titulo: body.titulo || 'Título de la campaña', texto: body.texto || 'Escribe aquí el texto…', boton_texto: body.boton_texto, boton_url: body.boton_url, nombre: 'Alejandro', baja: '#' })
  };
  const c = (t[tipo] || t.ruta_recibida)();
  return { asunto: c.asunto, html: plantilla(c) };
}

/* ============================ bajas ============================ */
const paginaBaja = (ok: boolean) => new Response(`<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Iberail</title></head>
<body style="margin:0;min-height:100vh;display:grid;place-items:center;background:#F7F2E8;font-family:Helvetica,Arial,sans-serif;color:#1F120E;padding:20px">
<div style="max-width:440px;background:#FFFDF8;border-radius:24px;padding:36px;text-align:center;box-shadow:0 20px 50px -30px rgba(31,18,14,.35)">
<img src="${SITE}/assets/img/logo.png" width="48" height="48" alt="Iberail" style="border-radius:12px">
<h1 style="font-size:26px;margin:18px 0 10px">${ok ? 'Listo, te hemos dado de baja' : 'Este enlace no es válido'}</h1>
<p style="color:#6E5D50;line-height:1.6;margin:0 0 22px">${ok ? 'Ya no te mandaremos correos de novedades. Los avisos de tu viaje (pagos, billetes…) te seguirán llegando.' : 'Escríbenos por WhatsApp y te damos de baja a mano.'}</p>
<a href="${SITE}" style="display:inline-block;background:#F0532F;color:#fff;text-decoration:none;font-weight:700;padding:13px 24px;border-radius:99px">Volver a Iberail</a></div></body></html>`, { status: ok ? 200 : 400, headers: { 'Content-Type': 'text/html; charset=utf-8' } });

async function baja(url: URL) {
  try {
    const email = unb64u(url.searchParams.get('baja') || '').toLowerCase();
    if (!email || (await hmac('baja:' + email)) !== url.searchParams.get('t')) return paginaBaja(false);
    await sb.from('bajas_publicidad').upsert({ email }, { onConflict: 'email', ignoreDuplicates: true });
    return paginaBaja(true);
  } catch { return paginaBaja(false); }
}

/* ============================ entrada ============================ */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  if (url.searchParams.has('baja')) return baja(url);          // clic en «Darme de baja» (GET) o botón del gestor de correo (POST)
  if (req.method !== 'POST') return json({ ok: true, info: 'Correos de Iberail activos.' });
  try {
    const body = await req.json().catch(() => ({}));
    // webhooks de la base de datos y cron: llevan la clave interna
    if (req.headers.get('x-iberail-key')) {
      if (!KEY || req.headers.get('x-iberail-key') !== KEY) return json({ error: 'clave incorrecta' }, 401);
      if (body.action === 'diario') return json({ ok: true, ...(await diario()) });
      return json({ ok: true, resultado: await evento(body) });
    }
    // acciones del panel
    const yo = await esEquipo(req);
    if (!yo) return json({ ok: false, error: 'Solo el equipo de Iberail.' }, 403);
    if (body.action === 'ejemplo') return json({ ok: true, ...ejemplo(String(body.tipo || ''), body) });
    if (body.action === 'audiencia') return json({ ok: true, total: (await audiencia()).length });
    if (body.action === 'campana') return json(await campana(body, yo));
    return json({ ok: false, error: 'Acción desconocida.' }, 400);
  } catch (e) {
    console.error('correos', e);
    return json({ ok: false, error: String((e as Error)?.message || e).slice(0, 300) }, 500);
  }
});
