/* Iberail — resultado del sorteo (cinta con flecha en el centro)
   El sorteo se celebra aparte (al azar, punto 5 de las bases); el equipo marca en el panel qué le ha tocado
   a cada uno y publica. Esta cinta es la forma de enseñárselo: pasa el catálogo real de premios y para en el suyo.
   En la cinta solo salen premios que existen de verdad (ver supabase/sql/sorteo-premios.sql).
   Discreta (v9.2): un solo frenado de ~6 s, sin parón de «tensión», sin música de fondo y SIN colocar a propósito
   el Ultra al lado cuando no toca (el «casi» forzado cantaba mucho): las piezas de alrededor salen al azar.
   Las celebraciones (confeti y la entrada del Ultra) están en assets/fiesta.js.

   Uso:  IBRuleta.show({ premio, catalogo, nombre, restantes, acta, test, tiradas, ganaEn })  →  Promise
     premio    id del premio ganado, o null / '' si no le ha tocado nada
     catalogo  [{ id, label, n, tier }]  (tier: top | alto | medio | bajo)
     test      true = simulación del panel (no cuenta)
     tiradas   cuántas tiradas tiene la persona (1 + extras) · ganaEn  en cuál sale el premio (por defecto, la última) */
(function(){
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ======================= sonido (Web Audio) =======================
     Todo pasa por un único AudioContext que se desbloquea en el toque de «Abrir» (en iPhone, si el audio
     arranca fuera de un toque, no suena nada). Los mp3 del panel mandan; si no hay, sonido sintetizado.
       tic     → cada pieza que pasa por la flecha (corto: se decodifica entero)
       premio  → al ganar cualquier premio · ultra → al ganar la entrada del Ultra (pueden ser largos: se
                 reproducen con <audio>, «cebado» también en el toque para que luego pueda sonar)
     Opcional en la web: assets/snd/premio.mp3, ultra.mp3, tic.mp3 (ahora no existen y no pasa nada). */
  const SND_DEF = { premio: 'assets/snd/premio.mp3', ultra: 'assets/snd/ultra.mp3', tic: 'assets/snd/tic.mp3' };
  let SND = { ...SND_DEF };   // show() lo sustituye por los que haya subido el equipo
  const MUTE = 'ib-srt-mute';
  const mudo = () => { try{ return localStorage.getItem(MUTE) === '1'; }catch(e){ return false; } };
  const setMudo = v => { try{ localStorage.setItem(MUTE, v ? '1' : '0'); }catch(e){} aplicarMudo(); };
  let AC = null, OUT = null, RUIDO = null;
  function ctx(){
    try{
      if(!AC){ const A = window.AudioContext || window.webkitAudioContext; if(!A) return null; AC = new A(); }
      if(AC.state === 'suspended' || AC.state === 'interrupted') AC.resume().catch(() => {});
      return AC;
    }catch(e){ return null; }
  }
  function out(){
    const a = ctx(); if(!a) return null;
    if(!OUT){ OUT = a.createGain(); const comp = a.createDynamicsCompressor(); comp.threshold.value = -10; comp.ratio.value = 3; OUT.connect(comp).connect(a.destination); }
    OUT.gain.value = mudo() ? 0 : 1;
    return OUT;
  }
  function ruido(a){
    if(RUIDO) return RUIDO;
    RUIDO = a.createBuffer(1, a.sampleRate * 2, a.sampleRate);
    const d = RUIDO.getChannelData(0); for(let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return RUIDO;
  }
  // hay que llamarlo DENTRO del clic/toque
  function unlock(){
    try{ if(navigator.audioSession) navigator.audioSession.type = 'playback'; }catch(e){}   // iPhone: que suene aunque esté en silencio
    const a = ctx(); if(!a) return;
    try{ const b = a.createBuffer(1, 1, 22050), s = a.createBufferSource(); s.buffer = b; s.connect(a.destination); s.start(0); }catch(e){}
    out();
  }
  const bufs = {};
  function cargar(url){
    if(!url) return Promise.resolve(null);
    if(!bufs[url]) bufs[url] = fetch(url).then(r => r.ok ? r.arrayBuffer() : null).then(ab => {
      const a = ctx(); if(!ab || !a) return null;
      return new Promise(res => { try{ const p = a.decodeAudioData(ab, res, () => res(null)); if(p && p.catch) p.catch(() => res(null)); }catch(e){ res(null); } });
    }).catch(() => null);
    return bufs[url];
  }
  const bufListo = {};   // url → AudioBuffer ya decodificado (para el tic, que no puede esperar)
  function sonar(buf, vol, rate){
    const a = ctx(), o = out(); if(!a || !o || !buf || mudo()) return null;
    const s = a.createBufferSource(), g = a.createGain(); s.buffer = buf; if(rate) s.playbackRate.value = rate; g.gain.value = vol == null ? .8 : vol;
    s.connect(g).connect(o); s.start(); return s;
  }
  // <audio> para los mp3 largos: se «ceba» en el toque (play en silencio y pausa) y así luego puede sonar
  const medias = {}, sonando = new Set();
  function media(url){
    if(!url) return null;
    if(medias[url] === undefined){
      const m = new Audio(url); m.preload = 'auto'; m._ok = true;
      m.addEventListener('error', () => { m._ok = false; }, { once: true });
      medias[url] = m;
    }
    return medias[url];
  }
  function cebar(url){
    const m = media(url); if(!m || !m._ok) return;
    // ojo: si el premio ya ha empezado a sonar mientras se cebaba, no se pausa
    try{ m.muted = true; const p = m.play(); if(p && p.then) p.then(() => { if(!sonando.has(m)){ m.pause(); m.currentTime = 0; } m.muted = mudo(); }).catch(() => { m.muted = mudo(); }); }catch(e){}
  }
  function tocarMedia(url, vol){
    const m = media(url); if(!m || !m._ok || mudo()) return false;
    try{ m.currentTime = 0; m.volume = vol == null ? .9 : vol; m.muted = false; m.play().catch(() => {}); sonando.add(m); m.addEventListener('ended', () => sonando.delete(m), { once: true }); return true; }catch(e){ return false; }
  }
  function aplicarMudo(){ if(OUT) OUT.gain.value = mudo() ? 0 : 1; sonando.forEach(m => { m.muted = mudo(); }); if(window.IBBanda) IBBanda.mudo(mudo()); }   // IBBanda: música de la cuenta atrás (sorteo.html)
  // se apagan en 0,8 s en vez de cortarse en seco (en iPhone el volumen no se puede tocar: ahí se paran al final)
  function pararMedias(){
    sonando.forEach(m => { const v0 = m.volume, t0 = performance.now(); const paso = () => { const x = Math.min(1, (performance.now() - t0) / 800); try{ m.volume = v0 * (1 - x); }catch(e){} if(x < 1) requestAnimationFrame(paso); else { try{ m.pause(); m.volume = v0; }catch(e){} } }; requestAnimationFrame(paso); });
    sonando.clear();
  }

  /* ---------- sonidos sintetizados ---------- */
  function env(g, t, a, peak, d){ g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
  function tono(f, t, dur, vol, tipo, f2){
    const a = ctx(), o = out(); if(!a || !o) return;
    const s = a.createOscillator(), g = a.createGain(); s.type = tipo || 'triangle';
    s.frequency.setValueAtTime(f, t); if(f2) s.frequency.exponentialRampToValueAtTime(f2, t + dur);
    env(g, t, .006, vol, dur); s.connect(g).connect(o); s.start(t); s.stop(t + dur + .05);
  }
  function soplo(t, tipo, freq, vol, dur, f2, q){
    const a = ctx(), o = out(); if(!a || !o) return;
    const n = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain();
    n.buffer = ruido(a); n.loop = dur > 1.8; f.type = tipo; f.frequency.setValueAtTime(freq, t); if(f2) f.frequency.exponentialRampToValueAtTime(f2, t + dur); f.Q.value = q || 1;
    env(g, t, Math.min(.02, dur / 3), vol, dur); n.connect(f).connect(g).connect(o); n.start(t); n.stop(t + dur + .05);
  }
  // el clic de la cinta: lengüeta de madera; más aguda y seca cuanto más rápido va
  function clic(vel){
    const a = ctx(); if(!a || mudo()) return;
    const t = a.currentTime;
    soplo(t, 'bandpass', 2600 + vel * 1600, .32, .03, 0, 5);
    tono(1700 + vel * 600, t, .045, .12, 'triangle', 650);
  }
  function tic(vel){
    if(mudo()) return;
    const b = bufListo[SND.tic];
    if(b) sonar(b, .4, .92 + vel * .25); else clic(vel);
  }
  function metal(n, t, dur, vol){   // «metales»: tres dientes de sierra desafinados con filtro que se abre
    const a = ctx(), o = out(); if(!a || !o) return;
    const f = a.createBiquadFilter(), g = a.createGain(); f.type = 'lowpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(3800, t + .09); f.frequency.exponentialRampToValueAtTime(1800, t + dur);
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + .05); g.gain.setValueAtTime(vol, t + dur * .7); g.gain.exponentialRampToValueAtTime(.0001, t + dur + .25);
    f.connect(g).connect(o);
    const fr = 440 * Math.pow(2, (n - 69) / 12);
    [-9, 0, 9].forEach(c => { const s = a.createOscillator(); s.type = 'sawtooth'; s.frequency.value = fr; s.detune.value = c; s.connect(f); s.start(t); s.stop(t + dur + .3); });
  }
  function boom(t){
    tono(120, t, 1.3, .95, 'sine', 26);
    soplo(t, 'lowpass', 900, .6, .5, 120);
    soplo(t + .01, 'highpass', 3500, .35, 2.6);
  }
  function fanfarriaPremio(){
    const a = ctx(); if(!a) return; const t = a.currentTime + .03;
    [72, 76, 79, 84, 88].forEach((n, i) => { const f = 440 * Math.pow(2, (n - 69) / 12); tono(f, t + i * .085, .5, .2, 'triangle'); tono(f * 2, t + i * .085, .3, .05, 'sine'); });
    [60, 64, 67, 72].forEach(n => metal(n, t + .45, 1.1, .03));
    soplo(t + .45, 'highpass', 5000, .2, 1.4);
    for(let i = 0; i < 8; i++) tono(2400 + Math.random() * 2400, t + .5 + i * .11, .25, .05, 'sine');
  }
  function fanfarria(top){
    if(mudo()) return;
    if(top && (tocarMedia(SND.ultra, .9) || (SND.ultra !== SND_DEF.ultra && tocarMedia(SND_DEF.ultra, .9)))) return;   // mp3 del panel
    if(!tocarMedia(SND.premio, .9)) fanfarriaPremio();
  }
  function pena(){   // no ha tocado: dos notas que bajan, suave
    const a = ctx(); if(!a || mudo()) return; const t = a.currentTime;
    tono(392, t, .22, .14, 'triangle'); tono(311, t + .2, .45, .12, 'triangle');
  }
  function pop(){   // cada fuego artificial
    const a = ctx(); if(!a || mudo()) return; const t = a.currentTime;
    soplo(t, 'lowpass', 1200, .32, .35, 200); tono(180, t, .25, .25, 'sine', 50);
    for(let i = 0; i < 4; i++) soplo(t + .25 + i * .07 + Math.random() * .05, 'highpass', 6000, .06, .05);
  }
  window.IBSonido = { ctx, out, unlock, mudo, setMudo, sonar, cargar, pop, boom: () => { const a = ctx(); if(a && !mudo()) boom(a.currentTime + .02); } };

  const NADA = { id: '', label: 'Sigue en el sorteo', tier: 'nada' };
  const ICON = { top: '🎟️', alto: '💶', medio: '🍹', bajo: '💶', nada: '🎲' };
  const icono = p => p.id === 'copas' ? '🍹' : (ICON[p.tier] || '🎲');

  // la cinta: huecos repartidos según las cantidades reales del catálogo, todos al azar.
  // Solo se fija la pieza donde para (el resultado); las de alrededor son las que salgan.
  function construir(catalogo, gan, largo, en){
    const pool = [];
    catalogo.forEach(p => { const n = p.n == null ? 1 : Math.max(0, Number(p.n) || 0); for(let i = 0; i < n; i++) pool.push(p); });   // cantidad 0 = no sale
    const vacios = Math.max(6, Math.round(pool.length * .55));
    for(let i = 0; i < vacios; i++) pool.push(NADA);
    const cinta = [];
    for(let i = 0; i < largo; i++) cinta.push(pool[Math.floor(Math.random() * pool.length)]);
    cinta[en] = gan;
    return cinta;
  }

  function show(o){
    o = o || {};
    const catalogo = (o.catalogo && o.catalogo.length ? o.catalogo : [
      { id: 'entrada', label: 'Entrada Ultra Europe', n: 3, tier: 'top' },
      { id: 'd300', label: '300 € de descuento', n: 1, tier: 'alto' },
      { id: 'd100', label: '100 € de descuento', n: 2, tier: 'alto' },
      { id: 'd50', label: '50 € de descuento', n: 3, tier: 'medio' },
      { id: 'copas', label: 'Bono de copas en Split', n: 5, tier: 'medio' },
      { id: 'd25', label: '25 € de descuento', n: 5, tier: 'bajo' },
      { id: 'd5', label: '5 € de descuento', n: 10, tier: 'bajo' }
    ]).map(p => ({ ...p }));

    SND = { ...SND_DEF, ...(o.sonidos || {}) };   // los del panel mandan; si falta uno, el de assets/snd
    cargar(SND.tic).then(b => { if(b) bufListo[SND.tic] = b; });
    media(SND.premio); media(SND.ultra);
    const LARGO = 70, GANA_EN = 60;                 // el resultado cae en esta posición
    // el premio asignado SIEMPRE se enseña, aunque no esté en el catálogo publicado
    const premio = catalogo.find(p => p.id === o.premio) || (o.premio ? { id: o.premio, label: o.premio === 'entrada' ? 'Entrada Ultra Europe' : 'Premio sorpresa', tier: o.premio === 'entrada' ? 'top' : 'alto' } : null);
    // tiradas: cada una se abre por separado; el premio sale solo en la que diga el panel (por defecto, la última)
    const N = Math.max(1, Math.min(50, parseInt(o.tiradas, 10) || 1));
    const EN = premio ? Math.max(1, Math.min(N, parseInt(o.ganaEn, 10) || N)) : 0;
    const resultado = i => (premio && i === EN ? premio : NADA);
    const toca = !!premio;
    // desde: primera tirada sin abrir (si el equipo suma tiradas después, se abren solo las nuevas)
    let actual = Math.max(1, Math.min(N, parseInt(o.desde, 10) || 1)), abierto = false;

    return new Promise(res => {
      const el = document.createElement('div');
      el.className = 'rul' + (o.test ? ' is-test' : '');
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Tu premio del sorteo');
      const quedan = o.restantes && o.restantes.entradas != null
        ? `<span class="rul-left" data-rul-left>Quedan <b>${Math.max(0, o.restantes.entradas - (o.restantes.dadas || 0))}</b> de ${o.restantes.entradas} entradas por salir</span>` : '';
      el.innerHTML = `<div class="rul-box">
          ${o.test ? '<span class="rul-test">Simulación · no cuenta</span>' : ''}
          <button type="button" class="rul-snd${mudo() ? ' is-off' : ''}" data-rul-snd aria-label="Activar o quitar el sonido">${mudo() ? '🔇' : '🔊'}</button>
          <div class="rul-head">
            <span class="rul-k">Sorteo Iberail · Ultra Europe 2027</span>
            ${N > 1 ? '<span class="rul-tir" data-rul-tir></span>' : ''}
            <div class="rul-prize" data-rul-prize hidden></div>
            <b class="rul-h" data-rul-h>Tu resultado</b>
            <p class="rul-p" data-rul-p>${N > 1 ? `Tienes <b>${N} participaciones</b>. Se ven una a una.` : 'Pulsa el botón para ver qué te ha tocado.'}</p>
            ${quedan}
          </div>
          <div class="rul-rail" data-rul-rail>
            <span class="rul-mark" aria-hidden="true"></span>
            <div class="rul-track" data-rul-track></div>
            <span class="rul-fade rul-fade--l" aria-hidden="true"></span><span class="rul-fade rul-fade--r" aria-hidden="true"></span>
          </div>
          <div class="rul-acts" data-rul-acts></div>
          <small class="rul-acta">${o.acta ? esc(o.acta) + ' · ' : ''}Los ganadores se eligen al azar antes de esta hora; aquí solo ves tu resultado. <a href="bases-sorteo.html" target="_blank" rel="noopener">Bases</a></small>
        </div>`;

      let fx = null;   // celebración en marcha (para pararla al cerrar)
      const close = () => {
        if(fx && fx.fin) fx.fin(); fx = null; pararMedias();
        el.classList.remove('is-in'); document.body.classList.remove('srt-lock');
        setTimeout(() => { el.remove(); res(toca); }, 260);
      };
      el.addEventListener('click', e => { if(e.target.closest('[data-rul-x]')) close(); });
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-rul-snd]'); if(!b) return;
        unlock(); setMudo(!mudo()); b.textContent = mudo() ? '🔇' : '🔊'; b.classList.toggle('is-off', mudo());
      });

      const track = el.querySelector('[data-rul-track]'), rail = el.querySelector('[data-rul-rail]');
      const acts = el.querySelector('[data-rul-acts]'), head = el.querySelector('[data-rul-h]'), par = el.querySelector('[data-rul-p]');
      const tirEl = el.querySelector('[data-rul-tir]'), prizeEl = el.querySelector('[data-rul-prize]');
      const nombre = o.nombre ? String(o.nombre).split(' ')[0] : '';
      const coma = nombre ? ', ' + esc(nombre) : '';

      function preparar(){
        const cinta = construir(catalogo, resultado(actual), LARGO, GANA_EN);
        track.style.transition = 'none'; track.style.transform = 'translateX(0)';
        track.innerHTML = cinta.map(p => `<div class="rul-it is-${esc(p.tier)}"><span class="rul-it-i">${icono(p)}</span><b>${esc(p.label)}</b></div>`).join('');
        el.classList.remove('is-win', 'is-lose', 'is-top', 'is-tense', 'is-fast');
        prizeEl.hidden = true; prizeEl.innerHTML = '';
        if(tirEl) tirEl.innerHTML = Array.from({ length: N }, (_, i) => `<i class="${i + 1 < actual ? 'is-used' : i + 1 === actual ? 'is-now' : ''}"></i>`).join('') + `<b>Participación ${actual} de ${N}</b>`;
        acts.innerHTML = `<button type="button" class="rul-go" data-rul-go>${N > 1 ? `Ver la participación ${actual}` : 'Ver mi resultado'}</button>`;
        abierto = false;
      }

      const posX = () => { const m = getComputedStyle(track).transform; if(!m || m === 'none') return 0; try{ return new DOMMatrixReadOnly(m).m41; }catch(e){ return 0; } };
      function mover(x, ms, curva){
        return new Promise(r => {
          track.style.transition = `transform ${ms}ms ${curva}`;
          requestAnimationFrame(() => { track.style.transform = `translateX(${x}px)`; });
          setTimeout(r, ms + 40);
        });
      }
      const espera = ms => new Promise(r => setTimeout(r, ms));
      const vibrar = p => { try{ if(navigator.vibrate) navigator.vibrate(p); }catch(e){} };

      async function girar(){
        abierto = true;
        acts.innerHTML = '<span class="rul-wait">Un momento…</span>';
        head.textContent = N > 1 ? `Participación ${actual} de ${N}` : 'Tu resultado';
        par.textContent = '';
        el.classList.add('is-spin');
        const gan = resultado(actual), r = reduce();
        const it = track.querySelector('.rul-it');
        const anchoIt = it.getBoundingClientRect().width, hueco = parseFloat(getComputedStyle(track).gap) || 10;
        const paso = anchoIt + hueco;
        // se congela el tamaño de las piezas: si gira el móvil a mitad, la cinta no cambia de medida
        track.style.gap = hueco + 'px'; track.querySelectorAll('.rul-it').forEach(x => { x.style.flex = `0 0 ${anchoIt}px`; });
        const centro = rail.getBoundingClientRect().width / 2;
        const xDe = (i, frac) => -(i * paso + paso * frac - centro);   // frac: 0 = borde izquierdo de la pieza, .5 = centro
        // un clic suave cada vez que una pieza pasa por la flecha, leyendo la posición real
        let ult = -1, vivo = true, xAnt = 0, tAnt = performance.now();
        const bucle = () => {
          if(!vivo || !el.isConnected) return;
          const x = posX(), t = performance.now(), n = Math.floor((centro - x) / paso);
          const vel = Math.min(1, Math.abs(x - xAnt) / Math.max(1, t - tAnt) / 3);   // px/ms → 0..1
          xAnt = x; tAnt = t;
          if(n !== ult){ if(ult >= 0) tic(vel); ult = n; }
          requestAnimationFrame(bucle);
        };
        if(!r) requestAnimationFrame(bucle);
        // un solo frenado natural; el punto donde para dentro de la pieza es al azar (gane o no)
        const fin = .22 + Math.random() * .56;
        await mover(xDe(GANA_EN, fin), r ? 250 : 6200, 'cubic-bezier(.12,.62,.12,1)');
        vivo = false;
        if(!el.isConnected) return;

        // si ha girado el móvil o cambiado el tamaño durante el giro, se recoloca justo en el resultado
        const c2 = rail.getBoundingClientRect().width / 2, xOk = -(GANA_EN * paso + paso * fin - c2);
        if(Math.abs(xOk - posX()) > 2) await mover(xOk, 350, 'ease-out');
        if(o.onTirada){ try{ o.onTirada(actual); }catch(e){} }
        el.classList.remove('is-spin'); el.classList.add(gan.id ? 'is-win' : 'is-lose');
        if(gan.tier === 'top') el.classList.add('is-top');
        track.children[GANA_EN].classList.add('is-got');
        const quedanT = N - actual;
        if(gan.id){
          prizeEl.innerHTML = `<span class="rul-prize-i">${icono(gan)}</span><b>${esc(gan.label)}</b>`;
          prizeEl.className = `rul-prize is-${esc(gan.tier)}`; prizeEl.hidden = false;
          head.innerHTML = gan.tier === 'top' ? '¡Te vas al Ultra!' : '¡Te ha tocado!';
          par.innerHTML = gan.id === 'entrada'
            ? `Enhorabuena${coma}. Te escribimos por WhatsApp con los detalles de tu entrada para el Ultra Europe.`
            : `Enhorabuena${coma}. Te lo aplicamos en tu viaje con nosotros: te escribimos por WhatsApp para dejártelo apuntado.`;
          fanfarria(gan.tier === 'top'); vibrar(60);
        } else {
          head.innerHTML = N > 1 ? `Participación ${actual}: esta vez no` : 'Esta vez no ha habido suerte';
          par.innerHTML = quedanT ? `Te ${quedanT === 1 ? 'queda 1 más' : `quedan ${quedanT} más`}.`
            : (toca ? `Ya tienes tu premio${coma}. ¡Nos vemos en Split!` : 'Sigues dentro para los próximos sorteos sin hacer nada.');
          pena();
        }
        acts.innerHTML = quedanT
          ? `<button type="button" class="rul-go" data-rul-next>Ver la siguiente (${actual + 1} de ${N})</button>`
          : `<button type="button" class="rul-go rul-go--ghost" data-rul-x>${toca ? '¡Genial!' : 'Cerrar'}</button>`;

        // celebración (assets/fiesta.js), corta y sin fuegos
        const F = window.IBFiesta;
        if(gan.id && F){
          if(fx && fx.fin) fx.fin();
          fx = gan.tier === 'top'
            ? F.ultra(el, { nombre, test: o.test, onCerrar: () => { fx = null; } })
            : F.premio(el, { tier: gan.tier, item: track.children[GANA_EN] });
        }
      }

      el.addEventListener('click', e => {
        if(e.target.closest('[data-rul-go]') && !abierto){
          // dentro del toque: desbloquear el audio y cebar los mp3 largos para que luego puedan sonar
          unlock(); cebar(SND.premio); cebar(SND.ultra);
          return void girar();
        }
        if(e.target.closest('[data-rul-next]')){ unlock(); if(fx && fx.fin) fx.fin(); fx = null; pararMedias(); actual++; preparar(); }
      });

      preparar();
      document.body.appendChild(el);
      document.body.classList.add('srt-lock');
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
    });
  }

  window.IBRuleta = { show };
})();
