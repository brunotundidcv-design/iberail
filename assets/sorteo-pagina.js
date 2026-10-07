/* Iberail — página sorteo.html: la cuenta atrás grande (cuenta-atras.js) con el estado de cada persona
   (sorteo.js expone IBSrt con la configuración del panel, la inscripción y el resultado). */
(function(){
  const box = document.getElementById('srtPage');
  if(!box || !window.IBCuenta || !window.IBSrt) return;
  let cta = null;

  // «Añadir al calendario»: un .ics con el día y la hora del sorteo y un aviso 15 minutos antes
  const CAL = '<button type="button" class="cta-cal" data-srt-ics>Añadir al calendario</button>';
  function ics(){
    const s = IBSrt.get(); if(!s.at) return;
    const f = d => new Date(d).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
    const n = s.draw.entradas, ent = `${n} ${n == 1 ? 'entrada' : 'entradas'}`;
    const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Iberail//Sorteo//ES', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH', 'BEGIN:VEVENT',
      `UID:sorteo-${s.draw.fecha}-${s.draw.tanda || 1}@iberail.com`, `DTSTAMP:${f(Date.now())}`, `DTSTART:${f(s.at)}`, `DTEND:${f(+s.at + 30 * 6e4)}`,
      `SUMMARY:Sorteo Iberail · ${ent} para el Ultra Europe`, 'DESCRIPTION:Entra en iberail.com/sorteo.html con tu cuenta y mira tu resultado.',
      'URL:https://iberail.com/sorteo.html', 'BEGIN:VALARM', 'TRIGGER:-PT15M', 'ACTION:DISPLAY', 'DESCRIPTION:Sorteo Iberail en 15 minutos', 'END:VALARM',
      'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/calendar;charset=utf-8' })); a.download = 'sorteo-iberail.ics';
    document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  document.addEventListener('click', e => { if(e.target.closest('[data-srt-ics]')){ e.preventDefault(); ics(); } });

  function estado(rest){
    const s = IBSrt.get();
    const cal = isFinite(rest) && rest > 0 ? CAL : '';
    if(rest <= 0){
      if(s.state !== 'in') return '<p class="cta-note">Este sorteo ya ha empezado. Apúntate y entras en los próximos.</p>' + (s.state === 'guest' ? '<button type="button" class="cta-btn" data-srt-join>Crear cuenta y participar</button>' : '<button type="button" class="cta-btn" data-srt-join>Participar gratis</button>');
      if(s.revelable && !s.spun){
        const nuevas = s.tiradas - s.abiertas;
        return s.abiertas
          ? `<button type="button" class="cta-btn is-glow" data-srt-spin>Ver ${nuevas === 1 ? 'tu participación nueva' : 'tus ' + nuevas + ' participaciones nuevas'}</button>`
          : `<button type="button" class="cta-btn is-glow" data-srt-spin>Ver mi resultado</button><p class="cta-note">Tienes ${s.tiradas} ${s.tiradas === 1 ? 'participación' : 'participaciones'}.</p>`;
      }
      if(s.spun) return '<p class="cta-note">Ya has visto tu resultado de este sorteo. Si te ha tocado, te escribimos por WhatsApp. Sigues dentro para los próximos.</p>';
      return '<p class="cta-note">Preparando los resultados… en unos segundos puedes ver el tuyo.</p>';
    }
    if(s.state === 'guest') return '<button type="button" class="cta-btn" data-srt-join>Crear cuenta y participar gratis</button><p class="cta-note">En un minuto estás dentro.</p>' + cal;
    if(s.state === 'out') return '<button type="button" class="cta-btn" data-srt-join>Participar gratis</button><p class="cta-note">Entras con 1 participación. Sube nuestro cartel a tu story y te sumamos otra.</p>' + cal;
    return `<div class="cta-ok">✓ Estás dentro con <b>${s.tiradas} ${s.tiradas === 1 ? 'participación' : 'participaciones'}</b></div>
      <button type="button" class="cta-btn cta-btn--ghost" data-srt-poster>Sube el cartel a tu story y suma otra participación</button>${cal}`;
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
    if(at && +at <= Date.now()) alCero();   // abierta después de la hora: también se espera al resultado
  });
})();
