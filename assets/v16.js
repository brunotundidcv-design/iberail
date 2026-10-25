/* Iberail — lo que se mueve en las páginas públicas (estilos en assets/v16.css; Europa en 3D en assets/orbita.js).
   Va al final del <body> de las páginas públicas, justo después de site.js (no en el panel).
   - Colores de la red de trenes de las cabeceras y del confeti (window.IB_TEMA, lo leen tema.js y fiesta.js)
   - Aviso de temporada · cápsula del menú
   - Portada: «Cómo funciona» [data-story] (pasa solo de un paso a otro mientras se ve), destinos en carrusel [data-hs],
     chat de ejemplo [data-chat], rutas hechas [data-presets], trenes nocturnos [data-night-n], pase que gira [data-flip],
     países [data-world]
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

  // la red de trenes de las cabeceras (tema.js) y el confeti del sorteo (fiesta.js) con los colores de la marca
  var T = window.IB_TEMA = window.IB_TEMA || {};
  if(!T.amb) T.amb = '255,184,28';
  if(!T.rojo) T.rojo = '255,90,54';
  if(!T.confeti) T.confeti = ['#FFB81C', '#FF5A36', '#FFFFFF', '#3CCB8A'];

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
    bar.innerHTML = '<span class="v16-aviso-k">Temporada 2027</span>' +
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

  /* ---------- portada: «Cómo funciona» ----------
     Mientras se ve, pasa sola al siguiente paso cada PASO_MS (la barra fina del paso activo lo marca).
     Tocar un paso lo abre y vuelve a empezar la cuenta. */
  var viaje = document.querySelector('[data-story]');
  if(viaje){
    var PASO_MS = 6500;
    var pasos = $$('.v16-steps li', viaje), pantallas = $$('.v16-scr', viaje);
    var via = viaje.querySelector('.v16-rail'), paradas = via ? $$('em', via) : [];
    var actual = -1, viendo = false, tPaso = 0;
    var pon = function(i){
      if(i === actual) return; actual = i;
      viaje.setAttribute('data-step', i);
      pasos.forEach(function(li, k){ li.classList.toggle('is-on', k === i); });
      pantallas.forEach(function(sc, k){ sc.classList.toggle('is-on', k === i); });
      paradas.forEach(function(e, k){ e.classList.toggle('is-on', k <= i); });
      if(via) via.style.setProperty('--p', pasos.length > 1 ? (i / (pasos.length - 1)).toFixed(3) : '1');
    };
    var programa = function(){
      clearTimeout(tPaso); viaje.classList.remove('is-auto');
      if(quieto || !viendo || document.hidden) return;
      void viaje.offsetWidth; viaje.classList.add('is-auto');
      tPaso = setTimeout(function(){ pon((actual + 1) % pasos.length); programa(); }, PASO_MS);
    };
    pasos.forEach(function(li, k){
      var b = li.querySelector('button');
      if(b) b.addEventListener('click', function(){ pon(k); programa(); });
    });
    pon(0);
    alVer(viaje, function(si){ if(si !== viendo){ viendo = si; programa(); } }, { threshold: .25 });
    document.addEventListener('visibilitychange', programa);
  }

  /* ---------- portada: destinos en carrusel (se pasa con el dedo, la rueda o las flechas) ---------- */
  var hs = document.querySelector('[data-hs]');
  if(hs){
    var pista = hs.querySelector('.v16-hs-track'), barra = hs.querySelector('.v16-hs-bar'), cuenta = hs.querySelector('[data-hs-n]');
    var total = pista ? pista.children.length : 0, rafH = 0;
    var pinta = function(){
      rafH = 0;
      var m = pista.scrollWidth - pista.clientWidth, p = m > 0 ? clamp(pista.scrollLeft / m, 0, 1) : 0;
      if(barra) barra.style.setProperty('--p', Math.max(.06, p).toFixed(4));
      if(cuenta) cuenta.innerHTML = ('0' + Math.min(total, Math.round(p * (total - 1)) + 1)).slice(-2) + ' <span>/ ' + ('0' + total).slice(-2) + '</span>';
    };
    if(pista){
      pista.addEventListener('scroll', function(){ if(!rafH) rafH = requestAnimationFrame(pinta); }, { passive: true });
      addEventListener('resize', function(){ if(!rafH) rafH = requestAnimationFrame(pinta); });
      pinta();
    }
  }

  /* ---------- «Todo lo que va en tu billete»: chat de ejemplo ---------- */
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

})();
