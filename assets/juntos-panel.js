/* Iberail — panel: «Viajan juntos». Une dos grupos para que cada uno vea del otro la ruta, las fechas,
   el alojamiento y los nombres (nunca los pagos ni los billetes). Tabla grupo_enlaces (SQL 16).
   panel.js pinta <section data-juntos-admin="ID"> en la ficha de cada grupo y este archivo la rellena. */
(function(){
  const IB = window.IB;
  if(!IB || !IB.sb) return;
  const esc = IB.esc;
  const I_JUNTOS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="12" r="6"/><circle cx="15" cy="12" r="6"/></svg>';
  let enlaces = null, grupos = null, falta = false, cargando = null;
  const form = {};      // lo que se está escribiendo en cada ficha (sobrevive a los repintados del panel)

  async function load(force){
    if(cargando && !force) return cargando;
    cargando = (async () => {
      const [e, g] = await Promise.all([
        IB.sb.from('grupo_enlaces').select('*').order('created_at', { ascending: false }),
        IB.sb.from('grupos').select('id,nombre').order('created_at', { ascending: false })
      ]);
      falta = !!e.error;
      enlaces = e.error ? [] : (e.data || []);
      grupos = g.data || [];
    })();
    return cargando;
  }
  const nombre = id => (grupos.find(g => String(g.id) === String(id)) || {}).nombre || `Grupo ${id}`;

  function html(gid){
    const head = `<div class="adm-docs-head"><h3>${I_JUNTOS}Viajan juntos</h3></div>`;
    if(enlaces == null) return head + '<div class="auth-spin"></div>';
    if(falta) return head + '<p class="adm-docs-empty is-err">Falta ejecutar en Supabase el archivo <b>16-grupos-que-viajan-juntos.sql</b>.</p>';
    const mios = enlaces.filter(e => String(e.grupo_a) === String(gid) || String(e.grupo_b) === String(gid));
    const ya = new Set(mios.map(e => String(String(e.grupo_a) === String(gid) ? e.grupo_b : e.grupo_a)));
    const libres = grupos.filter(g => String(g.id) !== String(gid) && !ya.has(String(g.id)));
    const f = form[gid] || (form[gid] = { otro: '', viaje: '', nota: '', err: '', busy: false });
    return head + `
      <p class="adm-hint adm-hint--sm">Los dos grupos ven del otro la ruta (en el mismo mapa), las fechas, dónde duermen y los nombres. Los pagos y los billetes siguen siendo privados de cada grupo.</p>
      ${mios.length ? `<ul class="adm-members">${mios.map(e => { const otro = String(e.grupo_a) === String(gid) ? e.grupo_b : e.grupo_a; return `<li>
        <span class="adm-av">${I_JUNTOS}</span>
        <span class="adm-cli-who"><b>${esc(nombre(otro))}</b><small>${esc([e.nombre, e.nota].filter(Boolean).join(' · ') || 'Sin nota')}</small></span>
        <button type="button" class="pl-link" data-open-group="${esc(otro)}">Ver su grupo</button>
        <button type="button" class="pl-link dash-del" data-jt-del="${esc(e.id)}" data-jt-g="${esc(gid)}">Separar</button>
      </li>`; }).join('')}</ul>` : '<p class="adm-docs-empty">Este grupo no viaja con ningún otro.</p>'}
      ${libres.length ? `<div class="adm-jt-form" data-jt-form="${esc(gid)}">
        <label class="adm-f-field"><span>Unir con</span><select class="pl-input" data-jt-k="otro"><option value="">Elige un grupo…</option>${libres.map(g => `<option value="${esc(g.id)}"${String(g.id) === f.otro ? ' selected' : ''}>${esc(g.nombre)}</option>`).join('')}</select></label>
        <label class="adm-f-field"><span>Nombre del viaje común <small>(opcional)</small></span><input class="pl-input" data-jt-k="viaje" maxlength="80" placeholder="Ej.: Ultra 2027 juntos" value="${esc(f.viaje)}"></label>
        <label class="adm-f-field"><span>Nota para los dos grupos <small>(opcional)</small></span><input class="pl-input" data-jt-k="nota" maxlength="200" placeholder="Ej.: Coincidís en Split del 8 al 12" value="${esc(f.nota)}"></label>
        ${f.err ? `<p class="adm-docs-empty is-err">${esc(f.err)}</p>` : ''}
        <button type="button" class="btn btn--dark btn--sm" data-jt-save="${esc(gid)}"${f.busy ? ' disabled' : ''}>${f.busy ? 'Uniendo…' : 'Unir los dos grupos'}</button>
      </div>` : ''}`;
  }
  const paint = () => document.querySelectorAll('[data-juntos-admin]').forEach(el => { el.innerHTML = html(el.dataset.juntosAdmin); });
  async function mount(el){
    el.dataset.jtMounted = '1';
    el.innerHTML = html(el.dataset.juntosAdmin);
    await load();
    if(el.isConnected) el.innerHTML = html(el.dataset.juntosAdmin);
  }

  async function save(gid){
    const f = form[gid]; if(!f || f.busy) return;
    if(!f.otro){ f.err = 'Elige con qué grupo viajan.'; return paint(); }
    f.busy = true; f.err = ''; paint();
    const { error } = await IB.sb.from('grupo_enlaces').insert({ grupo_a: Number(gid), grupo_b: Number(f.otro), nombre: f.viaje.trim() || null, nota: f.nota.trim() || null });
    f.busy = false;
    if(error){ f.err = /duplicate|23505/i.test((error.message || '') + (error.code || '')) ? 'Estos dos grupos ya están unidos.' : (IB.errMsg ? IB.errMsg(error) : error.message); return paint(); }
    form[gid] = null;
    await load(true); paint();
  }
  async function del(id){
    const { error } = await IB.sb.from('grupo_enlaces').delete().eq('id', id);
    if(error) return alert('No se pudo separar: ' + (error.message || error));
    await load(true); paint();
  }

  const armed = new Map();
  document.addEventListener('click', e => {
    const t = e.target;
    const sv = t.closest('[data-jt-save]'); if(sv) return save(sv.dataset.jtSave);
    const dl = t.closest('[data-jt-del]');
    if(dl){
      // dos toques para separar, como el resto del panel
      if(!armed.get(dl.dataset.jtDel)){ armed.set(dl.dataset.jtDel, 1); dl.textContent = '¿Separar? Toca otra vez'; setTimeout(() => { armed.delete(dl.dataset.jtDel); if(dl.isConnected) dl.textContent = 'Separar'; }, 4000); return; }
      armed.delete(dl.dataset.jtDel); return del(dl.dataset.jtDel);
    }
  });
  const onField = e => {
    const k = e.target.dataset && e.target.dataset.jtK, box = e.target.closest && e.target.closest('[data-jt-form]');
    if(k && box){ const f = form[box.dataset.jtForm]; if(f){ f[k] = e.target.value; f.err = ''; } }
  };
  document.addEventListener('input', onField);
  document.addEventListener('change', onField);

  const st = document.createElement('style');
  st.textContent = '.adm-jt-form{display:grid;gap:10px;margin-top:14px}.adm-jt-form .btn{justify-self:start}.jt-adm .adm-av svg{width:16px;height:16px;fill:none;stroke:currentColor;stroke-width:2}';
  document.head.appendChild(st);
  // panel.js repinta la ficha a menudo: se engancha solo a cada hueco nuevo
  const scan = () => document.querySelectorAll('[data-juntos-admin]:not([data-jt-mounted])').forEach(mount);
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  scan();
})();
