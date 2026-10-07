/* Iberail — sorteos de entradas para el Ultra Europe (en todas las páginas menos el panel).
   Sorteos sueltos: el equipo programa cada uno cuando quiere desde el panel (día, hora y entradas).
   · Para participar hay que pulsar «Participar gratis» con la sesión iniciada: se guarda en la tabla
     sorteo_inscritos (archivo 12-sorteo.sql). Sin cuenta, el botón lleva a crearla y, al entrar,
     queda inscrito solo (ya lo había pedido).
   · Discreto (v9.2): sin aviso a pantalla completa ni ruleta que se abre sola en cualquier página.
     Barra fina arriba SOLO en la semana del sorteo (BAR_DIAS) o cuando ya puedes ver tu resultado
     (SORTEO_BAR = false para quitarla). El resultado se abre en sorteo.html o con el botón «Ver mi resultado».
   · La cinta (ruleta.js + fiesta.js) se carga solo cuando alguien va a ver su resultado.
   · Cartel para stories de Instagram (participación extra): se dibuja en el navegador (1080×1920). */
(function(){
  const IB = window.IB, C = window.IBERAIL_CONFIG || {};
  if(!IB || document.getElementById('admApp')) return;
  const SORTEO_BAR = true;
  const BAR_DIAS = 7;                                   // la barra de arriba sale solo en los 7 días antes del sorteo
  const SRC = (document.currentScript && document.currentScript.src) || '';
  // ── Próximo sorteo ─────────────────────────────────────────────────────────
  // Cámbialo aquí cuando haya nueva tanda. fecha vacía = «muy pronto» (como antes).
  const DRAW = { fecha: '', hora: '20:00', entradas: 1, tanda: 1 };   // lo rellena el panel (sorteo_config)
  const esc = (window.IB && IB.esc) || (t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])));
  let premio = null, ganaEn = null, publicado = false, catalogo = null, restantes = null, sonidos = null;   // premio: id del premio, '' si ninguno · ganaEn: tirada en la que sale (null = la última)
  const pagSorteo = /\/sorteo(\.html)?$/.test(location.pathname);
  // tiradas ya abiertas en esta tanda (por cuenta): si el equipo suma tiradas después, se pueden abrir las nuevas
  // (el sorteo 1 conserva la clave antigua, sin número, para no volver a abrir lo ya abierto)
  const tirKey = () => 'ib-srt-tir-' + DRAW.fecha + (DRAW.tanda > 1 ? '-s' + DRAW.tanda : '') + '-' + (user ? user.id : '');
  const abiertas = () => { try{ const n = parseInt(localStorage.getItem(tirKey()), 10); if(n >= 0) return n; return DRAW.tanda <= 1 && localStorage.getItem('ib-srt-visto-' + DRAW.fecha) ? 1 : 0; }catch(e){ return 0; } };
  const marcar = n => { try{ if(n > abiertas()) localStorage.setItem(tirKey(), String(n)); }catch(e){} };
  const spun = () => abiertas() >= tiradas;
  // la hora del sorteo es la de España (Madrid), aunque el móvil esté en Canarias o en el extranjero
  function horaMadrid(fecha, hora){
    const [y, m, d] = String(fecha).split('-').map(Number), [hh, mm] = String(hora || '20:00').split(':').map(Number);
    const objetivo = Date.UTC(y, m - 1, d, hh, mm || 0); let t = objetivo;
    try{
      const f = new Intl.DateTimeFormat('en-US', { timeZone: 'Europe/Madrid', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
      for(let i = 0; i < 2; i++){ const p = {}; f.formatToParts(new Date(t)).forEach(x => { p[x.type] = x.value; }); t -= Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute) - objetivo; }
      return new Date(t);
    }catch(e){ return new Date(fecha + 'T' + (hora || '20:00') + ':00'); }
  }
  const revelable = () => publicado && premio !== null && premio !== undefined && DRAW.fecha && new Date() >= horaMadrid(DRAW.fecha, DRAW.hora);
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
  function drawTxt(largo){
    // sorteos sueltos: el equipo programa uno cuando quiere desde el panel (día, hora y entradas)
    const PRONTO = 'Pronto habrá un nuevo sorteo. Si ya estás apuntado, entras en todos.';
    if(!DRAW.fecha) return largo ? PRONTO : '';
    const d = new Date(DRAW.fecha + 'T12:00:00');
    const dias = Math.round((d - new Date(new Date().toDateString() + ' 12:00')) / 864e5);
    if(dias < 0) return largo ? PRONTO : '';
    const cuando = dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : `el ${DIAS[d.getDay()]} ${d.getDate()} de ${d.toLocaleDateString('es-ES', { month: 'long' })}`;
    const n = DRAW.entradas, ent = `${n} ${n === 1 ? 'entrada' : 'entradas'}`;
    if(largo === 'corto') return `${dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : DIAS[d.getDay()] + ' ' + d.getDate()} · ${DRAW.hora || '20:00'} h`;
    return largo === 'bar' ? `${cuando} a las ${DRAW.hora || '20:00'} h · ${ent} para el Ultra Europe`
      : `Próximo sorteo ${cuando} a las ${DRAW.hora || '20:00'} h: sorteamos ${ent} para el Ultra Europe.`;
  }
  function drawTag(){
    if(!DRAW.fecha) return '';
    const d = new Date(DRAW.fecha + 'T12:00:00');
    const dias = Math.round((d - new Date(new Date().toDateString() + ' 12:00')) / 864e5);
    if(dias < 0) return '';
    return (dias === 0 ? 'Hoy' : dias === 1 ? 'Mañana' : `${d.getDate()} de ${d.toLocaleDateString('es-ES', { month: 'long' })}`) + ' · Próximo sorteo';
  }
  const paintWhen = () => { const t = drawTxt(true); document.querySelectorAll('[data-srt-when]').forEach(el => { el.textContent = t; el.hidden = !t; });
    const tag = drawTag(); if(tag) document.querySelectorAll('[data-srt-tag]').forEach(el => el.textContent = tag); };
  document.addEventListener('DOMContentLoaded', paintWhen);

  const WANT = 'ib-sorteo-quiere';                       // pulsó «Participar» sin cuenta
  const inKey = u => 'ib-sorteo-in-' + u.id;             // ya inscrito (para pintar al momento)
  const home = /(^\/$|\/index\.html$)/.test(location.pathname);
  const ls = { get: k => { try{ return localStorage.getItem(k); }catch(e){ return null; } }, set: (k, v) => { try{ v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); }catch(e){} } };

  let user = IB.storedUser ? IB.storedUser() : null;
  let state = !user ? 'guest' : ls.get(inKey(user)) ? 'in' : 'out';
  let tiradas = Number(user && ls.get(inKey(user))) || 1;   // 1 por apuntarse + las extra que suma el equipo

  // el cliente de Supabase es el de la página (app.js): uno solo aunque lo pidan sorteo.js y live.js a la vez
  const ensureClient = () => IB.ensureSb ? IB.ensureSb() : Promise.resolve(IB.sb || null);
  const partTxt = n => `${n} ${n === 1 ? 'participación' : 'participaciones'}`;

  /* ---------- pintar según el estado ---------- */
  function paint(){
    document.body.classList.remove('srt-st-guest', 'srt-st-out', 'srt-st-in');
    document.body.classList.add('srt-st-' + state);
    const txt = partTxt(tiradas);
    document.querySelectorAll('[data-srt-n]').forEach(el => { el.textContent = txt; });
    document.querySelectorAll('[data-srt-me]').forEach(meCard);
    pintarBar();
    oyentes.forEach(fn => { try{ fn(); }catch(e){} });
  }
  const oyentes = [];
  // apartado del sorteo arriba en «Mis grupos» y «Mi cuenta»
  function meCard(box){
    if(state === 'guest'){ box.hidden = true; return; }
    box.hidden = false;
    const extra = Math.max(0, tiradas - 1);
    const IG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.5" cy="6.5" r="1"/></svg>';
    const estado = revelable()
      ? (spun() ? (premio ? '<b>Te ha tocado premio.</b> Te escribimos por WhatsApp.' : 'Esta vez no ha habido suerte. Sigues dentro para los próximos.') : '<b>Ya puedes ver tu resultado.</b>')
      : (drawTxt() || 'Te avisaremos cuando haya sorteo.');
    box.innerHTML = state === 'in' ? `
      <div class="srt-me-l"><span class="srt-me-k">Sorteo · Ultra Europe</span>
        <b class="srt-me-h">Estás dentro con ${partTxt(tiradas)}</b>
        <small>1 por apuntarte${extra ? ` · +${extra} por tu story de Instagram` : ''}. ${estado}</small></div>
      <div class="srt-me-r">${revelable() && !spun() ? '<button type="button" class="btn srt-btn" data-srt-spin>Ver mi resultado</button>' : `<a class="srt-me-go" href="sorteo.html">Ver el sorteo →</a><span>${extra ? 'Tu story ya cuenta. Compártelo también para que se apunten tus amigos.' : '¿Otra participación? Sube el cartel a tu story mencionando a <b>@iberailspain</b>.'}</span>
        <button type="button" class="srt-ig-btn" data-srt-poster>${IG}Compartir cartel</button>`}</div>`
    : `
      <div class="srt-me-l"><span class="srt-me-k">Sorteo · Ultra Europe</span>
        <b class="srt-me-h">Aún no participas en el sorteo</b>
        <small>Es gratis: pulsa el botón y entras con 1 participación. Si subes nuestro cartel a tu story, te sumamos otra.${drawTxt() ? ' <b>' + drawTxt() + '</b>' : ''}</small></div>
      <div class="srt-me-r"><button type="button" class="btn srt-btn" data-srt-join>Participar gratis<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button></div>`;
  }
  function toast(msg){
    const t = document.createElement('div'); t.className = 'srt-toast'; t.setAttribute('role', 'status');
    t.innerHTML = `<span aria-hidden="true">✓</span><div>${msg}</div>`;
    document.body.appendChild(t);
    requestAnimationFrame(() => requestAnimationFrame(() => t.classList.add('is-in')));
    setTimeout(() => { t.classList.remove('is-in'); setTimeout(() => t.remove(), 400); }, 5200);
  }

  /* ---------- móvil obligatorio para participar (para avisar al ganador) ---------- */
  function normPhone(v){
    let d = String(v || '').replace(/[\s().-]/g, '');
    if(/^00\d/.test(d)) d = '+' + d.slice(2);
    if(/^\+34/.test(d)) d = d.slice(3);
    if(/^[67]\d{8}$/.test(d)) return '+34' + d;
    if(/^\+(?!34)\d{8,14}$/.test(d)) return d;
    return '';
  }
  // ventanita «Añade tu móvil»: resuelve true cuando lo ha guardado, false si la cierra
  function askTel(sb){
    return new Promise(res => {
      const o = document.createElement('div');
      o.className = 'srt-tel'; o.setAttribute('role', 'dialog'); o.setAttribute('aria-modal', 'true'); o.setAttribute('aria-label', 'Añade tu móvil');
      o.innerHTML = `<form class="srt-tel-box" novalidate>
          <button type="button" class="srt-tel-x" aria-label="Cerrar">×</button>
          <span class="srt-tel-ic" aria-hidden="true">📱</span>
          <b>Falta tu móvil</b>
          <p>Para participar en el sorteo necesitamos tu móvil: así podemos avisarte si te toca una entrada.</p>
          <input class="pl-input" type="tel" inputmode="tel" autocomplete="tel" maxlength="20" placeholder="600 123 456" aria-label="Tu móvil">
          <small class="srt-tel-err" hidden></small>
          <button class="btn srt-btn" type="submit">Guardar y participar</button>
        </form>`;
      const done = ok => { o.remove(); res(ok); };
      o.addEventListener('click', e => { if(e.target === o || e.target.closest('.srt-tel-x')) done(false); });
      o.querySelector('form').addEventListener('submit', async e => {
        e.preventDefault();
        const tel = normPhone(o.querySelector('input').value), er = o.querySelector('.srt-tel-err'), b = o.querySelector('[type=submit]');
        if(!tel){ er.textContent = 'Escribe un móvil válido (9 cifras, o con prefijo + si no es de España).'; er.hidden = false; return; }
        b.disabled = true; er.hidden = true;
        const { error } = await sb.auth.updateUser({ data: { telefono: tel } });
        b.disabled = false;
        if(error){ er.textContent = 'No se pudo guardar. Prueba otra vez.'; er.hidden = false; return; }
        done(true);
      });
      document.body.appendChild(o);
      setTimeout(() => o.querySelector('input').focus(), 50);
    });
  }

  /* ---------- inscripción ---------- */
  async function join(auto){
    const sb = await ensureClient(); if(!sb) throw new Error('sin conexión');
    const { data } = await sb.auth.getSession(); const u = data && data.session ? data.session.user : null;
    if(!u) throw new Error('sin sesión');
    if(!normPhone((u.user_metadata || {}).telefono) && !(await askTel(sb))) return;   // sin móvil no se participa
    const { error } = await sb.from('sorteo_inscritos').insert({ user_id: u.id });
    if(error && error.code !== '23505' && !/duplicate/i.test(error.message || '')) throw error;
    user = u; state = 'in'; tiradas = Math.max(1, tiradas); ls.set(inKey(u), String(tiradas)); ls.set(WANT, null); paint();
    toast(auto ? '<b>¡Listo! Ya estás dentro del sorteo</b>Entras en todos los sorteos de entradas para el Ultra Europe.' : `<b>¡Ya estás dentro del sorteo!</b>${drawTxt() || 'Te avisaremos cuando haya sorteo.'} Mucha suerte.`);
  }
  async function check(){
    if(!user){
      // sin sesión también se enseña el próximo sorteo (necesita 14-sorteo-publico.sql: lectura pública de sorteo_config)
      const sb0 = await ensureClient(); if(!sb0) return;
      try{
        const c0 = await sb0.from('sorteo_config').select('fecha, hora, entradas, tanda, sonidos').eq('id', 1).maybeSingle();
        if(!c0.error && c0.data){
          DRAW.fecha = c0.data.fecha || ''; if(c0.data.hora) DRAW.hora = String(c0.data.hora).slice(0, 5);
          if(c0.data.entradas) DRAW.entradas = c0.data.entradas; if(c0.data.tanda) DRAW.tanda = Number(c0.data.tanda) || 1;
          sonidos = c0.data.sonidos || null; paintWhen(); paint();
        }
      }catch(e){}
      return;
    }
    const sb = await ensureClient(); if(!sb) return;
    try{
      const { data } = await sb.auth.getSession(); const u = data && data.session ? data.session.user : null;
      if(!u){ user = null; state = 'guest'; return paint(); }
      user = u;
      const r = await sb.from('sorteo_inscritos').select('user_id, extra').eq('user_id', u.id).maybeSingle();
      if(!r.error){ state = r.data ? 'in' : 'out'; tiradas = r.data ? 1 + (Number(r.data.extra) || 0) : 1; ls.set(inKey(u), r.data ? String(tiradas) : null); paint(); }
      // configuración del sorteo (la edita el equipo en el panel) y mi resultado
      const c = await sb.from('sorteo_config').select('*').eq('id', 1).maybeSingle();
      if(!c.error && c.data){
        DRAW.fecha = c.data.fecha || '';   // sin fecha = no hay sorteo programado («próximamente»)
        if(c.data.hora) DRAW.hora = String(c.data.hora).slice(0, 5);
        if(c.data.entradas) DRAW.entradas = c.data.entradas;
        if(c.data.tanda) DRAW.tanda = Number(c.data.tanda) || 1;   // número interno de sorteo (sube con «Preparar un sorteo nuevo»)
        DRAW.acta = c.data.acta || '';
        publicado = !!c.data.publicado;
        catalogo = Array.isArray(c.data.premios) && c.data.premios.length ? c.data.premios : null;
        sonidos = c.data.sonidos || null;
        if(publicado && state === 'in'){
          const [g, rs] = await Promise.all([
            sb.from('sorteo_ganadores').select('premio, tirada').eq('user_id', u.id).maybeSingle()
            .then(x => x.error ? sb.from('sorteo_ganadores').select('premio').eq('user_id', u.id).maybeSingle() : x),   // sin el archivo 13 no hay columna tirada
            sb.rpc('sorteo_restantes')
          ]);
          if(!g.error){ premio = g.data ? (g.data.premio || 'entrada') : ''; ganaEn = g.data && g.data.tirada ? Number(g.data.tirada) : null; }
          const r0 = rs && !rs.error && rs.data ? (Array.isArray(rs.data) ? rs.data[0] : rs.data) : null;
          if(r0) restantes = { entradas: Number(r0.entradas) || 0, dadas: Number(r0.dadas) || 0 };
        }
        paintWhen(); paint();
        if(pagSorteo && revelable() && !spun()) setTimeout(girar, 900);   // en el resto de páginas, solo con el botón
      }
      if(state === 'out' && ls.get(WANT)) await join(true);   // lo pidió antes de tener cuenta
    }catch(e){}
  }

  document.addEventListener('click', async e => {
    const b = e.target.closest('[data-srt-join]'); if(!b) return;
    e.preventDefault();
    if(state === 'in') return;
    if(state === 'guest' || !user){ ls.set(WANT, '1'); location.href = 'cuenta.html'; return; }
    const label = b.innerHTML; b.disabled = true; b.textContent = 'Apuntándote…';
    try{ await join(false); }
    catch(err){ alert('No se pudo completar la inscripción. Prueba otra vez en un momento.'); }
    finally{ b.disabled = false; b.innerHTML = label; }
  });

  // la cinta y las celebraciones solo se descargan cuando alguien va a ver su resultado
  const cargas = {};
  function cargarJs(nombre){
    const url = SRC ? SRC.replace(/sorteo\.js(\?.*)?$/, nombre) : 'assets/' + nombre;
    return cargas[url] || (cargas[url] = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = url; s.async = true;
      s.onload = res; s.onerror = () => { delete cargas[url]; rej(new Error(nombre)); };
      document.head.appendChild(s);
    }));
  }
  async function ruletaLista(){
    if(window.IBRuleta) return true;
    try{ if(!window.IBFiesta) await cargarJs('fiesta.js'); await cargarJs('ruleta.js'); }catch(e){}
    return !!window.IBRuleta;
  }
  // una sola ruleta a la vez (antes, cada comprobación podía abrir otra encima)
  let girando = false;
  async function girar(){
    if(girando || !revelable() || spun() || document.querySelector('.rul')) return;
    girando = true;
    try{
      if(!(await ruletaLista())){ alert('No se pudo abrir tu resultado. Revisa la conexión y prueba otra vez.'); return; }
      const sb = await ensureClient();
      await IBRuleta.show({ premio: premio, catalogo: catalogo, nombre: (user && user.user_metadata && user.user_metadata.nombre) || '', acta: DRAW.acta, restantes: restantes, sonidos: sonidos,
        tiradas: tiradas, ganaEn: ganaEn, desde: abiertas() + 1, onTirada: i => marcar(i) });
      paint();
      if(sb) sb.rpc('sorteo_visto').then(() => {}, () => {});
    } finally { girando = false; }
  }
  document.addEventListener('click', e => { if(e.target.closest('[data-srt-spin]')){ e.preventDefault(); girar(); } });

  const drawAt = () => DRAW.fecha ? horaMadrid(DRAW.fecha, DRAW.hora) : null;

  /* ---------- barra fina arriba: solo la semana del sorteo o con el resultado pendiente de ver ---------- */
  const BAR_KEY = 'ib-sorteo-bar-cerrada';
  let barEl = null;
  function barInfo(){
    if(!SORTEO_BAR || pagSorteo) return null;
    if(state === 'in' && revelable() && !spun()) return { l: 'Ya puedes ver tu resultado del sorteo', s: 'Tu resultado del sorteo', go: 'Verlo' };
    const at = drawAt(), ms = at ? at - Date.now() : -1;
    if(ms <= 0 || ms > BAR_DIAS * 864e5) return null;
    return { l: 'Sorteo ' + drawTxt('bar'), s: 'Sorteo Ultra · ' + drawTxt('corto'), go: state === 'in' ? 'Ver' : 'Participar' };
  }
  function pintarBar(){
    let cerrada = false; try{ cerrada = !!sessionStorage.getItem(BAR_KEY); }catch(e){}
    const info = cerrada ? null : barInfo();
    if(!info){ if(barEl){ barEl.remove(); barEl = null; } return; }
    if(!barEl){
      barEl = document.createElement('div'); barEl.className = 'srtbar';
      barEl.addEventListener('click', e => {
        if(!e.target.closest('.srtbar-x')) return;
        try{ sessionStorage.setItem(BAR_KEY, '1'); }catch(err){}
        barEl.remove(); barEl = null;
      });
      document.body.prepend(barEl);
    }
    const h = `<a class="srtbar-a" href="sorteo.html">
        <span class="srtbar-t"><span class="srtbar-l">${esc(info.l)}</span><span class="srtbar-s">${esc(info.s)}</span></span>
        <span class="srtbar-go">${esc(info.go)}<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>
      </a>
      <button type="button" class="srtbar-x" aria-label="Cerrar aviso del sorteo"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
    if(barEl._h !== h){ barEl._h = h; barEl.innerHTML = h; }
  }

  /* ---------- cartel para stories ---------- */
  const W = 1080, H = 1920;
  const FD = '"Bricolage Grotesque", "Poppins", system-ui, sans-serif';
  const FM = '"IBM Plex Mono", ui-monospace, monospace';
  const FB = '"Inter", system-ui, sans-serif';

  function rr(c, x, y, w, h, r){ c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function gold(c, x0, y0, x1, y1){ const g = c.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, '#FFF0C2'); g.addColorStop(.35, '#FFD66B'); g.addColorStop(.7, '#E9A53A'); g.addColorStop(1, '#FFE39A'); return g; }
  // entrada con muescas (se recorta con dos círculos en la línea del talón)
  function ticket(c, w, h, fill, stubX){
    // se dibuja en un lienzo aparte para que las muescas no agujereen el fondo del cartel
    const o = document.createElement('canvas'); o.width = w; o.height = h;
    const x = o.getContext('2d'); x.translate(w / 2, h / 2);
    rr(x, -w / 2, -h / 2, w, h, 34); x.fillStyle = typeof fill === 'function' ? fill(x) : fill; x.fill();
    x.globalCompositeOperation = 'destination-out';
    [-h / 2, h / 2].forEach(y => { x.beginPath(); x.arc(-w / 2 + stubX, y, 26, 0, Math.PI * 2); x.fill(); });
    c.drawImage(o, -w / 2, -h / 2);
  }
  async function draw(){
    try{ await Promise.all([`800 120px ${FD}`, `700 60px ${FD}`, `500 30px ${FM}`, `600 40px ${FB}`].map(f => document.fonts.load(f))); }catch(e){}
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    // fondo con focos
    c.fillStyle = '#140B08'; c.fillRect(0, 0, W, H);
    [[900, 250, 900, 'rgba(240,83,47,.42)'], [80, 1750, 800, 'rgba(255,197,61,.22)'], [540, 1120, 700, 'rgba(255,214,107,.10)']].forEach(([x, y, r, col]) => {
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(20,11,8,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    });
    c.save(); c.globalAlpha = .07; c.fillStyle = '#FFD66B';
    [[-0.32, 70], [-0.12, 50], [0.1, 80], [0.3, 55]].forEach(([a, w]) => { c.save(); c.translate(760, -40); c.rotate(a); c.beginPath(); c.moveTo(-w / 4, 0); c.lineTo(w / 4, 0); c.lineTo(w * 2.2, 1500); c.lineTo(-w * 2.2, 1500); c.closePath(); c.fill(); c.restore(); });
    c.restore();
    // marca
    c.textBaseline = 'alphabetic'; c.textAlign = 'center';
    c.font = `800 64px ${FD}`; const t1 = 'ibe', t2 = 'rail';
    const w1 = c.measureText(t1).width, w2 = c.measureText(t2).width, bx = W / 2 - (w1 + w2) / 2;
    c.textAlign = 'left'; c.fillStyle = '#FFF3DC'; c.fillText(t1, bx, 300); c.fillStyle = '#F0532F'; c.fillText(t2, bx + w1, 300);
    // etiqueta
    c.textAlign = 'center'; c.font = `500 30px ${FM}`;
    const tag = 'SORTEO  ·  PRÓXIMAMENTE', tw = c.measureText(tag).width + 110;
    rr(c, W / 2 - tw / 2, 360, tw, 72, 36); c.fillStyle = 'rgba(255,214,107,.10)'; c.fill(); c.strokeStyle = 'rgba(255,214,107,.4)'; c.lineWidth = 2; c.stroke();
    c.fillStyle = '#FFD66B'; c.beginPath(); c.arc(W / 2 - tw / 2 + 40, 396, 8, 0, Math.PI * 2); c.fill();
    c.fillText(tag, W / 2 + 14, 407);
    // titular
    c.fillStyle = '#FFFFFF'; c.font = `800 150px ${FD}`; c.fillText('Sorteamos', W / 2, 610);
    c.font = `800 92px ${FD}`; c.fillText('entradas para el', W / 2, 720);
    c.fillStyle = gold(c, 160, 760, 920, 860); c.font = `800 118px ${FD}`; c.fillText('Ultra Europe', W / 2, 840);
    // entradas en abanico
    c.save(); c.translate(W / 2, 1150);
    c.save(); c.rotate(-0.2); c.translate(-30, -40); ticket(c, 820, 400, '#4A2210', 600); c.restore();
    c.save(); c.rotate(-0.09); c.translate(-10, -14); ticket(c, 820, 400, '#8E5018', 600); c.restore();
    c.rotate(0.05);
    c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 60; c.shadowOffsetY = 30;
    ticket(c, 820, 400, x => gold(x, -410, -200, 410, 200), 600);
    c.shadowColor = 'transparent';
    c.fillStyle = '#2A1611'; c.textAlign = 'left';
    c.globalAlpha = .7; c.font = `500 24px ${FM}`; c.fillText('ADMIT ONE · PASE 3 DÍAS', -360, -110); c.globalAlpha = 1;
    c.font = `800 76px ${FD}`; c.fillText('Ultra Europe', -362, -30);
    c.fillStyle = '#8C2A17'; c.font = `700 56px ${FD}`; c.fillText('2027', -360, 34);
    c.strokeStyle = 'rgba(42,22,17,.35)'; c.setLineDash([10, 8]); c.lineWidth = 3;
    c.beginPath(); c.moveTo(-360, 70); c.lineTo(160, 70); c.stroke();
    c.beginPath(); c.moveTo(190, -170); c.lineTo(190, 170); c.stroke(); c.setLineDash([]);
    c.fillStyle = '#2A1611'; c.globalAlpha = .6; c.font = `500 20px ${FM}`; c.fillText('LUGAR', -360, 112); c.fillText('FECHAS', -80, 112); c.globalAlpha = 1;
    c.font = `700 32px ${FB}`; c.fillText('Split, Croacia', -360, 152); c.fillText('9 — 11 jul', -80, 152);
    c.textAlign = 'center'; c.globalAlpha = .6; c.font = `500 22px ${FM}`; c.fillText('Nº', 300, -70); c.globalAlpha = 1;
    c.font = `800 64px ${FD}`; c.fillText('FREE', 300, 0);
    for(let i = 0, x = 240; x < 360; i++){ const w = [3, 6, 2, 4, 8, 3][i % 6]; c.fillRect(x, 40, w, 80); x += w + [4, 3, 6, 3, 4, 5][i % 6]; }
    c.restore();
    // pie
    c.textAlign = 'center'; c.fillStyle = 'rgba(255,243,220,.75)'; c.font = `600 42px ${FB}`;
    c.fillText('Participa gratis en', W / 2, 1530);
    c.fillStyle = gold(c, 250, 1560, 830, 1640); c.font = `800 104px ${FD}`; c.fillText('iberail.com', W / 2, 1640);
    const ig = '@iberailspain'; c.font = `700 40px ${FB}`; const iw = c.measureText(ig).width + 80;
    rr(c, W / 2 - iw / 2, 1690, iw, 80, 40); c.fillStyle = '#FFF3DC'; c.fill();
    c.fillStyle = '#1F120E'; c.fillText(ig, W / 2, 1744);
    return new Promise(res => cv.toBlob(res, 'image/png'));
  }

  document.addEventListener('click', async e => {
    const btn = e.target.closest('[data-srt-poster]'); if(!btn) return;
    const label = btn.innerHTML; btn.disabled = true; btn.textContent = 'Preparando cartel…';
    try{
      const blob = await draw();
      const file = new File([blob], 'iberail-sorteo-ultra.png', { type: 'image/png' });
      if(navigator.canShare && navigator.canShare({ files: [file] })){
        try{ await navigator.share({ files: [file], text: 'Sorteos de entradas para el Ultra Europe con @iberailspain · iberail.com' }); }
        catch(e){ if(e && e.name !== 'AbortError') throw e; }
      } else {
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = file.name;
        document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
      }
    }catch(e){ alert('No se pudo preparar el cartel. Prueba otra vez.'); }
    finally{ btn.disabled = false; btn.innerHTML = label; }
  });

  /* para la página del sorteo (assets/sorteo-pagina.js) */
  window.IBSrt = {
    get: () => ({ state, tiradas, abiertas: abiertas(), premio, ganaEn, publicado, draw: { ...DRAW }, at: drawAt(), revelable: revelable(), spun: spun(), sonidos: sonidos || {} }),
    refresh: () => check(), girar: () => girar(), on: fn => { oyentes.push(fn); fn(); }
  };

  paint(); check();
  ensureClient().then(sb => { if(sb) sb.auth.onAuthStateChange((_ev, session) => {
    const u = session ? session.user : null;
    if(!u){ if(user){ user = null; state = 'guest'; premio = null; ganaEn = null; paint(); } return; }
    if(!user || user.id !== u.id){ premio = null; ganaEn = null; user = u; state = ls.get(inKey(u)) ? 'in' : 'out'; paint(); setTimeout(check, 0); }
  }); });
})();
