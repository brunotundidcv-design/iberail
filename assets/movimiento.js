/* Iberail — movimiento (v17.1). Estilos y curvas en assets/movimiento.css.
   Va en el <head> de las páginas públicas, justo después de movimiento.css (no en el panel ni en Zarping): la transición
   hacia atrás se decide en «pagereveal», antes de que se pinte la página. Lo demás espera a que esté el HTML.
   - Transición entre páginas hacia atrás: marca el tipo «atras» para que la animación vaya al revés.
   - Títulos que se revelan con máscara (.mv-titulo), piezas en cascada (.mv-grupo > .mv-pieza) y fotos que se destapan (.mv-foto).
   - Cuenta atrás: cada cifra nueva rueda. Cintas de ciudades: van más rápido mientras bajas y cambian de sentido si subes.
   - Carrusel de destinos: se arrastra con el ratón y sigue un poco por inercia al soltar.
   Con «reducir movimiento» no hace nada (salvo marcar la transición, que el CSS ya no anima). */
(function(){
  'use strict';

  /* ---------- transición entre páginas: hacia atrás, al revés ---------- */
  addEventListener('pagereveal', function(e){
    var nav = window.navigation, act = nav && nav.activation;
    if(!e.viewTransition || !act || act.navigationType !== 'traverse' || !act.from || !act.entry) return;
    if(act.entry.index < act.from.index) e.viewTransition.types.add('atras');
  });

  var quieto = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if(quieto || !('IntersectionObserver' in window)) return;
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', arranca); else arranca();

  function arranca(){
    var $$ = function(s, r){ return [].slice.call((r || document).querySelectorAll(s)); };

    // añade .is-in la primera vez que el elemento se ve
    var io = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target.classList.add('is-in'); io.unobserve(e.target); } });
    }, { threshold: .15, rootMargin: '0px 0px -6% 0px' });

    /* ---------- títulos ----------
       Se vigila el contenedor y no el título: el título empieza recortado del todo y así no «se vería» nunca. */
    var ioT = new IntersectionObserver(function(es){
      es.forEach(function(e){ if(e.isIntersecting){ e.target._mvTitulo.classList.add('is-in'); ioT.unobserve(e.target); } });
    }, { rootMargin: '0px 0px -10% 0px' });
    $$('.section-head h2, .quiz-head h2, .home-faq-head h2, .season-top h2, .srt-copy h2, .v16-story h2, .container > .cta h2').forEach(function(h){
      h.classList.add('mv-titulo'); h.parentElement._mvTitulo = h; ioT.observe(h.parentElement);
    });

    /* ---------- piezas en cascada ---------- */
    var GRUPOS = ['.v16-steps', '.v16-cifras .hero-stats', '.faq', '.countdown', '.timeline', '.footer-top', '#topDest', '.srt-steps', '.facts'];
    $$(GRUPOS.join(',')).forEach(function(g){
      g.classList.add('mv-grupo');
      [].forEach.call(g.children, function(c, i){
        c.removeAttribute('data-reveal');
        c.classList.add('mv-pieza'); c.style.setProperty('--mv-i', Math.min(i, 9));
      });
      io.observe(g);
    });
    // el panel de salidas se enciende fila a fila
    $$('.board').forEach(function(b){
      b.classList.add('mv-grupo');
      $$('.board-rows li', b).forEach(function(li, i){ li.style.setProperty('--mv-f', i); });
      io.observe(b);
    });

    /* ---------- fotos y vídeos que se destapan ---------- */
    $$('.video-frame').forEach(function(f){ f.removeAttribute('data-reveal'); f.classList.add('mv-foto'); io.observe(f); });

    /* ---------- cuenta atrás: cada cifra nueva rueda ---------- */
    if('MutationObserver' in window){
      $$('.countdown b').forEach(function(b){
        var antes = b.textContent;
        new MutationObserver(function(){
          if(b.textContent === antes) return; antes = b.textContent;
          b.classList.remove('mv-rueda'); void b.offsetWidth; b.classList.add('mv-rueda');
        }).observe(b, { childList: true, characterData: true, subtree: true });
      });
    }

    /* ---------- cintas: siguen a tu scroll ---------- */
    var cintas = $$('.tapes .marquee-track');
    if(cintas.length && cintas[0].getAnimations){
      var vel = 1, objetivo = 1, sentido = 1, ultY = scrollY, ultT = performance.now(), corre = false, viendo = false;
      var paso = function(){
        vel += (objetivo - vel) * .08;
        objetivo += (sentido - objetivo) * .05;   // vuelve sola a la velocidad normal, en el último sentido
        cintas.forEach(function(c){ c.getAnimations().forEach(function(a){ a.playbackRate = vel; }); });
        if(Math.abs(vel - sentido) > .01 || Math.abs(objetivo - sentido) > .01) requestAnimationFrame(paso); else corre = false;
      };
      new IntersectionObserver(function(es){ viendo = es[0].isIntersecting; }).observe(cintas[0].closest('.tapes'));
      addEventListener('scroll', function(){
        var t = performance.now(), dy = scrollY - ultY, v = dy / Math.max(1, t - ultT);
        ultY = scrollY; ultT = t;
        if(!viendo || !dy) return;
        sentido = dy > 0 ? 1 : -1;
        objetivo = sentido * Math.min(7, 1 + Math.abs(v) * 4);
        if(!corre){ corre = true; requestAnimationFrame(paso); }
      }, { passive: true });
    }

    /* ---------- carrusel de destinos: arrastrar con el ratón ---------- */
    $$('.v16-hs-track').forEach(function(p){
      p.classList.add('mv-arrastra');
      $$('img', p).forEach(function(i){ i.draggable = false; });
      var x0 = 0, s0 = 0, ultX = 0, ultT = 0, v = 0, abajo = false, movido = false, raf = 0;
      // que arrastrar no seleccione texto
      p.addEventListener('selectstart', function(e){ if(abajo) e.preventDefault(); });
      p.addEventListener('pointerdown', function(e){
        if(e.pointerType !== 'mouse' || e.button !== 0) return;
        cancelAnimationFrame(raf);
        abajo = true; movido = false; x0 = ultX = e.clientX; s0 = p.scrollLeft; ultT = performance.now(); v = 0;
      });
      addEventListener('pointermove', function(e){
        if(!abajo) return;
        var dx = e.clientX - x0;
        if(!movido && Math.abs(dx) > 5){ movido = true; p.classList.add('is-arrastrando'); try{ getSelection().removeAllRanges(); }catch(err){} }
        if(!movido) return;
        p.scrollLeft = s0 - dx;
        var t = performance.now(); v = (e.clientX - ultX) / Math.max(1, t - ultT) * 16; ultX = e.clientX; ultT = t;
      });
      addEventListener('pointerup', function(){
        if(!abajo) return; abajo = false;
        if(!movido) return;
        // que el clic de soltar no abra la tarjeta
        var bloquea = function(e){ e.preventDefault(); e.stopPropagation(); };
        p.addEventListener('click', bloquea, true);
        setTimeout(function(){ p.removeEventListener('click', bloquea, true); }, 0);
        (function inercia(){
          v *= .93; p.scrollLeft -= v;
          if(Math.abs(v) > .4) raf = requestAnimationFrame(inercia);
          else p.classList.remove('is-arrastrando');
        })();
      });
    });
  }
})();
