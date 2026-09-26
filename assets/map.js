/* Iberail — mapa de ruta en SVG
   Capa de Europa (países reales, estilo mapa) cargada de Natural Earth vía jsDelivr
   + capa de ruta dibujada encima. Si el mapa base no carga, la ruta se ve igual. */
(function(){
  const NS = 'http://www.w3.org/2000/svg';
  const proj = (lon, lat) => [(lon + 11) * 13, (62 - lat) * 19];
  const FULL = [0, 0, 545, 500];
  const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-50m.json';
  const BBOX = [-32, 26, 58, 74];            // lon/lat que nos interesan (Europa + alrededores)

  /* Etiquetas en español: id ISO numérico -> [ISO2, nombre, lon, lat del texto] */
  const C = {
    '724':['ES','España',-3.6,40.2], '620':['PT','Portugal',-8.1,39.7], '250':['FR','Francia',2.4,46.6],
    '380':['IT','Italia',12.6,42.9], '276':['DE','Alemania',10.3,51.1], '528':['NL','P. Bajos',5.6,52.3],
    '056':['BE','Bélgica',4.6,50.6], '442':['LU','Lux.',6.1,49.8], '756':['CH','Suiza',8.2,46.8],
    '040':['AT','Austria',14.4,47.6], '203':['CZ','Chequia',15.4,49.8], '703':['SK','Eslovaquia',19.5,48.7],
    '616':['PL','Polonia',19.3,52.1], '348':['HU','Hungría',19.4,47.1], '705':['SI','Eslovenia',14.8,46.1],
    '191':['HR','Croacia',16.2,45.5], '070':['BA','Bosnia',17.8,44.2], '688':['RS','Serbia',20.8,44.0],
    '499':['ME','Montenegro',19.3,42.8], '807':['MK','Macedonia N.',21.7,41.6], '008':['AL','Albania',20.0,41.0],
    '300':['GR','Grecia',22.0,39.4], '100':['BG','Bulgaria',25.3,42.7], '642':['RO','Rumanía',24.9,45.9],
    '498':['MD','Moldavia',28.5,47.2], '804':['UA','Ucrania',31.2,49.0], '112':['BY','Bielorrusia',28.0,53.5],
    '440':['LT','Lituania',23.9,55.3], '428':['LV','Letonia',25.0,56.9], '233':['EE','Estonia',25.8,58.7],
    '246':['FI','Finlandia',26.2,63.0], '752':['SE','Suecia',15.5,60.5], '578':['NO','Noruega',9.5,61.5],
    '208':['DK','Dinamarca',9.3,56.0], '372':['IE','Irlanda',-8.0,53.2], '826':['GB','Reino Unido',-1.8,52.8],
    '352':['IS','Islandia',-18.6,64.9], '792':['TR','Turquía',33.0,39.2], '504':['MA','Marruecos',-6.2,32.2],
    '012':['DZ','Argelia',3.0,33.5], '788':['TN','Túnez',9.5,34.2], '643':['RU','Rusia',38.0,56.5]
  };
  const NAME_ID = { 'Kosovo': ['XK', 'Kosovo', 20.9, 42.6] };

  function smooth(pts){
    if(pts.length < 2) return '';
    let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
    for(let i = 0; i < pts.length - 1; i++){
      const p0 = pts[i - 1] || pts[i], p1 = pts[i], p2 = pts[i + 1], p3 = pts[i + 2] || p2;
      const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
      const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
      d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
    }
    return d;
  }
  const el = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for(const k in attrs) n.setAttribute(k, attrs[k]);
    if(parent) parent.appendChild(n);
    return n;
  };
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- TopoJSON -> caminos SVG (decodificador propio, sin librerías) ---------- */
  function decodeArcs(topo){
    const t = topo.transform;
    return topo.arcs.map(arc => {
      let x = 0, y = 0;
      return arc.map(p => {
        let lon, lat;
        if(t){ x += p[0]; y += p[1]; lon = x * t.scale[0] + t.translate[0]; lat = y * t.scale[1] + t.translate[1]; }
        else { lon = p[0]; lat = p[1]; }
        return [lon, lat];
      });
    });
  }
  function ringCoords(arcs, ids){
    const out = [];
    ids.forEach((id, j) => {
      const a = id < 0 ? arcs[~id].slice().reverse() : arcs[id];
      a.forEach((p, i) => { if(i === 0 && j > 0) return; out.push(p); });   // el primer punto repite el último del arco anterior
    });
    return out;
  }
  function ringPath(ring){
    let d = '', last = null, minLon = 999, maxLon = -999, minLat = 999, maxLat = -999;
    ring.forEach(([lon, lat]) => {
      if(lon < minLon) minLon = lon; if(lon > maxLon) maxLon = lon;
      if(lat < minLat) minLat = lat; if(lat > maxLat) maxLat = lat;
    });
    if(maxLon < BBOX[0] || minLon > BBOX[2] || maxLat < BBOX[1] || minLat > BBOX[3]) return '';
    ring.forEach(([lon, lat], i) => {
      const [x, y] = proj(lon, lat);
      if(last && i < ring.length - 1 && Math.abs(x - last[0]) + Math.abs(y - last[1]) < .35) return;
      d += (d ? 'L' : 'M') + x.toFixed(1) + ',' + y.toFixed(1);
      last = [x, y];
    });
    return d ? d + 'Z' : '';
  }
  function buildGeo(topo){
    const arcs = decodeArcs(topo);
    const obj = topo.objects.countries || topo.objects[Object.keys(topo.objects)[0]];
    const feats = [];
    obj.geometries.forEach(g => {
      let polys = g.type === 'Polygon' ? [g.arcs] : g.type === 'MultiPolygon' ? g.arcs : [];
      let d = '';
      polys.forEach(poly => poly.forEach(ring => { d += ringPath(ringCoords(arcs, ring)); }));
      if(!d) return;
      const name = g.properties && g.properties.name;
      const meta = C[String(g.id)] || NAME_ID[name] || null;
      feats.push({ d, cc: meta ? meta[0] : '', label: meta ? { t: meta[1], p: proj(meta[2], meta[3]) } : null });
    });
    return feats;
  }

  let geo = null, geoP = null;
  const waiting = new Set();
  function loadGeo(){
    if(geoP) return geoP;
    geoP = fetch(GEO_URL, { cache: 'force-cache' })
      .then(r => { if(!r.ok) throw new Error(r.status); return r.json(); })
      .then(topo => { geo = buildGeo(topo); waiting.forEach(svg => paintGeo(svg)); waiting.clear(); return geo; })
      .catch(() => { geo = null; waiting.clear(); return null; });
    return geoP;
  }

  function layers(svg){
    let g = svg.querySelector(':scope > .m-geo'), ov = svg.querySelector(':scope > .m-ov');
    if(!g){
      svg.innerHTML = '';
      g = el('g', { class: 'm-geo' }, svg);
      ov = el('g', { class: 'm-ov' }, svg);
    }
    return { g, ov };
  }
  function paintGeo(svg){
    const { g } = layers(svg);
    if(!geo || g.dataset.ready) return;
    const frag = document.createDocumentFragment();
    el('rect', { x: -800, y: -800, width: 2400, height: 2400, class: 'm-sea' }, frag);
    const land = el('g', { class: 'm-land' }, frag);
    geo.forEach(f => {
      const p = el('path', { d: f.d, class: 'm-country' }, land);
      if(f.cc) p.dataset.cc = f.cc;
    });
    const labels = el('g', { class: 'm-clabels' }, frag);
    geo.forEach(f => {
      if(!f.label) return;
      const t = el('text', { x: f.label.p[0], y: f.label.p[1], class: 'm-clabel', 'text-anchor': 'middle' }, labels);
      t.textContent = f.label.t;
      if(f.cc) t.dataset.cc = f.cc;
    });
    g.appendChild(frag);
    g.dataset.ready = '1';
    svg.classList.add('has-geo');
    if(svg._last) styleGeo(svg, svg._last.k, svg._last.ccs);
  }
  function styleGeo(svg, k, ccs){
    svg._last = { k, ccs };
    const g = svg.querySelector(':scope > .m-geo');
    if(!g || !g.dataset.ready) return;
    g.querySelectorAll('.m-country').forEach(p => p.classList.toggle('is-on', !!p.dataset.cc && ccs.has(p.dataset.cc)));
    const labels = Array.from(g.querySelectorAll('.m-clabel'));
    labels.forEach(t => {
      t.setAttribute('font-size', (9.6 * k).toFixed(2));
      t.classList.toggle('is-on', !!t.dataset.cc && ccs.has(t.dataset.cc));
    });
    // no tapar los nombres de ciudad: se esconde el nombre del país que choque
    let boxes = [];
    try{ boxes = Array.from(svg.querySelectorAll('.m-ov .m-lbl, .m-ov .m-dot')).map(n => n.getBBox()); }catch(e){}
    const pad = 3 * k;
    labels.forEach(t => {
      let hit = false;
      if(boxes.length){
        try{
          const b = t.getBBox();
          hit = boxes.some(o => b.x < o.x + o.width + pad && b.x + b.width + pad > o.x && b.y < o.y + o.height + pad && b.y + b.height + pad > o.y);
        }catch(e){}
      }
      t.classList.toggle('is-hidden', hit);
    });
  }

  function fitBox(pts){
    if(!pts.length) return FULL.slice();
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    pts.forEach(p => { x0 = Math.min(x0, p[0]); y0 = Math.min(y0, p[1]); x1 = Math.max(x1, p[0]); y1 = Math.max(y1, p[1]); });
    const pad = 46;
    let w = Math.max(x1 - x0 + pad * 2, 220), h = Math.max(y1 - y0 + pad * 2, 200);
    const ar = FULL[2] / FULL[3];
    if(w / h > ar) h = w / ar; else w = h * ar;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return [cx - w / 2, cy - h / 2, w, h];
  }

  function tweenViewBox(svg, to){
    const from = (svg.getAttribute('viewBox') || FULL.join(' ')).split(/\s+/).map(Number);
    if(reduce){ svg.setAttribute('viewBox', to.map(v => v.toFixed(1)).join(' ')); return; }
    const t0 = performance.now(), dur = 700;
    cancelAnimationFrame(svg._raf);
    const step = now => {
      const k = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      svg.setAttribute('viewBox', from.map((v, i) => (v + (to[i] - v) * e).toFixed(1)).join(' '));
      if(k < 1) svg._raf = requestAnimationFrame(step);
    };
    svg._raf = requestAnimationFrame(step);
  }

  /**
   * draw(svg, origin, stops, opts)
   * origin: {n, lon, lat} | null ; stops: [{n, lon, lat, cc}] (lon/lat pueden faltar en ciudades escritas a mano)
   */
  function draw(svg, origin, stops, opts){
    opts = opts || {};
    const data = window.IB_DATA || { cities: [], origins: [] };
    const { ov } = layers(svg);
    if(geo) paintGeo(svg); else { waiting.add(svg); loadGeo(); }
    ov.innerHTML = '';

    const placed = [];
    if(origin && origin.lon != null) placed.push({ n: origin.n, p: proj(origin.lon, origin.lat), o: true });
    stops.forEach((s, i) => { if(s.lon != null) placed.push({ n: s.n, p: proj(s.lon, s.lat), idx: i + 1 }); });
    const pts = placed.map(x => x.p);
    const box = fitBox(pts.length > 1 ? pts : (pts.length ? [pts[0]] : []));
    const k = box[2] / 545;          // tamaños relativos al zoom: los marcadores se ven siempre igual

    const ccs = new Set(stops.map(s => s.cc).filter(Boolean));
    const oc = origin && (origin.cc || (data.origins.some(o => o.n === origin.n) ? 'ES' : ''));
    if(oc) ccs.add(oc);

    const bg = el('g', { class: 'm-bg' }, ov);
    data.cities.forEach(c => {
      const [x, y] = proj(c.lon, c.lat);
      el('circle', { cx: x, cy: y, r: 2.1 * k, class: 'm-net' }, bg);
    });
    if(pts.length > 1){
      const d = smooth(pts);
      el('path', { d, class: 'm-route-shadow', 'stroke-width': 8 * k }, ov);
      const path = el('path', { d, class: 'm-route', 'stroke-width': 3.4 * k }, ov);
      if(!reduce && opts.animate !== false){
        const len = path.getTotalLength();
        path.style.strokeDasharray = len; path.style.strokeDashoffset = len;
        path.getBoundingClientRect();
        path.style.transition = 'stroke-dashoffset 1s cubic-bezier(.2,.7,.2,1)';
        path.style.strokeDashoffset = 0;
      }
      path.id = (svg.id || 'm') + '-route';
      if(!reduce && opts.train !== false){
        const tr = el('g', { class: 'm-train' }, ov);
        el('circle', { r: 6.5 * k, class: 'm-train-halo' }, tr);
        el('circle', { r: 4.2 * k, class: 'm-train-dot' }, tr);
        const am = el('animateMotion', { dur: Math.max(4, pts.length * 1.3) + 's', repeatCount: 'indefinite', begin: '1s' }, tr);
        el('mpath', { href: '#' + path.id }, am);
      }
    }
    placed.forEach((c, i) => {
      const [x, y] = c.p;
      const g = el('g', { class: 'm-city' + (c.o ? ' is-origin' : '') + (i === placed.length - 1 && placed.length > 1 ? ' is-end' : '') }, ov);
      g.style.setProperty('--d', (i * 70) + 'ms');
      if(i === placed.length - 1 && placed.length > 1 && !reduce) el('circle', { cx: x, cy: y, r: 9 * k, class: 'm-pulse' }, g);
      el('circle', { cx: x, cy: y, r: (c.o ? 8 : 9) * k, class: 'm-dot' }, g);
      const t = el('text', { x, y: y + 3.4 * k, class: 'm-num', 'font-size': 9.5 * k, 'text-anchor': 'middle' }, g);
      t.textContent = c.o ? '' : String(c.idx);
      const lbl = el('text', { x: x + 13 * k, y: y + 4 * k, class: 'm-lbl', 'font-size': 11 * k }, g);
      lbl.textContent = c.n.toUpperCase();
    });
    styleGeo(svg, k, ccs);
    if(opts.zoom === false) svg.setAttribute('viewBox', box.map(v => v.toFixed(1)).join(' '));
    else tweenViewBox(svg, box);
    return placed.length;
  }

  /* ---------- reconocer una ciudad escrita de cualquier forma ----------
     «Austria, Viena», «Viena (Austria)», «Vienna», «Amsterdam» sin tilde… → la ciudad de la lista */
  const nrm = x => String(x || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const ALIAS = { vienna: 'Viena', wien: 'Viena', prague: 'Praga', praha: 'Praga', munich: 'Múnich', munchen: 'Múnich', muenchen: 'Múnich',
    venice: 'Venecia', venezia: 'Venecia', florence: 'Florencia', firenze: 'Florencia', rome: 'Roma', naples: 'Nápoles', napoli: 'Nápoles',
    milan: 'Milán', milano: 'Milán', lisbon: 'Lisboa', porto: 'Oporto', brussels: 'Bruselas', bruxelles: 'Bruselas', brussel: 'Bruselas',
    bruges: 'Brujas', brugge: 'Brujas', rotterdam: 'Róterdam', copenhagen: 'Copenhague', kobenhavn: 'Copenhague', stockholm: 'Estocolmo',
    warsaw: 'Varsovia', warszawa: 'Varsovia', krakow: 'Cracovia', cracow: 'Cracovia', athens: 'Atenas', athina: 'Atenas', thessaloniki: 'Salónica',
    belgrade: 'Belgrado', beograd: 'Belgrado', bucharest: 'Bucarest', bucuresti: 'Bucarest', ljubljana: 'Liubliana', cologne: 'Colonia', koln: 'Colonia',
    nice: 'Niza', marseille: 'Marsella', bordeaux: 'Burdeos', london: 'Londres', edinburgh: 'Edimburgo', hamburg: 'Hamburgo', salzburg: 'Salzburgo',
    luxembourg: 'Luxemburgo', tallinn: 'Tallin', vilnius: 'Vilna', skopje: 'Skopie', zurich: 'Zúrich' };
  let IDX = null;
  function city(name){
    if(!IDX){ IDX = {}; const d = window.IB_DATA || { cities: [], origins: [] }; d.cities.concat(d.origins).forEach(c => { IDX[nrm(c.n)] = c; }); Object.keys(ALIAS).forEach(k => { if(!IDX[k]) IDX[k] = IDX[nrm(ALIAS[k])]; }); }
    const n = nrm(name); if(!n) return null;
    if(IDX[n]) return IDX[n];
    const clean = n.replace(/[()]/g, ',');
    const parts = clean.split(/\s*[,/|·;]\s*|\s+[-–—]\s+/).map(x => x.trim()).filter(Boolean);
    for(const p of parts.slice().reverse()) if(IDX[p]) return IDX[p];
    const w = clean.replace(/[,/|·;]/g, ' ').split(/\s+/).filter(Boolean);
    for(let len = Math.min(3, w.length); len > 0; len--) for(let i = w.length - len; i >= 0; i--){ const k = w.slice(i, i + len).join(' '); if(IDX[k]) return IDX[k]; }
    return null;
  }

  window.IBMap = { draw, proj, city, _buildGeo: buildGeo };
})();
