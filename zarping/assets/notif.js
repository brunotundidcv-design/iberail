/* Iberail — campana de notificaciones (solo con la sesión iniciada, en todas las páginas)
   Cliente: avisos, billetes y documentos nuevos, pagos apuntados, rutas preparadas y grupos.
   Equipo: solicitudes nuevas y quién ha leído cada aviso. */
(function(){
  const IB = window.IB, C = window.IBERAIL_CONFIG || {};
  const btn = document.querySelector('[data-bell]');
  if(!IB || !btn || !IB.configured) return;
  const SUPA = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  const esc = IB.esc;
  const plural = (n, a, b) => n === 1 ? a : b;
  const eur = n => { const [i, d] = Math.abs(Number(n) || 0).toFixed(2).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d + ' €'; };
  const ago = iso => {
    const s = (Date.now() - new Date(iso)) / 1000;
    if(s < 60) return 'ahora';
    if(s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if(s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    if(s < 86400 * 7) return `hace ${Math.floor(s / 86400)} d`;
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };
  const code = s => { const m = String(s || '').match(/\(([A-Za-z]{3})\)/); return m ? m[1].toUpperCase() : String(s || '').slice(0, 3).toUpperCase(); };
  const IC = {
    aviso: '<svg viewBox="0 0 24 24"><path d="M6 8a6 6 0 0112 0c0 5 2 6 2 7H4c0-1 2-2 2-7z"/><path d="M10 19a2 2 0 004 0"/></svg>',
    vuelo: '<svg viewBox="0 0 24 24"><path d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 00-3 0V8.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z"/></svg>',
    doc: '<svg viewBox="0 0 24 24"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>',
    pago: '<svg viewBox="0 0 24 24"><path d="M18 7a6.5 6.5 0 100 10"/><path d="M4 10.5h9M4 13.5h9"/></svg>',
    ruta: '<svg viewBox="0 0 24 24"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 000-6H9a3 3 0 010-6h6.5"/></svg>',
    grupo: '<svg viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.6a3.5 3.5 0 010 6.8M18 14.2a6.5 6.5 0 013.5 5.8"/></svg>',
    leido: '<svg viewBox="0 0 24 24"><path d="M2 12l5 5L18 6M12 16l1 1L22 8"/></svg>',
    ok: '<svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg>',
    x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };

  let user = null, admin = false, items = [], filter = 'all', chan = null, loadT = null, lastUnread = -1, openState = false, ready = false;
  const seenKey = () => 'ib-bell-seen-' + (user ? user.id : '');
  const getSeen = () => { try{ return Number(localStorage.getItem(seenKey())) || (Date.now() - 7 * 864e5); }catch(e){ return Date.now() - 7 * 864e5; } };
  const setSeen = t => { try{ localStorage.setItem(seenKey(), String(t)); }catch(e){} };

  /* ---------- conexión: solo se carga la librería si hay sesión guardada ---------- */
  function ensureClient(){
    if(IB.sb) return Promise.resolve(IB.sb);
    return new Promise(res => {
      const go = () => { try{ IB.sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true } }); }catch(e){ IB.sb = null; } res(IB.sb); };
      if(window.supabase && window.supabase.createClient) return go();
      const s = document.createElement('script'); s.src = SUPA; s.async = true; s.onload = go; s.onerror = () => res(null);
      document.head.appendChild(s);
    });
  }
  const safe = async q => { try{ const r = await q; return r && !r.error ? r : { data: [], error: (r && r.error) || true }; }catch(e){ return { data: [], error: e }; } };

  /* ---------- datos ---------- */
  async function loadClient(){
    const sb = IB.sb, uid = user.id;
    const mem = await safe(sb.from('grupo_miembros').select('*').eq('user_id', uid));
    const gids = (mem.data || []).map(m => m.grupo_id);
    const [own, grp, gr, av, rd, pg] = await Promise.all([
      safe(sb.from('rutas').select('id,ref,salida,paradas,created_at,creada_por_equipo,grupo_id,estado').eq('user_id', uid)),
      gids.length ? safe(sb.from('rutas').select('id,ref,salida,paradas,created_at,creada_por_equipo,grupo_id,estado').in('grupo_id', gids)) : { data: [] },
      gids.length ? safe(sb.from('grupos').select('id,nombre').in('id', gids)) : { data: [] },
      safe(sb.from('avisos').select('*').order('created_at', { ascending: false }).limit(30)),
      safe(sb.from('avisos_leidos').select('aviso_id').eq('user_id', uid)),
      gids.length ? safe(sb.from('pagos').select('*').eq('user_id', uid)) : { data: [] }
    ]);
    const routes = (own.data || []).concat((grp.data || []).filter(r => !(own.data || []).some(o => o.id === r.id)));
    const gname = id => ((gr.data || []).find(g => String(g.id) === String(id)) || {}).nombre || '';
    const rids = routes.map(r => r.id);
    const [dr, dg] = await Promise.all([
      rids.length ? safe(sb.from('documentos').select('id,created_at,ruta_id,grupo_id,tipo,titulo,origen,destino').in('ruta_id', rids)) : { data: [] },
      gids.length ? safe(sb.from('documentos').select('id,created_at,ruta_id,grupo_id,tipo,titulo,origen,destino').in('grupo_id', gids)) : { data: [] }
    ]);
    const read = new Set((rd.data || []).map(x => String(x.aviso_id)));
    const RUTA = IB.brand.ruta === 'ruta', TU = RUTA ? 'Tu ruta' : 'Tu viaje';
    const out = [];
    const routeById = id => routes.find(r => String(r.id) === String(id));
    const inGroup = r => r && r.grupo_id;
    (av.data || []).forEach(a => {
      const mine = a.user_id && !a.grupo_id && !a.ruta_id;
      const from = a.para_todos ? IB.brand.nombre : mine ? 'Invita y gana' : a.grupo_id ? `Grupo «${gname(a.grupo_id)}»` : TU;
      out.push({ k: 'aviso', id: 'a' + a.id, aid: a.id, t: a.created_at, imp: a.importante, unread: !read.has(String(a.id)), title: a.titulo, sub: (a.importante ? 'Importante · ' : '') + from, href: mine ? 'cuenta.html#invita' : 'cuenta.html#avisos' });
    });
    (dr.data || []).concat(dg.data || []).forEach(d => {
      const r = d.ruta_id ? routeById(d.ruta_id) : null, grp = d.grupo_id || inGroup(r);
      out.push({ k: d.tipo === 'vuelo' ? 'vuelo' : 'doc', id: 'd' + d.id, t: d.created_at,
        title: d.tipo === 'vuelo' ? `Nuevo billete: ${code(d.origen)} → ${code(d.destino)}` : `Nuevo documento: ${d.titulo || 'documento'}`,
        sub: grp ? `Grupo «${gname(d.grupo_id || r.grupo_id)}»` : TU, href: grp ? 'grupos.html' : 'cuenta.html#rutas' });
    });
    (pg.data || []).forEach(p => out.push({ k: 'pago', id: 'p' + p.id, t: p.created_at, title: `Pago apuntado: ${eur(p.importe)}`, sub: `Grupo «${gname(p.grupo_id)}»${p.nota ? ' · ' + p.nota : ''}`, href: 'grupos.html' }));
    routes.filter(r => r.creada_por_equipo).forEach(r => out.push({ k: 'ruta', id: 'r' + r.id, t: r.created_at,
      title: r.grupo_id ? (RUTA ? 'La ruta de tu grupo está lista' : 'El viaje de tu grupo está listo') : (RUTA ? 'Te hemos preparado tu ruta' : 'Te hemos preparado tu viaje'),
      sub: [r.salida].concat((r.paradas || []).map(p => p.ciudad)).join(' → '), href: r.grupo_id ? 'grupos.html' : 'cuenta.html#rutas' }));
    (mem.data || []).forEach(m => out.push({ k: 'grupo', id: 'g' + m.grupo_id, t: m.added_at, title: `Ya estás en el grupo «${gname(m.grupo_id)}»`, sub: RUTA ? 'Aquí verás la ruta, los billetes y los avisos' : 'Aquí verás el plan, los billetes y los avisos', href: 'grupos.html' }));
    return out;
  }
  let names = null;
  async function loadAdmin(){
    const sb = IB.sb;
    const [rs, rd, av] = await Promise.all([
      safe(sb.from('rutas').select('id,ref,nombre,salida,paradas,created_at,creada_por_equipo').eq('creada_por_equipo', false).order('created_at', { ascending: false }).limit(25)),
      safe(sb.from('avisos_leidos').select('*').order('leido_at', { ascending: false }).limit(40)),
      safe(sb.from('avisos').select('id,titulo'))
    ]);
    if(!names && (rd.data || []).length){
      const cl = await safe(sb.rpc('buscar_clientes', { q: '' }));
      names = {}; (cl.data || []).forEach(c => names[c.id] = c.nombre || String(c.email || '').split('@')[0]);
    }
    const out = [];
    (rs.data || []).forEach(r => out.push({ k: 'ruta', id: 'r' + r.id, t: r.created_at, title: `Nueva solicitud · ${r.nombre}`, sub: `${r.ref} · ${[r.salida].concat((r.paradas || []).map(p => p.ciudad)).join(' → ')}`, href: 'panel.html' }));
    const tit = {}; (av.data || []).forEach(a => tit[a.id] = a.titulo);
    (rd.data || []).forEach(x => { if(tit[x.aviso_id] == null) return; out.push({ k: 'leido', id: 'l' + x.aviso_id + x.user_id, t: x.leido_at, title: `${(names && names[x.user_id]) || 'Un cliente'} ha leído tu aviso`, sub: `«${tit[x.aviso_id]}»`, href: 'panel.html' }); });
    return out;
  }
  async function load(){
    if(!user || !IB.sb) return;
    const list = admin ? await loadAdmin() : await loadClient();
    const seen = getSeen();
    items = list.filter(x => x.t).map(x => ({ ...x, unread: x.k === 'aviso' ? x.unread : new Date(x.t).getTime() > seen }))
      .sort((a, b) => new Date(b.t) - new Date(a.t)).slice(0, 30);
    ready = true;
    paintBadge(); if(openState) paint();
    subscribe();
  }
  const queue = () => { clearTimeout(loadT); loadT = setTimeout(load, 600); };

  /* ---------- tiempo real ---------- */
  async function subscribe(){
    if(chan || !IB.sb || !user) return;
    // solo se escucha lo que existe en la base de datos (archivos 6 y 7)
    const has = async t => !(await safe(IB.sb.from(t).select('*').limit(1))).error;
    const [v6, v7] = await Promise.all([has('documentos'), has('avisos')]);
    chan = IB.sb.channel('ib-bell');
    if(admin){
      chan = chan.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'rutas' }, queue);
      if(v7) chan = chan.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'avisos_leidos' }, queue);
    } else {
      chan = chan.on('postgres_changes', { event: '*', schema: 'public', table: 'rutas' }, queue);
      if(v6) chan = chan.on('postgres_changes', { event: '*', schema: 'public', table: 'documentos' }, queue)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'grupo_miembros', filter: `user_id=eq.${user.id}` }, queue);
      if(v7) chan = chan.on('postgres_changes', { event: '*', schema: 'public', table: 'avisos' }, queue)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos', filter: `user_id=eq.${user.id}` }, queue);
    }
    chan.subscribe();
  }

  /* ---------- pintar ---------- */
  const unreadCount = () => items.filter(x => x.unread).length;
  function paintBadge(){
    const n = unreadCount(), b = btn.querySelector('.bell-n');
    b.hidden = !n; b.textContent = n > 9 ? '9+' : n;
    btn.setAttribute('aria-label', n ? `Notificaciones: ${n} sin leer` : 'Notificaciones');
    btn.classList.toggle('has-new', !!n);
    if(lastUnread > -1 && n > lastUnread){ btn.classList.remove('is-ring'); void btn.offsetWidth; btn.classList.add('is-ring'); }
    lastUnread = n;
  }
  let pop = null;
  function build(){
    pop = document.createElement('div');
    pop.className = 'bell-pop'; pop.id = 'bellPop';
    pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', 'Notificaciones');
    btn.setAttribute('aria-controls', 'bellPop');
    document.body.appendChild(pop);
    pop.addEventListener('click', async e => {
      const t = e.target;
      if(t.closest('[data-bell-close]')) return toggle(false);
      const f = t.closest('[data-bf]'); if(f){ filter = f.dataset.bf; paint(); return; }
      if(t.closest('[data-bell-all]')) return markAll();
      const it = t.closest('[data-bi]');
      if(it){ const x = items.find(y => y.id === it.dataset.bi); if(x && x.k !== 'aviso'){ x.unread = false; paintBadge(); } }
    });
  }
  function paint(){
    if(!pop) build();
    const n = unreadCount();
    const list = filter === 'new' ? items.filter(x => x.unread) : items;
    pop.innerHTML = `
      <div class="bell-h">
        <div><b>Notificaciones</b><small>${n ? `${n} sin leer` : 'Estás al día'}</small></div>
        <button type="button" class="bell-x" data-bell-close aria-label="Cerrar">${IC.x}</button>
      </div>
      <div class="bell-bar">
        <div class="bell-f" role="tablist"><button type="button" role="tab" data-bf="all" aria-selected="${filter === 'all'}">Todas</button><button type="button" role="tab" data-bf="new" aria-selected="${filter === 'new'}">Sin leer${n ? ` <i>${n}</i>` : ''}</button></div>
        ${n ? '<button type="button" class="bell-all" data-bell-all>Marcar todo como leído</button>' : ''}
      </div>
      <div class="bell-list">${!ready ? '<div class="bell-load"><i></i><i></i><i></i></div>' : list.length ? list.map(x => `
        <a class="bell-it${x.unread ? ' is-new' : ''}${x.imp && x.unread ? ' is-imp' : ''}" href="${esc(x.href)}" data-bi="${esc(x.id)}">
          <span class="bell-ic k-${x.k}">${IC[x.k] || IC.aviso}</span>
          <span class="bell-tx"><b>${esc(x.title)}</b><small>${esc(x.sub || '')}</small></span>
          <time datetime="${esc(x.t)}">${esc(ago(x.t))}</time>
        </a>`).join('') : `<div class="bell-empty"><span>${IC.ok}</span><b>${filter === 'new' ? 'No tienes nada sin leer' : 'Todavía no hay nada por aquí'}</b><small>${admin ? 'Aquí verás las solicitudes nuevas y quién lee tus avisos.' : 'Cuando te subamos billetes, publiquemos un aviso o apuntemos un pago, te saldrá aquí.'}</small></div>`}</div>
      <a class="bell-foot" href="${admin ? 'panel.html' : 'grupos.html'}">${admin ? 'Ir al panel' : 'Ver mis grupos'}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>`;
    place();
  }
  function place(){
    if(!pop) return;
    const r = btn.getBoundingClientRect();
    pop.style.top = Math.round(r.bottom + 10) + 'px';
    if(innerWidth > 560) pop.style.right = Math.max(12, Math.round(innerWidth - r.right - 8)) + 'px'; else pop.style.right = '';
  }
  async function markAll(){
    setSeen(Date.now());
    const pend = items.filter(x => x.k === 'aviso' && x.unread);
    items.forEach(x => x.unread = false);
    paintBadge(); paint();
    if(pend.length && !admin){
      for(const x of pend){ try{ await IB.sb.from('avisos_leidos').insert({ aviso_id: Number(x.aid), user_id: user.id }); }catch(e){} }
      document.dispatchEvent(new CustomEvent('ib:avisos-leidos'));
    }
  }
  function toggle(open){
    openState = open == null ? !openState : open;
    btn.setAttribute('aria-expanded', String(openState));
    if(openState){ paint(); requestAnimationFrame(() => pop.classList.add('is-open')); document.body.classList.add('bell-open'); }
    else if(pop){ pop.classList.remove('is-open'); document.body.classList.remove('bell-open'); }
  }
  btn.addEventListener('click', e => { e.stopPropagation(); toggle(); });
  document.addEventListener('click', e => { if(!openState || !pop) return; const path = e.composedPath ? e.composedPath() : []; if(path.includes(pop) || path.includes(btn) || pop.contains(e.target)) return; toggle(false); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && openState){ toggle(false); btn.focus(); } });
  addEventListener('resize', () => { if(openState) place(); });
  // la cuenta avisa cuando el cliente marca un aviso como «Entendido»
  document.addEventListener('ib:aviso-leido', queue);

  /* ---------- arranque ---------- */
  (async function(){
    btn.hidden = true;
    if(!IB.storedUser()) return;
    const sb = await ensureClient(); if(!sb) return;
    try{ const { data } = await sb.auth.getSession(); user = data && data.session ? data.session.user : null; }catch(e){ user = null; }
    if(!user) return;
    if(IB.claimRef) IB.claimRef(user);   // «Invita y gana» en páginas que cargan Supabase más tarde
    btn.hidden = false;
    try{ const { data } = await sb.rpc('is_admin'); admin = !!data; }catch(e){ admin = false; }
    load();
    sb.auth.onAuthStateChange((ev, sess) => { if(ev === 'SIGNED_OUT' || !sess){ user = null; items = []; btn.hidden = true; toggle(false); if(chan){ sb.removeChannel(chan); chan = null; } } });
  })();
})();
