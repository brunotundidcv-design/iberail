/* Iberail — apertura del premio del sorteo (cinta estilo «caja», con flecha en el centro)
   El sorteo se celebra aparte; el equipo marca en el panel qué le ha tocado a cada uno y publica.
   Esta cinta es la forma de enseñárselo: pasa el catálogo real de premios y frena en el suyo.
   En la cinta solo salen premios que existen de verdad (ver supabase/sql/sorteo-premios.sql).

   Uso:  IBRuleta.show({ premio, catalogo, nombre, restantes, acta, test })  →  Promise
     premio    id del premio ganado, o null / '' si no le ha tocado nada
     catalogo  [{ id, label, n, tier }]  (tier: top | alto | medio | bajo)
     test      true = simulación del panel (no cuenta) */
(function(){
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- sonido ----------
     Opcional: si existen estos archivos, se usan. Si no, un sonido sintetizado.
       assets/snd/premio.mp3  → al ganar cualquier premio
       assets/snd/ultra.mp3   → al ganar la entrada del Ultra (si no está, usa premio.mp3)
       assets/snd/tic.mp3     → cada vez que pasa un premio por la flecha  */
  const SND = { premio: 'assets/snd/premio.mp3', ultra: 'assets/snd/ultra.mp3', tic: 'assets/snd/tic.mp3' };
  const MUTE = 'ib-srt-mute';
  const mudo = () => { try{ return localStorage.getItem(MUTE) === '1'; }catch(e){ return false; } };
  const setMudo = v => { try{ localStorage.setItem(MUTE, v ? '1' : '0'); }catch(e){} };
  let AC = null;
  const ctx = () => { try{ AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if(AC.state === 'suspended') AC.resume(); return AC; }catch(e){ return null; } };
  function beep(freq, dur, vol, tipo){
    const a = ctx(); if(!a) return;
    const o = a.createOscillator(), g = a.createGain();
    o.type = tipo || 'triangle'; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, a.currentTime);
    g.gain.exponentialRampToValueAtTime(.0001, a.currentTime + dur);
    o.connect(g).connect(a.destination); o.start(); o.stop(a.currentTime + dur);
  }
  // reproduce un mp3 si existe; si no, devuelve false y tiramos de sintetizado
  function play(src, vol){
    if(mudo() || !src) return Promise.resolve(false);
    return new Promise(res => {
      const a = new Audio(src); a.volume = vol == null ? .7 : vol;
      a.addEventListener('error', () => res(false), { once: true });
      a.play().then(() => res(true)).catch(() => res(false));
    });
  }
  const tic = () => { if(mudo()) return; play(SND.tic, .35).then(ok => { if(!ok) beep(1100, .035, .05, 'square'); }); };
  function fanfarria(top){
    if(mudo()) return;
    play(top ? SND.ultra : SND.premio, .8).then(ok => {
      if(ok) return;
      play(SND.premio, .8).then(ok2 => {
        if(ok2) return;
        [0, 110, 220, 380].forEach((t, i) => setTimeout(() => beep([523, 659, 784, 1047][i], .5, .14), t));
      });
    });
  }
  const NADA = { id: '', label: 'Sigue en el sorteo', tier: 'nada' };
  const ICON = { top: '🎟️', alto: '💶', medio: '🍹', bajo: '💶', nada: '🎲' };
  const icono = p => p.id === 'copas' ? '🍹' : (ICON[p.tier] || '🎲');

  // la cinta: muchos huecos repartidos según las cantidades reales del catálogo
  function construir(catalogo, premio, largo){
    const pool = [];
    catalogo.forEach(p => { for(let i = 0; i < Math.max(1, Number(p.n) || 1); i++) pool.push(p); });
    // algunos huecos de «sigue en el sorteo», para que la cinta no sea solo premios
    const vacios = Math.max(6, Math.round(pool.length * .55));
    for(let i = 0; i < vacios; i++) pool.push(NADA);
    const cinta = [];
    for(let i = 0; i < largo; i++) cinta.push(pool[Math.floor(Math.random() * pool.length)]);
    const gan = catalogo.find(p => p.id === premio) || NADA;
    return { cinta, gan };
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

    const LARGO = 64, GANA_EN = 57;                 // el premio cae en esta posición
    const { cinta, gan } = construir(catalogo, o.premio, LARGO);
    cinta[GANA_EN] = gan;
    const toca = !!gan.id;

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
            <b class="rul-h" data-rul-h>Abre tu premio</b>
            <p class="rul-p" data-rul-p>Dale a abrir: la cinta para donde para.</p>
            ${quedan}
          </div>
          <div class="rul-rail" data-rul-rail>
            <span class="rul-mark" aria-hidden="true"></span>
            <div class="rul-track" data-rul-track>${cinta.map(p => `
              <div class="rul-it is-${esc(p.tier)}"><span class="rul-it-i">${icono(p)}</span><b>${esc(p.label)}</b></div>`).join('')}</div>
            <span class="rul-fade rul-fade--l" aria-hidden="true"></span><span class="rul-fade rul-fade--r" aria-hidden="true"></span>
          </div>
          <div class="rul-acts" data-rul-acts><button type="button" class="rul-go" data-rul-go>Abrir mi premio</button></div>
          ${o.acta ? `<small class="rul-acta">${esc(o.acta)}</small>` : ''}
        </div>`;

      const close = () => { el.classList.remove('is-in'); document.body.classList.remove('srt-lock'); setTimeout(() => { el.remove(); res(toca); }, 260); };
      el.addEventListener('click', e => { if(e.target.closest('[data-rul-x]')) close(); });
      el.addEventListener('click', e => {
        const b = e.target.closest('[data-rul-snd]'); if(!b) return;
        setMudo(!mudo()); b.textContent = mudo() ? '🔇' : '🔊'; b.classList.toggle('is-off', mudo());
      });

      const track = el.querySelector('[data-rul-track]'), rail = el.querySelector('[data-rul-rail]');
      const acts = el.querySelector('[data-rul-acts]'), head = el.querySelector('[data-rul-h]'), par = el.querySelector('[data-rul-p]');
      let abierto = false;

      el.addEventListener('click', e => {
        if(!e.target.closest('[data-rul-go]') || abierto) return;
        abierto = true;
        acts.innerHTML = '<span class="rul-wait">Abriendo…</span>';
        el.classList.add('is-spin');

        const it = track.querySelector('.rul-it');
        const paso = it.getBoundingClientRect().width + parseFloat(getComputedStyle(track).gap || 10);
        const centro = rail.getBoundingClientRect().width / 2;
        const jitter = (Math.random() - .5) * paso * .5;                 // no siempre clavado en el centro
        const destino = -(GANA_EN * paso + paso / 2 - centro) + jitter;
        const dur = reduce() ? 300 : 6200;
        track.style.transition = `transform ${dur}ms cubic-bezier(.08,.72,.06,1)`;
        requestAnimationFrame(() => { track.style.transform = `translateX(${destino}px)`; });

        // un tic cada vez que pasa un premio por la flecha (se van espaciando, como la cinta)
        if(!reduce()){
          let t0 = performance.now();
          const total = Math.abs(destino), ease = x => 1 - Math.pow(1 - x, 4.2);   // parecido a la curva del CSS
          let ult = 0;
          const bucle = () => {
            const x = (performance.now() - t0) / dur;
            if(x >= 1 || !el.isConnected) return;
            const rec = ease(x) * total, n = Math.floor(rec / paso);
            if(n !== ult){ ult = n; tic(); }
            requestAnimationFrame(bucle);
          };
          requestAnimationFrame(bucle);
        }

        setTimeout(() => {
          el.classList.remove('is-spin'); el.classList.add(toca ? 'is-win' : 'is-lose');
          track.children[GANA_EN].classList.add('is-got');
          head.innerHTML = toca ? `¡Te ha tocado: ${esc(gan.label)}!` : 'Esta vez no ha salido premio';
          par.innerHTML = toca
            ? (gan.id === 'entrada'
              ? `Enhorabuena${o.nombre ? ', ' + esc(String(o.nombre).split(' ')[0]) : ''}. Te escribimos por WhatsApp con los detalles de tu entrada para el Ultra Europe.`
              : `Enhorabuena${o.nombre ? ', ' + esc(String(o.nombre).split(' ')[0]) : ''}. Te lo aplicamos en tu viaje con nosotros: te escribimos por WhatsApp para dejártelo apuntado.`)
            : 'Sigues dentro para las siguientes tandas sin hacer nada. Sube nuestro cartel a tu story y suma otra tirada.';
          acts.innerHTML = `<button type="button" class="rul-go rul-go--ghost" data-rul-x>${toca ? '¡Genial!' : 'Entendido'}</button>`;
          if(toca) fanfarria(gan.id === 'entrada');
          if(toca && !reduce()) confeti(el);
        }, dur + 120);
      });

      document.body.appendChild(el);
      document.body.classList.add('srt-lock');
      requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-in')));
    });
  }

  function confeti(el){
    const c = document.createElement('div'); c.className = 'rul-conf'; c.setAttribute('aria-hidden', 'true');
    const cols = ['#F0B02A', '#C43730', '#F7F0E3', '#FFD66B'];
    c.innerHTML = Array.from({ length: 70 }, () => {
      const x = Math.random() * 100, d = 2.2 + Math.random() * 2.2, r = Math.random() * 360, w = 5 + Math.random() * 6;
      return `<i style="left:${x}%;--d:${d}s;--r:${r}deg;--w:${w}px;background:${cols[Math.floor(Math.random() * cols.length)]};animation-delay:${(Math.random() * .8).toFixed(2)}s"></i>`;
    }).join('');
    el.appendChild(c);
    setTimeout(() => c.remove(), 6000);
  }

  window.IBRuleta = { show };
})();
