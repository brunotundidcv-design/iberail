/* Iberail — celebraciones del sorteo (las usa assets/ruleta.js)
   · IBFiesta.premio(el, { tier, item })        → confeti a cañonazos, el premio salta y brilla   →  { fin() }
   · IBFiesta.ultra(el, { nombre, test, onCerrar }) → a pantalla completa: destello, onda expansiva, rayos,
       fuegos artificiales, lluvia de confeti, la entrada dorada en 3D con su nombre, «¡TE VAS AL ULTRA!»
       letra a letra y botón para compartirlo en su story                                    →  { fin() }
   Con «reducir movimiento» activado en el móvil: sin destellos, sin temblores y sin partículas. */
(function(){
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const S = () => window.IBSonido || null;
  const vibrar = p => { try{ if(navigator.vibrate) navigator.vibrate(p); }catch(e){} };
  const COLS = ['#FFD66B', '#F0B02A', '#FFF3DC', '#F0532F', '#FF8A5B', '#FFE39A', '#FFFFFF'];
  const ORO = ['#FFF0C2', '#FFD66B', '#F0B02A', '#FFE39A', '#FFFFFF'];
  const al = (a, b) => a + Math.random() * (b - a);

  /* ======================= partículas en canvas ======================= */
  function lienzo(host){
    const cv = document.createElement('canvas'); cv.className = 'fx-cv'; cv.setAttribute('aria-hidden', 'true');
    host.appendChild(cv);
    const c = cv.getContext('2d');
    let W = 0, H = 0;
    const fit = () => { const d = Math.min(2, window.devicePixelRatio || 1); W = cv.clientWidth || innerWidth; H = cv.clientHeight || innerHeight; cv.width = W * d; cv.height = H * d; c.setTransform(d, 0, 0, d, 0, 0); };
    fit(); addEventListener('resize', fit);
    const ps = [], cohetes = [], emisores = [];
    let raf = 0, last = performance.now(), muerto = false;
    const MAX = 900;   // tope de partículas para que no se arrastre en móviles

    function confeti(x, y, n, ang, abre, vel){
      for(let i = 0; i < n && ps.length < MAX; i++){
        const a = ang + (Math.random() - .5) * abre, v = vel * al(.45, 1.05);
        ps.push({ k: 0, x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, w: al(6, 12), h: al(10, 18), r: al(0, 6.28), vr: al(-9, 9), o: al(0, 6.28), vo: al(4, 11), col: COLS[(Math.random() * COLS.length) | 0], t: 0, ttl: al(3.5, 6) });
      }
    }
    function chispas(x, y, n, cols, vel){
      for(let i = 0; i < n && ps.length < MAX; i++){
        const a = (i / n) * 6.283 + al(-.08, .08), v = vel * al(.55, 1);
        ps.push({ k: 1, x, y, px: x, py: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, col: cols[(Math.random() * cols.length) | 0], t: 0, ttl: al(1.1, 1.9), br: Math.random() < .3 });
      }
    }
    function cohete(x, alto, cols){
      const g = 700, sube = H - alto;
      cohetes.push({ x: x == null ? al(W * .12, W * .88) : x, y: H + 8, vx: al(-40, 40), vy: -Math.sqrt(2 * g * Math.max(120, sube)), g, cols: cols || (Math.random() < .5 ? ORO : COLS) });
    }
    // emisor: cada «paso» segundos llama a fn, durante «dura» segundos (Infinity = hasta fin())
    function cada(paso, dura, fn){ emisores.push({ paso, dura, fn, t: 0, acc: paso }); arrancar(); }

    function frame(now){
      if(muerto) return;
      if(!host.isConnected){ fin(); return; }
      const dt = Math.min(.05, (now - last) / 1000); last = now;
      for(let i = emisores.length - 1; i >= 0; i--){ const e = emisores[i]; e.t += dt; e.acc += dt; while(e.acc >= e.paso){ e.acc -= e.paso; e.fn(); } if(e.t >= e.dura) emisores.splice(i, 1); }
      c.clearRect(0, 0, W, H);
      for(let i = cohetes.length - 1; i >= 0; i--){
        const k = cohetes[i]; k.vy += k.g * dt; k.x += k.vx * dt; k.y += k.vy * dt;
        c.globalCompositeOperation = 'lighter'; c.fillStyle = '#FFE39A'; c.beginPath(); c.arc(k.x, k.y, 2.6, 0, 6.283); c.fill();
        if(ps.length < MAX) ps.push({ k: 1, x: k.x, y: k.y, px: k.x, py: k.y + 6, vx: al(-20, 20), vy: al(20, 60), col: '#FFB347', t: 0, ttl: .45 });
        if(k.vy >= -30){ cohetes.splice(i, 1); chispas(k.x, k.y, (al(60, 95)) | 0, k.cols, al(260, 420)); const s = S(); if(s) s.pop(); }
      }
      for(let i = ps.length - 1; i >= 0; i--){
        const p = ps[i]; p.t += dt;
        if(p.t >= p.ttl || p.y > H + 40){ ps.splice(i, 1); continue; }
        const vida = 1 - p.t / p.ttl;
        if(p.k === 0){
          p.vy += 520 * dt; p.vx *= 1 - 1.9 * dt; p.vy *= 1 - 1.9 * dt; p.vx += Math.sin(p.o) * 22 * dt;
          p.x += p.vx * dt; p.y += p.vy * dt; p.r += p.vr * dt; p.o += p.vo * dt;
          c.globalCompositeOperation = 'source-over'; c.globalAlpha = Math.min(1, vida * 2.5);
          c.save(); c.translate(p.x, p.y); c.rotate(p.r); c.scale(Math.cos(p.o), 1); c.fillStyle = p.col; c.fillRect(-p.w / 2, -p.h / 2, p.w, p.h); c.restore();
        } else {
          p.px = p.x; p.py = p.y; p.vy += 260 * dt; p.vx *= 1 - 1.3 * dt; p.vy *= 1 - 1.3 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
          c.globalCompositeOperation = 'lighter'; c.globalAlpha = vida * (p.br && Math.random() < .3 ? .3 : 1);
          c.strokeStyle = p.col; c.lineWidth = 2.2; c.beginPath(); c.moveTo(p.px, p.py); c.lineTo(p.x, p.y); c.stroke();
        }
      }
      c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      if(ps.length || cohetes.length || emisores.length) raf = requestAnimationFrame(frame); else raf = 0;
    }
    function arrancar(){ if(!raf && !muerto){ last = performance.now(); raf = requestAnimationFrame(frame); } }
    function fin(){ muerto = true; cancelAnimationFrame(raf); raf = 0; removeEventListener('resize', fit); cv.remove(); }
    return {
      confeti(...a){ confeti(...a); arrancar(); }, chispas(...a){ chispas(...a); arrancar(); }, cohete(...a){ cohete(...a); arrancar(); },
      cada, fin, get W(){ return W; }, get H(){ return H; }
    };
  }

  /* ======================= premio normal ======================= */
  function premio(el, op){
    op = op || {};
    const box = el.querySelector('.rul-box');
    vibrar([70, 40, 110]);
    if(reduce()) return { fin(){} };
    box.classList.remove('fx-bump'); void box.offsetWidth; box.classList.add('fx-bump');
    const glow = document.createElement('div'); glow.className = 'fx-glow' + (op.tier === 'alto' ? ' is-alto' : ''); glow.setAttribute('aria-hidden', 'true'); el.appendChild(glow);
    const fx = lienzo(el);
    const W = fx.W, H = fx.H;
    // dos cañones desde abajo y una explosión donde ha parado la cinta
    fx.confeti(0, H * .92, 110, -1.05, .55, 1500);
    fx.confeti(W, H * .92, 110, -2.09, .55, 1500);
    const r = op.item && op.item.getBoundingClientRect();
    if(r && r.width) fx.chispas(r.left + r.width / 2, r.top + r.height / 2, 70, ORO, 380);
    setTimeout(() => { fx.confeti(W * .5, H * .95, 90, -1.57, .9, 1650); }, 450);
    fx.cada(.05, 2.4, () => fx.confeti(al(0, fx.W), -20, 2, 1.57, .6, 120));   // lluvia
    if(op.tier === 'alto'){ [0, 380, 760].forEach(t => setTimeout(() => fx.cohete(null, al(H * .55, H * .8)), t)); }
    let hecho = false;
    return { fin(){ if(hecho) return; hecho = true; fx.fin(); glow.remove(); box.classList.remove('fx-bump'); } };
  }

  /* ======================= ¡ULTRA! ======================= */
  function ultra(el, op){
    op = op || {};
    const r = reduce(), box = el.querySelector('.rul-box'), nombre = String(op.nombre || '').trim();
    vibrar([220, 90, 220, 90, 600]);
    const timers = [];
    const luego = (ms, fn) => timers.push(setTimeout(fn, ms));
    let fx = null, capa = null, hecho = false;

    // 1) el golpe: destello y temblor
    if(!r){
      const fl = document.createElement('div'); fl.className = 'fx-flash'; fl.setAttribute('aria-hidden', 'true'); el.appendChild(fl);
      luego(1300, () => fl.remove());
      box.classList.add('fx-shake'); luego(900, () => box.classList.remove('fx-shake'));
    }

    // 2) la capa a pantalla completa
    const letras = t => t.split('').map((ch, i) => ch === ' ' ? '<span class="ru-sp"> </span>' : `<span class="ru-l" style="--i:${i}">${esc(ch)}</span>`).join('');
    luego(r ? 0 : 650, () => {
      if(hecho) return;
      capa = document.createElement('div');
      capa.className = 'ru' + (r ? ' is-calm' : '');
      capa.setAttribute('role', 'dialog'); capa.setAttribute('aria-modal', 'true'); capa.setAttribute('aria-label', '¡Te ha tocado una entrada para el Ultra Europe 2027!');
      capa.innerHTML = `
        <div class="ru-rays" aria-hidden="true"></div>
        <button type="button" class="ru-snd" data-ru-snd aria-label="Activar o quitar el sonido">${S() && S().mudo() ? '🔇' : '🔊'}</button>
        <div class="ru-rings" aria-hidden="true"><i></i><i></i><i></i></div>
        <div class="ru-in">
          ${op.test ? '<span class="ru-test">Simulación · no cuenta</span>' : ''}
          <span class="ru-k">🎉 Sorteo Iberail · ¡Premio gordo! 🎉</span>
          <h2 class="ru-h" aria-label="¡Te vas al Ultra!"><span class="ru-row">${letras('¡TE VAS')}</span> <span class="ru-row">${letras('AL ULTRA!')}</span></h2>
          <div class="ru-tk-wrap" data-ru-tilt>
            <div class="ru-tk">
              <div class="ru-tk-main">
                <span class="ru-tk-k">Admit one · Pase 3 días</span>
                <b class="ru-tk-t">Ultra Europe</b>
                <span class="ru-tk-y">2027</span>
                <div class="ru-tk-meta"><span><small>Lugar</small>Split, Croacia</span><span><small>Fechas</small>9 — 11 jul</span></div>
                ${nombre ? `<span class="ru-tk-who"><small>A nombre de</small>${esc(nombre)}</span>` : ''}
              </div>
              <div class="ru-tk-stub" aria-hidden="true"><span>🎟️</span></div>
              <i class="ru-holo" aria-hidden="true"></i>
            </div>
          </div>
          <p class="ru-p">Enhorabuena${nombre ? ', <b>' + esc(nombre) + '</b>' : ''}. Tu abono de 3 días para el <b>Ultra Europe 2027</b> es tuyo. Te escribimos por WhatsApp con todos los detalles.</p>
          <div class="ru-acts">
            <button type="button" class="ru-share" data-ru-share>📸 Compártelo en tu story</button>
            <button type="button" class="ru-ok" data-ru-ok>¡Vamos! 🎉</button>
          </div>
        </div>`;
      el.appendChild(capa);
      requestAnimationFrame(() => requestAnimationFrame(() => capa.classList.add('is-in')));
      const ok = capa.querySelector('[data-ru-ok]'); setTimeout(() => { try{ ok.focus({ preventScroll: true }); }catch(e){} }, 2600);

      // la entrada se inclina siguiendo el dedo o el ratón
      const wrap = capa.querySelector('[data-ru-tilt]');
      capa.addEventListener('pointermove', e => {
        const b = wrap.getBoundingClientRect(); if(!b.width) return;
        const x = (e.clientX - b.left) / b.width - .5, y = (e.clientY - b.top) / b.height - .5;
        wrap.style.setProperty('--ry', (x * 22).toFixed(2) + 'deg'); wrap.style.setProperty('--rx', (-y * 16).toFixed(2) + 'deg');
        wrap.style.setProperty('--hx', ((x + .5) * 100).toFixed(1) + '%');
      });
      capa.addEventListener('pointerleave', () => { wrap.style.removeProperty('--ry'); wrap.style.removeProperty('--rx'); });
      capa.addEventListener('click', e => {
        if(e.target.closest('[data-ru-ok]')) return cerrar();
        const sn = e.target.closest('[data-ru-snd]');
        if(sn && S()){ S().unlock(); S().setMudo(!S().mudo()); sn.textContent = S().mudo() ? '🔇' : '🔊'; const rb = el.querySelector('[data-rul-snd]'); if(rb){ rb.textContent = sn.textContent; rb.classList.toggle('is-off', S().mudo()); } return; }
        const sh = e.target.closest('[data-ru-share]'); if(sh) compartir(sh, nombre);
      });
      document.addEventListener('keydown', teclado);

      if(r) return;
      // 3) fuegos artificiales y confeti
      fx = lienzo(capa);
      const W = fx.W, H = fx.H;
      fx.confeti(0, H, 160, -1.0, .6, 1750);
      fx.confeti(W, H, 160, -2.14, .6, 1750);
      luego(350, () => fx && fx.confeti(W / 2, H * .45, 140, -1.57, 6.28, 900));
      for(let i = 0; i < 5; i++) luego(500 + i * 260, () => fx && fx.cohete(null, al(H * .55, H * .85)));
      luego(1900, () => fx && fx.cada(.42, 8, () => { fx.cohete(null, al(H * .5, H * .88)); if(Math.random() < .35) fx.cohete(null, al(H * .5, H * .88)); }));
      luego(10000, () => fx && fx.cada(1.6, Infinity, () => fx.cohete(null, al(H * .5, H * .85))));
      fx.cada(.03, 7, () => fx.confeti(al(0, fx.W), -20, 2, 1.57, .5, 140));   // lluvia de confeti
      luego(3200, () => fx && fx.cada(.09, Infinity, () => fx.confeti(al(0, fx.W), -20, 1, 1.57, .5, 110)));
    });

    function teclado(e){ if(e.key === 'Escape' && capa) cerrar(); }
    function cerrar(){
      if(!capa) return;
      const c = capa; capa = null;
      document.removeEventListener('keydown', teclado);
      c.classList.remove('is-in'); c.classList.add('is-out');
      setTimeout(() => { if(fx){ fx.fin(); fx = null; } c.remove(); }, 450);
      if(op.onCerrar) op.onCerrar();
    }
    return {
      fin(){
        if(hecho) return; hecho = true;
        timers.forEach(clearTimeout); document.removeEventListener('keydown', teclado);
        if(fx){ fx.fin(); fx = null; } if(capa){ capa.remove(); capa = null; }
        box.classList.remove('fx-shake'); el.querySelectorAll('.fx-flash').forEach(x => x.remove());
      }
    };
  }

  /* ======================= imagen para la story ======================= */
  const FD = '"Bricolage Grotesque", "Poppins", system-ui, sans-serif', FM = '"IBM Plex Mono", ui-monospace, monospace', FB = '"Inter", system-ui, sans-serif';
  function rr(c, x, y, w, h, r){ c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function gold(c, x0, y0, x1, y1){ const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, '#FFF0C2'); g.addColorStop(.35, '#FFD66B'); g.addColorStop(.7, '#E9A53A'); g.addColorStop(1, '#FFE39A'); return g; }
  async function cartel(nombre){
    try{ await Promise.all([`800 120px ${FD}`, `700 60px ${FD}`, `500 30px ${FM}`, `600 40px ${FB}`].map(f => document.fonts.load(f))); }catch(e){}
    const W = 1080, H = 1920, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.fillStyle = '#140B08'; c.fillRect(0, 0, W, H);
    // rayos dorados desde el centro
    c.save(); c.translate(W / 2, 1080); c.globalAlpha = .1; c.fillStyle = '#FFD66B';
    for(let i = 0; i < 18; i++){ c.rotate(Math.PI / 9); c.beginPath(); c.moveTo(0, 0); c.lineTo(-90, -1500); c.lineTo(90, -1500); c.closePath(); c.fill(); }
    c.restore();
    [[540, 1080, 820, 'rgba(255,214,107,.30)'], [900, 200, 700, 'rgba(240,83,47,.40)'], [100, 1800, 700, 'rgba(240,83,47,.25)']].forEach(([x, y, r, col]) => { const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(20,11,8,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H); });
    // confeti
    for(let i = 0; i < 140; i++){ c.save(); c.translate(Math.random() * W, Math.random() * H); c.rotate(Math.random() * 6.28); c.globalAlpha = al(.35, .9); c.fillStyle = COLS[i % COLS.length]; c.fillRect(-7, -11, al(8, 14), al(14, 24)); c.restore(); }
    c.globalAlpha = 1;
    // marca
    c.textBaseline = 'alphabetic'; c.font = `800 64px ${FD}`;
    const w1 = c.measureText('ibe').width, w2 = c.measureText('rail').width, bx = W / 2 - (w1 + w2) / 2;
    c.textAlign = 'left'; c.fillStyle = '#FFF3DC'; c.fillText('ibe', bx, 230); c.fillStyle = '#F0532F'; c.fillText('rail', bx + w1, 230);
    c.textAlign = 'center'; c.font = `500 30px ${FM}`; c.fillStyle = '#FFD66B'; c.fillText('SORTEO  ·  ¡ME HA TOCADO!', W / 2, 320);
    c.fillStyle = '#FFFFFF'; c.font = `800 128px ${FD}`; c.fillText('¡Me voy al', W / 2, 520);
    c.fillStyle = gold(c, 120, 560, 960, 700); c.font = `800 150px ${FD}`; c.fillText('Ultra!', W / 2, 680);
    // la entrada
    c.save(); c.translate(W / 2, 1080); c.rotate(-.06);
    c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 70; c.shadowOffsetY = 34;
    rr(c, -430, -230, 860, 460, 40); c.fillStyle = gold(c, -430, -230, 430, 230); c.fill(); c.shadowColor = 'transparent';
    c.fillStyle = '#2A1611'; c.textAlign = 'left';
    c.globalAlpha = .7; c.font = `500 26px ${FM}`; c.fillText('ADMIT ONE · PASE 3 DÍAS', -370, -130); c.globalAlpha = 1;
    c.font = `800 92px ${FD}`; c.fillText('Ultra Europe', -372, -40);
    c.fillStyle = '#8C2A17'; c.font = `700 64px ${FD}`; c.fillText('2027', -370, 36);
    c.fillStyle = '#2A1611'; c.font = `700 34px ${FB}`; c.fillText('Split, Croacia · 9 — 11 jul', -370, 108);
    if(nombre){ c.globalAlpha = .65; c.font = `500 22px ${FM}`; c.fillText('A NOMBRE DE', -370, 162); c.globalAlpha = 1; c.font = `800 40px ${FD}`; c.fillText(nombre.slice(0, 22), -370, 204); }
    c.strokeStyle = 'rgba(42,22,17,.35)'; c.setLineDash([10, 8]); c.lineWidth = 3; c.beginPath(); c.moveTo(250, -200); c.lineTo(250, 200); c.stroke(); c.setLineDash([]);
    c.textAlign = 'center'; c.font = `64px ${FB}`; c.fillText('🎟️', 340, 22);
    c.restore();
    // pie
    c.textAlign = 'center'; c.fillStyle = 'rgba(255,243,220,.8)'; c.font = `600 44px ${FB}`; c.fillText('Gracias a', W / 2, 1530);
    c.fillStyle = gold(c, 250, 1560, 830, 1660); c.font = `800 104px ${FD}`; c.fillText('@iberailspain', W / 2, 1650);
    c.fillStyle = 'rgba(255,243,220,.7)'; c.font = `600 40px ${FB}`; c.fillText('iberail.com', W / 2, 1745);
    return new Promise(res => cv.toBlob(res, 'image/png'));
  }
  async function compartir(btn, nombre){
    const txt = btn.innerHTML; btn.disabled = true; btn.textContent = 'Preparando tu imagen…';
    try{
      const blob = await cartel(nombre);
      const file = new File([blob], 'me-voy-al-ultra-iberail.png', { type: 'image/png' });
      if(navigator.canShare && navigator.canShare({ files: [file] })){
        try{ await navigator.share({ files: [file], text: '¡Me ha tocado una entrada para el Ultra Europe 2027 con @iberailspain! 🎟️ iberail.com' }); }
        catch(e){ if(e && e.name !== 'AbortError') throw e; }
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
    }catch(e){ alert('No se pudo preparar la imagen. Prueba otra vez.'); }
    finally{ btn.disabled = false; btn.innerHTML = txt; }
  }

  window.IBFiesta = { premio, ultra, lienzo };
})();
