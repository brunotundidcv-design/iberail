/* Iberail — alojamientos del grupo
   · «Mis grupos» (cuenta.js pinta <div data-aloj="ID">): una tarjeta por ciudad; al tocarla se abre la galería.
   · Panel (panel.js pinta <section data-aloj-admin="ID">): añadir, editar y borrar alojamientos y subir fotos.
   Tabla `alojamientos` + bucket privado `alojamientos/<grupo>/…` (ver supabase/sql/alojamientos.sql). */
(function(){
  const IB = window.IB;
  if(!IB) return;
  const esc = IB.esc;
  const BUCKET = 'alojamientos';
  const cache = {};            // grupo → lista de alojamientos
  const urls = {};             // ruta de la foto → enlace firmado
  const loading = {};
  const edit = {};             // grupo → { id|null, v:{…}, fotos:[…], subiendo:n } (panel)
  let missing = false;         // la tabla aún no existe

  const I = {
    bed: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18V7M3 13h18v5M21 18v-3a3 3 0 00-3-3h-7v1"/><circle cx="7" cy="10.5" r="1.8"/></svg>',
    pin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0119 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>',
    cam: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/></svg>',
    ext: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    l: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    r: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    arr: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
  };
  const fd = iso => iso ? new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '') : '';
  const flong = iso => { if(!iso) return ''; const t = new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }); return t.charAt(0).toUpperCase() + t.slice(1); };
  const noches = a => a.entrada && a.salida ? Math.max(0, Math.round((new Date(a.salida) - new Date(a.entrada)) / 864e5)) : 0;
  const plural = (n, a, b) => n === 1 ? a : b;
  const byDate = (a, b) => String(a.entrada || '9').localeCompare(String(b.entrada || '9')) || a.id - b.id;

  async function load(gid, force){
    if(!IB.sb) return [];
    if(cache[gid] && !force) return cache[gid];
    if(loading[gid]) return loading[gid];
    loading[gid] = (async () => {
      const { data, error } = await IB.sb.from('alojamientos').select('*').eq('grupo_id', Number(gid));
      if(error){ if(/alojamientos/.test(error.message || '') && /(does not exist|schema cache|not find)/i.test(error.message || '')) missing = true; cache[gid] = []; }
      else cache[gid] = (data || []).sort(byDate);
      delete loading[gid];
      return cache[gid];
    })();
    return loading[gid];
  }
  async function sign(paths){
    const need = paths.filter(p => p && !urls[p]);
    if(need.length){
      try{
        const { data } = await IB.sb.storage.from(BUCKET).createSignedUrls(need, 3600);
        (data || []).forEach(x => { if(x && x.signedUrl && !x.error) urls[x.path] = x.signedUrl; });
      }catch(e){}
    }
    return paths.map(p => urls[p]).filter(Boolean);
  }

  /* ================== «Mis grupos»: tarjetas por ciudad ================== */
  function viewHtml(gid, list){
    if(!list.length) return '';
    return `<div class="al-sec">
      <div class="gx-sec-h"><span class="gx-ic">${I.bed}</span><b>Vuestros alojamientos</b><em class="gx-pill">${list.length} ${plural(list.length, 'ciudad', 'ciudades')}</em></div>
      <div class="al-grid">${list.map((a, i) => {
        const n = noches(a), f = (a.fotos || []).length;
        return `<button type="button" class="al-card" data-al-open="${esc(gid)}:${esc(a.id)}" style="--i:${i}">
          <span class="al-card-top"><span class="al-num">${String(i + 1).padStart(2, '0')}</span>${f ? `<span class="al-chip">${I.cam}${f}</span>` : ''}</span>
          <b class="al-city">${esc(a.ciudad)}</b>
          <span class="al-when">${a.entrada ? `${esc(fd(a.entrada))}${a.salida ? ` → ${esc(fd(a.salida))}` : ''}` : 'Fechas por confirmar'}${n ? ` · ${n} ${plural(n, 'noche', 'noches')}` : ''}</span>
          ${a.nombre ? `<span class="al-name">${esc(a.nombre)}</span>` : ''}
          <span class="al-go">${f ? 'Ver fotos' : 'Ver detalles'} ${I.arr}</span>
        </button>`;
      }).join('')}</div>
    </div>`;
  }
  async function mountView(el){
    const gid = el.dataset.aloj;
    el.dataset.alMounted = '1';
    if(cache[gid]) el.innerHTML = viewHtml(gid, cache[gid]);
    const list = await load(gid);
    if(el.isConnected) el.innerHTML = viewHtml(gid, list);
    listen(gid);
  }

  /* ================== galería a pantalla completa ================== */
  let lb = null;
  async function openGallery(gid, id){
    const a = (cache[gid] || []).find(x => String(x.id) === String(id));
    if(!a) return;
    const n = noches(a), maps = a.direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(a.direccion + ', ' + a.ciudad)}` : '';
    lb = document.createElement('div');
    lb.className = 'al-lb';
    lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true'); lb.setAttribute('aria-label', `Alojamiento en ${a.ciudad}`);
    lb.innerHTML = `<div class="al-lb-in">
      <header class="al-lb-h"><div><small>${I.bed} Alojamiento</small><b>${esc(a.ciudad)}</b></div><button type="button" class="al-lb-x" data-al-close aria-label="Cerrar">${I.x}</button></header>
      <div class="al-lb-stage"><div class="al-lb-track" tabindex="0"><div class="al-lb-load"><span class="auth-spin"></span></div></div>
        <button type="button" class="al-lb-nav is-l" data-al-nav="-1" aria-label="Foto anterior">${I.l}</button><button type="button" class="al-lb-nav is-r" data-al-nav="1" aria-label="Foto siguiente">${I.r}</button>
        <span class="al-lb-count" aria-live="polite"></span></div>
      <div class="al-lb-thumbs"></div>
      <div class="al-lb-info">
        ${a.nombre ? `<h3>${esc(a.nombre)}</h3>` : ''}
        <dl class="al-lb-dl">
          <div><dt>Entrada</dt><dd>${a.entrada ? esc(flong(a.entrada)) : 'Por confirmar'}</dd></div>
          <div><dt>Salida</dt><dd>${a.salida ? esc(flong(a.salida)) : 'Por confirmar'}</dd></div>
          ${n ? `<div><dt>Noches</dt><dd>${n}</dd></div>` : ''}
        </dl>
        ${a.direccion ? `<a class="al-lb-addr" href="${esc(maps)}" target="_blank" rel="noopener">${I.pin}<span>${esc(a.direccion)}</span></a>` : ''}
        ${a.notas ? `<p class="al-lb-notes">${esc(a.notas).replace(/\n/g, '<br>')}</p>` : ''}
        ${a.enlace ? `<a class="btn btn--primary al-lb-cta" href="${esc(a.enlace)}" target="_blank" rel="noopener">Ver el anuncio completo ${I.ext}</a>` : ''}
      </div></div>`;
    document.body.appendChild(lb);
    document.body.classList.add('al-lock');
    requestAnimationFrame(() => lb && lb.classList.add('is-in'));
    lb.querySelector('.al-lb-x').focus();

    const fotos = await sign(a.fotos || []);
    if(!lb) return;
    const track = lb.querySelector('.al-lb-track'), thumbs = lb.querySelector('.al-lb-thumbs'), count = lb.querySelector('.al-lb-count');
    if(!fotos.length){
      track.innerHTML = `<div class="al-lb-empty">${I.cam}<b>Fotos en camino</b><span>Las subimos en cuanto las tengamos.</span></div>`;
      lb.querySelectorAll('.al-lb-nav').forEach(b => b.hidden = true);
      return;
    }
    track.innerHTML = fotos.map((u, i) => `<figure class="al-lb-slide"><img src="${esc(u)}" alt="${esc(a.ciudad)} · foto ${i + 1}" ${i > 1 ? 'loading="lazy"' : ''} decoding="async"></figure>`).join('');
    thumbs.innerHTML = fotos.length > 1 ? fotos.map((u, i) => `<button type="button" data-al-go="${i}" aria-label="Foto ${i + 1}"><img src="${esc(u)}" alt="" loading="lazy"></button>`).join('') : '';
    lb.querySelectorAll('.al-lb-nav').forEach(b => b.hidden = fotos.length < 2);
    const cur = () => Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
    const paint = () => { const c = cur(); count.textContent = `${c + 1} / ${fotos.length}`; thumbs.querySelectorAll('button').forEach((b, i) => b.classList.toggle('is-on', i === c)); };
    track.addEventListener('scroll', () => requestAnimationFrame(paint), { passive: true });
    lb._go = i => track.scrollTo({ left: Math.max(0, Math.min(fotos.length - 1, i)) * track.clientWidth, behavior: 'smooth' });
    lb._step = d => lb._go(cur() + d);
    paint();
  }
  function closeGallery(){
    if(!lb) return;
    const el = lb; lb = null;
    el.classList.remove('is-in');
    document.body.classList.remove('al-lock');
    setTimeout(() => el.remove(), 250);
  }

  /* ================== panel: editor ================== */
  const blank = () => ({ id: null, v: { ciudad: '', nombre: '', enlace: '', direccion: '', entrada: '', salida: '', notas: '' }, fotos: [], subiendo: 0, open: true, err: '' });
  function adminHtml(gid, list){
    if(missing) return `<div class="adm-docs-head"><h3>${I.bed}Alojamientos</h3></div><p class="adm-docs-empty is-err">Falta crear la tabla: ejecuta <b>supabase/sql/alojamientos.sql</b> en Supabase.</p>`;
    const e = edit[gid];
    const rows = list.map(a => `<div class="al-adm-row">
        <div class="al-adm-thumb">${(a.fotos || []).length ? `<img data-al-sign="${esc(a.fotos[0])}" alt="">` : I.bed}</div>
        <div class="al-adm-main"><b>${esc(a.ciudad)}</b><small>${a.entrada ? `${esc(fd(a.entrada))} → ${esc(fd(a.salida))}` : 'Sin fechas'} · ${(a.fotos || []).length} ${plural((a.fotos || []).length, 'foto', 'fotos')}${a.nombre ? ` · ${esc(a.nombre)}` : ''}</small></div>
        <button type="button" class="btn btn--ghost btn--sm" data-al-edit="${esc(gid)}:${esc(a.id)}">Editar</button>
      </div>`).join('');
    return `<div class="adm-docs-head"><h3>${I.bed}Alojamientos</h3><small>${list.length ? `${list.length} · ` : ''}los ve todo el grupo en «Mis grupos»</small></div>
      ${rows ? `<div class="al-adm-list">${rows}</div>` : '<p class="adm-docs-empty">Aún no hay alojamientos. Añade uno por ciudad con sus fotos.</p>'}
      ${e && e.open ? formHtml(gid, e) : `<button type="button" class="btn btn--dark btn--sm al-adm-add" data-al-new="${esc(gid)}">${I.plus}<span>Añadir alojamiento</span></button>`}`;
  }
  function formHtml(gid, e){
    const v = e.v, f = (k, label, type = 'text', extra = '') => `<label class="al-f"><span>${label}</span><input data-al-k="${k}" type="${type}" value="${esc(v[k] || '')}" ${extra}></label>`;
    return `<div class="al-form" data-al-form="${esc(gid)}">
      <div class="al-form-grid">
        ${f('ciudad', 'Ciudad *', 'text', 'list="admCities" placeholder="Split" required')}
        ${f('nombre', 'Nombre', 'text', 'placeholder="Apartamento junto al Palacio de Diocleciano"')}
        ${f('entrada', 'Entrada', 'date')}
        ${f('salida', 'Salida', 'date')}
        ${f('direccion', 'Dirección', 'text', 'placeholder="Ulica Kralja Zvonimira 5"')}
        ${f('enlace', 'Enlace al anuncio', 'url', 'placeholder="https://www.airbnb.es/rooms/…"')}
      </div>
      <label class="al-f"><span>Notas para el grupo</span><textarea data-al-k="notas" rows="2" placeholder="Check-in a partir de las 15:00, código de la puerta el día antes…">${esc(v.notas || '')}</textarea></label>
      <div class="al-drop" data-al-drop="${esc(gid)}" tabindex="0" role="button" aria-label="Añadir fotos">
        <input type="file" accept="image/*" multiple hidden data-al-file>
        ${I.cam}<b>Arrastra aquí las fotos</b><span>o pulsa para elegirlas · la primera es la portada</span>
      </div>
      ${e.fotos.length || e.subiendo ? `<div class="al-thumbs">${e.fotos.map((p, i) => `<div class="al-th"><img data-al-sign="${esc(p)}" alt=""><span>${i + 1}</span><button type="button" data-al-rm="${i}" aria-label="Quitar foto">${I.x}</button>${i ? `<button type="button" class="al-th-first" data-al-first="${i}" title="Poner de portada">★</button>` : ''}</div>`).join('')}${Array.from({ length: e.subiendo }, () => '<div class="al-th is-up"><span class="auth-spin"></span></div>').join('')}</div>` : ''}
      ${e.err ? `<p class="adm-docs-empty is-err">${esc(e.err)}</p>` : ''}
      <div class="al-form-acts">
        ${e.id ? `<button type="button" class="btn btn--ghost btn--sm al-del" data-al-del="${esc(gid)}">Borrar</button>` : ''}
        <span></span>
        <button type="button" class="btn btn--ghost btn--sm" data-al-cancel="${esc(gid)}">Cancelar</button>
        <button type="button" class="btn btn--dark btn--sm" data-al-save="${esc(gid)}" ${e.subiendo ? 'disabled' : ''}>${e.subiendo ? 'Subiendo fotos…' : e.id ? 'Guardar cambios' : 'Guardar alojamiento'}</button>
      </div>
    </div>`;
  }
  async function signImgs(root){
    const imgs = [...root.querySelectorAll('img[data-al-sign]')];
    if(!imgs.length) return;
    await sign(imgs.map(i => i.dataset.alSign));
    imgs.forEach(i => { const u = urls[i.dataset.alSign]; if(u) i.src = u; });
  }
  function paintAdmin(gid){
    document.querySelectorAll(`[data-aloj-admin="${gid}"]`).forEach(el => { el.innerHTML = adminHtml(gid, cache[gid] || []); signImgs(el); });
  }
  async function mountAdmin(el){
    const gid = el.dataset.alojAdmin;
    el.dataset.alMounted = '1';
    el.innerHTML = cache[gid] ? adminHtml(gid, cache[gid]) : `<div class="adm-docs-head"><h3>${I.bed}Alojamientos</h3></div><div class="auth-spin"></div>`;
    await load(gid);
    if(el.isConnected){ el.innerHTML = adminHtml(gid, cache[gid]); signImgs(el); }
  }

  // fotos: se reducen en el navegador (lado largo 1800 px, JPEG) para que suban rápido y carguen rápido
  function shrink(file){
    return new Promise(res => {
      const img = new Image(), u = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, 1800 / Math.max(img.width, img.height));
        const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(u);
        c.toBlob(b => res(b || file), 'image/jpeg', 0.84);
      };
      img.onerror = () => { URL.revokeObjectURL(u); res(file); };
      img.src = u;
    });
  }
  async function addFiles(gid, files){
    const e = edit[gid]; if(!e) return;
    const list = [...files].filter(f => /^image\//.test(f.type)).slice(0, 30);
    if(!list.length) return;
    e.subiendo += list.length; e.err = ''; paintAdmin(gid);
    await Promise.all(list.map(async file => {
      try{
        const blob = await shrink(file);
        const path = `${gid}/${(crypto.randomUUID ? crypto.randomUUID() : Date.now() + '-' + Math.random().toString(36).slice(2))}.jpg`;
        const { error } = await IB.sb.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg', cacheControl: '31536000' });
        if(error) throw error;
        e.fotos.push(path);
      }catch(err){ e.err = 'Alguna foto no se ha podido subir: ' + (err.message || err); }
      e.subiendo--; paintAdmin(gid);
    }));
  }
  async function save(gid){
    const e = edit[gid]; if(!e || e.subiendo) return;
    const v = e.v;
    if(!String(v.ciudad || '').trim()){ e.err = 'Pon la ciudad.'; return paintAdmin(gid); }
    if(v.entrada && v.salida && v.salida < v.entrada){ e.err = 'La salida es antes que la entrada.'; return paintAdmin(gid); }
    if(v.enlace && !/^https?:\/\//.test(v.enlace)) v.enlace = 'https://' + v.enlace;
    const row = { grupo_id: Number(gid), ciudad: v.ciudad.trim(), nombre: v.nombre.trim() || null, enlace: v.enlace.trim() || null, direccion: v.direccion.trim() || null, entrada: v.entrada || null, salida: v.salida || null, notas: v.notas.trim() || null, fotos: e.fotos };
    const q = e.id ? IB.sb.from('alojamientos').update(row).eq('id', e.id) : IB.sb.from('alojamientos').insert(row);
    const { error } = await q;
    if(error){ e.err = IB.errMsg ? IB.errMsg(error) : error.message; return paintAdmin(gid); }
    // fotos quitadas al editar: se borran del almacenamiento
    const before = e.id ? ((cache[gid] || []).find(a => a.id === e.id) || {}).fotos || [] : [];
    const gone = before.filter(p => !e.fotos.includes(p));
    if(gone.length) IB.sb.storage.from(BUCKET).remove(gone).catch(() => {});
    delete edit[gid];
    await load(gid, true); paintAdmin(gid);
  }
  async function del(gid){
    const e = edit[gid]; if(!e || !e.id) return;
    const a = (cache[gid] || []).find(x => x.id === e.id);
    if(!confirm(`¿Borrar el alojamiento de ${a ? a.ciudad : 'esta ciudad'} y sus fotos?`)) return;
    const { error } = await IB.sb.from('alojamientos').delete().eq('id', e.id);
    if(error){ e.err = error.message; return paintAdmin(gid); }
    if(a && (a.fotos || []).length) IB.sb.storage.from(BUCKET).remove(a.fotos).catch(() => {});
    delete edit[gid];
    await load(gid, true); paintAdmin(gid);
  }
  async function cancel(gid){
    const e = edit[gid];
    // fotos subidas en esta edición que no llegaron a guardarse
    const saved = e && e.id ? ((cache[gid] || []).find(a => a.id === e.id) || {}).fotos || [] : [];
    const orphan = e ? e.fotos.filter(p => !saved.includes(p)) : [];
    if(orphan.length) IB.sb.storage.from(BUCKET).remove(orphan).catch(() => {});
    delete edit[gid]; paintAdmin(gid);
  }

  /* ================== tiempo real ================== */
  const chans = {};
  function listen(gid){
    if(chans[gid] || !IB.sb || !IB.sb.channel) return;
    try{
      chans[gid] = IB.sb.channel('aloj-' + gid)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'alojamientos', filter: `grupo_id=eq.${gid}` }, async () => {
          await load(gid, true);
          document.querySelectorAll(`[data-aloj="${gid}"]`).forEach(el => { el.innerHTML = viewHtml(gid, cache[gid]); });
        }).subscribe();
    }catch(e){}
  }

  /* ================== eventos ================== */
  document.addEventListener('click', e => {
    const t = e.target;
    const op = t.closest('[data-al-open]'); if(op){ const [g, id] = op.dataset.alOpen.split(':'); return openGallery(g, id); }
    if(lb){
      if(t.closest('[data-al-close]') || t === lb) return closeGallery();
      const nv = t.closest('[data-al-nav]'); if(nv && lb._step) return lb._step(Number(nv.dataset.alNav));
      const go = t.closest('[data-al-go]'); if(go && lb._go) return lb._go(Number(go.dataset.alGo));
    }
    const nw = t.closest('[data-al-new]'); if(nw){ edit[nw.dataset.alNew] = blank(); return paintAdmin(nw.dataset.alNew); }
    const ed = t.closest('[data-al-edit]'); if(ed){
      const [g, id] = ed.dataset.alEdit.split(':'), a = (cache[g] || []).find(x => String(x.id) === id);
      if(a){ edit[g] = { id: a.id, v: { ciudad: a.ciudad || '', nombre: a.nombre || '', enlace: a.enlace || '', direccion: a.direccion || '', entrada: a.entrada || '', salida: a.salida || '', notas: a.notas || '' }, fotos: (a.fotos || []).slice(), subiendo: 0, open: true, err: '' }; paintAdmin(g); }
      return;
    }
    const form = t.closest('[data-al-form]'), g = form && form.dataset.alForm;
    if(!g || !edit[g]) return;
    if(t.closest('[data-al-drop]')) return form.querySelector('[data-al-file]').click();
    const rm = t.closest('[data-al-rm]'); if(rm){ edit[g].fotos.splice(Number(rm.dataset.alRm), 1); return paintAdmin(g); }
    const fi = t.closest('[data-al-first]'); if(fi){ const f = edit[g].fotos; f.unshift(f.splice(Number(fi.dataset.alFirst), 1)[0]); return paintAdmin(g); }
    if(t.closest('[data-al-save]')) return save(g);
    if(t.closest('[data-al-cancel]')) return cancel(g);
    if(t.closest('[data-al-del]')) return del(g);
  });
  document.addEventListener('input', e => {
    const k = e.target.dataset && e.target.dataset.alK, form = e.target.closest && e.target.closest('[data-al-form]');
    if(k && form && edit[form.dataset.alForm]) edit[form.dataset.alForm].v[k] = e.target.value;
  });
  document.addEventListener('change', e => {
    if(!e.target.matches || !e.target.matches('[data-al-file]')) return;
    const form = e.target.closest('[data-al-form]'); if(form) addFiles(form.dataset.alForm, e.target.files);
  });
  ['dragover', 'dragleave', 'drop'].forEach(ev => document.addEventListener(ev, e => {
    const d = e.target.closest && e.target.closest('[data-al-drop]'); if(!d) return;
    e.preventDefault();
    d.classList.toggle('is-over', ev === 'dragover');
    if(ev === 'drop') addFiles(d.dataset.alDrop, e.dataTransfer.files);
  }));
  document.addEventListener('keydown', e => {
    if(lb){
      if(e.key === 'Escape') closeGallery();
      if(e.key === 'ArrowRight' && lb._step) lb._step(1);
      if(e.key === 'ArrowLeft' && lb._step) lb._step(-1);
      return;
    }
    const d = e.target.closest && e.target.closest('[data-al-drop]');
    if(d && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); d.querySelector('[data-al-file]').click(); }
  });

  // cuenta.js y panel.js repintan a menudo: se engancha solo a cada hueco nuevo
  const scan = () => {
    document.querySelectorAll('[data-aloj]:not([data-al-mounted])').forEach(mountView);
    document.querySelectorAll('[data-aloj-admin]:not([data-al-mounted])').forEach(mountAdmin);
  };
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  scan();
  window.IBAloj = { load, openGallery };
})();
