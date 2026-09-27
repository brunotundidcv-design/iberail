/* Iberail — panel interno: solicitudes en directo, clientes, grupos, rutas preparadas y documentos */
(function(){
  const IB = window.IB, D = window.IB_DATA || { cities: [], origins: [], countries: {} };
  const app = document.getElementById('admApp');
  if(!IB || !app) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = IB.esc;
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const LABEL = { nueva: 'Nueva', en_curso: 'En curso', presupuesto_enviado: 'Presupuesto enviado', cerrada: 'Cerrada', descartada: 'Descartada' };
  // cómo lo ve el cliente en su cuenta
  const CLIENT_LABEL = { en_curso: 'Preparando', presupuesto_enviado: 'Presupuesto enviado', cerrada: 'Reservada' };
  const byName = {};
  D.cities.concat(D.origins).forEach(c => byName[norm(c.n)] = c);
  // también «Austria, Viena», «Vienna», «Amsterdam»… (map.js)
  const findCity = n => byName[norm(n)] || (window.IBMap && IBMap.city ? IBMap.city(n) : null);
  // fechas de la ruta: cada parada empieza el día que se deja la anterior; «días» = noches en esa ciudad
  const isoAdd = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const dShort = iso => new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(/\./g, '');
  const dLong = iso => new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const ULTRA = { first: '2027-07-09', leave: '2027-07-12', label: 'Ultra Europe (9–11 jul)' };
  function itinerary(fecha, paradas){
    if(!fecha || !/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return null;
    let cur = fecha;
    const legs = paradas.map(s => { const d = Math.max(0, parseInt(s.dias, 10) || 0), a = cur; cur = isoAdd(cur, d); return { a, l: cur, d }; });
    return { legs, end: cur };
  }
  // ¿la parada de Split cubre las tres noches del Ultra?
  function ultraCheck(fecha, paradas){
    const i = paradas.findIndex(s => norm(s.ciudad) === 'split'); if(i < 0) return null;
    const it = itinerary(fecha, paradas);
    const before = paradas.slice(0, i).reduce((a, s) => a + (parseInt(s.dias, 10) || 0), 0), d = parseInt(paradas[i].dias, 10) || 0;
    const fit = isoAdd(isoAdd(ULTRA.leave, -d), -before);   // fecha de salida para dejar Split el 12 de julio
    if(!it) return { i, fit };
    const leg = it.legs[i];
    if(it.end < ULTRA.first || fecha > ULTRA.leave) return { i, fit, lejos: true };
    return { i, fit, ok: leg.a <= ULTRA.first && leg.l >= ULTRA.leave, leg };
  }
  const ccName = cc => (D.countries && D.countries[cc]) || cc;
  const flagDot = cc => D.flags && D.flags[cc] ? `<i class="adm-flag" style="background:${D.flags[cc]}"></i>` : '';
  const BUCKET = 'documentos';
  const MAX_FILE = 10 * 1024 * 1024;

  const I_PLANE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 00-3 0V8.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z"/></svg>';
  const I_DOC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';
  const I_PLUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
  const I_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const I_ROUTE_S = '<span class="adm-av adm-av--route" aria-hidden="true"><svg viewBox="0 0 24 24"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 000-6H9a3 3 0 010-6h6.5"/></svg></span>';
  const I_USERS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.6a3.5 3.5 0 010 6.8M18 14.2a6.5 6.5 0 013.5 5.8"/></svg>';
  const I_BELL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 0112 0c0 5 2 6 2 7H4c0-1 2-2 2-7z"/><path d="M10 19a2 2 0 004 0"/></svg>';
  const I_EUR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17 6.5a6 6 0 100 11M4 10h8M4 14h7"/></svg>';
  const I_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2 6.1 20.4l1.3-6.5L2.5 9.3l6.6-.8z"/></svg>';
  const eur = n => { const [i, d] = Math.abs(Number(n) || 0).toFixed(2).split('.'); return (Number(n) < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d + ' €'; };

  let rows = [], filter = 'all', query = '', unseen = 0;
  let view = 'sol';
  let clients = [], clientsState = 'idle', clientsErr = '';      // idle | loading | ok | error
  let cliFilter = 'all', cliSort = 'new', cliQuery = '';
  const selected = new Set();
  let groups = [], members = [], groupsErr = '';
  let notes = {}, notesTable = true;
  const docs = {};           // 'r:12' | 'g:3' → array | null (cargando) | { error }
  const drafts = {};         // borrador del formulario de documento por sitio
  let drawer = null;         // { kind: 'ruta' | 'grupo' | 'nueva' | 'nuevo-grupo' | 'nuevo-aviso', id }
  let nf = null;             // formulario de nueva ruta
  let ng = null;             // formulario de nuevo grupo
  let na = null;             // formulario de nuevo aviso: { target: 'todos'|'grupo'|'ruta', grupoId, rutaId, importante }
  let pagos = [], pagosErr = '';
  const payDrafts = {};      // borrador del formulario de nuevo pago por persona (uid → {importe,fecha,nota})
  let avisos = [], leidos = [], avisosErr = '';
  let rr = { com: [], refs: [], codes: [], importe: 40, minimo: 5, err: '' };   // «Invita y gana»
  let meId = null, grT = null, extraChan = null, rrT = null;
  const openReads = new Set();  // avisos con la lista de quién lo ha visto desplegada
  const baseTitle = document.title;

  /* ---------- helpers ---------- */
  function lock(text){
    $('#admLock').hidden = false; app.hidden = true;
    if(text) $('#admLockText').textContent = text;
    setLive('off', 'Sin conexión');
  }
  function setLive(state, text){ const l = $('#admLive'); l.dataset.state = state; l.querySelector('span').textContent = text; }
  const ago = iso => {
    const s = (Date.now() - new Date(iso)) / 1000;
    if(s < 60) return 'ahora mismo';
    if(s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if(s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    if(s < 86400 * 7) return `hace ${Math.floor(s / 86400)} d`;
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };
  const fdate = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Sin fecha';
  const ftime = t => t ? String(t).slice(0, 5) : '';
  const waPhone = t => { let d = String(t || '').replace(/\D/g, ''); if(d.startsWith('00')) d = d.slice(2); if(d.length === 9) d = '34' + d; return d; };
  const chain = r => [r.salida].concat((r.paradas || []).map(p => p.ciudad)).map(esc).join(' → ');
  const plural = (n, a, b) => n === 1 ? a : b;
  const kb = n => n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  const code = s => { const m = String(s || '').match(/\(([A-Za-z]{3})\)/); return m ? m[1].toUpperCase() : (norm(s).replace(/[^a-z]/g, '').slice(0, 3) || '···').toUpperCase(); };
  const safeName = n => String(n || 'archivo').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.-]+/g, '-').replace(/-+/g, '-').slice(-80);
  const initials = s => String(s || '?').trim().split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
  const clientName = c => c ? (c.nombre || c.email.split('@')[0]) : '—';
  const groupById = id => groups.find(g => String(g.id) === String(id));
  const membersOf = gid => members.filter(m => String(m.grupo_id) === String(gid)).map(m => clients.find(c => c.id === m.user_id) || { id: m.user_id, email: '', nombre: 'Cliente' });
  const groupsOf = uid => members.filter(m => m.user_id === uid).map(m => groupById(m.grupo_id)).filter(Boolean);
  const setupErr = err => {
    const m = String((err && (err.message || err.error || err.msg)) || err || '').toLowerCase();
    if(/(wa_chats|wa_config|wa_mensajes)/.test(m) && /(does not exist|could not find|schema cache|not found)/.test(m))
      return 'Falta activar esta parte en Supabase: ejecuta el archivo 10 de la guía de activación.';
    if(/(comisiones|referidos|rrpp_codigos|rrpp_reglas)/.test(m) && /(does not exist|could not find|schema cache|not found)/.test(m))
      return 'Falta activar esta parte en Supabase: ejecuta el archivo 9 de la guía de activación.';
    if(/(pagado|pagos_visibles|pagos_grupo)/.test(m) && /(does not exist|could not find|schema cache|not found)/.test(m))
      return 'Falta activar esta parte en Supabase: ejecuta el archivo 8 de la guía de activación.';
    if(/(pagos|avisos|avisos_leidos|importe)/.test(m) && /(does not exist|could not find|schema cache|not found)/.test(m))
      return 'Falta activar esta parte en Supabase: ejecuta el archivo 7 de la guía de activación.';
    if(/bucket not found/.test(m) || (/(documentos|grupos|grupo_miembros|rutas_notas|buscar_clientes|grupo_id|creada_por_equipo)/.test(m) && /(does not exist|could not find|schema cache|not found)/.test(m)))
      return 'Falta activar esta parte en Supabase: ejecuta el archivo 6 de la guía de activación.';
    if(/mime|not supported|invalid.*type/.test(m)) return 'Ese tipo de archivo no vale: sube un PDF o una foto (JPG, PNG, WEBP, HEIC).';
    if(/too large|exceeded|payload/.test(m)) return 'El archivo pesa más de 10 MB.';
    if(/already exists|duplicate/.test(m)) return 'Esa persona ya está en el grupo.';
    return IB.errMsg(err);
  };
  const typing = () => { const a = document.activeElement; return a && $('.adm-panel').contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName); };
  const counts = () => {
    $('#admCSol').textContent = rows.length || '';
    $('#admCCli').textContent = clientsState === 'ok' ? clients.length : '';
    $('#admCGru').textContent = groupsErr ? '' : groups.length || '';
    const open = avisosErr ? 0 : avisos.filter(a => audienceOf(a) && readCountOf(a.id) < audienceOf(a)).length;
    $('#admCAvi').textContent = open || '';
    const rb = $('#admCRrp'); if(rb) rb.textContent = rr.err ? '' : rr.com.filter(c => c.estado === 'pendiente').length || '';
    const wb = $('#admCWa'); if(wb){ const n = wa.err ? 0 : wa.chats.filter(c => c.atencion).length; wb.textContent = n || ''; wb.classList.toggle('is-hot', !!n); }
  };

  /* ---------- toasts ---------- */
  function toast(text, err, onClick){
    const t = document.createElement(onClick ? 'button' : 'div');
    t.className = 'toast' + (err ? ' is-err' : '');
    t.innerHTML = text;
    if(onClick){ t.type = 'button'; t.addEventListener('click', () => { onClick(); t.remove(); }); }
    $('#toasts').appendChild(t);
    requestAnimationFrame(() => t.classList.add('is-in'));
    setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 300); }, 6500);
  }
  function bumpTitle(){ unseen++; document.title = `(${unseen}) Nueva ruta · ${baseTitle}`; }
  document.addEventListener('visibilitychange', () => { if(!document.hidden){ unseen = 0; document.title = baseTitle; } });
  // botón que pide un segundo toque antes de borrar
  function armed(btn, text){
    if(btn.dataset.armed === '1') return true;
    btn.dataset.armed = '1'; btn.dataset.label = btn.textContent; btn.textContent = text || '¿Seguro? Toca otra vez'; btn.classList.add('is-armed');
    setTimeout(() => { if(btn.isConnected){ btn.dataset.armed = ''; btn.textContent = btn.dataset.label; btn.classList.remove('is-armed'); } }, 4000);
    return false;
  }

  /* ---------- vistas ---------- */
  function setView(v){
    view = v;
    $$('#admViews [data-v]').forEach(b => b.setAttribute('aria-selected', b.dataset.v === v));
    $$('.adm-view').forEach(el => el.hidden = el.dataset.view !== v);
    $('#admH').textContent = { sol: 'Solicitudes', cli: 'Clientes', gru: 'Grupos', avi: 'Avisos', rrp: 'Invita y gana', wha: 'WhatsApp', cor: 'Correos', liv: 'En directo' }[v];
    $('#admCsv').hidden = v !== 'sol';
    if(v === 'cli'){ loadClients(); paintClients(); }
    if(v === 'gru'){ loadClients(); paintGroups(); }
    if(v === 'avi'){ loadClients(); paintAvisos(); }
    if(v === 'rrp'){ loadClients(); paintRrpp(); }
    if(v === 'wha') paintWa();
    if(v === 'cor' && window.IBCorreos) IBCorreos.show();
    if(v === 'liv' && window.IBLive) IBLive.show();
  }

  /* ---------- solicitudes ---------- */
  function paintStats(){
    const c = { nueva: 0, en_curso: 0, presupuesto_enviado: 0, cerrada: 0, semana: 0 };
    const week = Date.now() - 7 * 864e5;
    rows.forEach(r => { if(c[r.estado] !== undefined) c[r.estado]++; if(new Date(r.created_at) > week) c.semana++; });
    $$('#admStats [data-k]').forEach(b => b.textContent = c[b.dataset.k]);
  }
  function visible(){
    const q = norm(query);
    return rows.filter(r => (filter === 'all' || r.estado === filter) &&
      (!q || norm([r.nombre, r.email, r.ref, r.telefono, r.salida, (r.paradas || []).map(p => p.ciudad).join(' '), (groupById(r.grupo_id) || {}).nombre].join(' ')).includes(q)));
  }
  function whoTag(r){
    if(r.grupo_id){ const g = groupById(r.grupo_id); return `<em class="adm-tag">${I_USERS}Grupo${g ? ' · ' + esc(g.nombre) : ''}</em>`; }
    if(r.origen === 'whatsapp') return '<em class="adm-tag is-wa">Por WhatsApp</em>';
    return r.creada_por_equipo ? '<em class="adm-tag">Preparada por ti</em>' : '';
  }
  function paintList(){
    const list = visible(), box = $('#admList');
    if(!rows.length){ box.innerHTML = '<div class="adm-empty"><b>Todavía no hay solicitudes.</b><span>Cuando alguien envíe una ruta aparecerá aquí al instante.</span></div>'; return; }
    if(!list.length){ box.innerHTML = '<div class="adm-empty"><b>Nada por aquí.</b><span>Prueba con otro filtro o búsqueda.</span></div>'; return; }
    box.innerHTML = list.map(r => `<button type="button" class="adm-row${r.estado === 'nueva' ? ' is-new' : ''}${r._fresh ? ' is-fresh' : ''}" data-id="${esc(r.id)}">
      <span class="st st--${esc(r.estado)}">${esc(LABEL[r.estado] || r.estado)}</span>
      <span class="adm-row-who"><b>${esc(r.nombre)}</b><small>${esc(r.ref)} · ${esc(ago(r.created_at))}</small>${whoTag(r)}</span>
      <span class="adm-row-route">${chain(r)}</span>
      <span class="adm-row-meta"><b>${esc(r.dias)} días</b><small>${esc(r.viajeros)} pax · ${esc(fdate(r.fecha_salida))}</small></span>
      <span class="adm-row-go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M9 6l6 6-6 6"/></svg></span>
    </button>`).join('');
    rows.forEach(r => delete r._fresh);
  }
  function paintAll(){
    paintStats(); paintList(); counts();
    if(view === 'cli') paintClients();
    if(view === 'gru') paintGroups();
    if(view === 'avi') paintAvisos();
    if(view === 'rrp') paintRrpp();
    paintOverview();
    if(drawer && (drawer.kind === 'ruta' || drawer.kind === 'grupo') && !typing()) paintDrawer();
  }

  /* ---------- clientes ---------- */
  async function loadClients(force){
    if(clientsState === 'loading' || (clientsState === 'ok' && !force)) return;
    clientsState = 'loading'; if(view === 'cli') paintClients();
    const { data, error } = await IB.sb.rpc('buscar_clientes', { q: '' });
    if(error){ clientsState = 'error'; clientsErr = setupErr(error); }
    else { clients = data || []; clientsState = 'ok'; }
    counts(); paintOverview();
    if(view === 'cli') paintClients();
    if(view === 'gru') paintGroups();
    if(view === 'avi') paintAvisos();
    if(view === 'rrp') paintRrpp();
    if(drawer && !typing()) paintDrawer();
  }
  async function loadGroups(){
    const [g, m] = await Promise.all([
      IB.sb.from('grupos').select('*').order('created_at', { ascending: false }),
      IB.sb.from('grupo_miembros').select('*')
    ]);
    if(g.error || m.error){ groupsErr = setupErr(g.error || m.error); groups = []; members = []; }
    else { groupsErr = ''; groups = g.data || []; members = m.data || []; }
    counts();
  }
  async function loadExtras(){
    const [pg, av, al] = await Promise.all([
      IB.sb.from('pagos').select('*'),
      IB.sb.from('avisos').select('*').order('created_at', { ascending: false }),
      IB.sb.from('avisos_leidos').select('*'),
      loadRrpp()
    ]);
    if(pg.error){ pagosErr = setupErr(pg.error); pagos = []; } else { pagosErr = ''; pagos = pg.data || []; }
    // los avisos personales («¡Has ganado 40 €!») salen solos: no se mezclan con los que escribes tú
    if(av.error){ avisosErr = setupErr(av.error); avisos = []; } else { avisosErr = ''; avisos = (av.data || []).filter(a => !a.user_id); }
    leidos = al.data || [];
    // en directo: quién lee los avisos y cambios en los grupos (canal aparte: si falta el archivo 6 o 7 no afecta a las solicitudes)
    if(!extraChan && !groupsErr){
      extraChan = IB.sb.channel('panel-extra')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'grupo_miembros' }, () => { clearTimeout(grT); grT = setTimeout(async () => { await loadGroups(); paintAll(); }, 600); });
      if(!avisosErr) extraChan = extraChan.on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'avisos_leidos' }, payload => {
        const x = payload.new; if(!x || leidos.some(l => String(l.aviso_id) === String(x.aviso_id) && l.user_id === x.user_id)) return;
        leidos.push(x); counts(); paintOverview(); if(view === 'avi') paintAvisos(); if(drawer && !typing()) paintDrawer();
      });
      if(!rr.err) extraChan = extraChan
        .on('postgres_changes', { event: '*', schema: 'public', table: 'comisiones' }, () => { clearTimeout(rrT); rrT = setTimeout(async () => { const before = rr.com.length; await loadRrpp(); counts(); if(view === 'rrp') paintRrpp(); if(rr.com.length > before) toast(`${I_EUR}Nueva comisión de «Invita y gana»: toca para verla`, false, () => setView('rrp')); }, 500); });
      extraChan.subscribe();
    }
    counts(); paintOverview();
    if(view === 'gru') paintGroups();
    if(view === 'avi') paintAvisos();
    if(drawer && !typing()) paintDrawer();
  }
  const pagosOf = (gid, uid) => pagos.filter(p => String(p.grupo_id) === String(gid) && p.user_id === uid);
  const pagadoOf = (gid, uid) => pagosOf(gid, uid).reduce((a, p) => a + Number(p.importe), 0);
  const memberRow = (gid, uid) => members.find(x => String(x.grupo_id) === String(gid) && x.user_id === uid);
  // cuentas del grupo: total a cobrar, cobrado y pendiente (solo de quien sigue en el grupo)
  function groupMoney(gid){
    let total = 0, cobrado = 0, falta = 0, alDia = 0, pend = 0, n = 0, extra = 0;
    const deMas = [];
    members.filter(m => String(m.grupo_id) === String(gid)).forEach(m => {
      const imp = Number(m.importe || 0), pag = pagadoOf(gid, m.user_id), ok = !!m.pagado || (imp > 0 && pag >= imp);
      total += imp; cobrado += pag; falta += ok ? 0 : Math.max(0, imp - pag); n++;
      if(imp > 0 && pag > imp){ extra += pag - imp; deMas.push({ uid: m.user_id, x: pag - imp }); }
      if(ok) alDia++;
      if(!ok && imp > 0 && pag < imp) pend++;
    });
    // lo que ya está cubierto del total (sin contar lo pagado de más)
    const cubierto = Math.max(0, total - falta);
    return { total, cobrado, falta, alDia, pend, n, extra, deMas, cubierto };
  }
  // a quién le llega cada aviso (ids de cliente, sin contar al equipo)
  function audienceIds(a){
    let ids = [];
    if(a.para_todos) ids = clientsState === 'ok' ? clients.map(c => c.id) : [];
    else if(a.grupo_id) ids = members.filter(m => String(m.grupo_id) === String(a.grupo_id)).map(m => m.user_id);
    else if(a.ruta_id){
      const r = rows.find(x => String(x.id) === String(a.ruta_id));
      if(r) ids = r.grupo_id ? members.filter(m => String(m.grupo_id) === String(r.grupo_id)).map(m => m.user_id) : (r.user_id ? [r.user_id] : []);
    }
    return ids.filter(id => id !== meId);
  }
  const audienceOf = a => audienceIds(a).length;
  const readersOf = a => { const aud = new Set(audienceIds(a)); return leidos.filter(x => String(x.aviso_id) === String(a.id) && aud.has(x.user_id)); };
  const readCountOf = aid => { const a = avisos.find(x => String(x.id) === String(aid)); return a ? readersOf(a).length : 0; };
  function paintOverview(){
    const box = $('#admOverview'); if(!box) return;
    const clientesN = clientsState === 'ok' ? clients.filter(c => c.id !== meId).length : '—';
    const activos = clientsState === 'ok' && clients.some(c => 'ultimo_acceso' in c) ? clients.filter(c => c.id !== meId && c.ultimo_acceso && Date.now() - new Date(c.ultimo_acceso) < 7 * 864e5).length : null;
    const gruposN = groupsErr ? '—' : groups.length;
    let pendiente = 0, conDeuda = 0;
    if(!pagosErr) groups.forEach(g => { const m = groupMoney(g.id); pendiente += m.falta; conDeuda += m.pend; });
    const abiertos = avisosErr ? null : avisos.filter(a => audienceOf(a) && readCountOf(a.id) < audienceOf(a)).length;
    const nuevas = rows.filter(r => r.estado === 'nueva').length;
    box.innerHTML = `
      <button type="button" data-go-view="sol"${nuevas ? ' class="is-hot"' : ''}><span class="adm-ov-ic">${I_DOC}</span><b>${nuevas}</b><span>${plural(nuevas, 'Solicitud nueva', 'Solicitudes nuevas')}</span></button>
      <button type="button" data-go-view="cli"><span class="adm-ov-ic">${I_USERS}</span><b>${clientesN}</b><span>${activos != null ? `Clientes · ${activos} activos esta semana` : 'Clientes registrados'}</span></button>
      <button type="button" data-go-view="gru"><span class="adm-ov-ic">${I_EUR}</span><b>${pagosErr ? '—' : eur(pendiente)}</b><span>${pagosErr ? 'Pagos sin activar' : `Pendiente de cobro${conDeuda > 0 ? ` · ${conDeuda} ${plural(conDeuda, 'persona', 'personas')}` : ''}`} · ${gruposN} ${plural(Number(gruposN) || 0, 'grupo', 'grupos')}</span></button>
      <button type="button" data-go-view="avi"><span class="adm-ov-ic">${I_BELL}</span><b>${abiertos == null ? '—' : abiertos}</b><span>${abiertos == null ? 'Avisos sin activar' : plural(abiertos, 'Aviso que falta por leer', 'Avisos que faltan por leer')}</span></button>`;
  }
  function visibleClients(){
    const q = norm(cliQuery);
    let list = clients.filter(c => {
      const n = groupsOf(c.id).length;
      if(cliFilter === 'sin' && n) return false;
      if(cliFilter === 'con' && !n) return false;
      return !q || norm([c.nombre, c.email, c.telefono].join(' ')).includes(q);
    });
    if(cliSort === 'az') list = list.slice().sort((a, b) => clientName(a).localeCompare(clientName(b), 'es'));
    if(cliSort === 'grupo') list = list.slice().sort((a, b) => ((groupsOf(a.id)[0] || {}).nombre || '￿').localeCompare((groupsOf(b.id)[0] || {}).nombre || '￿', 'es') || clientName(a).localeCompare(clientName(b), 'es'));
    return list;
  }
  function paintClients(){
    const box = $('#cliList');
    if(clientsState === 'loading' || clientsState === 'idle'){ box.innerHTML = '<div class="auth-spin"></div>'; return; }
    if(clientsState === 'error'){ box.innerHTML = `<div class="adm-empty"><b>No se pueden cargar los clientes.</b><span>${esc(clientsErr)}</span></div>`; return; }
    const list = visibleClients();
    if(!clients.length) box.innerHTML = '<div class="adm-empty"><b>Aún no hay nadie registrado.</b><span>Cuando alguien cree su cuenta aparecerá aquí.</span></div>';
    else if(!list.length) box.innerHTML = '<div class="adm-empty"><b>Nadie coincide.</b><span>Prueba con otra búsqueda o filtro.</span></div>';
    else box.innerHTML = list.map(c => {
      const gs = groupsOf(c.id), nr = rows.filter(r => r.user_id === c.id).length;
      return `<div class="adm-cli${selected.has(c.id) ? ' is-sel' : ''}" data-uid="${esc(c.id)}">
        <label class="adm-cli-ck${gs.length ? ' is-off' : ''}"${gs.length ? ` title="Ya está en «${esc(gs[0].nombre)}»: cada persona solo puede estar en un grupo"` : ''}><input type="checkbox" data-sel="${esc(c.id)}"${selected.has(c.id) ? ' checked' : ''}${gs.length ? ' disabled' : ''} aria-label="Seleccionar a ${esc(clientName(c))}${gs.length ? ' (ya tiene grupo)' : ''}"><span></span></label>
        <span class="adm-av" aria-hidden="true">${esc(initials(clientName(c)))}</span>
        <span class="adm-cli-who"><b>${esc(clientName(c))}</b><small>${esc(c.email)}${c.telefono ? ' · ' + esc(c.telefono) : ''}</small></span>
        <span class="adm-cli-groups">${gs.length > 1 ? '<em class="adm-warn">En varios grupos: déjala solo en uno</em>' : ''}${gs.length ? gs.map(g => `<button type="button" class="adm-gchip" data-open-group="${esc(g.id)}">${I_USERS}${esc(g.nombre)}</button>`).join('') : '<em>Sin grupo</em>'}</span>
        <span class="adm-cli-meta">${invitedBy(c.id)}${nr ? `${nr} ${plural(nr, 'ruta', 'rutas')} · ` : ''}${'ultimo_acceso' in c ? (c.ultimo_acceso ? `entró ${esc(ago(c.ultimo_acceso))}` : '<i>nunca ha entrado</i>') : `se registró ${esc(ago(c.registrado))}`}${c.verificado ? '' : ' · <i>sin verificar</i>'}</span>
        <button type="button" class="btn btn--ghost btn--sm" data-new-for="${esc(c.id)}">${I_PLUS}Ruta</button>
      </div>`;
    }).join('');
    paintBulk();
  }
  function paintBulk(){
    const bar = $('#cliBulk'), n = selected.size;
    bar.hidden = !n || view !== 'cli';
    if(!n) return;
    $('#cliBulkN').textContent = `${n} ${plural(n, 'persona seleccionada', 'personas seleccionadas')}`;
    const sel = $('#cliBulkG'), keep = sel.value;
    sel.innerHTML = `<option value="__new">Nuevo grupo con ${plural(n, 'ella', 'ellas')}</option>` + groups.map(g => `<option value="${esc(g.id)}">Añadir a «${esc(g.nombre)}»</option>`).join('');
    if([...sel.options].some(o => o.value === keep)) sel.value = keep;
  }
  // regla: cada persona solo puede estar en un grupo
  const otherGroup = (uid, gid) => { const m = members.find(x => x.user_id === uid && String(x.grupo_id) !== String(gid)); return m ? groupById(m.grupo_id) : null; };
  async function addMembers(gid, uids){
    const busy = uids.filter(u => otherGroup(u, gid));
    if(busy.length){
      const who = busy.map(u => { const c = clients.find(x => x.id === u), g = otherGroup(u, gid); return `${clientName(c)} (ya está en «${g ? g.nombre : 'otro grupo'}»)`; });
      toast(`${busy.length === 1 ? 'No se ha añadido a' : 'No se han añadido a'} ${esc(who.join(', '))}. Cada persona solo puede estar en un grupo: quítala primero del suyo.`, true);
    }
    const add = uids.filter(u => !busy.includes(u) && !members.some(m => String(m.grupo_id) === String(gid) && m.user_id === u));
    if(!add.length) return !busy.length;
    const { error } = await IB.sb.from('grupo_miembros').insert(add.map(u => ({ grupo_id: gid, user_id: u })));
    if(error){ toast(setupErr(error), true); return false; }
    add.forEach(u => members.push({ grupo_id: gid, user_id: u, added_at: new Date().toISOString() }));
    return true;
  }

  /* ---------- «Invita y gana»: comisiones de relaciones públicas ---------- */
  async function loadRrpp(){
    const [c, r, k, g] = await Promise.all([
      IB.sb.from('comisiones').select('*').order('created_at', { ascending: false }),
      IB.sb.from('referidos').select('*'),
      IB.sb.from('rrpp_codigos').select('*'),
      IB.sb.rpc('rrpp_reglas')
    ]);
    const err = c.error || r.error || k.error;
    if(err){ rr = { ...rr, com: [], refs: [], codes: [], err: setupErr(err) }; return; }
    const rg = (Array.isArray(g.data) ? g.data[0] : g.data) || {};
    rr = { com: c.data || [], refs: r.data || [], codes: k.data || [], importe: Number(rg.importe || 40), minimo: Number(rg.minimo || 5), err: '' };
  }
  const who = uid => clients.find(c => c.id === uid);
  const whoName = uid => { const c = who(uid); return c ? clientName(c) : 'Cliente'; };
  const invitedBy = uid => { if(rr.err) return ''; const x = rr.refs.find(f => f.user_id === uid); return x ? `invitado por <b>${esc(whoName(x.padrino).split(' ')[0])}</b> · ` : ''; };
  function rrWa(c){
    const p = who(c.padrino), tel = p && p.telefono;
    if(!tel) return '';
    const txt = `¡Hola ${whoName(c.padrino).split(' ')[0]}! 🎉 El grupo «${c.grupo_nombre || ''}» ya lo tiene todo pagado y ${c.personas} de sus viajeros vinieron con tu enlace de Iberail, así que has ganado ${eur(c.importe)}. ¿Te lo mando por Bizum a este número?`;
    return `<a class="pl-link" href="${esc(IB.wa(txt, waPhone(tel)))}" target="_blank" rel="noopener">WhatsApp</a>`;
  }
  function rrRow(c){
    const p = who(c.padrino), done = c.estado !== 'pendiente';
    const st = c.estado === 'pagada' ? `<em class="adm-rr-st is-ok">Pagada ${c.pagada_at ? esc(ago(c.pagada_at)) : ''}</em>` : c.estado === 'anulada' ? '<em class="adm-rr-st is-off">Anulada</em>' : '<em class="adm-rr-st is-due">Por pagar</em>';
    const gBtn = c.grupo_id && groupById(c.grupo_id) ? `<button type="button" class="adm-gchip" data-open-group="${esc(c.grupo_id)}">${I_USERS}${esc(c.grupo_nombre || groupById(c.grupo_id).nombre)}</button>` : `<span class="adm-gchip is-gone">${I_USERS}${esc(c.grupo_nombre || 'Grupo borrado')}</span>`;
    return `<div class="adm-rr${done ? ' is-done' : ''}">
      <span class="adm-av" aria-hidden="true">${esc(initials(whoName(c.padrino)))}</span>
      <span class="adm-cli-who"><b>${esc(whoName(c.padrino))}</b><small>${p ? esc(p.email) + (p.telefono ? ' · ' + esc(p.telefono) : '') : ''}</small></span>
      <span class="adm-rr-why">${gBtn}<small>${c.personas} invitados · ganada ${esc(ago(c.created_at))}</small></span>
      <span class="adm-rr-amt"><b>${eur(c.importe)}</b>${st}</span>
      <span class="adm-rr-act">${c.estado === 'pendiente'
        ? `${rrWa(c)}<button type="button" class="btn btn--dark btn--sm" data-rr-paid="${esc(c.id)}">Marcar pagada</button><button type="button" class="pl-link adm-rr-void" data-rr-void="${esc(c.id)}">Anular</button>`
        : `<button type="button" class="pl-link" data-rr-undo="${esc(c.id)}">Deshacer</button>`}</span>
    </div>`;
  }
  function paintRrpp(){
    const box = $('#rrpList'); if(!box) return;
    if(rr.err){ box.innerHTML = `<div class="adm-empty"><b>«Invita y gana» aún no está activado.</b><span>${esc(rr.err)}</span></div>`; return; }
    if(clientsState === 'loading' || clientsState === 'idle'){ box.innerHTML = '<div class="auth-spin"></div>'; return; }
    const pend = rr.com.filter(c => c.estado === 'pendiente'), paid = rr.com.filter(c => c.estado === 'pagada');
    const sum = l => l.reduce((a, c) => a + Number(c.importe), 0);
    // grupos que van camino de generar comisión (tienen ya el mínimo de invitados de alguien)
    const soon = groups.filter(g => !rr.com.some(c => String(c.grupo_id) === String(g.id))).map(g => {
      const cnt = {}; members.filter(m => String(m.grupo_id) === String(g.id)).forEach(m => { const f = rr.refs.find(x => x.user_id === m.user_id); if(f) cnt[f.padrino] = (cnt[f.padrino] || 0) + 1; });
      const top = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0];
      return top && top[1] >= rr.minimo ? { g, padrino: top[0], n: top[1], m: pagosErr ? null : groupMoney(g.id) } : null;
    }).filter(Boolean);
    // quién trae a más gente
    const board = {};
    rr.refs.forEach(f => { (board[f.padrino] = board[f.padrino] || { inv: 0, won: 0, eur: 0 }).inv++; });
    rr.com.filter(c => c.estado !== 'anulada').forEach(c => { const b = (board[c.padrino] = board[c.padrino] || { inv: 0, won: 0, eur: 0 }); b.won++; b.eur += Number(c.importe); });
    const top = Object.entries(board).sort((a, b) => (b[1].won - a[1].won) || (b[1].inv - a[1].inv)).slice(0, 10);
    box.innerHTML = `
      <div class="adm-rr-sum">
        <div class="${pend.length ? 'is-hot' : ''}"><b>${eur(sum(pend))}</b><span>Por pagar · ${pend.length} ${plural(pend.length, 'comisión', 'comisiones')}</span></div>
        <div><b>${eur(sum(paid))}</b><span>Pagado en total</span></div>
        <div><b>${rr.refs.length}</b><span>${plural(rr.refs.length, 'Persona registrada', 'Personas registradas')} con un enlace</span></div>
        <div><b>${Object.keys(board).length}</b><span>Relaciones públicas activos</span></div>
      </div>
      <section class="adm-sec"><div class="adm-sec-h"><h3>${I_EUR}Por pagar</h3></div>
        ${pend.length ? `<div class="adm-rr-list">${pend.map(rrRow).join('')}</div>` : `<p class="adm-docs-empty">No debes nada ahora mismo. Cuando un grupo con ${rr.minimo} o más invitados de alguien lo tenga todo pagado, saldrá aquí solo.</p>`}
      </section>
      ${soon.length ? `<section class="adm-sec"><div class="adm-sec-h"><h3>${I_USERS}En camino</h3></div>
        <p class="adm-hint">Estos grupos ya tienen ${rr.minimo} o más invitados de alguien: la comisión se generará sola cuando paguen todos.</p>
        <div class="adm-rr-list">${soon.map(x => `<div class="adm-rr is-soon"><span class="adm-av" aria-hidden="true">${esc(initials(whoName(x.padrino)))}</span><span class="adm-cli-who"><b>${esc(whoName(x.padrino))}</b><small>${x.n} invitados en el grupo</small></span><span class="adm-rr-why"><button type="button" class="adm-gchip" data-open-group="${esc(x.g.id)}">${I_USERS}${esc(x.g.nombre)}</button><small>${x.m ? (x.m.total ? `faltan ${eur(x.m.falta)} por cobrar` : 'sin precios todavía') : ''}</small></span><span class="adm-rr-amt"><b>${eur(rr.importe)}</b><em class="adm-rr-st">Cuando paguen</em></span></div>`).join('')}</div>
      </section>` : ''}
      ${top.length ? `<section class="adm-sec"><div class="adm-sec-h"><h3>${I_USERS}Quién trae más gente</h3></div>
        <ol class="adm-rr-board">${top.map(([uid, b], i) => { const code = (rr.codes.find(k => k.user_id === uid) || {}).codigo; return `<li><span class="adm-rr-pos">${i + 1}</span><span class="adm-cli-who"><b>${esc(whoName(uid))}</b><small>${code ? `?ref=${esc(code)}` : ''}</small></span><span>${b.inv} ${plural(b.inv, 'invitado', 'invitados')}</span><span>${b.won} ${plural(b.won, 'grupo', 'grupos')}</span><b>${eur(b.eur)}</b></li>`; }).join('')}</ol>
      </section>` : ''}
      ${rr.com.length - pend.length ? `<section class="adm-sec"><div class="adm-sec-h"><h3>${I_DOC}Historial</h3></div><div class="adm-rr-list">${rr.com.filter(c => c.estado !== 'pendiente').map(rrRow).join('')}</div></section>` : ''}
      ${!rr.refs.length && !rr.com.length ? `<div class="adm-empty"><b>Todavía nadie se ha registrado con un enlace.</b><span>Cada cliente tiene el suyo en «Mi cuenta → Invita y gana». Cuando alguien lo use, lo verás aquí.</span></div>` : ''}`;
  }
  async function rrSet(id, patch, btn, okText){
    if(btn) btn.disabled = true;
    const { error } = await IB.sb.from('comisiones').update(patch).eq('id', id);
    if(btn) btn.disabled = false;
    if(error) return toast(setupErr(error), true);
    const c = rr.com.find(x => String(x.id) === String(id)); if(c) Object.assign(c, patch);
    counts(); paintRrpp(); toast(okText);
  }
  $('#rrpList').addEventListener('click', e => {
    const t = e.target;
    const og = t.closest('[data-open-group]'); if(og) return openDrawer({ kind: 'grupo', id: og.dataset.openGroup });
    const pd = t.closest('[data-rr-paid]'); if(pd) return rrSet(pd.dataset.rrPaid, { estado: 'pagada', pagada_at: new Date().toISOString() }, pd, 'Marcada como pagada: ya lo ve en su cuenta');
    const vd = t.closest('[data-rr-void]'); if(vd){ if(armed(vd, '¿Anular? Toca otra vez')) rrSet(vd.dataset.rrVoid, { estado: 'anulada', pagada_at: null }, vd, 'Comisión anulada'); return; }
    const un = t.closest('[data-rr-undo]'); if(un) return rrSet(un.dataset.rrUndo, { estado: 'pendiente', pagada_at: null }, un, 'Vuelve a estar por pagar');
  });

  /* ---------- WhatsApp: el asistente con IA ---------- */
  let wa = { chats: [], cfg: null, err: '', msgs: {}, loaded: false }, waChan = null, waT = null, sandbox = null;
  const I_BOT = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="8" width="16" height="12" rx="4"/><path d="M12 8V4M8.5 14h.01M15.5 14h.01M9 17.5h6"/></svg>';
  const I_WA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 01-12.3 7.4L3 21l2.1-5.6A8.5 8.5 0 1121 11.5z"/></svg>';
  const telFmt = t => { const d = String(t || '').replace(/\D/g, ''); return d.startsWith('34') && d.length === 11 ? `+34 ${d.slice(2, 5)} ${d.slice(5, 8)} ${d.slice(8)}` : '+' + d; };
  const sameTel = (a, b) => { const x = String(a || '').replace(/\D/g, ''), y = String(b || '').replace(/\D/g, ''); return x.length >= 9 && y.length >= 9 && x.slice(-9) === y.slice(-9); };
  const hm = iso => new Date(iso).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const pausedChat = c => c.modo === 'humano' && (!c.pausa_hasta || new Date(c.pausa_hasta) > new Date());
  async function waCall(body){
    try{
      const { data } = await IB.sb.auth.getSession(); const tok = data && data.session && data.session.access_token;
      const r = await fetch(`${String(IB.cfg.SUPABASE_URL).replace(/\/$/, '')}/functions/v1/whatsapp`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, apikey: IB.cfg.SUPABASE_ANON_KEY }, body: JSON.stringify(body) });
      const j = await r.json().catch(() => ({}));
      if(!r.ok && !j.error) j.error = r.status === 404 ? 'El asistente aún no está instalado en Supabase (paso 4 de la guía).' : `Error ${r.status}`;
      if(!r.ok) j.ok = false;
      return j;
    }catch(e){ return { ok: false, error: 'No se puede conectar con el asistente. ¿Está instalado en Supabase (paso 4 de la guía)?' }; }
  }
  async function loadWa(){
    const [c, g] = await Promise.all([
      IB.sb.from('wa_chats').select('*').order('ultimo_at', { ascending: false }).limit(300),
      IB.sb.from('wa_config').select('*').eq('id', 1).maybeSingle()
    ]);
    if(c.error){ wa.err = setupErr(c.error); wa.chats = []; }
    else { wa.err = ''; wa.chats = c.data || []; wa.cfg = g.data || { bot_activo: true, horas_pausa: 12 }; }
    wa.loaded = true; counts();
    if(view === 'wha') paintWa();
    if(drawer && drawer.kind === 'wa-chat' && !typing()) paintDrawer();
    if(!waChan && !wa.err){
      waChan = IB.sb.channel('panel-wa')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'wa_chats' }, () => { clearTimeout(waT); waT = setTimeout(loadWa, 350); })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'wa_mensajes' }, p => {
          const m = p.new; if(!m) return;
          const list = wa.msgs[m.telefono]; if(list && !list.some(x => x.id === m.id)) list.push(m);
          if(drawer && drawer.kind === 'wa-chat' && drawer.id === m.telefono && !typing()) paintDrawer();
        });
      waChan.subscribe();
    }
  }
  async function loadWaMsgs(tel){
    const { data, error } = await IB.sb.from('wa_mensajes').select('*').eq('telefono', tel).order('created_at', { ascending: true }).limit(400);
    wa.msgs[tel] = error ? [] : (data || []);
    const c = wa.chats.find(x => x.telefono === tel);
    if(c && c.no_leidos){ c.no_leidos = 0; IB.sb.from('wa_chats').update({ no_leidos: 0 }).eq('telefono', tel).then(() => {}); }
    if(drawer && drawer.kind === 'wa-chat' && drawer.id === tel) paintDrawer();
  }
  async function waChat(tel, patch, okText){
    const c = wa.chats.find(x => x.telefono === tel); const prev = c ? { ...c } : null;
    if(c) Object.assign(c, patch); counts(); paintWa(); if(drawer) paintDrawer();
    const { error } = await IB.sb.from('wa_chats').update(patch).eq('telefono', tel);
    if(error){ if(c && prev) Object.assign(c, prev); counts(); paintWa(); if(drawer) paintDrawer(); return toast(setupErr(error), true); }
    if(okText) toast(okText);
  }
  function paintWa(){
    const box = $('#waList'); if(!box) return;
    if(!wa.loaded){ box.innerHTML = '<div class="auth-spin"></div>'; return; }
    if(wa.err){ box.innerHTML = `<div class="adm-empty"><b>El asistente de WhatsApp aún no está activado.</b><span>${esc(wa.err)} Después sigue la guía «WhatsApp con IA».</span></div>`; return; }
    const on = wa.cfg.bot_activo, need = wa.chats.filter(c => c.atencion), rest = wa.chats.filter(c => !c.atencion);
    const hoy = new Date(); hoy.setHours(0, 0, 0, 0);
    const hoyN = wa.chats.filter(c => new Date(c.ultimo_at) >= hoy).length;
    const row = c => {
      const p = pausedChat(c);
      const st = c.atencion ? `<em class="wa-st is-hot">Te necesita</em>` : p ? `<em class="wa-st is-you">Lo llevas tú</em>` : `<em class="wa-st">${I_BOT}Asistente</em>`;
      return `<button type="button" class="wa-row${c.atencion ? ' is-hot' : ''}" data-wa-chat="${esc(c.telefono)}">
        <span class="adm-av" aria-hidden="true">${esc(initials(c.nombre || '#'))}</span>
        <span class="wa-row-main"><b>${esc(c.nombre || telFmt(c.telefono))}${c.no_leidos ? `<i class="wa-unread">${c.no_leidos}</i>` : ''}</b><small>${c.atencion && c.motivo ? `<strong>${esc(c.motivo)}</strong>` : esc(String(c.ultimo_txt || '').replace(/\*/g, ''))}</small></span>
        <span class="wa-row-side"><small>${esc(ago(c.ultimo_at))}</small>${st}</span>
      </button>`;
    };
    box.innerHTML = `
      <div class="wa-top">
        <label class="wa-switch${on ? ' is-on' : ''}"><input type="checkbox" data-wa-bot${on ? ' checked' : ''}><span class="wa-knob" aria-hidden="true"></span><span class="wa-switch-t"><b>${on ? 'Asistente activado' : 'Asistente apagado'}</b><small>${on ? 'Contesta a los clientes al momento, las 24 h' : 'No contesta a nadie: todo te llega a ti'}</small></span></label>
        <label class="wa-hours"><span>Si contestas tú, se aparta de ese chat</span><select data-wa-horas>${[1, 3, 6, 12, 24, 48].map(h => `<option value="${h}"${+wa.cfg.horas_pausa === h ? ' selected' : ''}>${h} h</option>`).join('')}</select></label>
        <button type="button" class="btn btn--dark btn--sm" data-wa-probar>${I_BOT}Probar el asistente</button>
      </div>
      <div class="adm-rr-sum wa-sum">
        <div class="${need.length ? 'is-hot' : ''}"><b>${need.length}</b><span>${plural(need.length, 'Te necesita', 'Te necesitan')}</span></div>
        <div><b>${hoyN}</b><span>${plural(hoyN, 'Conversación hoy', 'Conversaciones hoy')}</span></div>
        <div><b>${wa.chats.filter(pausedChat).length}</b><span>Las llevas tú ahora</span></div>
        <div><b>${rows.filter(r => r.origen === 'whatsapp').length}</b><span>Solicitudes creadas por el asistente</span></div>
      </div>
      ${need.length ? `<section class="adm-sec"><div class="adm-sec-h"><h3>${I_WA}Te necesitan</h3></div><div class="wa-list">${need.map(row).join('')}</div></section>` : ''}
      <section class="adm-sec"><div class="adm-sec-h"><h3>${I_WA}${need.length ? 'El resto de conversaciones' : 'Conversaciones'}</h3></div>
        ${rest.length ? `<div class="wa-list">${rest.map(row).join('')}</div>` : `<p class="adm-docs-empty">${wa.chats.length ? 'Nada más por aquí.' : 'Todavía no ha escrito nadie. Cuando llegue un WhatsApp lo verás aquí al momento, con lo que ha contestado el asistente.'}</p>`}
      </section>`;
  }
  const bubble = m => {
    if(m.autor === 'sistema') return `<div class="wa-sys">${esc(m.texto || '')} · ${esc(hm(m.created_at))}</div>`;
    const who = m.dir === 'in' ? '' : m.autor === 'bot' ? `${I_BOT}Asistente` : m.autor === 'panel' ? 'Tú · desde el panel' : 'Tú · desde la app';
    const acc = (m.meta && m.meta.acciones || []).map(a => a.tipo === 'solicitud' ? `Creó la solicitud ${esc(a.ref)}` : a.tipo === 'humano' ? `Te pasó el chat: ${esc(a.resumen || a.motivo)}` : a.tipo === 'aviso_equipo' ? `Te deja una tarea: ${esc(a.resumen || '')}` : a.tipo === 'consulta' ? (a.encontrado ? 'Miró su viaje en su cuenta' : 'Buscó su cuenta (no la encontró)') : '').filter(Boolean);
    return `<div class="wa-msg is-${m.dir === 'in' ? 'in' : m.autor === 'bot' ? 'bot' : 'you'}">${who ? `<small>${who}</small>` : ''}<p>${esc(m.texto || '').replace(/\*(.+?)\*/g, '<b>$1</b>').replace(/\n/g, '<br>')}</p>${acc.length ? `<em>${acc.join(' · ')}</em>` : ''}<time>${esc(hm(m.created_at))}</time></div>`;
  };
  function paintWaChat(p){
    const tel = drawer.id, c = wa.chats.find(x => x.telefono === tel) || { telefono: tel };
    const msgs = wa.msgs[tel];
    if(msgs === undefined){ wa.msgs[tel] = null; loadWaMsgs(tel); }
    const paused = pausedChat(c);
    const sols = rows.filter(r => (r.origen === 'whatsapp' || r.telefono) && sameTel(r.telefono, tel));
    const fuera = !c.ultimo_in_at || Date.now() - new Date(c.ultimo_in_at) > 24 * 3600e3;
    const draft = (wa.drafts || (wa.drafts = {}))[tel] || '';
    p.innerHTML = head(esc(telFmt(tel)), esc(c.nombre || 'Cliente de WhatsApp')) + `
      ${c.atencion ? `<div class="wa-alert"><span>${I_BOT}</span><div><b>Te necesita</b><p>${esc(c.motivo || 'El asistente ha dejado este chat para ti.')}</p></div><button type="button" class="btn btn--dark btn--sm" data-wa-done="${esc(tel)}">Ya lo he atendido</button></div>` : ''}
      <div class="wa-state">
        ${paused ? `<span><b>Lo llevas tú.</b> El asistente vuelve a contestar ${c.pausa_hasta ? `el ${esc(new Date(c.pausa_hasta).toLocaleString('es-ES', { weekday: 'short', hour: '2-digit', minute: '2-digit' }))}` : 'cuando lo reactives'}.</span><button type="button" class="pl-link" data-wa-bot-chat="on">Que conteste el asistente</button>`
          : `<span>${I_BOT}<b>El asistente contesta en este chat.</b></span><button type="button" class="pl-link" data-wa-bot-chat="off">Lo llevo yo</button>`}
        <a class="pl-link" href="https://wa.me/${esc(tel)}" target="_blank" rel="noopener">Abrir en WhatsApp</a>
      </div>
      ${sols.length ? `<div class="wa-sols">${sols.map(r => `<button type="button" class="adm-gchip" data-open-route="${esc(r.id)}">${I_DOC}${esc(r.ref)} · ${esc(LABEL[r.estado] || r.estado)}</button>`).join('')}</div>` : ''}
      <div class="wa-thread" id="waThread">${msgs == null ? '<div class="auth-spin"></div>' : msgs.length ? msgs.map(bubble).join('') : '<p class="adm-docs-empty">Sin mensajes.</p>'}</div>
      <div class="wa-reply">
        ${fuera ? '<p class="wa-note">Han pasado más de 24 h desde su último mensaje: WhatsApp no deja escribirle desde aquí hasta que vuelva a escribir (o desde la app con una plantilla).</p>' : ''}
        <textarea id="waTxt" rows="2" maxlength="4000" placeholder="Escribe tu respuesta…"${fuera ? ' disabled' : ''}>${esc(draft)}</textarea>
        <div class="wa-reply-act"><small>Al contestar tú, el asistente se aparta de este chat ${esc(String(wa.cfg ? wa.cfg.horas_pausa : 12))} h.</small><button type="button" class="btn btn--primary btn--sm" data-wa-send="${esc(tel)}"${fuera ? ' disabled' : ''}>Enviar</button></div>
      </div>`;
    const th = $('#waThread'); if(th) th.scrollTop = th.scrollHeight;
  }
  function paintWaProbar(p){
    const sb2 = sandbox || (sandbox = { hist: [], tel: '', busy: false, acc: [] });
    const ideas = ['¿Qué hacéis exactamente?', 'Somos 6 y queremos ir al Ultra desde Valencia', '¿Cuánto se tarda de Praga a Budapest?', '¿Cuánto me falta por pagar?', 'Quiero hablar con una persona'];
    p.innerHTML = head('Modo prueba', 'Probar el asistente') + `
      <p class="adm-hint">Escribe como si fueras un cliente. No se envía nada por WhatsApp ni se crea ninguna solicitud de verdad.</p>
      <label class="adm-f-field wa-probar-tel"><span>Probar como el número de un cliente (opcional, para ver su viaje)</span><input class="pl-input" id="waTestTel" inputmode="tel" placeholder="+34 600 000 000" value="${esc(sb2.tel)}"></label>
      <div class="wa-thread is-test" id="waThread">${sb2.hist.length ? sb2.hist.map(h => h.de === 'nota' ? `<div class="wa-sys">${esc(h.texto)}</div>` : bubble({ dir: h.de === 'cliente' ? 'in' : 'out', autor: 'bot', texto: h.texto, created_at: h.t })).join('') : '<p class="adm-docs-empty">Prueba con una de estas:</p>'}${sb2.busy ? '<div class="wa-msg is-bot is-typing"><p><i></i><i></i><i></i></p></div>' : ''}</div>
      ${sb2.hist.length ? '' : `<div class="wa-ideas">${ideas.map(t => `<button type="button" class="adm-gchip" data-wa-idea="${esc(t)}">${esc(t)}</button>`).join('')}</div>`}
      <div class="wa-reply"><textarea id="waTestTxt" rows="2" maxlength="1000" placeholder="Escribe como un cliente…"${sb2.busy ? ' disabled' : ''}></textarea>
        <div class="wa-reply-act">${sb2.hist.length ? '<button type="button" class="pl-link" data-wa-reset>Empezar de nuevo</button>' : '<span></span>'}<button type="button" class="btn btn--primary btn--sm" data-wa-test${sb2.busy ? ' disabled' : ''}>Enviar</button></div></div>`;
    const th = $('#waThread'); if(th) th.scrollTop = th.scrollHeight;
  }
  async function waProbar(texto){
    const sb2 = sandbox; texto = String(texto || '').trim(); if(!texto || sb2.busy) return;
    const hist = sb2.hist.filter(h => h.de !== 'nota').map(h => ({ de: h.de, texto: h.texto }));
    sb2.hist.push({ de: 'cliente', texto, t: new Date().toISOString() }); sb2.busy = true; paintDrawer();
    const r = await waCall({ action: 'probar', texto, historial: hist, telefono: sb2.tel || null });
    sb2.busy = false;
    if(!r.ok){ sb2.hist.push({ de: 'nota', texto: 'Error: ' + (r.error || 'no se pudo') }); paintDrawer(); return; }
    (r.acciones || []).forEach(a => sb2.hist.push({ de: 'nota', texto: a.tipo === 'solicitud' ? `→ Crearía una solicitud: ${[a.datos.viajeros && a.datos.viajeros + ' personas', a.datos.salida, (a.datos.paradas || []).map(x => x.ciudad).join(', '), a.datos.fecha_salida].filter(Boolean).join(' · ')}` : a.tipo === 'humano' ? `→ Te pasaría el chat: ${a.resumen || a.motivo}` : a.tipo === 'aviso_equipo' ? `→ Te dejaría una tarea: ${a.resumen || ''}` : a.tipo === 'consulta' ? `→ Ha consultado el viaje del cliente (${a.encontrado ? 'encontrado' : 'no encontrado'})` : '' }));
    if(r.respuesta) sb2.hist.push({ de: 'bot', texto: r.respuesta, t: new Date().toISOString() });
    paintDrawer(); setTimeout(() => { const i = $('#waTestTxt'); if(i) i.focus(); }, 30);
  }
  $('#waList').addEventListener('click', e => {
    const c = e.target.closest('[data-wa-chat]'); if(c) return openDrawer({ kind: 'wa-chat', id: c.dataset.waChat });
    if(e.target.closest('[data-wa-probar]')) return openDrawer({ kind: 'wa-probar', id: 'probar' });
  });
  $('#waList').addEventListener('change', async e => {
    const t = e.target;
    if(t.matches('[data-wa-bot]')){
      const v = t.checked; wa.cfg.bot_activo = v; paintWa();
      const { error } = await IB.sb.from('wa_config').update({ bot_activo: v, updated_at: new Date().toISOString() }).eq('id', 1);
      if(error){ wa.cfg.bot_activo = !v; paintWa(); return toast(setupErr(error), true); }
      toast(v ? 'Asistente activado: contesta a los clientes' : 'Asistente apagado: todos los mensajes te llegan a ti');
    }
    if(t.matches('[data-wa-horas]')){
      const h = +t.value; wa.cfg.horas_pausa = h;
      const { error } = await IB.sb.from('wa_config').update({ horas_pausa: h }).eq('id', 1);
      toast(error ? setupErr(error) : `Cuando contestes tú, el asistente se aparta ${h} h de ese chat`, !!error);
    }
  });
  $('#admDrawer').addEventListener('input', e => { if(e.target.id === 'waTxt' && drawer && drawer.kind === 'wa-chat'){ (wa.drafts || (wa.drafts = {}))[drawer.id] = e.target.value; } if(e.target.id === 'waTestTel' && sandbox) sandbox.tel = e.target.value; });
  $('#admDrawer').addEventListener('keydown', e => {
    if(e.key === 'Enter' && !e.shiftKey && (e.target.id === 'waTestTxt' || e.target.id === 'waTxt')){ e.preventDefault(); const b = $(e.target.id === 'waTxt' ? '[data-wa-send]' : '[data-wa-test]'); if(b && !b.disabled) b.click(); }
  });
  $('#admDrawer').addEventListener('click', async e => {
    const t = e.target;
    const dn = t.closest('[data-wa-done]'); if(dn) return waChat(dn.dataset.waDone, { atencion: false, motivo: null }, 'Marcado como atendido');
    const bc = t.closest('[data-wa-bot-chat]');
    if(bc && drawer){ const on = bc.dataset.waBotChat === 'on'; return waChat(drawer.id, on ? { modo: 'bot', pausa_hasta: null } : { modo: 'humano', pausa_hasta: null }, on ? 'El asistente vuelve a contestar en este chat' : 'Este chat lo llevas tú: el asistente no contesta'); }
    const sd = t.closest('[data-wa-send]');
    if(sd){
      const tel = sd.dataset.waSend, txt = ($('#waTxt').value || '').trim(); if(!txt) return;
      sd.disabled = true;
      const r = await waCall({ action: 'enviar', telefono: tel, texto: txt });
      sd.disabled = false;
      if(!r.ok) return toast(esc(r.error || 'No se pudo enviar'), true);
      wa.drafts[tel] = ''; toast('Enviado'); loadWaMsgs(tel); loadWa(); return;
    }
    const id = t.closest('[data-wa-idea]'); if(id) return waProbar(id.dataset.waIdea);
    if(t.closest('[data-wa-test]')){ const i = $('#waTestTxt'); const v = i.value; i.value = ''; return waProbar(v); }
    if(t.closest('[data-wa-reset]')){ sandbox.hist = []; paintDrawer(); }
  });

  /* ---------- grupos ---------- */
  function paintGroups(){
    const box = $('#gruList');
    if(groupsErr){ box.innerHTML = `<div class="adm-empty"><b>Los grupos aún no están activados.</b><span>${esc(groupsErr)}</span></div>`; return; }
    if(!groups.length){ box.innerHTML = '<div class="adm-empty"><b>Todavía no hay grupos.</b><span>Crea uno aquí o selecciona personas en «Clientes» y júntalas en un grupo.</span></div>'; return; }
    // los VIP primero; dentro de cada bloque se mantiene el orden de creación
    box.innerHTML = groups.slice().sort((a, b) => (!!b.vip - !!a.vip)).map(g => {
      const ms = membersOf(g.id), rs = rows.filter(r => String(r.grupo_id) === String(g.id)), m = pagosErr ? null : groupMoney(g.id);
      const pct = m && m.total ? Math.min(100, Math.floor(m.cubierto / m.total * 100)) : 0;
      const money = m && m.total ? `<span class="adm-gcard-money"><span><b>${eur(m.cubierto)}</b> de ${eur(m.total)}${m.pend ? ` · ${m.pend} ${plural(m.pend, 'debe', 'deben')}` : ' · todo cobrado'}</span>${m.extra > 0 ? `<em class="adm-gcard-extra">${eur(m.extra)} cobrados de más: revísalo</em>` : ''}<span class="adm-bar-p${m.falta ? '' : ' is-full'}"><i style="width:${pct}%"></i></span></span>` : '';
      return `<button type="button" class="adm-gcard${g.vip ? ' is-vip' : ''}" data-open-group="${esc(g.id)}">
        <span class="adm-gcard-top"><b>${g.vip ? `<i class="adm-gcard-vip" title="Grupo VIP">${I_STAR}VIP</i>` : ''}${esc(g.nombre)}</b><small>${ms.length} ${plural(ms.length, 'persona', 'personas')}</small></span>
        <span class="adm-avs">${ms.slice(0, 7).map(c => `<i>${esc(initials(clientName(c)))}</i>`).join('')}${ms.length > 7 ? `<i>+${ms.length - 7}</i>` : ''}</span>
        ${money}
        <span class="adm-gcard-foot">${rs.length ? esc(rs.map(r => ((r.paradas || []).slice(-1)[0] || {}).ciudad || r.salida).join(' · ')) : 'Sin ruta todavía'}</span>
      </button>`;
    }).join('');
  }

  /* ---------- drawer ---------- */
  function openDrawer(d){
    const same = drawer && drawer.kind === d.kind && String(drawer.id) === String(d.id);
    drawer = d;
    if(d.kind === 'ruta') loadDocs('r:' + d.id);
    if(d.kind === 'grupo') loadDocs('g:' + d.id);
    paintDrawer();
    const el = $('#admDrawer');
    if(el.hidden){
      el.hidden = false;
      requestAnimationFrame(() => el.classList.add('is-open'));
      document.body.classList.add('menu-open');
    }
    if(!same) $('.adm-panel').scrollTop = 0;
    setTimeout(() => $('.adm-panel').focus({ preventScroll: true }), 50);
  }
  function closeDrawer(){
    const el = $('#admDrawer'); el.classList.remove('is-open');
    document.body.classList.remove('menu-open');
    setTimeout(() => { el.hidden = true; }, 260);
    const prev = drawer; drawer = null;
    const btn = prev && prev.kind === 'ruta' ? $(`.adm-row[data-id="${prev.id}"]`) : null; if(btn) btn.focus();
  }
  function paintDrawer(){
    if(!drawer) return;
    const p = $('.adm-panel');
    if(drawer.kind === 'ruta') paintRoute(p);
    else if(drawer.kind === 'grupo') paintGroup(p);
    else if(drawer.kind === 'nueva') paintNew(p);
    else if(drawer.kind === 'nuevo-grupo') paintNewGroup(p);
    else if(drawer.kind === 'nuevo-aviso') paintNewAviso(p);
    else if(drawer.kind === 'wa-chat') paintWaChat(p);
    else if(drawer.kind === 'wa-probar') paintWaProbar(p);
  }
  const head = (mono, title) => `<div class="adm-p-head"><div><span class="mono">${mono}</span><h2 id="admDTitle">${title}</h2></div><button type="button" class="icon-btn" data-close aria-label="Cerrar">${I_X}</button></div>`;

  /* ---------- ficha de ruta ---------- */
  function summary(r){
    return `${r.ref} · ${r.nombre}\nTel: ${r.telefono || '—'} · ${r.email || '—'}\nSalida: ${r.salida} · ${fdate(r.fecha_salida)}${r.flexible ? ' (flexible)' : ''}\n` +
      `${r.dias} días · ${r.viajeros} viajeros\nRuta: ${(r.paradas || []).map(p => `${p.ciudad} (${p.dias}d)`).join(' → ')}\n` +
      `Estilo: ${(r.estilo || []).join(', ') || '—'} · Alojamiento: ${r.alojamiento || '—'} · Presupuesto: ${r.presupuesto || '—'}` +
      (r.notas ? `\nNotas: ${r.notas}` : '');
  }
  const noteOf = r => notesTable ? ((notes[r.id] || {}).nota || '') : (r.nota_interna || '');
  function paintRoute(p){
    const r = rows.find(x => String(x.id) === String(drawer.id));
    if(!r){ p.innerHTML = head('', 'Ruta') + '<p class="adm-empty">Esta ruta ya no existe.</p>'; return; }
    const g = r.grupo_id ? groupById(r.grupo_id) : null;
    const hello = `Hola ${String(r.nombre).split(' ')[0]}, soy de Iberail 👋 Te escribo por tu ruta ${r.ref} (${r.salida} → ${((r.paradas || []).slice(-1)[0] || {}).ciudad || ''}, ${r.dias} días). `;
    const tel = waPhone(r.telefono);
    p.innerHTML = head(`${esc(r.ref)} · ${esc(new Date(r.created_at).toLocaleString('es-ES', { dateStyle: 'medium', timeStyle: 'short' }))}${r.creada_por_equipo ? ' · preparada por Iberail' : ''}`, esc(r.nombre)) + `
      ${g ? `<button type="button" class="adm-p-group" data-open-group="${esc(g.id)}">${I_USERS}<span><b>Ruta del grupo «${esc(g.nombre)}»</b>${membersOf(g.id).length} personas la ven en su cuenta</span></button>` : ''}
      <div class="adm-p-actions">
        ${tel ? `<a class="btn btn--wa" href="${esc(IB.wa(hello, tel))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}
        ${r.email ? `<a class="btn btn--ghost btn--sm" href="mailto:${esc(r.email)}?subject=${encodeURIComponent('Tu ruta Interrail ' + r.ref + ' · Iberail')}">Correo</a>` : ''}
        <button type="button" class="btn btn--ghost btn--sm" data-copy>Copiar resumen</button>
      </div>
      ${r.telefono || r.email ? `<dl class="adm-p-contact">${r.telefono ? `<div><dt>WhatsApp</dt><dd>${esc(r.telefono)}</dd></div>` : ''}${r.email ? `<div><dt>Correo</dt><dd>${esc(r.email)}</dd></div>` : ''}</dl>` : ''}
      <div class="adm-p-status" role="radiogroup" aria-label="Estado">${Object.keys(LABEL).map(k => `<button type="button" role="radio" aria-checked="${r.estado === k}" data-st="${k}" class="st st--${k}${r.estado === k ? ' is-on' : ''}">${LABEL[k]}</button>`).join('')}</div>
      <div class="adm-p-map"><svg id="admMap" viewBox="0 0 545 500" role="img" aria-label="Mapa de la ruta"></svg></div>
      <dl class="adm-p-facts">
        <div><dt>Salida</dt><dd>${esc(r.salida)} · ${esc(fdate(r.fecha_salida))}${r.flexible ? ' · flexible' : ''}</dd></div>
        <div><dt>Viaje</dt><dd>${esc(r.dias)} días · ${esc(r.viajeros)} viajeros</dd></div>
        ${r.creada_por_equipo ? '' : `<div><dt>Estilo</dt><dd>${esc((r.estilo || []).join(', ') || '—')}</dd></div>
        <div><dt>Alojamiento</dt><dd>${esc(r.alojamiento || '—')}</dd></div>
        <div><dt>Presupuesto</dt><dd>${esc(r.presupuesto || '—')}</dd></div>`}
        ${'acepta_publicidad' in r && !r.creada_por_equipo ? `<div><dt>Publicidad</dt><dd>${r.acepta_publicidad ? 'Acepta recibir ofertas por correo' : 'No acepta ofertas'}</dd></div>` : ''}
      </dl>
      ${(() => { const it = itinerary(r.fecha_salida, r.paradas || []); return `<ol class="adm-p-stops">${(r.paradas || []).map((s, i) => `<li><span>${String(i + 1).padStart(2, '0')}</span><b>${esc(s.ciudad)}${it && it.legs[i] ? `<small class="adm-stop-dates">${esc(dShort(it.legs[i].a))} → ${esc(dShort(it.legs[i].l))}</small>` : ''}</b><em>${esc(s.pais || '')}</em><i>${esc(s.dias)} d</i></li>`).join('')}</ol>
        ${it ? `<p class="adm-hint">Vuelta el <b>${esc(dLong(it.end))}</b>.${(() => { const u = ultraCheck(r.fecha_salida, r.paradas || []); return u && !u.lejos ? (u.ok ? ' ✓ Cubre el Ultra.' : ' ⚠ Split no cubre las noches del Ultra (9–11 jul).') : ''; })()}</p>` : ''}`; })()}
      ${!r.creada_por_equipo && (r.paradas || []).length ? `<div class="adm-p-assign">
        ${r.grupo_id ? '' : `<button type="button" class="btn btn--dark btn--sm" data-assign="grupo">${I_USERS}Asignar a un grupo</button>`}
        <button type="button" class="btn btn--ghost btn--sm" data-assign="cliente">Preparar su ruta${r.user_id ? '' : ' (sin cuenta)'}</button>
        <small>Abre «Nueva ruta» ya rellena con lo que pidió: solo eliges ${r.grupo_id ? 'el estado' : 'el grupo'} y guardas.</small>
      </div>` : ''}
      ${r.notas ? `<div class="adm-p-notes"><h3>Notas del cliente</h3><p>${esc(r.notas)}</p></div>` : ''}
      <section class="adm-docs" data-docs="r:${esc(r.id)}">${docsHtml('r:' + r.id, r)}</section>
      ${r.user_id || r.grupo_id ? `<section class="adm-sec"><div class="adm-sec-h"><h3>${I_BELL}Avisos de esta ruta</h3></div>${avisosHtml(avisos.filter(a => String(a.ruta_id) === String(r.id)), `data-new-aviso-route="${esc(r.id)}"`, r.grupo_id ? 'Nuevo aviso a los del grupo' : 'Nuevo aviso al cliente')}</section>` : ''}
      <div class="adm-p-internal"><label for="admNote">Nota interna <small>solo la ve el equipo</small></label><textarea id="admNote" maxlength="2000" placeholder="Precio enviado, alojamiento reservado, lo que quieras recordar…">${esc(noteOf(r))}</textarea><button type="button" class="btn btn--dark btn--sm" data-save>Guardar nota</button></div>
      <div class="adm-p-danger"><button type="button" class="pl-link dash-del" data-del-route>Eliminar esta ruta</button></div>`;
    const stops = (r.paradas || []).map(s => { const c = findCity(s.ciudad); return c ? { n: c.n, lon: c.lon, lat: c.lat, cc: c.cc } : { n: s.ciudad }; });
    const o = findCity(r.salida);
    if(window.IBMap) IBMap.draw($('#admMap'), o ? { n: r.salida, lon: o.lon, lat: o.lat } : null, stops, { zoom: false, train: false });
  }
  async function setStatus(r, st){
    const prev = r.estado; r.estado = st; paintAll(); paintDrawer();
    const { error } = await IB.sb.from('rutas').update({ estado: st }).eq('id', r.id);
    if(error){ r.estado = prev; paintAll(); paintDrawer(); toast('No se pudo cambiar el estado: ' + IB.errMsg(error), true); }
  }
  async function saveNote(r){
    const v = $('#admNote').value.trim();
    let error;
    if(notesTable) ({ error } = await IB.sb.from('rutas_notas').upsert({ ruta_id: r.id, nota: v || null, updated_at: new Date().toISOString() }));
    else ({ error } = await IB.sb.from('rutas').update({ nota_interna: v || null }).eq('id', r.id));
    if(error) return toast('No se pudo guardar: ' + IB.errMsg(error), true);
    if(notesTable) notes[r.id] = { ruta_id: r.id, nota: v }; else r.nota_interna = v;
    toast('Nota guardada');
  }
  async function deleteRoute(r){
    const key = 'r:' + r.id;
    if(!Array.isArray(docs[key])) await loadDocs(key);
    const paths = (Array.isArray(docs[key]) ? docs[key] : []).map(d => d.archivo).filter(Boolean);
    if(paths.length) await IB.sb.storage.from(BUCKET).remove(paths);
    const { error } = await IB.sb.from('rutas').delete().eq('id', r.id);
    if(error) return toast('No se pudo eliminar: ' + IB.errMsg(error), true);
    rows = rows.filter(x => x.id !== r.id); delete docs[key];
    closeDrawer(); paintAll(); toast('Ruta eliminada');
  }

  /* ---------- documentos (billetes de avión y más) ---------- */
  async function loadDocs(key){
    docs[key] = null; paintDocs(key);
    const [kind, id] = key.split(':');
    const { data, error } = await IB.sb.from('documentos').select('*').eq(kind === 'r' ? 'ruta_id' : 'grupo_id', id).order('fecha', { ascending: true }).order('hora', { ascending: true });
    docs[key] = error ? { error: setupErr(error) } : (data || []);
    paintDocs(key);
  }
  function paintDocs(key){
    const box = $(`.adm-docs[data-docs="${key}"]`); if(!box) return;
    const [kind, id] = key.split(':');
    const ctx = kind === 'r' ? rows.find(r => String(r.id) === id) : groupById(id);
    if(ctx) box.innerHTML = docsHtml(key, ctx);
  }
  const docLine = d => d.tipo === 'vuelo'
    ? [d.fecha ? fdate(d.fecha) : '', ftime(d.hora), [d.compania, d.numero].filter(Boolean).join(' '), d.localizador ? 'Loc. ' + d.localizador : ''].filter(Boolean).join(' · ')
    : [d.fecha ? fdate(d.fecha) : '', d.notas || ''].filter(Boolean).join(' · ');
  function docsHtml(key, ctx){
    const list = docs[key], isGroup = key[0] === 'g';
    const dr = drafts[key] || (drafts[key] = { tipo: 'vuelo', v: {}, files: [], open: false });
    let items;
    if(list === undefined || list === null) items = '<div class="auth-spin adm-docs-spin"></div>';
    else if(list.error) items = `<p class="adm-docs-empty is-err">${esc(list.error)}</p>`;
    else if(!list.length) items = `<p class="adm-docs-empty">Todavía no has subido nada${isGroup ? ' al grupo' : ''}.</p>`;
    else items = `<ul class="adm-docs-list">${list.map(d => `<li>
        <span class="adm-docs-ic">${d.tipo === 'vuelo' ? I_PLANE : I_DOC}</span>
        <span class="adm-docs-main"><b>${d.tipo === 'vuelo' ? `${esc(code(d.origen))} → ${esc(code(d.destino))}` : esc(d.titulo || 'Documento')}</b><small>${esc(docLine(d)) || '&nbsp;'}</small><em>${esc(d.archivo_nombre || 'Sin archivo')}</em></span>
        <span class="adm-docs-act">${d.archivo ? `<button type="button" class="pl-link" data-doc-view="${esc(d.id)}">Ver</button>` : ''}<button type="button" class="pl-link dash-del" data-doc-del="${esc(d.id)}">Borrar</button></span>
      </li>`).join('')}</ul>`;
    const has = Array.isArray(list) && list.length;
    const v = dr.v, vuelo = dr.tipo === 'vuelo', n = dr.files.length;
    const f = (id, label, type, extra) => `<label class="adm-f-field"><span>${label}</span><input class="pl-input" data-dv="${id}" type="${type || 'text'}" value="${esc(v[id] || '')}" ${extra || ''}></label>`;
    const who = isGroup ? `todos los del grupo (${membersOf(ctx.id).length})` : (ctx.grupo_id ? 'todos los del grupo' : 'el cliente');
    const first = isGroup ? '' : String(ctx.nombre || '').split(' ')[0];
    const notifyText = isGroup
      ? `¡Hola! Ya tenéis los billetes y documentos del viaje en vuestra cuenta de Iberail ✈️ Entrad aquí para verlos y descargarlos: ${location.origin}/cuenta.html`
      : `Hola ${first}, ya tienes tus billetes en tu cuenta de Iberail ✈️ Los puedes ver y descargar aquí: ${location.origin}/cuenta.html`;
    const tel = !isGroup && waPhone(ctx.telefono);
    return `<div class="adm-docs-head"><h3>${I_PLANE}${isGroup ? 'Documentos del grupo' : 'Billetes y documentos'}</h3><small>${has ? `${list.length} · ` : ''}los ve ${esc(who)} en su cuenta</small></div>
      ${items}
      ${has ? `<div class="adm-docs-notify">${tel ? `<a class="btn btn--wa btn--sm" href="${esc(IB.wa(notifyText, tel))}" target="_blank" rel="noopener">Avisar por WhatsApp</a>` : ''}<button type="button" class="btn btn--ghost btn--sm" data-copy-notify="${esc(notifyText)}">Copiar aviso${isGroup || ctx.grupo_id ? ' para el grupo de WhatsApp' : ''}</button></div>` : ''}
      <details class="adm-docs-add" data-key="${esc(key)}"${dr.open || !has ? ' open' : ''}>
        <summary>${I_PLUS}${isGroup ? 'Subir billete o documento al grupo' : 'Subir billete o documento'}</summary>
        <div class="adm-seg" role="radiogroup" aria-label="Tipo">
          <button type="button" role="radio" data-dtipo="vuelo" aria-checked="${vuelo}">Billete de avión</button>
          <button type="button" role="radio" data-dtipo="otro" aria-checked="${!vuelo}">Otro documento</button>
        </div>
        <div class="adm-f-grid">
          ${vuelo ? f('origen', 'Origen', 'text', 'placeholder="Madrid (MAD)" maxlength="80" list="admAirports"') + f('destino', 'Destino', 'text', 'placeholder="Split (SPU)" maxlength="80" list="admAirports"') +
            f('fecha', 'Fecha', 'date') + f('hora', 'Hora de salida', 'time') +
            f('compania', 'Compañía', 'text', 'placeholder="Vueling" maxlength="60"') + f('numero', 'Nº de vuelo (solo el número)', 'text', 'placeholder="IB0791" maxlength="20"') +
            f('localizador', 'Localizador', 'text', 'placeholder="ABC123" maxlength="20"')
            : f('fecha', 'Fecha (opcional)', 'date') +
            `<label class="adm-f-field adm-f-wide"><span>Nota para todos (opcional)</span><input class="pl-input" data-dv="notas" type="text" value="${esc(v.notas || '')}" maxlength="500" placeholder="Ej.: llevadlo impreso"></label>`}
        </div>
        <label class="adm-file${n ? ' has-file' : ''}"><input type="file" data-dfile multiple accept="application/pdf,image/jpeg,image/png,image/webp,image/heic,.heic"><span>${I_DOC}${n ? `<b>Añadir más archivos</b>` : `<b>Toca o arrastra aquí los archivos</b>`}<small>PDF o fotos · máx. 10 MB cada uno · puedes subir varios a la vez</small></span></label>
        ${n ? `<ul class="adm-flist">${dr.files.map((x, i) => `<li class="${x.state ? 'is-' + x.state : ''}">
            <span class="adm-flist-ic">${x.state === 'ok' ? '✓' : x.state === 'err' ? '!' : (/\.pdf$/i.test(x.file.name) ? 'PDF' : 'IMG')}</span>
            <label class="adm-flist-main"><small>${esc(x.file.name)} · ${kb(x.file.size)}</small><input class="pl-input" data-flabel="${i}" value="${esc(x.label)}" maxlength="${vuelo ? 300 : 120}" placeholder="${vuelo ? 'Pasajero(s) de este billete' : 'Nombre del documento'}" aria-label="${vuelo ? 'Pasajeros del billete' : 'Nombre del documento'} ${esc(x.file.name)}"${dr.busy ? ' disabled' : ''}></label>
            ${dr.busy ? '' : `<button type="button" class="icon-btn" data-frm="${i}" aria-label="Quitar ${esc(x.file.name)}">${I_X}</button>`}
          </li>`).join('')}</ul>` : ''}
        ${dr.busy ? `<div class="adm-up"><div class="adm-bar-p"><i style="width:${Math.round(dr.done / n * 100)}%"></i></div><small>Subiendo ${Math.min(dr.done + 1, n)} de ${n}…</small></div>` : ''}
        <button type="button" class="btn btn--dark btn--sm" data-doc-save${dr.busy ? ' disabled' : ''}>${n > 1 ? `Guardar ${n} ${vuelo ? 'billetes' : 'documentos'}` : 'Guardar'}${isGroup ? ' en el grupo' : ''}</button>
      </details>`;
  }
  const OK_TYPE = f => /^(application\/pdf|image\/(jpeg|png|webp|heic|heif))$/.test(f.type || '') || /\.(pdf|jpe?g|png|webp|heic)$/i.test(f.name);
  const niceName = n => { const b = String(n || '').replace(/\.[a-z0-9]+$/i, '').replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim(); return (b.charAt(0).toUpperCase() + b.slice(1)).slice(0, 120); };
  // añade archivos al borrador (desde el selector o arrastrándolos)
  function addFiles(key, list){
    const dr = drafts[key]; if(!dr || dr.busy) return;
    const bad = [];
    Array.from(list || []).forEach(file => {
      if(file.size > MAX_FILE) return bad.push(`${file.name} (pesa más de 10 MB)`);
      if(!OK_TYPE(file)) return bad.push(`${file.name} (no es PDF ni foto)`);
      if(dr.files.some(x => x.file.name === file.name && x.file.size === file.size)) return;
      dr.files.push({ file, label: dr.tipo === 'vuelo' ? '' : niceName(file.name), state: '' });
    });
    dr.open = true; paintDocs(key);
    if(bad.length) toast(`No se ${bad.length === 1 ? 'ha añadido' : 'han añadido'}: ${esc(bad.join(', '))}`, true);
  }
  async function saveDoc(key){
    const dr = drafts[key]; if(!dr || dr.busy) return;
    const v = dr.v, [kind, id] = key.split(':'), vuelo = dr.tipo === 'vuelo';
    const t = s => String(s || '').trim();
    const todo = dr.files.filter(x => x.state !== 'ok');
    if(vuelo && (!t(v.origen) || !t(v.destino))) return toast('Pon el origen y el destino del vuelo.', true);
    if(!todo.length) return toast('Falta el archivo: sube el PDF o una foto.', true);
    if(!vuelo){ const empty = todo.find(x => !t(x.label)); if(empty) return toast(`Ponle nombre a «${esc(empty.file.name)}».`, true); }
    dr.busy = true; dr.done = 0; paintDocs(key);
    let ok = 0; const errs = [];
    for(const x of todo){
      const file = x.file;
      const path = `${kind}/${id}/${Date.now()}-${Math.random().toString(36).slice(2, 6)}-${safeName(file.name)}`;
      const up = await IB.sb.storage.from(BUCKET).upload(path, file, { contentType: file.type || (/\.heic$/i.test(file.name) ? 'image/heic' : undefined), upsert: false });
      if(up.error){ x.state = 'err'; errs.push(setupErr(up.error)); dr.done++; paintDocs(key); continue; }
      const row = {
        [kind === 'r' ? 'ruta_id' : 'grupo_id']: Number(id), tipo: vuelo ? 'vuelo' : 'otro',
        titulo: vuelo ? null : t(x.label), fecha: v.fecha || null, notas: vuelo ? null : (t(v.notas) || null),
        origen: vuelo ? t(v.origen) : null, destino: vuelo ? t(v.destino) : null, hora: vuelo ? (v.hora || null) : null,
        compania: vuelo ? (t(v.compania) || null) : null, numero: vuelo ? (t(v.numero).toUpperCase() || null) : null,
        localizador: vuelo ? (t(v.localizador).toUpperCase() || null) : null, pasajeros: vuelo ? (t(x.label) || null) : null,
        archivo: path, archivo_nombre: file.name.slice(-160)
      };
      const { data, error } = await IB.sb.from('documentos').insert(row).select().single();
      if(error){ await IB.sb.storage.from(BUCKET).remove([path]); x.state = 'err'; errs.push(setupErr(error)); dr.done++; paintDocs(key); continue; }
      x.state = 'ok'; ok++; dr.done++;
      docs[key] = (Array.isArray(docs[key]) ? docs[key] : []).concat(data)
        .sort((a, b) => String(a.fecha || '9999').localeCompare(String(b.fecha || '9999')) || String(a.hora || '').localeCompare(String(b.hora || '')));
      paintDocs(key);
    }
    dr.busy = false;
    const shared = kind === 'g' || !!(rows.find(r => String(r.id) === id) || {}).grupo_id;
    if(!errs.length){
      drafts[key] = { tipo: dr.tipo, v: {}, files: [], open: false };
      paintDocs(key);
      toast(`${ok === 1 ? 'Subido' : `${ok} ${vuelo ? 'billetes subidos' : 'documentos subidos'}`}. ${shared ? `Ya ${ok === 1 ? 'lo' : 'los'} ven todos los del grupo en su cuenta.` : `Ya ${ok === 1 ? 'lo' : 'los'} tiene en su cuenta.`}`);
    } else {
      dr.files = dr.files.filter(x => x.state !== 'ok'); dr.files.forEach(x => x.state = 'err');
      paintDocs(key);
      toast(`${ok ? `${ok} subido${ok === 1 ? '' : 's'}. ` : ''}${errs.length === 1 ? 'Uno no se ha podido subir' : `${errs.length} no se han podido subir`}: ${esc(errs[0])} Puedes volver a intentarlo.`, true);
    }
  }
  async function viewDoc(key, did){
    const d = (docs[key] || []).find(x => String(x.id) === String(did)); if(!d || !d.archivo) return;
    const w = window.open('', '_blank');
    const { data, error } = await IB.sb.storage.from(BUCKET).createSignedUrl(d.archivo, 300);
    if(error || !data){ if(w) w.close(); return toast(setupErr(error), true); }
    if(w) w.location.href = data.signedUrl; else location.href = data.signedUrl;
  }
  async function deleteDoc(key, did){
    const d = (docs[key] || []).find(x => String(x.id) === String(did)); if(!d) return;
    const { error } = await IB.sb.from('documentos').delete().eq('id', d.id);
    if(error) return toast('No se pudo borrar: ' + setupErr(error), true);
    if(d.archivo) await IB.sb.storage.from(BUCKET).remove([d.archivo]);
    docs[key] = docs[key].filter(x => x !== d); paintDocs(key); toast('Borrado');
  }

  /* ---------- pagos por persona (dentro de la ficha de grupo) ---------- */
  const today = () => new Date().toISOString().slice(0, 10);
  function moneyHtml(m){
    const pct = m.total ? Math.min(100, Math.floor(m.cubierto / m.total * 100)) : 0;
    const who = m.deMas.map(x => `${clientName(clients.find(c => c.id === x.uid))} (+${eur(x.x)})`).join(', ');
    return `<div class="adm-money">
        <div><small>A cobrar</small><b>${eur(m.total)}</b></div>
        <div><small>Cobrado</small><b>${eur(m.cobrado)}</b></div>
        <div class="${m.falta > 0 ? 'is-due' : ''}"><small>Falta</small><b>${eur(m.falta)}</b></div>
      </div>
      <div class="adm-bar-p${m.total && !m.falta ? ' is-full' : ''}" role="img" aria-label="Cubierto el ${pct}%"><i style="width:${pct}%"></i></div>
      ${m.extra > 0 ? `<p class="adm-extra"><b>Hay ${eur(m.extra)} cobrados de más.</b> ${esc(who)}: ${m.deMas.length === 1 ? 'ha pagado' : 'han pagado'} más de lo que ${m.deMas.length === 1 ? 'le toca' : 'les toca'}. Revisa si hay un pago apuntado dos veces.</p>` : ''}`;
  }
  function payRow(g, c){
    const m = memberRow(g.id, c.id) || { importe: 0 };
    const imp = Number(m.importe || 0), pag = pagadoOf(g.id, c.id), full = !!m.pagado || (imp > 0 && pag >= imp), falta = full ? 0 : Math.max(0, imp - pag);
    const list = pagosOf(g.id, c.id).slice().sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)) || b.id - a.id);
    const dr = payDrafts[c.id] || (payDrafts[c.id] = { open: false, importe: '', fecha: today(), nota: '' });
    const tel = waPhone(c.telefono);
    const nudge = `Hola ${clientName(c).split(' ')[0]}, te escribo de Iberail por el viaje «${g.nombre}». Te ${plural(falta, 'queda', 'quedan')} ${eur(falta)} por pagar (llevas ${eur(pag)} de ${eur(imp)}). Lo tienes todo en tu cuenta: ${location.origin}/cuenta.html#grupos`;
    const over = imp > 0 && pag > imp ? pag - imp : 0;
    const state = over ? `<em class="adm-pay-st is-over">+${eur(over)} de más</em>` : full ? '<em class="adm-pay-st is-paid">✓ Todo pagado</em>' : !imp ? '<em class="adm-pay-st">Sin importe</em>' : `<em class="adm-pay-st is-due">Faltan ${eur(falta)}</em>`;
    const mark = `<button type="button" class="adm-pay-mark${m.pagado ? ' is-on' : ''}" data-pay-mark="${esc(c.id)}" data-pay-gid="${esc(g.id)}" aria-pressed="${!!m.pagado}">${m.pagado ? '✓ Marcado como pagado · quitar' : 'Marcar todo pagado'}</button>`;
    return `<li class="adm-pay${full ? ' is-paid' : ''}${over ? ' is-over' : ''}">
      <div class="adm-pay-top">
        <span class="adm-av">${esc(initials(clientName(c)))}</span>
        <span class="adm-cli-who"><b>${esc(clientName(c))}</b><small>Pagado ${eur(pag)}${imp ? ` de ${eur(imp)}` : ''}</small></span>
        ${state}
      </div>
      <div class="adm-pay-mid">
        <label class="adm-pay-imp"><span>Tiene que pagar</span><span class="adm-eur"><input class="pl-input" type="number" inputmode="decimal" min="0" step="0.01" data-importe-uid="${esc(c.id)}" data-importe-gid="${esc(g.id)}" value="${imp ? esc(imp) : ''}" placeholder="0"><i>€</i></span></label>
        ${falta > 0 && tel ? `<a class="btn btn--wa btn--sm" href="${esc(IB.wa(nudge, tel))}" target="_blank" rel="noopener">Recordar pago</a>` : falta > 0 ? `<button type="button" class="btn btn--ghost btn--sm" data-copy-notify="${esc(nudge)}">Copiar recordatorio</button>` : ''}
      </div>
      ${(full && !m.pagado) ? '' : mark}
      ${list.length ? `<ul class="adm-pay-log">${list.map(p => `<li><span>${esc(fdate(p.fecha))}</span><b>${eur(p.importe)}</b><em>${esc(p.nota || '')}</em><button type="button" class="pl-link dash-del" data-pay-del="${esc(p.id)}">Borrar</button></li>`).join('')}</ul>` : ''}
      <details class="adm-pay-add" data-pay-uid="${esc(c.id)}"${dr.open ? ' open' : ''}>
        <summary>${I_PLUS}Apuntar un pago</summary>
        <div class="adm-f-grid">
          <label class="adm-f-field"><span>Importe (€)</span><input class="pl-input" type="number" inputmode="decimal" min="0.01" step="0.01" data-pv="importe" data-pay-key="${esc(c.id)}" value="${esc(dr.importe)}"${falta > 0 ? ` placeholder="${esc(falta)}"` : ''}></label>
          <label class="adm-f-field"><span>Fecha</span><input class="pl-input" type="date" data-pv="fecha" data-pay-key="${esc(c.id)}" value="${esc(dr.fecha)}"></label>
          <label class="adm-f-field adm-f-wide"><span>Nota</span><input class="pl-input" type="text" maxlength="200" data-pv="nota" data-pay-key="${esc(c.id)}" value="${esc(dr.nota)}" placeholder="Bizum, transferencia, reserva…"></label>
        </div>
        <button type="button" class="btn btn--dark btn--sm" data-pay-save="${esc(c.id)}" data-pay-gid="${esc(g.id)}">Guardar pago</button>
      </details>
    </li>`;
  }
  function paysHtml(g, ms){
    if(pagosErr) return `<p class="adm-docs-empty is-err">${esc(pagosErr)}</p>`;
    if(!ms.length) return '<p class="adm-docs-empty">Añade personas al grupo para llevar sus pagos.</p>';
    const vis = g.pagos_visibles !== false;
    return `<label class="adm-switch"><input type="checkbox" id="payVis"${vis ? ' checked' : ''}><span></span><em><b>Todo el grupo ve cómo van los pagos</b>${vis ? 'Cada uno ve lo que debe y lo que lleva pagado cada compañero (solo totales, nunca las notas).' : 'Cada persona solo ve lo suyo.'}</em></label>` + moneyHtml(groupMoney(g.id)) + `
      <div class="adm-pay-all"><label class="adm-pay-imp"><span>Precio por persona</span><span class="adm-eur"><input class="pl-input" type="number" inputmode="decimal" min="0" step="0.01" id="payAll" placeholder="450"><i>€</i></span></label><button type="button" class="btn btn--ghost btn--sm" data-pay-all>Ponérselo a todos</button></div>
      
      <ul class="adm-pay-list">${ms.map(c => payRow(g, c)).join('')}</ul>`;
  }
  async function updateImporte(gid, uid, v, quiet){
    const imp = Math.max(0, Math.round((parseFloat(String(v).replace(',', '.')) || 0) * 100) / 100);
    if(imp > 100000) return toast('Ese importe es demasiado alto.', true);
    const m = memberRow(gid, uid); if(!m) return false;
    const prev = m.importe; m.importe = imp;
    const { error } = await IB.sb.from('grupo_miembros').update({ importe: imp }).eq('grupo_id', gid).eq('user_id', uid);
    if(error){ m.importe = prev; if(!quiet) toast(setupErr(error), true); return false; }
    if(!quiet){ paintDrawer(); paintOverview(); toast('Importe guardado'); }
    return true;
  }
  async function setAllImporte(gid, btn){
    const v = $('#payAll').value; if(v === '' || isNaN(parseFloat(v))) return toast('Pon el precio por persona.', true);
    btn.disabled = true;
    const uids = members.filter(m => String(m.grupo_id) === String(gid)).map(m => m.user_id);
    let ok = true;
    for(const u of uids){ if(!(await updateImporte(gid, u, v, true))){ ok = false; break; } }
    btn.disabled = false;
    if(!ok) return toast(setupErr({ message: pagosErr || 'importe does not exist' }), true);
    paintDrawer(); paintOverview(); paintGroups();
    toast(`${eur(parseFloat(v))} por persona a ${uids.length} ${plural(uids.length, 'persona', 'personas')}`);
  }
  async function markPaid(gid, uid, btn){
    const m = memberRow(gid, uid); if(!m) return;
    const to = !m.pagado; btn.disabled = true;
    const { error } = await IB.sb.from('grupo_miembros').update({ pagado: to }).eq('grupo_id', gid).eq('user_id', uid);
    btn.disabled = false;
    if(error) return toast(setupErr(error), true);
    m.pagado = to; paintDrawer(); paintOverview(); paintGroups();
    const c = clients.find(x => x.id === uid);
    toast(to ? `${esc(clientName(c))}: todo pagado ✓` : `${esc(clientName(c))} ya no está marcado como pagado`);
  }
  async function setVisible(gid, on, input){
    const g = groupById(gid); if(!g) return;
    const { error } = await IB.sb.from('grupos').update({ pagos_visibles: on }).eq('id', gid);
    if(error){ input.checked = !on; return toast(setupErr(error), true); }
    g.pagos_visibles = on; paintDrawer();
    toast(on ? 'Ahora todo el grupo ve cómo van los pagos' : 'Ahora cada persona solo ve sus pagos');
  }
  async function savePayment(uid, gid, btn){
    const dr = payDrafts[uid]; if(!dr) return;
    const imp = Math.round((parseFloat(String(dr.importe).replace(',', '.')) || 0) * 100) / 100;
    if(!imp || imp <= 0) return toast('Pon el importe que te ha pagado.', true);
    btn.disabled = true;
    const { data, error } = await IB.sb.from('pagos').insert({ grupo_id: Number(gid), user_id: uid, importe: imp, fecha: dr.fecha || today(), nota: (dr.nota || '').trim() || null }).select().single();
    btn.disabled = false;
    if(error) return toast(setupErr(error), true);
    pagos.push(data);
    payDrafts[uid] = { open: false, importe: '', fecha: today(), nota: '' };
    paintDrawer(); paintOverview(); paintGroups();
    const m = memberRow(gid, uid), falta = m ? Math.max(0, Number(m.importe || 0) - pagadoOf(gid, uid)) : 0;
    toast(m && Number(m.importe) > 0 ? (falta > 0 ? `Pago apuntado. Le faltan ${eur(falta)}.` : 'Pago apuntado. Ya lo tiene todo pagado.') : 'Pago apuntado');
  }
  async function deletePayment(pid){
    const { error } = await IB.sb.from('pagos').delete().eq('id', pid);
    if(error) return toast('No se pudo borrar: ' + setupErr(error), true);
    pagos = pagos.filter(p => String(p.id) !== String(pid));
    paintDrawer(); paintOverview(); paintGroups(); toast('Pago borrado');
  }

  /* ---------- avisos: a todos, a un grupo o a una ruta, con quién lo ha visto ---------- */
  const AVISO_TPL = [
    { k: 'billetes', t: 'Ya tenéis los billetes', c: 'Os hemos subido los billetes a vuestra cuenta. Descargadlos y llevadlos en el móvil el día del viaje.' },
    { k: 'pago', t: 'Recordatorio de pago', c: 'Os recordamos que el pago final del viaje vence pronto. En vuestra cuenta veis lo que lleva pagado cada uno y lo que falta.' },
    { k: 'horario', t: 'Cambio de horario', c: 'Ha cambiado la hora de salida. Revisad los billetes actualizados en vuestra cuenta.' },
    { k: 'maleta', t: 'Qué llevar al viaje', c: 'DNI o pasaporte, tarjeta sanitaria europea, cargador y los billetes descargados en el móvil.' }
  ];
  function avisoTarget(a){
    if(a.para_todos) return 'Todos los clientes';
    if(a.grupo_id){ const g = groupById(a.grupo_id); return `Grupo «${g ? g.nombre : '—'}»`; }
    const r = rows.find(x => String(x.id) === String(a.ruta_id));
    return r ? `Ruta ${r.ref} · ${r.nombre}` : 'Una ruta';
  }
  const waCopyOf = a => `*${a.titulo}*${a.cuerpo ? '\n' + a.cuerpo : ''}\n\nLo tienes también en tu cuenta de Iberail: ${location.origin}/cuenta.html#avisos`;
  function avisoCard(a, compact){
    const aud = audienceIds(a), reads = readersOf(a), n = aud.length, k = reads.length;
    const pct = n ? Math.round(k / n * 100) : 0, open = openReads.has(String(a.id));
    const readSet = new Map(reads.map(x => [x.user_id, x.leido_at]));
    const who = uid => clients.find(c => c.id === uid) || { id: uid, email: '', nombre: 'Cliente' };
    const list = open ? `<ul class="adm-reads">${aud.map(uid => { const c = who(uid), at = readSet.get(uid), tel = waPhone(c.telefono);
      return `<li class="${at ? 'is-read' : ''}"><span class="adm-av">${esc(initials(clientName(c)))}</span><span class="adm-cli-who"><b>${esc(clientName(c))}</b><small>${at ? `Visto ${esc(ago(at))}` : 'Aún no lo ha visto'}</small></span>${!at && tel ? `<a class="pl-link" href="${esc(IB.wa(`Hola ${clientName(c).split(' ')[0]}, te hemos dejado un aviso en tu cuenta de Iberail: «${a.titulo}». Échale un ojo aquí: ${location.origin}/cuenta.html#avisos`, tel))}" target="_blank" rel="noopener">Avisar por WhatsApp</a>` : ''}</li>`; }).join('') || '<li class="adm-docs-empty">Nadie lo recibe todavía.</li>'}</ul>` : '';
    return `<article class="adm-aviso${a.importante ? ' is-imp' : ''}">
      <div class="adm-aviso-top">${compact ? '' : `<span class="adm-aviso-to">${I_BELL}${esc(avisoTarget(a))}</span>`}<small>${esc(ago(a.created_at))}</small></div>
      <h4>${a.importante ? '<em>Importante</em>' : ''}${esc(a.titulo)}</h4>
      ${a.cuerpo ? `<p>${esc(a.cuerpo)}</p>` : ''}
      <div class="adm-aviso-read">
        <div class="adm-bar-p${n && k >= n ? ' is-full' : ''}"><i style="width:${pct}%"></i></div>
        <button type="button" class="pl-link" data-reads="${esc(a.id)}" aria-expanded="${open}">${n ? `${k} de ${n} ${plural(n, 'lo ha visto', 'lo han visto')}` : 'Nadie lo recibe todavía'}</button>
      </div>
      ${list}
      <div class="adm-aviso-act"><button type="button" class="pl-link" data-aviso-copy="${esc(a.id)}">Copiar para WhatsApp</button><button type="button" class="pl-link dash-del" data-aviso-del="${esc(a.id)}">Borrar</button></div>
    </article>`;
  }
  function avisosHtml(list, addAttr, addLabel){
    if(avisosErr) return `<p class="adm-docs-empty is-err">${esc(avisosErr)}</p>`;
    return `<div class="adm-avisos-list">${list.length ? list.map(a => avisoCard(a, true)).join('') : '<p class="adm-docs-empty">Sin avisos todavía. Lo que publiques aquí les sale destacado en su cuenta.</p>'}</div>
      <button type="button" class="btn btn--ghost btn--sm" ${addAttr}>${I_PLUS}${addLabel}</button>`;
  }
  function paintAvisos(){
    const box = $('#aviList'); if(!box) return;
    if(avisosErr){ box.innerHTML = `<div class="adm-empty"><b>Los avisos aún no están activados.</b><span>${esc(avisosErr)}</span></div>`; return; }
    if(!avisos.length){ box.innerHTML = '<div class="adm-empty"><b>Todavía no has publicado ningún aviso.</b><span>Escribe a todos, a un grupo o a una ruta: les sale destacado en su cuenta y aquí ves quién lo ha leído.</span></div>'; return; }
    box.innerHTML = avisos.map(a => avisoCard(a, false)).join('');
  }
  function startNewAviso(target, id){
    na = { target, grupoId: target === 'grupo' ? id || '' : '', rutaId: target === 'ruta' ? id || '' : '', titulo: '', cuerpo: '', importante: false };
    loadClients();
    openDrawer({ kind: 'nuevo-aviso', id: 'nuevo' });
    setTimeout(() => { const i = $('#naTitulo'); if(i && window.innerWidth > 700) i.focus(); }, 80);
  }
  function paintNewAviso(p){
    const g = groupById(na.grupoId), r = rows.find(x => String(x.id) === String(na.rutaId));
    const targetHtml = na.target === 'grupo'
      ? (groups.length ? `<select class="adm-select adm-f-wide" id="naGroup" aria-label="Grupo"><option value="">Elige el grupo…</option>${groups.map(x => `<option value="${esc(x.id)}"${String(x.id) === String(na.grupoId) ? ' selected' : ''}>${esc(x.nombre)} · ${membersOf(x.id).length} ${plural(membersOf(x.id).length, 'persona', 'personas')}</option>`).join('')}</select>` : '<p class="adm-docs-empty">Aún no hay grupos.</p>')
      : na.target === 'ruta'
      ? (rows.length ? `<select class="adm-select adm-f-wide" id="naRoute" aria-label="Ruta"><option value="">Elige la ruta…</option>${rows.map(x => `<option value="${esc(x.id)}"${String(x.id) === String(na.rutaId) ? ' selected' : ''}>${esc(x.ref)} · ${esc(x.nombre)}</option>`).join('')}</select>` : '<p class="adm-docs-empty">Aún no hay rutas.</p>')
      : '<p class="adm-hint">Lo verán todos los clientes registrados al entrar en su cuenta.</p>';
    const probe = { para_todos: na.target === 'todos', grupo_id: na.target === 'grupo' && g ? g.id : null, ruta_id: na.target === 'ruta' && r ? r.id : null };
    const audience = (probe.para_todos || probe.grupo_id || probe.ruta_id) ? audienceOf(probe) : 0;
    p.innerHTML = head('AVISO A CLIENTES', 'Nuevo aviso') + `
      <div class="adm-seg" role="radiogroup" aria-label="Para quién">
        <button type="button" role="radio" data-natarget="todos" aria-checked="${na.target === 'todos'}">Todos</button>
        <button type="button" role="radio" data-natarget="grupo" aria-checked="${na.target === 'grupo'}">Un grupo</button>
        <button type="button" role="radio" data-natarget="ruta" aria-checked="${na.target === 'ruta'}">Una ruta</button>
      </div>
      <section class="adm-sec">${targetHtml}${audience ? `<p class="adm-hint">Le llegará a ${audience} ${plural(audience, 'persona', 'personas')}.</p>` : ''}</section>
      <section class="adm-sec">
        <h3 class="adm-f-h">Plantillas rápidas</h3>
        <div class="adm-tpls">${AVISO_TPL.map(x => `<button type="button" class="chip" data-natpl="${x.k}">${esc(x.t)}</button>`).join('')}</div>
        <label class="adm-f-field adm-f-wide"><span>Título</span><input class="pl-input" id="naTitulo" maxlength="120" value="${esc(na.titulo)}" placeholder="Ej.: Ya tenéis los billetes"></label>
        <label class="adm-f-field adm-f-wide"><span>Mensaje</span><textarea class="pl-input" id="naCuerpo" maxlength="1000" rows="4" placeholder="Opcional">${esc(na.cuerpo)}</textarea></label>
        <label class="pl-check"><input type="checkbox" id="naImportante"${na.importante ? ' checked' : ''}><span></span><em>Importante: se lo destacamos arriba del todo hasta que lo lean</em></label>
        ${!wa.err && wa.loaded && na.target !== 'todos' ? `<label class="pl-check"><input type="checkbox" id="naWa"${na.wa ? ' checked' : ''}><span></span><em>Mandárselo también por WhatsApp a los que tengan teléfono (plantilla «aviso_viaje»)</em></label>` : ''}
      </section>
      <button type="button" class="btn btn--primary btn--block" data-create-aviso>Publicar aviso</button>`;
  }
  async function createAviso(btn){
    const titulo = $('#naTitulo').value.trim(), cuerpo = $('#naCuerpo').value.trim(), importante = $('#naImportante').checked;
    if(titulo.length < 2) return toast('Ponle un título al aviso.', true);
    if(na.target === 'grupo' && !na.grupoId) return toast('Elige el grupo.', true);
    if(na.target === 'ruta' && !na.rutaId) return toast('Elige la ruta.', true);
    const row = { titulo, cuerpo: cuerpo || null, importante, para_todos: na.target === 'todos', grupo_id: na.target === 'grupo' ? Number(na.grupoId) : null, ruta_id: na.target === 'ruta' ? Number(na.rutaId) : null };
    btn.disabled = true;
    const { data, error } = await IB.sb.from('avisos').insert(row).select().single();
    btn.disabled = false;
    if(error) return toast(setupErr(error), true);
    const porWa = !!($('#naWa') && $('#naWa').checked);
    avisos.unshift(data); na = null;
    closeDrawer(); setView('avi'); paintAll();
    if(porWa) waCall({ action: 'aviso', aviso_id: data.id }).then(r => {
      if(!r.ok) return toast('No se pudo mandar por WhatsApp: ' + esc(r.error || ''), true);
      toast(r.total ? `Enviado por WhatsApp a ${r.enviados} de ${r.total}${r.fallos && r.fallos.length ? ` · ${r.fallos.length} sin enviar (${esc(r.fallos.map(f => f.nombre).join(', '))})` : ''}` : 'Nadie de ese grupo tiene teléfono guardado', !r.enviados && !!r.total);
    });
    toast(`Aviso publicado. <u>Copiar para vuestro grupo de WhatsApp</u>`, false, async () => { const ok = await IB.copy(waCopyOf(data)); toast(ok ? 'Copiado: pégalo en WhatsApp' : 'No se pudo copiar', !ok); });
  }
  async function deleteAviso(id){
    const { error } = await IB.sb.from('avisos').delete().eq('id', id);
    if(error) return toast('No se pudo borrar: ' + setupErr(error), true);
    avisos = avisos.filter(a => String(a.id) !== String(id)); leidos = leidos.filter(x => String(x.aviso_id) !== String(id));
    paintAll(); if(drawer && !typing()) paintDrawer(); toast('Aviso borrado');
  }
  // acciones de una tarjeta de aviso (en la pestaña y dentro de las fichas)
  async function avisoAction(t){
    const rd = t.closest('[data-reads]'); if(rd){ const id = rd.dataset.reads; openReads.has(id) ? openReads.delete(id) : openReads.add(id); if(view === 'avi') paintAvisos(); if(drawer) paintDrawer(); return true; }
    const cp = t.closest('[data-aviso-copy]'); if(cp){ const a = avisos.find(x => String(x.id) === cp.dataset.avisoCopy); const ok = a && await IB.copy(waCopyOf(a)); toast(ok ? 'Copiado: pégalo en WhatsApp' : 'No se pudo copiar', !ok); return true; }
    const dl = t.closest('[data-aviso-del]'); if(dl){ if(armed(dl, '¿Borrar? Toca otra vez')) deleteAviso(dl.dataset.avisoDel); return true; }
    return false;
  }

  /* ---------- ficha de grupo ---------- */
  function paintGroup(p){
    const g = groupById(drawer.id);
    if(!g){ p.innerHTML = head('', 'Grupo') + '<p class="adm-empty">Este grupo ya no existe.</p>'; return; }
    const ms = membersOf(g.id), rs = rows.filter(r => String(r.grupo_id) === String(g.id));
    const q = norm(drawer.q || '');
    const match = c => !q || norm([c.nombre, c.email, c.telefono].join(' ')).includes(q);
    const free = clientsState !== 'ok' ? [] : clients.filter(c => !ms.some(m => m.id === c.id) && !groupsOf(c.id).length && match(c));
    const taken = clientsState !== 'ok' || !q ? [] : clients.filter(c => !ms.some(m => m.id === c.id) && groupsOf(c.id).length && match(c)).slice(0, 4);
    const cands = free.slice(0, q ? 12 : 6);
    const candHtml = cands.map(c => `<button type="button" class="adm-cand" data-add-member="${esc(c.id)}"><span class="adm-av">${esc(initials(clientName(c)))}</span><span class="adm-cli-who"><b>${esc(clientName(c))}</b><small>${esc(c.email)}</small></span>${I_PLUS}</button>`).join('') +
      taken.map(c => `<div class="adm-cand is-taken" title="Cada persona solo puede estar en un grupo"><span class="adm-av">${esc(initials(clientName(c)))}</span><span class="adm-cli-who"><b>${esc(clientName(c))}</b><small>Ya está en «${esc(groupsOf(c.id)[0].nombre)}»</small></span><button type="button" class="pl-link" data-open-group="${esc(groupsOf(c.id)[0].id)}">Ver su grupo</button></div>`).join('');
    p.innerHTML = head(`GRUPO · creado ${esc(ago(g.created_at))}`, esc(g.nombre)) + `
      <div class="adm-p-rename"><input class="pl-input" id="grName" value="${esc(g.nombre)}" maxlength="80" aria-label="Nombre del grupo"><button type="button" class="btn btn--ghost btn--sm" data-rename>Cambiar nombre</button></div>
      <label class="adm-switch adm-p-vip${g.vip ? ' is-on' : ''}"><input type="checkbox" id="grVip"${g.vip ? ' checked' : ''}><span></span><em><b><i class="adm-vip-ic">${I_STAR}</i>Grupo VIP</b>${g.vip ? 'Sus miembros ven su grupo en dorado, con el sello VIP y una línea directa por WhatsApp.' : 'Actívalo para grupos especiales: amigos, clientes que repiten o con trato preferente.'}</em></label>
      <section class="adm-sec">
        <div class="adm-sec-h"><h3>${I_USERS}Personas <small>${ms.length}</small></h3></div>
        ${ms.length ? `<ul class="adm-members">${ms.map(c => `<li><span class="adm-av">${esc(initials(clientName(c)))}</span><span class="adm-cli-who"><b>${esc(clientName(c))}</b><small>${esc(c.email)}${c.telefono ? ' · ' + esc(c.telefono) : ''}</small></span>${c.telefono ? `<a class="pl-link" href="${esc(IB.wa('', waPhone(c.telefono)))}" target="_blank" rel="noopener">WhatsApp</a>` : ''}<button type="button" class="pl-link dash-del" data-rm-member="${esc(c.id)}">Quitar</button></li>`).join('')}</ul>` : '<p class="adm-docs-empty">Aún no hay nadie en este grupo.</p>'}
        <div class="adm-add-people">
          <div class="pl-search">${'<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>'}<input id="grQ" type="search" placeholder="Añadir personas: busca por nombre o correo" value="${esc(drawer.q || '')}" aria-label="Buscar personas para añadir"></div>
          <div class="adm-cands" id="grCands">${clientsState === 'loading' ? '<div class="auth-spin"></div>' : clientsState === 'error' ? `<p class="adm-docs-empty is-err">${esc(clientsErr)}</p>` : candHtml ? candHtml : `<p class="adm-docs-empty">${q ? 'Nadie sin grupo coincide con esa búsqueda.' : 'No queda nadie sin grupo. Cada persona solo puede estar en un grupo.'}</p>`}</div>
          <p class="adm-hint adm-hint--sm">Solo aparecen personas sin grupo: cada persona solo puede estar en uno.</p>
        </div>
      </section>
      <section class="adm-sec">
        <div class="adm-sec-h"><h3>Ruta del grupo</h3><button type="button" class="btn btn--ghost btn--sm" data-new-for-group="${esc(g.id)}">${I_PLUS}Crear ruta</button></div>
        ${rs.length ? `<div class="adm-mini-routes">${rs.map(r => `<button type="button" class="adm-mini" data-open-route="${esc(r.id)}"><span class="st st--${esc(r.estado)}">${esc(CLIENT_LABEL[r.estado] || LABEL[r.estado])}</span><b>${chain(r)}</b><small>${esc(r.dias)} días · ${esc(fdate(r.fecha_salida))}</small></button>`).join('')}</div>` : '<p class="adm-docs-empty">Crea la ruta y la verán todos los del grupo en su cuenta.</p>'}
      </section>
      <section class="adm-sec">
        <div class="adm-sec-h"><h3>${I_EUR}Pagos <small>${ms.length}</small></h3></div>
        ${paysHtml(g, ms)}
      </section>
      <section class="adm-sec">
        <div class="adm-sec-h"><h3>${I_BELL}Avisos al grupo</h3></div>
        ${avisosHtml(avisos.filter(a => String(a.grupo_id) === String(g.id)), `data-new-aviso-group="${esc(g.id)}"`, 'Nuevo aviso al grupo')}
      </section>
      <section class="adm-docs" data-docs="g:${esc(g.id)}">${docsHtml('g:' + g.id, g)}</section>
      <section class="adm-docs al-adm" data-aloj-admin="${esc(g.id)}"></section>
      <section class="adm-docs ct-adm" data-contratos-admin="${esc(g.id)}"></section>
      <div class="adm-p-danger"><button type="button" class="pl-link dash-del" data-del-group>Eliminar grupo (y su ruta y documentos)</button></div>`;
  }
  function paintCands(){
    if(!drawer || drawer.kind !== 'grupo') return;
    const box = $('#grCands'); if(!box) return;
    const tmp = document.createElement('div'); paintGroup(tmp);
    const fresh = tmp.querySelector('#grCands'); if(fresh) box.innerHTML = fresh.innerHTML;
  }
  async function deleteGroup(g){
    const rs = rows.filter(r => String(r.grupo_id) === String(g.id));
    const keys = ['g:' + g.id].concat(rs.map(r => 'r:' + r.id));
    for(const k of keys) if(!Array.isArray(docs[k])) await loadDocs(k);
    const paths = keys.flatMap(k => Array.isArray(docs[k]) ? docs[k].map(d => d.archivo).filter(Boolean) : []);
    if(paths.length) await IB.sb.storage.from(BUCKET).remove(paths);
    const { error } = await IB.sb.from('grupos').delete().eq('id', g.id);
    if(error) return toast('No se pudo eliminar: ' + setupErr(error), true);
    groups = groups.filter(x => x.id !== g.id); members = members.filter(m => String(m.grupo_id) !== String(g.id));
    rows = rows.filter(r => String(r.grupo_id) !== String(g.id));
    closeDrawer(); paintAll(); toast('Grupo eliminado');
  }

  /* ---------- nuevo grupo ---------- */
  function paintNewGroup(p){
    const pick = ng.uids.map(u => clients.find(c => c.id === u)).filter(Boolean);
    p.innerHTML = head('GRUPOS', 'Nuevo grupo') + `
      <label class="adm-f-field adm-f-wide"><span>Nombre del grupo</span><input class="pl-input" id="ngName" maxlength="80" placeholder="Ej.: Despedida de Pablo · Ultra 2027" value="${esc(ng.nombre)}"></label>
      <p class="adm-hint">${pick.length ? `Entrarán ${pick.length} ${plural(pick.length, 'persona', 'personas')}: ${pick.map(c => esc(clientName(c))).join(', ')}.` : 'Luego podrás añadir a las personas desde la ficha del grupo.'}</p>
      <button type="button" class="btn btn--primary" data-create-group>Crear grupo</button>`;
  }
  async function createGroup(){
    const nombre = $('#ngName').value.trim();
    if(nombre.length < 2) return toast('Ponle un nombre al grupo.', true);
    const { data, error } = await IB.sb.from('grupos').insert({ nombre }).select().single();
    if(error) return toast(setupErr(error), true);
    groups.unshift(data);
    if(ng.uids.length) await addMembers(data.id, ng.uids);
    selected.clear(); ng = null;
    paintAll(); openDrawer({ kind: 'grupo', id: data.id });
    toast(`Grupo «${esc(nombre)}» creado`);
  }

  /* ---------- nueva ruta (para un cliente o un grupo) ---------- */
  // solicitudes que han llegado de clientes (web o WhatsApp) y se pueden asignar
  const solicitudes = () => rows.filter(r => !r.creada_por_equipo && r.estado !== 'descartada' && (r.paradas || []).length);
  const chainOf = r => [r.salida].concat((r.paradas || []).map(p => p.ciudad)).filter(Boolean).join(' → ');
  const srcLabel = r => `${r.ref} · ${r.nombre} · ${chainOf(r)} · ${r.viajeros} pax${r.fecha_salida ? ' · ' + fdate(r.fecha_salida) : ''}`;
  const groupOfUser = uid => uid ? groups.find(g => members.some(m => String(m.grupo_id) === String(g.id) && m.user_id === uid)) : null;
  function startNew(forKind, id, srcId){
    const c = forKind === 'cliente' && id ? clients.find(x => x.id === id) : null;
    const g = forKind === 'grupo' && id ? groupById(id) : null;
    nf = { para: forKind || 'cliente', uid: c ? c.id : '', gid: g ? g.id : '', q: '', nombre: c ? clientName(c) : g ? g.nombre : '', telefono: c ? c.telefono || '' : '',
      salida: 'Madrid', fecha: '', viajeros: g ? Math.max(1, membersOf(g.id).length) : 1, estado: 'cerrada', paradas: [{ ciudad: '', dias: 3 }],
      src: null, cc: 'pop', touched: false, wantUid: forKind === 'cliente' && id && !c ? id : '' };
    loadClients();
    const s = srcId ? rows.find(r => String(r.id) === String(srcId)) : null;
    if(s) applySrc(s, true); else autoSrc();
    openDrawer({ kind: 'nueva', id: 'nueva' });
  }
  // rellena el formulario con la ruta que pidió el cliente
  function applySrc(r, fromDrawer){
    nf.src = r.id;
    nf.salida = r.salida || 'Madrid'; nf.fecha = r.fecha_salida || ''; nf.viajeros = r.viajeros || 1;
    nf.paradas = (r.paradas || []).map(p => ({ ciudad: p.ciudad, dias: p.dias || 1 }));
    if(!nf.paradas.length) nf.paradas = [{ ciudad: '', dias: 3 }];
    nf.estado = CLIENT_LABEL[r.estado] ? r.estado : 'en_curso';
    if(nf.para === 'cliente'){
      const c = r.user_id ? clients.find(x => x.id === r.user_id) : null;
      if(c){ nf.uid = c.id; nf.nombre = clientName(c); } else if(!nf.uid) nf.nombre = r.nombre;
      nf.telefono = r.telefono || nf.telefono;
    } else {
      if(!nf.gid && fromDrawer){ const g = groupOfUser(r.user_id); if(g){ nf.gid = g.id; nf.nombre = g.nombre; } }
      if(!nf.nombre) nf.nombre = r.nombre;
      nf.telefono = r.telefono || nf.telefono;
    }
  }
  // si el grupo (o el cliente) tiene una sola solicitud, se propone sola
  function srcCandidates(){
    const all = solicitudes();
    if(nf.para === 'grupo' && nf.gid){ const ids = new Set(membersOf(nf.gid).map(m => m.id)); return all.filter(r => r.user_id && ids.has(r.user_id)); }
    if(nf.para === 'cliente' && nf.uid) return all.filter(r => r.user_id === nf.uid);
    return [];
  }
  function autoSrc(){
    if(nf.src || nf.touched) return;
    const c = srcCandidates(); if(c.length === 1) applySrc(c[0]);
  }
  // una solicitud se asigna tal cual (la misma ruta, sin copias) si va a su grupo o a la misma persona
  const srcRow = () => nf && nf.src ? rows.find(r => String(r.id) === String(nf.src)) : null;
  const reuseSrc = () => { const s = srcRow(); return !!s && (nf.para === 'grupo' || (s.user_id && s.user_id === nf.uid)); };

  function stopDates(i, it){
    if(!it) return '<small class="adm-stop-dates is-empty">Pon la fecha de salida y te calculo los días</small>';
    const l = it.legs[i]; if(!l || !l.d) return '<small class="adm-stop-dates"></small>';
    return `<small class="adm-stop-dates">${esc(dShort(l.a))} → ${esc(dShort(l.l))} · ${l.d} ${plural(l.d, 'noche', 'noches')}</small>`;
  }
  function tripSummary(){
    const it = itinerary(nf.fecha, nf.paradas.filter(s => s.ciudad.trim()));
    const total = nf.paradas.reduce((a, s) => a + (+s.dias || 0), 0);
    const u = ultraCheck(nf.fecha, nf.paradas);
    let ultra = '';
    if(u){
      if(!nf.fecha) ultra = `<p class="adm-ultra">Split está en la ruta. <button type="button" class="pl-link" data-ultra-fit="${esc(u.fit)}">Salir el ${esc(dShort(u.fit))} para estar en el ${ULTRA.label}</button></p>`;
      else if(u.lejos) ultra = '';
      else if(u.ok) ultra = `<p class="adm-ultra is-ok">✓ En Split del ${esc(dShort(u.leg.a))} al ${esc(dShort(u.leg.l))}: cubre el ${ULTRA.label}.</p>`;
      else ultra = `<p class="adm-ultra is-bad">En Split del ${esc(dShort(u.leg.a))} al ${esc(dShort(u.leg.l))}: no cubre el ${ULTRA.label}. <button type="button" class="pl-link" data-ultra-fit="${esc(u.fit)}">Cambiar la salida al ${esc(dShort(u.fit))}</button></p>`;
    }
    const back = it ? `<div class="adm-trip-dates"><span>Salen el <b>${esc(dLong(nf.fecha))}</b></span><span>Vuelven el <b>${esc(dLong(it.end))}</b></span><span>${total} ${plural(total, 'noche', 'noches')} de alojamiento</span></div>` : '';
    return back + ultra;
  }
  function stopsHtml(){
    const total = nf.paradas.reduce((a, s) => a + (+s.dias || 0), 0);
    const it = itinerary(nf.fecha, nf.paradas);
    const n = nf.paradas.length;
    return nf.paradas.map((s, i) => { const hit = s.ciudad ? findCity(s.ciudad) : null; return `<div class="adm-stop-row">
        <span class="mono">${String(i + 1).padStart(2, '0')}</span>
        <span class="adm-stop-city"><input class="pl-input${hit && hit.cc ? ' has-cc' : ''}" data-stop="${i}" data-k="ciudad" list="admCities" placeholder="Ciudad (o toca una abajo)" value="${esc(s.ciudad)}" maxlength="50" aria-label="Ciudad ${i + 1}">${hit && hit.cc ? `<em>${flagDot(hit.cc)}<span>${esc(ccName(hit.cc))}</span></em>` : ''}</span>
        <label class="adm-days"><input class="pl-input" data-stop="${i}" data-k="dias" type="number" min="1" max="30" value="${esc(s.dias)}" aria-label="Días en la parada ${i + 1}"><span>días</span></label>
        <span class="adm-stop-mv"><button type="button" class="icon-btn" data-mv-stop="${i}" data-dir="-1" aria-label="Subir"${i === 0 ? ' disabled' : ''}>↑</button><button type="button" class="icon-btn" data-mv-stop="${i}" data-dir="1" aria-label="Bajar"${i === n - 1 ? ' disabled' : ''}>↓</button></span>
        <button type="button" class="icon-btn" data-rm-stop="${i}" aria-label="Quitar parada"${n < 2 ? ' disabled' : ''}>${I_X}</button>
        <span class="adm-stop-when" data-when="${i}">${stopDates(i, it)}</span>
      </div>`; }).join('') +
      `<div class="adm-stops-foot"><button type="button" class="pl-link" data-add-stop${n >= 15 ? ' disabled' : ''}>+ Añadir parada vacía</button><b id="nfTotal">${total} días en total</b></div>
      <div id="nfTrip">${tripSummary()}</div>`;
  }
  // ciudades para tocar: populares o por país, y rutas listas
  function pickerHtml(){
    const inRoute = new Set(nf.paradas.map(s => norm(s.ciudad)).filter(Boolean));
    const ccs = [...new Set(D.cities.map(c => c.cc))].filter(cc => cc !== 'ES').sort((a, b) => ccName(a).localeCompare(ccName(b), 'es'));
    const list = nf.cc === 'pop' ? (D.popular || []).map(n => D.cities.find(c => c.n === n)).filter(Boolean) : D.cities.filter(c => c.cc === nf.cc);
    return `<div class="adm-pick">
      <div class="adm-pick-cc" role="tablist" aria-label="Países">
        <button type="button" class="adm-cc${nf.cc === 'pop' ? ' is-on' : ''}" data-cc="pop">★ Populares</button>
        ${ccs.map(cc => `<button type="button" class="adm-cc${nf.cc === cc ? ' is-on' : ''}" data-cc="${esc(cc)}">${flagDot(cc)}${esc(ccName(cc))}</button>`).join('')}
      </div>
      <div class="adm-pick-cities">${list.map(c => `<button type="button" class="adm-city${inRoute.has(norm(c.n)) ? ' is-on' : ''}" data-city="${esc(c.n)}" aria-pressed="${inRoute.has(norm(c.n))}">${nf.cc === 'pop' ? flagDot(c.cc) : ''}${esc(c.n)}${inRoute.has(norm(c.n)) ? ' ✓' : ' +'}</button>`).join('')}</div>
      ${(D.presets || []).length ? `<div class="adm-pick-presets"><span>Rutas listas:</span>${D.presets.map(p => `<button type="button" class="adm-city" data-preset="${esc(p.id)}" title="${esc(p.stops.map(x => x.n + ' ' + x.d + 'd').join(' → '))}">${esc(p.t)}</button>`).join('')}</div>` : ''}
    </div>`;
  }
  function repaintStops(){
    const box = $('#nfStops'); if(box) box.innerHTML = stopsHtml();
    const pk = $('#nfPick'); if(pk) pk.innerHTML = pickerHtml();
  }
  // solo refresca fechas y totales (sin tocar los campos, para no perder el foco al escribir)
  function refreshDates(){
    const it = itinerary(nf.fecha, nf.paradas);
    nf.paradas.forEach((s, i) => { const w = $(`[data-when="${i}"]`); if(w) w.innerHTML = stopDates(i, it); });
    const tot = $('#nfTotal'); if(tot) tot.textContent = `${nf.paradas.reduce((a, s) => a + (+s.dias || 0), 0)} días en total`;
    const tr = $('#nfTrip'); if(tr) tr.innerHTML = tripSummary();
  }
  function addCity(name){
    const i = nf.paradas.findIndex(s => norm(s.ciudad) === norm(name));
    if(i >= 0){ if(nf.paradas.length > 1) nf.paradas.splice(i, 1); else nf.paradas[0].ciudad = ''; }
    else {
      if(nf.paradas.length >= 15) return toast('Máximo 15 paradas.', true);
      const dias = norm(name) === 'split' ? 4 : 3;
      const empty = nf.paradas.findIndex(s => !s.ciudad.trim());
      if(empty >= 0) nf.paradas[empty] = { ciudad: name, dias: nf.paradas[empty].dias || dias }; else nf.paradas.push({ ciudad: name, dias });
    }
    nf.touched = true; repaintStops();
  }
  function srcHtml(){
    const s = srcRow();
    if(s) return `<div class="adm-src is-set">${I_ROUTE_S}<span><b>${esc(s.ref)} · ${esc(s.nombre)}</b><small>${esc(chainOf(s))} · ${esc(s.viajeros)} pax${s.fecha_salida ? ' · ' + esc(fdate(s.fecha_salida)) : ''}</small></span><button type="button" class="pl-link" data-unsrc>Quitar</button></div>
      <p class="adm-hint">${reuseSrc() ? (nf.para === 'grupo' ? 'Se asigna esta misma solicitud al grupo: la verán todos y a quien la pidió no le sale repetida. Puedes cambiar paradas, días y fecha antes de guardar.' : 'Se actualiza esta misma solicitud en su perfil (sin copias).') : 'Se crea una ruta nueva para este cliente con los datos de la solicitud.'}</p>`;
    const cand = srcCandidates(), all = solicitudes();
    if(!all.length) return '<p class="adm-hint">No hay solicitudes de clientes. Rellena la ruta abajo.</p>';
    return `${cand.length ? `<div class="adm-src-cands">${cand.map(r => `<button type="button" class="adm-cand" data-src="${esc(r.id)}">${I_ROUTE_S}<span class="adm-cli-who"><b>${esc(r.ref)} · ${esc(r.nombre)}</b><small>${esc(chainOf(r))} · ${esc(r.viajeros)} pax</small></span>${I_PLUS}</button>`).join('')}</div>` : ''}
      <select class="adm-select adm-f-wide" id="nfSrc" aria-label="Partir de una solicitud"><option value="">${cand.length ? 'U otra solicitud…' : 'Elige una solicitud para no escribir nada…'}</option>${all.map(r => `<option value="${esc(r.id)}">${esc(srcLabel(r))}</option>`).join('')}</select>`;
  }
  function paintNew(p){
    // si los clientes aún se estaban cargando al abrir, se elige ahora
    if(!nf.uid && nf.wantUid && clients.some(x => x.id === nf.wantUid)){ const w = clients.find(x => x.id === nf.wantUid); nf.uid = w.id; nf.nombre = clientName(w); nf.wantUid = ''; }
    const c = clients.find(x => x.id === nf.uid), g = groupById(nf.gid);
    const q = norm(nf.q);
    const res = clientsState !== 'ok' ? [] : clients.filter(x => !q || norm([x.nombre, x.email, x.telefono].join(' ')).includes(q)).slice(0, 8);
    let who;
    if(nf.para === 'cliente'){
      who = c ? `<div class="adm-picked"><span class="adm-av">${esc(initials(clientName(c)))}</span><span class="adm-cli-who"><b>${esc(clientName(c))}</b><small>${esc(c.email)}</small></span><button type="button" class="pl-link" data-unpick>Cambiar</button></div>`
        : `<div class="pl-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg><input id="nfQ" type="search" placeholder="Busca por correo o nombre" value="${esc(nf.q)}" aria-label="Buscar cliente"></div>
           <div class="adm-cands" id="nfCands">${clientsState === 'ok' ? (res.length ? res.map(x => `<button type="button" class="adm-cand" data-pick="${esc(x.id)}"><span class="adm-av">${esc(initials(clientName(x)))}</span><span class="adm-cli-who"><b>${esc(clientName(x))}</b><small>${esc(x.email)}${x.verificado ? '' : ' · sin verificar'}</small></span>${I_PLUS}</button>`).join('') : '<p class="adm-docs-empty">Nadie coincide. Pídele que se registre en iberail.com/cuenta.html</p>') : clientsState === 'error' ? `<p class="adm-docs-empty is-err">${esc(clientsErr)}</p>` : '<div class="auth-spin"></div>'}</div>`;
    } else {
      who = groups.length ? `<select class="adm-select adm-f-wide" id="nfGroup" aria-label="Grupo"><option value="">Elige el grupo…</option>${groups.map(x => `<option value="${esc(x.id)}"${String(x.id) === String(nf.gid) ? ' selected' : ''}>${esc(x.nombre)} · ${membersOf(x.id).length} ${plural(membersOf(x.id).length, 'persona', 'personas')}</option>`).join('')}</select>`
        : `<p class="adm-docs-empty">${groupsErr ? esc(groupsErr) : 'Aún no hay grupos: créalo en la pestaña «Grupos».'}</p>`;
      if(g) who += `<p class="adm-hint">La ${membersOf(g.id).length === 1 ? 'verá 1 persona' : `verán ${membersOf(g.id).length} personas`}: ${membersOf(g.id).map(m => esc(clientName(m))).join(', ') || 'nadie todavía'}.</p>`;
    }
    const reuse = reuseSrc();
    p.innerHTML = head('RUTA PREPARADA POR IBERAIL', 'Nueva ruta') + `
      <div class="adm-seg" role="radiogroup" aria-label="Para quién">
        <button type="button" role="radio" data-para="cliente" aria-checked="${nf.para === 'cliente'}">Para un cliente</button>
        <button type="button" role="radio" data-para="grupo" aria-checked="${nf.para === 'grupo'}">Para un grupo</button>
      </div>
      <section class="adm-sec"><h3 class="adm-f-h">1 · ${nf.para === 'cliente' ? 'Cliente' : 'Grupo'}</h3>${who}</section>
      <section class="adm-sec"><h3 class="adm-f-h">2 · Ruta que pidieron <small>opcional</small></h3><div id="nfSrcBox">${srcHtml()}</div></section>
      <section class="adm-sec"><h3 class="adm-f-h">3 · Viaje</h3>
        <div class="adm-f-grid">
          <label class="adm-f-field"><span>Nombre${nf.para === 'grupo' ? ' de la ruta' : ''}</span><input class="pl-input" data-nf="nombre" value="${esc(nf.nombre)}" maxlength="80"></label>
          <label class="adm-f-field"><span>WhatsApp${nf.para === 'grupo' ? ' de contacto (opcional)' : ''}</span><input class="pl-input" data-nf="telefono" type="tel" value="${esc(nf.telefono)}" maxlength="20"></label>
          <label class="adm-f-field"><span>Sale desde</span><input class="pl-input" data-nf="salida" list="admOrigins" value="${esc(nf.salida)}" maxlength="60"></label>
          <label class="adm-f-field"><span>Fecha de salida</span><input class="pl-input" data-nf="fecha" type="date" value="${esc(nf.fecha)}"></label>
          <label class="adm-f-field"><span>Viajeros</span><input class="pl-input" data-nf="viajeros" type="number" min="1" max="30" value="${esc(nf.viajeros)}"></label>
        </div>
      </section>
      <section class="adm-sec"><h3 class="adm-f-h">4 · Paradas</h3><div id="nfStops">${stopsHtml()}</div><div id="nfPick">${pickerHtml()}</div></section>
      <section class="adm-sec"><h3 class="adm-f-h">5 · Cómo la ve ${nf.para === 'grupo' ? 'el grupo' : 'el cliente'}</h3>
        <div class="adm-seg" role="radiogroup" aria-label="Estado">${Object.keys(CLIENT_LABEL).map(k => `<button type="button" role="radio" data-nfst="${k}" aria-checked="${nf.estado === k}">${CLIENT_LABEL[k]}</button>`).join('')}</div>
      </section>
      <p class="adm-hint">Aparece en su cuenta en cuanto la guardes. Después podrás subirle los billetes.</p>
      <button type="button" class="btn btn--primary btn--block" data-create>${reuse ? (nf.para === 'grupo' ? 'Asignar la ruta al grupo' : 'Guardar cambios en su ruta') : `Guardar ruta ${nf.para === 'grupo' ? 'en el grupo' : 'en su perfil'}`}</button>`;
  }
  async function createRoute(btn){
    const c = clients.find(x => x.id === nf.uid), g = groupById(nf.gid);
    if(nf.para === 'cliente' && !c) return toast('Elige a qué cliente va la ruta.', true);
    if(nf.para === 'grupo' && !g) return toast('Elige el grupo.', true);
    const nombre = nf.nombre.trim();
    if(nombre.length < 2) return toast('Falta el nombre.', true);
    const paradas = nf.paradas.map(s => {
      const hit = findCity(s.ciudad);
      return { ciudad: hit ? hit.n : s.ciudad.trim(), pais: hit && D.countries ? (D.countries[hit.cc] || '') : '', dias: Math.max(1, Math.min(30, parseInt(s.dias, 10) || 1)) };
    }).filter(s => s.ciudad);
    if(!paradas.length) return toast('Añade al menos una parada.', true);
    const dias = paradas.reduce((a, s) => a + s.dias, 0);
    if(dias < 3 || dias > 60) return toast('El viaje tiene que durar entre 3 y 60 días.', true);
    if(!nf.salida.trim()) return toast('¿Desde dónde salen?', true);
    const base = {
      nombre, telefono: nf.telefono.trim().slice(0, 20),
      salida: nf.salida.trim().slice(0, 60), fecha_salida: nf.fecha || null, dias,
      viajeros: Math.max(1, Math.min(30, parseInt(nf.viajeros, 10) || 1)), paradas, estado: nf.estado
    };
    const src = srcRow(), reuse = reuseSrc();
    btn.disabled = true;
    let data, error;
    if(reuse){
      // la misma solicitud pasa a ser la ruta del grupo (o se actualiza en su perfil)
      const patch = { ...base, ...(nf.para === 'grupo' ? { grupo_id: g.id } : {}) };
      ({ data, error } = await IB.sb.from('rutas').update(patch).eq('id', src.id).select().single());
      if(!error){ data = { ...src, ...patch, ...(data || {}) }; const k = rows.findIndex(r => r.id === data.id); if(k >= 0) rows[k] = data; else rows.unshift(data); }
    } else {
      const row = {
        ...base, user_id: nf.para === 'cliente' ? c.id : null, grupo_id: nf.para === 'grupo' ? g.id : null, creada_por_equipo: true,
        email: nf.para === 'cliente' ? c.email : '', flexible: false,
        estilo: src ? (src.estilo || []) : [], ...(src && src.alojamiento ? { alojamiento: src.alojamiento } : {}), ...(src && src.presupuesto ? { presupuesto: src.presupuesto } : {})
      };
      if(!row.grupo_id) delete row.grupo_id;
      ({ data, error } = await IB.sb.from('rutas').insert(row).select().single());
      if(!error && !rows.some(r => r.id === data.id)) rows.unshift(data);
    }
    btn.disabled = false;
    if(error) return toast(setupErr(error), true);
    nf = null; paintAll();
    openDrawer({ kind: 'ruta', id: data.id });
    setTimeout(() => { const s = $('.adm-docs'); if(s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 350);
    toast(g ? `Ruta ${reuse ? 'asignada' : 'guardada'}: ${membersOf(g.id).length === 1 ? 'la ve la persona' : `la ven los ${membersOf(g.id).length}`} del grupo. Súbeles los billetes.` : `Ruta guardada en el perfil de ${esc(clientName(c))}. Súbele los billetes.`);
  }

  /* ---------- CSV ---------- */
  function csv(){
    const cols = ['ref', 'created_at', 'estado', 'nombre', 'email', 'telefono', 'salida', 'fecha_salida', 'flexible', 'dias', 'viajeros', 'paradas', 'estilo', 'alojamiento', 'presupuesto', 'acepta_publicidad', 'notas', 'nota_interna'];
    const cell = v => { if(typeof v === 'boolean') v = v ? 'Sí' : 'No'; const s = Array.isArray(v) ? (typeof v[0] === 'object' ? v.map(p => `${p.ciudad} (${p.dias})`).join(' > ') : v.join(', ')) : (v == null ? '' : String(v)); return '"' + s.replace(/"/g, '""') + '"'; };
    const out = '﻿' + cols.join(';') + '\n' + visible().map(r => cols.map(c => cell(c === 'nota_interna' ? noteOf(r) : r[c])).join(';')).join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([out], { type: 'text/csv;charset=utf-8' }));
    a.download = `iberail-solicitudes-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a); a.click(); a.remove();
  }

  /* ---------- eventos ---------- */
  $('#admViews').addEventListener('click', e => { const b = e.target.closest('[data-v]'); if(b) setView(b.dataset.v); });
  $('#admList').addEventListener('click', e => { const b = e.target.closest('.adm-row'); if(b) openDrawer({ kind: 'ruta', id: b.dataset.id }); });
  $('#admTabs').addEventListener('click', e => {
    const b = e.target.closest('[data-f]'); if(!b) return;
    filter = b.dataset.f; $$('#admTabs .chip').forEach(x => x.classList.toggle('is-on', x === b)); paintList();
  });
  $('#admStats').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if(!b) return; const tab = $(`#admTabs [data-f="${b.dataset.f}"]`); if(tab) tab.click(); });
  $('#admSearch').addEventListener('input', e => { query = e.target.value; paintList(); });
  $('#admCsv').addEventListener('click', csv);
  $('#admNew').addEventListener('click', () => startNew('cliente'));
  // clientes
  $('#cliTabs').addEventListener('click', e => { const b = e.target.closest('[data-cf]'); if(!b) return; cliFilter = b.dataset.cf; $$('#cliTabs .chip').forEach(x => x.classList.toggle('is-on', x === b)); paintClients(); });
  $('#cliSort').addEventListener('change', e => { cliSort = e.target.value; paintClients(); });
  $('#cliSearch').addEventListener('input', e => { cliQuery = e.target.value; paintClients(); });
  $('#cliList').addEventListener('change', e => {
    const ck = e.target.closest('[data-sel]'); if(!ck) return;
    if(ck.checked) selected.add(ck.dataset.sel); else selected.delete(ck.dataset.sel);
    ck.closest('.adm-cli').classList.toggle('is-sel', ck.checked); paintBulk();
  });
  $('#cliList').addEventListener('click', e => {
    const g = e.target.closest('[data-open-group]'); if(g) return openDrawer({ kind: 'grupo', id: g.dataset.openGroup });
    const n = e.target.closest('[data-new-for]'); if(n) return startNew('cliente', n.dataset.newFor);
  });
  $('#cliBulk').addEventListener('click', async e => {
    if(e.target.closest('[data-bulk-clear]')){ selected.clear(); paintClients(); return; }
    const b = e.target.closest('[data-bulk-add]'); if(!b) return;
    const gid = $('#cliBulkG').value, uids = [...selected];
    if(gid === '__new'){ ng = { nombre: '', uids }; openDrawer({ kind: 'nuevo-grupo', id: 'nuevo' }); setTimeout(() => { const i = $('#ngName'); if(i) i.focus(); }, 80); return; }
    b.disabled = true;
    const ok = await addMembers(gid, uids);
    b.disabled = false;
    if(ok){ const g = groupById(gid); selected.clear(); paintAll(); toast(`${uids.length} ${plural(uids.length, 'persona añadida', 'personas añadidas')} a «${esc(g ? g.nombre : '')}»`, false, () => openDrawer({ kind: 'grupo', id: gid })); }
  });
  // avisos
  $('#aviNew').addEventListener('click', () => startNewAviso('todos'));
  $('#aviList').addEventListener('click', e => { avisoAction(e.target); });
  $('#admOverview').addEventListener('click', e => { const b = e.target.closest('[data-go-view]'); if(b) setView(b.dataset.goView); });
  // grupos
  $('#gruNew').addEventListener('click', () => { ng = { nombre: '', uids: [] }; openDrawer({ kind: 'nuevo-grupo', id: 'nuevo' }); setTimeout(() => { const i = $('#ngName'); if(i) i.focus(); }, 80); });
  $('#gruList').addEventListener('click', e => { const g = e.target.closest('[data-open-group]'); if(g) openDrawer({ kind: 'grupo', id: g.dataset.openGroup }); });

  // drawer: escribir
  $('#admDrawer').addEventListener('input', e => {
    const t = e.target;
    if(t.dataset.dv){ const box = t.closest('.adm-docs-add'); const dr = drafts[box.dataset.key]; dr.v[t.dataset.dv] = t.value; dr.open = true; return; }
    if(t.dataset.flabel != null){ const dr = drafts[t.closest('.adm-docs-add').dataset.key]; const x = dr && dr.files[+t.dataset.flabel]; if(x) x.label = t.value; return; }
    if(t.id === 'grQ'){ drawer.q = t.value; paintCands(); return; }
    if(t.id === 'ngName'){ ng.nombre = t.value; return; }
    if(t.dataset.pv && t.dataset.payKey){ const dr = payDrafts[t.dataset.payKey]; if(dr){ dr[t.dataset.pv] = t.value; dr.open = true; } return; }
    if(na && t.id === 'naTitulo'){ na.titulo = t.value; return; }
    if(na && t.id === 'naCuerpo'){ na.cuerpo = t.value; return; }
    if(!nf) return;
    if(t.id === 'nfQ'){ nf.q = t.value; const tmp = document.createElement('div'); paintNew(tmp); $('#nfCands').innerHTML = tmp.querySelector('#nfCands').innerHTML; return; }
    if(t.dataset.nf){ nf[t.dataset.nf] = t.value; if(t.dataset.nf === 'fecha') refreshDates(); return; }
    if(t.dataset.stop){
      nf.paradas[+t.dataset.stop][t.dataset.k] = t.value; nf.touched = true;
      refreshDates();
    }
  });
  $('#admDrawer').addEventListener('change', e => {
    const t = e.target;
    if(t.matches('[data-dfile]')){ addFiles(t.closest('.adm-docs-add').dataset.key, t.files); t.value = ''; return; }
    if(t.dataset.importeUid){ updateImporte(t.dataset.importeGid, t.dataset.importeUid, t.value); return; }
    if(t.id === 'payVis' && drawer && drawer.kind === 'grupo'){ setVisible(drawer.id, t.checked, t); return; }
    if(na && t.id === 'naImportante'){ na.importante = t.checked; return; }
    if(na && t.id === 'naWa'){ na.wa = t.checked; return; }
    if(na && t.id === 'naGroup'){ na.grupoId = t.value; paintDrawer(); return; }
    if(na && t.id === 'naRoute'){ na.rutaId = t.value; paintDrawer(); return; }
    if(t.id === 'nfGroup' && nf){ nf.gid = t.value; const g = groupById(t.value); if(g){ nf.nombre = g.nombre; if(!nf.src) nf.viajeros = Math.max(1, membersOf(g.id).length); } autoSrc(); paintDrawer(); return; }
    if(t.id === 'nfSrc' && nf){ const r = rows.find(x => String(x.id) === t.value); if(r){ applySrc(r); paintDrawer(); } return; }
    if(nf && t.dataset.stop && t.dataset.k === 'ciudad'){ repaintStops(); return; }
  });
  $('#admDrawer').addEventListener('toggle', e => {
    const d = e.target.closest && e.target.closest('.adm-docs-add'); if(d && drafts[d.dataset.key]) drafts[d.dataset.key].open = d.open;
    const pa = e.target.closest && e.target.closest('.adm-pay-add'); if(pa && payDrafts[pa.dataset.payUid]) payDrafts[pa.dataset.payUid].open = pa.open;
  }, true);
  // arrastrar archivos a la zona de subida
  ['dragenter', 'dragover'].forEach(ev => $('#admDrawer').addEventListener(ev, e => { const z = e.target.closest && e.target.closest('.adm-file'); if(!z) return; e.preventDefault(); z.classList.add('is-drag'); }));
  $('#admDrawer').addEventListener('dragleave', e => { const z = e.target.closest && e.target.closest('.adm-file'); if(z && !z.contains(e.relatedTarget)) z.classList.remove('is-drag'); });
  $('#admDrawer').addEventListener('drop', e => { const z = e.target.closest && e.target.closest('.adm-file'); if(!z) return; e.preventDefault(); z.classList.remove('is-drag'); addFiles(z.closest('.adm-docs-add').dataset.key, e.dataTransfer && e.dataTransfer.files); });
  // drawer: botones
  $('#admDrawer').addEventListener('click', async e => {
    const t = e.target;
    if(t.closest('[data-close]')) return closeDrawer();
    const og = t.closest('[data-open-group]'); if(og) return openDrawer({ kind: 'grupo', id: og.dataset.openGroup });
    const orr = t.closest('[data-open-route]'); if(orr) return openDrawer({ kind: 'ruta', id: orr.dataset.openRoute });
    const cn = t.closest('[data-copy-notify]'); if(cn){ const ok = await IB.copy(cn.dataset.copyNotify); toast(ok ? 'Aviso copiado: pégalo en vuestro grupo de WhatsApp' : 'No se pudo copiar', !ok); return; }
    // documentos
    const dt = t.closest('[data-dtipo]'); if(dt){ const key = dt.closest('.adm-docs-add').dataset.key; drafts[key].tipo = dt.dataset.dtipo; drafts[key].open = true; paintDocs(key); return; }
    const ds = t.closest('[data-doc-save]'); if(ds) return saveDoc(ds.closest('.adm-docs-add').dataset.key);
    const frm = t.closest('[data-frm]'); if(frm){ const key = frm.closest('.adm-docs-add').dataset.key; drafts[key].files.splice(+frm.dataset.frm, 1); paintDocs(key); return; }
    const dv = t.closest('[data-doc-view]'); if(dv) return viewDoc(dv.closest('.adm-docs').dataset.docs, dv.dataset.docView);
    const dd = t.closest('[data-doc-del]'); if(dd){ if(armed(dd, '¿Borrar? Toca otra vez')) deleteDoc(dd.closest('.adm-docs').dataset.docs, dd.dataset.docDel); return; }
    // avisos
    if(await avisoAction(t)) return;
    const nag = t.closest('[data-new-aviso-group]'); if(nag) return startNewAviso('grupo', nag.dataset.newAvisoGroup);
    const nar = t.closest('[data-new-aviso-route]'); if(nar) return startNewAviso('ruta', nar.dataset.newAvisoRoute);
    if(drawer && drawer.kind === 'nuevo-aviso' && na){
      const nt = t.closest('[data-natarget]'); if(nt){ na.target = nt.dataset.natarget; paintDrawer(); return; }
      const tp = t.closest('[data-natpl]'); if(tp){ const x = AVISO_TPL.find(y => y.k === tp.dataset.natpl); if(x){ na.titulo = x.t; na.cuerpo = x.c; if(x.k === 'pago' || x.k === 'horario') na.importante = true; paintDrawer(); } return; }
      const ca = t.closest('[data-create-aviso]'); if(ca) return createAviso(ca);
      return;
    }
    // pagos
    const ps = t.closest('[data-pay-save]'); if(ps) return savePayment(ps.dataset.paySave, ps.dataset.payGid, ps);
    const pd = t.closest('[data-pay-del]'); if(pd){ if(armed(pd, '¿Borrar?')) deletePayment(pd.dataset.payDel); return; }
    const pall = t.closest('[data-pay-all]'); if(pall && drawer && drawer.kind === 'grupo') return setAllImporte(drawer.id, pall);
    const pmk = t.closest('[data-pay-mark]'); if(pmk) return markPaid(pmk.dataset.payGid, pmk.dataset.payMark, pmk);
    // nueva ruta
    if(drawer && drawer.kind === 'nueva' && nf){
      const pa = t.closest('[data-para]'); if(pa){ nf.para = pa.dataset.para; if(nf.para === 'grupo'){ nf.uid = ''; nf.telefono = ''; } else { nf.gid = ''; } nf.nombre = ''; const s = srcRow(); if(s) applySrc(s); paintDrawer(); return; }
      const pk = t.closest('[data-pick]'); if(pk){ const c = clients.find(x => x.id === pk.dataset.pick); nf.uid = c.id; nf.nombre = clientName(c); nf.telefono = c.telefono || ''; autoSrc(); paintDrawer(); return; }
      if(t.closest('[data-unpick]')){ nf.uid = ''; paintDrawer(); setTimeout(() => { const i = $('#nfQ'); if(i) i.focus(); }, 30); return; }
      // partir de una solicitud
      const sc = t.closest('[data-src]'); if(sc){ const r = rows.find(x => String(x.id) === sc.dataset.src); if(r){ applySrc(r); paintDrawer(); } return; }
      if(t.closest('[data-unsrc]')){ nf.src = null; nf.touched = true; paintDrawer(); return; }
      // ciudades, países y rutas listas
      const cc = t.closest('[data-cc]'); if(cc){ nf.cc = cc.dataset.cc; const pk2 = $('#nfPick'); if(pk2) pk2.innerHTML = pickerHtml(); return; }
      const ci = t.closest('[data-city]'); if(ci){ addCity(ci.dataset.city); return; }
      const pr = t.closest('[data-preset]'); if(pr){ const x = (D.presets || []).find(y => y.id === pr.dataset.preset); if(x){ nf.paradas = x.stops.map(s => ({ ciudad: s.n, dias: s.d })); nf.touched = true; repaintStops(); } return; }
      const mv = t.closest('[data-mv-stop]'); if(mv){ const i = +mv.dataset.mvStop, j = i + (+mv.dataset.dir); if(j >= 0 && j < nf.paradas.length){ [nf.paradas[i], nf.paradas[j]] = [nf.paradas[j], nf.paradas[i]]; nf.touched = true; repaintStops(); } return; }
      const uf = t.closest('[data-ultra-fit]'); if(uf){ nf.fecha = uf.dataset.ultraFit; const f = $('[data-nf="fecha"]'); if(f) f.value = nf.fecha; refreshDates(); return; }
      if(t.closest('[data-add-stop]')){ nf.paradas.push({ ciudad: '', dias: 3 }); repaintStops(); const ins = $$('#nfStops [data-k="ciudad"]'); ins[ins.length - 1].focus(); return; }
      const rs = t.closest('[data-rm-stop]'); if(rs){ nf.paradas.splice(+rs.dataset.rmStop, 1); nf.touched = true; repaintStops(); return; }
      const st = t.closest('[data-nfst]'); if(st){ nf.estado = st.dataset.nfst; $$('[data-nfst]').forEach(b => b.setAttribute('aria-checked', b === st)); return; }
      const cr = t.closest('[data-create]'); if(cr) return createRoute(cr);
      return;
    }
    if(drawer && drawer.kind === 'nuevo-grupo'){ if(t.closest('[data-create-group]')) createGroup(); return; }
    // ficha de grupo
    if(drawer && drawer.kind === 'grupo'){
      const g = groupById(drawer.id); if(!g) return;
      const am = t.closest('[data-add-member]'); if(am){ am.disabled = true; if(await addMembers(g.id, [am.dataset.addMember])){ drawer.q = ''; paintAll(); paintDrawer(); const c = clients.find(x => x.id === am.dataset.addMember); toast(`${esc(clientName(c))} ya está en el grupo`); const i = $('#grQ'); if(i){ i.focus(); } } return; }
      const rm = t.closest('[data-rm-member]'); if(rm){
        if(!armed(rm, '¿Quitar?')) return;
        const { error } = await IB.sb.from('grupo_miembros').delete().eq('grupo_id', g.id).eq('user_id', rm.dataset.rmMember);
        if(error) return toast(setupErr(error), true);
        members = members.filter(m => !(String(m.grupo_id) === String(g.id) && m.user_id === rm.dataset.rmMember)); paintAll(); paintDrawer(); toast('Quitada del grupo: ya no ve su ruta ni sus documentos'); return;
      }
      if(t.closest('[data-rename]')){
        const nombre = $('#grName').value.trim(); if(nombre.length < 2) return toast('Nombre demasiado corto.', true);
        const { error } = await IB.sb.from('grupos').update({ nombre }).eq('id', g.id);
        if(error) return toast(setupErr(error), true);
        g.nombre = nombre; paintAll(); paintDrawer(); toast('Nombre cambiado'); return;
      }
      if(t.closest('#grVip')){
        const vip = $('#grVip').checked;
        const { error } = await IB.sb.from('grupos').update({ vip }).eq('id', g.id);
        if(error) return toast(setupErr(error), true);
        g.vip = vip; paintAll(); paintDrawer(); toast(vip ? 'Marcado como VIP' : 'VIP removido'); return;
      }
      const nfg = t.closest('[data-new-for-group]'); if(nfg) return startNew('grupo', g.id);
      const dg = t.closest('[data-del-group]'); if(dg){ if(armed(dg, 'Se borrará todo. Toca otra vez para confirmar')) deleteGroup(g); return; }
      return;
    }
    // ficha de ruta
    const r = drawer && drawer.kind === 'ruta' ? rows.find(x => String(x.id) === String(drawer.id)) : null; if(!r) return;
    const st = t.closest('[data-st]'); if(st) return setStatus(r, st.dataset.st);
    if(t.closest('[data-copy]')){ const ok = await IB.copy(summary(r)); toast(ok ? 'Resumen copiado' : 'No se pudo copiar', !ok); return; }
    if(t.closest('[data-save]')) return saveNote(r);
    const asg = t.closest('[data-assign]'); if(asg){
      if(asg.dataset.assign === 'grupo'){ const g0 = groupOfUser(r.user_id); return startNew('grupo', g0 ? g0.id : '', r.id); }
      return startNew('cliente', r.user_id || '', r.id);
    }
    const dr = t.closest('[data-del-route]'); if(dr){ if(armed(dr, 'Se borrará con sus billetes. Toca otra vez')) deleteRoute(r); return; }
  });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && drawer) closeDrawer(); });
  setInterval(() => { if(!drawer){ paintList(); if(view === 'cli') paintClients(); } }, 60000);

  // sugerencias para los formularios
  (function(){
    const airports = ['Madrid (MAD)', 'Barcelona (BCN)', 'Valencia (VLC)', 'Sevilla (SVQ)', 'Málaga (AGP)', 'Bilbao (BIO)', 'Alicante (ALC)', 'Palma (PMI)', 'Zaragoza (ZAZ)', 'Santiago (SCQ)',
      'Ámsterdam (AMS)', 'París (CDG)', 'París Orly (ORY)', 'Berlín (BER)', 'Múnich (MUC)', 'Fráncfort (FRA)', 'Praga (PRG)', 'Budapest (BUD)', 'Viena (VIE)', 'Split (SPU)', 'Zagreb (ZAG)',
      'Dubrovnik (DBV)', 'Roma (FCO)', 'Milán (MXP)', 'Venecia (VCE)', 'Bruselas (BRU)', 'Lisboa (LIS)', 'Oporto (OPO)', 'Copenhague (CPH)', 'Estocolmo (ARN)', 'Cracovia (KRK)',
      'Varsovia (WAW)', 'Atenas (ATH)', 'Londres (LGW)', 'Londres (STN)', 'Dublín (DUB)', 'Liubliana (LJU)', 'Belgrado (BEG)', 'Sarajevo (SJJ)', 'Estambul (IST)'];
    const dl = (id, list) => `<datalist id="${id}">${list.map(x => `<option value="${esc(x)}"></option>`).join('')}</datalist>`;
    const box = document.createElement('div'); box.hidden = true;
    box.innerHTML = dl('admAirports', airports) + dl('admCities', D.cities.map(c => c.n)) + dl('admOrigins', D.origins.map(c => c.n));
    document.body.appendChild(box);
  })();

  /* ---------- arranque ---------- */
  (async function(){
    if(!IB.configured) return lock('El panel se activa cuando conectes Supabase (ver guía de activación).');
    if(!IB.enabled) return lock('No se puede conectar con la base de datos ahora mismo.');
    const user = await IB.getUser();
    if(!user) return lock('Entra con la cuenta del equipo de Iberail para ver las solicitudes.');
    meId = user.id;
    const { data: isAdmin } = await IB.sb.rpc('is_admin');
    if(!isAdmin) return lock('Tu cuenta no tiene acceso al panel.');
    $('#admLock').hidden = true; app.hidden = false; $('#admCsv').hidden = false; $('#admNew').hidden = false;
    const [res, nts] = await Promise.all([
      IB.sb.from('rutas').select('*').order('created_at', { ascending: false }).limit(1000),
      IB.sb.from('rutas_notas').select('*'),
      loadGroups()
    ]);
    if(res.error){ toast(IB.errMsg(res.error), true); return; }
    if(nts.error) notesTable = false; else (nts.data || []).forEach(n => notes[n.ruta_id] = n);
    rows = res.data; paintAll();
    loadClients(); loadExtras(); loadWa();
    // enlace directo a un grupo (desde «Mis grupos»): panel.html#grupo-12
    const hg = (location.hash.match(/^#grupo-(\d+)$/) || [])[1];
    if(hg && groupById(hg)){ setView('gru'); openDrawer({ kind: 'grupo', id: hg }); }
    setLive('wait', 'Conectando…');
    IB.sb.channel('panel-rutas')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rutas' }, payload => {
        if(payload.eventType === 'INSERT'){
          const r = payload.new;
          if(rows.some(x => x.id === r.id)) return;
          r._fresh = !r.creada_por_equipo;
          rows.unshift(r); paintAll();
          if(!r.creada_por_equipo){ bumpTitle(); toast(`<b>Nueva ruta · ${esc(r.nombre)}</b><span>${chain(r)}</span>`, false, () => openDrawer({ kind: 'ruta', id: r.id })); }
        }else if(payload.eventType === 'UPDATE'){
          const i = rows.findIndex(x => x.id === payload.new.id); if(i > -1){ rows[i] = payload.new; paintAll(); }
        }else if(payload.eventType === 'DELETE'){
          rows = rows.filter(x => x.id !== payload.old.id); paintAll();
        }
      })
      .subscribe(status => {
        if(status === 'SUBSCRIBED') setLive('on', 'En directo');
        else if(status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') setLive('off', 'Reconectando…');
      });
  })();
})();
