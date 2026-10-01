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
