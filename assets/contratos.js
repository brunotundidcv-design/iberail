/* Iberail — contratos de viaje firmados en la web
   · «Mis grupos» (cuenta.js pinta <div data-contrato="ID">): aviso de contrato pendiente → leer, rellenar datos y firmar
     con el dedo/ratón. Si es menor, firma su padre/madre/tutor y firma también la autorización.
   · Panel (panel.js pinta <section data-contratos-admin="ID">): condiciones del grupo, enviar a cada viajero como
     mayor o menor de edad, ver quién ha firmado y descargar cada contrato firmado (PDF desde el navegador).
   SQL: supabase/sql/contratos.sql (tabla contratos + RPC firmar_contrato). */
(function(){
  const IB = window.IB;
  if(!IB) return;
  const esc = IB.esc;
  const VERSION = '2026-09';
  const AGENCIA = { nombre: 'Iberail', nif: '54214650Q', domicilio: 'Avenida Lazarejo 50, 28232 Las Rozas de Madrid (Madrid)', tel: '+34 683 55 76 26', email: 'info@iberail.com', web: 'iberail.com' };
  // qué incluye el grupo (menú del panel). Por defecto, todo.
  const INCLUYE = [
    ['inc_ida', 'Vuelo de ida'], ['inc_vuelta', 'Vuelo de vuelta'], ['inc_maleta', 'Maleta facturada 23 kg'],
    ['inc_pase', 'Pase Interrail'], ['inc_aloj', 'Alojamientos'], ['inc_otros', 'Buses / ferris de la ruta']
  ];
  const inc = (cd, k) => cd[k] !== false;   // contratos antiguos (sin la marca) = incluido
  const COND_DEF = {
    inc_ida: true, inc_vuelta: true, inc_maleta: true, inc_pase: true, inc_aloj: true, inc_otros: true,
    gastos: '50',
    vuelos: '',
    pase: 'Pase Interrail Global en 2.ª clase, válido en los trenes incluidos en el pase',
    otros: 'Trayectos en autobús o ferri indicados en la ruta',
    calendario: '',
    seguro: '', seguro_precio: ''
  };
  const I = {
    doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3h7l5 5v13H7z"/><path d="M14 3v5h5M10 13h6M10 17h6"/></svg>',
    pen: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>',
    phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>'
  };
  const fd = iso => iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long', year: 'numeric' }) : '';
  const fdt = iso => iso ? new Date(iso).toLocaleString('es-ES', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '';
  const eur = n => { const [i, d] = Math.abs(Number(n) || 0).toFixed(2).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d === '00' ? '' : ',' + d) + ' €'; };
  const addD = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
  const edad = (nac, en) => { if(!nac) return null; const a = new Date(nac + 'T12:00:00'), b = new Date((en || new Date().toISOString().slice(0, 10)) + 'T12:00:00'); let e = b.getFullYear() - a.getFullYear(); if(b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) e--; return e; };
  const hueco = (v, n = 18) => v ? esc(v) : `<span class="ct-gap">${'&nbsp;'.repeat(n)}</span>`;

  /* ======================= datos del viaje para el contrato ======================= */
  async function contexto(row){
    const gid = Number(row.grupo_id);
    const [g, m, r, a] = await Promise.all([
      IB.sb.from('grupos').select('id, nombre').eq('id', gid).maybeSingle(),
      IB.sb.from('grupo_miembros').select('importe').eq('grupo_id', gid).eq('user_id', row.user_id).maybeSingle(),
      IB.sb.from('rutas').select('salida, fecha_salida, dias, paradas, ref, viajeros').eq('grupo_id', gid).order('created_at', { ascending: false }).limit(1),
      IB.sb.from('alojamientos').select('ciudad, entrada, salida').eq('grupo_id', gid)
    ]);
    const ruta = (r.data || [])[0] || {};
    const alo = (a.data || []).filter(x => x.entrada).sort((x, y) => String(x.entrada).localeCompare(String(y.entrada)));
    let paradas;
    if(alo.length) paradas = alo.map(x => ({ ciudad: String(x.ciudad).split(',').pop().trim(), entrada: x.entrada, salida: x.salida, noches: x.salida ? Math.round((new Date(x.salida) - new Date(x.entrada)) / 864e5) : '' }));
    else { let cur = ruta.fecha_salida; paradas = (ruta.paradas || []).map(p => { const d = parseInt(p.dias, 10) || 0, e = cur; if(cur) cur = addD(cur, d); return { ciudad: p.ciudad, entrada: e || '', salida: e ? cur : '', noches: d }; }); }
    const inicio = ruta.fecha_salida || (paradas[0] || {}).entrada || '';
    const fin = (paradas[paradas.length - 1] || {}).salida || (inicio && ruta.dias ? addD(inicio, ruta.dias) : '');
    return { version: VERSION, grupo: (g.data || {}).nombre || '', ref: ruta.ref || '', salida: ruta.salida || '', inicio, fin, dias: ruta.dias || '', viajeros: ruta.viajeros || '', precio: Number((m.data || {}).importe || 0), paradas, cond: { ...COND_DEF, ...(row.condiciones || {}) }, tipo: row.tipo };
  }

  /* ======================= lo incluido según el menú del grupo ======================= */
  function vuelosTxt(cd){
    if(cd.inc_ida === undefined && cd.vuelos) return cd.vuelos;   // contratos de antes del menú
    const ida = inc(cd, 'inc_ida'), vta = inc(cd, 'inc_vuelta');
    if(!ida && !vta) return '';
    const t = ida && vta ? 'Vuelos de ida y vuelta desde España' : ida ? 'Vuelo de ida desde España (el de vuelta no está incluido)' : 'Vuelo de vuelta a España (el de ida no está incluido)';
    return t + (inc(cd, 'inc_maleta') ? ', con equipaje de mano y maleta facturada de 23 kg' : ', con equipaje de mano (sin maleta facturada)');
  }
  function noIncl(cd){
    if(cd.inc_ida === undefined) return '';
    const ida = inc(cd, 'inc_ida'), vta = inc(cd, 'inc_vuelta'), l = [];
    if(!ida && !vta) l.push('vuelos'); else if(!ida) l.push('vuelo de ida'); else if(!vta) l.push('vuelo de vuelta');
    if((ida || vta) && !inc(cd, 'inc_maleta')) l.push('maleta facturada');
    if(!inc(cd, 'inc_pase')) l.push('pase Interrail y billetes de tren');
    if(!inc(cd, 'inc_aloj')) l.push('alojamiento');
    return l.length ? `<b>${esc(l.join(', '))}</b>, ` : '';
  }
  const resumen = cd => INCLUYE.filter(([k]) => inc(cd, k) && !(k === 'inc_maleta' && !inc(cd, 'inc_ida') && !inc(cd, 'inc_vuelta'))).map(([, t]) => t).concat(cd.seguro ? ['Seguro de viaje'] : [], ['Asistencia 24 h']);

  /* ======================= el texto del contrato ======================= */
  function texto(c, d){
    d = d || {}; const v = d.viajero || {}, tu = d.tutor || {}, cd = c.cond, menor = c.tipo === 'menor';
    const S = (n, t) => `<h3><b>${n}.</b> ${t}</h3>`;
    return `
    <div class="ct-doc">
      <p class="ct-kicker">Contrato de viaje combinado</p>
      <p class="ct-sub">Grupo <b>${hueco(c.grupo)}</b>${c.ref ? ` · Ref. ${esc(c.ref)}` : ''}</p>
      ${S(1, 'Las partes')}
      <p><b>De una parte, IBERAIL</b>, con NIF ${AGENCIA.nif} y domicilio en ${esc(AGENCIA.domicilio)}. Teléfono y WhatsApp: ${AGENCIA.tel}. Correo: ${AGENCIA.email}. Web: ${AGENCIA.web} (en adelante, «Iberail»).</p>
      <p><b>Y de otra parte, el/la viajero/a:</b> ${hueco(v.nombre, 24)}, con DNI/pasaporte ${hueco(v.dni)}, nacido/a el ${hueco(v.nacimiento ? fd(v.nacimiento) : '')}, con domicilio en ${hueco(v.domicilio, 24)}${menor ? '' : `, teléfono ${hueco(v.telefono)} y correo ${hueco(v.email)}`}.</p>
      ${menor ? `<p><b>Al ser menor de edad, contrata en su nombre su representante legal:</b> ${hueco(tu.nombre, 24)}, con DNI ${hueco(tu.dni)}, en calidad de ${hueco(tu.relacion)}, teléfono ${hueco(tu.telefono)} y correo ${hueco(tu.email)}.</p>` : ''}
      ${S(2, 'Objeto del contrato')}
      <p>Iberail organiza y el Viajero contrata un viaje combinado por Europa en tren dentro del grupo indicado, con las características de este contrato y de la ficha del grupo en iberail.com («Mis grupos»), que forma parte de él.</p>
      <table class="ct-tb"><tbody>
        <tr><th>Ciudad de salida</th><td>${hueco(c.salida)}</td></tr>
        <tr><th>Salida</th><td>${hueco(fd(c.inicio))}</td></tr>
        <tr><th>Regreso</th><td>${hueco(fd(c.fin))}</td></tr>
        <tr><th>Duración</th><td>${c.dias ? `${esc(c.dias)} días` : hueco('')}</td></tr>
      </tbody></table>
      ${c.paradas.length ? `<table class="ct-tb ct-tb--it"><thead><tr><th>Ciudad</th><th>Entrada</th><th>Salida</th><th>Noches</th></tr></thead><tbody>${c.paradas.map(p => `<tr><td>${esc(p.ciudad)}</td><td>${esc(fd(p.entrada))}</td><td>${esc(fd(p.salida))}</td><td>${esc(p.noches)}</td></tr>`).join('')}</tbody></table>` : ''}
      ${S(3, 'Servicios incluidos')}
      <ul>
        ${vuelosTxt(cd) ? `<li><b>Vuelos:</b> ${esc(vuelosTxt(cd))}.</li>` : ''}
        ${inc(cd, 'inc_pase') ? `<li><b>Pase Interrail:</b> ${esc(cd.pase || COND_DEF.pase)}.</li>` : ''}
        ${inc(cd, 'inc_aloj') ? '<li><b>Alojamiento</b> en apartamentos (Airbnb u otras plataformas) en las ciudades y fechas indicadas, compartidos por los miembros del grupo.</li>' : ''}
        ${inc(cd, 'inc_otros') && cd.otros ? `<li><b>Otros:</b> ${esc(cd.otros)}.</li>` : ''}
        ${cd.seguro ? `<li><b>Seguro de viaje:</b> ${esc(cd.seguro)}${cd.seguro_precio ? ` (${esc(eur(String(cd.seguro_precio).replace(',', '.')))} por persona, incluido en el precio total)` : ''}. Lo presta la aseguradora, que es quien cubre los siniestros según las condiciones de la póliza; Iberail lo gestiona y entrega al Viajero el certificado del seguro.</li>` : ''}
        <li><b>Asistencia Iberail 24 h</b> por WhatsApp durante todo el viaje para ayudar a gestionar incidencias (reclamaciones, cambios de billetes, contacto con los anfitriones, orientación médica o por pérdida de documentación). Es un servicio de ayuda y gestión, no un seguro, y no incluye el pago de los gastos que se deriven de esas incidencias.</li>
        <li>Acceso a la ficha del grupo en iberail.com con la ruta, los alojamientos, los billetes, los avisos y el estado de los pagos.</li>
      </ul>
      <p><b>No incluido:</b> ${noIncl(cd)}entradas a festivales o eventos (incluido el Ultra Europe), comidas y bebidas, transporte urbano, reservas de asiento o suplementos de trenes no indicados, tasas turísticas que se cobren en destino, ${cd.seguro ? 'fianzas de los alojamientos y' : 'fianzas de los alojamientos, seguro de viaje y'} cualquier servicio no mencionado en este apartado.</p>
      ${S(4, 'Precio y pagos')}
      <p><b>Precio total por persona: ${c.precio ? esc(eur(c.precio)) : hueco('')}</b>, impuestos incluidos (régimen especial de las agencias de viajes). El precio es cerrado y no se revisará al alza.</p>
      ${cd.calendario ? `<p><b>Calendario de pagos:</b></p><p class="ct-pre">${esc(cd.calendario)}</p>` : ''}
      <p>Los pagos pueden hacerse con tarjeta desde iberail.com («Mis grupos»), por transferencia o por Bizum, y quedan reflejados en la ficha del grupo. Si un pago no se abona en su plazo, Iberail podrá requerirlo y, si no se atiende en 7 días, considerar el contrato resuelto por desistimiento del Viajero, con las consecuencias del apartado 5.</p>
      ${S(5, 'Cancelación por el Viajero')}
      <p>El Viajero puede cancelar en cualquier momento antes de la salida, comunicándolo por escrito (correo o WhatsApp). Iberail le devolverá lo pagado descontando (a) los importes de los servicios ya contratados que no sean reembolsables (vuelos, pases o alojamientos ya pagados), que se justificarán si lo pide, y (b) unos gastos de gestión de ${cd.gastos ? esc(eur(cd.gastos)) : hueco('', 8)} por persona. Si en el destino concurren circunstancias inevitables y extraordinarias que afecten significativamente al viaje, podrá cancelar sin penalización y recuperar todo lo pagado. La devolución se hará en un máximo de 14 días.</p>
      ${S(6, 'Cesión')}
      <p>El Viajero puede ceder su plaza a otra persona que cumpla las condiciones del viaje avisando con al menos 7 días naturales de antelación. Ambos responden del pago pendiente y de los gastos del cambio, que Iberail comunicará antes.</p>
      ${S(7, 'Cambios y cancelación por Iberail')}
      <p>Iberail solo podrá hacer cambios poco significativos antes de la salida (por ejemplo, un alojamiento por otro de características y ubicación similares), avisando al Viajero. Si tuviera que modificar significativamente algún elemento principal o cancelar el viaje, el Viajero podrá aceptar el cambio o resolver el contrato y recuperar todo lo pagado sin penalización.</p>
      ${S(8, 'Durante el viaje')}
      <p>Iberail responde de la correcta ejecución de los servicios incluidos. Si alguno no se presta como se ha contratado, el Viajero debe comunicarlo cuanto antes por WhatsApp para que pueda solucionarse. El Viajero se compromete a respetar las normas de los alojamientos y transportes; los daños que cause serán de su cuenta.</p>
      ${S(9, 'Documentación')}
      <p>Cada Viajero debe llevar su DNI o pasaporte en vigor. Se recomienda la Tarjeta Sanitaria Europea (gratuita)${cd.seguro ? '' : ' y un seguro de viaje'}. Los menores que viajen sin sus padres deben llevar además la autorización de viaje al extranjero, que se tramita en la Policía Nacional o la Guardia Civil.</p>
      ${S(10, 'Información previa y datos personales')}
      <p>El Viajero declara haber recibido antes de firmar el formulario de información normalizada que figura al final de este contrato. Sus datos se tratarán conforme a la política de privacidad de iberail.com para organizar y gestionar el viaje.</p>
      ${S(11, 'Reclamaciones y ley aplicable')}
      <p>Las reclamaciones pueden dirigirse a ${AGENCIA.email} o por WhatsApp al ${AGENCIA.tel}; Iberail responderá en un máximo de un mes. El Viajero dispone también de hojas de reclamaciones. Este contrato se rige por la legislación española, en particular el Libro IV del Real Decreto Legislativo 1/2007, y son competentes los juzgados del domicilio del Viajero.</p>
      ${menor ? `${S(12, 'Autorización del padre, madre o tutor')}
      <p>Yo, ${hueco(tu.nombre, 24)}, con DNI ${hueco(tu.dni)}, como ${hueco(tu.relacion)} de ${hueco(v.nombre, 24)}, <b>autorizo</b> a que realice este viaje con el grupo «${hueco(c.grupo)}» en las fechas indicadas, a que se aloje con el resto del grupo en los alojamientos contratados y a desplazarse con él en los transportes incluidos, y asumo en su nombre las obligaciones de este contrato. Me comprometo a tramitar la autorización oficial de viaje al extranjero en la Policía Nacional o la Guardia Civil.</p>` : ''}
      <h3 class="ct-annex">Anexo · Formulario de información normalizada</h3>
      <p>La combinación de servicios de viaje que se le ofrece es un viaje combinado en el sentido de la Directiva (UE) 2015/2302, por lo que se beneficiará de todos los derechos de la UE que se aplican a los viajes combinados. Iberail será plenamente responsable de la correcta ejecución del viaje combinado en su conjunto.</p>
      <ul class="ct-small">
        <li>Recibirá toda la información esencial sobre el viaje combinado antes de celebrar el contrato.</li>
        <li>Siempre habrá como mínimo un empresario responsable de la correcta ejecución de todos los servicios de viaje incluidos en el contrato.</li>
        <li>Tendrá un número de teléfono de emergencia o un punto de contacto con Iberail.</li>
        <li>Podrá ceder el viaje combinado a otra persona, con un preaviso razonable y, en su caso, con costes adicionales.</li>
        <li>El precio solo podrá aumentarse si se producen gastos específicos previstos en el contrato y, en todo caso, a más tardar veinte días antes del inicio del viaje; si el aumento excede del 8 %, podrá poner fin al contrato. En este contrato el precio es cerrado.</li>
        <li>Podrá poner fin al contrato sin penalización y con reembolso completo si se modifica significativamente alguno de los elementos esenciales, salvo el precio. Si Iberail cancela antes del inicio, tendrá derecho al reembolso y, cuando proceda, a una indemnización.</li>
        <li>En circunstancias excepcionales, como graves problemas de seguridad en el destino, podrá poner fin al contrato sin penalización antes del inicio del viaje.</li>
        <li>Podrá poner fin al contrato en cualquier momento antes del inicio del viaje mediante el pago de una penalización adecuada y justificable.</li>
        <li>Si, tras el inicio del viaje, no pueden prestarse elementos significativos, deberán ofrecerse alternativas adecuadas sin coste adicional; podrá poner fin al contrato sin penalización si los servicios no se ejecutan conforme al contrato, esto afecta sustancialmente al viaje y Iberail no lo soluciona.</li>
        <li>Tendrá derecho a una reducción del precio o a una indemnización por daños y perjuicios en caso de no ejecución o ejecución incorrecta de los servicios.</li>
        <li>Iberail deberá proporcionar asistencia si se encuentra en dificultades.</li>
      </ul>
    </div>`;
  }

  /* ======================= firma con el dedo / ratón ======================= */
  function pad(canvas){
    const ctx = canvas.getContext('2d'); let drawing = false, has = false, last = null;
    const fit = () => { const r = canvas.getBoundingClientRect(), k = window.devicePixelRatio || 1; canvas.width = r.width * k; canvas.height = r.height * k; ctx.setTransform(k, 0, 0, k, 0, 0); ctx.lineWidth = 2.4; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#1A1614'; has = false; };
    const pos = e => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('pointerdown', e => { drawing = true; last = pos(e); canvas.setPointerCapture(e.pointerId); e.preventDefault(); });
    canvas.addEventListener('pointermove', e => { if(!drawing) return; const p = pos(e); ctx.beginPath(); ctx.moveTo(last[0], last[1]); ctx.lineTo(p[0], p[1]); ctx.stroke(); last = p; has = true; canvas.closest('.ct-sign').classList.add('is-signed'); });
    ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => canvas.addEventListener(ev, () => { drawing = false; }));
    requestAnimationFrame(fit);
    return { clear(){ fit(); canvas.closest('.ct-sign').classList.remove('is-signed'); }, has: () => has, png: () => canvas.toDataURL('image/png') };
  }

  /* ======================= «Mis grupos»: tarjeta del contrato ======================= */
  const mine = {};
  async function loadMine(gid){
    // solo el mío: el equipo (is_admin) ve los contratos de todos y cogería el de otro viajero
    const { data: s } = await IB.sb.auth.getSession(), uid = s && s.session && s.session.user ? s.session.user.id : null;
    if(!uid){ mine[gid] = null; return null; }
    const { data, error } = await IB.sb.from('contratos').select('*').eq('grupo_id', Number(gid)).eq('user_id', uid).neq('estado', 'anulado').order('enviado_at', { ascending: false }).limit(1);
    mine[gid] = error ? null : (data || [])[0] || null;
    return mine[gid];
  }
  function cardHtml(c){
    if(!c) return '';
    if(c.estado === 'firmado') return `<div class="gx-card ct-card is-done"><span class="gx-ic">${I.ok}</span><div><b>Contrato del viaje firmado</b><p>Firmado el ${esc(fdt(c.firmado_at))}.</p></div><button type="button" class="btn btn--ghost btn--sm" data-ct-print="${esc(c.id)}">Ver o descargar</button></div>`;
    return `<div class="gx-card ct-card"><span class="gx-ic">${I.pen}</span><div><b>Tienes el contrato del viaje listo para firmar</b><p>${c.tipo === 'menor' ? 'Como eres menor de edad, tiene que firmarlo tu padre, madre o tutor (con su DNI). Tarda un minuto.' : 'Léelo, rellena tus datos y fírmalo con el dedo o el ratón. Tarda un minuto.'}</p></div><button type="button" class="btn btn--primary btn--sm" data-ct-open="${esc(c.id)}">Leer y firmar</button></div>`;
  }
  async function mountCard(el){
    const gid = el.dataset.contrato; el.dataset.ctMounted = '1';
    if(mine[gid] !== undefined) el.innerHTML = cardHtml(mine[gid]);
    const c = await loadMine(gid);
    if(el.isConnected) el.innerHTML = cardHtml(c);
  }
  const repaintCards = gid => document.querySelectorAll(`[data-contrato="${gid}"]`).forEach(el => { el.innerHTML = cardHtml(mine[gid]); });

  /* ======================= ventana para leer y firmar ======================= */
  let modal = null;
  async function openSign(id){
    const row = Object.values(mine).find(x => x && String(x.id) === String(id));
    if(!row || row.estado !== 'pendiente') return;
    const { data: s } = await IB.sb.auth.getSession(); const u = s && s.session ? s.session.user : null;
    const c = await contexto(row), menor = row.tipo === 'menor';
    const meta = (u && u.user_metadata) || {};
    modal = document.createElement('div'); modal.className = 'ct-modal'; modal.setAttribute('role', 'dialog'); modal.setAttribute('aria-modal', 'true');
    const f = (k, label, type = 'text', val = '', extra = '') => `<label class="ct-f"><span>${label}</span><input data-k="${k}" type="${type}" value="${esc(val)}" ${extra} required></label>`;
    modal.innerHTML = `<div class="ct-in">
      <header class="ct-h"><div><small>${I.doc} Contrato de viaje</small><b>${esc(c.grupo || 'Tu viaje')}</b></div><button type="button" class="ct-x" data-ct-close aria-label="Cerrar">${I.x}</button></header>
      <div class="ct-body">
        <div class="ct-read">${texto(c)}</div>
        <form class="ct-form" novalidate>
          <h4>${menor ? 'Datos del viajero (menor de edad)' : 'Tus datos'}</h4>
          <div class="ct-grid">
            ${f('v.nombre', 'Nombre y apellidos', 'text', menor ? '' : (meta.nombre || ''))}
            ${f('v.dni', 'DNI o pasaporte')}
            ${f('v.nacimiento', 'Fecha de nacimiento', 'date')}
            ${f('v.domicilio', 'Domicilio')}
            ${menor ? '' : f('v.telefono', 'Teléfono', 'tel', meta.telefono || '')}
            ${menor ? '' : f('v.email', 'Correo', 'email', (u && u.email) || '')}
          </div>
          ${menor ? `<h4>Padre, madre o tutor legal (quien firma)</h4>
          <div class="ct-grid">
            ${f('t.nombre', 'Nombre y apellidos')}
            ${f('t.dni', 'DNI')}
            <label class="ct-f"><span>Relación con el menor</span><select data-k="t.relacion" required><option value="">Elige…</option><option>padre</option><option>madre</option><option>tutor/a legal</option></select></label>
            ${f('t.telefono', 'Teléfono móvil (WhatsApp)', 'tel', '', 'inputmode="tel" autocomplete="tel"')}
            ${f('t.email', 'Correo', 'email')}
          </div>` : ''}
          <div class="ct-sign"><div class="ct-sign-h"><b>${menor ? 'Firma del padre, madre o tutor' : 'Tu firma'}</b><button type="button" class="ct-clear" data-pad="0">Borrar</button></div><canvas data-pad-c="0"></canvas><span class="ct-sign-ph">Firma aquí con el dedo o el ratón</span></div>
          ${menor ? `<div class="ct-sign ct-sign--opt"><div class="ct-sign-h"><b>Firma del menor <small>(opcional)</small></b><button type="button" class="ct-clear" data-pad="1">Borrar</button></div><canvas data-pad-c="1"></canvas><span class="ct-sign-ph">Firma aquí</span></div>` : ''}
          <label class="ct-check"><input type="checkbox" data-k="acepto"><span>He leído y acepto el contrato${menor ? ', la autorización' : ''} y el formulario de información normalizada.</span></label>
          <p class="ct-err" role="alert"></p>
          <button type="submit" class="btn btn--primary ct-go">Firmar contrato</button>
        </form>
      </div></div>`;
    document.body.appendChild(modal); document.body.classList.add('al-lock');
    requestAnimationFrame(() => modal && modal.classList.add('is-in'));
    const pads = [...modal.querySelectorAll('[data-pad-c]')].map(pad);
    const form = modal.querySelector('.ct-form'), err = modal.querySelector('.ct-err');
    const read = () => { const d = { viajero: {}, tutor: {} }; form.querySelectorAll('[data-k]').forEach(i => { const [a, b] = i.dataset.k.split('.'); if(b) d[a === 'v' ? 'viajero' : 'tutor'][b] = i.value.trim(); }); if(!menor) delete d.tutor; return d; };
    const refresh = () => { const r = modal.querySelector('.ct-read'), y = r.scrollTop; r.innerHTML = texto(c, read()); r.scrollTop = y; };
    form.addEventListener('input', () => { err.textContent = ''; clearTimeout(form._t); form._t = setTimeout(refresh, 250); });
    modal.addEventListener('click', e => { const cl = e.target.closest('[data-pad]'); if(cl) pads[Number(cl.dataset.pad)].clear(); if(e.target.closest('[data-ct-close]') || e.target === modal) closeModal(); });
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const d = read();
      const miss = [...form.querySelectorAll('[required]')].find(i => !i.value.trim());
      if(miss){ err.textContent = 'Rellena todos los datos.'; miss.focus(); return; }
      const badTel = [...form.querySelectorAll('[type="tel"]')].find(i => String(i.value).replace(/\D/g, '').length < 9);
      if(badTel){ err.textContent = 'Revisa el teléfono: tiene que ser un número completo (por ejemplo, 612 345 678).'; badTel.focus(); return; }
      const age = edad(d.viajero.nacimiento);   // cuenta la edad al firmar, no la del viaje
      if(!menor && age != null && age < 18){ err.textContent = 'Todavía eres menor de edad, así que el contrato lo tiene que firmar tu padre, madre o tutor. Pide a Iberail por WhatsApp el contrato para menores.'; return; }
      if(!pads[0].has()){ err.textContent = 'Falta la firma.'; return; }
      if(!form.querySelector('[data-k="acepto"]').checked){ err.textContent = 'Marca la casilla de aceptación.'; return; }
      const go = form.querySelector('.ct-go'); go.disabled = true; go.textContent = 'Firmando…';
      const { data: fecha, error } = await IB.sb.rpc('firmar_contrato', { p_id: row.id, p_datos: d, p_firma: pads[0].png(), p_firma_menor: pads[1] && pads[1].has() ? pads[1].png() : null, p_contenido: c, p_ua: navigator.userAgent });
      if(error){ go.disabled = false; go.textContent = 'Firmar contrato'; err.textContent = 'No se ha podido firmar: ' + (error.message || 'inténtalo de nuevo'); return; }
      dispatchEvent(new CustomEvent('ib:contrato-firmado', { detail: { tipo: row.tipo } }));
      await loadMine(row.grupo_id); repaintCards(row.grupo_id);
      modal.querySelector('.ct-body').innerHTML = `<div class="ct-done"><span>${I.ok}</span><b>¡Contrato firmado!</b><p>Firmado el ${esc(fdt(fecha))}. Puedes verlo y descargarlo cuando quieras desde Mis grupos.</p><button type="button" class="btn btn--dark" data-ct-print="${esc(row.id)}">Ver o descargar</button></div>`;
    });
  }
  function closeModal(){ if(!modal) return; const m = modal; modal = null; m.classList.remove('is-in'); document.body.classList.remove('al-lock'); setTimeout(() => m.remove(), 250); }

  /* ======================= contrato firmado para imprimir / PDF ======================= */
  async function printContract(id){
    let row = Object.values(mine).find(x => x && String(x.id) === String(id));
    if(!row || !row.firma){ const { data } = await IB.sb.from('contratos').select('*').eq('id', Number(id)).maybeSingle(); row = data; }
    if(!row) return;
    const c = row.contenido || await contexto(row), d = row.datos || {}, menor = row.tipo === 'menor';
    const w = window.open('', '_blank');
    if(!w) return alert('Permite las ventanas emergentes para descargar el contrato.');
    const css = `body{font:14px/1.55 Arial,Helvetica,sans-serif;color:#1A1614;max-width:760px;margin:30px auto;padding:0 24px}
      .top{display:flex;align-items:center;gap:10px;border-bottom:3px solid #C43730;padding-bottom:12px;margin-bottom:10px}.top img{width:40px;height:40px;border-radius:9px}.top b{font-size:26px;font-weight:800;letter-spacing:-1px}.top b i{font-style:normal;color:#C43730}
      h3{font-size:14px;text-transform:uppercase;margin:18px 0 6px;border-bottom:1px solid #E5DAC6;padding-bottom:3px}h3 b{color:#C43730}.ct-kicker{font-size:22px;font-weight:800;margin:6px 0 0}.ct-sub{color:#6E5D50;margin:0 0 8px}
      table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border:1px solid #E5DAC6;padding:5px 8px;text-align:left;font-size:13px}th{background:#F7F0E3}.ct-small li{font-size:12px}.ct-pre{white-space:pre-line}.ct-gap{border-bottom:1px solid #999;display:inline-block;min-width:80px}
      .sig{display:flex;gap:24px;margin-top:22px;page-break-inside:avoid}.sig div{flex:1;border:1px solid #E5DAC6;border-radius:8px;padding:10px}.sig img{max-width:100%;height:90px;object-fit:contain}.sig small{color:#6E5D50;display:block}
      .stamp{margin-top:14px;font-size:12px;color:#6E5D50;border-top:1px dashed #E5DAC6;padding-top:8px}@media print{body{margin:0}}`;
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Contrato ${esc(c.grupo || '')} · ${esc((d.viajero || {}).nombre || '')}</title><style>${css}</style></head><body>
      <div class="top"><img src="${location.origin}/assets/img/logo.png" alt=""><b>ibe<i>rail</i></b></div>
      ${texto(c, d)}
      <div class="sig">
        <div><small>Por Iberail</small><b>IBERAIL</b><small>NIF ${AGENCIA.nif}</small></div>
        <div><small>${menor ? 'Padre, madre o tutor' : 'El Viajero'}</small>${row.firma ? `<img src="${row.firma}" alt="Firma">` : ''}<b>${esc(menor ? (d.tutor || {}).nombre || '' : (d.viajero || {}).nombre || '')}</b><small>DNI ${esc(menor ? (d.tutor || {}).dni || '' : (d.viajero || {}).dni || '')}</small></div>
        ${menor && row.firma_menor ? `<div><small>El menor</small><img src="${row.firma_menor}" alt="Firma del menor"><b>${esc((d.viajero || {}).nombre || '')}</b></div>` : ''}
      </div>
      <p class="stamp">${row.firmado_at ? `Firmado electrónicamente en iberail.com el ${esc(fdt(row.firmado_at))} desde la cuenta de ${esc(((d.viajero || {}).email) || 'el viajero')}. Versión del contrato ${esc(c.version || VERSION)}. Id. ${esc(row.id)}.` : 'Pendiente de firma.'}</p>
      <script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>`);
    w.document.close();
  }

  /* ======================= panel: enviar y seguir contratos ======================= */
  const adm = {};   // grupo → { miembros, contratos, nombres, abierto }
  const condKey = gid => 'ib-contrato-cond-' + gid;
  const getCond = gid => { let v = {}; try{ v = JSON.parse(localStorage.getItem(condKey(gid)) || localStorage.getItem('ib-contrato-cond') || '{}'); }catch(e){} return { ...COND_DEF, ...v }; };
  const setCond = (gid, v) => { try{ localStorage.setItem(condKey(gid), JSON.stringify(v)); const { calendario, seguro, seguro_precio, inc_ida, inc_vuelta, inc_maleta, inc_pase, inc_aloj, inc_otros, ...comun } = v; localStorage.setItem('ib-contrato-cond', JSON.stringify(comun)); }catch(e){} };
  async function loadAdm(gid){
    const [m, c, cl] = await Promise.all([
      IB.sb.from('grupo_miembros').select('user_id').eq('grupo_id', Number(gid)),
      IB.sb.from('contratos').select('id, user_id, tipo, estado, enviado_at, firmado_at, datos').eq('grupo_id', Number(gid)).neq('estado', 'anulado'),
      IB.sb.rpc('buscar_clientes', { q: '' })
    ]);
    const nombres = {}; (cl.data || []).forEach(x => nombres[x.id] = x);
    adm[gid] = { ...(adm[gid] || {}), miembros: (m.data || []).map(x => x.user_id), contratos: c.data || [], nombres, err: c.error ? c.error.message : '' };
  }
  function admHtml(gid){
    const a = adm[gid]; if(!a) return '';
    const head = `<div class="adm-docs-head"><h3>${I.doc}Contratos</h3><small>${a.contratos.filter(x => x.estado === 'firmado').length} de ${a.miembros.length} firmados</small></div>`;
    if(a.err) return head + `<p class="adm-docs-empty is-err">Falta crear la tabla: ejecuta <b>supabase/sql/contratos.sql</b> en Supabase.</p>`;
    const cd = getCond(gid);
    const who = uid => { const c = a.nombres[uid]; return c ? (c.nombre || String(c.email || '').split('@')[0]) : 'Viajero'; };
    const rows = a.miembros.map(uid => {
      const k = a.contratos.find(x => x.user_id === uid);
      const st = !k ? `<select class="ct-tipo" data-ct-tipo="${esc(uid)}"><option value="adulto">Mayor de edad</option><option value="menor">Menor de edad</option></select><button type="button" class="btn btn--dark btn--sm" data-ct-send="${esc(gid)}:${esc(uid)}">Enviar</button>`
        : k.estado === 'firmado' ? `<span class="ct-st is-ok">${I.ok}Firmado ${esc(new Date(k.firmado_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }))}</span><button type="button" class="btn btn--ghost btn--sm" data-ct-print="${esc(k.id)}">PDF</button>`
        : `<span class="ct-st">Pendiente · ${k.tipo === 'menor' ? 'menor' : 'mayor'}</span><button type="button" class="ct-link" data-ct-void="${esc(gid)}:${esc(k.id)}" title="Anular para volver a enviarlo (por ejemplo, con otro tipo)">Anular</button>`;
      const tu = k && k.tipo === 'menor' && k.datos && k.datos.tutor;
      const tut = tu && tu.telefono ? `<div class="ct-tutor">${I.phone}<span><b>${esc(tu.nombre || 'Tutor')}</b> (${esc(tu.relacion || 'tutor')}) · ${esc(tu.telefono)}</span><a class="ct-wa" href="${esc(waLink(tu.telefono))}" target="_blank" rel="noopener">WhatsApp</a></div>` : '';
      return `<div class="ct-row"><div><b>${esc(who(uid))}</b><small>${esc((a.nombres[uid] || {}).email || '')}</small></div><div class="ct-acts">${st}</div>${tut}</div>`;
    }).join('');
    const faltan = a.miembros.filter(uid => !a.contratos.some(x => x.user_id === uid)).length;
    const tels = tutores(a);
    return head + `
      <div class="ct-inc" data-ct-cond="${esc(gid)}">
        <b>¿Qué incluye este grupo?</b>
        <div class="ct-inc-opts">${INCLUYE.map(([k, t]) => `<label class="ct-chk"><input type="checkbox" data-c="${k}"${inc(cd, k) ? ' checked' : ''}><span>${esc(t)}</span></label>`).join('')}</div>
        <small>Así sale en el contrato de todos los del grupo. La asistencia 24 h va siempre.</small>
      </div>
      <details class="ct-cond"${a.abierto ? ' open' : ''}><summary>Más condiciones <small>(cancelación, seguro, calendario de pagos…)</small></summary>
        <div class="ct-cond-grid" data-ct-cond="${esc(gid)}">
          <label>Gastos de gestión si cancelan (€)<input data-c="gastos" type="number" min="0" value="${esc(cd.gastos)}"></label>
          <label>Tipo de pase Interrail<input data-c="pase" value="${esc(cd.pase)}"></label>
          <label>Buses / ferris (texto)<input data-c="otros" value="${esc(cd.otros)}"></label>
          <label>Seguro de viaje (vacío = no incluido)<input data-c="seguro" value="${esc(cd.seguro)}" placeholder="Ej.: Intermundial, asistencia médica, repatriación y equipaje"></label>
          <label>Precio del seguro por persona (€)<input data-c="seguro_precio" inputmode="decimal" value="${esc(cd.seguro_precio)}" placeholder="35,47"></label>
          <label class="ct-wide">Calendario de pagos<textarea data-c="calendario" rows="3" placeholder="1.º En 7 días: 280 €&#10;2.º Antes del 31 de octubre: 470 €&#10;3.º Antes del 30 de noviembre: el total">${esc(cd.calendario)}</textarea></label>
        </div>
        <p class="adm-hint">El precio, la ruta y los alojamientos se cogen solos del grupo.</p>
      </details>
      ${a.miembros.length ? `<div class="ct-list">${rows}</div>` : '<p class="adm-docs-empty">Añade primero a los viajeros al grupo.</p>'}
      ${tels.length ? `<button type="button" class="btn btn--ghost btn--sm" data-ct-copytel="${esc(gid)}">Copiar teléfonos de los padres (${tels.length})</button>` : ''}
      ${faltan > 1 ? `<button type="button" class="btn btn--ghost btn--sm" data-ct-sendall="${esc(gid)}">Enviar a los ${faltan} que faltan (con el tipo elegido)</button>` : ''}
      <p class="ct-msg" data-ct-msg="${esc(gid)}"></p>`;
  }
  const waLink = tel => { let n = String(tel).replace(/\D/g, '').replace(/^00/, ''); if(n.length === 9) n = '34' + n; return 'https://wa.me/' + n; };
  const tutores = a => a.contratos.filter(k => k.tipo === 'menor' && k.datos && k.datos.tutor && k.datos.tutor.telefono).map(k => ({ ...k.datos.tutor, menor: (k.datos.viajero || {}).nombre || '' }));
  const paintAdm = gid => document.querySelectorAll(`[data-contratos-admin="${gid}"]`).forEach(el => { el.innerHTML = admHtml(gid); });
  async function mountAdm(el){
    const gid = el.dataset.contratosAdmin; el.dataset.ctMounted = '1';
    if(adm[gid]) el.innerHTML = admHtml(gid);
    await loadAdm(gid); if(el.isConnected) el.innerHTML = admHtml(gid);
  }
  async function send(gid, list){
    const cond = getCond(gid), msg = document.querySelector(`[data-ct-msg="${gid}"]`);
    let ok = 0, err = '';
    for(const [uid, tipo] of list){
      const { error } = await IB.sb.from('contratos').insert({ grupo_id: Number(gid), user_id: uid, tipo, condiciones: cond });
      if(error){ err = error.message; continue; }
      ok++;
      await IB.sb.from('avisos').insert({ titulo: 'Tienes el contrato del viaje listo para firmar', cuerpo: tipo === 'menor' ? 'Entra en Mis grupos y pulsa «Leer y firmar». Como eres menor de edad, tiene que firmarlo tu padre, madre o tutor.' : 'Entra en Mis grupos y pulsa «Leer y firmar». Tarda un minuto.', importante: true, para_todos: false, user_id: uid }).then(() => {}, () => {});
    }
    await loadAdm(gid); paintAdm(gid);
    const m2 = document.querySelector(`[data-ct-msg="${gid}"]`);
    if(m2) m2.textContent = err ? `Enviados ${ok}. Error: ${err}` : `Contrato enviado a ${ok} ${ok === 1 ? 'persona' : 'personas'}. Les ha llegado el aviso.`;
  }

  /* ======================= eventos ======================= */
  document.addEventListener('click', async e => {
    const t = e.target;
    const op = t.closest('[data-ct-open]'); if(op) return openSign(op.dataset.ctOpen);
    const pr = t.closest('[data-ct-print]'); if(pr) return printContract(pr.dataset.ctPrint);
    const sd = t.closest('[data-ct-send]'); if(sd){ const [gid, uid] = sd.dataset.ctSend.split(':'); const sel = document.querySelector(`[data-ct-tipo="${uid}"]`);
      if(!confirmInc(gid, 1)) return; sd.disabled = true; return send(gid, [[uid, sel ? sel.value : 'adulto']]); }
    const sa = t.closest('[data-ct-sendall]'); if(sa){ const gid = sa.dataset.ctSendall, a = adm[gid]; if(!a) return;
      const list = a.miembros.filter(uid => !a.contratos.some(x => x.user_id === uid)).map(uid => [uid, (document.querySelector(`[data-ct-tipo="${uid}"]`) || {}).value || 'adulto']);
      if(!confirmInc(gid, list.length)) return; sa.disabled = true; return send(gid, list); }
    const ct = t.closest('[data-ct-copytel]'); if(ct){ const a = adm[ct.dataset.ctCopytel]; if(!a) return;
      const txt = tutores(a).map(x => `${x.nombre} (${x.relacion} de ${x.menor}): ${x.telefono}`).join('\n');
      try{ await navigator.clipboard.writeText(txt); ct.textContent = '¡Copiados!'; }catch(e){ prompt('Copia los teléfonos:', txt); } return; }
    const vd = t.closest('[data-ct-void]'); if(vd){ const [gid, id] = vd.dataset.ctVoid.split(':'); if(!confirm('¿Anular este contrato pendiente? Luego podrás enviarlo otra vez.')) return;
      await IB.sb.from('contratos').update({ estado: 'anulado' }).eq('id', Number(id)).eq('estado', 'pendiente'); await loadAdm(gid); paintAdm(gid); }
  });
  const confirmInc = (gid, n) => confirm(`¿Enviar el contrato a ${n === 1 ? '1 persona' : n + ' personas'}?\n\nEl contrato dirá que el viaje incluye:\n• ${resumen(getCond(gid)).join('\n• ')}\n\nSi algo no está bien, cancela y cámbialo en «¿Qué incluye este grupo?».`);
  document.addEventListener('input', e => {
    const box = e.target.closest && e.target.closest('[data-ct-cond]'); if(!box) return;
    const gid = box.dataset.ctCond, v = getCond(gid); v[e.target.dataset.c] = e.target.type === 'checkbox' ? e.target.checked : e.target.value; setCond(gid, v);
    if(adm[gid]) adm[gid].abierto = true;
  });
  document.addEventListener('keydown', e => { if(modal && e.key === 'Escape') closeModal(); });

  const scan = () => {
    document.querySelectorAll('[data-contrato]:not([data-ct-mounted])').forEach(mountCard);
    document.querySelectorAll('[data-contratos-admin]:not([data-ct-mounted])').forEach(mountAdm);
  };
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  scan();

  /* ======================= panel: pestaña «Contratos» (todos los grupos) ======================= */
  const V = { rows: [], grupos: {}, nombres: {}, grupo: '', estado: '', q: '', err: '' };
  async function loadAll(){
    const [c, g, cl] = await Promise.all([
      IB.sb.from('contratos').select('id, grupo_id, user_id, tipo, estado, enviado_at, firmado_at, datos').neq('estado', 'anulado').order('enviado_at', { ascending: false }).limit(2000),
      IB.sb.from('grupos').select('id, nombre'),
      IB.sb.rpc('buscar_clientes', { q: '' })
    ]);
    V.err = c.error ? c.error.message : '';
    V.rows = c.data || [];
    V.grupos = {}; (g.data || []).forEach(x => V.grupos[x.id] = x.nombre);
    V.nombres = {}; (cl.data || []).forEach(x => V.nombres[x.id] = x);
  }
  function paintAll(){
    const root = document.getElementById('conView'); if(!root) return;
    if(V.err){ root.innerHTML = `<div class="adm-empty"><b>Falta crear la tabla de contratos.</b><span>${esc(V.err)} · Ejecuta <b>supabase/sql/contratos.sql</b> en Supabase.</span></div>`; return; }
    const who = r => { const d = r.datos || {}, v = d.viajero || {}, c = V.nombres[r.user_id] || {}; return v.nombre || c.nombre || String(c.email || '').split('@')[0] || 'Viajero'; };
    const q = V.q.toLowerCase();
    const rows = V.rows.filter(r => (!V.grupo || String(r.grupo_id) === V.grupo) && (!V.estado || r.estado === V.estado)
      && (!q || [who(r), (V.nombres[r.user_id] || {}).email, V.grupos[r.grupo_id], ((r.datos || {}).tutor || {}).nombre].join(' ').toLowerCase().includes(q)));
    const n = { total: V.rows.length, ok: V.rows.filter(r => r.estado === 'firmado').length };
    const gids = [...new Set(V.rows.map(r => String(r.grupo_id)))].sort((a, b) => String(V.grupos[a] || '').localeCompare(String(V.grupos[b] || '')));
    const byG = {}; rows.forEach(r => (byG[r.grupo_id] = byG[r.grupo_id] || []).push(r));
    const fecha = iso => iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
    const item = r => {
      const d = r.datos || {}, tu = r.tipo === 'menor' ? d.tutor : null;
      return `<div class="ct-row">
        <div><b>${esc(who(r))}</b><small>${esc((V.nombres[r.user_id] || {}).email || '')}${d.viajero && d.viajero.dni ? ` · DNI ${esc(d.viajero.dni)}` : ''}</small></div>
        <div class="ct-acts"><span class="ct-kind">${r.tipo === 'menor' ? 'Menor' : 'Mayor'}</span>${r.estado === 'firmado'
          ? `<span class="ct-st is-ok">${I.ok}Firmado ${esc(fecha(r.firmado_at))}</span><button type="button" class="btn btn--ghost btn--sm" data-ct-print="${esc(r.id)}">PDF</button>`
          : `<span class="ct-st">Pendiente · enviado ${esc(fecha(r.enviado_at))}</span>`}</div>
        ${tu && tu.telefono ? `<div class="ct-tutor">${I.phone}<span><b>${esc(tu.nombre || 'Tutor')}</b> (${esc(tu.relacion || 'tutor')}) · ${esc(tu.telefono)}</span><a class="ct-wa" href="${esc(waLink(tu.telefono))}" target="_blank" rel="noopener">WhatsApp</a></div>` : ''}
      </div>`;
    };
    root.innerHTML = `
      <div class="lv-stats ct-stats">
        <div class="lv-stat"><b>${n.total}</b><small>contratos enviados</small></div>
        <div class="lv-stat"><b>${n.ok}</b><small>firmados</small></div>
        <div class="lv-stat"><b>${n.total - n.ok}</b><small>pendientes de firma</small></div>
        <div class="lv-stat"><b>${gids.length}</b><small>grupos</small></div>
      </div>
      <div class="ct-filters">
        <input type="search" data-ctf="q" placeholder="Buscar viajero, tutor o grupo…" value="${esc(V.q)}">
        <select data-ctf="grupo"><option value="">Todos los grupos</option>${gids.map(g => `<option value="${esc(g)}"${g === V.grupo ? ' selected' : ''}>${esc(V.grupos[g] || 'Grupo ' + g)}</option>`).join('')}</select>
        <select data-ctf="estado"><option value="">Firmados y pendientes</option><option value="firmado"${V.estado === 'firmado' ? ' selected' : ''}>Solo firmados</option><option value="pendiente"${V.estado === 'pendiente' ? ' selected' : ''}>Solo pendientes</option></select>
        <button type="button" class="btn btn--ghost btn--sm" data-ctf-reload>Actualizar</button>
      </div>
      ${Object.keys(byG).length ? Object.keys(byG).sort((a, b) => String(V.grupos[a] || '').localeCompare(String(V.grupos[b] || ''))).map(g => {
        const list = byG[g], ok = V.rows.filter(r => String(r.grupo_id) === String(g) && r.estado === 'firmado').length, tot = V.rows.filter(r => String(r.grupo_id) === String(g)).length;
        return `<section class="lv-card ct-group"><div class="ct-group-h"><h3>${esc(V.grupos[g] || 'Grupo ' + g)}</h3><small>${ok} de ${tot} firmados</small></div><div class="ct-list">${list.map(item).join('')}</div></section>`;
      }).join('') : `<p class="lv-empty">${V.rows.length ? 'No hay contratos con esos filtros.' : 'Todavía no has enviado ningún contrato. Se envían desde cada grupo (pestaña Grupos → Contratos).'}</p>`}`;
  }
  document.addEventListener('input', e => { const f = e.target.closest && e.target.closest('#conView [data-ctf]'); if(!f) return; V[f.dataset.ctf] = f.value;
    if(f.dataset.ctf === 'q'){ clearTimeout(V._t); V._t = setTimeout(() => { paintAll(); const i = document.querySelector('#conView [data-ctf="q"]'); if(i){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 200); } else paintAll(); });
  document.addEventListener('click', async e => { if(e.target.closest('#conView [data-ctf-reload]')){ await loadAll(); paintAll(); } });
  async function showAll(){
    const root = document.getElementById('conView'); if(!root) return;
    if(!V.rows.length && !V.err) root.innerHTML = '<div class="auth-spin"></div>';
    await loadAll(); paintAll();
  }
  window.IBContratos = { texto, contexto, printContract, show: showAll };
})();
