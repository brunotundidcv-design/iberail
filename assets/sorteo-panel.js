/* Iberail — panel: pestaña «Sorteo»
   Inscripciones al sorteo de 10 entradas del Ultra Europe en tiempo real (tabla sorteo_inscritos,
   archivo 12-sorteo.sql). Tiradas de cada persona = 1 + extra; el equipo suma o quita extras
   (p. ej. +1 por subir el cartel a su story de Instagram). */
(function(){
  const IB = window.IB, root = document.getElementById('srtView');
  if(!IB || !root) return;
  const esc = IB.esc;
  let started = false, loaded = false, rows = [], clientes = {}, err = '', q = '', fresh = new Set(), tick = null, busy = new Set(), armed = null, armT = null;
  let draft = {};                                       // cambios sin guardar en «Sorteo actual» y el simulador (id → valor)
  const dv = (k, v) => (k in draft ? draft[k] : v);
  let cfg = null, cfgErr = '', ganadores = new Map();   // user_id → id del premio ('' = sin premio)
  let tirs = new Map(), tirOk = true;                   // user_id → en qué tirada le sale (sin dato = la última) · tirOk: existe la columna (archivo 13)
  const MAX_MB = 50;                                    // límite de subida de mp3 (Supabase gratis: 50 MB por archivo)
  const CAT_DEF = [
    { id: 'entrada', label: 'Entrada Ultra Europe', n: 3, tier: 'top' },
    { id: 'd300', label: '300 € de descuento', n: 1, tier: 'alto' },
    { id: 'd100', label: '100 € de descuento', n: 2, tier: 'alto' },
    { id: 'd50', label: '50 € de descuento', n: 3, tier: 'medio' },
    { id: 'copas', label: 'Bono de copas en Split', n: 5, tier: 'medio' },
    { id: 'd25', label: '25 € de descuento', n: 5, tier: 'bajo' },
    { id: 'd5', label: '5 € de descuento', n: 10, tier: 'bajo' }
  ];
  const cat = () => ((cfg && cfg.premios && cfg.premios.length) ? cfg.premios : CAT_DEF);
  const premioLabel = id => (cat().find(p => p.id === id) || {}).label || '';
  const dados = id => [...ganadores.values()].filter(v => v === id).length;

  const ago = iso => {
    const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
    if(s < 45) return 'ahora mismo';
    if(s < 3600) return `hace ${Math.max(1, Math.round(s / 60))} min`;
    if(s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    if(s < 86400 * 7) return `hace ${Math.floor(s / 86400)} d`;
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  const cli = uid => clientes[uid] || {};
  const name = uid => { const c = cli(uid); return c.nombre || String(c.email || '').split('@')[0] || 'Cliente'; };
  const ini = s => String(s).trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?';
  const tir = r => 1 + (Number(r.extra) || 0);
  const badge = () => { const b = document.getElementById('admCSrt'); if(b) b.textContent = rows.length ? String(rows.length) : ''; };

  function toast(html){
    const t = document.createElement('div'); t.className = 'srt-toast'; t.innerHTML = `<span>🎟️</span><div>${html}</div>`;
    document.body.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('is-in')));
    setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 400); }, 4500);
  }

  function paint(){
    badge();
    if(root.hidden) return;
    // se recuerda dónde estabas escribiendo para devolverte ahí después de repintar
    const a = document.activeElement, foco = a && root.contains(a) ? (a.id || (a.dataset && a.dataset.cat ? '[data-cat="' + a.dataset.cat + '"]' : '')) : '';
    let pos = null; try{ pos = foco && a.selectionStart != null ? a.selectionStart : null; }catch(e){}
    pinta();
    if(foco){ const el = foco.charAt(0) === '[' ? root.querySelector(foco) : document.getElementById(foco); if(el){ el.focus(); try{ if(pos != null) el.setSelectionRange(pos, pos); }catch(e){} } }
  }
  function pinta(){
    if(!loaded){ root.innerHTML = '<div class="auth-spin"></div>'; return; }
    if(err){ root.innerHTML = `<div class="adm-empty"><b>El sorteo aún no está activado.</b><span>${esc(err)} · Ejecuta <b>12-sorteo.sql</b> en Supabase (SQL Editor).</span></div>`; return; }
    const total = rows.reduce((a, r) => a + tir(r), 0), ig = rows.filter(r => Number(r.extra) > 0).length;
    const t = q.trim().toLowerCase();
    const list = t ? rows.filter(r => `${name(r.user_id)} ${cli(r.user_id).email || ''} ${cli(r.user_id).telefono || ''}`.toLowerCase().includes(t)) : rows;
    root.innerHTML = cfgHtml() + `
      <div class="lv-stats">
        <div class="lv-stat is-live"><span class="lv-dot"></span><b>${rows.length}</b><small>${rows.length === 1 ? 'persona apuntada' : 'personas apuntadas'} · en directo</small></div>
        <div class="lv-stat"><b>${total}</b><small>tiradas en la ruleta</small></div>
        <div class="lv-stat"><b>${ig}</b><small>con tirada extra (Instagram)</small></div>
        <div class="lv-stat"><b>${dados('entrada')}/${(cfg || {}).entradas || 3}</b><small>entradas asignadas · ${ganadores.size} con premio</small></div>
      </div>
      <section class="lv-card srtp">
        <div class="srtp-h">
          <h3>🎟️ Apuntados a los sorteos · entradas Ultra Europe</h3>
          <input class="pl-input srtp-q" id="srtQ" type="search" placeholder="Buscar por nombre, correo o teléfono" value="${esc(q)}" aria-label="Buscar inscrito">
        </div>
        <p class="srtp-hint">Cada persona tiene <b>1 tirada</b> por apuntarse. Si sube el cartel a su story mencionando a @iberailspain, pulsa <b>«+1 Instagram»</b> y le sumas otra. Lo ve al momento en su cuenta.</p>
        ${list.length ? `<ul class="srtp-list">${list.map(r => {
          const c = cli(r.user_id), n = tir(r), ex = Number(r.extra) || 0, wait = busy.has(r.user_id);
          return `<li class="${fresh.has(r.user_id) ? 'is-new' : ''}${ex ? ' is-ig' : ''}">
            <span class="srtp-av">${esc(ini(name(r.user_id)))}</span>
            <div class="srtp-who"><b>${esc(name(r.user_id))}${fresh.has(r.user_id) ? '<em>Nuevo</em>' : ''}</b><small>${esc([c.email, c.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto')}</small><small>Se apuntó ${esc(ago(r.created_at))}</small></div>
            <div class="srtp-n" title="${n} ${n === 1 ? 'tirada' : 'tiradas'}"><span>${'🎟️'.repeat(Math.min(n, 6))}${n > 6 ? '…' : ''}</span><b>${n} ${n === 1 ? 'tirada' : 'tiradas'}</b></div>
            <div class="srtp-act">
              ${ex ? `<button type="button" class="srtp-min" data-srt-add="${esc(r.user_id)}" data-d="-1"${wait ? ' disabled' : ''} aria-label="Quitar una tirada extra">−1</button>` : ''}
              <button type="button" class="srtp-ig" data-srt-add="${esc(r.user_id)}" data-d="1"${wait ? ' disabled' : ''}><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>+1 Instagram</button>
              <select class="srtp-premio${ganadores.get(r.user_id) ? ' is-on' : ''}" data-srt-premio="${esc(r.user_id)}"${wait ? ' disabled' : ''} title="Qué le ha tocado en el sorteo"><option value="">Sin premio</option>${cat().map(x => `<option value="${esc(x.id)}"${ganadores.get(r.user_id) === x.id ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}</select>
              ${ganadores.get(r.user_id) && n > 1 && tirOk ? `<select class="srtp-tir" data-srt-tir="${esc(r.user_id)}"${wait ? ' disabled' : ''} title="En qué tirada le sale el premio (en las demás, nada)">${Array.from({ length: n }, (_, i) => i + 1).map(k => `<option value="${k}"${(tirs.get(r.user_id) || n) === k ? ' selected' : ''}>Le toca en la tirada ${k}${k === n ? ' (última)' : ''}</option>`).join('')}</select>` : ''}
              <button type="button" class="srtp-del${armed === r.user_id ? ' is-armed' : ''}" data-srt-del="${esc(r.user_id)}"${wait ? ' disabled' : ''}>${armed === r.user_id ? '¿Seguro? Quitar' : 'Quitar'}</button>
            </div>
          </li>`; }).join('')}</ul>` : `<p class="lv-empty">${t ? 'Nadie coincide con la búsqueda.' : 'Todavía no se ha apuntado nadie. En cuanto alguien pulse «Participar gratis», aparece aquí al momento.'}</p>`}
      </section>`;
  }

  async function loadClientes(){
    const c = await IB.sb.rpc('buscar_clientes', { q: '' });
    (c.data || []).forEach(x => clientes[x.id] = x);
  }
  async function load(){
    const [r, c, g] = await Promise.all([
      IB.sb.from('sorteo_inscritos').select('*').order('created_at', { ascending: false }),
      IB.sb.from('sorteo_config').select('*').eq('id', 1).maybeSingle(),
      IB.sb.from('sorteo_ganadores').select('user_id, premio, visto, tirada').then(x => { tirOk = !x.error; return x.error ? IB.sb.from('sorteo_ganadores').select('user_id, premio, visto') : x; }),
      loadClientes()
    ]);
    err = r.error ? r.error.message : '';
    rows = r.data || [];
    cfgErr = c.error ? c.error.message : '';
    cfg = c.data || { fecha: '', hora: '20:00', entradas: 3, total: 10, tanda: 1, publicado: false, acta: '' };
    ganadores = new Map((g.data || []).map(x => [x.user_id, x.premio || 'entrada']));
    tirs = new Map((g.data || []).filter(x => x.tirada).map(x => [x.user_id, Number(x.tirada)]));
    loaded = true;
  }
  async function saveCfg(patch, msg){
    const { error } = await IB.sb.from('sorteo_config').update(patch).eq('id', 1);
    if(error) return alert('No se pudo guardar: ' + error.message + '\n\n¿Has ejecutado supabase/sql/sorteo-ruleta.sql?');
    cfg = { ...cfg, ...patch }; Object.keys(draft).filter(k => k !== 'srtSim' && k !== 'srtSimN' && k !== 'srtSimEn' && k !== 'srtSimT').forEach(k => delete draft[k]); paint(); if(msg) toast(msg);
  }
  function cfgHtml(){
    const c = cfg || {}, n = ganadores.size;
    return `<section class="lv-card srtc">
      <div class="srtp-h"><h3>⚙️ Sorteo actual</h3><button type="button" class="btn btn--ghost btn--sm" data-srt-nuevo>🆕 Preparar un sorteo nuevo</button></div>
      <p class="srtp-hint">Haces sorteos cuando quieras: pones <b>el día y la hora</b>, <b>cuántas entradas</b> se sortean y <b>qué le ha tocado a cada uno</b>; a esa hora cada persona abre su premio en su cuenta. Nadie ve el premio de los demás y, hasta que no le des a «Publicar», nadie ve nada. Cuando acabe, pulsa <b>«Preparar un sorteo nuevo»</b>: se guarda la lista de ganadores en tu ordenador y empiezas el siguiente de cero (los apuntados siguen dentro con sus tiradas).</p>
      ${cfgErr ? `<p class="lv-empty is-err">${esc(cfgErr)} · Ejecuta <b>supabase/sql/sorteo-ruleta.sql</b> en Supabase.</p>` : ''}
      <div class="srtc-grid">
        <label>Día del sorteo<input class="pl-input" type="date" id="srtFecha" value="${esc(dv('srtFecha', c.fecha || ''))}"></label>
        <label>Hora<input class="pl-input" type="time" id="srtHora" value="${esc(dv('srtHora', c.hora || '20:00'))}"></label>
        <label>Entradas que se sortean<input class="pl-input" type="number" min="1" max="50" id="srtN" value="${esc(dv('srtN', c.entradas || 1))}"></label>
        <label class="srtc-wide">Cómo se hizo el sorteo <small>(se lo enseñamos a quien pregunte)</small><input class="pl-input" id="srtActa" maxlength="200" value="${esc(dv('srtActa', c.acta || ''))}" placeholder="Ej.: sorteo celebrado el 1 de octubre de 2026 con random.org entre los 48 apuntados."></label>
      </div>
      <div class="srtc-cat">
        <b>Premios de este sorteo</b>
        <p class="srtp-hint">Esto es lo que ve la gente pasar por la cinta. Solo pon premios que de verdad vas a dar.</p>
        <div class="srtc-cat-list">${cat().map(x => {
          const d = dados(x.id);
          return `<label class="srtc-cat-row${d > (Number(x.n) || 0) ? ' is-over' : ''}"><span>${esc(x.label)}</span>
            <input class="pl-input" type="number" min="0" max="99" data-cat="${esc(x.id)}" value="${esc(dv('cat:' + x.id, x.n))}">
            <em>${d} ${d === 1 ? 'asignado' : 'asignados'}</em></label>`; }).join('')}
        </div>
      </div>
      <div class="srtc-snd">
        <b>Sonidos</b>
        <p class="srtp-hint">Sube tus mp3 (hasta ${MAX_MB} MB cada uno). Si no subes ninguno, suena uno hecho por la web. Si no subes música, suena el tema propio de la web (sin derechos de autor), que empieza a falta de 6 minutos con el drop justo en el 0 y sigue sin cortes en la ruleta. Si subes tu canción, va sincronizada: su final cae justo en el 0 (si dura menos de 6 minutos, empieza cuando falta lo que dura). La de «ganar el Ultra» entra en el mismo instante del golpe.</p>
        <div class="srtc-snd-list">${[
          ['cuenta', 'Música de la cuenta atrás (últimos 5 minutos)'],
          ['ultra', 'Al ganar una entrada del Ultra'],
          ['premio', 'Al ganar cualquier otro premio'],
          ['tic', 'Cada premio que pasa (muy cortito)']
        ].map(([k, t]) => {
          const url = ((c.sonidos || {})[k]) || '';
          return `<div class="srtc-snd-row">
            <span><b>${esc(t)}</b><small>${url ? 'Subido ✓' : 'Sin subir'}</small></span>
            ${url ? `<button type="button" class="pl-link" data-snd-play="${esc(url)}">Escuchar</button><button type="button" class="pl-link dash-del" data-snd-del="${esc(k)}">Quitar</button>` : ''}
            <label class="btn btn--ghost btn--sm srtc-snd-up">${url ? 'Cambiar' : 'Subir mp3'}<input type="file" accept="audio/*" data-snd="${esc(k)}" hidden></label>
          </div>`; }).join('')}
        </div>
      </div>
      <div class="srtc-acts">
        <button type="button" class="btn btn--dark btn--sm" data-srt-cfg>Guardar</button>
      </div>
      <div class="srtc-sim">
        <b>🎬 Simulador <small>(solo lo ves tú, no cuenta para nada)</small></b>
        <div class="srtc-sim-row">
          <label>Premio<select class="pl-input srtc-simsel" id="srtSim">${cat().map(x => `<option value="${esc(x.id)}"${dv('srtSim', '') === x.id ? ' selected' : ''}>${esc(x.label)}</option>`).join('')}<option value=""${'srtSim' in draft && !draft.srtSim ? ' selected' : ''}>Sin premio</option></select></label>
          <label>Tiradas<input class="pl-input" type="number" min="1" max="20" id="srtSimN" value="${esc(dv('srtSimN', 1))}"></label>
          <label>Le toca en la tirada<input class="pl-input" type="number" min="1" max="20" id="srtSimEn" value="${esc(dv('srtSimEn', 1))}"></label>
          <button type="button" class="btn btn--ghost btn--sm" data-srt-sim>Simular la ruleta</button>
        </div>
        <div class="srtc-sim-row">
          <label>La cuenta atrás empieza en<select class="pl-input" id="srtSimT"><option value="320"${dv('srtSimT', '320') === '320' ? ' selected' : ''}>5 min 20 s (con la entrada de la música)</option><option value="75"${dv('srtSimT', '320') === '75' ? ' selected' : ''}>1 min 15 s</option><option value="20"${dv('srtSimT', '320') === '20' ? ' selected' : ''}>20 segundos (el final)</option></select></label>
          <button type="button" class="btn btn--dark btn--sm" data-srt-simcd>Simular la cuenta atrás + ruleta</button>
        </div>
      </div>
      <div class="srtc-pub${c.publicado ? ' is-on' : ''}">
        <div><b>${c.publicado ? 'Publicado: la ruleta ya está disponible' : 'Sin publicar'}</b>
          <small>${dados('entrada')} de ${c.entradas} entradas asignadas · ${n} ${n === 1 ? 'persona con premio' : 'personas con premio'}. ${c.publicado ? 'Cada uno ve su resultado al llegar la hora.' : 'Asigna el premio de cada uno en la lista de abajo y publica cuando esté todo.'}</small></div>
        <button type="button" class="btn ${c.publicado ? 'btn--ghost' : 'btn--dark'} btn--sm" data-srt-pub>${c.publicado ? 'Despublicar' : 'Publicar resultado'}</button>
      </div>
    </section>`;
  }
  function listen(){
    IB.sb.channel('panel-sorteo')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'sorteo_inscritos' }, async p => {
        if(p.eventType === 'INSERT'){
          if(rows.some(r => r.user_id === p.new.user_id)) return;
          if(!clientes[p.new.user_id]) await loadClientes();
          rows.unshift(p.new); fresh.add(p.new.user_id);
          setTimeout(() => { fresh.delete(p.new.user_id); paint(); }, 60000);
          toast(`<b>Nueva inscripción al sorteo</b>${esc(name(p.new.user_id))} se acaba de apuntar`);
        } else if(p.eventType === 'UPDATE'){
          rows = rows.map(r => r.user_id === p.new.user_id ? { ...r, ...p.new } : r);
        } else if(p.eventType === 'DELETE'){
          rows = rows.filter(r => r.user_id !== (p.old && p.old.user_id));
        }
        paint();
      })
      .subscribe();
  }
  async function start(){
    if(started) return; started = true;
    await load(); listen(); paint();
    tick = setInterval(() => { if(!root.hidden) paint(); }, 30000);   // refresca los «hace X min»
  }

  root.addEventListener('change', async e => {
    const f = e.target.closest('[data-snd]');
    if(f){
      const k = f.dataset.snd, file = f.files && f.files[0]; if(!file) return;
      if(file.size > MAX_MB * 1024 * 1024) return alert(`El archivo es muy grande (máximo ${MAX_MB} MB). Prueba a exportarlo en mp3 a 192 kbps: 5 minutos ocupan unos 7 MB.`);
      const lbl = f.closest('label'); const txt = lbl ? lbl.firstChild.textContent : '';
      if(lbl) lbl.firstChild.textContent = 'Subiendo…';
      const ext = (file.name.split('.').pop() || 'mp3').toLowerCase().replace(/[^a-z0-9]/g, '');
      const path = `${k}-${Date.now()}.${ext}`;
      const up = await IB.sb.storage.from('sorteo').upload(path, file, { upsert: true, contentType: file.type || 'audio/mpeg' });
      if(lbl) lbl.firstChild.textContent = txt;
      if(up.error) return alert('No se pudo subir: ' + up.error.message + (/size|large|exceed/i.test(up.error.message || '') ? '\n\nEjecuta 13-sorteo-tiradas-y-musica.sql en Supabase para subir el límite a 50 MB.' : '\n\n¿Has ejecutado supabase/sql/sorteo-sonidos.sql?'));
      const { data } = IB.sb.storage.from('sorteo').getPublicUrl(path);
      const sonidos = { ...((cfg || {}).sonidos || {}), [k]: data.publicUrl };
      return saveCfg({ sonidos }, 'Sonido subido');
    }
    const st = e.target.closest('[data-srt-tir]');
    if(st){
      const uid = st.dataset.srtTir, k = Number(st.value);
      busy.add(uid); paint();
      const { error } = await IB.sb.from('sorteo_ganadores').update({ tirada: k }).eq('user_id', uid);
      busy.delete(uid);
      if(error){ paint(); return alert('No se pudo guardar: ' + error.message + '\n\n¿Has ejecutado 13-sorteo-tiradas-y-musica.sql?'); }
      tirs.set(uid, k); paint();
      return toast(`<b>${esc(name(uid))}: premio en la tirada ${k}</b>En las demás tiradas le saldrá «nada».`);
    }
    const sel = e.target.closest('[data-srt-premio]'); if(!sel) return;
    const uid = sel.dataset.srtPremio, premio = sel.value;
    busy.add(uid); paint();
    const { error } = premio
      ? await IB.sb.from('sorteo_ganadores').upsert({ user_id: uid, premio, tanda: Number((cfg || {}).tanda) || 1 }, { onConflict: 'user_id' })
      : await IB.sb.from('sorteo_ganadores').delete().eq('user_id', uid);
    busy.delete(uid);
    if(error){ paint(); return alert('No se pudo guardar: ' + error.message + '\n\n¿Has ejecutado supabase/sql/sorteo-ruleta.sql y sorteo-premios.sql?'); }
    premio ? ganadores.set(uid, premio) : (ganadores.delete(uid), tirs.delete(uid)); paint();
    toast(premio ? `<b>${esc(name(uid))} → ${esc(premioLabel(premio))}</b>Lo verá al abrir su premio.` : `<b>${esc(name(uid))} se queda sin premio</b>`);
  });
  root.addEventListener('input', e => {
    const x = e.target;
    if(x.id && /^srt(Fecha|Hora|N|Acta|Sim|SimN|SimEn|SimT)$/.test(x.id)){ draft[x.id] = x.value; return; }
    if(x.dataset && x.dataset.cat){ draft['cat:' + x.dataset.cat] = x.value; return; }
    if(e.target.id !== 'srtQ') return;
    q = e.target.value; paint();
  });
  // quitar a alguien del sorteo: primer toque arma el botón, el segundo (en 4 s) lo borra
  let oyendo = null;
  root.addEventListener('click', async e => {
    const pl = e.target.closest('[data-snd-play]');
    if(pl){
      if(oyendo){ const era = oyendo.src; oyendo.pause(); oyendo = null; root.querySelectorAll('[data-snd-play]').forEach(b => b.textContent = 'Escuchar'); if(era === pl.dataset.sndPlay) return; }
      oyendo = new Audio(pl.dataset.sndPlay); pl.textContent = 'Parar';
      oyendo.addEventListener('ended', () => { pl.textContent = 'Escuchar'; oyendo = null; });
      return void oyendo.play().catch(() => { pl.textContent = 'Escuchar'; alert('No se pudo reproducir el archivo.'); });
    }
    const sd = e.target.closest('[data-snd-del]');
    if(sd){
      if(!confirm('¿Quitar este sonido? Volverá a sonar el de la web.')) return;
      const sonidos = { ...((cfg || {}).sonidos || {}) }; delete sonidos[sd.dataset.sndDel];
      return saveCfg({ sonidos }, 'Sonido quitado');
    }
    // nuevo sorteo: guarda la lista de ganadores del actual (CSV), los borra y deja el siguiente sin publicar
    if(e.target.closest('[data-srt-nuevo]')){
      if(!confirm('¿Preparar un sorteo nuevo?\n\n· Se descarga en tu ordenador la lista de ganadores del sorteo actual (guárdala: la necesitas para Hacienda y por si alguien reclama).\n· Se borran los premios asignados para empezar de cero.\n· Los apuntados siguen dentro con sus tiradas.\n· El nuevo sorteo queda sin publicar hasta que lo publiques.')) return;
      const filas = [['nombre', 'email', 'telefono', 'premio', 'tirada', 'fecha_sorteo']].concat([...ganadores.entries()].map(([uid, p]) => [name(uid), cli(uid).email || '', cli(uid).telefono || '', premioLabel(p) || p, tirs.get(uid) || '', (cfg || {}).fecha || '']));
      const celda = v => { let s = String(v == null ? '' : v); if(/^[=@\t\r]/.test(s) || (/^[+\-]/.test(s) && !/^[+\-]?[\d\s().,-]+$/.test(s))) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
      const csv = '﻿' + filas.map(f => f.map(celda).join(';')).join('\n');
      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
      a.download = `ganadores-sorteo-${(cfg || {}).fecha || 'sin-fecha'}.csv`; document.body.appendChild(a); a.click(); a.remove();
      const { error } = await IB.sb.from('sorteo_ganadores').delete().not('user_id', 'is', null);
      if(error) return alert('No se pudieron borrar los premios: ' + error.message);
      ganadores = new Map(); tirs = new Map();
      return saveCfg({ publicado: false, fecha: null, acta: null, tanda: (Number((cfg || {}).tanda) || 1) + 1 }, 'Listo: prepara el nuevo sorteo (día, hora, entradas y premios) y publícalo');
    }
    if(e.target.closest('[data-srt-cfg]')){
      const g = id => (document.getElementById(id) || {}).value;
      const premios = cat().map(x => ({ ...x, n: Math.max(0, Number((document.querySelector(`[data-cat="${x.id}"]`) || {}).value) || 0) }));
      if(!premios.some(x => x.n > 0)) return alert('Pon al menos un premio con cantidad.');
      return saveCfg({ fecha: g('srtFecha') || null, hora: g('srtHora') || '20:00', entradas: Number(g('srtN')) || 1, acta: (g('srtActa') || '').trim() || null, premios }, 'Configuración guardada');
    }
    const simRuleta = () => {
      const v = id => (document.getElementById(id) || {}).value;
      return IBRuleta.show({ premio: v('srtSim'), catalogo: cat(), nombre: 'Bruno', acta: (cfg || {}).acta, test: true, sonidos: (cfg || {}).sonidos,
        tiradas: Number(v('srtSimN')) || 1, ganaEn: Number(v('srtSimEn')) || 1,
        restantes: { entradas: Number((cfg || {}).entradas) || 3, dadas: 0 } });
    };
    if(e.target.closest('[data-srt-sim]') && window.IBRuleta) return void simRuleta();
    if(e.target.closest('[data-srt-simcd]') && window.IBCuenta && window.IBRuleta){
      const c = cfg || {};
      const sim = IBCuenta.simular({ segundos: Number((document.getElementById('srtSimT') || {}).value) || 320, musica: (c.sonidos || {}).cuenta || '',
        tanda: c.tanda || 1, entradas: c.entradas || 3, total: c.total || 10,
        onZero: () => { sim.close(true); simRuleta(); } });   // close(true): la música sigue sin cortes en la ruleta
      return;
    }
    if(e.target.closest('[data-srt-pub]')){
      const on = !(cfg || {}).publicado;
      const ent = dados('entrada');
      if(on && ent !== (Number(cfg.entradas) || 0) && !confirm(`Has asignado ${ent} entrada(s) y en este sorteo se sortean ${cfg.entradas}. ¿Publicar igualmente?`)) return;
      if(on && !confirm('Al publicar, cada persona podrá abrir su premio a partir de la hora que has puesto. ¿Seguimos?')) return;
      return saveCfg({ publicado: on }, on ? 'Publicado: ya pueden girar la ruleta' : 'Despublicado');
    }
    const b = e.target.closest('[data-srt-del]'); if(!b) return;
    const uid = b.dataset.srtDel;
    if(armed !== uid){ armed = uid; paint(); clearTimeout(armT); armT = setTimeout(() => { armed = null; paint(); }, 4000); return; }
    armed = null; clearTimeout(armT); busy.add(uid); paint();
    const { error } = await IB.sb.from('sorteo_inscritos').delete().eq('user_id', uid);
    if(!error && ganadores.has(uid)){ const g = await IB.sb.from('sorteo_ganadores').delete().eq('user_id', uid); if(!g.error){ ganadores.delete(uid); tirs.delete(uid); } }
    busy.delete(uid);
    if(error){ paint(); return alert('No se pudo quitar: ' + error.message + '\n\n¿Has ejecutado supabase/sql/sorteo-baja.sql?'); }
    const n = name(uid); rows = rows.filter(r => r.user_id !== uid); paint();
    toast(`<b>${esc(n)} ya no está en el sorteo</b>Se ha quitado su inscripción y sus tiradas`);
  });
  root.addEventListener('click', async e => {
    const b = e.target.closest('[data-srt-add]'); if(!b) return;
    const uid = b.dataset.srtAdd, d = Number(b.dataset.d), r = rows.find(x => x.user_id === uid); if(!r) return;
    const extra = Math.max(0, Math.min(20, (Number(r.extra) || 0) + d));
    busy.add(uid); paint();
    const { error } = await IB.sb.from('sorteo_inscritos').update({ extra }).eq('user_id', uid);
    busy.delete(uid);
    if(error){ paint(); return alert('No se pudo guardar: ' + error.message); }
    r.extra = extra; paint();
    toast(d > 0 ? `<b>+1 tirada para ${esc(name(uid))}</b>Ahora tiene ${tir(r)} tiradas` : `<b>Tirada extra quitada</b>${esc(name(uid))} tiene ${tir(r)} ${tir(r) === 1 ? 'tirada' : 'tiradas'}`);
  });

  window.IBSorteo = { show(){ paint(); start(); } };
  // arranca solo al abrir el panel, para que el contador de la pestaña y los avisos lleguen en directo
  setTimeout(() => { if(IB.sb && !started) IB.sb.auth.getSession().then(s => { if(s && s.data && s.data.session) start(); }); }, 2500);
})();
