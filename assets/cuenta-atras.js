/* Iberail — cuenta atrás del sorteo a pantalla completa (página sorteo.html y simulador del panel)
   · IBCuenta.mount(el, { at, musica, sim, tanda, entradas, total, onZero, estado })  →  { set(o), destroy(seguir) }
       at       fecha/hora del sorteo (Date) · musica  url del mp3 del panel (si no hay, el tema de assets/musica.js)
       estado   función que devuelve el HTML de debajo (participar, tiradas…), se repinta cuando cambia
   · IBCuenta.simular({ segundos, musica, onZero })  →  la abre encima de todo (panel)
   La música empieza a falta de 6 minutos (IBBanda.INICIO_MS) y NO se corta en el 0: el tema hace el drop final y
   pasa solo a la base de tensión de la ruleta (assets/musica.js). El navegador no deja sonar nada hasta que la
   persona lo pide: solo suena si pulsa «Activar sonido» (v9.2: ya no arranca con cualquier toque en la página).
   Con un mp3 subido, va sincronizado con la cuenta atrás (su final cae en el 0) y en el 0 entra la base de tensión. */
(function(){
  const FINAL = 5 * 60 * 1000;   // modo final (visual)
  const MUSICA = (window.IBBanda && IBBanda.INICIO_MS) || 6 * 60 * 1000;   // desde aquí suena la música
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  const SND = 'ib-srt-snd';
  const setSndPref = v => { try{ localStorage.setItem(SND, v ? '1' : '0'); }catch(e){} };
  const banda = () => window.IBBanda || null;

  function mount(el, o){
    o = { ...o };
    let son = false, mp3 = null, fin = false, ultS = -1, t = null, vivo = true;
    el.classList.add('cta');
    el.innerHTML = `
      <div class="cta-bg" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="cta-in">
        <span class="cta-k" data-k></span>
        <h1 class="cta-h">Sorteo <em>Ultra Europe</em> 2027</h1>
        <p class="cta-sub" data-sub></p>
        <div class="cta-clock" data-clock role="timer" aria-live="off"></div>
        <p class="cta-msg" data-msg></p>
        <button type="button" class="cta-snd" data-snd hidden></button>
        <div class="cta-st" data-st></div>
        <small class="cta-f">Sorteo gratuito para mayores de 18 años · <a href="bases-sorteo.html">Bases legales</a></small>
      </div>`;
    const $ = s => el.querySelector(s);
    const put = (n, h) => { if(n._h !== h){ n._h = h; n.innerHTML = h; } };
    const clock = $('[data-clock]'), msg = $('[data-msg]'), sndB = $('[data-snd]'), st = $('[data-st]');
    const resto = () => Math.max(0, o.at - Date.now());

    function pintarSnd(rest){
      const enMusica = rest > 0 && rest <= MUSICA;
      sndB.hidden = !(rest > 0 && rest <= MUSICA + 10 * 60 * 1000);
      sndB.classList.toggle('is-on', son);
      put(sndB, son ? 'Sonido activado · quitar' : (enMusica ? 'Activar sonido' : 'Activar sonido (la música empieza a falta de 6 minutos)'));
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
      // sin cortes: con el tema propio, el drop final ya está sonando y pasa solo a la tensión; con mp3, entra la base
      if(son){
        if(mp3 && !mp3.paused) setTimeout(() => mp3 && fade(mp3, 0, 2500), 400);
      }
      if(o.onZero) o.onZero();
    }

    function tick(){
      if(!vivo) return;
      const rest = resto();
      const sub = o.at && o.entradas ? `Sorteamos <b>${o.entradas}</b> ${o.entradas == 1 ? 'entrada' : 'entradas'} para el Ultra Europe` : '';
      put($('[data-k]'), o.sim ? 'Simulación · no cuenta' : (o.at ? `<i></i>${esc(new Date(o.at).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' }))} · ${esc(new Date(o.at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }))} h` : 'Próximo sorteo'));
      put($('[data-sub]'), sub);
      el.classList.toggle('is-final', rest > 0 && rest <= FINAL);
      el.classList.toggle('is-last', rest > 0 && rest <= 10000);
      el.classList.toggle('is-zero', !!o.at && rest <= 0);
      if(!o.at){ put(clock, '<b class="cta-soon">Muy pronto</b>'); }
      else if(rest <= 0){
        put(clock, '<b class="cta-now">¡Ya!</b>');
        if(!fin) alCero();
      } else {
        const d = Math.floor(rest / 864e5), h = Math.floor(rest / 36e5) % 24, m = Math.floor(rest / 6e4) % 60, s = Math.floor(rest / 1e3) % 60;
        const u = rest <= FINAL ? [[m, 'min'], [s, 'seg']] : d ? [[d, d === 1 ? 'día' : 'días'], [h, 'horas'], [m, 'min'], [s, 'seg']] : [[h, 'horas'], [m, 'min'], [s, 'seg']];
        if(rest <= 10000) put(clock, `<b class="cta-big">${Math.ceil(rest / 1000)}</b>`);
        else put(clock, u.map(([v, k]) => `<span class="cta-u"><b>${pad(v)}</b><small>${k}</small></span>`).join('<i class="cta-sep">:</i>'));
        const sec = Math.ceil(rest / 1000);
        if(sec !== ultS){ ultS = sec; if(rest <= MUSICA) arrancarMusica(); }
      }
      put(msg, !o.at ? 'Pronto habrá un nuevo sorteo. Si estás apuntado, entras en todos sin hacer nada.'
        : rest <= 0 ? 'Entra en tu cuenta y mira tu resultado.'
        : rest <= 10000 ? 'Ya casi está.'
        : rest <= 60000 ? 'Último minuto.'
        : rest <= FINAL ? 'Recta final: quedan menos de 5 minutos'
        : 'para ver los resultados del sorteo');
      pintarSnd(rest);
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
        vivo = false; clearInterval(t);
        if(!seguir) pararMusica();
        else if(mp3 && !mp3.paused){ const m = mp3; setTimeout(() => fade(m, 0, 2200), 300); }
        el.innerHTML = ''; el.classList.remove('cta', 'is-final', 'is-last', 'is-zero');
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
      estado: rest => rest > 0 ? '<div class="cta-ok">✓ Así lo verá una persona apuntada con su sesión iniciada</div>' : '',
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
