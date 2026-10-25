/* Iberail — «Órbita»: Europa en 3D en la portada (WebGL, sin librerías).
   La red de trenes del planificador (IB_DATA: ciudades y tramos) como un holograma inclinado: España delante,
   el norte al fondo. Trenes de luz de ciudad en ciudad, un pulso de radar que sale de Madrid y, cuando tocas ciudades
   en «Toca las ciudades», tu ruta en arcos de luz (tema.js llama a window.IBRed.ruta([origen, paradas…])).
   Va con defer en el <head>, después de data.js y antes de tema.js. Si el navegador no tiene WebGL, quita
   data-orbita de la cabecera y tema.js pinta la red plana de siempre.
   Se para cuando no se ve; con «reducir movimiento» se queda quieto. */
(function(){
  'use strict';
  var host = document.querySelector('[data-orbita]');
  if(!host) return;
  var D = window.IB_DATA;
  var cv = document.createElement('canvas');
  var gl = null;
  try{ gl = cv.getContext('webgl', { alpha: true, antialias: true, premultipliedAlpha: false }) || cv.getContext('experimental-webgl'); }catch(e){ gl = null; }
  if(!gl || !D || !D.cities){ host.removeAttribute('data-orbita'); return; }

  var quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  cv.className = 'v16-orbita'; cv.setAttribute('aria-hidden', 'true');
  host.insertBefore(cv, host.firstChild);
  var capa = document.createElement('div'); capa.className = 'v16-olbl'; capa.setAttribute('aria-hidden', 'true');
  host.insertBefore(capa, cv.nextSibling);

  /* ---------- datos: ciudades y vías ---------- */
  var C = {};
  (D.origins || []).concat(D.cities || []).forEach(function(c){ if(c.lon != null) C[c.n] = c; });
  var ESP = [['Madrid','Barcelona'],['Madrid','Zaragoza'],['Zaragoza','Barcelona'],['Madrid','Valencia'],['Valencia','Barcelona'],['Madrid','Sevilla'],
    ['Madrid','Málaga'],['Sevilla','Málaga'],['Madrid','Bilbao'],['Bilbao','San Sebastián'],['San Sebastián','Burdeos'],['Barcelona','Marsella'],['Lisboa','Oporto'],['Madrid','Lisboa']];
  var esEsp = {}; (D.origins || []).forEach(function(o){ esEsp[o.n] = 1; });
  var aristas = [], visto = {}, vecinos = {};
  (D.rail || []).map(function(r){ return [r[0], r[1], r[4]]; }).concat(ESP.map(function(e){ return [e[0], e[1], 0]; })).forEach(function(e){
    var a = C[e[0]], b = C[e[1]]; if(!a || !b) return;
    var k = [a.n, b.n].sort().join('|'); if(visto[k]) return; visto[k] = 1;
    aristas.push([a.n, b.n, e[2] ? 1 : 0]);
    (vecinos[a.n] = vecinos[a.n] || []).push(b.n); (vecinos[b.n] = vecinos[b.n] || []).push(a.n);
  });
  var nombres = Object.keys(C);
  var ROTULOS = ['Madrid','Lisboa','Barcelona','París','Londres','Ámsterdam','Berlín','Praga','Viena','Budapest','Roma','Split','Copenhague','Estambul','Atenas'];
  var POP = {}; (D.popular || []).forEach(function(n){ POP[n] = 1; });

  // proyección: plano XZ (y = altura). Norte hacia el fondo (-z), España delante (+z)
  var LON0 = 10, LAT0 = 47.5, K0 = Math.cos(LAT0 * Math.PI / 180), ESC = .118;
  var P = {};
  nombres.forEach(function(n){ var c = C[n]; P[n] = [(c.lon - LON0) * K0 * ESC, 0, (LAT0 - c.lat) * ESC]; });

  /* ---------- WebGL ---------- */
  function sh(tipo, src){ var s = gl.createShader(tipo); gl.shaderSource(s, src); gl.compileShader(s); return s; }
  function prog(vs, fs){
    var p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs)); gl.linkProgram(p);
    if(!gl.getProgramParameter(p, gl.LINK_STATUS)) return null;
    return p;
  }
  var VS_L = 'attribute vec3 p;attribute vec4 c;uniform mat4 m;varying vec4 v;varying float f;' +
    'void main(){vec4 q=m*vec4(p,1.0);gl_Position=q;v=c;f=clamp(1.45-(q.w-4.2)/3.6,.28,1.0);}';
  var FS_L = 'precision mediump float;varying vec4 v;varying float f;void main(){gl_FragColor=vec4(v.rgb,v.a*f);}';
  var VS_P = 'attribute vec3 p;attribute vec4 c;attribute vec2 s;uniform mat4 m;uniform float px;varying vec4 v;varying float k;varying float f;' +
    'void main(){vec4 q=m*vec4(p,1.0);gl_Position=q;gl_PointSize=max(1.0,s.x*px*(5.0/q.w));v=c;k=s.y;f=clamp(1.45-(q.w-4.2)/3.6,.35,1.0);}';
  var FS_P = 'precision mediump float;varying vec4 v;varying float k;varying float f;' +
    'void main(){vec2 u=gl_PointCoord*2.0-1.0;float r=dot(u,u);if(r>1.0)discard;float a;' +
    'if(k>1.5){a=smoothstep(.22,.0,abs(sqrt(r)-.78))*.9;}' +
    'else if(k>.5){a=exp(-r*5.0);}' +
    'else{a=smoothstep(.30,.0,r)+exp(-r*3.2)*.55;}' +
    'gl_FragColor=vec4(v.rgb,v.a*a*f);}';
  var pL = prog(VS_L, FS_L), pP = prog(VS_P, FS_P);
  if(!pL || !pP){ cv.remove(); capa.remove(); host.removeAttribute('data-orbita'); return; }
  var aL = { p: gl.getAttribLocation(pL, 'p'), c: gl.getAttribLocation(pL, 'c'), m: gl.getUniformLocation(pL, 'm') };
  var aP = { p: gl.getAttribLocation(pP, 'p'), c: gl.getAttribLocation(pP, 'c'), s: gl.getAttribLocation(pP, 's'), m: gl.getUniformLocation(pP, 'm'), px: gl.getUniformLocation(pP, 'px') };
  var bufL = gl.createBuffer(), bufP = gl.createBuffer();

  /* ---------- matrices (columna a columna, como las quiere WebGL) ---------- */
  function persp(fov, asp, n, f){ var t = 1 / Math.tan(fov / 2), nf = 1 / (n - f);
    return [t / asp,0,0,0, 0,t,0,0, 0,0,(f + n) * nf,-1, 0,0,2 * f * n * nf,0]; }
  function mira(e, c, u){
    var z0 = e[0] - c[0], z1 = e[1] - c[1], z2 = e[2] - c[2], l = Math.hypot(z0, z1, z2); z0 /= l; z1 /= l; z2 /= l;
    var x0 = u[1] * z2 - u[2] * z1, x1 = u[2] * z0 - u[0] * z2, x2 = u[0] * z1 - u[1] * z0; l = Math.hypot(x0, x1, x2); x0 /= l; x1 /= l; x2 /= l;
    var y0 = z1 * x2 - z2 * x1, y1 = z2 * x0 - z0 * x2, y2 = z0 * x1 - z1 * x0;
    return [x0,y0,z0,0, x1,y1,z1,0, x2,y2,z2,0, -(x0 * e[0] + x1 * e[1] + x2 * e[2]),-(y0 * e[0] + y1 * e[1] + y2 * e[2]),-(z0 * e[0] + z1 * e[1] + z2 * e[2]),1];
  }
  function mul(a, b){ var o = new Array(16);
    for(var i = 0; i < 4; i++) for(var j = 0; j < 4; j++){ var s = 0; for(var k = 0; k < 4; k++) s += a[k * 4 + j] * b[i * 4 + k]; o[i * 4 + j] = s; }
    return o; }

  /* ---------- escena fija ---------- */
  var COL = { sol: [1, .72, .11], lava: [1, .35, .21], neon: [1, .18, .53], plasma: [.55, .36, 1], ion: [.2, .88, 1], blanco: [.86, .9, 1] };
  var TRENES = [COL.sol, COL.lava, COL.neon, COL.plasma, COL.ion, COL.ion, COL.sol];
  var fijasL = [], fijasP = [];
  function L(arr, a, b, ca, cb){ arr.push(a[0], a[1], a[2], ca[0], ca[1], ca[2], ca[3], b[0], b[1], b[2], cb[0], cb[1], cb[2], cb[3]); }
  function Pt(arr, p, c, s, k){ arr.push(p[0], p[1], p[2], c[0], c[1], c[2], c[3], s, k); }
  // rejilla (meridianos y paralelos)
  for(var lon = -12; lon <= 32; lon += 4){ var x = (lon - LON0) * K0 * ESC; L(fijasL, [x, -.001, (LAT0 - 34) * ESC], [x, -.001, (LAT0 - 64) * ESC], [.55, .36, 1, .07], [.55, .36, 1, .02]); }
  for(var lat = 34; lat <= 64; lat += 3){ var z = (LAT0 - lat) * ESC; L(fijasL, [(-12 - LON0) * K0 * ESC, -.001, z], [(32 - LON0) * K0 * ESC, -.001, z], [.55, .36, 1, .02], [.55, .36, 1, .06]); }
  // suelo holográfico: rejilla de puntos
  for(var gx = -12; gx <= 33; gx += 1.15) for(var gz = 34; gz <= 64; gz += .82){
    Pt(fijasP, [(gx - LON0) * K0 * ESC, -.002, (LAT0 - gz) * ESC], [.55, .4, 1, .16], 1.7, 1);
  }
  // vías
  aristas.forEach(function(e){
    var a = P[e[0]], b = P[e[1]], esp = esEsp[e[0]] && esEsp[e[1]];
    var c = esp ? [1, .72, .11, .75] : e[2] ? [.62, .45, 1, .62] : [.45, .8, 1, .5];
    L(fijasL, a, b, c, c);
  });
  // columnas de luz sobre las ciudades principales
  ROTULOS.forEach(function(n){ var p = P[n]; if(!p) return; var h = n === 'Madrid' ? .34 : POP[n] ? .2 : .12;
    var c = esEsp[n] ? COL.sol : n === 'Split' ? COL.neon : COL.plasma;
    L(fijasL, p, [p[0], h, p[2]], [c[0], c[1], c[2], .55], [c[0], c[1], c[2], 0]); });
  // ciudades
  nombres.forEach(function(n){
    var p = P[n], c, s;
    if(n === 'Madrid'){ c = [1, .42, .24, 1]; s = 9; }
    else if(esEsp[n]){ c = [1, .74, .2, 1]; s = 6; }
    else if(n === 'Split'){ c = [1, .3, .6, 1]; s = 8; }
    else if(POP[n]){ c = [.78, .92, 1, 1]; s = 6; }
    else { c = [.7, .8, 1, .85]; s = 4; }
    Pt(fijasP, p, c, s, 0);
  });
  // estrellas al fondo
  var semilla = 7; var rnd = function(){ semilla = (semilla * 16807) % 2147483647; return semilla / 2147483647; };
  for(var i = 0; i < 260; i++){
    var ang = rnd() * Math.PI * 2, rad = 6 + rnd() * 5, alt = .4 + rnd() * 4.2;
    Pt(fijasP, [Math.cos(ang) * rad * .9, alt, -Math.abs(Math.sin(ang)) * rad - 2], [1, 1, 1, .15 + rnd() * .45], 1 + rnd() * 1.4, 1);
  }

  /* ---------- trenes de luz ---------- */
  var conVias = Object.keys(vecinos);
  function nuevo(desde){
    var a = desde || conVias[Math.floor(Math.random() * conVias.length)], vs = vecinos[a];
    var b = vs[Math.floor(Math.random() * vs.length)], A = P[a], B = P[b];
    var largo = Math.hypot(B[0] - A[0], B[2] - A[2]) || .01;
    return { a: a, b: b, t: 0, v: (.16 + Math.random() * .2) / largo, largo: largo, c: TRENES[Math.floor(Math.random() * TRENES.length)] };
  }
  var NT = innerWidth < 700 ? 16 : 30, trenes = [];
  for(var t = 0; t < NT; t++){ var tr = nuevo(); tr.t = Math.random(); trenes.push(tr); }
  var pulsos = [];

  /* ---------- tu ruta ---------- */
  var ruta = null, rutaT0 = 0;
  function arco(A, B, sube, n){
    var pts = [], mx = (A[0] + B[0]) / 2, mz = (A[2] + B[2]) / 2, d = Math.hypot(B[0] - A[0], B[2] - A[2]), h = sube * d + .03;
    for(var i = 0; i <= n; i++){ var u = i / n, w = 1 - u;
      pts.push([w * w * A[0] + 2 * w * u * mx + u * u * B[0], 2 * w * u * h, w * w * A[2] + 2 * w * u * mz + u * u * B[2]]); }
    return pts;
  }
  function ponRuta(lista){
    lista = (lista || []).filter(function(n){ return P[n]; });
    if(lista.length < 2){ ruta = lista.length ? { nodos: lista, pts: [], tramos: [] } : null; rutaT0 = ahora(); pintaRotulos(); pintaInfo(); if(quieto) frame(0); return; }
    var pts = [], tramos = [];
    for(var j = 1; j < lista.length; j++){
      var A = P[lista[j - 1]], B = P[lista[j]], avion = j === 1;
      var d = Math.hypot(B[0] - A[0], B[2] - A[2]), n = Math.max(12, Math.round(d / .018));
      var ar = arco(A, B, avion ? .42 : .22, n);
      tramos.push({ ini: pts.length, fin: pts.length + ar.length, avion: avion });
      ar.forEach(function(p){ pts.push(p); });
    }
    ruta = { nodos: lista, pts: pts, tramos: tramos };
    rutaT0 = ahora(); pintaRotulos(); pintaInfo(); if(quieto) frame(0);
  }
  // «modo ruta»: con una ruta en el mapa, el título se aparta (v16.css · .v16-hero.is-ruta)
  function modoRuta(){ host.classList.toggle('is-ruta', !!(ruta && ruta.nodos.length > 1)); }
  // texto del visor: la red entera o tu ruta
  var info = document.querySelector('[data-orbita-info]');
  function pintaInfo(){
    modoRuta();
    if(!info) return;
    var n = ruta ? ruta.nodos.length - 1 : 0;
    info.textContent = n > 0 ? 'Tu ruta · ' + n + (n === 1 ? ' parada' : ' paradas') + ' · desde ' + ruta.nodos[0]
      : 'Red Iberail · ' + nombres.length + ' ciudades · ' + aristas.length + ' tramos';
  }
  pintaInfo();
  window.IBRed = window.IBRed || {};
  // tema.js crea IBRed al arrancar: se engancha cuando ya ha terminado
  document.addEventListener('DOMContentLoaded', function(){ window.IBRed = window.IBRed || {}; window.IBRed.ruta = ponRuta; });

  /* ---------- rótulos (HTML encima del lienzo) ---------- */
  var rotulos = {};
  function rotulo(n){
    if(rotulos[n]) return rotulos[n];
    var el = document.createElement('span'); el.className = 'v16-ol'; el.textContent = n; capa.appendChild(el);
    return (rotulos[n] = el);
  }
  function pintaRotulos(){
    var mios = ruta ? ruta.nodos : [];
    var quiero = {}; (innerWidth < 700 ? ['Madrid','París','Berlín','Roma','Split'] : ROTULOS).forEach(function(n){ quiero[n] = 1; }); mios.forEach(function(n){ quiero[n] = 1; });
    Object.keys(rotulos).forEach(function(n){ if(!quiero[n]){ rotulos[n].remove(); delete rotulos[n]; } });
    Object.keys(quiero).forEach(function(n){ var el = rotulo(n); el.classList.toggle('is-mine', mios.indexOf(n) > 0); el.classList.toggle('is-o', mios[0] === n); });
  }
  pintaRotulos();

  /* ---------- cámara ---------- */
  var W = 1, H = 1, DPR = 1, MAT = null;
  var raton = { x: 0, y: 0 }, suave = { x: 0, y: 0 };
  // zona del título: los rótulos que caen detrás se atenúan para no ensuciar el texto
  var titulo = host.querySelector('.v16-hero-mid'), tapa = null;
  function mideTapa(){
    if(!titulo) return;
    var a = host.getBoundingClientRect(), b = titulo.getBoundingClientRect();
    tapa = [b.left - a.left - 24, b.top - a.top - 12, b.right - a.left + 24, b.bottom - a.top + 12];
  }
  function mide(){
    var r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
    DPR = Math.min(window.devicePixelRatio || 1, innerWidth < 700 ? 1.5 : 1.75);
    cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
    gl.viewport(0, 0, cv.width, cv.height);
    mideTapa();
  }
  addEventListener('load', mideTapa);
  // la cámara vuela hacia tu ruta: se centra en ella y se acerca (y vuelve a toda Europa si la borras)
  var vuelo = { x: null, z: null, d: null, o: null };
  function destino(movil){
    var base = { x: movil ? .2 : .12, z: movil ? -.1 : -.12, d: movil ? 5.2 : 4.35 };
    if(!ruta || ruta.nodos.length < 2) return base;
    var xs = ruta.nodos.map(function(n){ return P[n][0]; }), zs = ruta.nodos.map(function(n){ return P[n][2]; });
    var mx = (Math.min.apply(0, xs) + Math.max.apply(0, xs)) / 2, mz = (Math.min.apply(0, zs) + Math.max.apply(0, zs)) / 2;
    var ext = Math.max(Math.max.apply(0, xs) - Math.min.apply(0, xs), (Math.max.apply(0, zs) - Math.min.apply(0, zs)) * 1.3);
    return { x: mx, z: mz, d: Math.max(movil ? 4 : 3.3, Math.min(base.d, (movil ? 3.2 : 2.5) + ext * (movil ? 1.4 : 1.2))) };
  }
  function camara(tt){
    var movil = W < 1021, obj = destino(movil);
    // con ruta, el mapa sube un poco para quedar entre el título y el mando
    var alto = movil ? .34 : (ruta && ruta.nodos.length > 1 ? .1 : -.06);
    if(vuelo.x === null || quieto){ vuelo.x = obj.x; vuelo.z = obj.z; vuelo.d = obj.d; vuelo.o = alto; }
    else { var k = .035; vuelo.x += (obj.x - vuelo.x) * k; vuelo.z += (obj.z - vuelo.z) * k; vuelo.d += (obj.d - vuelo.d) * k; vuelo.o += (alto - vuelo.o) * k; }
    var giro = (quieto ? 0 : Math.sin(tt / 18000) * .2) + suave.x * .14;
    var incl = (movil ? .92 : .8) + suave.y * .05;
    var dist = vuelo.d;
    var cen = [vuelo.x, 0, vuelo.z];
    var ojo = [cen[0] + Math.sin(giro) * dist * Math.cos(incl), Math.sin(incl) * dist, cen[2] + Math.cos(giro) * dist * Math.cos(incl)];
    var pr = persp(movil ? .74 : .6, W / H, .1, 40);
    var vi = mira(ojo, cen, [0, 1, 0]);
    var mueve = [1,0,0,0, 0,1,0,0, 0,0,1,0, 0, vuelo.o, 0, 1];
    return mul(mueve, mul(pr, vi));
  }
  function aPantalla(p){
    var m = MAT, x = p[0], y = p[1], z = p[2];
    var cx = m[0] * x + m[4] * y + m[8] * z + m[12], cy = m[1] * x + m[5] * y + m[9] * z + m[13], cw = m[3] * x + m[7] * y + m[11] * z + m[15];
    if(cw <= 0) return null;
    return [(cx / cw * .5 + .5) * W, (1 - (cy / cw * .5 + .5)) * H];
  }

  /* ---------- dibujo ---------- */
  var ahora = function(){ return (window.performance && performance.now()) || Date.now(); };
  var ultimo = 0, sonar = 0, vivo = true;
  function sube(buf, datos){ gl.bindBuffer(gl.ARRAY_BUFFER, buf); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(datos), gl.DYNAMIC_DRAW); }
  function lineas(datos){
    if(!datos.length) return;
    gl.useProgram(pL); sube(bufL, datos);
    gl.enableVertexAttribArray(aL.p); gl.vertexAttribPointer(aL.p, 3, gl.FLOAT, false, 28, 0);
    gl.enableVertexAttribArray(aL.c); gl.vertexAttribPointer(aL.c, 4, gl.FLOAT, false, 28, 12);
    gl.uniformMatrix4fv(aL.m, false, new Float32Array(MAT));
    gl.drawArrays(gl.LINES, 0, datos.length / 7);
  }
  function puntos(datos){
    if(!datos.length) return;
    gl.useProgram(pP); sube(bufP, datos);
    gl.enableVertexAttribArray(aP.p); gl.vertexAttribPointer(aP.p, 3, gl.FLOAT, false, 36, 0);
    gl.enableVertexAttribArray(aP.c); gl.vertexAttribPointer(aP.c, 4, gl.FLOAT, false, 36, 12);
    gl.enableVertexAttribArray(aP.s); gl.vertexAttribPointer(aP.s, 2, gl.FLOAT, false, 36, 28);
    gl.uniformMatrix4fv(aP.m, false, new Float32Array(MAT)); gl.uniform1f(aP.px, DPR);
    gl.drawArrays(gl.POINTS, 0, datos.length / 9);
  }
  function enArista(tr, u){ var A = P[tr.a], B = P[tr.b]; return [A[0] + (B[0] - A[0]) * u, .004, A[2] + (B[2] - A[2]) * u]; }
  function frame(ts){
    if(!vivo && !quieto) return;
    var dt = ultimo ? Math.min(.05, (ts - ultimo) / 1000) : .016; ultimo = ts;
    suave.x += (raton.x - suave.x) * .05; suave.y += (raton.y - suave.y) * .05;
    MAT = camara(ts);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.disable(gl.DEPTH_TEST); gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE);
    var dl = fijasL.slice(), dp = fijasP.slice();
    // radar desde Madrid
    if(P.Madrid){
      sonar = (sonar + dt * .22) % 1; var M = P.Madrid;
      [sonar, (sonar + .5) % 1].forEach(function(s){
        var r = .05 + s * 2.6, al = (1 - s) * .32, prev = null;
        for(var k = 0; k <= 72; k++){ var an = k / 72 * Math.PI * 2, q = [M[0] + Math.cos(an) * r, 0, M[2] + Math.sin(an) * r * .98];
          if(prev) L(dl, prev, q, [.2, .88, 1, al], [.2, .88, 1, al]); prev = q; }
      });
    }
    // trenes
    trenes.forEach(function(tr, i){
      if(!quieto) tr.t += dt * tr.v;
      if(tr.t >= 1){ pulsos.push({ p: P[tr.b], r: 0, c: tr.c }); trenes[i] = tr = nuevo(tr.b); }
      var cola = Math.min(tr.t, .16 / tr.largo), N = 7, prev = null;
      for(var k = 0; k <= N; k++){
        var u = tr.t - cola * (k / N), q = enArista(tr, Math.max(0, u)), al = (1 - k / N) * .95;
        if(prev) L(dl, prev, q, [tr.c[0], tr.c[1], tr.c[2], al + .1], [tr.c[0], tr.c[1], tr.c[2], al]);
        prev = q;
      }
      Pt(dp, enArista(tr, tr.t), [tr.c[0], tr.c[1], tr.c[2], 1], 6.2, 0);
    });
    // llegadas
    pulsos = pulsos.filter(function(q){ q.r += dt * 1.4; if(q.r >= 1) return false; Pt(dp, q.p, [q.c[0], q.c[1], q.c[2], (1 - q.r) * .9], 10 + q.r * 26, 2); return true; });
    // tu ruta
    if(ruta){
      var vis = quieto ? 1 : Math.min(1, (ts - rutaT0) / 1400);
      ruta.nodos.forEach(function(n, j){ var p = P[n]; if(!p) return; var c = j === 0 ? COL.lava : COL.sol;
        Pt(dp, p, [c[0], c[1], c[2], 1], 9, 0); Pt(dp, p, [c[0], c[1], c[2], .8], 22 + Math.sin(ts / 300 + j) * 4, 2); });
      var tot = ruta.pts.length, hasta = Math.floor(tot * vis);
      ruta.tramos.forEach(function(tm){
        for(var k = tm.ini; k < Math.min(tm.fin, hasta); k++){
          var u = k / Math.max(1, tot - 1), c = tm.avion ? [.9, .93, 1] : (u < .5 ? [1, .72 - u * .7, .11 + u * .5] : [1, .37 - (u - .5) * .38, .36 + (u - .5) * .34]);
          Pt(dp, ruta.pts[k], [c[0], c[1], c[2], tm.avion ? .6 : 1], tm.avion ? 3.4 : 6.5, 0);
          // la línea continua debajo de los puntos (y su sombra en el suelo)
          if(k > tm.ini){ var a0 = ruta.pts[k - 1], a1 = ruta.pts[k];
            L(dl, a0, a1, [c[0], c[1], c[2], tm.avion ? .45 : .95], [c[0], c[1], c[2], tm.avion ? .45 : .95]);
            if(!tm.avion) L(dl, [a0[0], 0, a0[2]], [a1[0], 0, a1[2]], [c[0], c[1], c[2], .22], [c[0], c[1], c[2], .22]); }
        }
      });
      if(tot && vis >= 1 && !quieto){
        var cab = Math.floor((ts / 8) % tot);
        for(var k = 0; k < 16; k++){ var idx = cab - k; if(idx < 0) break; Pt(dp, ruta.pts[idx], [1, 1, 1, (1 - k / 16) * .95], 11 - k * .5, 0); }
      }
    }
    lineas(dl); puntos(dp);
    // rótulos
    Object.keys(rotulos).forEach(function(n){
      var s = aPantalla([P[n][0], P[n][1] + .02, P[n][2]]), el = rotulos[n];
      if(!s || s[0] < -60 || s[0] > W + 60 || s[1] < -20 || s[1] > H + 20){ el.style.opacity = '0'; return; }
      el.style.opacity = ''; el.style.transform = 'translate3d(' + (s[0] + 8).toFixed(1) + 'px,' + (s[1] - 14).toFixed(1) + 'px,0)';
      el.classList.toggle('is-tapado', !!(tapa && !el.classList.contains('is-mine') && s[0] > tapa[0] && s[0] < tapa[2] && s[1] > tapa[1] && s[1] < tapa[3]));
    });
    if(!quieto && vivo) requestAnimationFrame(frame);
  }

  mide();
  var arranca = function(){ if(vivo) return; vivo = true; ultimo = 0; requestAnimationFrame(frame); };
  if(quieto) frame(0); else requestAnimationFrame(frame);
  var rt; addEventListener('resize', function(){ clearTimeout(rt); rt = setTimeout(function(){ mide(); pintaRotulos(); if(quieto) frame(0); }, 120); });
  if('IntersectionObserver' in window && !quieto){
    new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting && !document.hidden) arranca(); else vivo = false; }); }).observe(host);
    document.addEventListener('visibilitychange', function(){ if(document.hidden) vivo = false; else arranca(); });
  }
  if(window.matchMedia && matchMedia('(pointer: fine)').matches){
    host.addEventListener('pointermove', function(e){ var r = host.getBoundingClientRect(); raton.x = (e.clientX - r.left) / r.width * 2 - 1; raton.y = (e.clientY - r.top) / r.height * 2 - 1; });
    host.addEventListener('pointerleave', function(){ raton.x = 0; raton.y = 0; });
  }
  cv.addEventListener('webglcontextlost', function(e){ e.preventDefault(); vivo = false; });
})();
