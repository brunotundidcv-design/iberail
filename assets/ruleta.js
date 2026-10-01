/* Iberail — ruleta de la revelación del sorteo
   El sorteo se celebra aparte (ver supabase/sql/sorteo-ruleta.sql y el acta que guarda el equipo);
   esta ruleta es la forma de enseñar el resultado: cada persona la gira y ve si le ha tocado.
   Uso: IBRuleta.show({ gana: true|false, nombre, entradas, total, acta, test })  →  Promise
   `test: true` la marca como simulación (solo para el panel, no cuenta). */
(function(){
  const esc = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SEG = 12;                                  // casillas de la ruleta
  const reduce = () => window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function wheel(premios){
    // premios = índices de casilla que son «entrada»
    const paso = 360 / SEG;
    const tramos = Array.from({ length: SEG }, (_, i) => {
      const a = i * paso, b = a + paso;
      const col = premios.includes(i) ? 'var(--rul-win)' : (i % 2 ? 'var(--rul-b)' : 'var(--rul-a)');
      return `${col} ${a}deg ${b}deg`;
    }).join(',');
    const marcas = Array.from({ length: SEG }, (_, i) => {
      const gana = premios.includes(i);
      return `<span class="rul-seg${gana ? ' is-win' : ''}" style="--a:${i * paso + paso / 2}deg">${gana ? '🎟️' : ''}</span>`;
    }).join('');
    return `<div class="rul-wrap">
      <span class="rul-pin" aria-hidden="true"></span>
      <div class="rul-wheel" data-rul-wheel style="background:conic-gradient(${tramos})">${marcas}</div>
      <span class="rul-hub">ULTRA<br><b>2027</b></span>
    </div>`;
  }

  function show(o){
    o = o || {};
    const gana = !!o.gana, entradas = o.entradas || 3, total = o.total || 10;
    return new Promise(res => {
      // reparte las casillas premiadas repartidas por la rueda
      const premios = [], paso = Math.max(2, Math.round(SEG / Math.max(1, Math.min(entradas, SEG - 1))));
      for(let i = 0; premios.length < Math.min(entradas, SEG - 1); i += paso) premios.push(i % SEG);

      const el = document.createElement('div');
      el.className = 'rul' + (o.test ? ' is-test' : '');
      el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Resultado del sorteo');
      el.innerHTML = `<div class="rul-box">
          ${o.test ? '<span class="rul-test">Simulación · no cuenta</span>' : ''}
          <div class="rul-head">
            <span class="rul-k">Sorteo Iberail · Ultra Europe 2027</span>
            <b class="rul-h" data-rul-h>${entradas} de las ${total} entradas</b>
            <p class="rul-p" data-rul-p>Dale a girar y descubre si te ha tocado una.</p>
          </div>
          ${wheel(premios)}
          <div class="rul-acts" data-rul-acts><button type="button" class="rul-go" data-rul-go>Girar la ruleta</button></div>
          ${o.acta ? `<small class="rul-acta">${esc(o.acta)}</small>` : ''}
        </div>`;

      const close = ok => { el.classList.remove('is-in'); document.body.classList.remove('srt-lock'); setTimeout(() => { el.remove(); res(ok); }, 260); };
      el.addEventListener('click', e => { if(e.target.closest('[data-rul-x]')) close(gana); });

      const w = el.querySelector('[data-rul-wheel]'), acts = el.querySelector('[data-rul-acts]');
      const head = el.querySelector('[data-rul-h]'), par = el.querySelector('[data-rul-p]');
      let girada = false;

      el.addEventListener('click', e => {
        if(!e.target.closest('[data-rul-go]') || girada) return;
        girada = true;
        acts.innerHTML = '<span class="rul-wait">Girando…</span>';
        el.classList.add('is-spin');

        // cae en una casilla premiada si le toca, y en una normal si no
        const posibles = Array.from({ length: SEG }, (_, i) => i).filter(i => premios.includes(i) === gana);
        const casilla = posibles[Math.floor(Math.random() * posibles.length)];
        const paso360 = 360 / SEG;
        const destino = 360 * 6 + (360 - (casilla * paso360 + paso360 / 2));
        const dur = reduce() ? 300 : 5200;
        w.style.transition = `transform ${dur}ms cubic-bezier(.12,.72,.08,1)`;
        requestAnimationFrame(() => { w.style.transform = `rotate(${destino}deg)`; });

        setTimeout(() => {
          el.classList.remove('is-spin'); el.classList.add(gana ? 'is-win' : 'is-lose');
          head.innerHTML = gana ? '¡Te ha tocado una entrada!' : 'Esta vez no ha sido';
          par.innerHTML = gana
            ? `Enhorabuena${o.nombre ? ', ' + esc(String(o.nombre).split(' ')[0]) : ''}. Te escribimos por WhatsApp para darte los detalles de tu entrada para el Ultra Europe.`
            : `Quedan <b>${total - entradas} entradas</b> por sortear, y <b>sigues dentro</b> sin hacer nada. Sube nuestro cartel a tu story y suma otra tirada para la próxima.`;
          acts.innerHTML = `<button type="button" class="rul-go rul-go--ghost" data-rul-x>${gana ? '¡Genial!' : 'Entendido'}</button>`;
          if(gana && !reduce()) confeti(el);
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
