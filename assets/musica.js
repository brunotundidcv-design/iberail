/* Iberail — banda sonora del sorteo «Split 2027» (Web Audio, todo generado por código: sin derechos de autor)
   Un solo motor de música que va SIN CORTES de la cuenta atrás a la ruleta y a la celebración:
   · cuenta(at)        tema de festival a 128 bpm sincronizado con la cuenta atrás: empieza a falta de 6 min
                       (intro → subida → drop → parón → drop → parón → subida final) y el drop final cae justo en el 0
   · tension(nivel)    base para la ruleta: 0–.3 espera (latido lento, tic-tac), .6 girando, 1 en el frenazo
   · subida(seg)       redoble + subida que acaba justo a los «seg» segundos (cuando para la cinta)
   · golpe(tipo, op)   'ultra' | 'premio' | 'nada': impacto y la música sigue (con mp3: entra en el mismo instante del golpe)
   · calmar()          vuelve a la espera (siguiente tirada) · parar(seg) se apaga poco a poco · mudo(v)
   Usa el AudioContext de ruleta.js (IBSonido), que se desbloquea en el toque. Si no hay ruleta.js, crea uno propio.
   En móviles los altavoces no dan graves: bombos, latidos y golpes llevan también «cuerpo» en medios. */
(function(){
  const BPM = 128, NEGRA = 60 / BPM, S16 = NEGRA / 4, COMPAS = NEGRA * 4;
  const CUENTA_COMPASES = 192;                                // 192 compases a 128 bpm = 6 minutos
  const VENTANA_MS = CUENTA_COMPASES * COMPAS * 1000;         // 360 000 ms
  const PASO_CERO = CUENTA_COMPASES * 16;
  const VOL = .78;
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);
  const SON = () => window.IBSonido || null;

  // armonía: modo menor para la cuenta atrás y la tensión; mayor («himno») para la fiesta
  const MENOR = { raiz: [41, 37, 44, 39], pad: [[65, 68, 72], [61, 65, 68], [68, 72, 75], [63, 67, 70]],
    gancho: [[72, 0, 68, 72, 0, 77, 0, 75], [73, 0, 72, 68, 0, 65, 0, 68], [75, 0, 72, 75, 0, 80, 0, 79], [79, 0, 77, 75, 0, 70, 0, 72]] };
  const MAYOR = { raiz: [44, 39, 41, 37], pad: [[68, 72, 75], [67, 70, 75], [65, 68, 72], [65, 68, 73]],
    gancho: [[75, 75, 0, 72, 75, 0, 80, 0], [79, 0, 77, 75, 0, 70, 0, 75], [77, 0, 75, 72, 0, 68, 0, 72], [73, 0, 75, 77, 0, 80, 0, 79]] };

  let ac = null, B = null, RUIDO = null, IMP = null;
  let modo = 'off', nivel = 0, ancla = 0, pasoSig = 0, base = 0, timer = 0, pendiente = null, atCuenta = 0;
  let pad = null, dron = null, mudoV = false, apagando = 0;

  /* ======================= motor ======================= */
  function iniciar(){
    if(ac && B) return true;
    try{
      ac = (SON() && SON().ctx && SON().ctx()) || null;
      if(!ac){ const A = window.AudioContext || window.webkitAudioContext; if(!A) return false; ac = new A(); }
      const lim = ac.createDynamicsCompressor();   // limitador: que no distorsione en ningún altavoz
      lim.threshold.value = -9; lim.knee.value = 6; lim.ratio.value = 12; lim.attack.value = .004; lim.release.value = .18;
      const master = ac.createGain(); master.gain.value = 0;
      master.connect(lim).connect(ac.destination);
      const drums = ac.createGain(); drums.gain.value = .95;
      const drumF = ac.createBiquadFilter(); drumF.type = 'lowpass'; drumF.frequency.value = 18000; drumF.Q.value = .4;
      drums.connect(drumF).connect(master);
      const music = ac.createGain(); music.gain.value = .6;
      const duck = ac.createGain(); duck.gain.value = 1;           // «sidechain»: baja con cada bombo
      const musF = ac.createBiquadFilter(); musF.type = 'lowpass'; musF.frequency.value = 18000; musF.Q.value = .6;
      music.connect(duck).connect(musF).connect(master);
      const fx = ac.createGain(); fx.gain.value = .9; fx.connect(master);
      const rev = ac.createConvolver(); rev.buffer = impulso(2.4); const revG = ac.createGain(); revG.gain.value = .32; rev.connect(revG).connect(master);
      const del = ac.createDelay(1.5); del.delayTime.value = S16 * 3;
      const fb = ac.createGain(); fb.gain.value = .32; const dF = ac.createBiquadFilter(); dF.type = 'lowpass'; dF.frequency.value = 3400;
      del.connect(dF); dF.connect(fb); fb.connect(del); const delG = ac.createGain(); delG.gain.value = .28; dF.connect(delG).connect(master);
      B = { master, drums, drumF, music, duck, musF, fx, rev, del };
      document.addEventListener('visibilitychange', () => { if(!document.hidden && ac && ac.state !== 'running') ac.resume().catch(() => {}); });
      return true;
    }catch(e){ ac = null; B = null; return false; }
  }
  function ruido(){
    if(RUIDO) return RUIDO;
    RUIDO = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
    const d = RUIDO.getChannelData(0); for(let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return RUIDO;
  }
  function impulso(seg){
    const n = Math.floor(ac.sampleRate * seg), b = ac.createBuffer(2, n, ac.sampleRate);
    for(let c = 0; c < 2; c++){ const d = b.getChannelData(c); for(let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3.2); }
    return b;
  }
  const silenciado = () => mudoV || (SON() && SON().mudo && SON().mudo());
  function volumen(v, seg){
    if(!B) return; const t = ac.currentTime, g = B.master.gain;
    g.cancelScheduledValues(t); g.setValueAtTime(g.value, t); g.linearRampToValueAtTime(silenciado() ? 0 : v, t + (seg || .05));
  }
  function rampa(param, v, t, seg){ try{ param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(v, t + seg); }catch(e){} }
  const lookahead = () => document.hidden ? 1.6 : .16;
  function bucle(){
    if(!ac || modo === 'off') return;
    const fin = ac.currentTime + lookahead();
    let n = 0;
    while(ancla + pasoSig * S16 < fin && n++ < 400){
      const t = ancla + pasoSig * S16;
      if(t >= ac.currentTime - .03){ try{ paso(pasoSig, t); }catch(e){} }
      pasoSig++;
      if(modo === 'off') break;
    }
  }
  function arrancar(){ if(!timer) timer = setInterval(bucle, 25); bucle(); }
  function parado(){ clearInterval(timer); timer = 0; }
  // cambia de sección: inmediato (re-anclando la rejilla en t) o en el próximo compás
  function ponerModo(m, t){
    modo = m; base = pasoSig; pendiente = null;
    if(t != null){ ancla = t; pasoSig = 0; base = 0; }
    rampa(B.music.gain, .6, ac.currentTime, .15); rampa(B.drums.gain, .95, ac.currentTime, .15);
  }

  /* ======================= instrumentos ======================= */
  function env(g, t, a, v, d){ g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(.0002, v), t + a); g.gain.exponentialRampToValueAtTime(.0001, t + a + d); }
  function osc(tipo, f, t, dur, v, dest, f2, a){
    const o = ac.createOscillator(), g = ac.createGain(); o.type = tipo; o.frequency.setValueAtTime(f, t); if(f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur * .6);
    env(g, t, a || .004, v, dur); o.connect(g); (Array.isArray(dest) ? dest : [dest]).forEach(d => g.connect(d)); o.start(t); o.stop(t + dur + .06); return o;
  }
  function soplo(t, tipo, f, v, dur, dest, f2, q, a){
    const s = ac.createBufferSource(), fl = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = ruido(); s.loop = dur > 1.9; fl.type = tipo; fl.frequency.setValueAtTime(f, t); if(f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur); fl.Q.value = q || .8;
    env(g, t, a || .003, v, dur); s.connect(fl).connect(g); (Array.isArray(dest) ? dest : [dest]).forEach(d => g.connect(d)); s.start(t); s.stop(t + dur + .06);
  }
  function bombo(t, v){
    osc('sine', 165, t, .42, v, B.drums, 46);
    osc('triangle', 240, t, .09, v * .55, B.drums, 110);   // «cuerpo» que se oye en el móvil
    soplo(t, 'highpass', 3800, v * .22, .014, B.drums);    // clic de ataque
    const d = B.duck.gain; d.cancelScheduledValues(t); d.setValueAtTime(.32, t); d.linearRampToValueAtTime(1, t + NEGRA * .82);
  }
  function palmas(t, v){ [0, .011, .023].forEach((x, i) => soplo(t + x, 'bandpass', 1450, v * (i === 2 ? 1 : .7), i === 2 ? .16 : .018, [B.drums, B.rev], 0, .9)); }
  function charles(t, v, abierto){ soplo(t, 'highpass', abierto ? 7200 : 9000, v, abierto ? .2 : .035, B.drums); }
  function caja(t, v){ soplo(t, 'bandpass', 1900, v, .11, [B.drums, B.rev], 0, .7); osc('triangle', 210, t, .09, v * .5, B.drums, 150); }
  function platillo(t, v){ soplo(t, 'highpass', 5200, v, 2.6, [B.fx, B.rev]); }
  function bajo(t, n, v, corte){
    const o = ac.createOscillator(), o2 = ac.createOscillator(), f = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o2.type = 'square'; o.frequency.value = mtof(n); o2.frequency.value = mtof(n - 12);
    f.type = 'lowpass'; f.Q.value = 3; f.frequency.setValueAtTime(220, t); f.frequency.exponentialRampToValueAtTime(corte, t + .02); f.frequency.exponentialRampToValueAtTime(260, t + S16 * 1.7);
    env(g, t, .004, v, S16 * 1.6); o.connect(f); o2.connect(f); f.connect(g).connect(B.music);
    o.start(t); o2.start(t); o.stop(t + S16 * 2); o2.stop(t + S16 * 2);
  }
  function pluck(t, n, v, brillo){
    const f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass'; f.Q.value = 2;
    f.frequency.setValueAtTime(700, t); f.frequency.exponentialRampToValueAtTime(1200 + brillo * 5200, t + .008); f.frequency.exponentialRampToValueAtTime(900, t + .22);
    env(g, t, .003, v, .32); f.connect(g); g.connect(B.music); g.connect(B.del); g.connect(B.rev);
    [-7, 7].forEach(dt => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = dt; o.connect(f); o.start(t); o.stop(t + .4); });
  }
  function campana(t, n, v){
    osc('sine', mtof(n), t, 1.4, v, [B.music, B.rev]); osc('sine', mtof(n) * 2.01, t, .7, v * .35, [B.music, B.rev]); osc('triangle', mtof(n + 12), t, .25, v * .25, B.music);
  }
  function latido(t, v){   // «lub-dub»: grave + cuerpo en medios para que se oiga en el móvil
    osc('sine', 92, t, .2, v, B.fx, 52); osc('triangle', 150, t, .1, v * .6, B.fx, 95); soplo(t, 'lowpass', 600, v * .25, .05, B.fx);
    osc('sine', 80, t + .2, .24, v * .75, B.fx, 46); osc('triangle', 130, t + .2, .11, v * .45, B.fx, 85);
  }
  function tom(t, v){ osc('sine', 110, t, .35, v, B.drums, 60); osc('triangle', 180, t, .12, v * .5, B.drums, 100); soplo(t, 'bandpass', 300, v * .4, .2, B.drums); }
  function subidaRuido(t, dur, v){
    soplo(t, 'bandpass', 350, v, dur, [B.fx, B.rev], 9000, 2.5, dur * .92);
    const o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter(); o.type = 'sawtooth';
    o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(1500, t + dur);
    f.type = 'bandpass'; f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(5000, t + dur); f.Q.value = 1.5;
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v * .35, t + dur * .95); g.gain.exponentialRampToValueAtTime(.0001, t + dur + .05);
    o.connect(f).connect(g); g.connect(B.fx); g.connect(B.rev); o.start(t); o.stop(t + dur + .1);
  }
  function acordeGolpe(t, notas, v, dur){
    const f = ac.createBiquadFilter(), g = ac.createGain(); f.type = 'lowpass'; f.frequency.setValueAtTime(6000, t); f.frequency.exponentialRampToValueAtTime(1200, t + dur);
    env(g, t, .006, v, dur); f.connect(g); g.connect(B.fx); g.connect(B.rev);
    notas.forEach(n => [-12, 0, 12].forEach(dt => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = mtof(n); o.detune.value = dt; o.connect(f); o.start(t); o.stop(t + dur + .1); }));
  }
  function impacto(t, grande){
    osc('sine', 120, t, grande ? 2 : 1.1, grande ? 1 : .8, B.fx, 30);
    osc('triangle', 230, t, .5, .5, B.fx, 70);
    soplo(t, 'lowpass', 1500, .7, .7, B.fx, 160);
    platillo(t, grande ? .5 : .32);
    acordeGolpe(t, grande ? [56, 68, 72, 75, 80] : [68, 72, 75], grande ? .07 : .05, grande ? 2.6 : 1.4);
  }

  // pad continuo (12 sierras desafinadas): se le cambian las notas en cada acorde, no se crea y destruye
  function crearPad(){
    const g = ac.createGain(); g.gain.value = 0;
    const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 900; f.Q.value = .7;
    const trem = ac.createGain(); trem.gain.value = 1;
    const lfo = ac.createOscillator(), lfoG = ac.createGain(); lfo.type = 'triangle'; lfo.frequency.value = 1 / (S16 * 2); lfoG.gain.value = 0; lfo.connect(lfoG).connect(trem.gain); lfo.start();
    f.connect(trem).connect(g); g.connect(B.music); g.connect(B.rev);
    const voces = [0, 1, 2, 3].map(() => [-13, 0, 13].map(dt => { const o = ac.createOscillator(); o.type = 'sawtooth'; o.detune.value = dt; o.frequency.value = 220; o.connect(f); o.start(); return o; }));
    return {
      g, f, lfoG,
      acorde(t, notas){ voces.forEach((vs, i) => { const n = notas[i % notas.length] + (i >= notas.length ? -12 : 0); vs.forEach(o => o.frequency.setValueAtTime(mtof(n), t)); }); },
      fin(){ try{ voces.flat().concat([lfo]).forEach(o => o.stop()); g.disconnect(); }catch(e){} }
    };
  }
  function crearDron(){
    const g = ac.createGain(); g.gain.value = 0; const f = ac.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = 260; f.Q.value = 1.4;
    const a = ac.createOscillator(), b = ac.createOscillator(); a.type = 'sawtooth'; b.type = 'sine'; a.frequency.value = mtof(29); b.frequency.value = mtof(41);
    a.connect(f); b.connect(f); f.connect(g).connect(B.music); a.start(); b.start();
    return { g, f, nota(t, n){ a.frequency.setValueAtTime(mtof(n - 12), t); b.frequency.setValueAtTime(mtof(n), t); }, fin(){ try{ a.stop(); b.stop(); g.disconnect(); }catch(e){} } };
  }
  const P = () => pad || (pad = crearPad());
  const D = () => dron || (dron = crearDron());
  function padNivel(t, v, corte, trem){ const p = P(); rampa(p.g.gain, v, t, .25); rampa(p.f.frequency, corte, t, .4); rampa(p.lfoG.gain, trem || 0, t, .3); }

  /* ======================= la canción ======================= */
  function secCuenta(k){
    const rest = CUENTA_COMPASES - Math.floor(k / 16);   // compases que quedan (incluido este)
    if(rest > 160) return ['intro', 32 - (rest - 160)];
    if(rest > 128) return ['subida', 32 - (rest - 128)];
    if(rest > 96) return ['dropA', 32 - (rest - 96)];
    if(rest > 64) return ['pausa', 32 - (rest - 64)];
    if(rest > 32) return ['dropB', 32 - (rest - 32)];
    if(rest > 16) return ['pausa2', 16 - (rest - 16)];
    return ['final', 16 - rest];
  }
  // redoble que se acelera en los últimos compases de una subida (lb: compás dentro de la subida de «largo» compases)
  function redoble(t, s, lb, largo, vmax){
    const q = largo - lb;   // compases que faltan
    const cada = q > 8 ? 0 : q > 4 ? 4 : q > 2 ? 2 : 1;
    if(!cada || s % cada) return;
    const v = vmax * (1 - q / 9) + .04;
    caja(t, v); if(q <= 1) caja(t + S16 / 2, v);
  }
  function drop(t, k, s, b, H, fuerza, octava){
    const ch = Math.floor(b) % 4;
    if(s === 0){ if(b % 8 === 0) platillo(t, .32); padNivel(t, .085 * fuerza, 5200, 0); P().acorde(t, H.pad[ch]); }
    if(s % 4 === 0) bombo(t, .95);
    if(s === 4 || s === 12) palmas(t, .5);
    if(s % 4 === 2){ charles(t, .1, true); bajo(t, H.raiz[ch] + 12, .3 * fuerza, 2400); }
    if(s % 4 === 3) bajo(t, H.raiz[ch] + 12, .2 * fuerza, 1800);
    if(fuerza > .9 && s % 2 === 1) charles(t, .035, false);
    if(s % 2 === 0){ const n = H.gancho[ch][s / 2]; if(n) pluck(t, n + (octava ? 12 : 0), .11 * fuerza, 1); }
  }
  function pasoCuenta(k, t){
    const s = k % 16;
    if(k >= PASO_CERO){   // ¡el 0! drop final y, al acabar, a la espera de la ruleta
      const b = Math.floor((k - PASO_CERO) / 16);
      if(k === PASO_CERO) impacto(t, true);
      if(b < 8) drop(t, k, s, b, MENOR, 1, true);
      else if(b < 16){ if(s === 0) padNivel(t, .06 * (16 - b) / 8, 3000 - b * 120, 0); if(s % 4 === 0 && b < 12) bombo(t, .7); if(s === 0) P().acorde(t, MENOR.pad[b % 4]); if(s % 4 === 2 && b < 12) charles(t, .07, true); }
      else { if(!apagando) API.parar(2); return; }   // tras el drop final se apaga (la cinta va sin música)
      return;
    }
    const [sec, lb] = secCuenta(k), b = Math.floor(k / 16), ch2 = Math.floor(b / 2) % 4, ch1 = b % 4;
    if(sec === 'intro'){
      if(s === 0 && lb % 2 === 0){ P().acorde(t, MENOR.pad[ch2]); padNivel(t, .04 + lb * .0012, 700 + lb * 30, 0); }
      if(s === 0) rampa(B.drumF.frequency, 900 + lb * 160, t, COMPAS);
      if(s % 4 === 0) bombo(t, .55 + lb * .005);
      if(lb >= 16 && s % 4 === 2) charles(t, .05, true);
      if(lb >= 8 && s % 4 === 0){ const n = MENOR.gancho[ch2][s / 2]; if(n) campana(t, n, .05); }
    } else if(sec === 'subida'){
      if(s === 0){ P().acorde(t, MENOR.pad[ch1]); padNivel(t, .055, 1600 + lb * 45, 0); rampa(B.drumF.frequency, Math.min(18000, 6000 + lb * 600), t, COMPAS); }
      if(lb < 31 && s % 4 === 0) bombo(t, .75);
      if(lb >= 8 && (s === 4 || s === 12)) palmas(t, .4);
      if(s % 4 === 2){ charles(t, .07, true); bajo(t, MENOR.raiz[ch1] + 12, .2, 500 + lb * 40); }
      if(lb >= 16 && s % 2 === 0){ const n = MENOR.gancho[ch1][s / 2]; if(n) pluck(t, n, .06, .35 + lb / 60); }
      redoble(t, s, lb, 32, .4);
      if(lb === 28 && s === 0) subidaRuido(t, COMPAS * 4, .5);
    } else if(sec === 'dropA' || sec === 'dropB'){
      if(lb === 0 && s === 0){ impacto(t, false); rampa(B.drumF.frequency, 18000, t, .05); }
      drop(t, k, s, b, MENOR, sec === 'dropB' ? 1 : .9, sec === 'dropB' && lb >= 16);
    } else if(sec === 'pausa' || sec === 'pausa2'){
      const largo = sec === 'pausa' ? 32 : 16;
      if(s === 0 && lb % 2 === 0){ P().acorde(t, MENOR.pad[ch2]); padNivel(t, .065, 1100 + lb * 20, 0); }
      if(s % 4 === 0){ const n = MENOR.gancho[ch2][s / 2]; if(n) campana(t, n, .07); }
      if(sec === 'pausa' && lb >= 16 && s === 0) latido(t, .45);
      if(sec === 'pausa2' && s % 8 === 0) latido(t, .4 + lb * .02);
      if(sec === 'pausa'){ redoble(t, s, lb, largo, .35); if(lb === 28 && s === 0) subidaRuido(t, COMPAS * 4, .45); if(lb >= 24 && s % 4 === 0) bombo(t, .5 + (lb - 24) * .05); }
    } else {   // final: 16 compases (30 s) de subida hasta el 0
      if(s === 0){ P().acorde(t, MENOR.pad[ch1]); padNivel(t, .06 + lb * .003, 1500 + lb * 300, lb >= 12 ? .35 : 0); rampa(B.drumF.frequency, 18000, t, .1); }
      if(lb < 8 ? s % 4 === 0 : (lb < 12 ? s % 4 === 0 : false)) bombo(t, .7 + lb * .015);
      if(s % 4 === 2) bajo(t, MENOR.raiz[ch1] + 12, .18 + lb * .006, 400 + lb * 160);
      if(s % 2 === 0 && lb < 14){ const n = MENOR.gancho[ch1][s / 2]; if(n) pluck(t, n, .07, .3 + lb / 20); }
      if(lb >= 8) redoble(t, s, lb - 8, 8, .5);
      if(lb >= 12 && s % 4 === 0) latido(t, .55);
      if(lb === 8 && s === 0) subidaRuido(t, COMPAS * 8 - .02, .6);
    }
  }
  function pasoTension(k, t){
    const s = k % 16, b = Math.floor((k - base) / 16), lv = nivel;
    if(s === 0){
      const ch = Math.floor(b / 2) % 2 ? 1 : 0;   // Fa menor ↔ Re♭
      D().nota(t, MENOR.raiz[ch]); rampa(D().g.gain, .06 + lv * .12, t, .3); rampa(D().f.frequency, 240 + lv * 1500, t, .5);
      P().acorde(t, MENOR.pad[ch]); padNivel(t, lv >= .5 ? .03 + lv * .05 : .022, 700 + lv * 2600, lv >= .5 ? .45 : 0);
    }
    const cadaLat = lv >= .85 ? 4 : lv >= .5 ? 8 : 16;
    if(s % cadaLat === 0) latido(t, .45 + lv * .45);
    if(lv >= .3) charles(t, (s % 4 === 2 ? .05 : .018) + lv * .04, false); else if(s % 4 === 2) charles(t, .025, false);
    if(lv >= .6 && s % 8 === 4) tom(t, .25 + lv * .2);
    if(lv >= .5 && s % 8 === 0){ const n = [72, 73][Math.floor(b / 2) % 2 ? 1 : 0]; campana(t, n + 12, .03 + lv * .02); }
  }
  function pasoFiesta(k, t, ligera){
    const s = k % 16, b = Math.floor((k - base) / 16), ch = b % 4;
    if(k === base && s === 0 && !ligera) platillo(t, .4);
    if(ligera){
      if(s === 0){ P().acorde(t, MAYOR.pad[ch]); padNivel(t, .045, 3200, 0); if(b % 8 === 0) platillo(t, .18); }
      if(s % 4 === 0) bombo(t, .7);
      if(s === 4 || s === 12) palmas(t, .35);
      if(s % 4 === 2){ charles(t, .07, true); bajo(t, MAYOR.raiz[ch] + 12, .16, 1400); }
      if(s % 2 === 0){ const n = MAYOR.gancho[ch][s / 2]; if(n) campana(t, n, .06); }
      return;
    }
    drop(t, k, s, b, MAYOR, 1, b % 16 >= 8);
    if(b % 8 === 7) redoble(t, s, 7, 8, .3);
  }
  function paso(k, t){
    if(pendiente && k % 16 === 0){ const p = pendiente; pendiente = null; modo = p; base = k; }
    if(modo === 'cuenta') return pasoCuenta(k, t);
    if(modo === 'tension') return pasoTension(k, t);
    if(modo === 'fiesta') return pasoFiesta(k, t, false);
    if(modo === 'feliz') return pasoFiesta(k, t, true);
  }

  /* ======================= API ======================= */
  function empezarSiParado(fade){
    if(modo !== 'off' && modo !== 'mp3' && !apagando) return false;
    clearTimeout(apagando); apagando = 0;
    ancla = ac.currentTime + .06; pasoSig = 0; base = 0; pendiente = null;
    rampa(B.music.gain, .6, ac.currentTime, .3); rampa(B.drums.gain, .95, ac.currentTime, .3);
    volumen(VOL, fade || 1);
    return true;
  }
  const API = {
    // tema de la cuenta atrás anclado a la hora del sorteo (at = milisegundos de reloj)
    cuenta(at){
      if(!at || !iniciar()) return;
      const inicioMs = +at - VENTANA_MS;
      if(modo === 'cuenta' && atCuenta === +at && !apagando) return;
      if(modo !== 'off' && modo !== 'cuenta' && !apagando) return;   // ya está en la ruleta o en la fiesta: no la volvemos atrás
      clearTimeout(apagando); apagando = 0;
      atCuenta = +at; modo = 'cuenta'; pendiente = null;
      ancla = ac.currentTime + (inicioMs - Date.now()) / 1000;
      pasoSig = Math.max(0, Math.ceil((ac.currentTime + .05 - ancla) / S16));
      const empieza = Math.max(ac.currentTime, ancla);
      B.master.gain.cancelScheduledValues(ac.currentTime); B.master.gain.setValueAtTime(B.master.gain.value, ac.currentTime);
      B.master.gain.linearRampToValueAtTime(B.master.gain.value, empieza);
      B.master.gain.linearRampToValueAtTime(silenciado() ? 0 : VOL, empieza + (ancla < ac.currentTime ? 2 : .6));
      arrancar();
    },
    // ya = true: cambia en el acto (re-ancla la rejilla); si no, en el próximo compás para que encaje con la música
    tension(lv, ya){
      if(!iniciar()) return;
      nivel = Math.max(0, Math.min(1, lv));
      if(empezarSiParado(1.2)){ modo = 'tension'; base = 0; arrancar(); return; }
      if(modo === 'tension') return;
      if(ya){ ponerModo('tension', ac.currentTime + .03); arrancar(); }
      else pendiente = 'tension';
    },
    subida(seg){
      if(!iniciar() || modo === 'off') return;
      const t = ac.currentTime + .02;
      subidaRuido(t, seg, .55);
      const n = Math.floor(seg / (S16 / 2));
      for(let i = 0; i < n; i++){ const x = i / n, tt = t + i * (S16 / 2); if(x > .35 || i % 2 === 0) caja(tt, .05 + x * .35); }
    },
    golpe(tipo, op){
      if(!iniciar()) return;
      op = op || {};
      const t = ac.currentTime + .02;
      if(modo === 'off' || apagando){ clearTimeout(apagando); apagando = 0; volumen(VOL, .05); }
      if(tipo === 'nada'){ nivel = .22; if(modo !== 'tension') pendiente = 'tension'; return; }
      impacto(t, tipo === 'ultra');
      if(op.conMp3){   // la canción del panel entra en el mismo instante: la base se aparta
        rampa(B.music.gain, 0, ac.currentTime, .25); rampa(B.drums.gain, 0, ac.currentTime, .25);
        if(pad) rampa(pad.g.gain, 0, ac.currentTime, .3); if(dron) rampa(dron.g.gain, 0, ac.currentTime, .3);
        modo = 'mp3'; pendiente = null; parado();
        return;
      }
      if(dron) rampa(dron.g.gain, 0, t, .4);
      ponerModo(tipo === 'ultra' ? 'fiesta' : 'feliz', t);
      arrancar();
    },
    calmar(){ if(modo === 'off' && !apagando) return; API.tension(.25); },
    parar(seg){
      if(!ac || !B || modo === 'off') return;
      seg = seg == null ? 1.5 : seg;
      volumen(0, seg);
      clearTimeout(apagando);
      apagando = setTimeout(() => { apagando = 0; modo = 'off'; pendiente = null; parado(); if(pad){ pad.fin(); pad = null; } if(dron){ dron.fin(); dron = null; } }, seg * 1000 + 120);
    },
    mudo(v){ mudoV = !!v; if(B && modo !== 'off' && !apagando) volumen(VOL, .1); },
    sonando(){ return modo !== 'off' && !apagando; },
    modo(){ return modo; },
    INICIO_MS: VENTANA_MS
  };
  window.IBBanda = API;
})();
