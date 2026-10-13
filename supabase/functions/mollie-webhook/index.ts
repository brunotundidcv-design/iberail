// @ts-nocheck
// Iberail · confirmación de pagos de Mollie (Supabase Edge Function)
// Mollie avisa aquí cada vez que cambia un pago (solo manda su id: «id=tr_…»). No nos fiamos del aviso: preguntamos a Mollie
// por ese pago con nuestra clave y, si está pagado, lo apuntamos en `pagos` (o en `seguros` si es Iberail Protect).
// El cliente lo ve al momento en «Mis grupos» y el equipo en el panel. Cada pago se apunta una sola vez: su id (tr_…) se
// guarda en la columna única `stripe_session` (se llama así por la pasarela anterior; vale para cualquiera).
// Despliegue:  supabase functions deploy mollie-webhook --no-verify-jwt   (la URL la manda mollie-checkout en cada pago)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const env = (k: string, d = '') => Deno.env.get(k) ?? d;
const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
const ok = (t = 'ok') => new Response(t, { status: 200 });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return ok('Iberail Mollie OK');
  if (!env('MOLLIE_API_KEY')) return new Response('falta MOLLIE_API_KEY', { status: 500 });
  let id = '';
  try { id = String(new URLSearchParams(await req.text()).get('id') || ''); } catch { /* cuerpo raro */ }
  if (!/^tr_[A-Za-z0-9]+$/.test(id)) return ok('ignorado');

  // el estado de verdad, preguntado a Mollie
  const r = await fetch(`https://api.mollie.com/v2/payments/${id}`, { headers: { Authorization: `Bearer ${env('MOLLIE_API_KEY')}` } });
  if (r.status === 404) return ok('desconocido');          // no es nuestro: se responde igual, sin dar pistas
  if (!r.ok) return new Response('mollie no responde', { status: 500 });   // Mollie lo reintenta
  const p = await r.json();
  if (p.status !== 'paid') return ok(p.status || 'pendiente');   // abierto, cancelado, caducado, fallido…

  const gid = Number(p.metadata?.grupo_id), uid = p.metadata?.user_id;
  if (!gid || !uid) return ok('sin datos de grupo');
  const euros = Number(p.amount?.value || 0);
  const fecha = String(p.paidAt || p.createdAt || new Date().toISOString()).slice(0, 10);
  const metodo = ({ creditcard: 'tarjeta', applepay: 'Apple Pay', googlepay: 'Google Pay', bancontact: 'Bancontact', ideal: 'iDEAL', paypal: 'PayPal', banktransfer: 'transferencia', bizum: 'Bizum' } as Record<string, string>)[p.method] || p.method || 'tarjeta';

  // «Iberail Protect»: el seguro va aparte del viaje → se apunta en `seguros`, no en `pagos`
  if (p.metadata?.tipo === 'seguro') {
    const { data: dup } = await sb.from('seguros').select('id').eq('stripe_session', id).maybeSingle();
    if (dup) return ok('ya apuntado');
    const datos = { estado: 'pagado', precio: euros, plan: p.metadata?.plan || 'completo', cancelacion: p.metadata?.cancelacion !== '0', stripe_session: id, pagado_at: new Date().toISOString() };
    const { data: prev } = await sb.from('seguros').select('id, estado, stripe_session').eq('grupo_id', gid).eq('user_id', uid).neq('estado', 'anulado').maybeSingle();
    // ya lo tenía pagado con otro pago: NO se pisa el primero (se perdería el rastro de un cobro). Se avisa al equipo para devolverlo.
    if (prev && ['pagado', 'contratado'].includes(prev.estado) && prev.stripe_session !== id) {
      console.error('seguro pagado dos veces', { grupo: gid, user: uid, primero: prev.stripe_session, segundo: id });
      await sb.from('actividad').insert({ user_id: uid, tipo: 'seguro_duplicado', pagina: 'Mollie', detalle: { grupo_id: gid, sesion: id, importe: euros } }).then(() => {}, () => {});
      return ok('duplicado: revisar el reembolso');
    }
    const { error: e2 } = prev
      ? await sb.from('seguros').update(datos).eq('id', prev.id)
      : await sb.from('seguros').insert({ grupo_id: gid, user_id: uid, ...datos });
    if (e2) { console.error('seguros', e2); return new Response('error al guardar', { status: 500 }); }
    return ok();
  }

  const { error } = await sb.from('pagos').upsert({
    grupo_id: gid, user_id: uid, importe: euros, fecha,
    nota: `Pago con ${metodo} (Mollie)`,
    stripe_session: id
  }, { onConflict: 'stripe_session', ignoreDuplicates: true });
  if (error) { console.error('pagos', error); return new Response('error al guardar', { status: 500 }); }   // Mollie lo reintenta
  try {
    const [{ data: m }, { data: ps }] = await Promise.all([
      sb.from('grupo_miembros').select('importe').eq('grupo_id', gid).eq('user_id', uid).maybeSingle(),
      sb.from('pagos').select('importe').eq('grupo_id', gid).eq('user_id', uid)
    ]);
    const imp = Number(m?.importe || 0), pagado = Math.round((ps || []).reduce((a: number, x: any) => a + Number(x.importe), 0) * 100) / 100;
    if (imp > 0 && pagado > imp + 0.004) {
      console.error('pago de más', { grupo: gid, user: uid, importe: imp, pagado });
      await sb.from('actividad').insert({ user_id: uid, tipo: 'pago_de_mas', pagina: 'Mollie', detalle: { grupo_id: gid, sesion: id, de_mas: Math.round((pagado - imp) * 100) / 100 } });
    }
  } catch (e) { console.error('comprobar pago de más', e); }
  return ok();
});
