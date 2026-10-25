/* Iberail — página sorteo.html (v16.6): un panel de tarjetas como el «Inicio» de la cuenta.
   · Intro: pantalla de arranque (≈1,4 s) que se abre como una persiana y las tarjetas entran en cascada.
   · Cuenta atrás (cuenta-atras.js) con los botones de cada momento (participar, calendario, ver resultado).
   · «Tu participación» y «Tu checklist del sorteo» se pintan según el estado (sorteo.js expone IBSrt).
   · Las tarjetas se iluminan donde está el ratón; la entrada del premio se inclina y el holograma sigue la luz. */
(function(){
  const box = document.getElementById('srtPage');
  if(!box || !window.IBCuenta || !window.IBSrt) return;
  const root = document.documentElement;
  const quieto = (() => { try{ return matchMedia('(prefers-reduced-motion: reduce)').matches; }catch(e){ return false; } })();
  let cta = null, ultimo = null;   // ultimo: el estado del sorteo que pinta la barra de abajo del móvil
  const mbK = document.querySelector('[data-sx-mb-k]'), mbV = document.querySelector('[data-sx-mb-v]'), mbGo = document.querySelector('[data-sx-mb-go]');
  const ULTRA = Date.UTC(2027, 6, 8, 22, 0);   // 9 jul 2027 a las 00:00 en Madrid
  const dos = n => String(n).padStart(2, '0');
  const ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const ABAJO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M6 13l6 6 6-6"/></svg>';
  const CALI = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>';
  const TICK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
  const CANDADO = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 018 0v3"/></svg>';
  const part = n => n === 1 ? 'participación' : 'participaciones';
  // «hoy a las 23:00 h», «mañana a las…» o «el viernes a las…» (hora de España)
  const diaTxt = at => {
    const dia = t => new Date(t).toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
    const dd = Math.round((new Date(dia(at)) - new Date(dia(Date.now()))) / 864e5);
    const h = new Date(at).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
    return (dd <= 0 ? 'hoy' : dd === 1 ? 'mañana' : 'el ' + new Date(at).toLocaleDateString('es-ES', { weekday: 'long', timeZone: 'Europe/Madrid' })) + ' a las ' + h + ' h';
  };
  // participación extra: no se suma sola. Story mencionando a @iberailspain + captura con el nombre completo por WhatsApp (+300 seguidores)
  const WA_EXTRA = 'https://wa.me/34930491439?text=' + encodeURIComponent('Hola Iberail, he subido el cartel del sorteo a mi story mencionando a @iberailspain. Os mando la captura. Mi nombre completo es: ');

  /* ---------- intro ---------- */
  function intro(){
    const listo = () => { root.classList.remove('sx-pre'); root.classList.add('sx-go'); };
    if(quieto){ listo(); return; }
    const b = document.createElement('div');
    b.className = 'sx-boot'; b.setAttribute('aria-hidden', 'true');
    b.innerHTML = `<div class="sx-boot-in">
        <svg class="sx-boot-ring" viewBox="0 0 120 120"><circle cx="60" cy="60" r="52"/><circle class="is-run" cx="60" cy="60" r="52" pathLength="100"/></svg>
        <span class="sx-boot-ic"><svg viewBox="0 0 24 24"><path d="M3 9a2 2 0 002-2h14a2 2 0 002 2v1a2 2 0 000 4v1a2 2 0 00-2 2H5a2 2 0 00-2-2v-1a2 2 0 000-4z"/><path d="M15 7v10" stroke-dasharray="2 2"/></svg></span>
        <b class="sx-boot-n">00</b>
        <small class="sx-boot-k">Iberail · Sorteo Ultra 2027</small>
        <span class="sx-boot-t">Conectando con el sorteo</span>
      </div><i class="sx-boot-scan"></i>`;
    document.body.appendChild(b);
    const n = b.querySelector('.sx-boot-n'), tx = b.querySelector('.sx-boot-t'), ring = b.querySelector('.is-run');
    const frases = ['Conectando con el sorteo', 'Sincronizando la cuenta atrás', 'Preparando tu pase'];
    const D = 1250, t0 = performance.now();
    const paso = now => {
      const x = Math.min(1, (now - t0) / D), e = 1 - Math.pow(1 - x, 3);
      n.textContent = String(Math.round(e * 100)).padStart(2, '0');
      ring.style.strokeDashoffset = String(100 - e * 100);
      const f = frases[Math.min(frases.length - 1, Math.floor(x * frases.length))];
      if(tx.textContent !== f) tx.textContent = f;
      if(x < 1) requestAnimationFrame(paso);
      else { b.classList.add('is-out'); setTimeout(listo, 260); setTimeout(() => b.remove(), 1000); }
    };
    requestAnimationFrame(paso);
  }

  /* ---------- «Añadir al calendario» ---------- */
  const CAL = `<button type="button" class="sx-btn sx-btn--line" data-srt-ics>${CALI}Añadir al calendario</button>`;
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

  /* ---------- botones de la cuenta atrás ---------- */
  function estado(rest){
    const s = IBSrt.get();
    const cal = isFinite(rest) && rest > 0 ? CAL : '';
    if(rest <= 0){
      if(s.state !== 'in') return '<p class="sx-note">Este sorteo ya ha empezado. Apúntate y entras en los próximos.</p>' + `<button type="button" class="sx-btn sx-btn--go" data-srt-join><span>${s.state === 'guest' ? 'Crear cuenta y participar' : 'Participar gratis'}</span>${ARROW}</button>`;
      if(s.revelable && !s.spun){
        const nuevas = s.tiradas - s.abiertas;
        return s.abiertas
          ? `<button type="button" class="sx-btn sx-btn--go is-glow" data-srt-spin><span>Ver ${nuevas === 1 ? 'tu participación nueva' : 'tus ' + nuevas + ' participaciones nuevas'}</span>${ARROW}</button>`
          : `<button type="button" class="sx-btn sx-btn--go is-glow" data-srt-spin><span>Ver mi resultado</span>${ARROW}</button><p class="sx-note">Tienes ${s.tiradas} ${part(s.tiradas)}.</p>`;
      }
      if(s.spun) return '<p class="sx-note">Ya has visto tu resultado de este sorteo. Si te ha tocado, te escribimos por WhatsApp. Sigues dentro para los próximos.</p>';
      return '<p class="sx-note sx-note--wait"><i></i>Preparando los resultados… en unos segundos puedes ver el tuyo.</p>';
    }
    if(s.state === 'guest') return `<div class="sx-acts"><button type="button" class="sx-btn sx-btn--go" data-srt-join><span>Crear cuenta y participar gratis</span>${ARROW}</button>${cal}</div>`;
    if(s.state === 'out') return `<div class="sx-acts"><button type="button" class="sx-btn sx-btn--go" data-srt-join><span>Participar gratis</span>${ARROW}</button>${cal}</div>`;
    return cal ? `<div class="sx-acts">${cal}</div>` : '';
  }

  /* ---------- tu participación ---------- */
  const me = document.querySelector('[data-sx-me]'), lista = document.querySelector('[data-sx-list]');
  function pintarMe(s){
    if(!me) return;
    let h;
    if(s.state === 'in'){
      const n = s.tiradas, extra = Math.max(0, n - 1);
      const tks = Array.from({ length: Math.min(n, 8) }, (_, i) => `<i style="--i:${i}"></i>`).join('') + (n > 8 ? `<em>+${n - 8}</em>` : '');
      h = `<div class="sx-ct"><small class="sx-k">Tu participación</small><span class="sx-pill sx-pill--ok"><i></i>Dentro</span></div>
        <div class="sx-me-n"><b>${n}</b><span>${part(n)}<span class="sx-me-tk" aria-hidden="true">${tks}</span></span></div>
        <dl class="sx-me-dl"><div><dt>Por apuntarte</dt><dd>1</dd></div><div><dt>Extra</dt><dd>${extra ? '+' + extra : '0'}</dd></div></dl>
        ${s.revelable && !s.spun ? `<button type="button" class="sx-me-res is-on" data-srt-spin><span class="sx-me-res-ic">${TICK}</span><span><b>Tu resultado ya está</b><small>Toca para verlo</small></span></button>`
          : s.spun ? `<div class="sx-me-res is-done"><span class="sx-me-res-ic">${TICK}</span><span><b>Resultado visto</b><small>Sigues dentro para los próximos sorteos</small></span></div>`
          : `<div class="sx-me-res"><span class="sx-me-res-ic">${CANDADO}</span><span><b>Tu resultado</b><small>${s.at ? 'Se desbloquea ' + diaTxt(s.at) : 'Te avisamos aquí cuando haya sorteo'}</small></span></div>`}
        <a class="sx-x2t" href="#sxExtra">
          <b class="sx-x2t-n" aria-hidden="true">×2</b>
          <span class="sx-x2t-t"><b>${extra ? 'Ya tienes participación extra' : 'Participación extra'}</b><small>${extra ? 'Comparte el cartel para que se apunten tus amigos' : 'Sube el cartel a tu story y duplica tus opciones'}</small></span>
          <span class="sx-x2t-go">Ver más ${ABAJO}</span>
        </a>`;
    } else if(s.state === 'out'){
      h = `<div class="sx-ct"><small class="sx-k">Tu participación</small><span class="sx-pill"><i></i>Sin apuntar</span></div>
        <b class="sx-me-h">Aún no participas</b>
        <p class="sx-me-p">Es gratis: pulsa el botón y entras con 1 participación en este sorteo y en todos los que vengan.</p>
        <button type="button" class="sx-btn sx-btn--go" data-srt-join><span>Participar gratis</span>${ARROW}</button>`;
    } else {
      h = `<div class="sx-ct"><small class="sx-k">Tu participación</small><span class="sx-pill"><i></i>Sin cuenta</span></div>
        <b class="sx-me-h">Entra y participa <em>gratis</em></b>
        <p class="sx-me-p">Crea tu cuenta de Iberail en un minuto y quedas apuntado a todos los sorteos de entradas para el Ultra.</p>
        <button type="button" class="sx-btn sx-btn--go" data-srt-join><span>Crear cuenta y participar</span>${ARROW}</button>`;
    }
    if(me._h !== h){ me._h = h; me.innerHTML = h; }
  }
  // checklist: lo que ya está hecho se marca solo
  function pintarLista(s){
    if(!lista) return;
    const pasos = [
      [s.state !== 'guest', 'Crear tu cuenta de Iberail', s.state !== 'guest' ? 'Hecho' : 'Un minuto, con tu correo y tu móvil', s.state === 'guest' ? `<button type="button" class="sx-li-go" data-srt-join>Crear${ARROW}</button>` : ''],
      [s.state === 'in', 'Participar gratis', s.state === 'in' ? 'Hecho · entras en todos los sorteos' : 'Un toque y estás dentro', s.state !== 'in' ? `<button type="button" class="sx-li-go" data-srt-join>Participar${ARROW}</button>` : ''],
      [s.state === 'in' && s.tiradas > 1, 'Participación extra (opcional)', s.state === 'in' && s.tiradas > 1 ? 'Hecho · ya la tienes' : 'Story con @iberailspain + captura con tu nombre por WhatsApp · +300 seguidores', s.state === 'in' && s.tiradas < 2 ? `<a class="sx-li-go" href="${WA_EXTRA}" target="_blank" rel="noopener">WhatsApp${ARROW}</a>` : ''],
      [!!(s.revelable && s.spun), 'Mirar tu resultado', s.revelable && s.spun ? 'Hecho' : s.at ? 'El día del sorteo, aquí mismo' : 'Cuando anunciemos el sorteo, aquí mismo', '']
    ];
    const n = pasos.filter(p => p[0]).length;
    const h = `<div class="sx-ct"><div><small class="sx-k">Tu checklist del sorteo</small><b class="sx-li-h">${n} de ${pasos.length} listo</b></div><span class="sx-bar"><i style="width:${Math.round(n / pasos.length * 100)}%"></i></span></div>
      <ul class="sx-li">${pasos.map(([ok, t, sub, go], i) => `<li class="${ok ? 'is-ok' : ''}" style="--i:${i}"><span class="sx-chk">${TICK}</span><span class="sx-li-t">${t}<small>${sub}</small></span>${go}</li>`).join('')}</ul>`;
    if(lista._h !== h){ lista._h = h; lista.innerHTML = h; }
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
    pintarMe({ ...s, at }); pintarLista({ ...s, at });
    ultimo = { ...s, at }; pintarBarra();
    if(at && +at <= Date.now()) alCero();   // abierta después de la hora: también se espera al resultado
  });

  /* ---------- barra de abajo en el móvil: la cuenta atrás en pequeño y el botón que toca ---------- */
  function pintarBarra(){
    if(!mbV || !ultimo) return;
    const s = ultimo, falta = s.at ? +s.at - Date.now() : ULTRA - Date.now();
    let k, v;
    if(s.at && falta <= 0){ k = 'Sorteo'; v = '¡Ahora!'; }
    else {
      const r = Math.max(0, falta), d = Math.floor(r / 864e5);
      k = s.at ? 'Sorteo en' : 'Ultra Europe en';
      v = (d ? d + 'd ' : '') + `${dos(Math.floor(r / 36e5) % 24)}:${dos(Math.floor(r / 6e4) % 60)}:${dos(Math.floor(r / 1e3) % 60)}`;
    }
    if(mbK.textContent !== k) mbK.textContent = k;
    if(mbV.textContent !== v) mbV.textContent = v;
    const go = s.state === 'in' && s.revelable && !s.spun ? `<button type="button" class="btn btn--primary" data-srt-spin>Ver mi resultado ${ARROW}</button>`
      : s.state !== 'in' ? `<button type="button" class="btn btn--primary" data-srt-join>Participar gratis ${ARROW}</button>`
      : `<a class="btn btn--primary" href="#sxExtra">Participación extra ${ARROW}</a>`;
    if(mbGo && mbGo._h !== go){ mbGo._h = go; mbGo.innerHTML = go; }
  }
  setInterval(() => { if(!document.hidden) pintarBarra(); }, 1000);

  intro();
  // la ruta de la cabecera (SVG animado): quieta si la persona prefiere menos movimiento
  if(quieto) document.querySelectorAll('[data-sx-route]').forEach(s => { try{ s.pauseAnimations(); }catch(e){} });

  /* ---------- luz que sigue al ratón en las tarjetas ---------- */
  if(!quieto && matchMedia('(hover: hover)').matches){
    document.addEventListener('pointermove', e => {
      const c = e.target.closest && e.target.closest('.sx-card,.sx'); if(!c) return;
      const r = c.getBoundingClientRect();
      c.style.setProperty('--px', (e.clientX - r.left) + 'px'); c.style.setProperty('--py', (e.clientY - r.top) + 'px');
    }, { passive: true });
  }
  // la entrada del premio se inclina con el ratón y el holograma sigue la luz.
  // En el móvil: al tocarla da una vuelta y, si el móvil lo permite (en iPhone pide permiso), se inclina con el giroscopio.
  const tactil = matchMedia('(hover: none)').matches;
  const MOVIL = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="7" y="2.5" width="10" height="19" rx="2.5"/><path d="M11 18.5h2"/></svg>';
  document.querySelectorAll('[data-sx-tilt]').forEach(w => {
    if(quieto) return;
    const tk = w.firstElementChild; let raf = 0;
    const set = (x, y) => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => {
      tk.style.setProperty('--rx', (-y * 18).toFixed(2) + 'deg'); tk.style.setProperty('--ry', (x * 24).toFixed(2) + 'deg');
      tk.style.setProperty('--gx', (50 + x * 90).toFixed(1) + '%'); tk.style.setProperty('--gy', (50 + y * 90).toFixed(1) + '%');
    }); };
    w.addEventListener('pointermove', e => { if(e.pointerType !== 'mouse') return; const r = w.getBoundingClientRect(); w.classList.add('is-on'); set((e.clientX - r.left) / r.width - .5, (e.clientY - r.top) / r.height - .5); });
    w.addEventListener('pointerleave', e => { if(e.pointerType !== 'mouse') return; w.classList.remove('is-on'); set(0, 0); });
    if(!tactil) return;
    const pista = document.createElement('span'); pista.className = 'sx-tk-hint'; pista.innerHTML = MOVIL + 'Toca la entrada e inclina el móvil';
    w.appendChild(pista);
    let giro = false;
    const mover = e => {
      if(e.beta == null) return;
      const lim = v => Math.max(-1, Math.min(1, v));
      set(lim((e.gamma || 0) / 28) * .5, lim(((e.beta || 0) - 45) / 28) * .5);
    };
    const activar = () => { if(giro) return; giro = true; w.classList.add('is-on', 'is-giro'); addEventListener('deviceorientation', mover); };
    w.addEventListener('click', () => {
      tk.classList.remove('is-spin'); void tk.offsetWidth; tk.classList.add('is-spin');
      const D = window.DeviceOrientationEvent;
      if(giro || !D) return;
      if(typeof D.requestPermission === 'function') D.requestPermission().then(r => { if(r === 'granted') activar(); else pista.lastChild.textContent = 'Toca la entrada'; }).catch(() => {});
      else activar();
    });
  });
  // las tarjetas de más abajo aparecen al llegar a ellas
  const rev = document.querySelectorAll('[data-sx-reveal]');
  if(window.IntersectionObserver && !quieto){
    root.classList.add('sx-js');
    const io = new IntersectionObserver(es => es.forEach(x => { if(x.isIntersecting){ x.target.classList.add('is-in'); io.unobserve(x.target); } }), { rootMargin: '0px 0px -8% 0px' });
    rev.forEach(n => io.observe(n));
  }
})();
