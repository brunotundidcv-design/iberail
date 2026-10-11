/* Iberail — panel: pestaña «Premios»
   Qué le ha tocado a cada persona en TODOS los sorteos y si ya se le ha entregado.
   · Sorteos anteriores: tabla sorteo_historial (supabase/sql/sorteo-historial.sql).
   · Sorteo actual: sorteo_ganadores (lo que se asigna en la pestaña «Sorteo»), mezclado con lo que haya en el historial.
   Se guarda en el historial al publicar, al preparar un sorteo nuevo (sorteo-panel.js llama a IBPremios.archivar)
   y al marcar algo como entregado. También se pueden importar los CSV que descargaba «Preparar un sorteo nuevo». */
(function(){
  const IB = window.IB, root = document.getElementById('preView');
  if(!IB || !root) return;
  const esc = IB.esc;
  const CAT_DEF = [
    { id: 'entrada', label: 'Entrada Ultra Europe' }, { id: 'd300', label: '300 € de descuento' }, { id: 'd100', label: '100 € de descuento' },
    { id: 'd50', label: '50 € de descuento' }, { id: 'copas', label: 'Bono de copas en Split' }, { id: 'd25', label: '25 € de descuento' },
    { id: 'd5', label: '5 € de descuento' }
  ];
  let started = false, loaded = false, loading = null, histErr = '', cfg = {}, hist = [], gan = [], clientes = {};
  let est = 'pend', srt = 'all', tipo = 'all', q = '', busy = new Set(), notas = {};

  const sinTilde = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
  const cat = () => (cfg.premios && cfg.premios.length ? cfg.premios : CAT_DEF);
  const labelOf = id => ((cat().find(p => p.id === id) || CAT_DEF.find(p => p.id === id) || {}).label) || '';
  const curT = () => Number(cfg.tanda) || 1;
  const fFecha = (d, y) => { if(!d) return ''; const x = new Date(String(d).slice(0, 10) + 'T12:00:00'); return isNaN(x) ? String(d) : x.toLocaleDateString('es-ES', y ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short' }); };
  const ago = iso => {
    const s = Math.max(0, (Date.now() - new Date(iso)) / 1000);
    if(s < 3600) return `hace ${Math.max(1, Math.round(s / 60))} min`;
    if(s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    if(s < 86400 * 7) return `hace ${Math.floor(s / 86400)} d`;
    return 'el ' + fFecha(iso, true);
  };
  const ini = s => String(s).trim().split(/\s+/).slice(0, 2).map(w => w.charAt(0).toUpperCase()).join('') || '?';
  const keyOf = r => r.user_id && r.tanda != null ? `${r.user_id}|${r.tanda}` : 'i' + r.id;
  const quien = r => { const c = clientes[r.user_id] || {}; return { nombre: c.nombre || r.nombre || String(c.email || r.email || '').split('@')[0] || 'Cliente', email: c.email || r.email || '', telefono: c.telefono || r.telefono || '' }; };
  const srtKey = r => r.tanda != null ? 't' + r.tanda : 'f' + (r.fecha || '');
  const srtTxt = r => (r.fecha ? `Sorteo del ${fFecha(r.fecha, true)}` : 'Sorteo sin fecha') + (r.tanda != null ? ` · nº ${r.tanda}` : '');
  const euros = r => { const m = /(\d+(?:[.,]\d+)?)\s*€/.exec(r.premio_label || labelOf(r.premio) || ''); return m && r.premio !== 'entrada' ? Number(m[1].replace(',', '.')) : 0; };
  const icono = r => r.premio === 'entrada' ? '🎟️' : r.premio === 'copas' ? '🍹' : euros(r) ? '€' : '🎁';
  const telWa = t => { let d = String(t || '').replace(/\D/g, ''); if(d.startsWith('00')) d = d.slice(2); if(d.length === 9 && /^[6-9]/.test(d)) d = '34' + d; return d.length >= 10 ? d : ''; };
  const fmtEur = n => n.toLocaleString('es-ES', { maximumFractionDigits: 2 }) + ' €';
  const badge = () => { const b = document.getElementById('admCPre'); if(!b) return; const n = filas().filter(r => !r.entregado_at).length; b.textContent = n || ''; b.classList.toggle('is-hot', !!n); };
  function toast(html, err){
    const box = document.getElementById('toasts'); if(!box) return;
    const t = document.createElement('div'); t.className = 'toast' + (err ? ' is-err' : ''); t.innerHTML = html; box.appendChild(t);
    requestAnimationFrame(() => t.classList.add('is-in'));
    setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 300); }, 5500);
  }
  const faltaSql = e => /sorteo_historial|does not exist|schema cache|could not find/i.test((e && e.message) || '');

  /* ---------- datos ---------- */
  async function loadClientes(){
    const c = await IB.sb.rpc('buscar_clientes', { q: '' });
    (c.data || []).forEach(x => clientes[x.id] = x);
  }
  async function leeGanadores(){
    const g = await IB.sb.from('sorteo_ganadores').select('user_id, premio, visto, tanda, tirada');
    return g.error ? IB.sb.from('sorteo_ganadores').select('user_id, premio, visto, tanda') : g;   // sin la columna «tirada» (archivo 13)
  }
  async function load(){
    const [h, g, c] = await Promise.all([
      IB.sb.from('sorteo_historial').select('*').order('fecha', { ascending: false }),
      leeGanadores(),
      IB.sb.from('sorteo_config').select('*').eq('id', 1).maybeSingle(),
      Object.keys(clientes).length ? null : loadClientes()
    ]);
    histErr = h.error ? h.error.message : '';
    hist = h.data || [];
    gan = (g.data || []).filter(x => x.premio);
    cfg = c.data || {};
    loaded = true;
  }
  function reload(){ return (loading = loading || load().finally(() => { loading = null; })); }

  // una fila por persona y sorteo: el historial + el sorteo actual (que manda en lo que tiene asignado)
  function filas(){
    const out = new Map();
    hist.forEach(h => out.set(keyOf(h), { ...h, actual: h.tanda != null && Number(h.tanda) === curT() }));
    gan.forEach(g => {
      const t = Number(g.tanda) || curT(), k = `${g.user_id}|${t}`, h = out.get(k) || {};
      out.set(k, { ...h, user_id: g.user_id, tanda: t, premio: g.premio, premio_label: labelOf(g.premio) || h.premio_label || g.premio,
        fecha: cfg.fecha || h.fecha || null, visto: g.visto || h.visto || null, tirada: g.tirada != null ? g.tirada : h.tirada, actual: true, vivo: true });
    });
    // del sorteo actual, lo que ya no tiene premio asignado (se lo quitaron) solo cuenta si ya se entregó
    return [...out.values()].filter(r => !(r.actual && !r.vivo && !r.entregado_at));
  }
  // fila completa para guardar en el historial (sin tocar entregado/nota)
  function fila(r){
    const p = quien(r);
    return { user_id: r.user_id, tanda: r.tanda, fecha: r.fecha || null, premio: r.premio || null, premio_label: r.premio_label || labelOf(r.premio) || r.premio || null,
      tirada: r.tirada != null ? Number(r.tirada) || null : null, visto: r.visto || null, nombre: p.nombre, email: p.email || null, telefono: p.telefono || null };
  }

  // guarda el sorteo actual en el historial (al publicar y antes de «Preparar un sorteo nuevo»). Devuelve el error o null.
  async function archivar(){
    if(loading) await loading;
    await load();                                       // recién leído: lo último que se asignó en «Sorteo»
    if(histErr) return { message: histErr };
    const act = filas().filter(r => r.vivo);
    if(act.length){
      const { error } = await IB.sb.from('sorteo_historial').upsert(act.map(fila), { onConflict: 'user_id,tanda' });
      if(error) return error;
    }
    // lo que se quedó guardado del sorteo actual pero ya no tiene premio (y no se entregó) sobra
    let del = IB.sb.from('sorteo_historial').delete().eq('tanda', curT()).is('entregado_at', null);
    if(act.length) del = del.not('user_id', 'in', `(${act.map(r => r.user_id).join(',')})`);
    const d = await del;
    await reload(); paint();
    return d.error || null;
  }

  /* ---------- pintar ---------- */
  function paint(){
    badge();
    if(root.hidden) return;
    const a = document.activeElement, foco = a && root.contains(a) && a.id === 'preQ';
    let pos = null; try{ pos = foco ? a.selectionStart : null; }catch(e){}
    pinta();
    if(foco){ const el = document.getElementById('preQ'); if(el){ el.focus(); try{ if(pos != null) el.setSelectionRange(pos, pos); }catch(e){} } }
  }
  function lista(){
    const t = sinTilde(q.trim().toLowerCase());
    return filas().filter(r => (est === 'all' || (est === 'ok') === !!r.entregado_at) && (srt === 'all' || srtKey(r) === srt) &&
      (tipo === 'all' || (r.premio || r.premio_label) === tipo) &&
      (!t || sinTilde(`${quien(r).nombre} ${quien(r).email} ${quien(r).telefono} ${r.premio_label || ''} ${r.nota || ''}`.toLowerCase()).includes(t)));
  }
  function pinta(){
    if(!loaded){ root.innerHTML = '<div class="auth-spin"></div>'; return; }
    const todo = filas(), pend = todo.filter(r => !r.entregado_at), ok = todo.length - pend.length;
    const personas = new Set(todo.map(r => r.user_id || r.email || r.id)).size;
    const sorteos = new Map(); todo.forEach(r => { const k = srtKey(r); if(!sorteos.has(k)) sorteos.set(k, r); });
    const eurPend = pend.reduce((s, r) => s + euros(r), 0), entPend = pend.filter(r => r.premio === 'entrada').length;
    const tipos = new Map(); todo.forEach(r => { const k = r.premio || r.premio_label; if(k && !tipos.has(k)) tipos.set(k, r.premio_label || labelOf(r.premio) || k); });
    const l = lista();
    // por persona: quien tenga algo por entregar primero; dentro, lo más reciente arriba
    const gr = new Map();
    l.forEach(r => { const k = r.user_id || r.email || 'i' + r.id; (gr.get(k) || gr.set(k, []).get(k)).push(r); });
    const reciente = r => String(r.fecha || '') + String(r.tanda != null ? String(r.tanda).padStart(4, '0') : '');
    const grupos = [...gr.values()].map(rs => rs.sort((a, b) => (!!a.entregado_at - !!b.entregado_at) || reciente(b).localeCompare(reciente(a))))
      .sort((a, b) => (b.filter(r => !r.entregado_at).length - a.filter(r => !r.entregado_at).length) || reciente(b[0]).localeCompare(reciente(a[0])) || quien(a[0]).nombre.localeCompare(quien(b[0]).nombre));
    const seg = (v, txt, n) => `<button type="button" role="radio" aria-checked="${est === v}" data-pre-est="${v}">${txt} <small>${n}</small></button>`;
    root.innerHTML = `
      ${histErr ? `<div class="adm-empty pre-warn"><b>Falta activar el historial de premios.</b><span>Ejecuta <b>supabase/sql/sorteo-historial.sql</b> en Supabase (SQL Editor). Mientras tanto solo ves el sorteo actual y no se puede marcar nada como entregado. <small>(${esc(histErr)})</small></span></div>` : ''}
      <div class="adm-rr-sum pre-sum">
        <div class="${pend.length ? 'is-hot' : ''}"><b>${pend.length}</b><span>Por entregar${entPend ? ` · ${entPend} ${entPend === 1 ? 'entrada' : 'entradas'} del Ultra` : ''}</span></div>
        <div><b>${ok}</b><span>${ok === 1 ? 'Premio entregado' : 'Premios entregados'}</span></div>
        <div><b>${eurPend ? fmtEur(eurPend) : '0 €'}</b><span>En descuentos por aplicar</span></div>
        <div><b>${personas}</b><span>${personas === 1 ? 'Persona premiada' : 'Personas premiadas'} · ${sorteos.size} ${sorteos.size === 1 ? 'sorteo' : 'sorteos'}</span></div>
      </div>
      <div class="pre-bar">
        <div class="adm-seg pre-seg" role="radiogroup" aria-label="Estado">${seg('pend', 'Por entregar', pend.length)}${seg('ok', 'Entregados', ok)}${seg('all', 'Todos', todo.length)}</div>
        <div class="pre-f">
          <select class="pl-input" id="preSrt" aria-label="Sorteo"><option value="all">Todos los sorteos</option>${[...sorteos.entries()].sort((a, b) => reciente(b[1]).localeCompare(reciente(a[1]))).map(([k, r]) => `<option value="${esc(k)}"${srt === k ? ' selected' : ''}>${esc(srtTxt(r))}${r.actual ? ' (actual)' : ''}</option>`).join('')}</select>
          <select class="pl-input" id="preTipo" aria-label="Premio"><option value="all">Todos los premios</option>${[...tipos.entries()].map(([k, t]) => `<option value="${esc(k)}"${tipo === k ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>
          <input class="pl-input" id="preQ" type="search" placeholder="Buscar persona, correo, teléfono o nota" value="${esc(q)}" aria-label="Buscar">
        </div>
        <div class="pre-tools">
          <button type="button" class="pl-link" data-pre-csv>Exportar CSV</button>
          ${histErr ? '' : `<label class="pl-link pre-imp">Importar un sorteo anterior (CSV)<input type="file" accept=".csv,text/csv" data-pre-imp hidden></label>`}
        </div>
      </div>
      <p class="adm-hint pre-hint">Aquí salen los premios de <b>todos los sorteos</b>, agrupados por persona. Cuando le des a alguien su premio (entrada enviada, descuento aplicado en su grupo, bono de copas…), pulsa <b>«Marcar entregado»</b> y apunta cómo se le dio. Lo del sorteo actual sale en cuanto lo asignas en la pestaña «Sorteo».</p>
      ${grupos.length ? `<div class="pre-list">${grupos.map(persona).join('')}</div>` : `<div class="adm-empty"><b>${todo.length ? (est === 'pend' && !q && srt === 'all' && tipo === 'all' ? 'Todo entregado. 🎉' : 'Nada coincide con el filtro.') : 'Todavía no hay premios.'}</b><span>${todo.length ? (est === 'pend' && !q && srt === 'all' && tipo === 'all' ? 'No queda ningún premio por dar.' : 'Prueba con otro filtro o búsqueda.') : 'Cuando asignes premios en la pestaña «Sorteo» aparecerán aquí. Si tienes los CSV de sorteos anteriores, impórtalos arriba.'}</span></div>`}`;
  }
  function persona(rs){
    const p = quien(rs[0]), pend = rs.filter(r => !r.entregado_at).length, wa = telWa(p.telefono);
    const msg = `Hola ${p.nombre.split(' ')[0]}, te escribimos de Iberail por tu premio del sorteo: ${rs.filter(r => !r.entregado_at).map(r => r.premio_label || labelOf(r.premio)).join(', ') || rs[0].premio_label}.`;
    return `<article class="pre-p${pend ? ' is-due' : ''}">
      <header class="pre-p-h">
        <span class="adm-av" aria-hidden="true">${esc(ini(p.nombre))}</span>
        <span class="adm-cli-who"><b>${esc(p.nombre)}</b><small>${esc([p.email, p.telefono].filter(Boolean).join(' · ') || 'Sin datos de contacto')}</small></span>
        <span class="pre-p-n">${rs.length} ${rs.length === 1 ? 'premio' : 'premios'}${pend ? ` · <b>${pend} por entregar</b>` : ''}</span>
        ${wa ? `<a class="pre-wa" href="${esc(IB.wa(msg, wa))}" target="_blank" rel="noopener" title="Escribirle por WhatsApp"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 01-12.3 7.4L3 21l2.1-5.6A8.5 8.5 0 1121 11.5z"/></svg>WhatsApp</a>` : ''}
      </header>
      <ul class="pre-l">${rs.map(premio).join('')}</ul>
    </article>`;
  }
  function premio(r){
    const k = keyOf(r), w = busy.has(k), done = !!r.entregado_at;
    const nota = k in notas ? notas[k] : (r.nota || '');
    const sub = [srtTxt(r) + (r.actual ? (cfg.publicado ? ' · actual' : ' · actual, sin publicar') : ''), r.visto ? `lo vio ${ago(r.visto)}` : (r.tanda == null || (r.actual && !cfg.publicado) ? '' : 'no lo ha abierto en la web')].filter(Boolean).join(' · ');
    return `<li class="pre-i${done ? ' is-ok' : ''}">
      <span class="pre-ic${r.premio === 'entrada' ? ' is-top' : ''}" aria-hidden="true">${icono(r)}</span>
      <span class="pre-what"><b>${esc(r.premio_label || labelOf(r.premio) || r.premio || 'Premio')}</b><small>${esc(sub)}</small></span>
      <input class="pl-input pre-nota" data-pre-nota="${esc(k)}" maxlength="200" value="${esc(nota)}" placeholder="Cómo se entregó (opcional)" aria-label="Nota de la entrega"${histErr || w ? ' disabled' : ''}>
      <span class="pre-st">${done ? `<em class="adm-rr-st is-ok">Entregado ${esc(fFecha(r.entregado_at))}</em>${r.entregado_por ? `<small>por ${esc(r.entregado_por)}</small>` : ''}` : '<em class="adm-rr-st is-due">Por entregar</em>'}</span>
      <span class="pre-act">${done
        ? `<button type="button" class="pl-link" data-pre-undo="${esc(k)}"${w ? ' disabled' : ''}>Deshacer</button>`
        : `<button type="button" class="btn btn--dark btn--sm" data-pre-ok="${esc(k)}"${histErr || w ? ' disabled' : ''}>Marcar entregado</button>`}</span>
    </li>`;
  }

  /* ---------- guardar ---------- */
  // quieto = sin repintar antes de guardar (la nota se guarda al salir del campo: si se repinta en ese momento,
  // el clic en «Marcar entregado» caería en un botón que ya no existe)
  async function guarda(k, patch, okTxt, quieto){
    const r = filas().find(x => keyOf(x) === k); if(!r) return;
    busy.add(k); if(!quieto) paint();
    const { error } = r.id
      ? await IB.sb.from('sorteo_historial').update(patch).eq('id', r.id)
      : await IB.sb.from('sorteo_historial').upsert({ ...fila(r), ...patch }, { onConflict: 'user_id,tanda' });
    busy.delete(k);
    if(error){ paint(); return toast(faltaSql(error) ? 'Falta ejecutar supabase/sql/sorteo-historial.sql en Supabase.' : 'No se pudo guardar: ' + esc(error.message), true); }
    if('nota' in patch) delete notas[k];
    await reload(); paint();
    if(okTxt) toast(okTxt);
  }
  async function yo(){
    const u = await IB.getUser();
    return u ? ((u.user_metadata && u.user_metadata.nombre) || String(u.email || '').split('@')[0] || 'equipo') : 'equipo';
  }

  /* ---------- CSV ---------- */
  const celda = v => { let s = String(v == null ? '' : v); if(/^[=@\t\r]/.test(s) || (/^[+\-]/.test(s) && !/^[+\-]?[\d\s().,-]+$/.test(s))) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
  function exportar(){
    const cols = ['nombre', 'email', 'telefono', 'fecha_sorteo', 'n_sorteo', 'premio', 'lo_vio', 'entregado', 'entregado_por', 'nota'];
    const out = lista().map(r => { const p = quien(r); return [p.nombre, p.email, p.telefono, r.fecha || '', r.tanda != null ? r.tanda : '', r.premio_label || labelOf(r.premio) || r.premio, r.visto ? String(r.visto).slice(0, 10) : '', r.entregado_at ? String(r.entregado_at).slice(0, 10) : '', r.entregado_por || '', r.nota || '']; });
    const csv = '﻿' + [cols].concat(out).map(f => f.map(celda).join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    a.download = `premios-sorteos-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove();
  }
  function parseCsv(txt){
    txt = String(txt).replace(/^﻿/, '');
    const l0 = txt.split(/\r?\n/)[0] || '', sep = (l0.match(/;/g) || []).length >= (l0.match(/,/g) || []).length ? ';' : ',';
    const out = []; let row = [], cell = '', dentro = false;
    for(let i = 0; i < txt.length; i++){
      const ch = txt[i];
      if(dentro){ if(ch === '"'){ if(txt[i + 1] === '"'){ cell += '"'; i++; } else dentro = false; } else cell += ch; }
      else if(ch === '"') dentro = true;
      else if(ch === sep){ row.push(cell); cell = ''; }
      else if(ch === '\n' || ch === '\r'){ if(ch === '\r' && txt[i + 1] === '\n') i++; row.push(cell); out.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if(cell || row.length){ row.push(cell); out.push(row); }
    return out.filter(r => r.some(c => c.trim())).map(r => r.map(c => c.trim().replace(/^'(?=[=@+\-\t\r])/, '')));
  }
  async function importar(file){
    const rows = parseCsv(await file.text());
    const cab = (rows.shift() || []).map(c => sinTilde(c.toLowerCase()).replace(/[^a-z]/g, ''));
    const col = (...n) => cab.findIndex(c => n.includes(c));
    const iN = col('nombre'), iE = col('email', 'correo'), iT = col('telefono', 'movil'), iP = col('premio'), iTi = col('tirada'), iF = col('fechasorteo', 'fecha');
    if(iP < 0 || (iE < 0 && iN < 0)) return alert('Este CSV no parece una lista de ganadores: necesita al menos las columnas «premio» y «email» o «nombre» (como el que descargaba «Preparar un sorteo nuevo»).');
    let fechaArchivo = (/(\d{4}-\d{2}-\d{2})/.exec(file.name) || [])[1] || '';
    const sinFecha = rows.some(r => !/^\d{4}-\d{2}-\d{2}$/.test((r[iF] || '').trim()));
    if(sinFecha && !fechaArchivo){
      fechaArchivo = (prompt('¿Qué día fue este sorteo? (AAAA-MM-DD)', '') || '').trim();
      if(!/^\d{4}-\d{2}-\d{2}$/.test(fechaArchivo)) return alert('Hace falta la fecha del sorteo (por ejemplo 2026-10-04).');
    }
    const porEmail = {}; Object.values(clientes).forEach(c => { if(c.email) porEmail[c.email.toLowerCase()] = c; });
    const porLabel = {}; cat().concat(CAT_DEF).forEach(p => { const k = sinTilde(p.label.toLowerCase()); if(!(k in porLabel)) porLabel[k] = p.id; });
    const ya = new Set(filas().map(r => [r.user_id || quien(r).email.toLowerCase(), r.fecha || '', sinTilde(String(r.premio_label || '').toLowerCase())].join('|')));
    const nuevas = []; let repes = 0;
    rows.forEach(r => {
      const email = (r[iE] || '').toLowerCase(), label = (r[iP] || '').trim(); if(!label || (!email && !(r[iN] || '').trim())) return;
      const c = porEmail[email] || null, fecha = /^\d{4}-\d{2}-\d{2}$/.test((r[iF] || '').trim()) ? r[iF].trim() : fechaArchivo;
      const k = [(c && c.id) || email, fecha, sinTilde(label.toLowerCase())].join('|');
      if(ya.has(k)){ repes++; return; } ya.add(k);
      nuevas.push({ user_id: c ? c.id : null, tanda: null, fecha, premio: porLabel[sinTilde(label.toLowerCase())] || null, premio_label: label,
        tirada: iTi >= 0 && Number(r[iTi]) ? Number(r[iTi]) : null, nombre: (r[iN] || '').trim() || (c && c.nombre) || null, email: email || null, telefono: (iT >= 0 && r[iT]) || (c && c.telefono) || null });
    });
    if(!nuevas.length) return alert(repes ? `Ya estaban todos (${repes}). No se ha añadido nada.` : 'El archivo no tiene ganadores.');
    const fechas = [...new Set(nuevas.map(n => n.fecha))].map(f => fFecha(f, true)).join(', ');
    if(!confirm(`Vas a añadir ${nuevas.length} ${nuevas.length === 1 ? 'premio' : 'premios'} del sorteo del ${fechas}${repes ? ` (${repes} ya estaban y se saltan)` : ''}.\n\nEntran como «por entregar»: luego marca los que ya diste. ¿Seguimos?`)) return;
    const { error } = await IB.sb.from('sorteo_historial').insert(nuevas);
    if(error) return alert('No se pudo importar: ' + error.message + (faltaSql(error) ? '\n\nEjecuta supabase/sql/sorteo-historial.sql en Supabase.' : ''));
    await reload(); est = 'all'; srt = 'all'; paint();
    toast(`<b>${nuevas.length} ${nuevas.length === 1 ? 'premio importado' : 'premios importados'}</b>Marca como entregados los que ya diste.`);
  }

  /* ---------- eventos ---------- */
  root.addEventListener('click', async e => {
    const s = e.target.closest('[data-pre-est]'); if(s){ est = s.dataset.preEst; return paint(); }
    if(e.target.closest('[data-pre-csv]')) return exportar();
    const ok = e.target.closest('[data-pre-ok]');
    if(ok){ const k = ok.dataset.preOk, n = notas[k]; return guarda(k, { entregado_at: new Date().toISOString(), entregado_por: await yo(), ...(n != null ? { nota: n.trim() || null } : {}) }, 'Marcado como entregado'); }
    const un = e.target.closest('[data-pre-undo]');
    if(un) return guarda(un.dataset.preUndo, { entregado_at: null, entregado_por: null }, 'Vuelve a estar por entregar');
  });
  root.addEventListener('input', e => {
    const x = e.target;
    if(x.id === 'preQ'){ q = x.value; return paint(); }
    if(x.dataset && x.dataset.preNota != null) notas[x.dataset.preNota] = x.value;
  });
  root.addEventListener('change', e => {
    const x = e.target;
    if(x.id === 'preSrt'){ srt = x.value; return paint(); }
    if(x.id === 'preTipo'){ tipo = x.value; return paint(); }
    if(x.dataset && x.dataset.preImp != null){ const f = x.files && x.files[0]; x.value = ''; if(f) importar(f); return; }
    if(x.dataset && x.dataset.preNota != null){
      const k = x.dataset.preNota, r = filas().find(y => keyOf(y) === k);
      if(r && (x.value.trim() || null) !== (r.nota || null)) guarda(k, { nota: x.value.trim() || null }, 'Nota guardada', true);
      else delete notas[k];
    }
  });

  async function start(){
    if(started) return; started = true;
    await reload(); paint();
  }
  window.IBPremios = {
    async show(){ paint(); if(!started) return start(); await reload(); paint(); },
    archivar
  };
  // el contador de la pestaña sale al abrir el panel, sin tener que entrar
  setTimeout(() => { if(IB.sb && !started) IB.sb.auth.getSession().then(s => { if(s && s.data && s.data.session) start(); }); }, 3000);
})();
