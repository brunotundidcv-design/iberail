/* Iberail — cuenta atrás del sorteo (página sorteo.html y simulador del panel)
   v16.6: tarjeta en el estilo del «Inicio» de la cuenta (Unbounded, etiquetas en Geist Mono, cajas de cristal).
   Las cifras ruedan (la vieja sube y se desenfoca, la nueva entra desde abajo), chispas y confeti en canvas.
   Estilos en assets/sorteo-v2.css.
   · IBCuenta.mount(el, { at, musica, sim, tanda, entradas, total, onZero, estado })  →  { set(o), destroy(seguir) }
       at       fecha/hora del sorteo (Date) · musica  url del mp3 del panel (si no hay, el tema de assets/musica.js)
       estado   función que devuelve el HTML de debajo (participar, calendario, ver resultado…), se repinta cuando cambia
       Sin «at» (no hay sorteo programado): «muy pronto» y, mientras tanto, la cuenta atrás al Ultra Europe.
   · IBCuenta.simular({ segundos, musica, onZero })  →  la abre encima de todo (panel)
   La música empieza a falta de 6 minutos (IBBanda.INICIO_MS) y NO se corta en el 0: el tema hace el drop final y
   pasa solo a la base de tensión de la ruleta (assets/musica.js). El navegador no deja sonar nada hasta que la
   persona lo pide: solo suena si pulsa «Activar sonido» (v9.2: ya no arranca con cualquier toque en la página).
   Con un mp3 subido, va sincronizado con la cuenta atrás (su final cae en el 0) y en el 0 entra la base de tensión. */
(function(){
  const FINAL = 5 * 60 * 1000;   // modo final (visual)
  const MUSICA = (window.IBBanda && IBBanda.INICIO_MS) || 6 * 60 * 1000;   // desde aquí suena la música
  const ULTRA = Date.UTC(2027, 6, 8, 22, 0);        // 9 jul 2027 a las 00:00 en Madrid
  const ULTRA_ANT = Date.UTC(2026, 6, 12, 22, 0);   // fin del Ultra 2026: desde aquí cuenta «la espera»
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const SND = 'ib-srt-snd';
  const setSndPref = v => { try{ localStorage.setItem(SND, v ? '1' : '0'); }catch(e){} };
  const banda = () => window.IBBanda || null;
  const quieto = () => { try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } };

  /* ---------- cifras que ruedan ---------- */
  function cifra(d, v){
    if(d._v === v) return;
    const old = d.lastElementChild; d._v = v;
    const n = document.createElement('i'); n.textContent = v;
    if(old && !quieto()){
      n.className = 'is-in'; old.className = 'is-out';
      setTimeout(() => old.remove(), 520);
    } else if(old) old.remove();
    d.appendChild(n);
  }
  // fila de cajas [[valor, etiqueta, máximo], …]: solo rehace el HTML si cambian las unidades o el número de cifras.
  // Con máximo, la caja lleva una barrita que se vacía (horas de 24, minutos y segundos de 60);
  // la última caja da un «latido» cada vez que cambia.
  function fila(box, units, cls){
    const vals = units.map(([v]) => pad(v));
    const key = cls + '|' + units.map(([, k], i) => k + vals[i].length).join(',');
    if(box._k !== key){
      box._k = key; box._u = null;
      box.innerHTML = `<div class="${cls}">` + units.map(([, k, max], i) => `<div class="sx-u" style="--i:${i}"><b>${'<span class="sx-dg"></span>'.repeat(vals[i].length)}</b><small>${k}</small>${max ? '<i class="sx-ub"><i></i></i>' : ''}</div>`).join('') + '</div>';
    }
    const us = box.querySelectorAll('.sx-u');
    units.forEach(([v, , max], i) => {
      const ds = us[i].querySelectorAll('.sx-dg'); vals[i].split('').forEach((c, j) => cifra(ds[j], c));
      if(max){ const b = us[i].querySelector('.sx-ub i'); if(b) b.style.width = (v / max * 100).toFixed(2) + '%'; }
    });
    const last = vals[vals.length - 1], lu = us[us.length - 1];
    if(box._u != null && box._u !== last && lu && !quieto()){ lu.classList.remove('is-beat'); void lu.offsetWidth; lu.classList.add('is-beat'); }
    box._u = last;
    box.setAttribute('aria-label', units.map(([v, k]) => v + ' ' + k).join(', '));
  }
  const partes = rest => ({ d: Math.floor(rest / 864e5), h: Math.floor(rest / 36e5) % 24, m: Math.floor(rest / 6e4) % 60, s: Math.floor(rest / 1e3) % 60 });

  /* ---------- chispas y confeti (canvas) ---------- */
  const COLS = ['#FFB81C', '#FF5A36', '#FF2E88', '#8C5CFF', '#33E1FF', '#3DFFB4', '#FFFFFF'];
  function efectos(cv, host){
    const c = cv.getContext('2d'); let w = 0, h = 0, raf = 0, vivo = true, visible = true, rapido = 1;
    const p = [];
    const size = () => { const dpr = Math.min(2, window.devicePixelRatio || 1); w = cv.clientWidth; h = cv.clientHeight; cv.width = w * dpr; cv.height = h * dpr; c.setTransform(dpr, 0, 0, dpr, 0, 0); };
    const chispa = abajo => ({ k: 'c', x: Math.random() * w, y: abajo ? h + 6 : Math.random() * h, vx: (Math.random() - .5) * .2, vy: -(.15 + Math.random() * .5),
      r: .5 + Math.random() * 1.4, a: .2 + Math.random() * .5, col: COLS[(Math.random() * 6) | 0], tw: Math.random() * 6.28 });
    size(); for(let i = 0, n = w < 600 ? 18 : 34; i < n; i++) p.push(chispa(false));
    const ro = window.ResizeObserver ? new ResizeObserver(size) : null; if(ro) ro.observe(cv); else window.addEventListener('resize', size);
    const io = window.IntersectionObserver ? new IntersectionObserver(es => { visible = es[0].isIntersecting; if(visible) loop(); }) : null; if(io) io.observe(host);
    function loop(){
      cancelAnimationFrame(raf);
      if(!vivo || !visible || document.hidden || quieto()) return;
      c.clearRect(0, 0, w, h);
      c.globalCompositeOperation = 'lighter';
      for(let i = p.length - 1; i >= 0; i--){
        const q = p[i];
        if(q.k === 'c'){
          q.x += q.vx; q.y += q.vy * rapido; q.tw += .05;
          if(q.y < -6){ p[i] = chispa(true); continue; }
          c.globalAlpha = q.a * (.55 + .45 * Math.sin(q.tw)); c.fillStyle = q.col;
          c.beginPath(); c.arc(q.x, q.y, q.r, 0, 6.283); c.fill();
        } else {
          q.vy += .16; q.vx *= .99; q.x += q.vx; q.y += q.vy; q.rot += q.vr; q.life--;
          if(q.life <= 0 || q.y > h + 20){ p.splice(i, 1); continue; }
          c.globalAlpha = Math.min(1, q.life / 40); c.fillStyle = q.col;
          c.save(); c.translate(q.x, q.y); c.rotate(q.rot); c.fillRect(-q.s / 2, -q.s / 4, q.s, q.s / 2); c.restore();
        }
      }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      raf = requestAnimationFrame(loop);
    }
    const vis = () => { if(!document.hidden) loop(); };
    document.addEventListener('visibilitychange', vis);
    loop();
    return {
      boom(n){
        if(quieto()) return;
        for(let i = 0; i < (n || 180); i++){
          const a = Math.random() * 6.283, v = 3 + Math.random() * 9;
          p.push({ k: 'f', x: w / 2, y: h * .45, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 5, rot: Math.random() * 6, vr: (Math.random() - .5) * .4, s: 5 + Math.random() * 7, col: COLS[(Math.random() * 7) | 0], life: 130 + Math.random() * 70 });
        }
        loop();
      },
      ritmo(x){ rapido = x; },
      stop(){ vivo = false; cancelAnimationFrame(raf); document.removeEventListener('visibilitychange', vis); if(ro) ro.disconnect(); else window.removeEventListener('resize', size); if(io) io.disconnect(); }
    };
  }

  function mount(el, o){
    o = { ...o };
    let son = false, mp3 = null, fin = false, ultS = -1, t = null, vivo = true, ultBig = '';
    el.classList.add('sx');
    el.innerHTML = `
      <div class="sx-hero">
        <canvas class="sx-fx" aria-hidden="true"></canvas>
        <div class="sx-top"><small data-k></small><span class="sx-live" data-live></span></div>
        <h2 class="sx-t" data-h></h2>
        <div class="sx-clock" data-clock role="timer" aria-live="off"></div>
        <p class="sx-msg" data-msg></p>
        <div class="sx-wait" data-wait></div>
        <div class="sx-tl" data-tl></div>
        <div class="sx-prem" data-prem></div>
        <button type="button" class="sx-snd" data-snd hidden></button>
        <div class="sx-st" data-st></div>
      </div>`;
    const $ = s => el.querySelector(s);
    const put = (n, h) => { if(n._h !== h){ n._h = h; n.innerHTML = h; } };
    const hm = t => new Date(t).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
    // «Hoy», «Mañana» o «El viernes» (en hora de España)
    const cuando = at => {
      const dia = t => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
      const dd = Math.round((new Date(dia(at)) - new Date(dia(Date.now()))) / 864e5);
      return dd <= 0 ? 'Hoy' : dd === 1 ? 'Mañana' : 'El ' + new Date(at).toLocaleDateString('es-ES', { weekday: 'long', timeZone: 'Europe/Madrid' });
    };

    // la noche del sorteo en una línea: ahora → entra en la web (10 min antes) → el sorteo → tu resultado.
    // El punto avanza solo: el primer tramo son las 24 h de antes, el segundo esos 10 minutos.
    const ENTRA = 10 * 60 * 1000;
    function linea(rest){
      const tl = $('[data-tl]');
      if(!o.at || rest <= 0){ if(tl._k){ tl._k = ''; tl.innerHTML = ''; } return; }
      const at = +o.at;
      if(tl._k !== String(at)){
        tl._k = String(at);
        const pasos = [['Ahora', 'Cuenta atrás'], [hm(at - ENTRA), 'Entra en la web'], [hm(at), 'El sorteo'], ['Al momento', 'Tu resultado']];
        tl.innerHTML = `<span class="sx-tl-l">${pasos.map((_, i) => `<b style="--x:${i / 3}"></b>`).join('')}<i class="sx-tl-f"></i><i class="sx-tl-p"></i></span>
          <ol>${pasos.map(([a, b], i) => `<li style="--x:${i / 3}"><b>${a}</b><small>${b}</small></li>`).join('')}</ol>`;
      }
      const now = Date.now(); let p = 0;
      [[at - 864e5, at - ENTRA], [at - ENTRA, at]].forEach(([a, b], i) => { if(now >= b) p = (i + 1) / 3; else if(now > a) p = Math.max(p, (i + (now - a) / (b - a)) / 3); });
      tl.style.setProperty('--p', p.toFixed(4));
      tl.querySelectorAll('li').forEach((li, i) => li.classList.toggle('is-done', p >= i / 3 - .0001));
    }
    // las entradas que se sortean, como entraditas doradas
    function premio(rest){
      const n = Number(o.entradas) || 0;
      if(!o.at || rest <= 0 || !n){ put($('[data-prem]'), ''); return; }
      const tk = Array.from({ length: Math.min(n, 6) }, (_, i) => `<i style="--i:${i}"></i>`).join('') + (n > 6 ? `<em>+${n - 6}</em>` : '');
      put($('[data-prem]'), `<span class="sx-prem-tk" aria-hidden="true">${tk}</span><span class="sx-prem-t"><b>${n} ${n == 1 ? 'entrada' : 'entradas'} en juego</b><small>Abono de 3 días · Ultra Europe 2027 · Split</small></span>`);
    }
    const clock = $('[data-clock]'), msg = $('[data-msg]'), sndB = $('[data-snd]'), st = $('[data-st]');
    const fx = efectos($('.sx-fx'), el);
    const resto = () => Math.max(0, o.at - Date.now());

    function pintarSnd(rest){
      const enMusica = rest > 0 && rest <= MUSICA;
      sndB.hidden = !(rest > 0 && rest <= MUSICA + 10 * 60 * 1000);
      sndB.classList.toggle('is-on', son);
      put(sndB, '<span class="sx-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>' + (son ? 'Sonido activado · quitar' : (enMusica ? 'Activar sonido' : 'Activar sonido (la música empieza a falta de 6 minutos)')));
    }

    /* ---------- mp3 del panel ---------- */
    function fade(a, to, ms){
      const from = a.volume, t0 = performance.now();
      const step = () => { const x = Math.min(1, (performance.now() - t0) / ms); try{ a.volume = from + (to - from) * x; }catch(e){} if(x < 1) requestAnimationFrame(step); else if(to === 0) a.pause(); };
      requestAnimationFrame(step);
    }
    // ventana del mp3: si dura 6 min o más, su final cae en el 0; si dura menos, empieza cuando falta lo que dura
    const ventanaMp3 = () => { const d = mp3 && mp3.duration; return d && isFinite(d) ? Math.min(MUSICA, d * 1000) : MUSICA; };
    function sincronizar(){
      if(!mp3) return; const d = mp3.duration; if(!d || !isFinite(d)) return;
      const r = resto() / 1000;   // segundos que quedan
      try{ mp3.currentTime = Math.max(0, Math.min(d - .05, d - r)); }catch(e){}
    }
    function crearMp3(){
      if(!o.musica || mp3) return;
      mp3 = new Audio(o.musica); mp3.preload = 'auto'; mp3.volume = 0;
      mp3.addEventListener('error', () => { mp3 = null; o.musica = ''; if(son && resto() <= MUSICA) arrancarMusica(); }, { once: true });
      // «cebado» dentro del toque (play en silencio y pausa) para que luego pueda sonar solo, también en iPhone
      try{ const m = mp3; m.muted = true; m.play().then(() => { if(m === mp3 && !m._sinc){ m.pause(); } m.muted = false; }).catch(() => { m.muted = false; }); }catch(e){}
    }

    /* ---------- música ---------- */
    function arrancarMusica(){
      if(!son || fin) return;
      const rest = resto();
      if(o.musica){
        crearMp3(); if(!mp3) return;
        if(rest > ventanaMp3()) return;
        if(mp3.paused || !mp3._sinc){
          if(mp3.readyState >= 1) sincronizar(); else mp3.addEventListener('loadedmetadata', sincronizar, { once: true });
          mp3._sinc = true; mp3.muted = false;
          mp3.play().then(() => fade(mp3, .95, 1200)).catch(() => {});
        }
        return;
      }
      if(banda() && rest <= MUSICA) banda().cuenta(+o.at);
    }
    function pararMusica(){ if(banda()) banda().parar(.5); if(mp3){ fade(mp3, 0, 500); mp3._sinc = false; } }
    function desbloquear(){
      try{ if(window.IBSonido) IBSonido.unlock(); }catch(e){}
      try{ if(banda()) banda().mudo(false); }catch(e){}
      crearMp3();
    }

    sndB.addEventListener('click', () => {
      son = !son; setSndPref(son);
      if(son){ desbloquear(); arrancarMusica(); } else pararMusica();
      pintarSnd(resto());
    });

    function alCero(){
      fin = true;
      fx.boom(200); setTimeout(() => vivo && fx.boom(120), 700);
      // sin cortes: con el tema propio, el drop final ya está sonando y pasa solo a la tensión; con mp3, entra la base
      if(son){
        if(mp3 && !mp3.paused) setTimeout(() => mp3 && fade(mp3, 0, 2500), 400);
      }
      if(o.onZero) o.onZero();
    }

    const fecha = at => `${esc(new Date(at).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' }))} · ${esc(new Date(at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }))} h`;
    function tick(){
      if(!vivo) return;
      const rest = resto(), n = o.entradas, ent = n ? `${n} ${n == 1 ? 'entrada' : 'entradas'}` : 'entradas';
      const enFinal = rest > 0 && rest <= FINAL, cero = !!o.at && rest <= 0;
      el.classList.toggle('is-soon', !o.at);
      el.classList.toggle('is-final', enFinal);
      el.classList.toggle('is-last', rest > 0 && rest <= 10000);
      el.classList.toggle('is-zero', cero);
      fx.ritmo(enFinal ? 3 : 1);
      put($('[data-k]'), o.sim ? 'Simulación · no cuenta' : o.at ? fecha(o.at) : 'Próximo sorteo');
      put($('[data-live]'), !o.at ? '<i></i>Muy pronto' : cero ? '<i></i>Ahora' : enFinal ? '<i></i>Recta final' : '<i></i>En directo');
      put($('[data-h]'), !o.at ? 'El próximo sorteo, <em>muy pronto</em>' : cero ? '<em>¡Es la hora!</em>' : `${cuando(o.at)} sorteamos <em>${ent}</em>`);
      if(!o.at){
        // sin sorteo programado: mientras tanto, lo que falta para el festival
        const u = partes(Math.max(0, ULTRA - Date.now()));
        fila(clock, [[u.d, u.d === 1 ? 'día' : 'días'], [u.h, 'horas', 24], [u.m, 'min', 60], [u.s, 'seg', 60]], 'sx-cd');
      } else if(cero){
        if(clock._k !== 'now'){ clock._k = 'now'; clock.innerHTML = '<b class="sx-now">¡Ya!</b>'; }
        if(!fin) alCero();
      } else if(rest <= 10000){
        const s = String(Math.ceil(rest / 1000));
        if(clock._k !== 'big' || ultBig !== s){ clock._k = 'big'; ultBig = s; clock.innerHTML = `<b class="sx-big">${s}</b>`; }
        clock.setAttribute('aria-label', s + ' segundos');
      } else {
        const u = partes(rest);
        const H = [u.h, 'horas', 24], Mi = [u.m, 'min', 60], S = [u.s, 'seg', 60];
        const units = enFinal ? [Mi, S] : u.d ? [[u.d, u.d === 1 ? 'día' : 'días'], H, Mi, S] : [H, Mi, S];
        fila(clock, units, 'sx-cd' + (enFinal ? ' sx-cd--final' : ''));
      }
      linea(rest); premio(rest);
      if(o.at && rest > 0){ const sec = Math.ceil(rest / 1000); if(sec !== ultS){ ultS = sec; if(rest <= MUSICA) arrancarMusica(); } }
      put(msg, !o.at ? 'Mientras tanto, esto es lo que falta para el <b>Ultra Europe 2027</b> en Split. Si estás apuntado, entras en el próximo sorteo sin hacer nada.'
        : cero ? 'Entra en tu cuenta y mira tu resultado.'
        : rest <= 10000 ? 'Ya casi está.'
        : rest <= 60000 ? 'Último minuto.'
        : enFinal ? 'Recta final: quedan menos de 5 minutos.'
        : '');   // el resto del tiempo lo cuenta la línea de la noche
      // barra de espera: sin sorteo, del último Ultra al próximo
      if(!o.at){
        const pc = Math.min(99, Math.max(1, Math.round((Date.now() - ULTRA_ANT) / (ULTRA - ULTRA_ANT) * 100)));
        put($('[data-wait]'), `<span><i style="width:${pc}%"></i></span><small>Del último Ultra al próximo: llevamos el ${pc}% de la espera</small>`);
      } else put($('[data-wait]'), '');
      pintarSnd(o.at ? rest : Infinity);
      if(o.estado) put(st, o.estado(rest));
    }
    tick(); t = setInterval(tick, 250);
    return {
      set(n){
        const at0 = o.at, m0 = o.musica; o = { ...o, ...n };
        if(+at0 !== +o.at){ fin = resto() <= 0; if(son && banda() && !o.musica) arrancarMusica(); }
        if((o.musica || '') !== (m0 || '')){ if(mp3){ mp3.pause(); mp3 = null; } if(banda() && o.musica) banda().parar(.3); if(son) arrancarMusica(); }   // ha llegado el mp3 del panel
        tick();
      },
      // seguir = true: se quita la cuenta atrás pero la música continúa (pasa a la ruleta sin cortes)
      destroy(seguir){
        vivo = false; clearInterval(t); fx.stop();
        if(!seguir) pararMusica();
        else if(mp3 && !mp3.paused){ const m = mp3; setTimeout(() => fade(m, 0, 2200), 300); }
        el.innerHTML = ''; el.classList.remove('sx', 'is-soon', 'is-final', 'is-last', 'is-zero');
      }
    };
  }

  /* ======================= simulador (panel) ======================= */
  function simular(op){
    op = op || {};
    const wrap = document.createElement('div');
    wrap.className = 'cta-sim'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-modal', 'true'); wrap.setAttribute('aria-label', 'Simulación de la cuenta atrás');
    wrap.innerHTML = '<button type="button" class="cta-sim-x" aria-label="Cerrar simulación">✕ Cerrar simulación</button><div class="cta-sim-in"></div>';
    document.body.appendChild(wrap); document.body.classList.add('srt-lock');
    let cerrado = false;
    const c = mount(wrap.querySelector('.cta-sim-in'), {
      at: new Date(Date.now() + (op.segundos || 380) * 1000), musica: op.musica || '', sim: true,
      tanda: op.tanda, entradas: op.entradas, total: op.total,
      estado: rest => rest > 0 ? '<div class="sx-ok">✓ Así lo verá una persona apuntada con su sesión iniciada</div>' : '',
      onZero: () => { if(op.onZero) setTimeout(() => { if(!cerrado) op.onZero(); }, 2200); }
    });
    // seguir = true cuando pasa a la ruleta: la música no se corta
    const close = seguir => { if(cerrado) return; cerrado = true; c.destroy(seguir === true); wrap.remove(); document.body.classList.remove('srt-lock'); };
    wrap.querySelector('.cta-sim-x').addEventListener('click', () => close(false));
    // en la simulación, el clic del panel ya cuenta como permiso: se activa el sonido con su botón
    setTimeout(() => { const b = wrap.querySelector('[data-snd]'); if(b && !b.classList.contains('is-on')) b.click(); }, 30);
    return { close };
  }

  window.IBCuenta = { mount, simular, FINAL, MUSICA };
})();
