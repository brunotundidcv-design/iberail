/* Iberail — apertura del premio del sorteo (cinta estilo «caja», con flecha en el centro)
   El sorteo se celebra aparte; el equipo marca en el panel qué le ha tocado a cada uno y publica.
   Esta cinta es la forma de enseñárselo: pasa el catálogo real de premios y frena en el suyo.
   En la cinta solo salen premios que existen de verdad (ver supabase/sql/sorteo-premios.sql).
   Las celebraciones (confeti, fuegos, la entrada dorada del Ultra) están en assets/fiesta.js.

   Uso:  IBRuleta.show({ premio, catalogo, nombre, restantes, acta, test, tiradas, ganaEn })  →  Promise
     premio    id del premio ganado, o null / '' si no le ha tocado nada
     catalogo  [{ id, label, n, tier }]  (tier: top | alto | medio | bajo)
     test      true = simulación del panel (no cuenta)
     tiradas   cuántas tiradas tiene la persona (1 + extras) · ganaEn  en cuál sale el premio (por defecto, la última)
     desde     primera tirada que se abre (si ya abrió 4 y le suman 1: desde 5) · yaPremio  ya vio su premio antes
     onTirada  (i, premio) al terminar cada tirada, para apuntar cuántas lleva abiertas
     repe      texto de la etiqueta si es la repetición de una tirada ya hecha (p. ej. «Repetición · sorteo 1») */
(function(){
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ======================= sonido (Web Audio) =======================
     Todo pasa por un único AudioContext que se desbloquea en el toque de «Abrir» (en iPhone, si el audio
     arranca fuera de un toque, no suena nada). Los mp3 del panel mandan; si no hay, sonido sintetizado.
       tic     → cada pieza que pasa por la flecha (corto: se decodifica entero)
       premio  → al ganar cualquier premio · ultra → al ganar la entrada del Ultra: se descargan y decodifican
                 mientras gira la cinta y se programan en el MISMO instante que el golpe («boom»), con el
                 reloj del AudioContext. Si no da tiempo a decodificarlos (o pesan mucho), <audio> en el golpe.
     Sin botón de silencio: en el sorteo siempre suena (decisión de Bruno).
     Opcional en la web: assets/snd/premio.mp3, ultra.mp3, tic.mp3 (ahora no existen y no pasa nada). */
  const SND_DEF = { premio: 'assets/snd/premio.mp3', ultra: 'assets/snd/ultra.mp3', tic: 'assets/snd/tic.mp3' };
  let SND = { ...SND_DEF };   // show() lo sustituye por los que haya subido el equipo
  try{ localStorage.removeItem('ib-srt-mute'); }catch(e){}   // el antiguo botón de silencio ya no existe
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
  const bufListo = {};   // url → AudioBuffer ya decodificado (el tic y las canciones de ganar, que no pueden esperar)
  function sonar(buf, vol, rate){
    const a = ctx(), o = out(); if(!a || !o || !buf) return null;
    const s = a.createBufferSource(), g = a.createGain(); s.buffer = buf; if(rate) s.playbackRate.value = rate; g.gain.value = vol == null ? .8 : vol;
    s.connect(g).connect(o); s.start(); return s;
  }
  // canciones de ganar: se descargan y decodifican al abrir la ruleta (la cinta tarda ~20 s: da tiempo de sobra)
  const MAX_DEC = 12 * 1024 * 1024;   // más grande que esto no se decodifica entero (memoria del móvil): va por <audio>
  const grande = {};
  function precargar(url){
    if(!url || bufListo[url] || grande[url]) return;
    if(!bufs[url]) bufs[url] = fetch(url).then(r => r.ok ? r.arrayBuffer() : null).then(ab => {
      const a = ctx(); if(!ab || !a) return null;
      if(ab.byteLength > MAX_DEC){ grande[url] = true; return null; }
      return new Promise(res => { try{ const p = a.decodeAudioData(ab, res, () => res(null)); if(p && p.catch) p.catch(() => res(null)); }catch(e){ res(null); } });
    }).catch(() => null);
    bufs[url].then(b => { if(b) bufListo[url] = b; });
  }
  // <audio> de reserva: se desbloquea en el toque con play + pause en el acto (no llega a sonar nada)
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
    try{ m.muted = true; const p = m.play(); m.pause(); if(p && p.catch) p.catch(() => {}); m.currentTime = 0; m.muted = false; }catch(e){ m.muted = false; }
  }
  // la canción de ganar, en el instante t (segundos del AudioContext, el mismo del golpe)
  let cancion = null;
  function tocarCancion(url, vol, t){
    if(!url) return false;
    const a = ctx(), b = bufListo[url];
    if(a && b){
      const s = a.createBufferSource(), g = a.createGain();
      s.buffer = b; g.gain.value = vol == null ? .9 : vol;
      s.connect(g).connect(a.destination);   // directa a la salida: la canción ya viene masterizada
      s.start(Math.max(a.currentTime, t || 0));
      cancion = { s, g }; s.onended = () => { if(cancion && cancion.s === s) cancion = null; };
      return true;
    }
    const m = media(url); if(!m || !m._ok) return false;
    const ya = () => { try{ m.currentTime = 0; m.volume = vol == null ? .9 : vol; m.muted = false; m.play().catch(() => {}); sonando.add(m); m.addEventListener('ended', () => sonando.delete(m), { once: true }); }catch(e){} };
    const espera = a && t ? (t - a.currentTime) * 1000 : 0;
    if(espera > 4) setTimeout(ya, espera); else ya();
    return true;
  }
  // se apagan en 0,8 s en vez de cortarse en seco (en iPhone el volumen de <audio> no se puede tocar: ahí se paran al final)
  function pararMedias(){
    if(cancion){
      const { s, g } = cancion, a = ctx(); cancion = null;
      try{ const t = a.currentTime; g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(g.gain.value, t); g.gain.linearRampToValueAtTime(0, t + .8); s.stop(t + .85); }catch(e){ try{ s.stop(); }catch(_){} }
    }
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
    const a = ctx(); if(!a) return;
    const t = a.currentTime;
    soplo(t, 'bandpass', 2600 + vel * 1600, .7, .035, 0, 5);
    tono(1700 + vel * 600, t, .05, .28, 'triangle', 650);
  }
  function tic(vel){
    const b = bufListo[SND.tic];
    if(b) sonar(b, .55, .92 + vel * .25); else clic(vel);
  }
  function zumbido(){   // al arrancar la cinta
    const a = ctx(); if(!a) return;
    soplo(a.currentTime, 'bandpass', 3000, .22, 2.2, 400, 2);
  }
  function latido(){
    const a = ctx(); if(!a) return;
    const t = a.currentTime;
    tono(70, t, .22, .7, 'sine', 40); tono(62, t + .2, .26, .55, 'sine', 36);
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
  function fanfarriaUltra(){
    const a = ctx(); if(!a) return; const t = a.currentTime + .03;
    boom(t);
    const acordes = [[[60, 64, 67], .55], [[65, 69, 72], .55], [[67, 71, 74], .7], [[72, 76, 79, 84], 2.8]];
    let x = t + .35;
    acordes.forEach(([ns, d], i) => { ns.forEach(n => { metal(n, x, d, .032); metal(n - 12, x, d, .022); }); if(i === 3){ boom(x); } x += d; });
    for(let i = 0; i < 22; i++) soplo(t + 1.25 + i * .045, 'bandpass', 140, .1 + i * .02, .08, 0, 2);   // redoble de timbales
    for(let i = 0; i < 18; i++) tono(2000 + Math.random() * 3000, t + 2.2 + i * .14, .3, .045, 'sine');
  }
  const BANDA = () => window.IBBanda || null;   // assets/musica.js: la música continua (cuenta atrás → tensión → fiesta)
  // golpe final: con la banda sonora, el impacto y la música siguiente van pegados (sin silencio entre medias).
  // La canción de ganar entra en el mismo instante t que el «boom» (no antes): los dos van con el reloj del AudioContext.
  function cancionGanar(top, t){
    return top ? (tocarCancion(SND.ultra, .95, t) || (SND.ultra !== SND_DEF.ultra && tocarCancion(SND_DEF.ultra, .95, t)))
      : tocarCancion(SND.premio, .9, t);
  }
  function golpeFinal(gan){
    const b = BANDA(), a = ctx(), t = a ? a.currentTime + .03 : 0;
    if(!b){ if(gan.id) fanfarria(gan.tier === 'top', t); else pena(); return; }
    if(!gan.id){ b.golpe('nada'); pena(); return; }
    const top = gan.tier === 'top';
    const conMp3 = cancionGanar(top, t);
    b.golpe(top ? 'ultra' : 'premio', { conMp3, t });
  }
  function fanfarria(top, t){
    if(top){
      // con mp3: golpe sintetizado + la canción a la vez; sin mp3: la fanfarria completa (ya lleva su golpe)
      if(cancionGanar(true, t)) boom(t); else fanfarriaUltra();
      return;
    }
    if(!cancionGanar(false, t)) fanfarriaPremio();
  }
  function pena(){   // no ha tocado: dos notas que bajan, suave
    const a = ctx(); if(!a) return; const t = a.currentTime;
    tono(392, t, .22, .14, 'triangle'); tono(311, t + .2, .45, .12, 'triangle');
  }
  function pop(){   // cada fuego artificial
    const a = ctx(); if(!a) return; const t = a.currentTime;
    soplo(t, 'lowpass', 1200, .32, .35, 200); tono(180, t, .25, .25, 'sine', 50);
    for(let i = 0; i < 4; i++) soplo(t + .25 + i * .07 + Math.random() * .05, 'highpass', 6000, .06, .05);
  }
  window.IBSonido = { ctx, out, unlock, sonar, cargar, pop, boom: () => { const a = ctx(); if(a) boom(a.currentTime + .02); } };

  const NADA = { id: '', label: 'Sigue en el sorteo', tier: 'nada' };
  const ICON = { top: '🎟️', alto: '💶', medio: '🍹', bajo: '💶', nada: '🎲' };
  const icono = p => p.id === 'copas' ? '🍹' : /^psc/.test(p.id || '') ? '💳' : (ICON[p.tier] || '🎲');

  // la cinta: muchos huecos repartidos según las cantidades reales del catálogo.
  // Alrededor de donde para: si toca el Ultra, justo antes no hay ninguno (no se ve venir);
  // si no toca, no hay ningún Ultra cerca (nada de «casi» forzados: si no toca, no toca).
  function construir(catalogo, gan, largo, en){
    const pool = [];
    catalogo.forEach(p => { for(let i = 0; i < Math.max(1, Number(p.n) || 1); i++) pool.push(p); });
    const vacios = Math.max(6, Math.round(pool.length * .55));
    for(let i = 0; i < vacios; i++) pool.push(NADA);
    const cinta = [];
    for(let i = 0; i < largo; i++) cinta.push(pool[Math.floor(Math.random() * pool.length)]);
    const top = catalogo.find(p => p.tier === 'top'), otros = catalogo.filter(p => p.tier !== 'top');
    const otro = () => otros.length && Math.random() < .6 ? otros[Math.floor(Math.random() * otros.length)] : NADA;
    if(top && gan.tier === 'top') for(let i = en - 14; i < en; i++) if(cinta[i] && cinta[i].tier === 'top') cinta[i] = otro();
    if(top && gan.tier !== 'top') for(let i = en - 6; i <= en + 6; i++) if(cinta[i] && cinta[i].tier === 'top') cinta[i] = otro();
    cinta[en] = gan;
    cinta[en - 1] = otro();
    cinta[en + 1] = otro();
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
      { id: 'd5', label: '5 € de descuento', n: 10, tier: 'bajo' },
      { id: 'psc75', label: 'Paysafecard de 75 €', n: 1, tier: 'alto' },
      { id: 'psc50', label: 'Paysafecard de 50 €', n: 2, tier: 'medio' },
      { id: 'psc25', label: 'Paysafecard de 25 €', n: 3, tier: 'bajo' },
      { id: 'psc10', label: 'Paysafecard de 10 €', n: 5, tier: 'bajo' }
    ]).map(p => ({ ...p }));

    SND = { ...SND_DEF, ...(o.sonidos || {}) };   // los del panel mandan; si falta uno, el de assets/snd
    cargar(SND.tic).then(b => { if(b) bufListo[SND.tic] = b; });
    precargar(SND.premio); precargar(SND.ultra); media(SND.premio); media(SND.ultra);
    const LARGO = 150, GANA_EN = 140;               // el resultado cae en esta posición
    const premio = catalogo.find(p => p.id === o.premio) || null;
    // tiradas: cada una se abre por separado; el premio sale solo en la que diga el panel (por defecto, la última)
    const N = Math.max(1, Math.min(50, parseInt(o.tiradas, 10) || 1));
    const DESDE = Math.max(1, Math.min(N, parseInt(o.desde, 10) || 1));
    const NUEVAS = N - DESDE + 1;
    const EN = premio ? Math.max(DESDE, Math.min(N, parseInt(o.ganaEn, 10) || N)) : 0;
    const resultado = i => (premio && i === EN ? premio : NADA);
    const toca = !!premio || !!o.yaPremio;
    let actual = DESDE, abierto = false;

    return new Promise(res => {
      const el = document.createElement('div');
      el.className = 'rul' + (o.test ? ' is-test' : '');
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Tu premio del sorteo');
      const quedan = o.restantes && o.restantes.entradas != null
        ? `<span class="rul-left" data-rul-left>Quedan <b>${Math.max(0, o.restantes.entradas - (o.restantes.dadas || 0))}</b> de ${o.restantes.entradas} entradas por salir</span>` : '';
      el.innerHTML = `<div class="rul-box">
          ${o.test ? '<span class="rul-test">Simulación · no cuenta</span>' : ''}
          ${o.repe ? `<span class="rul-test rul-repe">${esc(o.repe)}</span>` : ''}
          <div class="rul-head">
            <span class="rul-k">Sorteo Iberail · Ultra Europe 2027</span>
            ${N > 1 ? '<span class="rul-tir" data-rul-tir></span>' : ''}
            <div class="rul-prize" data-rul-prize hidden></div>
            <b class="rul-h" data-rul-h>Abre tu premio</b>
            <p class="rul-p" data-rul-p>${o.repe ? `Tu tirada ${DESDE}${N > 1 ? ` de ${N}` : ''}, otra vez. Pon a grabar la pantalla y ábrela.` : DESDE > 1 ? `Tienes <b>${NUEVAS === 1 ? '1 tirada nueva' : NUEVAS + ' tiradas nuevas'}</b>. ${NUEVAS === 1 ? '¡Ábrela!' : 'Ábrelas una a una.'}` : N > 1 ? `Tienes <b>${N} tiradas</b>. Ábrelas una a una.` : 'Dale a abrir: la cinta para donde para.'}</p>
            ${quedan}
          </div>
          <div class="rul-rail" data-rul-rail>
            <span class="rul-mark" aria-hidden="true"></span>
            <div class="rul-track" data-rul-track></div>
            <span class="rul-fade rul-fade--l" aria-hidden="true"></span><span class="rul-fade rul-fade--r" aria-hidden="true"></span>
          </div>
          <div class="rul-acts" data-rul-acts></div>
          ${o.acta ? `<small class="rul-acta">${esc(o.acta)}</small>` : ''}
        </div>`;

      let fx = null;   // celebración en marcha (para pararla al cerrar)
      const close = () => {
        if(fx && fx.fin) fx.fin(); fx = null; pararMedias();
        if(BANDA()) BANDA().parar(1.8);   // la música se apaga poco a poco, no de golpe
        el.classList.remove('is-in'); document.body.classList.remove('srt-lock');
        setTimeout(() => { el.remove(); res(toca); }, 260);
      };
      el.addEventListener('click', e => { if(e.target.closest('[data-rul-x]')) close(); });

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
        if(tirEl) tirEl.innerHTML = Array.from({ length: N }, (_, i) => `<i class="${i + 1 < actual ? 'is-used' : i + 1 === actual ? 'is-now' : ''}">🎟️</i>`).join('') + `<b>Tirada ${actual} de ${N}</b>`;
        acts.innerHTML = `<button type="button" class="rul-go" data-rul-go>${N > 1 ? `Abrir tirada ${actual}` : 'Abrir mi premio'}</button>`;
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
        acts.innerHTML = '<span class="rul-wait">Girando…</span>';
        head.textContent = N > 1 ? `Tirada ${actual}…` : 'Girando…';
        par.textContent = 'Mucha suerte 🤞';
        el.classList.add('is-spin', 'is-fast');
        const gan = resultado(actual), r = reduce();
        const it = track.querySelector('.rul-it');
        const paso = it.getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap || 10);
        const centro = rail.getBoundingClientRect().width / 2;
        const xDe = (i, frac) => -(i * paso + paso * frac - centro);   // frac: 0 = borde izquierdo de la pieza, .5 = centro
        // un clic cada vez que una pieza pasa por la flecha, leyendo la posición real (sirve para las dos fases)
        let ult = -1, vivo = true, xAnt = 0, tAnt = performance.now();
        const bucle = () => {
          if(!vivo || !el.isConnected) return;
          const x = posX(), t = performance.now(), n = Math.floor((centro - x) / paso);
          const vel = Math.min(1, Math.abs(x - xAnt) / Math.max(1, t - tAnt) / 3);   // px/ms → 0..1
          xAnt = x; tAnt = t;
          if(n !== ult){ if(ult >= 0) tic(vel); ult = n; }
          requestAnimationFrame(bucle);
        };
        if(!r){ zumbido(); requestAnimationFrame(bucle); }
        const T1 = r ? 250 : 16000, PAUSA = r ? 0 : 1300, T2 = r ? 200 : 3000;
        const b = BANDA();
        if(b) b.tension(.6, true);   // la música no se para: pasa a la base de tensión al empezar a girar
        setTimeout(() => el.classList.remove('is-fast'), T1 * .42);
        setTimeout(() => { if(b && el.isConnected) b.tension(.82); }, T1 * .55);   // frenando: latidos más seguidos
        // fase 1 (~16 s): gira y frena dejando la flecha en la pieza de antes
        await mover(xDe(GANA_EN - 1, .5 + (Math.random() - .5) * .3), T1, 'cubic-bezier(.1,.62,.08,1)');
        if(!el.isConnected){ vivo = false; return; }
        // pausa con latido… y una subida con redoble que acaba justo cuando para la cinta
        head.textContent = '¿Y…?';
        el.classList.add('is-tense');
        if(b){ b.tension(1); b.subida((PAUSA + T2) / 1000); } else if(!r) latido();
        if(!r){ vibrar(40); await espera(PAUSA); }
        // fase 2 (~3 s): avanza muy despacio hasta el resultado, siempre cerca del centro de la pieza (toque o no)
        const fin = .5 + (Math.random() - .5) * .3;
        await mover(xDe(GANA_EN, fin), T2, 'cubic-bezier(.45,0,.2,1)');
        vivo = false;
        if(!el.isConnected) return;

        el.classList.remove('is-spin', 'is-tense'); el.classList.add(gan.id ? 'is-win' : 'is-lose');
        if(gan.tier === 'top') el.classList.add('is-top');
        track.children[GANA_EN].classList.add('is-got');
        const quedanT = N - actual;
        if(o.onTirada) try{ o.onTirada(actual, gan); }catch(e){}
        if(gan.id){
          prizeEl.innerHTML = `<span class="rul-prize-i">${icono(gan)}</span><b>${esc(gan.label)}</b>`;
          prizeEl.className = `rul-prize is-${esc(gan.tier)}`; prizeEl.hidden = false;
          head.innerHTML = gan.tier === 'top' ? '¡Te vas al Ultra!' : '¡Te ha tocado!';
          par.innerHTML = gan.id === 'entrada'
            ? `Enhorabuena${coma}. Te escribimos por WhatsApp con los detalles de tu entrada para el Ultra Europe.`
            : `Enhorabuena${coma}. Te lo aplicamos en tu viaje con nosotros: te escribimos por WhatsApp para dejártelo apuntado.`;
          golpeFinal(gan);
        } else {
          head.innerHTML = N > 1 ? `Tirada ${actual}: esta vez no` : 'Esta vez no ha salido premio';
          par.innerHTML = quedanT ? `Te ${quedanT === 1 ? 'queda 1 tirada' : `quedan ${quedanT} tiradas`}. ¡A por la siguiente!`
            : (toca ? `Ya tienes tu premio${coma}. ¡Nos vemos en Split!` : 'Sigues dentro para las siguientes tandas sin hacer nada. Sube nuestro cartel a tu story y suma otra tirada.');
          golpeFinal(gan); vibrar(30);
        }
        acts.innerHTML = quedanT
          ? `<button type="button" class="rul-go" data-rul-next>Siguiente tirada (${actual + 1} de ${N})</button>`
          : `<button type="button" class="rul-go rul-go--ghost" data-rul-x>${toca ? '¡Genial!' : 'Entendido'}</button>`;

        // celebración (assets/fiesta.js): la del Ultra va a pantalla completa encima de la ruleta
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
          // dentro del toque: desbloquear el audio (y el <audio> de reserva, por si la canción no llega a decodificarse)
          unlock(); cebar(SND.premio); cebar(SND.ultra); precargar(SND.premio); precargar(SND.ultra);
          return void girar();
        }
        if(e.target.closest('[data-rul-next]')){ unlock(); if(fx && fx.fin) fx.fin(); fx = null; pararMedias(); if(BANDA()) BANDA().calmar(); actual++; preparar(); }
      });

      preparar();
      document.body.appendChild(el);
      document.body.classList.add('srt-lock');
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
    });
  }

  window.IBRuleta = { show };
})();
