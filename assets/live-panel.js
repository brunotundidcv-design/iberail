/* Iberail — panel: pestaña «En directo»
   Quién está ahora en la web (presencia), últimas visitas, páginas más vistas hoy
   y la actividad de los clientes con cuenta (con filtro por cliente). Datos de assets/live.js. */
(function(){
  const IB = window.IB, root = document.getElementById('livView');
  if(!IB || !root) return;
  const esc = IB.esc;
  const $ = s => root.querySelector(s);
  let ready = false, now = [], visitas = [], hoy = [], act = [], clientes = {}, filtro = '', err = '', tick = null;

  const ago = iso => {
    const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
    if(s < 45) return 'ahora mismo';
    if(s < 3600) return `hace ${Math.max(1, Math.round(s / 60))} min`;
    if(s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    if(s < 86400 * 7) return `hace ${Math.floor(s / 86400)} d`;
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };
  const dur = t => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? 'acaba de entrar' : m < 60 ? `lleva ${m} min` : `lleva ${Math.floor(m / 60)} h ${m % 60} min`; };
  const who = uid => { const c = clientes[uid]; return c ? (c.nombre || String(c.email || '').split('@')[0]) : 'Cliente'; };
  const ICON = { pagina: '👀', alojamiento: '🏠', fotos: '📸', pago_iniciado: '💳', pago_parte: '💶', pago_ok: '✅', pago_cancelado: '↩️', aviso_leido: '🔔', mapa: '🗺️', documento: '🎫', whatsapp: '💬', contrato_abierto: '📄', contrato_firmado: '✍️', contrato_descargado: '📥' };
  const frase = a => {
    const d = a.detalle || {};
    switch(a.tipo){
      case 'pagina': return `Entró en <b>${esc(a.pagina || '—')}</b>`;
      case 'alojamiento': return `Abrió el alojamiento de <b>${esc(d.ciudad || '—')}</b>`;
      case 'fotos': return `Vio <b>${esc(d.vistas)} de ${esc(d.total)}</b> fotos de ${esc(d.ciudad || 'un alojamiento')}`;
      case 'pago_iniciado': return `Pulsó <b>«${esc(d.boton || 'Pagar')}»</b>`;
      case 'pago_parte': return 'Abrió <b>«Pagar una parte»</b>';
      case 'pago_ok': return '<b>Completó un pago con tarjeta</b>';
      case 'pago_cancelado': return 'Canceló el pago en Stripe';
      case 'aviso_leido': return `Marcó como leído <b>«${esc(d.titulo || 'un aviso')}»</b>`;
      case 'mapa': return 'Abrió el <b>mapa de la ruta</b>';
      case 'documento': return `Abrió <b>${esc(d.titulo || 'un documento')}</b>`;
      case 'whatsapp': return 'Pulsó el botón de <b>WhatsApp</b>';
      case 'contrato_abierto': return 'Abrió su <b>contrato</b> para leerlo';
      case 'contrato_firmado': return `<b>Firmó el contrato</b>${d.tipo === 'menor' ? ' (firmado por su padre, madre o tutor)' : ''}`;
      case 'contrato_descargado': return 'Abrió o descargó su <b>contrato firmado</b>';
      default: return esc(a.tipo);
    }
  };

  function paint(){
    const cuentas = now.filter(p => p.c).length;
    const top = Object.entries(hoy.reduce((m, v) => (m[v.pagina] = (m[v.pagina] || 0) + 1, m), {})).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxTop = top.length ? top[0][1] : 1;
    const lista = filtro ? act.filter(a => a.user_id === filtro) : act;
    const ultima = filtro ? lista[0] : null;
    const opts = Object.keys(act.reduce((m, a) => (m[a.user_id] = 1, m), {})).sort((a, b) => who(a).localeCompare(who(b)));
    root.innerHTML = `
      ${err ? `<div class="adm-empty"><b>Falta activar el registro de actividad.</b><span>${esc(err)} · Ejecuta <b>supabase/sql/actividad.sql</b> en Supabase.</span></div>` : ''}
      <div class="lv-stats">
        <div class="lv-stat is-live"><span class="lv-dot"></span><b>${now.length}</b><small>${now.length === 1 ? 'persona en la web ahora' : 'personas en la web ahora'}</small></div>
        <div class="lv-stat"><b>${cuentas}</b><small>con cuenta · ${now.length - cuentas} sin cuenta</small></div>
        <div class="lv-stat"><b>${hoy.length}</b><small>páginas vistas hoy</small></div>
        <div class="lv-stat"><b>${visitas[0] ? esc(ago(visitas[0].created_at)) : '—'}</b><small>última visita</small></div>
      </div>
      <div class="lv-grid">
        <section class="lv-card">
          <h3>🟢 Ahora mismo</h3>
          ${now.length ? `<ul class="lv-now">${now.sort((a, b) => a.t - b.t).map(p => `<li><span class="lv-av${p.c ? ' is-acc' : ''}">${p.c ? esc((p.n || '?').charAt(0).toUpperCase()) : '👤'}</span><div><b>${p.c ? esc(p.n || 'Cliente') : 'Visitante'}</b><small>${esc(p.p)} · ${esc(dur(p.t))}</small></div>${p.c && p.u ? `<button type="button" class="lv-link" data-lv-user="${esc(p.u)}">Ver actividad</button>` : ''}</li>`).join('')}</ul>` : '<p class="lv-empty">No hay nadie en la web en este momento.</p>'}
        </section>
        <section class="lv-card">
          <h3>🕐 Últimas visitas</h3>
          ${visitas.length ? `<ul class="lv-feed">${visitas.slice(0, 25).map(v => `<li><span>${v.con_cuenta ? '👤' : '·'}</span><div>${esc(v.pagina)}<small>${v.con_cuenta ? 'con cuenta' : 'sin cuenta'}</small></div><time>${esc(ago(v.created_at))}</time></li>`).join('')}</ul>` : '<p class="lv-empty">Todavía no hay visitas registradas.</p>'}
        </section>
        <section class="lv-card">
          <h3>📊 Lo más visto hoy</h3>
          ${top.length ? `<ul class="lv-top">${top.map(([p, n]) => `<li><span>${esc(p)}</span><i style="width:${Math.round(n / maxTop * 100)}%"></i><b>${n}</b></li>`).join('')}</ul>` : '<p class="lv-empty">Sin visitas hoy todavía.</p>'}
        </section>
      </div>
      <section class="lv-card lv-act">
        <div class="lv-act-h">
          <h3>👥 Actividad de clientes con cuenta</h3>
          <select id="lvFiltro" aria-label="Filtrar por cliente"><option value="">Todos los clientes</option>${opts.map(u => `<option value="${esc(u)}"${u === filtro ? ' selected' : ''}>${esc(who(u))}</option>`).join('')}</select>
        </div>
        ${ultima ? `<p class="lv-last">Última actividad de <b>${esc(who(filtro))}</b>: ${esc(ago(ultima.created_at))}</p>` : ''}
        ${lista.length ? `<ul class="lv-feed lv-feed--act">${lista.slice(0, 150).map(a => `<li><span>${ICON[a.tipo] || '•'}</span><div>${filtro ? '' : `<b class="lv-who" data-lv-user="${esc(a.user_id)}">${esc(who(a.user_id))}</b> · `}${frase(a)}${a.tipo !== 'pagina' && a.pagina ? `<small>en ${esc(a.pagina)}</small>` : ''}</div><time title="${esc(new Date(a.created_at).toLocaleString('es-ES'))}">${esc(ago(a.created_at))}</time></li>`).join('')}</ul>` : '<p class="lv-empty">Aún no hay actividad de clientes.</p>'}
      </section>`;
  }

  async function load(){
    const desde = new Date(); desde.setHours(0, 0, 0, 0);
    const [v, h, a, c] = await Promise.all([
      IB.sb.from('visitas').select('pagina, con_cuenta, created_at').order('created_at', { ascending: false }).limit(60),
      IB.sb.from('visitas').select('pagina').gte('created_at', desde.toISOString()).limit(5000),
      IB.sb.from('actividad').select('*').order('created_at', { ascending: false }).limit(400),
      IB.sb.rpc('buscar_clientes', { q: '' })
    ]);
    err = (v.error || a.error) ? (v.error || a.error).message : '';
    visitas = v.data || []; hoy = h.data || []; act = a.data || [];
    (c.data || []).forEach(x => clientes[x.id] = x);
  }

  function listen(){
    const pres = IB.sb.channel('iberail-en-directo');
    pres.on('presence', { event: 'sync' }, () => {
      const st = pres.presenceState();
      now = Object.values(st).map(arr => arr[arr.length - 1]).filter(Boolean);
      if(!root.hidden) paint();
    }).subscribe();
    IB.sb.channel('panel-actividad')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'visitas' }, p => { visitas.unshift(p.new); hoy.push(p.new); if(!root.hidden) paint(); })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'actividad' }, p => { act.unshift(p.new); if(!root.hidden) paint(); })
      .subscribe();
  }

  root.addEventListener('change', e => { if(e.target.id === 'lvFiltro'){ filtro = e.target.value; paint(); } });
  root.addEventListener('click', e => { const u = e.target.closest('[data-lv-user]'); if(u){ filtro = u.dataset.lvUser; paint(); root.querySelector('.lv-act').scrollIntoView({ behavior: 'smooth', block: 'start' }); } });

  window.IBLive = {
    async show(){
      if(!ready){ ready = true; root.innerHTML = '<div class="auth-spin"></div>'; await load(); listen(); }
      paint();
      clearInterval(tick); tick = setInterval(() => { if(!root.hidden) paint(); }, 20000);   // refresca los «hace X min»
    }
  };
})();
