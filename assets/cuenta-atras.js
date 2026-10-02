/* Iberail — cuenta atrás del sorteo a pantalla completa (página sorteo.html y simulador del panel)
   · IBCuenta.mount(el, { at, musica, sim, tanda, entradas, total, onZero, estado })  →  { set(o), destroy(seguir) }
       at       fecha/hora del sorteo (Date) · musica  url del mp3 del panel (si no hay, el tema de assets/musica.js)
       estado   función que devuelve el HTML de debajo (participar, tiradas…), se repinta cuando cambia
   · IBCuenta.simular({ segundos, musica, onZero })  →  la abre encima de todo (panel)
   La música y el modo final empiezan cuando quedan 8:51 (IBBanda.INICIO_MS, en assets/musica.js). Sin mp3 suena el tema de la
   web, que NO se corta en el 0: hace el drop final y pasa solo a la base de tensión de la ruleta. El navegador no deja sonar nada hasta que la
   persona toca la página: por eso el botón grande de «Activar sonido» (cualquier toque en la página también vale).
   Una vez activado, el botón desaparece: en el sorteo no hay opción de silenciar (decisión de Bruno).
   Con un mp3 subido (el de Bruno), va sincronizado con la cuenta atrás (su final cae en el 0) y lleva un ECO al final:
   se abre en los últimos segundos y, cuando la canción acaba, las repeticiones siguen y se apagan despacio. En el 0 no
   entra ninguna música de la web. */
(function(){
  const MUSICA = (window.IBBanda && IBBanda.INICIO_MS) || (8 * 60 + 52) * 1000;   // desde aquí suena la música (el reloj marca 8:51)
  const FINAL = MUSICA;   // y a la vez entra el modo final (visual)
  const minTxt = ms => { const x = Math.floor(ms / 1000) - 1; return `${Math.floor(x / 60)}:${pad(x % 60)}`; };   // 532 000 → «8:51»
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const pad = n => String(n).padStart(2, '0');
  try{ localStorage.removeItem('ib-srt-snd'); }catch(e){}   // preferencia del antiguo botón de silencio
  const banda = () => window.IBBanda || null;
  // eco del final de la canción del panel: «chill», que se note pero sin pasarse
  const ECO = { retardo: .5, realim: .68, envio: .4, salida: .6, abre: 7, cola: 9, filtro: 3400 };
  //  retardo  s entre repeticiones · realim  cuánto vuelve cada repetición · envio  cuánta canción entra al eco
  //  salida   volumen del eco · abre  s antes del final en los que se va abriendo · cola  s que tarda en apagarse al acabar
  const ctxAudio = () => { try{ return (window.IBSonido && IBSonido.ctx && IBSonido.ctx()) || null; }catch(e){ return null; } };

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
      sndB.hidden = son || !(rest > 0 && rest <= MUSICA + 10 * 60 * 1000);   // solo para activarlo; no se puede quitar
      sndB.classList.toggle('is-pulse', enMusica);
      put(sndB, enMusica ? '🔊 Activa el sonido para vivir el final' : `🔊 Activa el sonido: la música empieza cuando queden ${minTxt(MUSICA)}`);
    }

    /* ---------- mp3 del panel (con eco al final) ---------- */
    function fade(a, to, ms){
      const from = a.volume, t0 = performance.now();
      const step = () => { const x = Math.min(1, (performance.now() - t0) / ms); try{ a.volume = from + (to - from) * x; }catch(e){} if(x < 1) requestAnimationFrame(step); else if(to === 0) a.pause(); };
      requestAnimationFrame(step);
    }
    // ventana del mp3: si dura 8:51 o más, su final cae en el 0; si dura menos, empieza cuando falta lo que dura
    const ventanaMp3 = () => { const d = mp3 && mp3.duration; return d && isFinite(d) ? Math.min(MUSICA, d * 1000) : MUSICA; };
    function sincronizar(){
      if(!mp3) return; const d = mp3.duration; if(!d || !isFinite(d)) return;
      const r = resto() / 1000;   // segundos que quedan
      try{ mp3.currentTime = Math.max(0, Math.min(d - .05, d - r)); }catch(e){}
    }
    // la canción va por Web Audio: «seco» a la salida y un envío al eco (retardo con realimentación y filtro)
    function enrutar(m){
      const ac = ctxAudio(); if(!ac || !ac.createMediaElementSource) return null;
      try{
        const src = ac.createMediaElementSource(m);
        const seco = ac.createGain(), envio = ac.createGain(), del = ac.createDelay(2), fb = ac.createGain(), filtro = ac.createBiquadFilter(), wet = ac.createGain();
        seco.gain.value = 0; envio.gain.value = 0; del.delayTime.value = ECO.retardo; fb.gain.value = ECO.realim; wet.gain.value = ECO.salida;
        filtro.type = 'lowpass'; filtro.frequency.value = ECO.filtro; filtro.Q.value = .5;
        src.connect(seco).connect(ac.destination);
        src.connect(envio).connect(del); del.connect(filtro); filtro.connect(fb).connect(del); filtro.connect(wet).connect(ac.destination);
        return { ac, seco, envio, fb, filtro, wet };
      }catch(e){ return null; }
    }
    const rampa = (p, v, ac, seg) => { const t = ac.currentTime; p.cancelScheduledValues(t); p.setValueAtTime(p.value, t); p.linearRampToValueAtTime(v, t + seg); };
    function crearMp3(sinEco){
      if(!o.musica || mp3) return;
      const m = mp3 = new Audio();
      if(!sinEco) m.crossOrigin = 'anonymous';   // sin esto el navegador no deja pasar la canción por el eco (sale en silencio)
      m.preload = 'auto'; m.src = o.musica;
      m._ruta = sinEco ? null : enrutar(m);
      m.volume = m._ruta ? 1 : 0;                // con eco, el volumen se lleva con Web Audio (también en iPhone)
      m.addEventListener('error', () => {
        if(mp3 !== m) return;
        mp3 = null;
        if(!sinEco){ crearMp3(true); if(son) arrancarMusica(); return; }   // el servidor no deja: sin eco, pero que suene
        o.musica = ''; if(son && resto() <= MUSICA) arrancarMusica();
      }, { once: true });
      // el eco se va abriendo en los últimos segundos y, al acabar, se queda sonando y se apaga
      m.addEventListener('timeupdate', () => {
        const r = m._ruta, d = m.duration; if(!r || m._abierto || !d || !isFinite(d)) return;
        const q = d - m.currentTime; if(q > ECO.abre || q <= 0) return;
        m._abierto = true; rampa(r.envio.gain, ECO.envio, r.ac, Math.max(.5, q - .3));
      });
      m.addEventListener('ended', () => cola(m));
      // desbloqueo dentro del toque (play + pause en el acto): luego puede sonar sola, también en iPhone
      try{ m.muted = true; const p = m.play(); m.pause(); if(p && p.catch) p.catch(() => {}); m.muted = false; }catch(e){ m.muted = false; }
    }
    function volumenMp3(m, to, ms){
      if(!m) return;
      if(m._ruta){ rampa(m._ruta.seco.gain, to, m._ruta.ac, ms / 1000); if(to === 0) setTimeout(() => m.pause(), ms + 60); }
      else fade(m, to, ms);
    }
    // final de la canción: lo último que suena se repite en eco, cada vez más bajo y más apagado (no se corta)
    function cola(m){
      if(!m || m._cola) return; m._cola = true;
      const r = m._ruta;
      if(!r){ if(!m.paused) fade(m, 0, 2500); return; }
      const ac = r.ac, quedaba = !m.paused && !m.ended;
      if(quedaba){ rampa(r.envio.gain, ECO.envio, ac, .2); volumenMp3(m, 0, 700); }   // si aún le quedaba algo, baja y entra al eco
      const t = ac.currentTime + (quedaba ? .7 : 0);
      setTimeout(() => { try{ rampa(r.envio.gain, 0, ac, .4); }catch(e){} }, quedaba ? 800 : 0);
      try{
        r.wet.gain.setValueAtTime(r.wet.gain.value, t); r.wet.gain.setTargetAtTime(0, t + .6, ECO.cola / 4);
        r.filtro.frequency.setValueAtTime(ECO.filtro, t); r.filtro.frequency.exponentialRampToValueAtTime(450, t + ECO.cola);
        r.fb.gain.setValueAtTime(ECO.realim, t); r.fb.gain.linearRampToValueAtTime(ECO.realim * .6, t + ECO.cola);
      }catch(e){}
    }
    function cortarEco(m){ if(m && m._ruta){ try{ rampa(m._ruta.wet.gain, 0, m._ruta.ac, .4); rampa(m._ruta.envio.gain, 0, m._ruta.ac, .2); }catch(e){} } }

    /* ---------- música ---------- */
    function arrancarMusica(){
      if(!son || fin) return;
      const rest = resto();
      if(o.musica){
        crearMp3(); if(!mp3) return;
        if(mp3._cola) return;   // ya ha acabado (y está sonando su eco): no se vuelve a empezar
        if(!(mp3.duration > 0)){   // hasta saber lo que dura no se sabe cuándo empieza
          if(!mp3._meta){ mp3._meta = true; mp3.addEventListener('loadedmetadata', () => arrancarMusica(), { once: true }); }
          return;
        }
        if(rest > ventanaMp3()) return;
        if(mp3.paused || !mp3._sinc){
          sincronizar();
          mp3._sinc = true; mp3.muted = false;
          if(mp3._ruta && mp3._ruta.ac.state !== 'running') mp3._ruta.ac.resume().catch(() => {});
          const m = mp3; m.play().then(() => volumenMp3(m, .95, 1200)).catch(() => {});
        }
        return;
      }
      if(banda() && rest <= MUSICA) banda().cuenta(+o.at);
    }
    function pararMusica(){ if(banda()) banda().parar(.5); if(mp3){ volumenMp3(mp3, 0, 500); cortarEco(mp3); mp3._sinc = false; } }
    function desbloquear(){
      try{ if(window.IBSonido) IBSonido.unlock(); }catch(e){}
      crearMp3();
    }

    // el botón y cualquier toque en la página activan el sonido (y ya no se apaga)
    const activar = () => { if(son) return; son = true; desbloquear(); arrancarMusica(); pintarSnd(resto()); };
    sndB.addEventListener('click', activar);
    const primerToque = activar;
    el.addEventListener('pointerdown', primerToque, { once: true });

    function alCero(){
      fin = true;
      // con la canción del panel: su eco final y nada más (ninguna música de la web). Sin ella, el tema propio ya está
      // sonando su drop final y pasa solo a la base de tensión.
      if(son){
        if(o.musica){ if(mp3 && !mp3.paused) setTimeout(() => cola(mp3), 250); }
        else if(banda() && !banda().sonando()) banda().tension(.22, true);
      }
      if(o.onZero) o.onZero();
    }

    function tick(){
      if(!vivo) return;
      const rest = resto();
      const tnd = Number(o.tanda) || 1, tot = o.total || o.entradas, quedan = Math.max(o.entradas || 0, tot - (o.entradas || 0) * (tnd - 1));
      const sub = o.entradas ? (tnd > 1 ? `Sorteo ${tnd} · sorteamos <b>${o.entradas}</b> de las ${quedan} entradas que quedan` : `Tanda 1 · sorteamos <b>${o.entradas}</b> de las ${tot} entradas`) : '';
      const at = o.at ? new Date(o.at) : null, noche = at && at.getHours() === 0 && at.getMinutes() === 0;   // 00:00 = la noche del día anterior a las 12
      const diaTxt = at ? new Date(noche ? at - 864e5 : at).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' }) : '';
      put($('[data-k]'), o.sim ? 'Simulación · no cuenta' : (at ? `<i></i>${esc(diaTxt)} · ${noche ? 'a las 12 de la noche' : `${pad(at.getHours())}:${pad(at.getMinutes())} h`}` : 'Próxima tanda'));
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
      put(msg, !o.at ? 'Te avisaremos de la fecha de la siguiente tanda.'
        : rest <= 0 ? 'Entra en tu cuenta y abre tu premio.'
        : rest <= 10000 ? '¡Allá vamos!'
        : rest <= 60000 ? 'Último minuto. Que nadie se mueva.'
        : rest <= FINAL ? `Recta final: quedan menos de ${Math.ceil(FINAL / 60000)} minutos`
        : 'para descubrir quién se lleva las entradas');
      pintarSnd(rest);
      if(o.estado) put(st, o.estado(rest));
    }
    tick(); t = setInterval(tick, 250);
    return {
      set(n){
        const at0 = o.at, m0 = o.musica; o = { ...o, ...n };
        if(+at0 !== +o.at){ fin = resto() <= 0; if(son && banda() && !o.musica) arrancarMusica(); }
        if((o.musica || '') !== (m0 || '')){ if(mp3){ cortarEco(mp3); mp3.pause(); mp3 = null; } if(banda() && o.musica) banda().parar(.3); if(son) arrancarMusica(); }   // ha llegado el mp3 del panel
        tick();
      },
      // seguir = true: se quita la cuenta atrás pero la música continúa (pasa a la ruleta sin cortes)
      destroy(seguir){
        vivo = false; clearInterval(t);
        if(!seguir) pararMusica();
        else if(mp3 && !mp3.paused) cola(mp3);   // a la ruleta: lo que quede de la canción se va en eco
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
    // en la simulación, el clic del panel ya cuenta como permiso: el sonido arranca solo
    setTimeout(() => { const i = wrap.querySelector('.cta-sim-in'); if(i) i.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true })); }, 30);
    return { close };
  }

  window.IBCuenta = { mount, simular, FINAL, MUSICA };
})();
