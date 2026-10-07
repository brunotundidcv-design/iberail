/* Iberail — página sorteo.html: la cuenta atrás grande (cuenta-atras.js) con el estado de cada persona
   (sorteo.js expone IBSrt con la configuración del panel, la inscripción y el resultado). */
(function(){
  const box = document.getElementById('srtPage');
  if(!box || !window.IBCuenta || !window.IBSrt) return;
  let cta = null;

  function estado(rest){
    const s = IBSrt.get();
    if(rest <= 0){
      if(s.state !== 'in') return '<p class="cta-note">Este sorteo ya ha empezado. Apúntate y entras en los próximos.</p>' + (s.state === 'guest' ? '<button type="button" class="cta-btn" data-srt-join>Crear cuenta y participar</button>' : '<button type="button" class="cta-btn" data-srt-join>Participar gratis</button>');
      if(s.revelable && !s.spun){
        const nuevas = s.tiradas - s.abiertas;
        return s.abiertas
          ? `<button type="button" class="cta-btn is-glow" data-srt-spin>¡Tienes ${nuevas === 1 ? 'una tirada nueva' : nuevas + ' tiradas nuevas'}! 🎟️</button><p class="cta-note">Ábrela${nuevas === 1 ? '' : 's'} ahora.</p>`
          : `<button type="button" class="cta-btn is-glow" data-srt-spin>Abrir mi premio 🎟️</button><p class="cta-note">Tienes ${s.tiradas} ${s.tiradas === 1 ? 'tirada' : 'tiradas'}.</p>`;
      }
      if(s.spun) return '<p class="cta-note">Ya has abierto tu premio de este sorteo. Si te ha tocado, te escribimos por WhatsApp. Sigues dentro para los próximos.</p>';
      return '<p class="cta-note">Preparando los resultados… en unos segundos puedes abrir tu premio.</p>';
    }
    if(s.state === 'guest') return '<button type="button" class="cta-btn" data-srt-join>Crear cuenta y participar gratis</button><p class="cta-note">En un minuto estás dentro.</p>';
    if(s.state === 'out') return '<button type="button" class="cta-btn" data-srt-join>Participar gratis</button><p class="cta-note">Entras con 1 tirada. Sube nuestro cartel a tu story y suma otra.</p>';
    return `<div class="cta-ok">✓ Estás dentro con <b>${s.tiradas} ${s.tiradas === 1 ? 'tirada' : 'tiradas'}</b></div>
      <button type="button" class="cta-btn cta-btn--ghost" data-srt-poster>Sube el cartel a tu story y suma otra tirada</button>`;
  }

  let vigilando = false;
  function alCero(){
    // al llegar a 0 pedimos el resultado (el equipo lo publica desde el panel) y se abre la ruleta solo.
    // Seguimos mirando cada 15 s mientras la página esté abierta: si se publica tarde o el equipo suma
    // una tirada nueva a alguien que ya había tirado, le aparece y la puede abrir.
    if(vigilando) return; vigilando = true;
    setTimeout(() => IBSrt.refresh(), 1200);
    setInterval(() => { if(!document.hidden && !document.querySelector('.rul')) IBSrt.refresh(); }, 15000);
  }

  IBSrt.on(() => {
    const s = IBSrt.get();
    // si el último sorteo fue hace más de 2 días y no hay otro programado: «Próximo sorteo · muy pronto»
    const at = s.at && (Date.now() - s.at < 2 * 864e5 || (s.revelable && !s.spun)) ? s.at : null;
    const o = { at, musica: (s.sonidos || {}).cuenta || '', entradas: s.draw.entradas, estado: rest => estado(at ? rest : Infinity), onZero: alCero };
    if(!cta) cta = IBCuenta.mount(box, o); else cta.set(o);
  });
})();
