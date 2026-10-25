/* Iberail — diseño v16 «Órbita»: las piezas que se mueven (estilos en assets/v16.css; Europa en 3D en assets/orbita.js).
   Va al final del <body> de las páginas públicas, justo después de site.js (no en el panel).
   - Colores de la red de trenes de las cabeceras y del confeti (window.IB_TEMA, lo leen tema.js y fiesta.js)
   - Títulos que entran con un destello · etiquetas que se «descifran» letra a letra
   - Cursor de colores y luz que sigue al ratón (solo con ratón) · foco de luz dentro de las tarjetas
   - Billetes holográficos que se inclinan · cápsula del menú · cintas que se tuercen al bajar rápido · cifras que cuentan
   - Portada: «El viaje» [data-story], destinos en carrusel [data-hs], chat en directo [data-chat],
     rutas hechas [data-presets], trenes nocturnos [data-night-n], pase que gira [data-flip], países [data-world]
   - Cuenta atrás con paletas · pie con el logotipo que baila y una vía con un tren de luz
   Con «reducir movimiento» todo queda quieto y visible. */
(function(){
  'use strict';
  var html = document.documentElement;
  html.classList.add('v16');
  var quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var raton = window.matchMedia && matchMedia('(pointer: fine)').matches;
  var $$ = function(s, r){ return [].slice.call((r || document).querySelectorAll(s)); };
  var clamp = function(v, a, b){ return Math.max(a, Math.min(b, v)); };
  var IO = 'IntersectionObserver' in window;

  // la red de trenes de las cabeceras (tema.js) y el confeti del sorteo (fiesta.js) con los colores de v16
  var T = window.IB_TEMA = window.IB_TEMA || {};
  if(!T.amb) T.amb = '51,225,255';
  if(!T.rojo) T.rojo = '255,46,136';
  if(!T.confeti) T.confeti = ['#FFB81C', '#FF5A36', '#FF2E88', '#8C5CFF', '#33E1FF', '#3DFFB4', '#FFFFFF'];

  var conDatos = function(cb){
    var listo = function(){
      if(window.IB_DATA) return cb(window.IB_DATA);
      var s = document.createElement('script'); s.src = 'assets/data.js'; s.async = true;
      s.onload = function(){ if(window.IB_DATA) cb(window.IB_DATA); }; document.head.appendChild(s);
    };
    if(window.IB_DATA) cb(window.IB_DATA);
    else if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', listo);
    else listo();
  };
  var alVer = function(el, fn, opts){
    if(!IO){ fn(true); return; }
    new IntersectionObserver(function(es){ es.forEach(function(e){ fn(e.isIntersecting, e); }); }, opts || { threshold: .15 }).observe(el);
  };

  /* ---------- aviso de temporada (arriba del todo, en todas las páginas públicas) ----------
     Solo urgencia real: la fecha del Ultra, que Split se llena esa semana y que los precios suben con la demanda.
     Se puede cerrar (se recuerda 3 días). Para quitarlo: AVISO.on = false */
  var AVISO = { on: true, ultra: new Date(2027, 6, 9), frases: [
    'Ultra Europe 2027 · Split se llena para la semana del festival',
    'Verano 2027 · Los alojamientos céntricos son los primeros en volar',
    'Los precios suben a medida que se llenan · Reserva antes y elige tú'
  ] };
  (function(){
    // días completos (como la cuenta atrás grande de la portada: «259 días 00 h», no 260)
    var dias = Math.floor((AVISO.ultra - new Date()) / 864e5);
    if(!AVISO.on || dias < 0 || document.getElementById('admApp') || /rutas\.html$/.test(location.pathname)) return;
    try{ var c = +localStorage.getItem('ib-aviso-temp') || 0; if(Date.now() - c < 3 * 864e5) return; }catch(e){}
    var bar = document.createElement('div'); bar.className = 'v16-aviso'; bar.setAttribute('role', 'region'); bar.setAttribute('aria-label', 'Aviso de temporada');
    bar.innerHTML = '<span class="v16-aviso-k"><i></i>Temporada 2027</span>' +
      '<span class="v16-aviso-t" aria-live="off">' + AVISO.frases.map(function(f, i){ return '<em' + (i ? '' : ' class="is-on"') + '>' + f + '</em>'; }).join('') + '</span>' +
      '<span class="v16-aviso-d"><b>' + dias + '</b> días para el Ultra</span>' +
      '<a class="v16-aviso-go" href="rutas.html">Reservar mi plaza <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>' +
      '<button type="button" class="v16-aviso-x" aria-label="Cerrar aviso"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
    document.body.insertBefore(bar, document.body.firstChild);
    html.classList.add('has-aviso');
    bar.querySelector('.v16-aviso-x').addEventListener('click', function(){
      try{ localStorage.setItem('ib-aviso-temp', String(Date.now())); }catch(e){}
      bar.remove(); html.classList.remove('has-aviso');
    });
    if(!quieto){
      var ems = bar.querySelectorAll('.v16-aviso-t em'), k = 0;
      setInterval(function(){ if(document.hidden) return; ems[k].classList.remove('is-on'); k = (k + 1) % ems.length; ems[k].classList.add('is-on'); }, 4200);
    }
  })();

  /* ---------- títulos que entran con un destello ---------- */
  if(!quieto){
    $$('.page-head h1, .section-head h2, .quiz-head h2, .home-faq-head h2, .srt-copy h2, .season-top h2, .v16-h').forEach(function(h){
      if(h.closest('[data-view]')) return;
      h.classList.add('v16-rev');
      if(h.matches('.page-head h1')){ var va = function(){ h.classList.add('v16-in'); }; requestAnimationFrame(function(){ requestAnimationFrame(va); }); setTimeout(va, 140); }
      else alVer(h, function(si){ if(si) h.classList.add('v16-in'); }, { threshold: .2, rootMargin: '0px 0px -6% 0px' });
    });
  }

  /* ---------- etiquetas que se descifran letra a letra ---------- */
  var GLIFOS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#/<>';
  function descifra(el){
    var nodos = [].filter.call(el.childNodes, function(n){ return n.nodeType === 3 && n.textContent.trim(); });
    if(!nodos.length) return;
    var fines = nodos.map(function(n){ return n.textContent; }), paso = 0, total = 14;
    (function tic(){
      paso++;
      nodos.forEach(function(n, k){
        var fin = fines[k], out = '';
        for(var i = 0; i < fin.length; i++){ var c = fin[i]; out += (c === ' ' || c === '·' || i < (paso / total) * fin.length) ? c : GLIFOS.charAt(Math.floor(Math.random() * GLIFOS.length)); }
        n.textContent = paso >= total ? fin : out;
      });
      if(paso < total) setTimeout(tic, 38);
    })();
  }
  if(!quieto) $$('.eyebrow, .v16-k, .hx-meta > span:not([data-tx-clock])').forEach(function(el){ alVer(el, function(si){ if(si && !el.dataset.v16d){ el.dataset.v16d = '1'; descifra(el); } }, { threshold: .6 }); });

  /* ---------- luz suave que sigue al ratón por el fondo (el puntero es el normal) ---------- */
  if(raton && !quieto){
    var luz = document.createElement('div'); luz.className = 'v16-luz'; luz.setAttribute('aria-hidden', 'true'); document.body.appendChild(luz);
    var tx = -400, ty = -400, lx = -400, ly = -400, corre = false;
    var mueve = function(){
      lx += (tx - lx) * .08; ly += (ty - ly) * .08;
      luz.style.transform = 'translate3d(' + lx.toFixed(1) + 'px,' + ly.toFixed(1) + 'px,0)';
      if(Math.abs(tx - lx) > .3 || Math.abs(ty - ly) > .3) requestAnimationFrame(mueve); else corre = false;
    };
    addEventListener('pointermove', function(e){
      if(e.pointerType !== 'mouse') return;
      tx = e.clientX; ty = e.clientY;
      if(!luz.classList.contains('is-on')){ lx = tx; ly = ty; luz.classList.add('is-on'); }
      if(!corre){ corre = true; requestAnimationFrame(mueve); }
    }, { passive: true });
    document.addEventListener('mouseout', function(e){ if(!e.relatedTarget) luz.classList.remove('is-on'); });
  }

  /* ---------- foco de luz dentro de las tarjetas ---------- */
  if(raton && !quieto){
    $$('.v16-tile, .quiz-card, .faq, .hx-pick, .board, .dock .hero-stats > div, .srt, .v16-more, .contact-card, .pl-card, .gx-card, .rcard, .dash-links a, .info-list li, .v16-steps button').forEach(function(el){
      if(el.querySelector(':scope > .v16-spot')) return;
      if(getComputedStyle(el).position === 'static') el.style.position = 'relative';
      var s = document.createElement('span'); s.className = 'v16-spot'; s.setAttribute('aria-hidden', 'true'); el.appendChild(s);
      el.addEventListener('pointermove', function(e){ var r = el.getBoundingClientRect(); el.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px'); el.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px'); el.classList.add('is-spot'); });
      el.addEventListener('pointerleave', function(){ el.classList.remove('is-spot'); });
    });
  }

  /* ---------- billetes holográficos que se inclinan ---------- */
  if(raton && !quieto){
    $$('.ticket, .dest-feat, .v16-more, .srt-art').forEach(function(el){
      var MAX = el.matches('.srt-art') ? 10 : 7;
      el.style.transition = 'transform .7s cubic-bezier(.22,.9,.24,1), box-shadow .3s, border-color .2s';
      el.addEventListener('pointermove', function(e){
        if(el.closest('.is-board')) return;
        var r = el.getBoundingClientRect(), px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.transition = 'transform .12s linear, box-shadow .3s, border-color .2s';
        el.style.transform = 'perspective(1100px) rotateX(' + ((.5 - py) * MAX).toFixed(2) + 'deg) rotateY(' + ((px - .5) * MAX).toFixed(2) + 'deg)' + (el.matches('.ticket, .v16-more') ? ' translateY(-6px)' : '');
        el.style.setProperty('--gx', (px * 100).toFixed(1) + '%'); el.style.setProperty('--gy', (py * 100).toFixed(1) + '%');
      });
      el.addEventListener('pointerleave', function(){ el.style.transition = 'transform .7s cubic-bezier(.22,.9,.24,1), box-shadow .3s, border-color .2s'; el.style.transform = ''; });
    });
  }

  /* ---------- menú: la cápsula se desliza bajo el enlace ---------- */
  var nav = document.querySelector('.topbar nav'), lista = nav && nav.querySelector('.nav');
  if(nav && lista && raton){
    var capsula = document.createElement('span'); capsula.className = 'v16-navpill'; capsula.setAttribute('aria-hidden', 'true');
    nav.insertBefore(capsula, lista);
    lista.addEventListener('pointerover', function(e){
      var a = e.target.closest('a'); if(!a || a.getAttribute('aria-current') === 'page'){ capsula.classList.remove('is-on'); return; }
      var r = a.getBoundingClientRect(), n = nav.getBoundingClientRect();
      capsula.style.width = r.width + 'px'; capsula.style.height = r.height + 'px';
      capsula.style.transform = 'translate(' + (r.left - n.left).toFixed(1) + 'px,' + (r.top - n.top).toFixed(1) + 'px)';
      capsula.classList.add('is-on');
    });
    lista.addEventListener('pointerleave', function(){ capsula.classList.remove('is-on'); });
  }

  /* ---------- cintas: se tuercen con la velocidad al bajar ---------- */
  var cintas = document.querySelector('.tapes');
  if(cintas && !quieto){
    var antes = scrollY, vuelta;
    addEventListener('scroll', function(){
      var v = scrollY - antes; antes = scrollY;
      cintas.style.setProperty('--v16-sk', clamp(-v * .45, -14, 14).toFixed(2) + 'deg');
      clearTimeout(vuelta); vuelta = setTimeout(function(){ cintas.style.setProperty('--v16-sk', '0deg'); }, 140);
    }, { passive: true });
  }

  /* ---------- cifras que cuentan ---------- */
  $$('.hero-stats b').forEach(function(b){
    var m = b.textContent.trim().match(/^(\D*)(\d+)(\D*)$/);
    if(!m || quieto) return;
    var fin = +m[2], hecho = false;
    alVer(b, function(si){
      if(!si || hecho) return; hecho = true;
      var t0 = performance.now(), D = 1400;
      (function paso(t){
        var k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
        b.textContent = m[1] + Math.round(fin * e) + m[3];
        if(k < 1) requestAnimationFrame(paso);
      })(t0);
    }, { threshold: .6 });
  });

  /* ---------- portada: «El viaje» (se queda fijo mientras bajas) ---------- */
  var viaje = document.querySelector('[data-story]');
  if(viaje){
    var pasos = $$('.v16-steps li', viaje), pantallas = $$('.v16-scr', viaje), num = viaje.querySelector('[data-story-n]');
    var via = viaje.querySelector('.v16-rail'), paradas = via ? $$('em', via) : [];
    var pin = viaje.querySelector('.v16-story-pin'), actual = -1, ciclo = null, viendo = false, tCambio = 0, tFin = 0;
    var fijo = function(){ return pin && getComputedStyle(pin).position === 'sticky'; };
    var pantalla = function(i){ pantallas.forEach(function(s, k){ s.classList.toggle('is-on', k === i); }); };
    var pon = function(i){
      if(i === actual) return; var primera = actual < 0; actual = i;
      viaje.setAttribute('data-step', i);
      pasos.forEach(function(li, k){ li.classList.toggle('is-on', k === i); });
      paradas.forEach(function(e, k){ e.classList.toggle('is-on', k <= i); });
      if(num) num.style.setProperty('--n', i);
      if(primera || quieto){ pantalla(i); return; }
      // el móvil gira y, a mitad del giro (cuando no se ve la pantalla), cambia de pantalla; un barrido de luz lo cruza
      viaje.classList.remove('is-swap'); void viaje.offsetWidth; viaje.classList.add('is-swap');
      clearTimeout(tCambio); clearTimeout(tFin);
      tCambio = setTimeout(function(){ pantalla(actual); }, 330);
      tFin = setTimeout(function(){ viaje.classList.remove('is-swap'); }, 900);
    };
    var alBajar = function(){
      if(!fijo()) return;
      var r = viaje.getBoundingClientRect(), tot = Math.max(1, r.height - innerHeight), p = clamp(-r.top / tot, 0, 1);
      if(via) via.style.setProperty('--p', p.toFixed(4));
      var paso = Math.min(pasos.length - 1, Math.floor(p * pasos.length));
      pon(paso);
      // dentro del paso activo, una barra que se llena mientras bajas
      var dentro = clamp(p * pasos.length - paso, 0, 1);
      if(pasos[paso]) pasos[paso].style.setProperty('--sp', dentro.toFixed(3));
    };
    var reinicia = function(){
      clearInterval(ciclo);
      viaje.classList.toggle('is-fijo', !!fijo());
      if(fijo() || quieto) return;
      ciclo = setInterval(function(){ if(viendo && !document.hidden) pon((actual + 1) % pasos.length); }, 5600);
    };
    pasos.forEach(function(li, k){
      var b = li.querySelector('button'); if(!b) return;
      b.addEventListener('click', function(){
        if(fijo()){
          var r = viaje.getBoundingClientRect(), tot = r.height - innerHeight;
          scrollTo({ top: scrollY + r.top + tot * (k + .5) / pasos.length, behavior: quieto ? 'auto' : 'smooth' });
        } else { pon(k); reinicia(); }
      });
    });
    pon(0);
    var rafV = 0;
    addEventListener('scroll', function(){ if(!rafV) rafV = requestAnimationFrame(function(){ rafV = 0; alBajar(); }); }, { passive: true });
    addEventListener('resize', function(){ alBajar(); reinicia(); });
    alVer(viaje, function(si){ viendo = si; }, { threshold: .25 });
    alBajar(); reinicia();
  }

  /* ---------- portada: destinos en carrusel horizontal ---------- */
  var hs = document.querySelector('[data-hs]');
  if(hs){
    var hsPin = hs.querySelector('.v16-hs-pin'), pista = hs.querySelector('.v16-hs-track');
    var barra = hs.querySelector('.v16-hs-bar'), cuenta = hs.querySelector('[data-hs-n]');
    var hsDist = 0, hsFijo = false, total = pista ? pista.children.length : 0;
    var pinta = function(p){
      if(barra) barra.style.setProperty('--p', Math.max(.06, p).toFixed(4));
      if(cuenta) cuenta.innerHTML = ('0' + Math.min(total, Math.round(p * (total - 1)) + 1)).slice(-2) + ' <span>/ ' + ('0' + total).slice(-2) + '</span>';
    };
    var hsMueve = function(){
      var p;
      if(hsFijo){ var r = hs.getBoundingClientRect(); p = clamp(-r.top / Math.max(1, hsDist), 0, 1); pista.style.setProperty('--hs-x', (-p * hsDist).toFixed(1) + 'px'); }
      else { var m = pista.scrollWidth - pista.clientWidth; p = m > 0 ? pista.scrollLeft / m : 0; }
      pinta(p);
    };
    var hsMide = function(){
      if(!pista) return;
      hsFijo = getComputedStyle(hsPin).position === 'sticky';
      if(!hsFijo){ hs.style.removeProperty('--hs-h'); pista.style.removeProperty('--hs-x'); hsMueve(); return; }
      var c = hs.querySelector('.container') || document.querySelector('.container');
      var pad = Math.max(18, c.getBoundingClientRect().left + parseFloat(getComputedStyle(c).paddingLeft));
      pista.style.setProperty('--hs-pad', pad + 'px'); pista.style.setProperty('--hs-x', '0px');
      var ult = pista.lastElementChild.getBoundingClientRect();
      hsDist = Math.max(0, ult.right + pad - innerWidth);
      hs.style.setProperty('--hs-h', (innerHeight + hsDist) + 'px');
      hsMueve();
    };
    var rafH = 0;
    addEventListener('scroll', function(){ if(!rafH) rafH = requestAnimationFrame(function(){ rafH = 0; hsMueve(); }); }, { passive: true });
    if(pista) pista.addEventListener('scroll', function(){ if(!hsFijo) hsMueve(); }, { passive: true });
    var rt; addEventListener('resize', function(){ clearTimeout(rt); rt = setTimeout(hsMide, 120); });
    addEventListener('load', hsMide);
    hsMide();
  }

  /* ---------- «Todo lo que va en tu billete»: chat en directo ---------- */
  $$('[data-chat]').forEach(function(caja){
    var M = [[1, '¿Qué pase nos conviene para 15 días?'], [0, 'Con vuestra ruta os sale mejor el Global. Os mandamos el detalle por aquí.'],
      [1, '¿Y si perdemos un tren?'], [0, 'Nos escribís y buscamos el siguiente con vosotros, a cualquier hora.'],
      [1, '¿El alojamiento de Praga está cerca de la estación?'], [0, 'Sí: lo buscamos cerca de la estación o del centro, y te lo confirmamos antes de reservar.']];
    var i = 0, viendoC = false;
    var msg = function(yo, txt){
      var p = document.createElement('p'); p.className = 'v16-msg' + (yo ? ' is-me' : ''); p.textContent = txt; caja.appendChild(p);
      while(caja.children.length > 5) caja.removeChild(caja.firstChild);
    };
    if(quieto){ M.slice(0, 4).forEach(function(m){ msg(m[0], m[1]); }); return; }
    msg(M[0][0], M[0][1]); msg(M[1][0], M[1][1]); i = 2;
    var paso = function(){
      if(!viendoC || document.hidden) return setTimeout(paso, 900);
      var m = M[i % M.length]; i++;
      if(m[0]){ msg(1, m[1]); setTimeout(paso, 1500); return; }
      var t = document.createElement('p'); t.className = 'v16-msg is-typing'; t.innerHTML = '<i></i><i></i><i></i>'; caja.appendChild(t);
      setTimeout(function(){ t.remove(); msg(0, m[1]); setTimeout(paso, 2600); }, 1400);
    };
    alVer(caja, function(si){ viendoC = si; });
    setTimeout(paso, 1800);
  });

  /* ---------- rutas hechas, trenes nocturnos y países (datos del planificador) ---------- */
  var rutas = document.querySelector('[data-presets]'), noche = document.querySelector('[data-night-n]'), mundo = document.querySelector('[data-world]');
  if(rutas || noche || mundo) conDatos(function(D){
    if(noche){
      var nn = (D.rail || []).filter(function(r){ return r[4] === 1 && r[3] === 'tren'; }).length;
      if(nn) noche.textContent = nn;
    }
    if(rutas && (D.presets || []).length){
      var L = D.presets, t = rutas.querySelector('[data-p-t]'), s = rutas.querySelector('[data-p-s]'), ol = rutas.querySelector('[data-p-stops]');
      var go = rutas.querySelector('[data-p-go]'), dots = rutas.querySelector('[data-p-dots]'), k = -1, encima = false, viendoR = false;
      L.forEach(function(p, j){
        var b = document.createElement('button'); b.type = 'button'; b.setAttribute('role', 'tab');
        b.setAttribute('aria-label', p.t); b.addEventListener('click', function(){ ver(j); }); dots.appendChild(b);
      });
      var ver = function(j){
        if(j === k) return; var primera = k < 0; k = j; var p = L[j];
        rutas.classList.add('is-swap');
        setTimeout(function(){
          t.textContent = p.t; s.textContent = p.s;
          ol.innerHTML = '';
          p.stops.forEach(function(st, n){
            var li = document.createElement('li'); li.style.setProperty('--i', n);
            li.innerHTML = '<i></i><span></span><small></small>';
            li.children[1].textContent = st.n; li.children[2].textContent = st.d + (st.d === 1 ? ' noche' : ' noches');
            ol.appendChild(li);
          });
          go.href = 'rutas.html?preset=' + encodeURIComponent(p.id);
          rutas.classList.remove('is-swap');
        }, primera ? 0 : 220);
        [].forEach.call(dots.children, function(b, n){ b.setAttribute('aria-selected', String(n === j)); });
      };
      ver(0);
      rutas.addEventListener('pointerenter', function(){ encima = true; });
      rutas.addEventListener('pointerleave', function(){ encima = false; });
      alVer(rutas, function(si){ viendoR = si; });
      if(!quieto) setInterval(function(){ if(viendoR && !encima && !document.hidden) ver((k + 1) % L.length); }, 4600);
    }
    if(mundo){
      var flap = mundo.querySelector('[data-flap]'), pista2 = mundo.querySelector('.v16-flags-track');
      var nombres = Object.keys(D.countries || {}).filter(function(c){ return c !== 'ES'; }).map(function(c){ return D.countries[c]; })
        .filter(function(n){ return n.length <= 12; });
      if(pista2 && D.flags){
        var cods = Object.keys(D.flags).filter(function(c){ return c !== 'ES'; });
        var h = cods.map(function(c){ return '<i style="--flag:' + D.flags[c].replace(/"/g, '') + '" title="' + (D.countries[c] || c) + '"></i>'; }).join('');
        pista2.innerHTML = h + h;
      }
      if(flap && nombres.length){
        var N = 12, celdas = [], LET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
        for(var q = 0; q < N; q++){ var c = document.createElement('span'); celdas.push(c); flap.appendChild(c); }
        var pinta2 = function(nombre, anima){
          var txt = nombre.toUpperCase(), pad = Math.floor((N - txt.length) / 2);
          celdas.forEach(function(c, j){
            var fin = txt.charAt(j - pad) || '';
            if(!anima || quieto){ c.textContent = fin; return; }
            var vueltas = 3 + (j % 4), n = 0;
            setTimeout(function giro(){
              c.classList.remove('is-flip'); void c.offsetWidth; c.classList.add('is-flip');
              c.textContent = n < vueltas ? LET.charAt(Math.floor(Math.random() * LET.length)) : fin;
              if(n++ < vueltas) setTimeout(giro, 70);
            }, j * 35);
          });
        };
        var w = 0, viendoM = false;
        pinta2(nombres[0], false);
        alVer(mundo, function(si){ viendoM = si; });
        if(!quieto) setInterval(function(){ if(viendoM && !document.hidden){ w = (w + 1) % nombres.length; pinta2(nombres[w], true); } }, 2600);
      }
    }
  });

  /* pase que gira (con el dedo, al tocar) */
  $$('[data-flip]').forEach(function(b){ b.addEventListener('click', function(){ b.classList.toggle('is-flip'); }); });

  /* ---------- cuenta atrás con paletas ---------- */
  if(!quieto && 'MutationObserver' in window){
    $$('.countdown b').forEach(function(b){
      new MutationObserver(function(){ b.classList.remove('is-flip'); void b.offsetWidth; b.classList.add('is-flip'); })
        .observe(b, { childList: true, characterData: true, subtree: true });
    });
  }

  /* ---------- pie: letras que bailan y una vía con un tren de luz ---------- */
  var grande = document.querySelector('.footer-big');
  if(grande){
    (function letras(nodo){
      [].slice.call(nodo.childNodes).forEach(function(c){
        if(c.nodeType === 3){
          var frag = document.createDocumentFragment();
          c.textContent.split('').forEach(function(ch){ var s = document.createElement('span'); s.className = 'v16-l'; s.textContent = ch; frag.appendChild(s); });
          c.parentNode.replaceChild(frag, c);
        } else if(c.nodeType === 1) letras(c);
      });
    })(grande);
    var via2 = document.createElement('div'); via2.className = 'v16-frail'; via2.setAttribute('aria-hidden', 'true'); via2.innerHTML = '<i></i>';
    grande.parentNode.insertBefore(via2, grande.nextSibling);
    if(!quieto) alVer(via2, function(si){ via2.classList.toggle('is-in', si); });
  }
})();
