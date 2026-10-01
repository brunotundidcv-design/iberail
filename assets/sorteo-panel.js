/* Iberail — panel: pestaña «Sorteo»
   Inscripciones al sorteo de 10 entradas del Ultra Europe en tiempo real (tabla sorteo_inscritos,
   archivo 12-sorteo.sql). Tiradas de cada persona = 1 + extra; el equipo suma o quita extras
   (p. ej. +1 por subir el cartel a su story de Instagram). */
(function(){
  const IB = window.IB, root = document.getElementById('srtView');
  if(!IB || !root) return;
  const esc = IB.esc;
  let started = false, loaded = false, rows = [], clientes = {}, err = '', q = '', fresh = new Set(), tick = null, busy = new Set(), armed = null, armT = null;
  let cfg = null, cfgErr = '', ganadores = new Set();

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
        <div class="lv-stat"><b>${ganadores.size}</b><small>${ganadores.size === 1 ? 'ganador marcado' : 'ganadores marcados'}</small></div>
      </div>
      <section class="lv-card srtp">
        <div class="srtp-h">
          <h3>🎟️ Inscritos al sorteo · 10 entradas Ultra Europe</h3>
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
              <button type="button" class="srtp-win${ganadores.has(r.user_id) ? ' is-on' : ''}" data-srt-win="${esc(r.user_id)}"${wait ? ' disabled' : ''} title="Marcar como ganador de esta tanda">${ganadores.has(r.user_id) ? '🏆 Gana' : 'Marcar ganador'}</button>
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
      IB.sb.from('sorteo_ganadores').select('user_id'),
      loadClientes()
    ]);
    err = r.error ? r.error.message : '';
    rows = r.data || [];
    cfgErr = c.error ? c.error.message : '';
    cfg = c.data || { fecha: '', hora: '20:00', entradas: 3, total: 10, tanda: 1, publicado: false, acta: '' };
    ganadores = new Set((g.data || []).map(x => x.user_id));
    loaded = true;
  }
  async function saveCfg(patch, msg){
    const { error } = await IB.sb.from('sorteo_config').update(patch).eq('id', 1);
    if(error) return alert('No se pudo guardar: ' + error.message + '\n\n¿Has ejecutado supabase/sql/sorteo-ruleta.sql?');
    cfg = { ...cfg, ...patch }; paint(); if(msg) toast(msg);
  }
  function cfgHtml(){
    const c = cfg || {}, n = ganadores.size;
    const faltan = Math.max(0, (Number(c.entradas) || 0) - n);
    return `<section class="lv-card srtc">
      <div class="srtp-h"><h3>⚙️ Configuración del sorteo</h3></div>
      <p class="srtp-hint">El sorteo lo celebras tú aparte. Aquí pones <b>cuándo se revela</b> y <b>a quién le ha tocado</b>; cada persona gira la ruleta en su cuenta y ve su resultado. Hasta que no le des a «Publicar», nadie ve nada.</p>
      ${cfgErr ? `<p class="lv-empty is-err">${esc(cfgErr)} · Ejecuta <b>supabase/sql/sorteo-ruleta.sql</b> en Supabase.</p>` : ''}
      <div class="srtc-grid">
        <label>Día de la revelación<input class="pl-input" type="date" id="srtFecha" value="${esc(c.fecha || '')}"></label>
        <label>Hora<input class="pl-input" type="time" id="srtHora" value="${esc(c.hora || '20:00')}"></label>
        <label>Entradas de esta tanda<input class="pl-input" type="number" min="1" max="20" id="srtN" value="${esc(c.entradas || 3)}"></label>
        <label>Entradas en total<input class="pl-input" type="number" min="1" max="50" id="srtTot" value="${esc(c.total || 10)}"></label>
        <label class="srtc-wide">Cómo se hizo el sorteo <small>(se lo enseñamos a quien pregunte)</small><input class="pl-input" id="srtActa" maxlength="200" value="${esc(c.acta || '')}" placeholder="Ej.: sorteo celebrado el 1 de octubre de 2026 con random.org entre los 48 apuntados."></label>
      </div>
      <div class="srtc-acts">
        <button type="button" class="btn btn--dark btn--sm" data-srt-cfg>Guardar</button>
        <button type="button" class="btn btn--ghost btn--sm" data-srt-sim="win">Simular: me toca</button>
        <button type="button" class="btn btn--ghost btn--sm" data-srt-sim="lose">Simular: no me toca</button>
      </div>
      <div class="srtc-pub${c.publicado ? ' is-on' : ''}">
        <div><b>${c.publicado ? 'Publicado: la ruleta ya está disponible' : 'Sin publicar'}</b>
          <small>${n} ${n === 1 ? 'ganador marcado' : 'ganadores marcados'}${faltan ? ` · faltan ${faltan}` : ''}. ${c.publicado ? 'Cada uno ve su resultado al llegar la hora.' : 'Marca a los ganadores en la lista de abajo y publica cuando esté todo.'}</small></div>
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

  root.addEventListener('input', e => {
    if(e.target.id !== 'srtQ') return;
    q = e.target.value; const pos = e.target.selectionStart; paint();
    const i = document.getElementById('srtQ'); if(i){ i.focus(); try{ i.setSelectionRange(pos, pos); }catch(_){} }
  });
  // quitar a alguien del sorteo: primer toque arma el botón, el segundo (en 4 s) lo borra
  root.addEventListener('click', async e => {
    if(e.target.closest('[data-srt-cfg]')){
      const g = id => (document.getElementById(id) || {}).value;
      return saveCfg({ fecha: g('srtFecha') || null, hora: g('srtHora') || '20:00', entradas: Number(g('srtN')) || 3, total: Number(g('srtTot')) || 10, acta: (g('srtActa') || '').trim() || null }, 'Configuración guardada');
    }
    const sim = e.target.closest('[data-srt-sim]');
    if(sim && window.IBRuleta) return void IBRuleta.show({ gana: sim.dataset.srtSim === 'win', nombre: 'Bruno', entradas: Number((cfg || {}).entradas) || 3, total: Number((cfg || {}).total) || 10, acta: (cfg || {}).acta, test: true });
    if(e.target.closest('[data-srt-pub]')){
      const on = !(cfg || {}).publicado;
      if(on && ganadores.size !== (Number(cfg.entradas) || 0) && !confirm(`Has marcado ${ganadores.size} ganador(es) y la tanda es de ${cfg.entradas}. ¿Publicar igualmente?`)) return;
      if(on && !confirm('Al publicar, cada persona podrá girar la ruleta y ver su resultado a partir de la hora que has puesto. ¿Seguimos?')) return;
      return saveCfg({ publicado: on }, on ? 'Publicado: ya pueden girar la ruleta' : 'Despublicado');
    }
    const wn = e.target.closest('[data-srt-win]');
    if(wn){
      const uid = wn.dataset.srtWin, ya = ganadores.has(uid);
      busy.add(uid); paint();
      const { error } = ya ? await IB.sb.from('sorteo_ganadores').delete().eq('user_id', uid)
        : await IB.sb.from('sorteo_ganadores').insert({ user_id: uid, tanda: Number((cfg || {}).tanda) || 1 });
      busy.delete(uid);
      if(error){ paint(); return alert('No se pudo guardar: ' + error.message + '\n\n¿Has ejecutado supabase/sql/sorteo-ruleta.sql?'); }
      ya ? ganadores.delete(uid) : ganadores.add(uid); paint();
      return toast(ya ? `<b>${esc(name(uid))} ya no es ganador</b>` : `<b>🏆 ${esc(name(uid))} gana una entrada</b>Lo verá al girar la ruleta cuando publiques.`);
    }
    const b = e.target.closest('[data-srt-del]'); if(!b) return;
    const uid = b.dataset.srtDel;
    if(armed !== uid){ armed = uid; paint(); clearTimeout(armT); armT = setTimeout(() => { armed = null; paint(); }, 4000); return; }
    armed = null; clearTimeout(armT); busy.add(uid); paint();
    const { error } = await IB.sb.from('sorteo_inscritos').delete().eq('user_id', uid);
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
