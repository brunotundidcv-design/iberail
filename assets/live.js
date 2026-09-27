/* Iberail — actividad en la web para la pestaña «En directo» del panel
   · Todos: presencia en tiempo real (en qué página está cada visitante ahora) y una visita apuntada por página,
     sin cookies ni identificadores guardados en el navegador (el id de presencia vive solo mientras la página está abierta).
   · Con cuenta: además se apunta lo que hacen (páginas, alojamientos, fotos, pagos, avisos, documentos…) en `actividad`.
   El equipo no se cuenta. Ver supabase/sql/actividad.sql y assets/live-panel.js. */
(function(){
  const C = window.IBERAIL_CONFIG || {};
  if(!C.SUPABASE_URL || !C.SUPABASE_ANON_KEY || /panel\.html$/.test(location.pathname)) return;
  const SUPA = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  const PAGES = { '': 'Portada', index: 'Portada', paises: 'Destinos', split: 'Split · Ultra', rutas: 'Planificador', contacto: 'Contacto',
    cuenta: 'Mi cuenta', grupos: 'Mis grupos', 'aviso-legal': 'Aviso legal', 'politica-privacidad': 'Privacidad', 'politica-cookies': 'Cookies', '404': 'Página no encontrada' };
  const TABS = { rutas: 'Mis rutas', grupos: 'Mis grupos', avisos: 'Avisos', invita: 'Invita y gana' };
  const file = (location.pathname.split('/').pop() || '').replace(/\.html$/, '');
  const page = () => { const base = PAGES[file] || file || 'Portada'; const h = location.hash.slice(1); return file === 'cuenta' && TABS[h] ? `Mi cuenta · ${TABS[h]}` : base; };
  const pago = window.__ibPago || new URLSearchParams(location.search).get('pago');   // payment.js limpia la URL al cargar
  let sb = null, user = null, chan = null, since = Date.now(), last = {};

  const loadLib = () => new Promise(res => {
    if(window.supabase && window.supabase.createClient) return res();
    const s = document.createElement('script'); s.src = SUPA; s.async = true; s.onload = res; s.onerror = res; document.head.appendChild(s);
  });

  async function start(){
    if(window.IB && window.IB.sb) sb = window.IB.sb;
    else {
      await loadLib();
      if(!window.supabase || !window.supabase.createClient) return;
      sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } });
    }
    try{ const { data } = await sb.auth.getSession(); user = data && data.session ? data.session.user : null; }catch(e){ user = null; }
    if(user){
      // el equipo navegando no cuenta como visita
      try{ const { data: adm } = await sb.rpc('is_admin'); if(adm) return; }catch(e){}
    }
    sb.from('visitas').insert({ pagina: page(), con_cuenta: !!user }).then(() => {}, () => {});
    log('pagina');

    const key = (crypto.randomUUID ? crypto.randomUUID() : String(Math.random()).slice(2));
    chan = sb.channel('iberail-en-directo', { config: { presence: { key } } });
    chan.subscribe(st => { if(st === 'SUBSCRIBED') track(); });
    addEventListener('hashchange', () => { track(); log('pagina'); });
    document.addEventListener('visibilitychange', () => { if(document.visibilityState === 'visible') track(); });
    if(pago === 'ok') log('pago_ok'); else if(pago === 'cancelado') log('pago_cancelado');
  }
  function track(){
    if(!chan) return;
    const nombre = user ? String((user.user_metadata || {}).nombre || user.email.split('@')[0]).split(' ')[0] : '';
    chan.track({ p: page(), t: since, c: !!user, n: nombre, u: user ? user.id : null }).catch(() => {});
  }
  // solo con cuenta: cada acción una vez cada pocos segundos (evita duplicados por doble clic)
  function log(tipo, detalle){
    if(!sb || !user) return;
    const k = tipo + JSON.stringify(detalle || {});
    if(last[k] && Date.now() - last[k] < 5000) return;
    last[k] = Date.now();
    sb.from('actividad').insert({ tipo, pagina: page(), detalle: detalle || {} }).then(() => {}, () => {});
  }

  const txt = el => (el && el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120);
  document.addEventListener('click', e => {
    const t = e.target;
    const al = t.closest('[data-al-open]'); if(al) return log('alojamiento', { ciudad: txt(al.querySelector('.al-city')) });
    const pay = t.closest('[data-stripe-group]'); if(pay) return log('pago_iniciado', { boton: txt(pay) });
    const part = t.closest('[data-pay-part]'); if(part) return log('pago_parte');
    const ok = t.closest('[data-ok]'); if(ok){ const art = ok.closest('[data-aviso], .dash-alert'); return log('aviso_leido', { titulo: txt(art && art.querySelector('h4, b')) }); }
    const map = t.closest('[data-gm-open]'); if(map) return log('mapa');
    const doc = t.closest('.tk-open'); if(doc) return log('documento', { titulo: txt(doc) });
    const wa = t.closest('a[href*="wa.me"], a[href*="w.app"]'); if(wa) return log('whatsapp');
    const tab = t.closest('#dashTabs [data-t]'); if(tab) return; // ya se apunta con el cambio de pestaña
  }, true);
  // fotos vistas en la galería de un alojamiento (lo avisa alojamientos.js al cerrarla)
  addEventListener('ib:aloj-fotos', e => { const d = e.detail || {}; if(d.total) log('fotos', { ciudad: d.ciudad, vistas: d.vistas, total: d.total }); });

  // se arranca cuando la página ya ha cargado, para no retrasarla
  const go = () => setTimeout(start, 1200);
  if(document.readyState === 'complete') go(); else addEventListener('load', go);
})();
