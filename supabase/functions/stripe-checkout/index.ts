// @ts-nocheck
// Iberail · pago con tarjeta (Supabase Edge Function)
// El cliente pulsa «Pagar» en «Mis grupos» → aquí se calcula lo que le falta (nunca se fía del navegador),
// se crea una sesión de Stripe Checkout y se le manda a la página de pago de Stripe.
// El pago se apunta en `pagos` cuando Stripe lo confirma (función stripe-webhook).
// Despliegue:  supabase functions deploy stripe-checkout --no-verify-jwt   (la sesión se comprueba aquí dentro)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const env = (k: string, d = '') => Deno.env.get(k) ?? d;
const SITE = env('SITE_URL', 'https://iberail.com').replace(/\/$/, '');
if (!env('STRIPE_SECRET_KEY')) console.error('Falta el secret STRIPE_SECRET_KEY');
const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// la API de Stripe recibe formularios: { a: { b: 1 } } → a[b]=1
function form(o: Record<string, unknown>, pre = '', out = new URLSearchParams()) {
  for (const [k, v] of Object.entries(o)) {
    if (v == null) continue;
    const key = pre ? `${pre}[${k}]` : k;
    if (typeof v === 'object') form(v as Record<string, unknown>, key, out); else out.append(key, String(v));
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: true, info: 'Función de pago de Iberail activa.' });
  // cualquier fallo inesperado vuelve con CORS y un mensaje, para que la web lo pueda enseñar
  try { return await pagar(req); }
  catch (e) { console.error('stripe-checkout', e); return json({ error: 'Error en el servidor de pagos: ' + String((e as Error)?.message || e).slice(0, 200) }, 500); }
});

async function pagar(req: Request) {

  // quién paga: la sesión de su cuenta
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: auth } = jwt ? await sb.auth.getUser(jwt) : { data: null };
  const user = auth?.user;
  if (!user) return json({ error: 'Entra en tu cuenta para pagar.' }, 401);

  let body: any = {};
  try { body = await req.json(); } catch { return json({ error: 'Petición no válida.' }, 400); }
  const gid = Number(body.grupo_id);
  if (!Number.isInteger(gid) || gid <= 0) return json({ error: 'Falta el grupo.' }, 400);

  // lo que le toca y lo que lleva pagado, leído de la base de datos
  const [{ data: m }, { data: g }, { data: pagos }] = await Promise.all([
    sb.from('grupo_miembros').select('importe, pagado').eq('grupo_id', gid).eq('user_id', user.id).maybeSingle(),
    sb.from('grupos').select('nombre').eq('id', gid).maybeSingle(),
    sb.from('pagos').select('importe').eq('grupo_id', gid).eq('user_id', user.id)
  ]);
  if (!m) return json({ error: 'No estás en este grupo.' }, 403);
  const importe = Number(m.importe || 0);
  const pagado = (pagos || []).reduce((a, p) => a + Number(p.importe || 0), 0);
  const falta = m.pagado ? 0 : Math.round((importe - pagado) * 100) / 100;
  if (!(falta > 0)) return json({ error: 'No tienes nada pendiente de pago.' }, 400);

  // se puede pagar todo o una parte (un plazo), nunca más de lo que falta
  let euros = falta;
  if (body.importe != null) {
    const pedido = Math.round(Number(body.importe) * 100) / 100;
    if (!(pedido >= 1)) return json({ error: 'El importe mínimo es 1 €.' }, 400);
    euros = Math.min(pedido, falta);
  }
  const cents = Math.round(euros * 100);
  const grupo = g?.nombre || `Grupo ${gid}`;

  const r = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('STRIPE_SECRET_KEY')}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: form({
      mode: 'payment',
      locale: 'es',
      customer_email: user.email,
      client_reference_id: `${gid}:${user.id}`,
      line_items: { 0: { quantity: 1, price_data: { currency: 'eur', unit_amount: cents, product_data: { name: `Viaje Interrail · ${grupo}`, description: euros < falta ? 'Pago a cuenta de tu parte del viaje' : 'Tu parte del viaje' } } } },
      metadata: { grupo_id: gid, user_id: user.id },
      payment_intent_data: { description: `Iberail · ${grupo}`, metadata: { grupo_id: gid, user_id: user.id } },
      success_url: `${SITE}/grupos.html?pago=ok#grupo-${gid}`,
      cancel_url: `${SITE}/grupos.html?pago=cancelado#grupo-${gid}`
    })
  });
  const s = await r.json().catch(() => ({}));
  if (!r.ok || !s.url) {
    console.error('stripe', r.status, JSON.stringify(s).slice(0, 400));
    return json({ error: 'Stripe no ha aceptado el pago: ' + (s.error?.message || `error ${r.status}`) }, 502);
  }
  return json({ url: s.url });
}
