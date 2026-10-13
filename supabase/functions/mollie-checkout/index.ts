// @ts-nocheck
// Iberail / Zarping · pago con Mollie (Supabase Edge Function)
// El cliente pulsa «Pagar» en «Mis grupos» → aquí se calcula lo que le falta (nunca se fía del navegador),
// se crea el pago en Mollie y se le manda a la página de pago de Mollie (tarjeta y los métodos activados en el Dashboard).
// El pago se apunta en `pagos` cuando Mollie lo confirma (función mollie-webhook).
// Secretos: MOLLIE_API_KEY (test_… para probar, live_… en real), SITE_URL y ZARPING_URL opcionales.
// Despliegue:  supabase functions deploy mollie-checkout --no-verify-jwt   (la sesión se comprueba aquí dentro)
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const env = (k: string, d = '') => Deno.env.get(k) ?? d;
const SITE = env('SITE_URL', 'https://iberail.com').replace(/\/$/, '');
const WEBHOOK = `${env('SUPABASE_URL').replace(/\/$/, '')}/functions/v1/mollie-webhook`;
// Zarping (segunda marca, misma titular): los grupos con grupos.marca = 'zarping' pagan con su nombre y vuelven a su web
const MARCAS: Record<string, { nombre: string; site: string; viaje: string }> = {
  iberail: { nombre: 'Iberail', site: SITE, viaje: 'Viaje Interrail' },
  zarping: { nombre: 'Zarping', site: env('ZARPING_URL', 'https://zarping.com').replace(/\/$/, ''), viaje: 'Viaje' }
};
if (!env('MOLLIE_API_KEY')) console.error('Falta el secret MOLLIE_API_KEY');
const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });
// grupos.marca solo existe tras supabase/sql/marca.sql: si aún no está, se lee sin ella (= Iberail)
async function grupoDe(gid: number) {
  let { data, error } = await sb.from('grupos').select('nombre, marca').eq('id', gid).maybeSingle();
  if (error) ({ data } = await sb.from('grupos').select('nombre').eq('id', gid).maybeSingle());
  return { data, M: MARCAS[(data as any)?.marca] || MARCAS.iberail };
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

// crea el pago en Mollie y devuelve la URL de su página de pago
async function crearPago(p: { euros: number; descripcion: string; vuelta: string; cancelado: string; email?: string; metadata: Record<string, unknown> }) {
  const r = await fetch('https://api.mollie.com/v2/payments', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env('MOLLIE_API_KEY')}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      amount: { currency: 'EUR', value: p.euros.toFixed(2) },
      description: p.descripcion.slice(0, 255),
      redirectUrl: p.vuelta,
      cancelUrl: p.cancelado,
      webhookUrl: WEBHOOK,
      locale: 'es_ES',
      metadata: p.metadata
    })
  });
  const s = await r.json().catch(() => ({}));
  const url = s?._links?.checkout?.href;
  if (!r.ok || !url) {
    console.error('mollie', r.status, JSON.stringify(s).slice(0, 400));
    return json({ error: 'Mollie no ha aceptado el pago: ' + (s.detail || s.title || `error ${r.status}`) }, 502);
  }
  return json({ url });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: true, info: 'Función de pago de Iberail (Mollie) activa.' });
  // cualquier fallo inesperado vuelve con CORS y un mensaje, para que la web lo pueda enseñar
  try { return await pagar(req); }
  catch (e) { console.error('mollie-checkout', e); return json({ error: 'Error en el servidor de pagos: ' + String((e as Error)?.message || e).slice(0, 200) }, 500); }
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
  if (body.seguro) return pagarSeguro(user, gid);

  // lo que le toca y lo que lleva pagado, leído de la base de datos
  const [{ data: m }, gm, { data: pagos }] = await Promise.all([
    sb.from('grupo_miembros').select('importe, pagado').eq('grupo_id', gid).eq('user_id', user.id).maybeSingle(),
    grupoDe(gid),
    sb.from('pagos').select('importe').eq('grupo_id', gid).eq('user_id', user.id)
  ]);
  const g: any = gm.data, M = gm.M;
  if (!m) return json({ error: 'No estás en este grupo.' }, 403);
  const importe = Number(m.importe || 0);
  const pagado = (pagos || []).reduce((a, p) => a + Number(p.importe || 0), 0);
  const falta = m.pagado ? 0 : Math.round((importe - pagado) * 100) / 100;
  if (!(falta > 0)) return json({ error: 'No tienes nada pendiente de pago.' }, 400);

  // se puede pagar todo o una parte (un plazo), nunca más de lo que falta
  let euros = falta;
  if (body.importe != null) {
    const pedido = Math.round(Number(body.importe) * 100) / 100;
    // pago a cuenta: mínimo 20 € (cada pago tiene una comisión fija), salvo que sea lo último que queda
    if (!(pedido >= Math.min(20, falta))) return json({ error: 'El pago mínimo es de 20 €.' }, 400);
    euros = Math.min(pedido, falta);
  }
  const grupo = g?.nombre || `Grupo ${gid}`;
  return crearPago({
    euros,
    descripcion: `${M.nombre} · ${M.viaje} · ${grupo}${euros < falta ? ' (pago a cuenta)' : ''}`,
    vuelta: `${M.site}/grupos.html?pago=ok#grupo-${gid}`,
    cancelado: `${M.site}/grupos.html?pago=cancelado#grupo-${gid}`,
    metadata: { grupo_id: gid, user_id: user.id }
  });
}

// «Iberail Protect»: el seguro se paga aparte del viaje (no toca grupo_miembros.importe ni la tabla pagos).
// El precio sale de seguro_ofertas; el webhook lo apunta en `seguros` como pagado.
async function pagarSeguro(user: any, gid: number) {
  const [{ data: m }, gm, { data: o }, { data: ya }] = await Promise.all([
    sb.from('grupo_miembros').select('user_id').eq('grupo_id', gid).eq('user_id', user.id).maybeSingle(),
    grupoDe(gid),
    sb.from('seguro_ofertas').select('*').eq('grupo_id', gid).maybeSingle(),
    sb.from('seguros').select('estado').eq('grupo_id', gid).eq('user_id', user.id).in('estado', ['pagado', 'contratado'])
  ]);
  const g: any = gm.data, M = gm.M;
  if (!m) return json({ error: 'No estás en este grupo.' }, 403);
  if (!o || !o.activo) return json({ error: 'El seguro no está disponible para este grupo.' }, 400);
  if (o.limite && new Date().toISOString().slice(0, 10) > o.limite) return json({ error: 'El plazo para contratar el seguro ya ha terminado.' }, 400);
  if ((ya || []).length) return json({ error: 'Ya tienes el seguro contratado.' }, 400);
  const euros = Math.round(Number(o.precio) * 100) / 100;
  if (!(euros > 0)) return json({ error: 'El seguro no tiene precio.' }, 400);
  const grupo = g?.nombre || `Grupo ${gid}`;
  return crearPago({
    euros,
    descripcion: `${M.nombre} Protect · seguro de viaje · ${grupo}`,
    vuelta: `${M.site}/grupos.html?seguro=ok#grupo-${gid}`,
    cancelado: `${M.site}/grupos.html?seguro=cancelado#grupo-${gid}`,
    metadata: { tipo: 'seguro', grupo_id: gid, user_id: user.id, plan: o.plan, cancelacion: o.cancelacion ? '1' : '0' }
  });
}
