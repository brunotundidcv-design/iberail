/* Iberail — planificador de rutas (asistente en 4 pasos) */
(function(){
  const D = window.IB_DATA, IB = window.IB;
  const form = document.getElementById('plForm');
  if(!D || !IB || !form) return;

  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = IB.esc;
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const code3 = s => (norm(s).replace(/[^a-z]/g, '').slice(0, 3) || '···').toUpperCase();
  const plural = (n, a, b) => n === 1 ? a : b;
  const DRAFT = 'ib-draft-v2';
  const REQUIRE_AUTH = IB.enabled;      // registro obligatorio cuando las cuentas están activas
  const TOTAL_STEPS = 4;

  const byName = {};
  D.cities.forEach(c => byName[norm(c.n)] = c);
  D.origins.forEach(c => byName[norm(c.n)] = byName[norm(c.n)] || c);

  const S = {
    step: 1, origin: 'Madrid', originOther: '', date: '', flex: false, days: 14, trav: 2,
    stops: [], styles: [], stay: 'Lo que mejor encaje', budget: '', notes: '',
    name: '', phone: '', email: '', promo: false, viabIgnored: ''
  };
  let user = null, sending = false;

  /* ---------------- draft ---------------- */
  function saveDraft(){
    try{ const { step, ...rest } = S; localStorage.setItem(DRAFT, JSON.stringify({ ...rest, step, t: Date.now() })); }catch(e){}
  }
  function loadDraft(){
    try{
      const d = JSON.parse(localStorage.getItem(DRAFT) || 'null');
      if(!d || Date.now() - (d.t || 0) > 1000 * 60 * 60 * 24 * 30) return false;
      Object.keys(S).forEach(k => { if(d[k] !== undefined) S[k] = d[k]; });
      S.stops = (S.stops || []).filter(s => s && s.n).slice(0, 20);
      return true;
    }catch(e){ return false; }
  }
  let saveT; const save = () => { clearTimeout(saveT); saveT = setTimeout(saveDraft, 250); };

  /* ---------------- helpers ---------------- */
  const originCity = () => S.origin === '__otra' ? (S.originOther.trim() ? { n: S.originOther.trim() } : null) : (byName[norm(S.origin)] || { n: S.origin });
  const assigned = () => S.stops.reduce((a, s) => a + (s.d || 0), 0);
  const countries = () => new Set(S.stops.map(s => s.cc).filter(Boolean)).size;
  const flagStyle = cc => cc && D.flags[cc] ? ` style="--flag:${esc(D.flags[cc])}"` : '';

  function mkStop(name, days){
    const c = byName[norm(name)];
    if(c && norm(c.n) === 'split') days = Math.max(days, ULTRA.min);
    return c ? { n: c.n, cc: c.cc, lon: c.lon, lat: c.lat, d: days } : { n: name.trim().slice(0, 50), cc: '', d: days };
  }
  /* ---------------- Ultra Europe 2027: noches del 9, 10 y 11 de julio en Split ----------------
     La fecha la elige el cliente. La web adapta la ruta a esa fecha (días y orden de las paradas
     anteriores a Split) y le cuenta qué ha cambiado, con opción de deshacer. Nunca avisos en rojo. */
  const ULTRA = { first: '2027-07-09', leave: '2027-07-12', min: 3, rec: 4 };
  const isSplit = s => s && norm(s.n) === 'split';
  const minDays = s => isSplit(s) ? ULTRA.min : 1;
  const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const diffDays = (a, b) => Math.round((new Date(a + 'T12:00:00') - new Date(b + 'T12:00:00')) / 864e5);
  const shortDate = iso => { try{ return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', ''); }catch(e){ return iso; } };
  const todayIso = () => { const d = new Date(); d.setHours(12, 0, 0, 0); return d.toISOString().slice(0, 10); };
  const sumD = arr => arr.reduce((a, s) => a + (s.d || 0), 0);
  let ultraNote = null;      // { text, undo } tras adaptar la ruta
  function ultraInfo(){
    const i = S.stops.findIndex(isSplit); if(i < 0) return null;
    const before = sumD(S.stops.slice(0, i)), d = S.stops[i].d;
    const suggest = addDays(addDays(ULTRA.leave, -d), -before);
    if(!S.date) return { i, before, d, suggest };
    const arrive = addDays(S.date, before), leave = addDays(arrive, d);
    const end = addDays(S.date, Math.max(S.days, assigned()));
    const possible = S.date <= ULTRA.first && end >= ULTRA.leave;
    return { i, before, d, suggest, arrive, leave, possible, ok: arrive <= ULTRA.first && leave >= ULTRA.leave };
  }
  // reparte `total` días entre paradas según su peso (días originales), mínimo 1 por parada
  function spread(stops, total, weights, min){
    if(!stops.length) return;
    min = min || 1;
    const W = weights.reduce((a, w) => a + w, 0) || stops.length;
    const raw = weights.map(w => (w || 1) / W * total);
    stops.forEach((x, j) => { x.d = Math.max(min, Math.floor(raw[j])); });
    let rem = total - sumD(stops);
    const order = raw.map((r, j) => [r - stops[j].d, j]).sort((p, q) => q[0] - p[0]).map(p => p[1]);
    for(let k = 0; rem > 0; k++){ stops[order[k % order.length]].d++; rem--; }
    for(let k = stops.length - 1; rem < 0 && k >= 0; k--){ while(rem < 0 && stops[k].d > min){ stops[k].d--; rem++; } }
    for(let k = stops.length - 1; rem < 0 && k >= 0; k--){ while(rem < 0 && stops[k].d > 1){ stops[k].d--; rem++; } }
  }
  /* ---------------- conocimiento de trayectos ----------------
     1) tramos conocidos (horas reales aproximadas, modo y si hay nocturno)
     2) si no, estimación por distancia y velocidad media de la zona (marcada con ≈)
     El primer tramo (desde España) se hace en avión: no se revisa. */
  const SPEED = { oeste: 120, med: 100, centro: 90, norte: 90, balticos: 55, balcanes: 50 };
  const SLOW = { 'atenas': 50, 'salonica': 50, 'estambul': 45, 'dublin': 50 };
  const NO_RAIL = new Set((D.noRail || []).map(norm));
  const RAIL = {};
  (D.rail || []).forEach(([a, b, h, m, n]) => { RAIL[norm(a) + '|' + norm(b)] = RAIL[norm(b) + '|' + norm(a)] = { h, mode: m, night: !!n, known: true }; });
  const geoOf = x => {
    if(!x) return null;
    const c = byName[norm(x.n)] || (x.lon != null ? x : null);
    if(!c || c.lon == null) return null;
    return { n: c.n, lon: c.lon, lat: c.lat, sp: SLOW[norm(c.n)] || SPEED[c.r || 'oeste'] || 80 };
  };
  const km = (a, b) => {
    const R = 6371, r = Math.PI / 180;
    const dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  const legCache = new Map();
  function legInfo(x, y){
    if(!x || !y) return null;
    const key = norm(x.n) + '|' + norm(y.n);
    if(legCache.has(key)) return legCache.get(key);
    let r = RAIL[key] || null;
    if(!r){
      const a = geoOf(x), b = geoOf(y);
      if(a && b){
        const bus = NO_RAIL.has(norm(x.n)) || NO_RAIL.has(norm(y.n));
        const sp = bus ? 60 : (a.sp + b.sp) / 2;
        r = { h: km(a, b) * 1.2 / sp + 1, mode: bus ? 'bus' : 'tren', night: false, known: false };
      }
    }
    legCache.set(key, r);
    return r;
  }
  const legHours = (x, y) => { const l = legInfo(x, y); return l ? l.h : null; };
  // gravedad de un tramo: 0 bien, 1 largo, 2 excesivo (los nocturnos no pierden el día)
  const legSev = l => !l ? 0 : l.night ? 0 : (l.mode === 'bus' ? (l.h >= 8 ? 2 : l.h >= 6 ? 1 : 0) : (l.h >= 15 ? 2 : l.h >= 10 ? 1 : 0));
  const fmtH = l => { const h = l.h; const t = h < 1 ? `${Math.round(h * 60)} min` : h >= 20 ? '+20 h' : `${Math.round(h * 2) / 2} h`.replace('.5', ',5'); return (l.known ? '' : '≈') + t; };
  const hoursOf = list => { let t = 0; for(let k = 1; k < list.length; k++){ const h = legHours(list[k - 1], list[k]); if(h != null) t += h; } return t; };
  const pathKm = (start, list, end) => {
    let t = 0, prev = geoOf(start);
    list.concat(end ? [end] : []).forEach(s => { const g = geoOf(s); if(prev && g) t += km(prev, g); if(g) prev = g; });
    return t;
  };
  // coste de una secuencia: horas de tren con penalización fuerte a tramos largos (no nocturnos)
  const pathCost = (start, list, end) => {
    const seq = (start ? [start] : []).concat(list, end ? [end] : []); let c = 0;
    for(let k = 1; k < seq.length; k++){ const l = legInfo(seq[k - 1], seq[k]); if(!l) continue; c += l.h + (l.night ? 0 : Math.max(0, l.h - 9) * 3 + Math.max(0, l.h - 14) * 6); }
    return c;
  };
  // mejor orden (menos horas de tren); start/end pueden ser null (primer tramo en avión)
  function bestPath(start, list, end){
    if(list.length < 2) return list.slice();
    if(list.length <= 7){
      let best = null, bestC = Infinity;
      const perm = (arr, l) => {
        if(l === arr.length){ const c = pathCost(start, arr, end); if(c < bestC){ bestC = c; best = arr.slice(); } return; }
        for(let i = l; i < arr.length; i++){ [arr[l], arr[i]] = [arr[i], arr[l]]; perm(arr, l + 1); [arr[l], arr[i]] = [arr[i], arr[l]]; }
      };
      perm(list.slice(), 0);
      return best;
    }
    let bestOut = null, bestC = Infinity;
    list.forEach(first => {
      let rest = list.filter(x => x !== first), cur = first, out = [first];
      while(rest.length){ rest.sort((p, q) => (legHours(cur, p) || 99) - (legHours(cur, q) || 99)); cur = rest.shift(); out.push(cur); }
      let improved = true;
      while(improved){
        improved = false;
        for(let i = 0; i < out.length - 1; i++) for(let j = i + 1; j < out.length; j++){
          const cand = out.slice(0, i).concat(out.slice(i, j + 1).reverse(), out.slice(j + 1));
          if(pathCost(start, cand, end) + .5 < pathCost(start, out, end)){ out = cand; improved = true; }
        }
      }
      const c = pathCost(start, out, end);
      if(c < bestC){ bestC = c; bestOut = out; }
    });
    return bestOut;
  }
  function ultraMatters(){ const u = ultraInfo(); return !!(u && S.date && u.possible); }
  function proposal(){
    if(ultraMatters()) return planUltra(S.stops);
    return { stops: bestPath(null, S.stops, null), days: S.days, keepsDays: true };
  }

  /* ---------------- revisión: solo tramos excesivos, paradas de 1 día y zigzag ---------------- */
  function analyzeRoute(){
    const chips = [];
    let level = 0, longLegs = 0, oneDay = 0;
    for(let k = 1; k < S.stops.length; k++){
      const a = S.stops[k - 1], b = S.stops[k], l = legInfo(a, b), sv = legSev(l);
      if(sv){ level = Math.max(level, sv); longLegs++; chips.push({ sev: sv, t: `${a.n} → ${b.n} · ${fmtH(l)}${l.mode === 'bus' ? ' en bus' : ''}` }); }
    }
    S.stops.forEach((st, k) => {
      if(st.d > 1) return;
      const l = legInfo(st, S.stops[k + 1]);
      const sv = l && !l.night && l.h >= 6 ? 2 : 1;
      level = Math.max(level, sv); oneDay++;
      chips.push({ sev: sv, t: `1 día en ${st.n}` });
    });
    let sortable = false, save = 0;
    if(S.stops.length >= 3){
      const prop = proposal();
      const same = prop.stops.map(x => norm(x.n)).join('|') === S.stops.map(x => norm(x.n)).join('|');
      const cur = hoursOf(S.stops), opt = hoursOf(prop.stops);
      const curC = pathCost(null, S.stops, null), optC = pathCost(null, prop.stops, null);
      if(!same && optC < curC - 4 && (cur - opt >= 4 || optC < curC * .8)){ sortable = true; save = Math.max(0, Math.round(cur - opt)); level = Math.max(level, 1); }
    }
    chips.sort((p, q) => q.sev - p.sev);
    let head = '';
    if(level === 2) head = 'Poco viable en tren';
    else if(level === 1) head = 'Mejorable';
    const parts = [];
    if(longLegs) parts.push(`${longLegs} ${plural(longLegs, 'tramo largo', 'tramos largos')}`);
    if(oneDay) parts.push(`${oneDay} ${plural(oneDay, 'parada', 'paradas')} de 1 día`);
    if(sortable) parts.push(save >= 2 ? `otro orden ahorra ≈${save} h de tren` : 'hay un orden más lógico');
    // Split alargado por la fecha: sugerencia (no aviso)
    let tip = null;
    const u = ultraInfo();
    if(u && u.ok && u.d >= 5 && S.date){
      const later = addDays(addDays(ULTRA.leave, -ULTRA.rec), -u.before);
      if(later > S.date) tip = { t: `${u.d} días en Split por tu fecha de salida`, date: later };
    }
    // días de más sin repartir: sugiere completar la ruta con más ciudades
    let fill = null;
    const leftover = S.days - assigned();
    if(S.stops.length && leftover >= 4){
      const more = Math.min(3, Math.max(1, Math.round(leftover / 4)));
      fill = { days: leftover, t: `Con ${S.days} días tienes ${leftover} días libres: prueba a añadir ${more} ${plural(more, 'ciudad más', 'ciudades más')} para completar la ruta.` };
    }
    return { level, head, sub: parts.join(' · '), chips: chips.slice(0, 4), sortable, tip, fill, total: hoursOf(S.stops), nights: S.stops.slice(1).filter((x, k) => { const l = legInfo(S.stops[k], x); return l && l.night && l.h >= 8; }).length };
  }

  /* ---------------- cómo "piensa": pasos visibles ---------------- */
  let viabT = [], viabRaf = 0, lastViabSig = '', lastViabKey = '';
  function paintLegs(thinking){
    $$('#plStops .pl-leg').forEach(el => {
      const k = +el.dataset.k, a = S.stops[k], b = S.stops[k + 1];
      const l = legInfo(a, b);
      if(thinking || !l){ el.className = 'pl-leg is-wait'; el.innerHTML = '<i></i><span>calculando…</span>'; return; }
      const sv = legSev(l);
      el.className = `pl-leg sev-${sv}${l.night && l.h >= 8 ? ' is-night' : ''}`;
      const ic = l.mode === 'bus' ? IC_BUS : l.mode.indexOf('ferry') > -1 ? IC_FERRY : IC_RAIL;
      el.innerHTML = `<i></i><span>${ic}${esc(fmtH(l))}${l.mode === 'bus' ? ' · bus' : l.mode === 'ferry' ? ' · ferry' : l.mode === 'tren+ferry' ? ' · tren + ferry' : ''}${l.night && l.h >= 8 ? ` · ${IC_MOON}nocturno` : ''}</span>`;
    });
  }
  function paintViab(){
    const box = $('#plViab'); if(!box) return;
    const r = analyzeRoute();
    const mini = $('#pvViab');
    if(mini){ mini.hidden = !r.level; mini.dataset.level = r.level; mini.textContent = r.level === 2 ? 'Ruta poco viable en tren' : 'Ruta mejorable'; }
    const key = r.level ? r.chips.map(c => c.t).join('|') + (r.sortable ? '|orden' : '') : '';
    lastViabKey = key;
    const ignored = !!key && S.viabIgnored === key;
    if(mini && ignored) mini.hidden = true;
    // datos de la revisión
    const legs = [];
    for(let k = 1; k < S.stops.length; k++){ const l = legInfo(S.stops[k - 1], S.stops[k]); if(l) legs.push(l); }
    const known = legs.filter(l => l.known).length, est = legs.length - known;
    const nights = legs.filter(l => l.night && l.h >= 8).length;
    const longs = legs.filter(l => legSev(l) > 0).length;
    const u = ultraInfo();
    const note = ultraNote ? `<div class="pl-viab-note"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 12a9 9 0 109-9 9.7 9.7 0 00-6.7 2.8L3 8"/><path d="M3 3v5h5"/></svg><span>${esc(ultraNote.short || ultraNote.text)}</span><button type="button" class="pl-link" data-ultra-undo>Deshacer</button></div>` : '';
    const fillTip = r.fill ? `<p class="pl-viab-tip is-fill">${esc(r.fill.t)}</p>` : '';
    const fillBtn = r.fill ? `<button type="button" class="btn btn--ghost btn--sm" data-fill>Añadir ciudades</button>` : '';
    const render = () => {
      paintLegs(false);
      box.classList.remove('is-thinking');
      if(S.stops.length < 2 && !note && !r.fill){ box.hidden = true; box.innerHTML = ''; return; }
      box.hidden = false;
      if(ignored){
        box.dataset.level = 0;
        box.innerHTML = `<div class="pl-viab-line is-ignored"><span>Avisos ignorados</span><button type="button" class="pl-link" data-viab-show>Ver</button></div>` +
          fillTip + (fillBtn ? `<div class="pl-viab-actions">${fillBtn}</div>` : '') + note;
        return;
      }
      box.dataset.level = r.level;
      const title = r.level === 2 ? 'Poco viable en tren' : r.level === 1 ? 'Ruta mejorable' : 'Ruta viable';
      const sub = r.level ? r.sub : (nights ? `Incluye ${nights} ${plural(nights, 'trayecto nocturno', 'trayectos nocturnos')}: duermes mientras viajas` : 'Trayectos razonables y un orden lógico');
      const stats = S.stops.length > 1 ? `<dl class="pl-viab-stats">
          <div><dt>Tren en total</dt><dd>≈${Math.round(r.total)} h</dd></div>
          <div><dt>Tramos</dt><dd>${legs.length}</dd></div>
          <div><dt>${nights ? 'Nocturnos' : 'Tramos largos'}</dt><dd>${nights || longs}</dd></div>
        </dl>` : '';
      const showSugg = sugg && sugg.key === suggKey();
      const actions = (r.level && !showSugg ? `<button type="button" class="btn btn--dark btn--sm" data-suggest><span class="pl-spark" aria-hidden="true"></span>Ver ruta sugerida</button>` : '') +
        (r.level && !showSugg ? `<button type="button" class="btn btn--ghost btn--sm" data-viab-ignore>Ignorar</button>` : '') +
        (r.tip ? `<button type="button" class="btn btn--ghost btn--sm" data-later="${r.tip.date}">Salir el ${esc(shortDate(r.tip.date))} y quedarme 4</button>` : '') +
        fillBtn;
      box.innerHTML = `<div class="pl-viab-top"><span class="pl-viab-ic" aria-hidden="true"></span><div><b>${esc(title)}</b><small>${esc(sub)}</small></div><em>Revisión Iberail</em></div>` +
        stats +
        (r.level && r.chips.length ? `<div class="pl-viab-chips">${r.chips.map(c => `<span class="sev-${c.sev}">${esc(c.t)}</span>`).join('')}</div>` : '') +
        (r.tip ? `<p class="pl-viab-tip">${esc(r.tip.t)}.</p>` : '') +
        fillTip +
        (actions ? `<div class="pl-viab-actions">${actions}</div>` : '') +
        (showSugg ? `<div class="pl-sugg-slot">${suggHtml()}</div>` : '') + note;
    };
    if(sugg && sugg.key !== suggKey()){ sugg = null; suggT.forEach(clearTimeout); suggT = []; }
    viabT.forEach(clearTimeout); viabT = []; cancelAnimationFrame(viabRaf);
    const fillBucket = r.fill ? Math.min(9, Math.ceil(r.fill.days / 3)) : 0;
    const sig = S.stops.map(x => x.n).join('|') + '#' + (S.date || '') + '#F' + fillBucket;
    const same = sig === lastViabSig; lastViabSig = sig;
    if(reduceMotion || same || (S.stops.length < 2 && !r.fill)){ render(); return; }
    // pasos visibles mientras "piensa" (≈3 s)
    const steps = [];
    if(S.stops.length >= 2){
      steps.push(['Midiendo los trayectos entre ciudades', `${legs.length} ${plural(legs.length, 'tramo', 'tramos')}`]);
      steps.push(['Consultando trenes, buses y nocturnos', est ? `${known} ${plural(known, 'conocido', 'conocidos')} · ${est} ${plural(est, 'estimado', 'estimados')}` : `${known} ${plural(known, 'conocido', 'conocidos')}`]);
      steps.push(['Buscando el mejor orden', r.sortable ? 'Hay uno mejor' : 'Orden correcto']);
    }
    if(u) steps.push(['Cuadrando las fechas del Ultra', u.ok ? `Split ${shortDate(u.arrive)} → ${shortDate(u.leave)}` : !S.date ? 'Sin fecha' : 'No coincide']);
    if(r.fill) steps.push(['Viendo si aprovechas bien los días', `Sobran ${r.fill.days} ${plural(r.fill.days, 'día', 'días')}`]);
    if(!steps.length){ render(); return; }
    const STEP = 720;
    box.hidden = false; box.classList.add('is-thinking'); box.dataset.level = 0;
    box.innerHTML = `<div class="pl-think-head"><b>Revisando tu ruta</b><span class="pl-think-pct">0%</span></div><div class="pl-think-bar"><i></i></div>` +
      `<ol class="pl-think">${steps.map(([t, res]) => `<li><span>${esc(t)}</span><em>${esc(res)}</em></li>`).join('')}</ol>`;
    paintLegs(true);
    const lis = $$('.pl-think li', box), bar = $('.pl-think-bar i', box), pct = $('.pl-think-pct', box);
    const total = steps.length * STEP + 250;
    viabRaf = requestAnimationFrame(() => { bar.style.transitionDuration = total + 'ms'; bar.style.width = '100%'; });
    const t0 = performance.now();
    const tick = () => { const k = Math.min(1, (performance.now() - t0) / total); pct.textContent = Math.round(k * 100) + '%'; if(k < 1 && box.classList.contains('is-thinking')) viabRaf = requestAnimationFrame(tick); };
    tick();
    lis.forEach((li, k) => {
      viabT.push(setTimeout(() => { li.classList.add('is-now'); if(k) lis[k - 1].classList.replace('is-now', 'is-done'); }, k * STEP));
    });
    viabT.push(setTimeout(() => { lis[lis.length - 1].classList.replace('is-now', 'is-done'); }, lis.length * STEP));
    viabT.push(setTimeout(render, total));
  }
  /* ---------------- ruta sugerida: reordena, mete ciudades puente en los tramos largos y reparte los días ----------------
     Usa los mismos trayectos que la revisión (horas reales o estimadas). Mantiene el total de días y lo que eligió el
     cliente siempre que puede. No toca S: devuelve una propuesta que el cliente acepta o no. */
  function metrics(list){
    let longs = 0, level = 0, oneDay = 0;
    for(let k = 1; k < list.length; k++){ const sv = legSev(legInfo(list[k - 1], list[k])); if(sv){ longs++; level = Math.max(level, sv); } }
    list.forEach((st, k) => { if(st.d > 1) return; oneDay++; const l = legInfo(st, list[k + 1]); level = Math.max(level, l && !l.night && l.h >= 6 ? 2 : 1); });
    return { hours: hoursOf(list), longs, oneDay, level };
  }
  const splitAt = list => list.findIndex(isSplit);
  function ultraStillOk(list){
    if(!ultraMatters()) return true;
    const i = splitAt(list); if(i < 0) return false;
    const arrive = addDays(S.date, sumD(list.slice(0, i))), leave = addDays(arrive, list[i].d);
    return arrive <= ULTRA.first && leave >= ULTRA.leave;
  }
  // quita `n` días a las paradas más largas (del mismo lado de Split si hay Ultra), sin bajar de 2
  function takeDays(list, n, near, dry){
    const ultra = ultraMatters(), si = splitAt(list), side = k => !ultra || si < 0 ? 0 : (k < si ? -1 : k > si ? 1 : 0);
    const want = near == null ? null : side(near);
    if(dry) return list.reduce((a, s, k) => a + (!isSplit(s) && (want == null || side(k) === want) ? Math.max(0, s.d - 2) : 0), 0);
    let got = 0;
    while(got < n){
      const donor = list.map((s, k) => ({ s, k })).filter(o => !isSplit(o.s) && o.s.d > 2 && (want == null || side(o.k) === want)).sort((p, q) => q.s.d - p.s.d)[0];
      if(!donor) break;
      donor.s.d--; got++;
    }
    return got;
  }
  function suggestRoute(){
    const orig = S.stops.map(x => ({ ...x }));
    const list = proposal().stops.map(x => ({ ...x }));
    const why = [];
    const have = () => new Set(list.map(x => norm(x.n)));
    const popular = new Set((D.popular || []).map(norm));
    const unsolved = new Set();
    // 1) ciudades puente en los tramos que se hacen eternos (máx. 2 en total). Solo si el viaje da para ello:
    //    con la nueva parada, cada ciudad tiene que seguir teniendo de media 2,5 días o más.
    let added = 0;
    const bridges = () => {
      for(let pass = 0; pass < 3 && added < 2; pass++){
        if(sumD(list) / (list.length + 1) < 2.5) return;
        const legs = [];
        for(let k = 1; k < list.length; k++){ const l = legInfo(list[k - 1], list[k]); if(legSev(l) && !unsolved.has(norm(list[k - 1].n) + '|' + norm(list[k].n))) legs.push({ k, l, sv: legSev(l) }); }
        legs.sort((p, q) => q.l.h - p.l.h);
        const leg = legs[0]; if(!leg) return;
        const a = list[leg.k - 1], b = list[leg.k], inR = have(), near = isSplit(b) ? leg.k - 1 : leg.k;
        const cands = D.cities.filter(c => !inR.has(norm(c.n)) && !NO_RAIL.has(norm(c.n))).map(c => {
          const l1 = legInfo(a, c), l2 = legInfo(c, b); if(!l1 || !l2) return null;
          if(Math.max(legSev(l1), legSev(l2)) >= leg.sv) return null;
          const sum = l1.h + l2.h; if(sum > leg.l.h * 1.45 + 1.5) return null;
          return { c, l1, l2, score: Math.max(l1.h, l2.h) * 1.4 + (sum - leg.l.h) * .5 + (legSev(l1) + legSev(l2)) * 4 - (l1.known ? .6 : 0) - (l2.known ? .6 : 0) - (popular.has(norm(c.n)) ? .8 : 0) };
        }).filter(Boolean).sort((p, q) => p.score - q.score);
        const best = cands[0];
        if(!best || takeDays(list, 2, near, true) < 2){ unsolved.add(norm(a.n) + '|' + norm(b.n)); continue; }
        takeDays(list, 2, near);
        list.splice(leg.k, 0, mkStop(best.c.n, 2)); added++;
        why.push({ k: 'puente', city: best.c.n, t: `Parada en ${best.c.n} entre ${a.n} y ${b.n}: en vez de ${fmtH(leg.l)} seguidas, dos trayectos de ${fmtH(best.l1)} y ${fmtH(best.l2)}.` });
      }
    };
    bridges();
    // 2) paradas de 1 día: se les da otro día sacado de la parada más larga
    const fixed = [];
    list.forEach((s, k) => { if(s.d <= 1 && !isSplit(s) && takeDays(list, 1, k) === 1){ s.d++; fixed.push(s.n); } });
    if(fixed.length) why.push({ k: 'dias', t: `${fixed.length === 1 ? fixed[0] : fixed.slice(0, -1).join(', ') + ' y ' + fixed.slice(-1)}: 2 días en vez de 1, para verla de verdad (el día sale de tu parada más larga).` });
    // 3) si una ciudad queda muy apartada del resto y no hay puente posible, se propone quitarla
    if(list.length >= 3 && metrics(list).level === 2){
      let bestK = -1, bestGain = 0;
      list.forEach((s, k) => {
        if(isSplit(s)) return;
        const rest = list.filter((_, j) => j !== k), m = metrics(rest);
        const gain = pathCost(null, list, null) - pathCost(null, rest, null);
        if(m.longs < metrics(list).longs && gain > bestGain){ bestGain = gain; bestK = k; }
      });
      if(bestK > -1){
        const gone = list.splice(bestK, 1)[0];
        const l = [legInfo(list[bestK - 1], gone), legInfo(gone, list[bestK])].filter(Boolean).sort((p, q) => q.h - p.h)[0];
        const pool = list.filter(s => !isSplit(s)).sort((p, q) => p.d - q.d);
        for(let d = gone.d; d > 0 && pool.length; d--) pool[d % pool.length].d++;
        why.push({ k: 'quitar', city: gone.n, t: `Sin ${gone.n}: queda muy lejos del resto${l ? ` (${fmtH(l)} de ${l.mode === 'bus' ? 'bus' : 'tren'})` : ''}. Sus ${gone.d} ${plural(gone.d, 'día pasa', 'días pasan')} a las demás paradas.` });
        const bp = bestPath(null, list, null); if(!ultraMatters() && bp) list.splice(0, list.length, ...bp);
        unsolved.clear(); bridges();
      }
    }
    // 4) si cambia el orden de las ciudades que ya tenías
    const keep = new Set(orig.map(x => norm(x.n)));
    const seqNew = list.filter(x => keep.has(norm(x.n))).map(x => norm(x.n)).join('|');
    const seqOld = orig.filter(x => have().has(norm(x.n))).map(x => norm(x.n)).join('|');
    if(seqNew !== seqOld) why.unshift({ k: 'orden', t: 'Otro orden: sin idas y vueltas, cada tramo lleva a la ciudad más cercana.' });
    const final = ultraStillOk(list) ? list : proposal().stops.map(x => ({ ...x }));
    if(final !== list){ why.length = 0; why.push({ k: 'orden', t: 'Otro orden que sigue llegando a Split a tiempo para el Ultra.' }); }
    const before = metrics(orig), after = metrics(final);
    const improved = after.level < before.level || after.longs < before.longs || after.oneDay < before.oneDay || after.hours < before.hours - 2;
    return { list: final, why, before, after, improved, orig };
  }
  let sugg = null;   // { key, phase: 'thinking' | 'ready', step, res }
  const suggKey = () => S.stops.map(x => x.n + ':' + x.d).join('|') + '#' + (S.date || '');
  function suggHtml(){
    if(!sugg) return '';
    const r = sugg.res, n = S.stops.length;
    if(sugg.phase === 'thinking'){
      const fact = k => k <= 1 ? 1 : k * fact(k - 1);
      const bridges = r.why.filter(w => w.k === 'puente').length;
      const steps = [
        ['Estudiando tus paradas', `${n} ${plural(n, 'ciudad', 'ciudades')} · ≈${Math.round(r.before.hours)} h de tren`],
        ['Probando todos los órdenes posibles', n <= 7 ? `${fact(n).toLocaleString('es-ES')} ${plural(fact(n), 'combinación', 'combinaciones')}` : 'miles de combinaciones'],
        ['Buscando ciudades puente en los tramos largos', bridges ? `${bridges} ${plural(bridges, 'encontrada', 'encontradas')}` : r.before.longs ? 'Ninguna encaja' : 'No hace falta'],
        ['Repartiendo tus días', `${sumD(r.list)} días, igual que antes`],
        ['Comparando con tu ruta', r.improved ? (r.before.hours - r.after.hours >= 1 ? `−${Math.round(r.before.hours - r.after.hours)} h de tren` : 'Más cómoda') : 'Sin mejora clara']
      ];
      return `<div class="pl-sugg is-thinking"><div class="pl-think-head"><b>Preparando tu ruta sugerida</b><span class="pl-think-pct">${Math.round(sugg.step / steps.length * 100)}%</span></div>
        <div class="pl-think-bar"><i style="width:${Math.round(sugg.step / steps.length * 100)}%"></i></div>
        <ol class="pl-think">${steps.map(([t, res], k) => `<li class="${k < sugg.step ? 'is-done' : k === sugg.step ? 'is-now' : ''}"><span>${esc(t)}</span><em>${esc(res)}</em></li>`).join('')}</ol></div>`;
    }
    if(!r.improved) return `<div class="pl-sugg is-none"><b>Tu ruta ya es la mejor opción con estas ciudades</b><p>No hemos encontrado otra claramente más cómoda. Si te da igual hacer algún tramo largo, dale a «Ignorar» y la repasamos contigo al preparar el presupuesto.</p>
      <div class="pl-viab-actions"><button type="button" class="btn btn--ghost btn--sm" data-sugg-close>Vale</button><button type="button" class="btn btn--ghost btn--sm" data-viab-ignore>Ignorar</button></div></div>`;
    const old = new Map(r.orig.map(x => [norm(x.n), x.d]));
    const stops = r.list.map((s, i) => {
      const o = old.get(norm(s.n)), isNew = o == null, dd = isNew ? 0 : s.d - o;
      return `<li class="${isNew ? 'is-new' : ''}"><span>${String(i + 1).padStart(2, '0')}</span><b>${esc(s.n)}</b><em>${s.d} ${plural(s.d, 'día', 'días')}</em>${isNew ? '<i>nueva</i>' : dd ? `<i>${dd > 0 ? '+' : '−'}${Math.abs(dd)} ${plural(Math.abs(dd), 'día', 'días')}</i>` : ''}</li>`;
    }).join('');
    const cmp = (label, a, b, fmt) => `<div><dt>${label}</dt><dd>${a !== b ? `<s>${fmt(a)}</s>` : ''}<b>${fmt(b)}</b></dd></div>`;
    return `<div class="pl-sugg">
      <div class="pl-sugg-h"><span class="pl-sugg-ic" aria-hidden="true"></span><div><b>Ruta sugerida</b><small>Calculada con los trayectos de tren y bus entre tus ciudades</small></div></div>
      <ol class="pl-sugg-list">${stops}</ol>
      <dl class="pl-sugg-cmp">
        ${cmp('Tren y bus', Math.round(r.before.hours), Math.round(r.after.hours), v => `≈${v} h`)}
        ${cmp('Tramos largos', r.before.longs, r.after.longs, v => String(v))}
        ${cmp('Paradas de 1 día', r.before.oneDay, r.after.oneDay, v => String(v))}
      </dl>
      ${r.why.length ? `<ul class="pl-sugg-why">${r.why.map(w => `<li>${esc(w.t)}</li>`).join('')}</ul>` : ''}
      <div class="pl-viab-actions"><button type="button" class="btn btn--primary btn--sm" data-sugg-apply>Usar esta ruta</button><button type="button" class="btn btn--ghost btn--sm" data-sugg-close>Quedarme con la mía</button></div>
    </div>`;
  }
  let suggT = [];
  function startSugg(){
    suggT.forEach(clearTimeout); suggT = [];
    const res = suggestRoute();
    sugg = { key: suggKey(), phase: reduceMotion ? 'ready' : 'thinking', step: 0, res };
    paintViab();
    if(reduceMotion) return;
    const STEP = 560;
    for(let k = 1; k <= 5; k++) suggT.push(setTimeout(() => { if(!sugg || sugg.res !== res) return; sugg.step = k; if(k === 5) sugg.phase = 'ready'; paintSuggOnly(); }, k * STEP));
  }
  function paintSuggOnly(){
    const box = $('#plViab .pl-sugg-slot'); if(box) box.innerHTML = suggHtml();
    const bar = box && box.querySelector('.pl-think-bar i');
    if(bar && sugg){ const to = bar.style.width; bar.style.width = (sugg.prevPct || 0) + '%'; sugg.prevPct = parseFloat(to); requestAnimationFrame(() => requestAnimationFrame(() => { bar.style.width = to; })); }
    if(sugg && sugg.phase === 'ready'){ const el = $('#plViab .pl-sugg'); if(el && el.getBoundingClientRect().bottom > window.innerHeight) el.scrollIntoView({ behavior: reduceMotion ? 'auto' : 'smooth', block: 'nearest' }); }
  }
  function applySugg(){
    if(!sugg || !sugg.res) return;
    const undo = { stops: S.stops.map(x => ({ ...x })), days: S.days };
    S.stops = sugg.res.list.map(x => ({ ...x }));
    S.days = Math.max(3, Math.min(60, Math.max(S.days, assigned())));
    $('#plDays').value = Math.min(45, Math.max(5, S.days));
    ultraNote = { text: 'Ruta sugerida aplicada.', short: 'Hemos aplicado la ruta sugerida: tus días totales no cambian.', undo };
    sugg = null; S.viabIgnored = '';
    repaintAll(); save(); flash('Ruta sugerida aplicada. Puedes deshacerlo.');
  }

  function sortRoute(){
    const prop = proposal();
    S.stops = prop.stops; S.days = Math.max(3, Math.min(60, prop.days || assigned()));
    $('#plDays').value = Math.min(45, Math.max(5, S.days));
    return prop;
  }

  // Planifica con la fecha del cliente para llegar a Split la víspera del festival, manteniendo la
  // duración: prueba qué paradas van antes y cuáles después, y se queda con la de menos horas de tren
  // (el vuelo desde España no cuenta). Split, 4 días; mínimo 2 por parada. No modifica S.
  function planUltra(stopsIn){
    const list = stopsIn.map(x => ({ ...x }));
    const T = Math.max(S.days, sumD(list));
    const split = list.find(isSplit);
    split.d = Math.max(ULTRA.min, Math.min(ULTRA.rec, split.d));
    const others = list.filter(x => !isSplit(x));
    const lastArrive = addDays(ULTRA.leave, -split.d);
    const arriveTarget = S.date > lastArrive ? S.date : lastArrive;
    const B = diffDays(arriveTarget, S.date);
    const orig = new Map(others.map(x => [x, x.d]));
    // asigna días a una propuesta (sin tocar los originales) y mide cuánto cambia lo que eligió el cliente
    const trial = (bef, aft) => {
      const b = bef.map(x => ({ x, d: x.d })), a = aft.map(x => ({ x, d: x.d }));
      const fake = arr => arr.map(o => ({ d: o.d }));
      const fb = fake(b), fa = fake(a);
      spread(fb, B, b.map(o => orig.get(o.x)), B >= b.length * 2 ? 2 : 1);
      const splitD = !b.length && B > 0 ? split.d + B : split.d;
      const A = T - sumD(fb) - splitD;
      if(fa.length) spread(fa, Math.max(fa.length * 2, A), a.map(o => orig.get(o.x)), 2);
      let dist = 0;
      fb.forEach((o, j) => { dist += Math.abs(o.d - orig.get(b[j].x)); });
      fa.forEach((o, j) => { dist += Math.abs(o.d - orig.get(a[j].x)); });
      const total = sumD(fb) + splitD + sumD(fa);
      return dist * 3 + Math.max(0, total - T) * 5 + Math.max(0, splitD - ULTRA.rec) * 6;
    };
    let kept = [], post = others.slice(), best = Infinity;
    const mustBefore = B >= 2 && others.length > 0;
    if(others.length <= 7){   // con más paradas, probar todas las combinaciones bloqueaba la página (2 s por clic con 9)
      for(let mask = 0; mask < (1 << others.length); mask++){
        const bef = others.filter((_, j) => mask & (1 << j));
        if(bef.length * 2 > B) continue;
        if(mustBefore && !bef.length) continue;
        const aft = others.filter((_, j) => !(mask & (1 << j)));
        const bp = bestPath(null, bef, split), ap = bestPath(split, aft, null);
        const c = pathCost(null, bp, split) + pathCost(split, ap, null) + trial(bp, ap);
        if(c < best){ best = c; kept = bp; post = ap; }
      }
    } else {
      const byNear = others.slice().sort((p, q) => (legHours(p, split) || 99) - (legHours(q, split) || 99));
      let budget = B; kept = [];
      byNear.forEach(x => { if(budget >= 2){ kept.push(x); budget -= Math.max(2, Math.min(x.d, budget)); } });
      const ks = new Set(kept); kept = bestPath(null, kept, split); post = bestPath(split, others.filter(x => !ks.has(x)), null);
    }
    const w = new Map(others.map(x => [x, x.d]));
    spread(kept, B, kept.map(x => w.get(x)), B >= kept.length * 2 ? 2 : 1);
    if(!kept.length && B > 0) split.d += B;
    const A = T - sumD(kept) - split.d;
    if(post.length) spread(post, Math.max(post.length * 2, A), post.map(x => w.get(x)), 2);
    else if(A > 0) split.d += Math.min(A, 2);
    const stops = [...kept, split, ...post];
    return { stops, days: Math.max(T, sumD(stops)), before: kept, after: post };
  }
  function planNote(r){
    const f = arr => arr.map(x => `${x.n} (${x.d})`).join(' → ');
    return `Ruta recolocada para el Ultra` + (r.before.length ? `: ${f(r.before)} → Split` : ': Split') + (r.after.length ? ` → ${f(r.after)}` : '') + '.';
  }
  function fitRoute(){
    const u = ultraInfo();
    if(!u || !u.possible || u.ok) return false;
    const undo = { stops: S.stops.map(x => ({ ...x })), days: S.days };
    const r = planUltra(S.stops);
    S.stops = r.stops; S.days = Math.max(3, Math.min(60, r.days));
    $('#plDays').value = Math.min(45, Math.max(5, S.days));
    ultraNote = { text: planNote(r), short: 'Ruta recolocada para llegar a Split el día antes del festival.', undo };
    return true;
  }
  const IC_RAIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="3" width="12" height="13" rx="3"/><path d="M6 10h12M9 20l-2 2M15 20l2 2"/></svg>';
  const IC_BUS = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="14" rx="3"/><path d="M4 11h16M7 20v-3M17 20v-3"/></svg>';
  const IC_FERRY = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 17c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0M5 14l1-5h12l1 5M9 9V5h6v4"/></svg>';
  const IC_MOON = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z"/></svg>';
  function paintUltra(){
    const box = $('#plUltra'); if(!box) return;
    const u = ultraInfo();
    box.hidden = !u; if(!u) return;
    let state = 'info', html = '';
    if(!S.date){
      html = u.suggest >= todayIso()
        ? `<b>¿Vas al Ultra?</b><span>Saliendo el ${esc(shortDate(u.suggest))} llegas a Split justo el día antes.</span><button type="button" class="pl-link" data-ultra-date="${u.suggest}">Usar esa fecha</button>`
        : `<b>Split en tu ruta</b><span>Elige tu fecha y colocamos la ruta.</span>`;
    } else if(u.ok){
      state = 'ok';
      html = `<b>Split: ${esc(shortDate(u.arrive))} → ${esc(shortDate(u.leave))}</b><span>Las tres noches del Ultra, dentro.</span>`;
    } else if(u.possible){
      html = `<b>Llegas a Split el ${esc(shortDate(u.arrive))}</b><span>Con tu misma fecha podemos llegar a tiempo al Ultra.</span><button type="button" class="pl-link" data-ultra-fit>Adaptar la ruta</button>`;
    } else if(u.suggest >= todayIso()){
      html = `<b>Tu viaje no coincide con el Ultra</b><span>Llegarías a Split el ${esc(shortDate(u.arrive))}. Movemos tu salida al ${esc(shortDate(u.suggest))} y mantienes todo lo demás.</span><button type="button" class="btn btn--primary btn--sm" data-ultra-shift>Adaptar mi viaje al Ultra</button>`;
    } else {
      html = `<b>Split, parada de tu ruta</b><span>Llegas el ${esc(shortDate(u.arrive))}: calas, casco romano y noches largas.</span>`;
    }
    box.dataset.state = state;
    box.innerHTML = html;
  }
  function defaultDaysForNew(){
    const left = S.days - assigned();
    return left >= 2 ? Math.min(left, 3) : 2;
  }
  function addStop(name){
    ultraNote = null;
    if(S.stops.length >= 15){ flash('Máximo 15 paradas: para rutas más largas escríbenos por WhatsApp.'); return; }
    S.stops.push(mkStop(name, norm(name) === 'split' ? ULTRA.rec : defaultDaysForNew())); buzz();
    paintStops(true); paintPresets(); paintCities(); paintPreview(); paintNav(); save();
    flash(`${S.stops[S.stops.length - 1].n} añadida · ${S.stops.length} ${plural(S.stops.length, 'parada', 'paradas')}`);
  }
  function removeStop(i){ ultraNote = null; const gone = S.stops[i]; S.stops.splice(i, 1); if(gone) flash(`${gone.n} quitada de tu ruta`); paintStops(); paintPresets(); paintCities(); paintPreview(); paintNav(); save(); }
  function moveStop(i, dir){
    ultraNote = null;
    const j = i + dir; if(j < 0 || j >= S.stops.length) return;
    [S.stops[i], S.stops[j]] = [S.stops[j], S.stops[i]];
    paintStops(); paintPresets(); paintPreview(); save();
    const btn = $$('#plStops li')[j]?.querySelector(dir < 0 ? '[data-up]' : '[data-down]');
    if(btn && !btn.disabled) btn.focus();
  }
  function balance(){
    const n = S.stops.length; if(!n) return;
    const base = Math.max(1, Math.floor(S.days / n)); let extra = Math.max(0, S.days - base * n);
    S.stops.forEach(s => { s.d = base + (extra > 0 ? 1 : 0); if(extra > 0) extra--; });
    S.stops.forEach(s => {
      let need = minDays(s) - s.d;
      while(need > 0){
        const donor = S.stops.filter(o => o !== s && o.d > minDays(o)).sort((a, b) => b.d - a.d)[0];
        if(!donor) break;
        donor.d--; s.d++; need--;
      }
      s.d = Math.max(s.d, minDays(s));
    });
    paintStops(); paintPreview(); save();
  }
  function setDays(v, fromSlider){
    S.days = Math.max(3, Math.min(60, v | 0));
    const r = $('#plDays');
    if(!fromSlider) r.value = Math.min(45, Math.max(5, S.days));
    paintDuration(); paintMeter(); paintPreview(); paintNav(); save();
  }

  let flashT;
  function flash(msg){
    const box = $('#plInfo');
    box.textContent = msg; box.classList.add('is-flash');
    clearTimeout(flashT); flashT = setTimeout(() => { box.classList.remove('is-flash'); paintNav(); }, 3200);
  }

  /* ---------------- step 1 ---------------- */
  function paintOrigin(){
    $$('#plOrigin .pill').forEach(b => { const on = b.dataset.v === S.origin; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    const other = $('#plOriginOther');
    other.hidden = S.origin !== '__otra';
    other.value = S.originOther;
  }
  function paintDate(){
    $('#plDate').value = S.date; $('#plFlex').checked = !!S.flex;
    const hint = $('#plDateHint');
    let msg = '', hot = false, ok = false;
    const u = ultraInfo();
    if(S.date && u && u.ok){
      msg = `Con tu fecha llegas a Split el ${shortDate(u.arrive)}: las tres noches del Ultra Europe, dentro.`; ok = true;
    } else if(S.date && u && !u.possible && u.suggest >= todayIso()){
      msg = `Tu viaje no coincide con el Ultra Europe (9, 10 y 11 de julio). En el paso 2 puedes adaptarlo con un toque, sin perder lo que has elegido.`; hot = true;
    } else if(S.date){
      const d = new Date(S.date + 'T12:00:00'), now = new Date(); now.setHours(0, 0, 0, 0);
      const diff = Math.round((d - now) / 864e5), m = d.getMonth();
      if(diff < 0) msg = 'Esa fecha ya ha pasado: revísala antes de enviar.';
      else if(diff <= 30) { msg = 'Sales muy pronto. Envía la ruta y escríbenos también por WhatsApp para ir más rápido.'; hot = true; }
      else if(m === 6 || m === 7) { msg = `${m === 6 ? 'Julio' : 'Agosto'} es de lo más pedido del año: cuanto antes cerremos tu ruta, más alojamiento céntrico tendrás para elegir.`; hot = true; }
      else if(m === 5 || m === 8) msg = 'Buena elección: menos colas y mejores precios que en pleno verano.';
    }
    hint.hidden = !msg; hint.textContent = msg; hint.classList.toggle('is-hot', hot); hint.classList.toggle('is-ok', ok);
  }
  function paintTrav(){
    $('#plTrav').textContent = S.trav;
    $('#plTravLabel').textContent = plural(S.trav, 'persona', 'personas');
    $('[data-trav="-1"]').disabled = S.trav <= 1;
    $('[data-trav="1"]').disabled = S.trav >= 30;
  }
  function paintDuration(){
    $('#plDaysOut').textContent = S.days;
    const r = $('#plDays');
    r.style.setProperty('--p', ((Math.min(45, S.days) - 5) / 40 * 100) + '%');
    $$('.pl-dur-chips .pill').forEach(b => b.classList.toggle('on', +b.dataset.days === S.days));
  }

  /* ---------------- step 2 ---------------- */
  function activePreset(){
    const cur = S.stops.map(s => norm(s.n)).join('|');
    const p = D.presets.find(p => p.stops.map(s => norm(s.n)).join('|') === cur);
    return p ? p.id : '';
  }
  function paintPresets(){
    const on = activePreset();
    $('#plPresets').innerHTML = D.presets.map(p => {
      const total = p.stops.reduce((a, s) => a + s.d, 0);
      return `<button type="button" class="pl-preset${p.hot ? ' is-hot' : ''}${p.id === on ? ' is-on' : ''}" data-preset="${esc(p.id)}" aria-pressed="${p.id === on}">
        ${p.hot ? '<span class="pl-preset-badge">La más pedida</span>' : ''}
        <span class="pl-preset-top"><b>${esc(p.t)}</b><em>${total} días</em></span>
        <span class="pl-preset-s">${esc(p.s)}</span>
        <span class="pl-preset-chain">${p.stops.map(s => esc(s.n)).join(' → ')}</span>
      </button>`;
    }).join('');
  }
  function loadPreset(p){
    S.stops = p.stops.map(s => mkStop(s.n, s.d));
    if(p.id === 'fiesta' || p.id === 'ultra'){ if(!S.styles.includes('fiesta')) S.styles.push('fiesta'); }
    S.days = Math.max(3, Math.min(60, assigned()));
    $('#plDays').value = Math.min(45, Math.max(5, S.days));
  }
  let showAll = false;
  function paintCities(){
    const q = norm($('#plSearch').value);
    const box = $('#plCities');
    const inRoute = new Set(S.stops.map(s => norm(s.n)));
    let list;
    if(q){
      list = D.cities.filter(c => norm(c.n).includes(q) || norm(D.countries[c.cc]).includes(q));
    }else{
      list = showAll ? D.cities.slice().sort((a, b) => a.n.localeCompare(b.n, 'es')) : D.popular.map(n => byName[norm(n)]).filter(Boolean);
    }
    let html = list.map(c => {
      const on = inRoute.has(norm(c.n));
      return `<button type="button" class="pl-city${on ? ' is-on' : ''}" data-city="${esc(c.n)}" aria-pressed="${on}">
        <span class="flag flag--sm"${flagStyle(c.cc)} aria-hidden="true"></span><span class="pl-city-n">${esc(c.n)}</span><span class="pl-city-c">${esc(D.countries[c.cc] || '')}</span><span class="pl-city-ic" aria-hidden="true"></span>
      </button>`;
    }).join('');
    const raw = $('#plSearch').value.trim();
    if(q && !list.some(c => norm(c.n) === q) && raw.length >= 2){
      html += `<button type="button" class="pl-city pl-city--custom" data-custom="${esc(raw)}"><span class="pl-city-n">Añadir «${esc(raw)}»</span><span class="pl-city-c">otra parada</span><span class="pl-city-ic" aria-hidden="true"></span></button>`;
    }
    if(!q) html += `<button type="button" class="pl-city pl-city--more" data-more>${showAll ? 'Ver solo las populares' : `Ver las ${D.cities.length} ciudades`}</button>`;
    if(q && !list.length && raw.length < 2) html = '<p class="pl-empty">Sigue escribiendo…</p>';
    box.innerHTML = html;
  }
  function paintStops(animateLast){
    const ol = $('#plStops');
    $('#plStopCount').textContent = `${S.stops.length} ${plural(S.stops.length, 'parada', 'paradas')}`;
    if(!S.stops.length){
      ol.innerHTML = `<li class="pl-stops-empty">${IB_ICON_TRAIN}<span>Tu ruta está vacía. Elige una idea de arriba o toca ciudades para añadirlas.</span></li>`;
      paintMeter(); return;
    }
    ol.innerHTML = S.stops.map((s, i) => `<li class="pl-stop${i < S.stops.length - 1 ? ' has-leg' : ''}${animateLast && i === S.stops.length - 1 ? ' is-new' : ''}">
      <span class="pl-stop-n">${String(i + 1).padStart(2, '0')}</span>
      <span class="flag flag--sm"${flagStyle(s.cc)} aria-hidden="true"></span>
      <span class="pl-stop-name"><b>${esc(s.n)}</b><small>${esc(D.countries[s.cc] || 'Parada libre')}${isSplit(s) ? ' · <em>Ultra 9–11 jul</em>' : ''}</small></span>
      <span class="pl-stepper" role="group" aria-label="Días en ${esc(s.n)}">
        <button type="button" data-dd="-1" data-i="${i}" aria-label="Un día menos en ${esc(s.n)}"${s.d <= minDays(s) ? ' disabled' : ''}>−</button>
        <output>${s.d}<small>${plural(s.d, 'día', 'días')}</small></output>
        <button type="button" data-dd="1" data-i="${i}" aria-label="Un día más en ${esc(s.n)}"${s.d >= 30 ? ' disabled' : ''}>+</button>
      </span>
      <span class="pl-stop-act">
        <button type="button" data-up data-i="${i}" aria-label="Subir ${esc(s.n)}"${i === 0 ? ' disabled' : ''}>${IB_ICON_UP}</button>
        <button type="button" data-down data-i="${i}" aria-label="Bajar ${esc(s.n)}"${i === S.stops.length - 1 ? ' disabled' : ''}>${IB_ICON_DOWN}</button>
        <button type="button" data-rm data-i="${i}" aria-label="Quitar ${esc(s.n)}" class="is-rm">${IB_ICON_X}</button>
      </span>
      ${i < S.stops.length - 1 ? `<span class="pl-leg" data-k="${i}"></span>` : ''}
    </li>`).join('');
    paintLegs(false);
    paintMeter();
  }
  function paintMeter(){
    const m = $('#plMeter'), a = assigned(), t = S.days;
    m.hidden = !S.stops.length;
    if(!S.stops.length) return;
    const bar = m.querySelector('.pl-meter-bar i');
    bar.style.width = Math.min(100, a / t * 100) + '%';
    m.classList.toggle('is-ok', a === t); m.classList.toggle('is-over', a > t);
    m.querySelector('b').textContent = `${a} de ${t} días repartidos`;
    m.querySelector('p span').textContent = a === t ? 'Cuadra perfecto' : a > t ? `Te pasas ${a - t} ${plural(a - t, 'día', 'días')}` : `Te ${plural(t - a, 'queda', 'quedan')} ${t - a} por repartir`;
    $('#plBalance').hidden = a === t; $('#plFit').hidden = a === t;
    $('#plFit').textContent = `Viaje de ${a} días`;
  }

  /* ---------------- step 3 ---------------- */
  function paintStyle(){
    $$('.pl-style input').forEach(i => { i.checked = S.styles.includes(i.value); });
    $$('#plStay .pill').forEach(b => { const on = b.dataset.v === S.stay; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    $$('#plBudget button').forEach(b => { const on = b.dataset.v === S.budget; b.classList.toggle('on', on); b.setAttribute('aria-checked', on); });
    $('#plNotes').value = S.notes;
  }

  /* ---------------- step 4 ---------------- */
  function paintSend(){
    const gate = REQUIRE_AUTH && !user;
    $('#plGate').hidden = !gate;
    $('#plContact').hidden = gate;
    if(!gate){
      if(user){
        const md = user.user_metadata || {};
        if(!S.name) S.name = md.nombre || md.name || '';
        if(!S.phone) S.phone = md.telefono || '';
        S.email = user.email;
      }
      $('#plName').value = S.name; $('#plPhone').value = S.phone; $('#plEmail').value = S.email;
      $('#plEmail').readOnly = !!user;
      $('#plEmail').closest('.field').classList.toggle('is-locked', !!user);
    }
    const o = originCity();
    const styleTxt = S.styles.map(k => D.styles[k]).filter(Boolean).join(', ') || 'Sin preferencia';
    $('#plReview').innerHTML = `<h3>Resumen</h3>
      <dl>
        <div><dt>Salida</dt><dd>${esc(o ? o.n : '—')}${S.date ? ' · ' + esc(fmtDate(S.date)) : ''}${S.flex ? ' · flexible' : ''}</dd><button type="button" class="pl-link" data-go="1">Editar</button></div>
        <div><dt>Viaje</dt><dd>${S.days} días · ${S.trav} ${plural(S.trav, 'persona', 'personas')}</dd><button type="button" class="pl-link" data-go="1">Editar</button></div>
        <div><dt>Ruta</dt><dd>${S.stops.map(s => `${esc(s.n)} <small>(${s.d})</small>`).join(' → ') || '—'}</dd><button type="button" class="pl-link" data-go="2">Editar</button></div>
        <div><dt>Estilo</dt><dd>${esc(styleTxt)} · ${esc(S.stay)}${S.budget ? ' · ' + esc(D.budgets[S.budget]) : ''}</dd><button type="button" class="pl-link" data-go="3">Editar</button></div>
      </dl>`;
  }
  const fmtDate = iso => { try{ return new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }); }catch(e){ return iso; } };

  /* ---------------- preview ---------------- */
  function paintPreview(){
    paintUltra();
    paintViab();
    const o = originCity();
    $('#pvFrom').textContent = o ? code3(o.n) : '···';
    $('#pvTo').textContent = S.stops.length ? code3(S.stops[S.stops.length - 1].n) : '···';
    setStat('#pvDays', S.days);
    setStat('#pvStops', S.stops.length);
    setStat('#pvCountries', countries());
    setStat('#pvTrav', S.trav);
    paintVibe();
    const placed = window.IBMap ? IBMap.draw($('#plMap'), o, S.stops) : 0;
    $('#plMapEmpty').hidden = S.stops.length > 0;
    const pk = $('#plPeekN'); if(pk) pk.textContent = S.stops.length;
    $('#pvList').innerHTML = (o ? `<li class="is-origin"><span>${esc(o.n)}</span><em>salida</em></li>` : '') +
      S.stops.map(s => `<li><span>${esc(s.n)}</span><em>${s.d} ${plural(s.d, 'día', 'días')}</em></li>`).join('');
    return placed;
  }

  /* ---------------- dopamina: contadores, nivel de fiesta, confeti ---------------- */
  function setStat(sel, v){
    const b = $(sel); if(!b) return;
    if(b.textContent !== String(v)){
      b.textContent = v;
      b.classList.remove('is-bump'); void b.offsetWidth; b.classList.add('is-bump');
    }
  }
  const VIBES = ['', 'Tranqui', 'Con ambiente', 'Mucha fiesta', 'Modo leyenda'];
  let lastVibe = -1;
  function paintVibe(){
    const box = $('#pvVibe'); if(!box) return;
    const party = D.party || {};
    const n = S.stops.length;
    const avg = n ? S.stops.reduce((a, s) => a + (party[s.n] || 0), 0) / n : 0;
    const ultra = S.stops.some(s => s.n === 'Split');
    let lvl = !n ? 0 : avg >= 2.5 ? 4 : avg >= 1.8 ? 3 : avg >= 1 ? 2 : 1;
    if(ultra && lvl && lvl < 3) lvl = 3;               // con Ultra Europe en ruta, mínimo "Mucha fiesta"
    box.hidden = !lvl;
    box.dataset.level = lvl;
    $('#pvVibeT').innerHTML = esc(VIBES[lvl]) + (ultra ? ' <em>+ Ultra</em>' : '');
    if(lastVibe > -1 && lvl === 4 && lastVibe < 4) burst($('#pvVibe'), 36);
    lastVibe = lvl;
  }
  const reduceMotion = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  function burst(anchor, n){
    if(reduceMotion || !anchor || !anchor.getBoundingClientRect) return;
    const r = anchor.getBoundingClientRect();
    if(r.width === 0) return;
    const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    const colors = ['#F0532F', '#FFC53D', '#FF4FA3', '#3BC4FF', '#1F120E', '#FFFFFF'];
    const layer = document.createElement('div');
    layer.className = 'confetti'; layer.setAttribute('aria-hidden', 'true');
    document.body.appendChild(layer);
    for(let i = 0; i < n; i++){
      const p = document.createElement('i');
      const w = 5 + Math.random() * 6;
      p.style.cssText = `left:${cx}px;top:${cy}px;width:${w}px;height:${w * (Math.random() < .5 ? 1 : 2.2)}px;background:${colors[i % colors.length]};border-radius:${Math.random() < .35 ? '50%' : '2px'}`;
      layer.appendChild(p);
      const a = Math.random() * Math.PI * 2, v = 90 + Math.random() * 190;
      const dx = Math.cos(a) * v, dy = Math.sin(a) * v - 120;
      p.animate([
        { transform: 'translate(-50%,-50%) rotate(0deg)', opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy + 260}px)) rotate(${(Math.random() - .5) * 900}deg)`, opacity: 0 }
      ], { duration: 1100 + Math.random() * 700, easing: 'cubic-bezier(.15,.7,.3,1)', fill: 'forwards' });
    }
    setTimeout(() => layer.remove(), 2000);
  }
  const buzz = () => { try{ if(navigator.vibrate && matchMedia('(pointer:coarse)').matches) navigator.vibrate(8); }catch(e){} };

  /* ---------------- navigation ---------------- */
  function validStep(n, show){
    const err = msg => { if(show) showError(msg); return false; };
    if(n === 1){
      if(S.origin === '__otra' && !S.originOther.trim()) return err('Dinos desde qué ciudad sales.');
    }
    if(n === 2){
      if(!S.stops.length) return err('Añade al menos una parada a tu ruta.');
    }
    if(n === 4){
      if(REQUIRE_AUTH && !user) return err('Crea tu cuenta o entra para poder enviar la ruta.');
      if(S.name.trim().length < 2) return err('Escribe tu nombre.'), focus('#plName');
      const digits = S.phone.replace(/\D/g, '');
      if(digits.length < 9 || digits.length > 15) return err('Revisa tu número de WhatsApp.'), focus('#plPhone');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(S.email.trim())) return err('Revisa tu correo electrónico.'), focus('#plEmail');
      if(!$('#plConsent').checked) return err('Necesitamos que aceptes la política de privacidad para preparar tu presupuesto.');
    }
    return true;
  }
  function focus(sel){ const el = $(sel); if(el) el.focus(); return false; }
  function showError(msg, html){
    const e = $('#plError'); e.hidden = false;
    if(html) e.innerHTML = html; else e.textContent = msg;
    e.classList.remove('is-shake'); void e.offsetWidth; e.classList.add('is-shake');
  }
  function hideError(){ $('#plError').hidden = true; }

  function go(n, opts){
    opts = opts || {};
    n = Math.max(1, Math.min(TOTAL_STEPS, n));
    if(n > S.step){
      for(let k = S.step; k < n; k++){ if(!validStep(k, true)){ goRaw(k, opts); return; } }
    }
    goRaw(n, opts);
  }
  function goRaw(n, opts){
    const dir = n >= S.step ? 1 : -1;
    S.step = n; hideError();
    $$('.pl-step').forEach(f => {
      const on = +f.dataset.step === n;
      f.classList.toggle('is-active', on);
      f.classList.toggle('from-left', on && dir < 0);
      f.disabled = !on;
    });
    if(n === 4) paintSend();
    paintNav(); save();
    if(!opts.silent){
      const top = $('#planner').getBoundingClientRect().top;
      if(top < 0 || top > window.innerHeight * .5) $('#planner').scrollIntoView({ behavior: 'smooth', block: 'start' });
      const lg = $(`.pl-step[data-step="${n}"] .pl-h`);
      if(lg){ lg.setAttribute('tabindex', '-1'); lg.focus({ preventScroll: true }); }
    }
  }
  function paintNav(){
    const n = S.step;
    $$('.pl-rail li').forEach((li, i) => {
      const b = li.querySelector('button');
      li.classList.toggle('is-done', i + 1 < n);
      li.classList.toggle('is-now', i + 1 === n);
      if(i + 1 === n) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
    });
    const pct = (n - 1) / (TOTAL_STEPS - 1) * 100;
    $('#plTrackFill').style.width = pct + '%';
    $('#plTrain').style.left = pct + '%';
    $('#plBack').hidden = n === 1;
    const next = $('#plNext');
    const gate = n === 4 && REQUIRE_AUTH && !user;
    next.hidden = gate;
    next.querySelector('span').textContent = n === 4 ? (sending ? 'Enviando…' : 'Enviar mi ruta') : 'Siguiente';
    next.classList.toggle('is-send', n === 4);
    const info = $('#plInfo');
    if(info.classList.contains('is-flash')) return;
    info.textContent = n === 2 && S.stops.length ? `${S.stops.length} ${plural(S.stops.length, 'parada', 'paradas')} · ${assigned()}/${S.days} días`
      : n === 4 ? 'Sin compromiso · respuesta en hasta 3 h' : `Paso ${n} de ${TOTAL_STEPS}`;
  }

  /* ---------------- submit ---------------- */
  function rand6(){
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = '';
    const buf = (window.crypto && crypto.getRandomValues) ? crypto.getRandomValues(new Uint8Array(6)) : Array.from({ length: 6 }, () => Math.random() * 256 | 0);
    for(let i = 0; i < 6; i++) s += a[buf[i] % a.length];
    return 'IB-' + s;
  }
  async function send(){
    if(sending) return;
    S.name = $('#plName').value.trim(); S.phone = $('#plPhone').value.trim(); S.email = (user ? user.email : $('#plEmail').value).trim();
    if(!validStep(4, true)) return;
    sending = true; paintNav(); $('#plNext').disabled = true; hideError();
    const o = originCity();
    const ref = rand6();
    const row = {
      ref, nombre: S.name, email: S.email, telefono: S.phone,
      salida: o ? o.n : '', fecha_salida: S.date || null, flexible: !!S.flex,
      dias: S.days, viajeros: S.trav,
      paradas: S.stops.map(s => ({ ciudad: s.n, pais: D.countries[s.cc] || '', dias: s.d })),
      estilo: S.styles.map(k => D.styles[k]).filter(Boolean),
      alojamiento: S.stay, presupuesto: S.budget ? D.budgets[S.budget] : null,
      notas: S.notes.trim() || null,
      acepta_publicidad: !!S.promo
    };
    let stored = false, err = null;
    if(IB.enabled){
      try{
        let { error } = await IB.sb.from('rutas').insert(row);
        // si la base de datos aún no tiene la columna de publicidad, se guarda la ruta igualmente
        if(error && /acepta_publicidad/.test(error.message || '')){
          const { acepta_publicidad, ...rest } = row;
          ({ error } = await IB.sb.from('rutas').insert(rest));
        }
        if(error) err = error; else stored = true;
      }catch(e){ err = e; }
      if(stored && user && (user.user_metadata || {}).telefono !== S.phone){
        IB.sb.auth.updateUser({ data: { telefono: S.phone, nombre: (user.user_metadata || {}).nombre || S.name } }).catch(() => {});
      }
    }
    const notified = await IB.notify('ruta', {
      referencia: ref, nombre: row.nombre, email: row.email, telefono: row.telefono,
      salida: row.salida, fecha: (S.date ? fmtDate(S.date) : 'sin fecha') + (S.flex ? ' (flexible)' : ''),
      dias: String(row.dias), viajeros: String(row.viajeros),
      paradas: row.paradas.map(p => `${p.ciudad} (${p.dias})`).join(' → '),
      estilo: row.estilo.join(', '), alojamiento: row.alojamiento, presupuesto: row.presupuesto || '',
      publicidad: row.acepta_publicidad ? 'Sí' : 'No', notas: row.notas || ''
    });
    sending = false; $('#plNext').disabled = false; paintNav();
    if(IB.enabled && !stored){ showError(IB.errMsg(err)); return; }
    if(!IB.enabled && !notified){
      showError('', `No hemos podido enviar la ruta ahora mismo. <a href="${esc(IB.wa(waText(ref, row)))}" target="_blank" rel="noopener">Mándanosla por WhatsApp</a> y te respondemos igual de rápido.`);
      return;
    }
    try{ localStorage.removeItem(DRAFT); }catch(e){}
    done(ref, row);
  }
  function waText(ref, row){
    return `¡Hola Iberail! Soy ${row.nombre} y acabo de enviar mi ruta (ref. ${ref}).\n` +
      `Salgo desde ${row.salida}${S.date ? ' el ' + fmtDate(S.date) : ''} · ${row.dias} días · ${row.viajeros} ${plural(row.viajeros, 'persona', 'personas')}\n` +
      `Ruta: ${row.paradas.map(p => `${p.ciudad} (${p.dias})`).join(' → ')}` +
      (row.notas ? `\nNotas: ${row.notas}` : '');
  }
  function done(ref, row){
    const main = $('.pl-main'), box = $('#plDone');
    main.appendChild(box);
    form.hidden = true; $('.pl-rail').hidden = true;
    const text = waText(ref, row);
    box.innerHTML = `
      <div class="done-badge" aria-hidden="true">${IB_ICON_CHECK}</div>
      <span class="eyebrow">Ruta recibida</span>
      <h2>¡Gracias, ${esc(row.nombre.split(' ')[0])}! Tu ruta ya está en nuestras manos.</h2>
      <p class="done-lead">Estamos preparando tu presupuesto. Te escribimos al <b>${esc(row.telefono)}</b> por orden de llegada: ahora mismo tardamos hasta 3 horas por la alta demanda.</p>
      <div class="done-ref"><span>Referencia</span><b>${esc(ref)}</b><button type="button" class="pl-link" data-copy="${esc(ref)}">Copiar</button></div>
      <ol class="done-steps">
        <li class="is-done"><i></i><span><b>Ruta recibida</b>Ahora mismo</span></li>
        <li class="is-now"><i></i><span><b>Preparando tu presupuesto</b>Trenes, pase y alojamiento</span></li>
        <li><i></i><span><b>Te lo mandamos por WhatsApp</b>En hasta 3 horas</span></li>
      </ol>
      <div class="done-wa">
        <div><b>¿Lo quieres aún más rápido?</b><span>Escríbenos por WhatsApp con un solo mensaje: respondemos por orden de llegada, a cualquier hora.</span></div>
        <a class="btn btn--wa btn--xl" id="doneWa" href="${esc(IB.wa(text))}" target="_blank" rel="noopener">${IB_ICON_CHAT}<span>Escribir por WhatsApp</span></a>
      </div>
      <div class="done-more">
        ${IB.enabled ? '<a class="link-arrow" href="cuenta.html">Ver mis rutas</a>' : ''}
        <button type="button" class="pl-link" id="doneAgain">Planificar otra ruta</button>
      </div>`;
    box.hidden = false;
    setTimeout(() => burst($('.done-badge'), 90), 600);
    const stamp = $('.pl-stamp'); stamp.textContent = 'ENVIADA · ' + ref; stamp.classList.add('is-sent');
    box.focus({ preventScroll: true });
    $('#planner').scrollIntoView({ behavior: 'smooth', block: 'start' });
    box.querySelector('[data-copy]').addEventListener('click', e => IB.copy(ref).then(ok => { if(ok) e.target.textContent = 'Copiada'; }));
    $('#doneAgain').addEventListener('click', () => { location.href = 'rutas.html'; });
  }

  function repaintAll(){ paintDate(); paintDuration(); paintPresets(); paintStops(); paintCities(); paintPreview(); paintNav(); }

  /* ---------------- events ---------------- */
  $('#plOrigin').addEventListener('click', e => {
    const b = e.target.closest('.pill'); if(!b) return;
    S.origin = b.dataset.v; paintOrigin(); paintPreview(); save();
    if(S.origin === '__otra') $('#plOriginOther').focus();
  });
  $('#plOriginOther').addEventListener('input', e => { S.originOther = e.target.value; paintPreview(); save(); });
  $('#plDate').min = new Date().toISOString().slice(0, 10);
  $('#plDate').addEventListener('change', e => { if(e.target.value === S.date) return; S.date = e.target.value; ultraNote = null; const changed = fitRoute(); repaintAll(); if(changed) flash('Ruta adaptada a tu fecha para el Ultra Europe.'); save(); });
  $('#plFlex').addEventListener('change', e => { S.flex = e.target.checked; save(); });
  $$('[data-trav]').forEach(b => b.addEventListener('click', () => { S.trav = Math.max(1, Math.min(30, S.trav + +b.dataset.trav)); paintTrav(); paintPreview(); save(); }));
  $('#plDays').addEventListener('input', e => setDays(+e.target.value, true));
  $$('.pl-dur-chips .pill').forEach(b => b.addEventListener('click', () => setDays(+b.dataset.days)));

  $('#plPresets').addEventListener('click', e => {
    const b = e.target.closest('[data-preset]'); if(!b) return;
    const p = D.presets.find(x => x.id === b.dataset.preset); if(!p) return;
    loadPreset(p); buzz(); ultraNote = null;
    const fitted = S.date ? fitRoute() : false;
    paintDuration(); paintMeter(); paintPresets(); paintStops(true); paintCities(); paintStyle(); paintPreview(); paintNav(); save();
    flash(fitted ? `«${p.t}» cargada y adaptada a tu fecha.` : `«${p.t}» cargada: cámbiala como quieras.`);
    const nb = $(`.pl-preset[data-preset="${p.id}"]`); if(p.hot && nb) burst(nb, 40);
  });
  $('#plSearch').addEventListener('input', paintCities);
  $('#plSearch').addEventListener('keydown', e => {
    if(e.key !== 'Enter') return;
    e.preventDefault();
    const first = $('#plCities .pl-city:not(.pl-city--more)');
    if(first) first.click();
  });
  $('#plCities').addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b) return;
    if(b.hasAttribute('data-more')){ showAll = !showAll; paintCities(); return; }
    const name = b.dataset.city || b.dataset.custom; if(!name) return;
    const i = S.stops.findIndex(s => norm(s.n) === norm(name));
    if(b.dataset.city && i > -1) removeStop(i); else addStop(name);
    if(b.dataset.custom){ $('#plSearch').value = ''; paintCities(); }
  });
  $('#plStops').addEventListener('click', e => {
    const b = e.target.closest('button'); if(!b || b.disabled) return;
    const i = +b.dataset.i;
    if(b.dataset.dd){ ultraNote = null; S.stops[i].d = Math.max(minDays(S.stops[i]), Math.min(30, S.stops[i].d + +b.dataset.dd)); paintStops(); paintPreview(); paintNav(); save();
      const again = $$('#plStops li')[i]?.querySelector(`[data-dd="${b.dataset.dd}"]`); if(again && !again.disabled) again.focus(); }
    else if(b.hasAttribute('data-up')) moveStop(i, -1);
    else if(b.hasAttribute('data-down')) moveStop(i, 1);
    else if(b.hasAttribute('data-rm')) removeStop(i);
  });
  $('#plBalance').addEventListener('click', balance);
  $('#plRouteField').addEventListener('click', e => {
    const t = e.target;
    if(t.closest('[data-ultra-undo]') && ultraNote){
      S.stops = ultraNote.undo.stops; S.days = ultraNote.undo.days; if('date' in ultraNote.undo) S.date = ultraNote.undo.date; $('#plDays').value = Math.min(45, Math.max(5, S.days));
      ultraNote = null; repaintAll(); save(); flash('Hemos dejado tu ruta como estaba.');
    } else if(t.closest('[data-ultra-shift]')){
      const u = ultraInfo(); if(!u) return;
      const undo = { stops: S.stops.map(x => ({ ...x })), days: S.days, date: S.date };
      const from = S.date;
      S.date = u.suggest;
      ultraNote = { text: `Salida movida del ${shortDate(from)} al ${shortDate(u.suggest)}: tus ciudades y tus días siguen igual.`, undo };
      repaintAll(); save(); flash('Viaje adaptado al Ultra Europe.'); burst($('#plUltra'), 40);
    } else if(t.closest('[data-sort]')){
      const undo = { stops: S.stops.map(x => ({ ...x })), days: S.days };
      const r = sortRoute();
      ultraNote = r.keepsDays ? { text: 'Ruta ordenada por cercanía: tus días no cambian.', undo } : { text: planNote(r), short: 'Ruta reordenada: menos horas de tren y Split a tiempo para el Ultra.', undo };
      repaintAll(); save(); flash('Ruta ordenada.');
    } else if(t.closest('[data-suggest]')){
      startSugg();
    } else if(t.closest('[data-sugg-apply]')){
      applySugg();
    } else if(t.closest('[data-sugg-close]')){
      sugg = null; suggT.forEach(clearTimeout); paintViab();
    } else if(t.closest('[data-viab-ignore]')){
      sugg = null; suggT.forEach(clearTimeout);
      S.viabIgnored = lastViabKey; save(); paintViab();
      flash('Vale, la dejamos así. La revisamos contigo al preparar el presupuesto.');
    } else if(t.closest('[data-viab-show]')){
      S.viabIgnored = ''; save(); paintViab();
    } else if(t.closest('[data-later]')){
      const undo = { stops: S.stops.map(x => ({ ...x })), days: S.days, date: S.date };
      S.date = t.closest('[data-later]').dataset.later;
      const sp = S.stops.find(isSplit); if(sp) sp.d = ULTRA.rec;
      S.days = Math.max(3, assigned()); $('#plDays').value = Math.min(45, Math.max(5, S.days));
      ultraNote = { text: `Sales el ${shortDate(S.date)} y te quedas 4 días en Split.`, undo };
      repaintAll(); save(); flash('Hecho: 4 días en Split.');
    } else if(t.closest('[data-ultra-fit]')){
      ultraNote = null; if(fitRoute()){ repaintAll(); save(); flash('Ruta adaptada al Ultra Europe.'); }
    } else if(t.closest('[data-ultra-date]')){
      S.date = t.closest('[data-ultra-date]').dataset.ultraDate; ultraNote = null; repaintAll(); save(); flash('Fecha puesta. La puedes cambiar en el paso 1.');
    } else if(t.closest('[data-fill]')){
      scrollToEl($('#plSearch')); $('#plSearch').focus({ preventScroll: true });
    }
  });
  $('#plFit').addEventListener('click', () => setDays(assigned()));

  $$('.pl-style input').forEach(i => i.addEventListener('change', () => {
    S.styles = $$('.pl-style input:checked').map(x => x.value); save();
  }));
  $('#plStay').addEventListener('click', e => { const b = e.target.closest('.pill'); if(!b) return; S.stay = b.dataset.v; paintStyle(); save(); });
  $('#plBudget').addEventListener('click', e => { const b = e.target.closest('button'); if(!b) return; S.budget = S.budget === b.dataset.v ? '' : b.dataset.v; paintStyle(); save(); });
  $('#plNotes').addEventListener('input', e => { S.notes = e.target.value; save(); });
  $('#plPromo').addEventListener('change', e => { S.promo = e.target.checked; save(); });
  ['plName', 'plPhone', 'plEmail'].forEach(id => $('#' + id).addEventListener('input', e => {
    const k = { plName: 'name', plPhone: 'phone', plEmail: 'email' }[id]; S[k] = e.target.value; save();
  }));

  form.addEventListener('input', () => { if(!$('#plError').hidden) hideError(); });
  form.addEventListener('change', () => { if(!$('#plError').hidden) hideError(); });
  form.addEventListener('submit', e => { e.preventDefault(); if(S.step < TOTAL_STEPS) go(S.step + 1); else send(); });
  $('#plBack').addEventListener('click', () => go(S.step - 1));
  const scrollToEl = el => { const y = el.getBoundingClientRect().top + window.scrollY - 76; window.scrollTo({ top: y, behavior: reduceMotion ? 'auto' : 'smooth' }); };
  $('#plPeek').addEventListener('click', () => scrollToEl($('#plSide')));
  $('#plBackEdit').addEventListener('click', () => scrollToEl($(`.pl-step[data-step="${S.step}"]`)));
  document.addEventListener('click', e => { const b = e.target.closest('[data-go]'); if(b && b.closest('#pl')) go(+b.dataset.go); });

  /* ---------------- init ---------------- */
  const IB_ICON_TRAIN = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="3" width="14" height="13" rx="3"/><path d="M5 10h14M9 20l-2 2M15 20l2 2M8.5 13h.01M15.5 13h.01"/></svg>';
  const IB_ICON_UP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 15l6-6 6 6"/></svg>';
  const IB_ICON_DOWN = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  const IB_ICON_X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';
  const IB_ICON_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
  const IB_ICON_CHAT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 01-12.3 7.4L3 21l2.1-5.6A8.5 8.5 0 1121 11.5z"/></svg>';

  const hadDraft = loadDraft();
  let add = '';
  try{ add = (new URLSearchParams(location.search).get('add') || '').slice(0, 50); }catch(e){}
  const fiesta = D.presets.find(p => p.hot);
  if(!hadDraft && !add && fiesta) loadPreset(fiesta);
  if(add && !S.stops.some(s => norm(s.n) === norm(add))) S.stops.push(mkStop(add, defaultDaysForNew()));
  if(!D.origins.some(o => o.n === S.origin) && S.origin !== '__otra') S.origin = 'Madrid';

  $('#plDays').value = Math.min(45, Math.max(5, S.days));
  $('#plPromo').checked = !!S.promo;
  paintOrigin(); paintDate(); paintTrav(); paintDuration(); paintPresets(); paintCities(); paintStops(); paintStyle(); paintPreview();
  const wantSend = location.hash === '#enviar';
  const startStep = wantSend ? 4 : (hadDraft && S.step > 1 && S.stops.length ? S.step : 1);
  S.step = 1; goRaw(1, { silent: true });
  if(startStep > 1) go(startStep, { silent: !wantSend });
  if(add) flash(`${add} añadida a tu ruta.`);
  else if(hadDraft && S.stops.length && !wantSend) flash('Hemos recuperado la ruta que estabas diseñando.');
  else if(!hadDraft && fiesta) flash(`Te hemos cargado «${fiesta.t}», la ruta más pedida. Cámbiala como quieras.`);

  if(IB.enabled){
    IB.getUser().then(u => { user = u; if(S.step === 4) paintSend(); paintNav(); });
    IB.sb.auth.onAuthStateChange((_e, sess) => { user = sess ? sess.user : null; if(S.step === 4) paintSend(); paintNav(); });
  }
})();
