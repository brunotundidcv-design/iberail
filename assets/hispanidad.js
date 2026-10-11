/* Iberail — temática del Día de la Hispanidad (12 de octubre).
   Se activa sola hasta el final del 12 de octubre (hora de Madrid) y después la web vuelve a su aspecto normal sin
   tocar nada. Va en el <head> de las páginas públicas, ANTES de tema.js (que lee window.IB_TEMA para el fondo de trenes
   y el panel de salidas) y de fiesta.js (colores del confeti). Estilos en hispanidad.css (todo bajo html.tema-hispanidad).
   - Bienvenida animada la primera vez que se entra cada día («¡Feliz Día de la Hispanidad, <nombre>!» con sesión;
     sin sesión, solo el mensaje). Se recuerda en localStorage ib-hisp-<fecha> (recogido en la política de cookies).
   - Página del sorteo: fuegos artificiales en rojo y gualda de fondo y cifras de la cuenta atrás que giran al cambiar.
   - Etiqueta del día, sello que gira, franja ondeando, cinta de ciudades de España y fila fija en el panel de salidas.
   Ver la web sin la temática: ?tema=normal · forzarla fuera de fecha: ?tema=hispanidad · repetir la bienvenida: ?intro=1.
   Para otro año: cambiar HASTA. */
(function(){
  var HASTA = '2026-10-13T00:00:00+02:00';   // se apaga a las 00:00 del 13 de octubre (Madrid)
  var q = '', intro = '';
  try{ var qs = new URLSearchParams(location.search); q = (qs.get('tema') || '').toLowerCase(); intro = qs.get('intro') || ''; }catch(e){}
  var activa = q === 'hispanidad' || (q !== 'normal' && Date.now() < Date.parse(HASTA));
  if(!activa) return;

  var html = document.documentElement;
  var quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  html.classList.add('tema-hispanidad');
  var ROJO = '#AA151B', GUALDA = '#F1BF00';
  window.IB_TEMA = {
    amb: '241,191,0', rojo: '170,21,27', espana: true,
    fila: ['12:10', 'Toda Europa', 'Desde España', '12', 'Fiesta'],
    confeti: [ROJO, GUALDA, GUALDA, '#FFFFFF', '#D4202A', '#FFD84A']
  };
  var esc = function(s){ return String(s).replace(/[&<>"']/g, function(c){ return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var hoy = (function(){ try{ return new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' }); }catch(e){ return new Date().toISOString().slice(0, 10); } })();
  var CLAVE = 'ib-hisp-' + hoy;

  /* ---------- confeti y fuegos (lienzo compartido) ---------- */
  function lienzo(host, cls){
    var cv = document.createElement('canvas'); cv.className = cls; cv.setAttribute('aria-hidden', 'true'); host.appendChild(cv);
    var cx = cv.getContext('2d'), W = 0, H = 0, R = Math.min(window.devicePixelRatio || 1, 2), P = [], vivo = false, ult = 0;
    function mide(){ var r = host.getBoundingClientRect(); W = r.width; H = r.height; cv.width = Math.round(W * R); cv.height = Math.round(H * R); cv.style.width = W + 'px'; cv.style.height = H + 'px'; }
    function frame(ts){
      var dt = ult ? Math.min(.05, (ts - ult) / 1000) : .016; ult = ts;
      cx.setTransform(R, 0, 0, R, 0, 0); cx.clearRect(0, 0, W, H);
      P = P.filter(function(p){
        p.vy += (p.g || 300) * dt; p.vx *= (1 - (p.dr || .6) * dt); p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.vida -= dt;
        if(p.vida <= 0 || p.y > H + 40) return false;
        cx.globalAlpha = Math.max(0, Math.min(1, p.vida / (p.fade || .6)));
        cx.fillStyle = p.c;
        if(p.chispa){ cx.beginPath(); cx.arc(p.x, p.y, p.s, 0, 6.3); cx.fill(); }
        else { cx.save(); cx.translate(p.x, p.y); cx.rotate(p.r); cx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2); cx.restore(); }
        return true;
      });
      cx.globalAlpha = 1;
      if(P.length || api.siempre){ requestAnimationFrame(frame); } else { vivo = false; ult = 0; }
    }
    var api = {
      siempre: false,
      add: function(arr){ P = P.concat(arr); if(!vivo){ vivo = true; requestAnimationFrame(frame); } },
      mide: mide, el: cv, w: function(){ return W; }, h: function(){ return H; }
    };
    mide(); addEventListener('resize', mide);
    return api;
  }
  var COLS = window.IB_TEMA.confeti;
  function confeti(L, x, y, n, abre){
    var a = [];
    for(var i = 0; i < n; i++){
      var ang = -Math.PI / 2 + (Math.random() - .5) * (abre || 2.2), v = 380 + Math.random() * 520;
      a.push({ x: x, y: y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, g: 520, dr: 1.4, s: 7 + Math.random() * 8, r: Math.random() * 6, vr: (Math.random() - .5) * 14,
        c: COLS[Math.floor(Math.random() * COLS.length)], vida: 2.2 + Math.random() * 1.4, fade: .8 });
    }
    L.add(a);
  }
  function fuego(L, x, y){
    var a = [], n = 46 + Math.floor(Math.random() * 30), col = Math.random() < .5 ? GUALDA : Math.random() < .6 ? '#E23A3F' : '#FFFFFF';
    for(var i = 0; i < n; i++){
      var ang = (i / n) * Math.PI * 2 + Math.random() * .2, v = 90 + Math.random() * 170;
      a.push({ chispa: true, x: x, y: y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, g: 70, dr: .9, s: 1.6 + Math.random() * 1.8, r: 0, vr: 0,
        c: Math.random() < .25 ? '#FFFFFF' : col, vida: 1.1 + Math.random() * .9, fade: .9 });
    }
    L.add(a);
  }

  /* ---------- bienvenida del día ---------- */
  function bienvenida(){
    if(html.classList.contains('ib-mant')) return;                 // con la web en mantenimiento, no
    if(navigator.webdriver && intro !== '1') return;                // ni para robots
    var visto = null; try{ visto = localStorage.getItem(CLAVE); }catch(e){}
    if(visto && intro !== '1') return;
    try{ localStorage.setItem(CLAVE, '1'); }catch(e){}
    var nombre = '';
    try{ if(window.IB && IB.storedUser && IB.firstName){ var u = IB.storedUser(); if(u) nombre = IB.firstName(u); } }catch(e){}
    var ov = document.createElement('div');
    ov.className = 'hisp-intro'; ov.setAttribute('role', 'dialog'); ov.setAttribute('aria-modal', 'true'); ov.setAttribute('aria-label', 'Feliz Día de la Hispanidad');
    var palabras = ['¡Feliz', 'Día', 'de', 'la', 'Hispanidad'];
    ov.innerHTML =
      '<i class="hi-b hi-b1"></i><i class="hi-b hi-b2"></i><i class="hi-b hi-b3"></i>' +
      '<div class="hi-top"><span class="hi-logo">ibe<b>rail</b></span><span class="hi-k">12 de octubre</span></div>' +
      '<div class="hi-mid"><h2 class="hi-t">' + palabras.map(function(w, i){ return '<span style="--i:' + i + '">' + w + (i === palabras.length - 1 ? '<span class="hi-name" data-hi-name></span>!' : '') + '</span>'; }).join(' ') + '</h2></div>' +
      '<div class="hi-bot"><p class="hi-s">Desde España, a toda Europa. Gracias por viajar con nosotros.</p><button type="button" class="hi-go">Entrar en la web</button></div>';
    var pon = function(n){ var s = ov.querySelector('[data-hi-name]'); if(n && s && !s.textContent){ s.textContent = ', ' + n; s.classList.add('is-on'); } };
    pon(nombre);
    document.body.appendChild(ov);
    html.classList.add('hisp-intro-on');
    var L = lienzo(ov, 'hi-cf');
    var foco = ov.querySelector('.hi-go'); setTimeout(function(){ try{ foco.focus({ preventScroll: true }); }catch(e){} }, 400);
    // si la sesión llega un poco después (páginas con la librería de Supabase)
    if(!nombre && window.IB && IB.getUser){ IB.getUser().then(function(u){ if(u) pon(IB.firstName(u)); }).catch(function(){}); }
    if(!quieto){
      setTimeout(function(){ confeti(L, L.w() * .15, L.h() * .62, 70, 1.6); confeti(L, L.w() * .85, L.h() * .62, 70, 1.6); }, 1050);
      setTimeout(function(){ confeti(L, L.w() * .5, L.h() * .7, 90, 2.6); }, 1500);
    }
    var cerrado = false;
    function cierra(){
      if(cerrado) return; cerrado = true;
      ov.classList.add('is-out'); html.classList.remove('hisp-intro-on');
      document.removeEventListener('keydown', tecla);
      setTimeout(function(){ ov.remove(); }, 900);
    }
    function tecla(e){ if(e.key === 'Escape' || e.key === 'Enter') cierra(); }
    ov.addEventListener('click', cierra);
    document.addEventListener('keydown', tecla);
    setTimeout(cierra, quieto ? 3200 : 5200);
  }

  /* ---------- sorteo: fuegos de fondo y cifras que giran ---------- */
  function sorteo(){
    var main = document.querySelector('.srt-page'); if(!main) return;
    if(!quieto){
      var L = lienzo(main, 'hisp-fw'); L.siempre = false;
      var oculto = false; document.addEventListener('visibilitychange', function(){ oculto = document.hidden; });
      (function lanza(){
        if(!oculto && !html.classList.contains('hisp-intro-on')){
          var w = L.w(), h = L.h();
          fuego(L, w * (.1 + Math.random() * .8), h * (.08 + Math.random() * .38));
          if(Math.random() < .35) setTimeout(function(){ fuego(L, w * (.1 + Math.random() * .8), h * (.08 + Math.random() * .3)); }, 220);
        }
        setTimeout(lanza, 1100 + Math.random() * 1500);
      })();
    }
    // la cuenta atrás se repinta cada segundo: se marca solo la cifra que ha cambiado
    var prev = [];
    new MutationObserver(function(){
      var bs = [].slice.call(document.querySelectorAll('.cta-clock .cta-u b'));
      bs.forEach(function(b, i){ if(prev[i] !== undefined && prev[i] !== b.textContent) b.classList.add('hisp-tick'); });
      prev = bs.map(function(b){ return b.textContent; });
    }).observe(main, { childList: true, subtree: true });
  }

  /* ---------- piezas de la temática ---------- */
  var SELLO = 'DÍA DE LA HISPANIDAD · 12 DE OCTUBRE · DESDE ESPAÑA A TODA EUROPA · ';
  function sello(){
    var d = document.createElement('div');
    d.className = 'hisp-sello'; d.setAttribute('aria-hidden', 'true');
    d.innerHTML = '<svg viewBox="0 0 200 200"><defs><path id="hispCirc" d="M100,100 m-78,0 a78,78 0 1,1 156,0 a78,78 0 1,1 -156,0"/></defs>' +
      '<circle cx="100" cy="100" r="96" class="hs-o"/><circle cx="100" cy="100" r="62" class="hs-i"/>' +
      '<text class="hs-t"><textPath href="#hispCirc" textLength="485">' + SELLO + '</textPath></text></svg>' +
      '<span class="hs-c"><i class="hisp-flag"></i><b>12·10</b></span>';
    return d;
  }
  function pill(peq){
    var p = document.createElement('p');
    p.className = 'hisp-pill' + (peq ? ' hisp-pill--sm' : '');
    p.innerHTML = '<i class="hisp-flag" aria-hidden="true"></i><span>12 de octubre · <b>Feliz Día de la Hispanidad</b></span>';
    return p;
  }
  function franja(){ var i = document.createElement('i'); i.className = 'hisp-band'; i.setAttribute('aria-hidden', 'true'); return i; }

  function monta(){
    // portada: sello girando en la cabecera, franja que ondea y cinta de ciudades de España
    var hero = document.querySelector('.hero');
    if(hero){ hero.appendChild(sello()); hero.appendChild(franja()); }
    var cinta = document.querySelector('.tape--a .marquee-track');
    if(cinta){
      var T = ['Feliz Día de la Hispanidad', '12 de octubre', 'Desde España, a toda Europa', 'Madrid', 'Barcelona', 'Sevilla', 'Valencia', 'Bilbao', 'Málaga', 'Zaragoza', 'San Sebastián'];
      cinta.innerHTML = T.concat(T).map(function(t){ return '<span>' + esc(t) + '</span>'; }).join('');
    }
    // páginas interiores: etiqueta del día, sello y franja en la cabecera negra
    [].forEach.call(document.querySelectorAll('.page-head'), function(h){
      var c = h.querySelector('.container') || h;
      c.insertBefore(pill(true), c.firstChild);
      h.appendChild(sello()); h.appendChild(franja());
    });
    // cuenta y grupos: etiqueta del día en la tarjeta oscura
    [].forEach.call(document.querySelectorAll('.auth-art'), function(a){ a.insertBefore(pill(true), a.firstChild); });
    // sorteo: etiqueta arriba y franja abajo
    var srt = document.querySelector('.srt-page');
    if(srt){ var pp = pill(false); pp.classList.add('hisp-pill--srt'); srt.insertBefore(pp, srt.firstChild); srt.appendChild(franja()); }
    // pie: felicitación junto al copyright
    var pie = document.querySelector('.footer-bottom');
    if(pie){ var s = document.createElement('span'); s.className = 'hisp-foot'; s.innerHTML = '<i class="hisp-flag" aria-hidden="true"></i>Feliz Día de la Hispanidad'; pie.insertBefore(s, pie.firstChild); }
    sorteo();
    bienvenida();
  }
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', monta); else monta();
})();
