/* Iberail — página sorteo.html: la cuenta atrás grande (cuenta-atras.js) con el estado de cada persona
   (sorteo.js expone IBSrt con la configuración del panel, la inscripción y el resultado). */
(function(){
  const box = document.getElementById('srtPage');
  if(!box || !window.IBCuenta || !window.IBSrt) return;
  let cta = null;

  function estado(rest){
    return estado0(rest) + (IBSrt.get().repe || '');   // «Repetir mi tirada ganadora» (si ganó en un sorteo anterior)
  }
  function estado0(rest){
    const s = IBSrt.get();
    if(rest <= 0){
      if(s.state !== 'in') return '<p class="cta-note">Esta tanda ya ha empezado. Apúntate y entras en las siguientes.</p>' + (s.state === 'guest' ? '<button type="button" class="cta-btn" data-srt-join>Crear cuenta y participar</button>' : '<button type="button" class="cta-btn" data-srt-join>Participar gratis</button>');
      if(s.revelable && !s.spun) return `<button type="button" class="cta-btn is-glow" data-srt-spin>${s.boton || 'Abrir mi premio 🎟️'}</button><p class="cta-note">${s.nuevas ? `El equipo te ha sumado ${s.pendientes === 1 ? 'una tirada' : s.pendientes + ' tiradas'}. Tienes ${s.tiradas} en total.` : `Tienes ${s.tiradas} ${s.tiradas === 1 ? 'tirada' : 'tiradas'}.`}</p>`;
      if(s.spun) return '<p class="cta-note">Ya has abierto tus tiradas de esta tanda. Si te ha tocado, te escribimos por WhatsApp.</p><button type="button" class="cta-btn cta-btn--ghost" data-srt-poster>Sube el cartel a tu story y suma otra tirada</button>';
      return '<p class="cta-note">Preparando los resultados… en unos segundos puedes abrir tu premio.</p>';
    }
    if(s.state === 'guest') return '<button type="button" class="cta-btn" data-srt-join>Crear cuenta y participar gratis</button><p class="cta-note">En un minuto estás dentro.</p>';
    if(s.state === 'out') return '<button type="button" class="cta-btn" data-srt-join>Participar gratis</button><p class="cta-note">Entras con 1 tirada. Sube nuestro cartel a tu story y suma otra.</p>';
    return `<div class="cta-ok">✓ Estás dentro con <b>${s.tiradas} ${s.tiradas === 1 ? 'tirada' : 'tiradas'}</b></div>
      <button type="button" class="cta-btn cta-btn--ghost" data-srt-poster>Sube el cartel a tu story y suma otra tirada</button>`;
  }

  let reintentos = 0;
  function alCero(){
    // al llegar a 0 pedimos el resultado (el equipo lo publica desde el panel) y se abre la ruleta solo
    const go = () => { IBSrt.refresh(); if(++reintentos < 12 && !IBSrt.get().revelable) setTimeout(go, 5000); };
    setTimeout(go, 1200);
  }

  IBSrt.on(() => {
    const s = IBSrt.get();
    const o = { at: s.at, musica: (s.sonidos || {}).cuenta || '', tanda: s.draw.tanda, entradas: s.draw.entradas, total: s.draw.total, estado, onZero: alCero };
    if(!cta) cta = IBCuenta.mount(box, o); else cta.set(o);
  });
})();
