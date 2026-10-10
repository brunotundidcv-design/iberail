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
      // tu destino, fijo arriba del todo
      fija: function(ciudad){
        if(!ciudad){ if(mia){ mia.remove(); mia = null; lista.appendChild(fila(0)); } return; }
        var nueva = !mia;
        if(nueva){
          mia = document.createElement('li'); mia.className = 'is-mine';
          lista.insertBefore(mia, lista.firstChild);
          var sobra = lista.querySelector('li:not(.is-mine):last-child'); if(sobra) sobra.remove();
        }
        if(mia.dataset.c === ciudad) return;
        mia.dataset.c = ciudad;
        rellena(mia, hhmm(5), ciudad, 'Interrail', '1', 'Tu ruta', 0);
      }
    };
  }

  /* ---------- «¿A dónde quieres ir?» ---------- */
  var D = window.IB_DATA || null;
  var buscador = document.querySelector('[data-hx-search]');
  if(buscador && D && D.cities){
    var campo = buscador.querySelector('input'), dl = buscador.querySelector('datalist'), pista = document.querySelector('[data-hx-hint]');
    var ciudades = D.cities.map(function(c){ return c.n; });
    dl.innerHTML = ciudades.map(function(n){ return '<option value="' + esc(n) + '">'; }).join('');
    var busca = function(v){ var q = norm(v); if(!q) return null; for(var j = 0; j < ciudades.length; j++) if(norm(ciudades[j]) === q) return ciudades[j]; return null; };
    var pistaBase = pista ? pista.innerHTML : '';
    campo.addEventListener('input', function(){
      var c = busca(campo.value);
      if(panel) panel.fija(c);
      buscador.classList.toggle('is-ok', !!c);
      if(pista && pista.classList.contains('is-err')){ pista.classList.remove('is-err'); pista.innerHTML = pistaBase; enganchaPruebas(); }
    });
    buscador.addEventListener('submit', function(e){
      var v = campo.value.trim();
      if(!v){ e.preventDefault(); location.href = 'rutas.html'; return; }
      var c = busca(v);
      if(c){ campo.value = c; return; }
      e.preventDefault();
      // empieza igual (p. ej. «pra» → Praga)
      var q = norm(v), parecidas = ciudades.filter(function(n){ return norm(n).indexOf(q) === 0 || norm(n).indexOf(q) > 0; }).slice(0, 3);
      if(pista){
        pista.classList.add('is-err');
        pista.innerHTML = parecidas.length
          ? '¿Querías decir ' + parecidas.map(function(n){ return '<button type="button" data-hx-try>' + esc(n) + '</button>'; }).join(', ') + '?'
          : 'Esa no la tenemos en la lista, pero escríbenos por WhatsApp y la vemos. O prueba con <button type="button" data-hx-try>Praga</button> o <button type="button" data-hx-try>Split</button>.';
        enganchaPruebas();
      }
    });
    var enganchaPruebas = function(){
      if(!pista) return;
      [].forEach.call(pista.querySelectorAll('[data-hx-try]'), function(b){
        b.onclick = function(){ campo.value = b.textContent; campo.dispatchEvent(new Event('input')); campo.focus(); };
      });
    };
    enganchaPruebas();
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
