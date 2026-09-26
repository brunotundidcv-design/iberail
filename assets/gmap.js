/* Iberail — mapa interactivo de la ruta del grupo
   Mapa de Europa (IBMap) + tramos en arco con flechas, tiempo de cada tramo, un tren que recorre la ruta
   y ficha de cada tramo / ciudad al tocarla. Se pinta cuando entra en pantalla. */
(function(){
  const D = window.IB_DATA || { cities: [], origins: [], rail: [], countries: {}, flags: {} };
  const NS = 'http://www.w3.org/2000/svg';
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const byName = {};
  D.cities.concat(D.origins).forEach(c => { byName[norm(c.n)] = c; });
  D.origins.forEach(c => { byName[norm(c.n)].cc = byName[norm(c.n)].cc || 'ES'; });

  /* ---------- tiempos de cada tramo (mismos datos que el planificador) ---------- */
  const SPEED = { oeste: 120, med: 100, centro: 90, norte: 90, balticos: 55, balcanes: 50 };
  const SLOW = { atenas: 50, salonica: 50, estambul: 45, dublin: 50 };
  const NO_RAIL = new Set((D.noRail || []).map(norm));
  const RAIL = {};
  (D.rail || []).forEach(([a, b, h, m, n]) => { RAIL[norm(a) + '|' + norm(b)] = RAIL[norm(b) + '|' + norm(a)] = { h, mode: m, night: !!n, known: true }; });
  const km = (a, b) => {
    const R = 6371, r = Math.PI / 180, dLat = (b.lat - a.lat) * r, dLon = (b.lon - a.lon) * r;
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  };
  function legOf(a, b, first){
    const d = km(a, b);
    if(first) return { mode: 'avion', h: d / 750 + .6, km: d, known: false, night: false };
    const r = RAIL[norm(a.n) + '|' + norm(b.n)];
    if(r) return { ...r, km: d * 1.2 };
    const bus = NO_RAIL.has(norm(a.n)) || NO_RAIL.has(norm(b.n));
    const sp = bus ? 60 : ((SLOW[norm(a.n)] || SPEED[a.r] || 80) + (SLOW[norm(b.n)] || SPEED[b.r] || 80)) / 2;
    return { mode: bus ? 'bus' : 'tren', h: d * 1.2 / sp + 1, km: d * 1.2, known: false, night: false };
  }
  const fmtH = (h, known) => {
    const m = Math.max(10, Math.round(h * 6) * 10), H = Math.floor(m / 60), M = m % 60;
    return (known ? '' : '≈') + (H ? `${H} h${M ? ' ' + M : ''}` : `${M} min`);
  };
  const shortH = (h, known) => { const r = Math.round(h * 2) / 2; return (known ? '' : '≈') + (h < 1 ? Math.round(h * 60) + '′' : String(r).replace('.5', ',5') + ' h'); };
  const MODE = { tren: 'Tren', avion: 'Avión', bus: 'Autobús', ferry: 'Ferri', 'tren+ferry': 'Tren y ferri' };
  const IC = {
    tren: '<rect x="5" y="3" width="14" height="14" rx="3"/><path d="M5 10.5h14M8 21l1.5-3.5M16 21l-1.5-3.5"/><circle cx="9" cy="13.8" r=".9"/><circle cx="15" cy="13.8" r=".9"/>',
    avion: '<path d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 00-3 0V8.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z"/>',
    bus: '<rect x="4" y="3" width="16" height="15" rx="3"/><path d="M4 11h16M7.5 21v-3M16.5 21v-3"/><circle cx="8" cy="14.5" r=".9"/><circle cx="16" cy="14.5" r=".9"/>',
    ferry: '<path d="M3 18c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0M5 14.5L6.5 9h11l1.5 5.5M9 9V5h6v4"/>'
  };
  const icon = (m, cls) => `<svg class="${cls || ''}" viewBox="0 0 24 24" aria-hidden="true">${IC[m === 'tren+ferry' ? 'ferry' : m] || IC.tren}</svg>`;
  const flag = cc => D.flags && D.flags[cc] ? `<i class="gm-flag" style="background:${esc(D.flags[cc])}" aria-hidden="true"></i>` : '';
  const country = cc => (D.countries && D.countries[cc]) || '';
  const fday = d => d.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', '');

  /* ---------- modelo de la ruta ---------- */
  function model(r){
    const raw = [{ n: r.salida, d: 0, origin: true }].concat((r.paradas || []).map(p => ({ n: p.ciudad, d: +p.dias || 0 })));
    const start = r.fecha_salida ? new Date(r.fecha_salida + 'T12:00:00') : null;
    let day = 0;
    const cities = [];
    raw.forEach((s, i) => {
      const g = byName[norm(s.n)] || (IBMap.city && IBMap.city(s.n));
      const from = start ? new Date(start.getTime() + day * 864e5) : null;
      if(i > 0) day += s.d;
      const to = start && i > 0 ? new Date(start.getTime() + day * 864e5) : null;
      if(!g) return;                                   // ciudad escrita a mano sin coordenadas: no se dibuja
      cities.push({ n: g.n, lon: g.lon, lat: g.lat, cc: g.cc || '', r: g.r, dias: s.d, origin: !!s.origin, from, to, p: IBMap.proj(g.lon, g.lat) });
    });
    const legs = [];
    for(let i = 1; i < cities.length; i++) legs.push({ i: legs.length, a: cities[i - 1], b: cities[i], ...legOf(cities[i - 1], cities[i], cities[i - 1].origin) });
    return { cities, legs };
  }

  const svgEl = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for(const k in attrs) n.setAttribute(k, attrs[k]); if(parent) parent.appendChild(n); return n; };
  const bez = (a, c, b, t) => [(1 - t) * (1 - t) * a[0] + 2 * (1 - t) * t * c[0] + t * t * b[0], (1 - t) * (1 - t) * a[1] + 2 * (1 - t) * t * c[1] + t * t * b[1]];
  const tan = (a, c, b, t) => [2 * (1 - t) * (c[0] - a[0]) + 2 * t * (b[0] - c[0]), 2 * (1 - t) * (c[1] - a[1]) + 2 * t * (b[1] - c[1])];

  /* ---------- montar un mapa ----------
     Los tramos van en coordenadas del mapa; ciudades, flechas, etiquetas y el tren se dibujan en píxeles
     (scale(s)), así al hacer zoom se ven siempre del mismo tamaño y se pueden leer. */
  const Z = { in: '<path d="M12 5v14M5 12h14"/>', out: '<path d="M5 12h14"/>', fit: '<path d="M4 9V5a1 1 0 011-1h4M15 4h4a1 1 0 011 1v4M20 15v4a1 1 0 01-1 1h-4M9 20H5a1 1 0 01-1-1v-4"/><circle cx="12" cy="12" r="2.5"/>' };
  function mount(host, route){
    const M = model(route);
    if(M.cities.length < 2 || !window.IBMap){ host.hidden = true; return null; }
    const trainH = M.legs.filter(l => l.mode !== 'avion').reduce((a, l) => a + l.h, 0);
    const kmT = M.legs.reduce((a, l) => a + l.km, 0);
    const ccs = [...new Set(M.cities.filter(c => !c.origin).map(c => c.cc).filter(Boolean))];
    const touch = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    host.innerHTML = `
      <div class="gm-stage">
        <svg class="gm-svg" role="img" aria-label="Mapa de la ruta: ${esc(M.cities.map(c => c.n).join(', '))}"></svg>
        <div class="gm-zoom" role="group" aria-label="Zoom del mapa">
          <button type="button" data-gm-zoom="in" aria-label="Acercar"><svg viewBox="0 0 24 24" aria-hidden="true">${Z.in}</svg></button>
          <button type="button" data-gm-zoom="out" aria-label="Alejar"><svg viewBox="0 0 24 24" aria-hidden="true">${Z.out}</svg></button>
          <button type="button" data-gm-zoom="fit" aria-label="Ver toda la ruta"><svg viewBox="0 0 24 24" aria-hidden="true">${Z.fit}</svg></button>
        </div>
        <button type="button" class="gm-play" data-gm-play>${reduce ? '' : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z"/></svg>'}<span>Recorrer la ruta</span></button>
        <div class="gm-legend" aria-hidden="true"><span><i class="is-tren"></i>Tren</span>${M.legs.some(l => l.mode === 'avion') ? '<span><i class="is-avion"></i>Avión</span>' : ''}${M.legs.some(l => l.mode === 'bus') ? '<span><i class="is-bus"></i>Bus</span>' : ''}${M.legs.some(l => /ferry/.test(l.mode)) ? '<span><i class="is-ferry"></i>Ferri</span>' : ''}</div>
        <p class="gm-tip" aria-hidden="true">${touch ? 'Pellizca para acercar · arrastra para moverte' : 'Rueda del ratón para acercar · arrastra para moverte'}</p>
      </div>
      <div class="gm-sheet">
        <button type="button" class="gm-handle" data-gm-sheet aria-label="Mostrar u ocultar los detalles"><i></i></button>
        <div class="gm-info" aria-live="polite"></div>
        <ol class="gm-legs">${M.legs.map(l => `<li><button type="button" data-gm-leg="${l.i}" class="gm-leg is-${esc(l.mode.replace('+', '-'))}">
          <span class="gm-leg-ic">${icon(l.mode)}</span>
          <span class="gm-leg-t"><b>${esc(l.a.n)} → ${esc(l.b.n)}</b><small>${esc(MODE[l.mode] || 'Tren')} · ${fmtH(l.h, l.known)}${l.night ? ' · nocturno' : ''}</small></span>
        </button></li>`).join('')}</ol>
      </div>`;
    const svg = host.querySelector('.gm-svg'), stage = host.querySelector('.gm-stage'), info = host.querySelector('.gm-info'), sheet = host.querySelector('.gm-sheet');
    const st = { sel: null, city: null, leg: 0, t: 0, pause: 0, mode: 'idle', raf: 0, last: 0, vis: false, s: 1, drawn: false,
      view: null, cw: 0, ch: 0, cam: 0, drag: 0, userCam: false };

    /* ---------- fichas ---------- */
    function summary(){
      const kmR = Math.round(kmT / 50) * 50;
      info.innerHTML = `<div class="gm-sum">
        <div><b>${M.cities.length - 1}</b><span>${M.cities.length - 1 === 1 ? 'parada' : 'paradas'}</span></div>
        <div><b>${ccs.length}</b><span>${ccs.length === 1 ? 'país' : 'países'}</span></div>
        <div><b>${trainH ? shortH(trainH, false) : '—'}</b><span>en tren y bus</span></div>
        <div><b>≈${kmR >= 1000 ? (Math.round(kmT / 100) / 10).toString().replace('.', ',') + ' mil' : kmR}</b><span>km de viaje</span></div>
      </div><p class="gm-hint">Toca un tramo o una ciudad para ver cuánto se tarda.</p>`;
    }
    const nav = i => `<div class="gm-nav"><button type="button" data-gm-step="-1"${i <= 0 ? ' disabled' : ''} aria-label="Tramo anterior"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg></button><span>${i + 1} / ${M.legs.length}</span><button type="button" data-gm-step="1"${i >= M.legs.length - 1 ? ' disabled' : ''} aria-label="Tramo siguiente"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6l6 6-6 6"/></svg></button></div>`;
    function legInfo(l){
      const days = l.b.dias ? `${l.b.dias} ${l.b.dias === 1 ? 'día' : 'días'} en ${esc(l.b.n)}` : '';
      const when = l.a.origin ? (l.a.from ? fday(l.a.from) : '') : (l.a.to ? fday(l.a.to) : '');
      info.innerHTML = `<div class="gm-card is-${esc(l.mode.replace('+', '-'))}">
        <span class="gm-card-ic">${icon(l.mode)}</span>
        <div class="gm-card-main">
          <small>Tramo ${l.i + 1} de ${M.legs.length}${when ? ` · ${when}` : ''}</small>
          <b>${flag(l.a.cc)}${esc(l.a.n)} <span class="gm-arrow">→</span> ${flag(l.b.cc)}${esc(l.b.n)}</b>
          <p>${l.a.cc && l.b.cc && l.a.cc !== l.b.cc ? `${esc(country(l.a.cc))} → ${esc(country(l.b.cc))} · ` : ''}${esc(MODE[l.mode] || 'Tren')} · ≈${Math.round(l.km / 10) * 10} km${days ? ' · ' + days : ''}</p>
          ${l.night ? '<em class="gm-night">Hay tren nocturno: duermes mientras viajas</em>' : ''}${l.mode === 'avion' ? '<em class="gm-night">Primer tramo en avión desde España</em>' : ''}
        </div>
        <span class="gm-card-h"><b>${fmtH(l.h, l.known)}</b><small>${l.known ? 'de viaje' : 'aprox.'}</small></span>
      </div>${nav(l.i)}`;
    }
    function cityInfo(c){
      const idx = M.cities.indexOf(c), prev = M.legs[idx - 1], next = M.legs[idx];
      info.innerHTML = `<div class="gm-card is-city">
        <span class="gm-card-ic gm-num">${c.origin ? icon('avion') : idx}</span>
        <div class="gm-card-main">
          <small>${c.origin ? 'Salida' : `Parada ${idx} de ${M.cities.length - 1}`}${c.from && !c.origin ? ` · ${fday(c.from)}${c.to && c.dias ? ` – ${fday(c.to)}` : ''}` : c.from ? ` · ${fday(c.from)}` : ''}</small>
          <b>${flag(c.cc)}${esc(c.n)}</b>
          <p>${esc(country(c.cc))}${c.dias ? ` · ${c.dias} ${c.dias === 1 ? 'día' : 'días'}` : ''}${prev ? ` · llegas en ${esc((MODE[prev.mode] || 'tren').toLowerCase())} (${fmtH(prev.h, prev.known)})` : ''}${next && !c.origin ? ` · luego ${esc(next.b.n)}, ${fmtH(next.h, next.known)}` : ''}</p>
        </div>
        ${c.dias ? `<span class="gm-card-h"><b>${c.dias}</b><small>${c.dias === 1 ? 'día' : 'días'}</small></span>` : ''}
      </div>`;
    }

    /* ---------- encuadres ---------- */
    // lo que tapan la cabecera y el panel de abajo cuando el mapa ocupa toda la pantalla
    function insets(){
      const r = stage.getBoundingClientRect(), out = { t: 56, b: 46, l: 16, r: 60 };
      const gmx = host.closest('.gmx');
      if(gmx && getComputedStyle(stage).position === 'absolute'){
        const hd = gmx.querySelector('.gmx-head'); if(hd) out.t = Math.max(out.t, hd.getBoundingClientRect().bottom - r.top + 18);
        const sr = sheet.getBoundingClientRect(); if(sr.height) out.b = Math.max(out.b, r.bottom - sr.top + 64);
        out.l = 22; out.r = 58;
      }
      return out;
    }
    function viewFor(pts, minW){
      const cw = st.cw, ch = st.ch, I = insets();
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
      const aw = Math.max(80, cw - I.l - I.r - (cw < 500 ? 96 : 150)), ah = Math.max(80, ch - I.t - I.b - 20);   // sitio para los nombres
      let s = Math.max((x1 - x0) / aw, (y1 - y0) / ah, (minW || 70) / cw);
      const W = cw * s, H = ch * s;
      const cx = (x0 + x1) / 2 - ((I.l - I.r) / 2) * s, cy = (y0 + y1) / 2 - ((I.t - I.b) / 2) * s;
      return clampV({ x: cx - W / 2, y: cy - H / 2, w: W, h: H });
    }
    const allPts = () => {
      let list = M.cities;
      const bb = l => { const xs = l.map(c => c.p[0]), ys = l.map(c => c.p[1]); return (Math.max(40, Math.max(...xs) - Math.min(...xs))) * (Math.max(40, Math.max(...ys) - Math.min(...ys))); };
      if(M.cities.length > 2 && bb(M.cities) > bb(M.cities.slice(1)) * 2.2) list = M.cities.slice(1);   // España muy lejos: el vuelo entra por el borde
      return list.map(c => c.p);
    };
    const fitView = () => viewFor(allPts(), 90);
    const legView = i => { const E = legEls[i]; return viewFor([E.a, E.b, E.c], st.cw < 500 ? 120 : 240); };
    const cityView = i => viewFor([M.cities[i].p], Math.max(70, Math.min(st.view.w, fitW * .5)));
    function clampV(v){
      const minW = 40, maxW = 1100;
      const k = v.w < minW ? minW / v.w : v.w > maxW ? maxW / v.w : 1;
      if(k !== 1){ const cx = v.x + v.w / 2, cy = v.y + v.h / 2; v = { w: v.w * k, h: v.h * k, x: cx - v.w * k / 2, y: cy - v.h * k / 2 }; }
      const cx = Math.max(-260, Math.min(820, v.x + v.w / 2)), cy = Math.max(-200, Math.min(760, v.y + v.h / 2));
      return { x: cx - v.w / 2, y: cy - v.h / 2, w: v.w, h: v.h };
    }

    /* ---------- vista: se aplica en cada fotograma del zoom ---------- */
    let scal = [];   // elementos con tamaño fijo en pantalla: {el, x, y, a}
    function applyView(v){
      st.view = v; st.s = v.w / st.cw;
      svg.setAttribute('viewBox', `${v.x.toFixed(2)} ${v.y.toFixed(2)} ${v.w.toFixed(2)} ${v.h.toFixed(2)}`);
      const s = st.s.toFixed(4);
      for(const o of scal) o.el.setAttribute('transform', `translate(${o.x.toFixed(2)},${o.y.toFixed(2)})${o.a ? ` rotate(${o.a.toFixed(1)})` : ''} scale(${s})`);
      const f = (10.5 * st.s).toFixed(2), r = (2 * st.s).toFixed(2);
      svg.querySelectorAll('.m-clabel').forEach(t => t.setAttribute('font-size', f));
      svg.querySelectorAll('.m-net').forEach(c => c.setAttribute('r', r));
      placeTrain();
      host.classList.toggle('is-zoomed', v.w < fitW * .8);
      // mientras se mueve la cámara, los nombres se recolocan de vez en cuando
      const now = performance.now(); if(now - lastDc > 140){ lastDc = now; declutter(); }
    }
    let lastDc = 0;
    let fitW = 1, dT = 0;
    const settle = () => { clearTimeout(dT); dT = setTimeout(declutter, 90); };
    const ease = t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
    function flyTo(to, dur){
      cancelAnimationFrame(st.cam);
      const from = st.view;
      if(!from || reduce || !dur){ applyView(to); settle(); return; }
      const t0 = performance.now();
      const step = now => {
        const k = Math.min(1, (now - t0) / dur), e = ease(k);
        // en vuelos largos se aleja un poco a mitad de camino (como un avión)
        const dist = Math.hypot((to.x + to.w / 2) - (from.x + from.w / 2), (to.y + to.h / 2) - (from.y + from.h / 2));
        const hop = 1 + Math.min(.6, dist / Math.max(from.w, to.w) * .5) * Math.sin(Math.PI * e);
        const w = (from.w + (to.w - from.w) * e) * hop, h = w * st.ch / st.cw;
        const cx = from.x + from.w / 2 + ((to.x + to.w / 2) - (from.x + from.w / 2)) * e, cy = from.y + from.h / 2 + ((to.y + to.h / 2) - (from.y + from.h / 2)) * e;
        applyView({ x: cx - w / 2, y: cy - h / 2, w, h });
        if(k < 1) st.cam = requestAnimationFrame(step); else { st.cam = 0; applyView(to); settle(); }
      };
      st.cam = requestAnimationFrame(step);
    }
    function zoomAt(k, px, py, dur){
      const v = st.view, r = stage.getBoundingClientRect();
      const ux = v.x + (px - r.left) * st.s, uy = v.y + (py - r.top) * st.s;
      const w = v.w * k, h = v.h * k;
      const to = clampV({ x: ux - (px - r.left) * (w / st.cw), y: uy - (py - r.top) * (h / st.ch), w, h });
      st.userCam = true;
      if(dur) flyTo(to, dur); else { applyView(to); settle(); }
    }

    /* ---------- dibujo ---------- */
    let train, trainIc, legEls = [], cityEls = [];
    function draw(){
      const cw = stage.clientWidth, ch = stage.clientHeight;
      if(!cw || !ch) return false;
      const keep = st.drawn && st.userCam && st.view ? { cx: st.view.x + st.view.w / 2, cy: st.view.y + st.view.h / 2, s: st.s } : null;
      st.cw = cw; st.ch = ch;
      const origin = M.cities[0];
      IBMap.draw(svg, { n: origin.n, lon: origin.lon, lat: origin.lat, cc: origin.cc }, M.cities.slice(1).map(c => ({ n: c.n, lon: c.lon, lat: c.lat, cc: c.cc })), { zoom: false, train: false, animate: false });
      svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
      const ov = svg.querySelector('.m-ov');
      ov.querySelectorAll('.gm-layer').forEach(n => n.remove());
      const root = svgEl('g', { class: 'gm-layer' }, ov);
      const legG = svgEl('g', { class: 'gm-legs-g' }, root), decoG = svgEl('g', { class: 'gm-deco' }, root);
      scal = [];
      legEls = M.legs.map(l => {
        const a = l.a.p, b = l.b.p, dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy) || 1;
        let nx = -dy / len, ny = dx / len; if(ny > 0){ nx = -nx; ny = -ny; }        // los arcos se curvan hacia arriba
        const bow = len * (l.mode === 'avion' ? .2 : .1);
        const c = [(a[0] + b[0]) / 2 + nx * bow, (a[1] + b[1]) / 2 + ny * bow];
        const d = `M${a[0].toFixed(2)},${a[1].toFixed(2)} Q${c[0].toFixed(2)},${c[1].toFixed(2)} ${b[0].toFixed(2)},${b[1].toFixed(2)}`;
        const g = svgEl('g', { class: `gm-leg-g is-${l.mode.replace('+', '-')}`, 'data-gm-leg': l.i }, legG);
        svgEl('path', { d, class: 'gm-casing' }, g);
        const path = svgEl('path', { d, class: 'gm-line' }, g);
        svgEl('path', { d, class: 'gm-hit' }, g);
        // flechas y etiqueta con el tiempo (tamaño fijo en pantalla)
        const dg = svgEl('g', { class: `gm-leg-d is-${l.mode.replace('+', '-')}`, 'data-gm-leg': l.i }, decoG);
        const arrows = [];
        [.3, .7].forEach(t => {
          const p = bez(a, c, b, t), tg = tan(a, c, b, t);
          const el = svgEl('g', { class: 'gm-arw' }, dg);
          svgEl('path', { d: 'M-4.5,-5 L4,0 L-4.5,5', class: 'gm-arrowhead' }, el);
          const o = { el, x: p[0], y: p[1], a: Math.atan2(tg[1], tg[0]) * 180 / Math.PI }; scal.push(o); arrows.push(o);
        });
        const m = bez(a, c, b, .5), txt = fmtH(l.h, l.known);
        const pill = svgEl('g', { class: 'gm-pill' }, dg);
        const pw = txt.length * 7 + 30, ph = 21;
        svgEl('rect', { x: -pw / 2, y: -ph / 2, width: pw, height: ph, rx: ph / 2 }, pill);
        const ic = svgEl('g', { transform: `translate(${-pw / 2 + 5},-7) scale(.58)`, class: 'gm-pill-ic' }, pill);
        ic.innerHTML = IC[l.mode === 'tren+ferry' ? 'ferry' : l.mode] || IC.tren;
        const t = svgEl('text', { x: 9, y: 4.4, 'font-size': 12.5, 'text-anchor': 'middle' }, pill);
        t.textContent = txt;
        scal.push({ el: pill, x: m[0], y: m[1] });
        return { g, dg, path, pill, arrows, a, b, c, len: path.getTotalLength() };
      });
      // ciudades
      const cityG = svgEl('g', { class: 'gm-cities' }, root);
      cityEls = M.cities.map((c, i) => {
        const [x, y] = c.p, last = i === M.cities.length - 1;
        const g = svgEl('g', { class: 'gm-city' + (c.origin ? ' is-origin' : '') + (last ? ' is-end' : ''), 'data-gm-city': i }, cityG);
        const inner = svgEl('g', { class: 'gm-city-in' }, g);
        inner.style.setProperty('--d', (i * 90) + 'ms');
        if(last && !reduce) svgEl('circle', { r: 11, class: 'gm-pulse' }, inner);
        svgEl('circle', { r: 20, class: 'gm-city-hit' }, inner);
        svgEl('circle', { r: c.origin ? 8.5 : 11, class: 'gm-dot' }, inner);
        const num = svgEl('text', { y: 4, 'font-size': 11, 'text-anchor': 'middle', class: 'gm-n' }, inner);
        num.textContent = c.origin ? '' : String(i);
        const lbl = svgEl('text', { x: 16, y: 4.5, 'font-size': 13, 'text-anchor': 'start', class: 'gm-lbl' }, inner);
        lbl.textContent = c.n.toUpperCase();
        if(c.dias){ const dd = svgEl('tspan', { class: 'gm-lbl-d', 'font-size': 10.5, dx: 5 }, lbl); dd.textContent = `${c.dias}d`; }
        scal.push({ el: g, x, y });
        return { g, lbl, dot: inner.querySelector('.gm-dot') };
      });
      // el tren
      train = svgEl('g', { class: 'gm-train' }, root);
      const tin = svgEl('g', {}, train);
      svgEl('circle', { r: 19, class: 'gm-train-halo' }, tin);
      svgEl('circle', { r: 13.5, class: 'gm-train-body' }, tin);
      trainIc = svgEl('g', { transform: 'translate(-9,-9) scale(.75)', class: 'gm-train-ic' }, tin);
      st.drawn = true;
      const f = fitView(); fitW = f.w;
      if(keep){ const w = st.cw * keep.s, h = st.ch * keep.s; applyView(clampV({ x: keep.cx - w / 2, y: keep.cy - h / 2, w, h })); }
      else applyView(st.sel != null ? legView(st.sel) : f);
      if(st.sel != null){ legEls[st.sel].g.classList.add('is-sel'); legEls[st.sel].dg.classList.add('is-sel'); }
      declutter();
      setTimeout(declutter, 90 * M.cities.length + 520);     // cuando terminan de aparecer los puntos
      return true;
    }
    // que nada se pise: nombres de ciudad a un lado u otro (o solo el número), tiempos y países que choquen se ocultan
    function declutter(){
      if(!st.drawn) return;
      const R = stage.getBoundingClientRect(), I = insets();
      const safe = { l: R.left + 4, r: R.right - 4, t: R.top + (getComputedStyle(stage).position === 'absolute' ? I.t - 14 : 4), b: R.bottom - (getComputedStyle(stage).position === 'absolute' ? I.b - 56 : 4) };
      const boxes = [];
      const over = (b, o, p) => b.left < o.right + p && b.right + p > o.left && b.top < o.bottom + p && b.bottom + p > o.top;
      const inSafe = b => b.left >= safe.l && b.right <= safe.r && b.top >= safe.t && b.bottom <= safe.b;
      cityEls.forEach(c => boxes.push(c.dot.getBoundingClientRect()));
      const order = cityEls.map((c, i) => i).sort((a, b) => (b === st.city) - (a === st.city) || (b === cityEls.length - 1) - (a === cityEls.length - 1) || a - b);
      order.forEach(i => {
        const c = cityEls[i], own = boxes[i];
        const put = (left, dy) => { c.lbl.setAttribute('x', left ? -16 : 16); c.lbl.setAttribute('y', 4.5 + dy); c.lbl.setAttribute('text-anchor', left ? 'end' : 'start'); return c.lbl.getBoundingClientRect(); };
        const pref = own.left + 120 > safe.r;
        const tries = [[pref, 0], [!pref, 0], [pref, -15], [!pref, -15], [pref, 17], [!pref, 17]];
        let ok = null;
        c.lbl.classList.remove('is-hidden');
        for(const [l, dy] of tries){ const b = put(l, dy); if(inSafe(b) && !boxes.some(o => o !== own && over(b, o, 2))){ ok = b; break; } }
        if(!ok && i === st.city){ ok = put(pref, 0); }
        c.lbl.classList.toggle('is-hidden', !ok);
        if(ok) boxes.push(ok);
      });
      legEls.forEach((l, i) => {
        if(i === st.sel){ l.pill.classList.remove('is-hidden'); boxes.push(l.pill.getBoundingClientRect()); return; }
        l.pill.classList.remove('is-hidden');
        const b = l.pill.getBoundingClientRect(), hide = !inSafe(b) || boxes.some(o => over(b, o, 3));
        l.pill.classList.toggle('is-hidden', hide); if(!hide) boxes.push(b);
      });
      svg.querySelectorAll('.m-clabel').forEach(t => { t.classList.remove('is-hidden'); const b = t.getBoundingClientRect(); t.classList.toggle('is-hidden', !b.width || boxes.some(o => over(b, o, 4))); });
    }

    /* ---------- el tren ---------- */
    function setIcon(mode){ if(trainIc && trainIc.dataset.m !== mode){ trainIc.dataset.m = mode; trainIc.innerHTML = IC[mode === 'tren+ferry' ? 'ferry' : mode] || IC.tren; train.setAttribute('class', `gm-train is-${mode.replace('+', '-')}`); } }
    function placeTrain(){
      if(!st.drawn || !legEls.length || !train) return;
      const L = M.legs[st.leg], E = legEls[st.leg];
      const p = E.path.getPointAtLength(Math.max(0, Math.min(1, st.t)) * E.len);
      train.setAttribute('transform', `translate(${p.x.toFixed(2)},${p.y.toFixed(2)}) scale(${st.s.toFixed(4)})`);
      setIcon(L.mode);
    }
    function frame(now){
      st.raf = 0;
      if(!st.vis || document.hidden || !st.drawn){ st.last = 0; return; }
      const dt = st.last ? Math.min(.05, (now - st.last) / 1000) : 0; st.last = now;
      if(st.pause > 0) st.pause -= dt;
      else {
        // en el recorrido cada tramo dura lo mismo (la cámara se acerca); suelto, va a velocidad de pantalla
        const E = legEls[st.leg], pxLen = E.len / st.s;
        st.t += st.mode === 'tour' ? dt / 2.2 : st.mode === 'one' ? dt / 1.8 : dt * 70 / Math.max(60, pxLen);
        if(st.t >= 1){
          st.t = 1;
          if(st.mode === 'one'){ placeTrain(); st.mode = 'stop'; return; }
          if(st.leg < M.legs.length - 1){ st.leg++; st.t = 0; st.pause = st.mode === 'tour' ? 1 : .5; if(st.mode === 'tour') select(st.leg, true); }
          else if(st.mode === 'tour'){ placeTrain(); endTour(); return; }
          else { st.leg = 0; st.t = 0; st.pause = 1.6; }
        }
      }
      placeTrain();
      loop();
    }
    const loop = () => { if(!reduce && !st.raf && st.mode !== 'stop') st.raf = requestAnimationFrame(frame); };
    function endTour(){
      st.mode = 'stop'; host.querySelector('[data-gm-play] span').textContent = 'Otra vez'; host.classList.remove('is-touring');
      select(null, true); const last = M.cities.length - 1; st.city = last; cityInfo(M.cities[last]); markCity(last);
      st.userCam = false; flyTo(fitView(), 1100);
    }

    /* ---------- interacción ---------- */
    function markCity(i){ cityEls.forEach((c, k) => c.g.classList.toggle('is-sel', k === i)); }
    function select(i, fromTour){
      st.sel = i;
      host.classList.toggle('has-sel', i != null);
      legEls.forEach((l, k) => { l.g.classList.toggle('is-sel', k === i); l.dg.classList.toggle('is-sel', k === i); });
      host.querySelectorAll('.gm-leg').forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.gmLeg === i)));
      st.city = null; markCity(null);
      if(i == null){ summary(); if(!fromTour){ if(st.mode === 'stop'){ st.mode = 'idle'; loop(); } st.userCam = false; flyTo(fitView(), 800); } return; }
      legInfo(M.legs[i]);
      sheet.classList.remove('is-min');
      const chip = host.querySelector(`.gm-leg[data-gm-leg="${i}"]`), ol = host.querySelector('.gm-legs');
      if(chip && ol.scrollWidth > ol.clientWidth) ol.scrollTo({ left: chip.parentNode.offsetLeft - 12, behavior: reduce ? 'auto' : 'smooth' });
      if(!fromTour) st.userCam = false;
      if(!fromTour || !st.userCam) flyTo(legView(i), fromTour ? 1000 : 750);     // si el usuario ha movido el mapa, el recorrido no le quita la cámara
      if(!fromTour){
        host.classList.remove('is-touring'); host.querySelector('[data-gm-play] span').textContent = 'Recorrer la ruta';
        st.leg = i; st.t = 0; st.pause = .5; st.mode = reduce ? 'stop' : 'one';
        if(reduce) st.t = .5;
        placeTrain(); loop();
      }
    }
    function pickCity(i){
      select(null, true); st.city = i; cityInfo(M.cities[i]); markCity(i); sheet.classList.remove('is-min');
      host.classList.remove('is-touring'); if(st.mode === 'tour'){ st.mode = 'stop'; host.querySelector('[data-gm-play] span').textContent = 'Recorrer la ruta'; }
      flyTo(cityView(i), 750);
    }
    host.addEventListener('pointerdown', () => { st.touched = true; }, true);
    host.addEventListener('click', e => {
      if(Date.now() - st.drag < 350) return;                       // era un arrastre, no un toque
      const z = e.target.closest('[data-gm-zoom]');
      if(z){ const r = stage.getBoundingClientRect(), I = insets(), cx = r.left + (r.width + I.l - I.r) / 2, cy = r.top + (r.height + I.t - I.b) / 2;
        if(z.dataset.gmZoom === 'fit'){ st.userCam = false; flyTo(fitView(), 700); } else zoomAt(z.dataset.gmZoom === 'in' ? .5 : 2, cx, cy, 380); hideTip(); return; }
      const stp = e.target.closest('[data-gm-step]'); if(stp){ const n = (st.sel == null ? -1 : st.sel) + +stp.dataset.gmStep; if(n >= 0 && n < M.legs.length) select(n); return; }
      if(e.target.closest('[data-gm-sheet]')){ sheet.classList.toggle('is-min'); setTimeout(reframe, 330); return; }
      const lg = e.target.closest('[data-gm-leg]');
      if(lg){ const i = +lg.getAttribute('data-gm-leg'); select(st.sel === i && lg.tagName === 'BUTTON' ? null : i); return; }
      const ct = e.target.closest('[data-gm-city]');
      if(ct){ pickCity(+ct.getAttribute('data-gm-city')); return; }
      if(e.target.closest('[data-gm-play]')){
        host.querySelector('[data-gm-play] span').textContent = 'Recorriendo…';
        host.classList.add('is-touring'); sheet.classList.remove('is-min');
        st.leg = 0; st.t = 0; st.pause = .9; st.mode = reduce ? 'stop' : 'tour';
        select(0, true);
        if(reduce) host.querySelector('[data-gm-play] span').textContent = 'Recorrer la ruta';
        placeTrain(); loop(); return;
      }
    });

    /* ---------- gestos: arrastrar, pellizcar, rueda y doble toque ---------- */
    const P = new Map();
    let g0 = null, lastTap = 0, lastTapXY = null;
    const tip = host.querySelector('.gm-tip');
    function hideTip(){ tip.classList.add('is-gone'); }
    function startGesture(){
      const pts = [...P.values()];
      g0 = { v: { ...st.view }, s: st.s, pts: pts.map(p => ({ ...p })), moved: false };
      if(pts.length === 2){ g0.d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y); g0.m = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 }; }
    }
    svg.addEventListener('pointerdown', e => {
      if(e.button > 0 || !st.drawn) return;
      P.set(e.pointerId, { x: e.clientX, y: e.clientY });
      try{ svg.setPointerCapture(e.pointerId); }catch(_){}
      cancelAnimationFrame(st.cam); st.cam = 0;
      startGesture();
    });
    svg.addEventListener('pointermove', e => {
      if(!P.has(e.pointerId) || !g0) return;
      P.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const pts = [...P.values()], r = stage.getBoundingClientRect();
      if(pts.length === 1 && g0.pts.length === 1){
        const dx = pts[0].x - g0.pts[0].x, dy = pts[0].y - g0.pts[0].y;
        if(!g0.moved && Math.hypot(dx, dy) < 6) return;
        g0.moved = true; host.classList.add('is-dragging');
        applyView(clampV({ ...g0.v, x: g0.v.x - dx * g0.s, y: g0.v.y - dy * g0.s }));
      } else if(pts.length === 2 && g0.d){
        g0.moved = true;
        const d = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), m = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
        const k = g0.d / Math.max(10, d), w = Math.max(40, Math.min(1100, g0.v.w * k)), s2 = w / st.cw;
        const ux = g0.v.x + (g0.m.x - r.left) * g0.s, uy = g0.v.y + (g0.m.y - r.top) * g0.s;
        applyView(clampV({ x: ux - (m.x - r.left) * s2, y: uy - (m.y - r.top) * s2, w, h: w * st.ch / st.cw }));
      }
      if(g0.moved){ st.userCam = true; hideTip(); }
    });
    const endP = e => {
      if(!P.has(e.pointerId)) return;
      const was = g0; P.delete(e.pointerId);
      if(was && was.moved){ st.drag = Date.now(); settle(); }
      else if(e.type === 'pointerup' && P.size === 0 && e.pointerType !== 'mouse'){
        // doble toque: acercar ahí
        const now = Date.now();
        if(now - lastTap < 320 && lastTapXY && Math.hypot(e.clientX - lastTapXY.x, e.clientY - lastTapXY.y) < 30){ lastTap = 0; zoomAt(.5, e.clientX, e.clientY, 320); st.drag = Date.now(); hideTip(); }
        else { lastTap = now; lastTapXY = { x: e.clientX, y: e.clientY }; }
      }
      host.classList.remove('is-dragging');
      if(P.size){ startGesture(); } else g0 = null;
    };
    svg.addEventListener('pointerup', endP); svg.addEventListener('pointercancel', endP); svg.addEventListener('lostpointercapture', endP);
    svg.addEventListener('dblclick', e => { e.preventDefault(); zoomAt(.5, e.clientX, e.clientY, 320); hideTip(); });
    svg.addEventListener('wheel', e => { if(!st.drawn) return; e.preventDefault(); cancelAnimationFrame(st.cam); st.cam = 0; zoomAt(Math.exp(Math.max(-1, Math.min(1, e.deltaY * (e.deltaMode ? 30 : 1) * .0022))), e.clientX, e.clientY, 0); hideTip(); }, { passive: false });
    // toque en el mapa vacío: vuelve al resumen
    svg.addEventListener('click', e => { if(Date.now() - st.drag < 350) return; if(!e.target.closest('.gm-layer') && !host.classList.contains('is-touring') && (st.sel != null || st.city != null)) select(null); });
    // deslizar la ficha a los lados: tramo anterior / siguiente
    let sw = null;
    info.addEventListener('pointerdown', e => { sw = { x: e.clientX, y: e.clientY }; });
    info.addEventListener('pointerup', e => { if(!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null; if(Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.5){ const n = (st.sel == null ? (dx < 0 ? -1 : 1) : st.sel) + (dx < 0 ? 1 : -1); if(n >= 0 && n < M.legs.length) select(n); } });
    // arrastrar el asa del panel hacia abajo / arriba
    let sh = null;
    const handle = host.querySelector('.gm-handle');
    handle.addEventListener('pointerdown', e => { sh = e.clientY; });
    handle.addEventListener('pointerup', e => { if(sh == null) return; const dy = e.clientY - sh; sh = null; if(Math.abs(dy) > 24){ sheet.classList.toggle('is-min', dy > 0); st.drag = Date.now(); setTimeout(reframe, 330); } });

    // al plegar o desplegar el panel, se vuelve a encuadrar lo que se estaba mirando
    function reframe(){ if(!st.drawn) return; if(st.userCam){ settle(); return; } flyTo(st.sel != null ? legView(st.sel) : st.city != null ? cityView(st.city) : fitView(), 450); }

    /* ---------- solo trabaja cuando se ve ---------- */
    summary();
    const tryDraw = () => { if(!st.drawn && draw()) loop(); };
    let rt = 0;
    const ro = window.ResizeObserver ? new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(() => {
      if(!stage.clientWidth) return;
      if(!st.drawn || Math.abs(stage.clientWidth - st.cw) > 4 || Math.abs(stage.clientHeight - st.ch) > 4){ st.drawn = false; tryDraw(); }
    }, 120); }) : null;
    if(ro) ro.observe(stage);
    // el alto del panel de abajo (en móvil tapa el mapa): los botones se colocan encima
    const sro = window.ResizeObserver ? new ResizeObserver(() => { host.style.setProperty('--gm-sheet', sheet.offsetHeight + 'px'); }) : null;
    if(sro) sro.observe(sheet);
    const io = window.IntersectionObserver ? new IntersectionObserver(es => { st.vis = es.some(x => x.isIntersecting); if(st.vis){ tryDraw(); loop(); } }, { rootMargin: '80px' }) : null;
    if(io) io.observe(stage); else { st.vis = true; setTimeout(tryDraw, 50); }
    // cuando el mapa base (países) termina de cargar, se recoloca todo encima
    const mo = new MutationObserver(() => { if(svg.classList.contains('has-geo') && st.drawn){ mo.disconnect(); st.drawn = false; tryDraw(); } });
    mo.observe(svg, { attributes: true, attributeFilter: ['class'] });
    const onVis = () => { if(!document.hidden) loop(); };
    document.addEventListener('visibilitychange', onVis);
    setTimeout(hideTip, 5000);
    return {
      host,
      tour(){ const b = host.querySelector('[data-gm-play]'); if(b && !reduce && !st.touched) b.click(); },   // solo si aún no ha tocado nada
      destroy(){ st.mode = 'stop'; cancelAnimationFrame(st.raf); cancelAnimationFrame(st.cam); if(ro) ro.disconnect(); if(sro) sro.disconnect(); if(io) io.disconnect(); mo.disconnect(); document.removeEventListener('visibilitychange', onVis); }
    };
  }

  /* ---------- botón llamativo con un dibujo de la ruta ---------- */
  function sketch(M){
    const pts = M.cities.map(c => c.p), W = 120, H = 76, P = 12;
    const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const k = Math.min((W - 2 * P) / Math.max(1, x1 - x0), (H - 2 * P) / Math.max(1, y1 - y0));
    const ox = (W - (x1 - x0) * k) / 2, oy = (H - (y1 - y0) * k) / 2;
    const q = pts.map(p => [(p[0] - x0) * k + ox, (p[1] - y0) * k + oy].map(v => +v.toFixed(1)));
    const d = 'M' + q.map(p => p.join(',')).join(' L');
    const segs = M.legs.map((l, i) => `<path d="M${q[i].join(',')} L${q[i + 1].join(',')}" class="gmb-seg${l.mode === 'avion' ? ' is-air' : ''}"/>`).join('');
    const dots = q.map((p, i) => `<circle cx="${p[0]}" cy="${p[1]}" r="${i === 0 ? 3 : i === q.length - 1 ? 4.2 : 3.2}" class="gmb-dot${i === 0 ? ' is-start' : i === q.length - 1 ? ' is-end' : ''}"/>`).join('');
    const train = reduce ? '' : `<g class="gmb-train"><circle r="5.5"/><animateMotion dur="${Math.max(3.5, M.legs.length * 1.2)}s" repeatCount="indefinite" path="${d}"/></g>`;
    return `<svg class="gmb-sk" viewBox="0 0 ${W} ${H}" aria-hidden="true"><path d="${d}" class="gmb-glow"/>${segs}${dots}${train}</svg>`;
  }
  function button(route){
    let M; try{ M = model(route); }catch(e){ return ''; }
    if(M.cities.length < 2) return '';
    const trainH = M.legs.filter(l => l.mode !== 'avion').reduce((a, l) => a + l.h, 0);
    const ccs = new Set(M.cities.filter(c => !c.origin).map(c => c.cc).filter(Boolean));
    const last = M.cities[M.cities.length - 1];
    return `<button type="button" class="gmb" data-gm-open="${esc(route.id)}">
      <span class="gmb-art">${sketch(M)}</span>
      <span class="gmb-txt">
        <small><i></i>Mapa interactivo</small>
        <b>Ver la ruta en el mapa</b>
        <span>${esc(M.cities[0].n)} → ${esc(last.n)} · ${ccs.size} ${ccs.size === 1 ? 'país' : 'países'}${trainH ? ` · ${shortH(trainH, false)} de tren` : ''}</span>
      </span>
      <span class="gmb-go" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
    </button>`;
  }

  /* ---------- ventana con el mapa a pantalla completa ---------- */
  let openBox = null;
  function close(fromPop){
    if(!openBox) return;
    const { box, map, back, pushed } = openBox; openBox = null;
    map && map.destroy();
    box.classList.remove('is-in');
    document.documentElement.classList.remove('gmx-lock');
    setTimeout(() => box.remove(), 260);
    if(back && back.focus) try{ back.focus({ preventScroll: true }); }catch(e){}
    if(pushed && !fromPop) try{ history.back(); }catch(e){}
  }
  addEventListener('popstate', () => { if(openBox) close(true); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && openBox) close(); });
  function open(route, title, extra){
    if(openBox) close();
    const M = model(route);
    if(M.cities.length < 2) return;
    const box = document.createElement('div');
    box.className = 'gmx';
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Mapa de la ruta');
    box.innerHTML = `<div class="gmx-back" data-gmx-close></div>
      <div class="gmx-panel">
        <header class="gmx-head">
          <span class="gmx-ic">${icon('tren')}</span>
          <div><small>${esc(title || 'Vuestra ruta')}</small><b>${esc(M.cities.map(c => c.n).join(' → '))}</b></div>
          ${extra || ''}
          <button type="button" class="gmx-x" data-gmx-close aria-label="Cerrar el mapa"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
        </header>
        <div class="gm gmx-body"></div>
      </div>`;
    document.body.appendChild(box);
    document.documentElement.classList.add('gmx-lock');
    const map = mount(box.querySelector('.gmx-body'), route);
    let pushed = false;
    try{ history.pushState({ gmx: 1 }, ''); pushed = true; }catch(e){}
    openBox = { box, map, back: document.activeElement, pushed };
    box.addEventListener('click', e => { if(e.target.closest('[data-gmx-close]')) close(); });
    requestAnimationFrame(() => { box.classList.add('is-in'); const x = box.querySelector('.gmx-x'); if(x) x.focus({ preventScroll: true }); });
    // al abrir, el tren hace el recorrido solo
    setTimeout(() => { if(openBox && openBox.map === map && map) map.tour(); }, 900);
  }

  window.IBGroupMap = { mount, model, button, open, close };
})();
