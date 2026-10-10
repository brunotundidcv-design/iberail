/* Iberail — funciones del diseño «andén» (solo Iberail; Zarping no lo carga).
   - Cabecera flotante: se esconde al bajar y vuelve al subir (html.tx-hdr-off). Trenecito de progreso abajo.
   - [data-clock]: reloj de Madrid (HH:MM:SS, o HH:MM si el texto inicial es «--:--»).
   - [data-board]: panel de salidas de ejemplo (destinos y trenes reales de la red; horas de ejemplo) con letras que giran.
   - [data-hx-search]: «¿A dónde quieres ir?» → pone tu destino en el panel y lo abre en el planificador (?add=).
   - [data-quiz]: test «¿Qué Interrail va contigo?» → una de las rutas hechas del planificador (IB_DATA.presets, ?preset=).
   - #countryGrid (Destinos): vista «Tarjetas / Tablero».
   - video[data-src]: se carga y reproduce solo cuando se ve. */
(function(){
  'use strict';
  var quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raton = window.matchMedia && matchMedia('(pointer: fine)').matches;
  var html = document.documentElement;
  var guarda = function(k, v){ try{ localStorage.setItem(k, v); }catch(e){} };
  var lee = function(k){ try{ return localStorage.getItem(k); }catch(e){ return null; } };
  var norm = function(s){ return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim(); };
  var esc = function(s){ return String(s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var ARR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';

  /* ---------- cabecera: se esconde al bajar, vuelve al subir; trenecito de progreso ---------- */
  var top = document.querySelector('.topbar');
  if(top){
    var via = document.createElement('span');
    via.className = 'tx-progress'; via.setAttribute('aria-hidden', 'true');
    via.innerHTML = '<i></i><b><svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="12" rx="3"/><path d="M4 10h16M8 20l-2 2M16 20l2 2M8.5 13.2h.01M15.5 13.2h.01"/></svg></b>';
    top.appendChild(via);
    var antes = scrollY, menuAbierto = function(){ return document.body.classList.contains('menu-open'); };
    var pinta = function(){
      var h = document.documentElement.scrollHeight - innerHeight, y = scrollY;
      via.style.setProperty('--p', h > 0 ? Math.min(1, Math.max(0, y / h)).toFixed(4) : 0);
      var foco = top.contains(document.activeElement);
      if(y > 160 && y > antes + 4 && !menuAbierto() && !foco) html.classList.add('tx-hdr-off');
      else if(y < antes - 4 || y <= 160) html.classList.remove('tx-hdr-off');
      antes = y;
    };
    addEventListener('scroll', pinta, { passive: true }); addEventListener('resize', pinta); pinta();
    top.addEventListener('focusin', function(){ html.classList.remove('tx-hdr-off'); });
  }

  /* ---------- fondo: la red de trenes de Europa, en directo ----------
     Ciudades y tramos de IB_DATA (los del planificador) + las líneas principales de España. Trenes de luz que van de ciudad
     en ciudad; al pasar el ratón se ve el nombre de la ciudad. En la portada, la ruta que montas se dibuja encima (IBRed.ruta).
     Se para cuando no se ve; con «reducir movimiento», imagen quieta. */
  var hosts = [].slice.call(document.querySelectorAll('.hero, .page-head:not(.page-head--photo)'));
  window.IBRed = { ruta: function(){} };
  if(hosts.length && window.HTMLCanvasElement){
    var conDatos = function(cb){
      if(window.IB_DATA) return cb(window.IB_DATA);
      var s = document.createElement('script'); s.src = 'assets/data.js'; s.async = true;
      s.onload = function(){ if(window.IB_DATA) cb(window.IB_DATA); }; document.head.appendChild(s);
    };
    conDatos(function(DD){ hosts.forEach(function(h, n){ montaRed(h, DD, n === 0 && h.classList.contains('hero')); }); });
  }
  function montaRed(host, DD, principal){
    var ESP = [['Madrid','Barcelona'],['Madrid','Zaragoza'],['Zaragoza','Barcelona'],['Madrid','Valencia'],['Valencia','Barcelona'],['Madrid','Sevilla'],
      ['Madrid','Málaga'],['Sevilla','Málaga'],['Madrid','Bilbao'],['Bilbao','San Sebastián'],['San Sebastián','Burdeos'],['Barcelona','Marsella'],['Lisboa','Oporto']];
    var C = {}; (DD.origins || []).concat(DD.cities || []).forEach(function(c){ if(c.lon != null) C[c.n] = c; });
    var aristas = [], vecinos = {}, visto = {};
    (DD.rail || []).map(function(r){ return [r[0], r[1]]; }).concat(ESP).forEach(function(e){
      var a = C[e[0]], b = C[e[1]]; if(!a || !b) return;
      var k = [a.n, b.n].sort().join('|'); if(visto[k]) return; visto[k] = 1;
      aristas.push([a.n, b.n]); (vecinos[a.n] = vecinos[a.n] || []).push(b.n); (vecinos[b.n] = vecinos[b.n] || []).push(a.n);
    });
    var nombres = Object.keys(vecinos);
    if(!nombres.length) return;
    var ROTULOS = ['Lisboa','Madrid','Barcelona','París','Londres','Ámsterdam','Berlín','Praga','Viena','Budapest','Roma','Split','Copenhague','Estambul','Múnich','Venecia','Cracovia','Sevilla'];
    var cv = document.createElement('canvas'); cv.className = 'tx-red'; cv.setAttribute('aria-hidden', 'true');
    host.insertBefore(cv, host.firstChild); host.classList.add('has-red');
    var cx = cv.getContext('2d'), base = document.createElement('canvas'), bx = base.getContext('2d');
    var W = 0, H = 0, R = 1, P = {}, trenes = [], pulsos = [], mia = null, raton = null, vivo = true, ultimo = 0;
    var AMB = '255,184,28', ROJO = '215,48,30';
    var lat0 = 48 * Math.PI / 180, k0 = Math.cos(lat0);
    function proyecta(){
      var r = host.getBoundingClientRect(); W = Math.max(1, r.width); H = Math.max(1, r.height);
      R = Math.min(window.devicePixelRatio || 1, 2);
      [cv, base].forEach(function(c){ c.width = Math.round(W * R); c.height = Math.round(H * R); });
      cv.style.width = W + 'px'; cv.style.height = H + 'px';
      var xs = nombres.map(function(n){ return C[n].lon * k0; }), ys = nombres.map(function(n){ return -C[n].lat; });
      var minX = Math.min.apply(0, xs), maxX = Math.max.apply(0, xs), minY = Math.min.apply(0, ys), maxY = Math.max.apply(0, ys);
      var sw = (maxX - minX) * 1.08, sh = (maxY - minY) * 1.12;
      var movil = W < 700;
      // cubre todo el fondo; en la portada España queda a la izquierda, en móvil se centra en el centro de Europa
      var s = Math.max(W / sw, H / sh) * (movil ? 1.05 : (principal ? 1 : 1.15));
      var cxm = movil ? 9 * k0 : (minX + maxX) / 2 + (principal ? 0 : 2 * k0), cym = principal ? (movil ? -47 : -47.5) : -48.5;
      nombres.forEach(function(n){ var c = C[n]; P[n] = { x: W / 2 + (c.lon * k0 - cxm) * s, y: H / 2 + (-c.lat - cym) * s }; });
      dibujaBase();
    }
    function dibujaBase(){
      bx.setTransform(R, 0, 0, R, 0, 0); bx.clearRect(0, 0, W, H);
      bx.lineWidth = 1; bx.strokeStyle = 'rgba(255,255,255,.075)'; bx.beginPath();
      aristas.forEach(function(e){ var a = P[e[0]], b = P[e[1]]; bx.moveTo(a.x, a.y); bx.lineTo(b.x, b.y); });
      bx.stroke();
      nombres.forEach(function(n){ var p = P[n]; bx.fillStyle = 'rgba(255,255,255,.26)'; bx.beginPath(); bx.arc(p.x, p.y, ROTULOS.indexOf(n) >= 0 ? 2.2 : 1.5, 0, 6.3); bx.fill(); });
      bx.font = '600 10px "Funnel Sans", system-ui, sans-serif'; bx.fillStyle = 'rgba(255,255,255,.16)';
      if(W > 700) ROTULOS.forEach(function(n){ var p = P[n]; if(p) bx.fillText(n.toUpperCase(), p.x + 6, p.y - 6); });
    }
    function nuevoTren(desde){
      var a = desde || nombres[Math.floor(Math.random() * nombres.length)], vs = vecinos[a];
      var b = vs[Math.floor(Math.random() * vs.length)];
      var r = Math.random();
      return { a: a, b: b, t: 0, v: 55 + Math.random() * 60, col: r < .72 ? AMB : r < .9 ? ROJO : '255,255,255' };
    }
    var N = W < 700 ? 9 : 22;
    function siembra(){ trenes = []; N = W < 700 ? 9 : (principal ? 22 : 14); for(var i = 0; i < N; i++){ var tr = nuevoTren(); tr.t = Math.random(); trenes.push(tr); } }
    function pos(tr, t){ var a = P[tr.a], b = P[tr.b]; return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }; }
    function largo(tr){ var a = P[tr.a], b = P[tr.b]; return Math.max(1, Math.hypot(b.x - a.x, b.y - a.y)); }
    function frame(ts){
      if(!vivo) return;
      var dt = ultimo ? Math.min(.05, (ts - ultimo) / 1000) : 0; ultimo = ts;
      cx.setTransform(1, 0, 0, 1, 0, 0); cx.clearRect(0, 0, cv.width, cv.height); cx.drawImage(base, 0, 0);
      cx.setTransform(R, 0, 0, R, 0, 0);
      // tu ruta (portada)
      if(mia && mia.length > 1){
        cx.save(); cx.lineCap = 'round';
        for(var j = 1; j < mia.length; j++){
          var a = P[mia[j - 1]], b = P[mia[j]]; if(!a || !b) continue;
          var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2 - Math.hypot(b.x - a.x, b.y - a.y) * .18;
          cx.setLineDash(j === 1 ? [3, 6] : [10, 8]); cx.lineDashOffset = -(ts / 40) % 36;
          cx.strokeStyle = j === 1 ? 'rgba(255,255,255,.55)' : 'rgba(' + AMB + ',.9)'; cx.lineWidth = j === 1 ? 1.5 : 2.5;
          cx.beginPath(); cx.moveTo(a.x, a.y); cx.quadraticCurveTo(mx, my, b.x, b.y); cx.stroke();
        }
        cx.setLineDash([]);
        mia.forEach(function(n, j){ var p = P[n]; if(!p) return;
          cx.fillStyle = j === 0 ? 'rgb(' + ROJO + ')' : 'rgb(' + AMB + ')'; cx.beginPath(); cx.arc(p.x, p.y, j === 0 ? 4.5 : 5, 0, 6.3); cx.fill();
          cx.strokeStyle = 'rgba(' + AMB + ',.35)'; cx.lineWidth = 6; cx.beginPath(); cx.arc(p.x, p.y, 10 + Math.sin(ts / 300 + j) * 2, 0, 6.3); cx.stroke();
          cx.font = '700 12px "Funnel Sans", system-ui, sans-serif'; cx.fillStyle = 'rgba(255,243,214,.95)'; cx.fillText(n, p.x + 10, p.y - 10);
        });
        cx.restore();
      }
      // trenes
      trenes.forEach(function(tr, i){
        tr.t += dt * tr.v / largo(tr);
        if(tr.t >= 1){ pulsos.push({ p: P[tr.b], r: 2, a: .7, col: tr.col }); trenes[i] = tr = nuevoTren(tr.b); }
        var cola = Math.max(0, tr.t - 38 / largo(tr)), p0 = pos(tr, cola), p1 = pos(tr, tr.t);
        var g = cx.createLinearGradient(p0.x, p0.y, p1.x, p1.y); g.addColorStop(0, 'rgba(' + tr.col + ',0)'); g.addColorStop(1, 'rgba(' + tr.col + ',.85)');
        cx.strokeStyle = g; cx.lineWidth = 2; cx.beginPath(); cx.moveTo(p0.x, p0.y); cx.lineTo(p1.x, p1.y); cx.stroke();
        cx.fillStyle = 'rgba(' + tr.col + ',.18)'; cx.beginPath(); cx.arc(p1.x, p1.y, 5, 0, 6.3); cx.fill();
        cx.fillStyle = 'rgb(' + tr.col + ')'; cx.beginPath(); cx.arc(p1.x, p1.y, 1.8, 0, 6.3); cx.fill();
      });
      // llegadas
      pulsos = pulsos.filter(function(q){ q.r += dt * 26; q.a -= dt * .9; if(q.a <= 0) return false;
        cx.strokeStyle = 'rgba(' + q.col + ',' + q.a.toFixed(3) + ')'; cx.lineWidth = 1.2; cx.beginPath(); cx.arc(q.p.x, q.p.y, q.r, 0, 6.3); cx.stroke(); return true; });
      // ciudad bajo el ratón
      if(raton){
        var best = null, bd = 46;
        nombres.forEach(function(n){ var p = P[n], d = Math.hypot(p.x - raton.x, p.y - raton.y); if(d < bd){ bd = d; best = n; } });
        if(best){ var p = P[best]; cx.strokeStyle = 'rgba(' + AMB + ',.8)'; cx.lineWidth = 1.5; cx.beginPath(); cx.arc(p.x, p.y, 7, 0, 6.3); cx.stroke();
          cx.font = '700 12px "Funnel Sans", system-ui, sans-serif'; cx.fillStyle = 'rgba(' + AMB + ',.95)'; cx.fillText(best, p.x + 11, p.y + 4);
          (vecinos[best] || []).forEach(function(v){ var q = P[v]; cx.strokeStyle = 'rgba(' + AMB + ',.28)'; cx.lineWidth = 1; cx.beginPath(); cx.moveTo(p.x, p.y); cx.lineTo(q.x, q.y); cx.stroke(); });
        }
      }
      if(!quieto) requestAnimationFrame(frame);
    }
    var arranca = function(){ if(vivo) return; vivo = true; ultimo = 0; requestAnimationFrame(frame); };
    proyecta(); siembra();
    if(quieto){ vivo = true; frame(0); } else requestAnimationFrame(frame);
    var rt; addEventListener('resize', function(){ clearTimeout(rt); rt = setTimeout(function(){ proyecta(); if(quieto) frame(0); }, 150); });
    if('IntersectionObserver' in window && !quieto){
      new IntersectionObserver(function(es){ es.forEach(function(e){ if(e.isIntersecting && !document.hidden) arranca(); else vivo = false; }); }).observe(host);
      document.addEventListener('visibilitychange', function(){ if(document.hidden) vivo = false; else arranca(); });
    }
    if(raton !== undefined && window.matchMedia && matchMedia('(pointer: fine)').matches){
      host.addEventListener('mousemove', function(e){ var r = cv.getBoundingClientRect(); raton = { x: e.clientX - r.left, y: e.clientY - r.top }; if(quieto) frame(0); });
      host.addEventListener('mouseleave', function(){ raton = null; if(quieto) frame(0); });
    }
    if(principal) window.IBRed.ruta = function(lista){ mia = (lista || []).filter(function(n){ return P[n]; }); if(quieto) frame(0); };
  }

  /* ---------- reloj ---------- */
  var relojes = [].slice.call(document.querySelectorAll('[data-clock]'));
  function hora(seg){
    try{ return new Date().toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', second: seg ? '2-digit' : undefined, hour12: false }); }
    catch(e){ var d = new Date(); return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  }
  if(relojes.length){
    relojes.forEach(function(el){ el._seg = el.textContent.trim().length > 5; });
    var tic = function(){ relojes.forEach(function(el){ el.textContent = hora(el._seg); }); };
    tic(); setInterval(tic, 1000);
  }

  /* ---------- botones principales que se acercan un poco al ratón ---------- */
  if(raton && !quieto){
    [].forEach.call(document.querySelectorAll('.btn--primary, .srt-btn'), function(b){
      b.addEventListener('mousemove', function(e){
        var r = b.getBoundingClientRect();
        b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * .12).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * .2 - 2).toFixed(1) + 'px)';
      });
      b.addEventListener('mouseleave', function(){ b.style.transform = ''; });
    });
  }

  /* ---------- vídeos que solo se cargan y reproducen cuando se ven ([data-src]) ---------- */
  var ahorro = navigator.connection && navigator.connection.saveData;
  if(!quieto && !ahorro && 'IntersectionObserver' in window){
    var vio = new IntersectionObserver(function(es){
      es.forEach(function(e){
        var v = e.target;
        if(e.isIntersecting){
          if(!v.src){ v.src = v.dataset.src; v.addEventListener('playing', function(){ v.classList.add('is-on'); }, { once: true }); }
          var p = v.play(); if(p && p.catch) p.catch(function(){});
        } else if(v.src) v.pause();
      });
    }, { rootMargin: '120px' });
    [].forEach.call(document.querySelectorAll('video[data-src]'), function(v){ vio.observe(v); });
  }

  /* ---------- Destinos: vista tarjetas / tablero ---------- */
  var rejilla = document.getElementById('countryGrid');
  var filtros = document.querySelector('.filters');
  if(rejilla && filtros){
    var vista = document.createElement('div');
    vista.className = 'tx-view'; vista.setAttribute('role', 'group'); vista.setAttribute('aria-label', 'Cómo ver los destinos');
    vista.innerHTML = '<button type="button" data-v="cards" aria-pressed="true"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2"/></svg>Tarjetas</button>' +
      '<button type="button" data-v="board" aria-pressed="false"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6h16M4 12h16M4 18h16"/></svg>Tablero</button>';
    filtros.appendChild(vista);
    var ponVista = function(v){
      rejilla.classList.toggle('is-board', v === 'board');
      [].forEach.call(vista.children, function(b){ b.setAttribute('aria-pressed', String(b.dataset.v === v)); });
      guarda('ib-vista-destinos', v);
    };
    vista.addEventListener('click', function(e){ var b = e.target.closest('button'); if(b) ponVista(b.dataset.v); });
    if(lee('ib-vista-destinos') === 'board') ponVista('board');
  }

  /* ---------- panel de salidas ---------- */
  var board = document.querySelector('[data-board]');
  var panel = null;
  if(board && !quieto && raton){
    // se inclina un poco hacia el ratón
    var zona = board.closest('.hero') || board;
    zona.addEventListener('mousemove', function(e){
      var r = board.getBoundingClientRect();
      var x = (e.clientX - (r.left + r.width / 2)) / innerWidth, y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      board.style.transform = 'perspective(1200px) rotateY(' + (x * 7).toFixed(2) + 'deg) rotateX(' + (-y * 6).toFixed(2) + 'deg)';
    });
    zona.addEventListener('mouseleave', function(){ board.style.transform = ''; });
  }
  var lista = board && board.querySelector('[data-board-rows]');
  if(lista) panel = montaPanel(lista);

  function montaPanel(lista){
    var SALIDAS = [
      ['París', 'TGV'], ['Ámsterdam', 'Eurostar'], ['Berlín', 'ICE'], ['Praga', 'EuroCity'], ['Viena', 'Railjet'],
      ['Budapest', 'Railjet'], ['Split', 'InterCity'], ['Venecia', 'Frecciarossa'], ['Múnich', 'Nightjet'],
      ['Cracovia', 'EuroCity'], ['Liubliana', 'EuroCity'], ['Copenhague', 'InterCity'], ['Roma', 'Frecciarossa'],
      ['Zúrich', 'EuroCity'], ['Lisboa', 'Intercidades'], ['Bruselas', 'Eurostar'], ['Zagreb', 'EuroCity'], ['Salzburgo', 'Railjet']
    ];
    var ESTADOS = ['A tiempo', 'Embarcando', 'A tiempo', 'A tiempo', 'Reservando'];
    var FILAS = innerWidth < 560 ? 5 : 6;
    var GLIFOS = 'ABCDEFGHIJKLMNOPRSTUVZ';
    var i = Math.floor(Math.random() * SALIDAS.length), min = 0, base = new Date(), mia = null;

    function hhmm(extra){
      var d = new Date(base.getTime() + extra * 60000);
      try{ return d.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }); }
      catch(e){ return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
    }
    // el texto «gira» letra a letra hasta quedarse en el definitivo, como las paletas de los paneles antiguos
    function girar(el, txt, retraso){
      el.textContent = txt;
      if(quieto) return;
      var fin = txt.toUpperCase(), n = 0, pasos = 8 + Math.floor(Math.random() * 5);
      setTimeout(function paso(){
        n++;
        var out = '';
        for(var k = 0; k < fin.length; k++){
          var c = fin[k];
          out += (c === ' ' || c === ':' || n > pasos - (fin.length - k) * 0.35) ? c : GLIFOS[Math.floor(Math.random() * GLIFOS.length)];
        }
        el.textContent = n >= pasos ? txt : out;
        if(n < pasos) setTimeout(paso, 45);
      }, retraso || 0);
    }
    function rellena(li, h, d, t, v, e, retraso){
      li.innerHTML = '<span class="b-h"></span><span class="b-d"></span><span class="b-t"></span><span class="b-v"></span><span class="b-e"></span>';
      var c = li.children;
      girar(c[0], h, retraso); girar(c[1], d, retraso + 60); girar(c[2], t, retraso + 120); girar(c[3], v, retraso + 160); girar(c[4], e, retraso + 200);
    }
    function fila(retraso){
      var s = SALIDAS[i % SALIDAS.length]; i++;
      min += 9 + Math.floor(Math.random() * 18);
      var li = document.createElement('li');
      var estado = ESTADOS[Math.floor(Math.random() * ESTADOS.length)];
      if(estado === 'Embarcando') li.classList.add('is-now');
      rellena(li, hhmm(min), s[0], s[1], String(1 + Math.floor(Math.random() * 14)), estado, retraso);
      return li;
    }
    for(var k = 0; k < FILAS; k++) lista.appendChild(fila(250 + k * 140));
    if(!quieto){
      // cada pocos segundos sale un tren y entra otro por abajo (tu fila se queda arriba)
      var corre = true;
      document.addEventListener('visibilitychange', function(){ corre = !document.hidden; });
      setInterval(function(){
        if(!corre) return;
        var primero = lista.querySelector('li:not(.is-mine):not(.is-out)');
        if(!primero) return;
        primero.classList.add('is-out');
        setTimeout(function(){ if(primero.parentNode) primero.remove(); lista.appendChild(fila(0)); }, 420);
      }, 3800);
    }
    return {
      // tus paradas, fijas arriba del todo (como mucho 3; el resto del panel sigue moviéndose debajo)
      fija: function(paradas){
        paradas = (paradas || []).slice(0, 3);
        var mias = [].slice.call(lista.querySelectorAll('li.is-mine'));
        while(mias.length > paradas.length){ mias.pop().remove(); lista.appendChild(fila(0)); }
        while(mias.length < paradas.length){
          var li = document.createElement('li'); li.className = 'is-mine';
          var ult = mias[mias.length - 1];
          lista.insertBefore(li, ult ? ult.nextSibling : lista.firstChild);
          var sobra = lista.querySelector('li:not(.is-mine):last-child'); if(sobra) sobra.remove();
          mias.push(li);
        }
        mias.forEach(function(li, n){
          var c = paradas[n];
          if(li.dataset.c === c) return;
          li.dataset.c = c;
          rellena(li, hhmm(5 + n * 2), c, 'Interrail', String(n + 1), 'Tu ruta', n * 90);
        });
      }
    };
  }

  /* ---------- «Toca las ciudades que te apetecen»: tu ruta en la portada ---------- */
  var D = window.IB_DATA || null;
  var pick = document.querySelector('[data-hx-pick]');
  if(pick && D && D.cities){
    var chipsBox = pick.querySelector('[data-hx-chips]'), mas = pick.querySelector('[data-hx-more]'), desde = pick.querySelector('[data-hx-from]');
    var rutaBox = pick.querySelector('[data-hx-route]'), ir = pick.querySelector('[data-hx-go]'), dado = pick.querySelector('[data-hx-dice]');
    var porNombre = {}; D.cities.forEach(function(c){ porNombre[c.n] = c; });
    var MAX = 8, sel = [];
    // tramos: los mismos datos que el planificador (horas conocidas; si no, estimación por distancia, con «≈»)
    var VEL = { oeste: 120, med: 100, centro: 90, norte: 90, balticos: 55, balcanes: 50 }, LENTO = { 'atenas': 50, 'salonica': 50, 'estambul': 45, 'dublin': 50 };
    var SIN_TREN = {}; (D.noRail || []).forEach(function(n){ SIN_TREN[norm(n)] = 1; });
    var TREN = {}; (D.rail || []).forEach(function(r){ TREN[norm(r[0]) + '|' + norm(r[1])] = TREN[norm(r[1]) + '|' + norm(r[0])] = { h: r[2], noche: !!r[4], ok: true }; });
    var kmEntre = function(a, b){ var R = 6371, g = Math.PI / 180, dLa = (b.lat - a.lat) * g, dLo = (b.lon - a.lon) * g;
      var h = Math.pow(Math.sin(dLa / 2), 2) + Math.cos(a.lat * g) * Math.cos(b.lat * g) * Math.pow(Math.sin(dLo / 2), 2); return 2 * R * Math.asin(Math.sqrt(h)); };
    var tramo = function(x, y){
      var k = TREN[norm(x) + '|' + norm(y)]; if(k) return k;
      var a = porNombre[x], b = porNombre[y]; if(!a || !b) return null;
      var bus = SIN_TREN[norm(x)] || SIN_TREN[norm(y)];
      var va = LENTO[norm(a.n)] || VEL[a.r] || 80, vb = LENTO[norm(b.n)] || VEL[b.r] || 80;
      return { h: kmEntre(a, b) * 1.2 / (bus ? 60 : (va + vb) / 2) + 1, bus: !!bus, ok: false };
    };
    var horas = function(t){ var h = t.h; var s = h < 1 ? Math.round(h * 60) + ' min' : (Math.round(h * 2) / 2 + ' h').replace('.5', ',5'); return (t.ok ? '' : '≈') + s; };
    var ICON_AVION = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10.5 21l1.5-6.5L5 12l-2 1-1-1 4-3 7.5.5L17 4a1.5 1.5 0 012 2l-5.5 3.5.5 7.5-3 4-1-1 1-2-2.5-7z"/></svg>';

    // ciudades de salida y «+ Otra ciudad»
    desde.innerHTML = (D.origins || []).map(function(o){ return '<option>' + esc(o.n) + '</option>'; }).join('');
    var desdeGuardado = lee('ib-hx-desde'); if(desdeGuardado && (D.origins || []).some(function(o){ return o.n === desdeGuardado; })) desde.value = desdeGuardado;
    var enChips = function(){ return [].map.call(chipsBox.querySelectorAll('.hx-chip'), function(b){ return b.dataset.c; }); };
    var pintaMas = function(){
      var ya = enChips();
      mas.innerHTML = '<option value="">+ Otra ciudad</option>' + D.cities.filter(function(c){ return ya.indexOf(c.n) < 0; })
        .map(function(c){ return '<option>' + esc(c.n) + '</option>'; }).join('');
    };
    var chipDe = function(n){
      var b = chipsBox.querySelector('.hx-chip[data-c="' + n.replace(/"/g, '') + '"]');
      if(b) return b;
      b = document.createElement('button'); b.type = 'button'; b.className = 'hx-chip is-extra'; b.dataset.c = n; b.textContent = n; b.setAttribute('aria-pressed', 'false');
      chipsBox.insertBefore(b, mas.parentNode);
      return b;
    };
    function pinta(){
      [].forEach.call(chipsBox.querySelectorAll('.hx-chip'), function(b){
        var i = sel.indexOf(b.dataset.c);
        b.setAttribute('aria-pressed', String(i >= 0));
        b.dataset.n = i >= 0 ? i + 1 : '';
      });
      var origen = desde.value;
      if(!sel.length){
        rutaBox.innerHTML = '<div class="hx-rt is-empty"><span class="hx-st is-o"><i></i>' + esc(origen) + '</span><span class="hx-lg"></span><span class="hx-st is-ghost"><i></i>¿…?</span></div>' +
          '<p class="hx-sum">Elige una o varias: el orden en que las tocas es el de tu ruta.</p>';
      } else {
        var total = 0, aprox = false, html = '<div class="hx-rt"><span class="hx-st is-o"><i></i>' + esc(origen) + '</span><span class="hx-lg is-air" title="El primer tramo, desde España, suele ser en avión">' + ICON_AVION + '</span>';
        sel.forEach(function(n, k){
          if(k){ var t = tramo(sel[k - 1], n); if(t){ total += t.h; if(!t.ok) aprox = true; } html += '<span class="hx-lg">' + (t ? '<b>' + horas(t) + (t.bus ? ' bus' : '') + '</b>' : '') + '</span>'; }
          html += '<span class="hx-st' + (norm(n) === 'split' ? ' is-split' : '') + '"><i></i>' + esc(n) + '</span>';
        });
        html += '</div>';
        var resumen = sel.length + (sel.length === 1 ? ' parada' : ' paradas');
        if(sel.length > 1) resumen += ' · ' + (aprox ? 'unas ' : '') + horas({ h: total, ok: true }) + ' de tren en total';
        if(sel.indexOf('Split') >= 0) resumen += ' · Ultra Europe: 9–11 jul';
        rutaBox.innerHTML = html + '<p class="hx-sum">' + esc(resumen) + '</p>';
      }
      var q = 'desde=' + encodeURIComponent(origen) + (sel.length ? '&ruta=' + encodeURIComponent(sel.join(',')) : '');
      ir.href = 'rutas.html?' + q;
      ir.firstChild.nodeValue = sel.length ? 'Diseñar esta ruta ' : 'Diseñar mi ruta ';
      pick.classList.toggle('has-sel', sel.length > 0);
      if(panel) panel.fija(sel);
      window.IBRed.ruta(sel.length ? [origen].concat(sel) : []);
    }
    var alterna = function(n){
      var i = sel.indexOf(n);
      if(i >= 0) sel.splice(i, 1);
      else if(sel.length < MAX){ sel.push(n); chipDe(n); }
      pinta();
    };
    chipsBox.addEventListener('click', function(e){ var b = e.target.closest('.hx-chip'); if(b) alterna(b.dataset.c); });
    mas.addEventListener('change', function(){ if(mas.value){ alterna(mas.value); pintaMas(); mas.value = ''; } });
    desde.addEventListener('change', function(){ guarda('ib-hx-desde', desde.value); pinta(); });
    // «Sorpréndeme»: una de las rutas hechas del planificador, parada a parada
    var ultimo = -1;
    dado.addEventListener('click', function(){
      var P = (D.presets || []).filter(function(p){ return p.stops && p.stops.length; }); if(!P.length) return;
      var k; do{ k = Math.floor(Math.random() * P.length); }while(P.length > 1 && k === ultimo); ultimo = k;
      var paradas = P[k].stops.map(function(s){ return s.n; }).filter(function(n){ return porNombre[n]; }).slice(0, MAX);
      sel = []; pinta(); dado.disabled = true; dado.classList.add('is-rolling');
      paradas.forEach(function(n, j){ setTimeout(function(){ sel.push(n); chipDe(n); pinta(); if(j === paradas.length - 1){ dado.disabled = false; dado.classList.remove('is-rolling'); pintaMas(); } }, quieto ? 0 : 160 * (j + 1)); });
    });
    pintaMas(); pinta();
  }

  /* ---------- test «¿Qué Interrail va contigo?» ---------- */
  var quiz = document.querySelector('[data-quiz]');
  var tarjeta = quiz && quiz.querySelector('[data-quiz-card]');
  if(tarjeta && D && D.presets && D.presets.length){
    var RUTAS = {};
    D.presets.forEach(function(p){ RUTAS[p.id] = p; });
    // cada respuesta suma puntos a las rutas hechas del planificador (fiesta, ultra = Balcanes + Ultra, clasica)
    var PREGUNTAS = [
      { q: 'Son las 2 de la mañana. ¿Dónde estás?', r: [
        ['En la pista hasta que salga el sol', { fiesta: 2, ultra: 1 }],
        ['Delante de un escenario con 100.000 personas', { ultra: 2, fiesta: 1 }],
        ['Durmiendo: mañana toca museo', { clasica: 2 }] ] },
      { q: '¿Playa o ciudad?', r: [
        ['Calas, barco y bañador', { ultra: 2 }],
        ['Ciudades con mucha vida', { fiesta: 1, clasica: 1 }],
        ['Un poco de todo', { ultra: 1, clasica: 1 }] ] },
      { q: 'En la mochila no puede faltar…', r: [
        ['Un altavoz', { fiesta: 2 }],
        ['Gafas de sol y crema', { ultra: 2 }],
        ['La cámara', { clasica: 2 }] ] },
      { q: '¿Con quién vas?', r: [
        ['Con toda la cuadrilla', { fiesta: 1, ultra: 1 }],
        ['En pareja', { clasica: 2 }],
        ['Con un par de amigos', { fiesta: 1, clasica: 1 }] ] }
    ];
    var paso = 0, puntos = {};
    var pinta2 = function(){
      if(paso >= PREGUNTAS.length) return resultado();
      var P = PREGUNTAS[paso];
      tarjeta.innerHTML =
        '<div class="qz-top"><span>Pregunta ' + (paso + 1) + ' de ' + PREGUNTAS.length + '</span><i style="--p:' + (paso / PREGUNTAS.length) + '"></i></div>' +
        '<h3 class="qz-q">' + esc(P.q) + '</h3>' +
        '<div class="qz-opts">' + P.r.map(function(o, j){ return '<button type="button" class="qz-opt" data-o="' + j + '"><b>' + 'ABC'[j] + '</b>' + esc(o[0]) + '</button>'; }).join('') + '</div>' +
        (paso ? '<button type="button" class="qz-back" data-qz-back>← Atrás</button>' : '');
      tarjeta.classList.remove('is-in'); void tarjeta.offsetWidth; tarjeta.classList.add('is-in');
    };
    var historial = [];
    tarjeta.addEventListener('click', function(e){
      var o = e.target.closest('.qz-opt');
      if(o){
        var suma = PREGUNTAS[paso].r[+o.dataset.o][1];
        historial.push(suma);
        Object.keys(suma).forEach(function(k){ puntos[k] = (puntos[k] || 0) + suma[k]; });
        paso++; pinta2(); return;
      }
      if(e.target.closest('[data-qz-back]') && historial.length){
        var quita = historial.pop();
        Object.keys(quita).forEach(function(k){ puntos[k] -= quita[k]; });
        paso--; pinta2(); return;
      }
      if(e.target.closest('[data-qz-again]')){ paso = 0; puntos = {}; historial = []; pinta2(); return; }
      if(e.target.closest('[data-qz-share]')){
        var b = e.target.closest('[data-qz-share]'), url = location.origin + location.pathname + '#test';
        var txt = 'Me ha salido «' + b.dataset.t + '» en el test de Iberail. ¿Y a ti?';
        if(navigator.share) navigator.share({ title: 'Iberail', text: txt, url: url }).catch(function(){});
        else if(navigator.clipboard) navigator.clipboard.writeText(txt + ' ' + url).then(function(){ b.textContent = '¡Enlace copiado!'; });
      }
    });
    function resultado(){
      var orden = ['fiesta', 'ultra', 'clasica'].filter(function(k){ return RUTAS[k]; });
      var gana = orden.sort(function(a, b){ return (puntos[b] || 0) - (puntos[a] || 0); })[0];
      var R = RUTAS[gana];
      var dias = R.stops.reduce(function(t, s){ return t + (s.d || 0); }, 0);
      tarjeta.innerHTML =
        '<div class="qz-top"><span>Tu Interrail</span><i style="--p:1"></i></div>' +
        '<p class="qz-k">Te va…</p><h3 class="qz-r">' + esc(R.t) + '</h3><p class="qz-s">' + esc(R.s) + '</p>' +
        '<ol class="qz-route">' + R.stops.map(function(s){ return '<li><b>' + esc(s.n) + '</b><span>' + s.d + ' días</span></li>'; }).join('') + '</ol>' +
        '<p class="qz-meta">' + R.stops.length + ' paradas · unos ' + dias + ' días · luego la cambias como quieras</p>' +
        '<div class="qz-acts"><a class="btn btn--dark" href="rutas.html?preset=' + encodeURIComponent(R.id) + '">Abrir esta ruta ' + ARR + '</a>' +
        '<button type="button" class="btn btn--ghost" data-qz-share data-t="' + esc(R.t) + '">Compartir</button>' +
        '<button type="button" class="qz-back" data-qz-again>Repetir el test</button></div>';
      tarjeta.classList.remove('is-in'); void tarjeta.offsetWidth; tarjeta.classList.add('is-in', 'is-done');
    }
    pinta2();
  } else if(quiz){
    var sq = quiz.closest('section'); if(sq) sq.hidden = true;
  }
})();
