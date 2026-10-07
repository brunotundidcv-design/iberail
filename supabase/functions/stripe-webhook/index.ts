// @ts-nocheck
// Iberail · confirmación de pagos de Stripe (Supabase Edge Function)
// Stripe avisa aquí cuando un pago se completa y lo apuntamos en `pagos` (o en `seguros` si es Iberail Protect): el cliente lo ve al momento
// en «Mis grupos» y el equipo en el panel. Cada sesión de Stripe se apunta una sola vez (stripe_session único).
// Despliegue:  supabase functions deploy stripe-webhook --no-verify-jwt
// En Stripe → Desarrolladores → Webhooks: URL https://<proyecto>.supabase.co/functions/v1/stripe-webhook
//   eventos: checkout.session.completed, checkout.session.async_payment_succeeded
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const env = (k: string, d = '') => Deno.env.get(k) ?? d;
const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

// firma de Stripe: cabecera «t=…,v1=…», HMAC-SHA256 de «t.cuerpo» con el secreto whsec_…
async function firmaOk(raw: string, cabecera: string, secreto: string) {
  const partes = Object.fromEntries(cabecera.split(',').map(p => p.split('=')).filter(p => p.length === 2)) as Record<string, string>;
  const firmas = cabecera.split(',').filter(p => p.startsWith('v1=')).map(p => p.slice(3));
  const t = Number(partes.t);
  if (!t || !firmas.length) return false;
  if (Math.abs(Date.now() / 1000 - t) > 300) return false;   // más de 5 minutos: se descarta
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${raw}`)));
  const hex = [...mac].map(b => b.toString(16).padStart(2, '0')).join('');
  // comparación sin atajos para no dar pistas por el tiempo de respuesta
  return firmas.some(f => f.length === hex.length && [...f].reduce((d, c, i) => d | (c.charCodeAt(0) ^ hex.charCodeAt(i)), 0) === 0);
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Iberail Stripe OK', { status: 200 });
  const secreto = env('STRIPE_WEBHOOK_SECRET');
  if (!secreto) return new Response('falta STRIPE_WEBHOOK_SECRET', { status: 500 });
  const raw = await req.text();
  if (!(await firmaOk(raw, req.headers.get('stripe-signature') || '', secreto))) return new Response('bad signature', { status: 400 });

  const ev = JSON.parse(raw);
  if (!['checkout.session.completed', 'checkout.session.async_payment_succeeded'].includes(ev.type)) return new Response('ignorado', { status: 200 });
  const s = ev.data?.object || {};
  if (s.payment_status !== 'paid') return new Response('pendiente', { status: 200 });   // p. ej. transferencia aún sin llegar

  const gid = Number(s.metadata?.grupo_id), uid = s.metadata?.user_id;
  if (!gid || !uid) return new Response('sin datos de grupo', { status: 200 });

  // «Iberail Protect»: el seguro va aparte del viaje → se apunta en `seguros`, no en `pagos`
  if (s.metadata?.tipo === 'seguro') {
    const { data: dup } = await sb.from('seguros').select('id').eq('stripe_session', s.id).maybeSingle();
    if (dup) return new Response('ya apuntado', { status: 200 });
    const datos = { estado: 'pagado', precio: Number(s.amount_total) / 100, plan: s.metadata?.plan || 'completo', cancelacion: s.metadata?.cancelacion !== '0', stripe_session: s.id, pagado_at: new Date().toISOString() };
    const { data: prev } = await sb.from('seguros').select('id, estado, stripe_session').eq('grupo_id', gid).eq('user_id', uid).neq('estado', 'anulado').maybeSingle();
    // ya lo tenía pagado con otro pago: NO se pisa el primero (se perdería el rastro de un cobro). Se avisa al equipo para devolverlo.
    if (prev && ['pagado', 'contratado'].includes(prev.estado) && prev.stripe_session !== s.id) {
      console.error('seguro pagado dos veces', { grupo: gid, user: uid, primero: prev.stripe_session, segundo: s.id });
      await sb.from('actividad').insert({ user_id: uid, tipo: 'seguro_duplicado', pagina: 'Stripe', detalle: { grupo_id: gid, sesion: s.id, importe: Number(s.amount_total) / 100 } }).then(() => {}, () => {});
      return new Response('duplicado: revisar el reembolso', { status: 200 });
    }
    const { error: e2 } = prev
      ? await sb.from('seguros').update(datos).eq('id', prev.id)
      : await sb.from('seguros').insert({ grupo_id: gid, user_id: uid, ...datos });
    if (e2) { console.error('seguros', e2); return new Response('error al guardar', { status: 500 }); }
    return new Response('ok', { status: 200 });
  }
  const { error } = await sb.from('pagos').upsert({
    grupo_id: gid,
    user_id: uid,
    importe: Number(s.amount_total) / 100,
    fecha: new Date((s.created || ev.created) * 1000).toISOString().slice(0, 10),
    nota: 'Pago con tarjeta (Stripe)',
    stripe_session: s.id
  }, { onConflict: 'stripe_session', ignoreDuplicates: true });
  if (error) { console.error('pagos', error); return new Response('error al guardar', { status: 500 }); }   // Stripe lo reintenta
  try {
    const [{ data: m }, { data: ps }] = await Promise.all([
      sb.from('grupo_miembros').select('importe').eq('grupo_id', gid).eq('user_id', uid).maybeSingle(),
      sb.from('pagos').select('importe').eq('grupo_id', gid).eq('user_id', uid)
    ]);
    const imp = Number(m?.importe || 0), pagado = Math.round((ps || []).reduce((a: number, p: any) => a + Number(p.importe), 0) * 100) / 100;
    if (imp > 0 && pagado > imp + 0.004) {
      console.error('pago de más', { grupo: gid, user: uid, importe: imp, pagado });
      await sb.from('actividad').insert({ user_id: uid, tipo: 'pago_de_mas', pagina: 'Stripe', detalle: { grupo_id: gid, sesion: s.id, de_mas: Math.round((pagado - imp) * 100) / 100 } });
    }
  } catch (e) { console.error('comprobar pago de más', e); }
  return new Response('ok', { status: 200 });
});
