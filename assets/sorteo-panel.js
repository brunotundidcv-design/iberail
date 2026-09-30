/* Iberail — panel: pestaña «Sorteo»
   Inscripciones al sorteo de 10 entradas del Ultra Europe en tiempo real (tabla sorteo_inscritos,
   archivo 12-sorteo.sql). Tiradas de cada persona = 1 + extra; el equipo suma o quita extras
   (p. ej. +1 por subir el cartel a su story de Instagram). */
(function(){
  const IB = window.IB, root = document.getElementById('srtView');
  if(!IB || !root) return;
  const esc = IB.esc;
  let started = false, loaded = false, rows = [], clientes = {}, err = '', q = '', fresh = new Set(), tick = null, busy = new Set(), armed = null, armT = null;

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
    root.innerHTML = `
      <div class="lv-stats">
        <div class="lv-stat is-live"><span class="lv-dot"></span><b>${rows.length}</b><small>${rows.length === 1 ? 'persona apuntada' : 'personas apuntadas'} · en directo</small></div>
        <div class="lv-stat"><b>${total}</b><small>tiradas en la ruleta</small></div>
        <div class="lv-stat"><b>${ig}</b><small>con tirada extra (Instagram)</small></div>
        <div class="lv-stat"><b>${rows[0] ? esc(ago(rows[0].created_at)) : '—'}</b><small>última inscripción</small></div>
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
    const [r] = await Promise.all([
      IB.sb.from('sorteo_inscritos').select('*').order('created_at', { ascending: false }),
      loadClientes()
    ]);
    err = r.error ? r.error.message : '';
    rows = r.data || [];
    loaded = true;
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
