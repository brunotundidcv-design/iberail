/* Iberail — efectos del diseño «panel de salidas» (solo Iberail; Zarping no lo carga).
   - [data-clock]: reloj de Madrid (HH:MM:SS, o HH:MM si el texto inicial es «--:--»).
   - [data-board]: panel de salidas de ejemplo con letras que giran (destinos y trenes reales de la red; horas de ejemplo).
   - Barra de progreso al hacer scroll en la cabecera. */
(function(){
  'use strict';
  var quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

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

  /* ---------- barra de progreso ---------- */
  var top = document.querySelector('.topbar');
  if(top){
    var barra = document.createElement('span');
    barra.className = 'tx-progress'; barra.setAttribute('aria-hidden', 'true');
    top.appendChild(barra);
    var pinta = function(){
      var h = document.documentElement.scrollHeight - innerHeight;
      barra.style.transform = 'scaleX(' + (h > 0 ? Math.min(1, scrollY / h) : 0) + ')';
    };
    addEventListener('scroll', pinta, { passive: true }); addEventListener('resize', pinta); pinta();
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

  /* ---------- panel de salidas ---------- */
  var board = document.querySelector('[data-board]');
  // se inclina un poco hacia el ratón (solo con ratón y sin «reducir movimiento»)
  if(board && !quieto && matchMedia('(pointer: fine)').matches){
    var zona = board.closest('.hero') || board;
    zona.addEventListener('mousemove', function(e){
      var r = board.getBoundingClientRect();
      var x = (e.clientX - (r.left + r.width / 2)) / innerWidth, y = (e.clientY - (r.top + r.height / 2)) / innerHeight;
      board.style.transform = 'perspective(1200px) rotateY(' + (x * 7).toFixed(2) + 'deg) rotateX(' + (-y * 6).toFixed(2) + 'deg)';
    });
    zona.addEventListener('mouseleave', function(){ board.style.transform = ''; });
  }
  var lista = board && board.querySelector('[data-board-rows]');
  if(!lista) return;
  var SALIDAS = [
    ['París', 'TGV'], ['Ámsterdam', 'Eurostar'], ['Berlín', 'ICE'], ['Praga', 'EuroCity'], ['Viena', 'Railjet'],
    ['Budapest', 'Railjet'], ['Split', 'InterCity'], ['Venecia', 'Frecciarossa'], ['Múnich', 'Nightjet'],
    ['Cracovia', 'EuroCity'], ['Liubliana', 'EuroCity'], ['Copenhague', 'InterCity'], ['Roma', 'Frecciarossa'],
    ['Zúrich', 'EuroCity'], ['Lisboa', 'Intercidades'], ['Bruselas', 'Eurostar'], ['Zagreb', 'EuroCity'], ['Salzburgo', 'Railjet']
  ];
  var ESTADOS = ['A tiempo', 'Embarcando', 'A tiempo', 'Tu ruta', 'A tiempo', 'Reservando'];
  var FILAS = innerWidth < 560 ? 5 : 6;
  var GLIFOS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var i = Math.floor(Math.random() * SALIDAS.length), min = 0, base = new Date();

  function hhmm(extra){
    var d = new Date(base.getTime() + extra * 60000);
    try{ return d.toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hour12: false }); }
    catch(e){ return ('0' + d.getHours()).slice(-2) + ':' + ('0' + d.getMinutes()).slice(-2); }
  }
  // el texto «gira» letra a letra hasta quedarse en el definitivo, como las paletas de los paneles antiguos
  function girar(el, txt, retraso){
    el.textContent = txt;
    if(quieto) return;
    var fin = txt.toUpperCase(), n = 0, pasos = 9 + Math.floor(Math.random() * 6);
    el.setAttribute('aria-label', txt);
    setTimeout(function paso(){
      n++;
      var out = '';
      for(var k = 0; k < fin.length; k++){
        var c = fin[k];
        out += (c === ' ' || c === ':' || c === '·' || n > pasos - (fin.length - k) * 0.35) ? c : GLIFOS[Math.floor(Math.random() * GLIFOS.length)];
      }
      el.textContent = n >= pasos ? txt : out;
      if(n < pasos) setTimeout(paso, 45);
    }, retraso || 0);
  }
  function fila(retraso){
    var s = SALIDAS[i % SALIDAS.length]; i++;
    min += 9 + Math.floor(Math.random() * 18);
    var li = document.createElement('li');
    var estado = ESTADOS[Math.floor(Math.random() * ESTADOS.length)];
    li.innerHTML = '<span class="b-h"></span><span class="b-d"></span><span class="b-t"></span><span class="b-v"></span><span class="b-e"></span>';
    if(estado === 'Embarcando') li.classList.add('is-now');
    if(estado === 'Tu ruta') li.classList.add('is-you');
    var c = li.children;
    girar(c[0], hhmm(min), retraso);
    girar(c[1], s[0], retraso + 60);
    girar(c[2], s[1], retraso + 120);
    girar(c[3], String(1 + Math.floor(Math.random() * 14)), retraso + 160);
    girar(c[4], estado, retraso + 200);
    return li;
  }
  for(var k = 0; k < FILAS; k++) lista.appendChild(fila(250 + k * 140));
  if(quieto) return;
  // cada pocos segundos sale un tren y entra otro por abajo
  var corre = true;
  document.addEventListener('visibilitychange', function(){ corre = !document.hidden; });
  setInterval(function(){
    if(!corre) return;
    var primero = lista.firstElementChild;
    if(!primero) return;
    primero.classList.add('is-out');
    setTimeout(function(){ if(primero.parentNode) primero.remove(); lista.appendChild(fila(0)); }, 420);
  }, 3800);
})();
