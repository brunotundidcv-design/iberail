/* Iberail — panel: pestaña «Contratos» (archivo, solo consulta)
   Los contratos que se firmaron en la web mientras la firma estaba activa (hasta la v9.1, 07/10/2026; desde entonces
   los contratos van por correo). Siguen guardados en la tabla «contratos» de Supabase con los datos, la fecha y la firma.
   Aquí se ven todos, por grupo, con filtros, teléfonos de padres/tutores, «PDF» (el contrato firmado, con la firma, listo
   para imprimir o guardar) y «Exportar CSV». No envía ni cambia contratos.
   El texto del contrato es el mismo código que había al firmar (sacado de assets/contratos.js antes de la v9.1); los datos
   del viaje salen de «contenido», la foto que se guardó al firmar. SQL: supabase/sql/contratos.sql (ya ejecutado entonces). */
(function(){
  const IB = window.IB;
  if(!IB) return;
  const esc = IB.esc;
  const VERSION = '2026-10';   // los contratos firmados guardan su versión: el texto nuevo solo sale en los de '2026-10' en adelante
  const AGENCIA = { nombre: 'Iberail', nif: '54214649S', domicilio: 'Avenida Lazarejo 50, 28232 Las Rozas de Madrid (Madrid)', tel: '+34 683 55 76 26', email: 'info@iberail.com', web: 'iberail.com',
    // RELLENAR en cuanto lleguen (mientras estén vacíos, no salen en el contrato):
    cicma: '',                                         // código de agencia, p. ej. 'CICMA 1234'
    garantia: { entidad: '', poliza: '', contacto: '' } // garantía frente a la insolvencia: aseguradora o banco, n.º de póliza, teléfono o correo
  };
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
      IB.sb.from('grupos').select('id, nombre, marca').eq('id', gid).maybeSingle().then(x => x.error ? IB.sb.from('grupos').select('id, nombre').eq('id', gid).maybeSingle() : x),
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
    return { version: VERSION, grupo: (g.data || {}).nombre || '', ref: ruta.ref || '', salida: ruta.salida || '', inicio, fin, dias: ruta.dias || '', viajeros: ruta.viajeros || '', precio: Number((m.data || {}).importe || 0), paradas, cond: { ...COND_DEF, ...(row.condiciones || {}) }, tipo: row.tipo, marca: (g.data || {}).marca || (row.condiciones || {}).marca || '' };
  }

  /* ======================= lo incluido según el menú del grupo ======================= */
  function vuelosTxt(cd){
    if(cd.inc_ida === undefined && cd.vuelos) return cd.vuelos;   // contratos de antes del menú
    const ida = inc(cd, 'inc_ida'), vta = inc(cd, 'inc_vuelta');
    if(!ida && !vta) return '';
    const t = ida && vta ? 'Vuelos de ida y vuelta desde España' : ida ? 'Vuelo de ida desde España (el de vuelta no está incluido)' : 'Vuelo de vuelta a España (el de ida no está incluido)';
    return t + (inc(cd, 'inc_maleta') ? ', con equipaje de mano y maleta facturada de 23 kg' : ', con equipaje de mano (sin maleta facturada)');
  }
  function noIncl(cd, B){
    if(cd.inc_ida === undefined) return '';
    const ida = inc(cd, 'inc_ida'), vta = inc(cd, 'inc_vuelta'), l = [];
    if(!ida && !vta) l.push('vuelos'); else if(!ida) l.push('vuelo de ida'); else if(!vta) l.push('vuelo de vuelta');
    if((ida || vta) && !inc(cd, 'inc_maleta')) l.push('maleta facturada');
    if(!inc(cd, 'inc_pase')) l.push((B || IB.brand).paseNo);
    if(!inc(cd, 'inc_aloj')) l.push('alojamiento');
    return l.length ? `<b>${esc(l.join(', '))}</b>, ` : '';
  }
  const incluye = B => INCLUYE.map(([k, t]) => [k, k === 'inc_pase' ? B.pase : t]);
  const resumen = (cd, B) => incluye(B || IB.brand).filter(([k]) => inc(cd, k) && !(k === 'inc_maleta' && !inc(cd, 'inc_ida') && !inc(cd, 'inc_vuelta'))).map(([, t]) => t).concat(cd.seguro ? ['Seguro de viaje'] : [], ['Asistencia 24 h']);

  /* ======================= el texto del contrato ======================= */
  function texto(c, d){
    d = d || {}; const v = d.viajero || {}, tu = d.tutor || {}, cd = c.cond, menor = c.tipo === 'menor';
    const B = IB.brandOf(c.marca || (cd || {}).marca), N = B.nombre;   // la marca del grupo (Iberail / Zarping)
    const S = (n, t) => `<h3><b>${n}.</b> ${t}</h3>`;
    const v10 = String(c.version || '') >= '2026-10', G = AGENCIA.garantia;
    return `
    <div class="ct-doc">
      <p class="ct-kicker">Contrato de viaje combinado</p>
      <p class="ct-sub">Grupo <b>${hueco(c.grupo)}</b>${c.ref ? ` · Ref. ${esc(c.ref)}` : ''}</p>
      ${S(1, 'Las partes')}
      <p><b>De una parte, ${B.up}</b>, con NIF ${AGENCIA.nif} y domicilio en ${esc(AGENCIA.domicilio)}. Teléfono y WhatsApp: ${AGENCIA.tel}. Correo: ${B.email}. Web: ${B.web}${v10 && AGENCIA.cicma ? `. Agencia de viajes con código ${esc(AGENCIA.cicma)}` : ''} (en adelante, «${N}»).</p>
      <p><b>Y de otra parte, el/la viajero/a:</b> ${hueco(v.nombre, 24)}, con DNI/pasaporte ${hueco(v.dni)}, nacido/a el ${hueco(v.nacimiento ? fd(v.nacimiento) : '')}, con domicilio en ${hueco(v.domicilio, 24)}${menor ? '' : `, teléfono ${hueco(v.telefono)} y correo ${hueco(v.email)}`}.</p>
      ${menor ? `<p><b>Al ser menor de edad, contrata en su nombre su representante legal:</b> ${hueco(tu.nombre, 24)}, con DNI ${hueco(tu.dni)}, en calidad de ${hueco(tu.relacion)}, teléfono ${hueco(tu.telefono)} y correo ${hueco(tu.email)}.</p>` : ''}
      ${S(2, 'Objeto del contrato')}
      <p>${N} organiza y el Viajero contrata ${B.objeto} dentro del grupo indicado, con las características de este contrato y de la ficha del grupo en ${B.web} («Mis grupos»), que forma parte de él.</p>
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
        ${inc(cd, 'inc_pase') ? `<li><b>${esc(B.pase)}:</b> ${esc(cd.pase || B.paseDef)}.</li>` : ''}
        ${inc(cd, 'inc_aloj') ? '<li><b>Alojamiento</b> en apartamentos (Airbnb u otras plataformas) en las ciudades y fechas indicadas, compartidos por los miembros del grupo.</li>' : ''}
        ${inc(cd, 'inc_otros') && cd.otros ? `<li><b>Otros:</b> ${esc(cd.otros)}.</li>` : ''}
        ${cd.seguro ? `<li><b>Seguro de viaje:</b> ${esc(cd.seguro)}${cd.seguro_precio ? ` (${esc(eur(String(cd.seguro_precio).replace(',', '.')))} por persona, incluido en el precio total)` : ''}. Lo presta la aseguradora, que es quien cubre los siniestros según las condiciones de la póliza; ${N} lo gestiona y entrega al Viajero el certificado del seguro.</li>` : ''}
        <li><b>Asistencia ${N} 24 h</b> por WhatsApp durante todo el viaje para ayudar a gestionar incidencias (reclamaciones, cambios de billetes, contacto con los anfitriones, orientación médica o por pérdida de documentación). Es un servicio de ayuda y gestión, no un seguro, y no incluye el pago de los gastos que se deriven de esas incidencias.</li>
        <li>Acceso a la ficha del grupo en ${B.web} con ${B.ruta === 'ruta' ? 'la ruta' : 'el plan del viaje'}, los alojamientos, los billetes, los avisos y el estado de los pagos.</li>
      </ul>
      <p><b>No incluido:</b> ${noIncl(cd, B)}${B.key === 'iberail' ? 'entradas a festivales o eventos (incluido el Ultra Europe), comidas y bebidas, transporte urbano, reservas de asiento o suplementos de trenes no indicados' : 'entradas a festivales, eventos o actividades no indicadas, comidas y bebidas, transporte urbano'}, tasas turísticas que se cobren en destino, ${cd.seguro ? 'fianzas de los alojamientos y' : 'fianzas de los alojamientos, seguro de viaje y'} cualquier servicio no mencionado en este apartado.</p>
      ${S(4, 'Precio y pagos')}
      <p><b>Precio total por persona: ${c.precio ? esc(eur(c.precio)) : hueco('')}</b>, impuestos incluidos (régimen especial de las agencias de viajes). El precio es cerrado y no se revisará al alza.</p>
      ${cd.calendario ? `<p><b>Calendario de pagos:</b></p><p class="ct-pre">${esc(cd.calendario)}</p>` : ''}
      <p>Los pagos pueden hacerse con tarjeta desde ${B.web} («Mis grupos»), por transferencia o por Bizum, y quedan reflejados en la ficha del grupo. Si un pago no se abona en su plazo, ${N} podrá requerirlo y, si no se atiende en 7 días, considerar el contrato resuelto por desistimiento del Viajero, con las consecuencias del apartado 5.</p>
      ${S(5, 'Cancelación por el Viajero')}
      <p>El Viajero puede cancelar en cualquier momento antes de la salida, comunicándolo por escrito (correo o WhatsApp). ${N} le devolverá lo pagado descontando (a) los importes de los servicios ya contratados que no sean reembolsables (vuelos, pases o alojamientos ya pagados), que se justificarán si lo pide, y (b) unos gastos de gestión de ${cd.gastos ? esc(eur(cd.gastos)) : hueco('', 8)} por persona. Si en el destino concurren circunstancias inevitables y extraordinarias que afecten significativamente al viaje, podrá cancelar sin penalización y recuperar todo lo pagado. La devolución se hará en un máximo de 14 días.</p>
      ${S(6, 'Cesión')}
      <p>El Viajero puede ceder su plaza a otra persona que cumpla las condiciones del viaje avisando con al menos 7 días naturales de antelación. Ambos responden del pago pendiente y de los gastos del cambio, que ${N} comunicará antes.</p>
      ${S(7, 'Cambios y cancelación por ' + N)}
      <p>${N} solo podrá hacer cambios poco significativos antes de la salida (por ejemplo, un alojamiento por otro de características y ubicación similares), avisando al Viajero. Si tuviera que modificar significativamente algún elemento principal o cancelar el viaje, el Viajero podrá aceptar el cambio o resolver el contrato y recuperar todo lo pagado sin penalización.</p>
      ${S(8, 'Durante el viaje')}
      <p>${N} responde de la correcta ejecución de los servicios incluidos. Si alguno no se presta como se ha contratado, el Viajero debe comunicarlo cuanto antes por WhatsApp para que pueda solucionarse. El Viajero se compromete a respetar las normas de los alojamientos y transportes; los daños que cause serán de su cuenta.</p>
      ${S(9, 'Documentación')}
      <p>Cada Viajero debe llevar su DNI o pasaporte en vigor. Se recomienda la Tarjeta Sanitaria Europea (gratuita)${cd.seguro ? '' : ' y un seguro de viaje'}. Los menores que viajen sin sus padres deben llevar además la autorización de viaje al extranjero, que se tramita en la Policía Nacional o la Guardia Civil.${v10 ? ` Los ciudadanos españoles pueden viajar por la Unión Europea y el espacio Schengen con el DNI; para los países de fuera que incluya el viaje, ${N} informará de los requisitos de entrada, que pueden consultarse también en las recomendaciones de viaje del Ministerio de Asuntos Exteriores. Si el Viajero no tiene nacionalidad española, debe indicarlo antes de firmar.` : ''}</p>
      ${v10 ? `<p><b>Movilidad reducida:</b> con carácter general, el viaje no está adaptado a personas con movilidad reducida (alojamientos sin ascensor, trasbordos con equipaje, trenes con escalones). Si es su caso, el Viajero debe indicarlo antes de firmar para que ${N} le confirme si el viaje es adecuado.</p>` : ''}
      ${S(10, 'Información previa y datos personales')}
      <p>El Viajero declara haber recibido antes de firmar el formulario de información normalizada que figura al final de este contrato${v10 ? ` y las condiciones generales de contratación publicadas en ${B.web}, que completan este contrato (si hay diferencias, prevalece este contrato)` : ''}. Sus datos se tratarán conforme a la política de privacidad de ${B.web} para organizar y gestionar el viaje.</p>
      ${S(11, 'Reclamaciones y ley aplicable')}
      <p>Las reclamaciones pueden dirigirse a ${B.email} o por WhatsApp al ${AGENCIA.tel}; ${N} responderá en un máximo de un mes. El Viajero dispone también de hojas de reclamaciones. Este contrato se rige por la legislación española, en particular el Libro IV del Real Decreto Legislativo 1/2007, y son competentes los juzgados del domicilio del Viajero.</p>
      ${menor ? `${S(12, 'Autorización del padre, madre o tutor')}
      <p>Yo, ${hueco(tu.nombre, 24)}, con DNI ${hueco(tu.dni)}, como ${hueco(tu.relacion)} de ${hueco(v.nombre, 24)}, <b>autorizo</b> a que realice este viaje con el grupo «${hueco(c.grupo)}» en las fechas indicadas, a que se aloje con el resto del grupo en los alojamientos contratados y a desplazarse con él en los transportes incluidos, y asumo en su nombre las obligaciones de este contrato. Me comprometo a tramitar la autorización oficial de viaje al extranjero en la Policía Nacional o la Guardia Civil.</p>` : ''}
      <h3 class="ct-annex">Anexo · Formulario de información normalizada</h3>
      <p>La combinación de servicios de viaje que se le ofrece es un viaje combinado en el sentido de la Directiva (UE) 2015/2302, por lo que se beneficiará de todos los derechos de la UE que se aplican a los viajes combinados. ${N} será plenamente responsable de la correcta ejecución del viaje combinado en su conjunto.</p>
      <ul class="ct-small">
        <li>Recibirá toda la información esencial sobre el viaje combinado antes de celebrar el contrato.</li>
        <li>Siempre habrá como mínimo un empresario responsable de la correcta ejecución de todos los servicios de viaje incluidos en el contrato.</li>
        <li>Tendrá un número de teléfono de emergencia o un punto de contacto con ${N}.</li>
        <li>Podrá ceder el viaje combinado a otra persona, con un preaviso razonable y, en su caso, con costes adicionales.</li>
        <li>El precio solo podrá aumentarse si se producen gastos específicos previstos en el contrato y, en todo caso, a más tardar veinte días antes del inicio del viaje; si el aumento excede del 8 %, podrá poner fin al contrato. En este contrato el precio es cerrado.</li>
        <li>Podrá poner fin al contrato sin penalización y con reembolso completo si se modifica significativamente alguno de los elementos esenciales, salvo el precio. Si ${N} cancela antes del inicio, tendrá derecho al reembolso y, cuando proceda, a una indemnización.</li>
        <li>En circunstancias excepcionales, como graves problemas de seguridad en el destino, podrá poner fin al contrato sin penalización antes del inicio del viaje.</li>
        <li>Podrá poner fin al contrato en cualquier momento antes del inicio del viaje mediante el pago de una penalización adecuada y justificable.</li>
        <li>Si, tras el inicio del viaje, no pueden prestarse elementos significativos, deberán ofrecerse alternativas adecuadas sin coste adicional; podrá poner fin al contrato sin penalización si los servicios no se ejecutan conforme al contrato, esto afecta sustancialmente al viaje y Iberail no lo soluciona.</li>
        <li>Tendrá derecho a una reducción del precio o a una indemnización por daños y perjuicios en caso de no ejecución o ejecución incorrecta de los servicios.</li>
        <li>${N} deberá proporcionar asistencia si se encuentra en dificultades.</li>
        ${v10 && G.entidad ? `<li>Si ${N} incurre en insolvencia, se procederá al reembolso de los pagos. Si incurre en insolvencia después del inicio del viaje combinado y este incluye el transporte, se garantiza la repatriación de los viajeros.</li>` : ''}
      </ul>
      ${v10 && G.entidad ? `<p class="ct-small">${N} ha suscrito una protección frente a la insolvencia con ${esc(G.entidad)}${G.poliza ? ` (póliza n.º ${esc(G.poliza)})` : ''}. Si se deniegan servicios debido a la insolvencia de ${N}, los viajeros podrán ponerse en contacto con dicha entidad${G.contacto ? ` en ${esc(G.contacto)}` : ''}.</p>` : ''}
      ${v10 ? '<p class="ct-small">Normativa aplicable: Directiva (UE) 2015/2302, transpuesta al Derecho español en el Libro IV del Real Decreto Legislativo 1/2007 (boe.es/eli/es/rdlg/2007/11/16/1/con).</p>' : ''}
    </div>`;
  }

  /* ======================= contrato firmado para imprimir / PDF ======================= */
  const waLink = tel => { let n = String(tel).replace(/\D/g, '').replace(/^00/, ''); if(n.length === 9) n = '34' + n; return 'https://wa.me/' + n; };
  async function printContract(id){
    const w = window.open('', '_blank');   // se abre ya (si no, el navegador la bloquea al esperar a Supabase)
    if(!w) return alert('Permite las ventanas emergentes para ver el contrato.');
    w.document.write('<p style="font:16px Arial;padding:30px">Cargando el contrato…</p>');
    const { data: row, error } = await IB.sb.from('contratos').select('*').eq('id', Number(id)).maybeSingle();
    if(error || !row){ w.close(); return alert('No se ha podido abrir el contrato' + (error ? ': ' + error.message : '.')); }
    let d = row.datos || {};
    // menores: el correo de la cuenta desde la que se firmó (en sus datos no hay correo) para el sello del final
    const cuenta = (V.nombres[row.user_id] || {}).email;
    if(row.tipo === 'menor' && cuenta && !(d.viajero || {}).email) d = { ...d, viajero: { ...(d.viajero || {}), email: cuenta } };
    w.document.open();
    printDoc(row, row.contenido || await contexto(row), d, false, w);
  }
  function printDoc(row, c, d, paper, w0){
    const menor = row.tipo === 'menor';
    const B = IB.brandOf(c.marca || (c.cond || {}).marca);
    const w = w0 || window.open('', '_blank');
    if(!w) return alert('Permite las ventanas emergentes para descargar el contrato.');
    const css = `body{font:14px/1.55 Arial,Helvetica,sans-serif;color:#1A1614;max-width:760px;margin:30px auto;padding:0 24px}
      .top{display:flex;align-items:center;gap:10px;border-bottom:3px solid ${B.color};padding-bottom:12px;margin-bottom:10px}.top img{width:40px;height:40px;border-radius:9px}.top b{font-size:26px;font-weight:800;letter-spacing:-1px}.top b i{font-style:normal;color:#C43730}
      h3{font-size:14px;text-transform:uppercase;margin:18px 0 6px;border-bottom:1px solid #E5DAC6;padding-bottom:3px}h3 b{color:${B.color}}.ct-kicker{font-size:22px;font-weight:800;margin:6px 0 0}.ct-sub{color:#6E5D50;margin:0 0 8px}
      table{border-collapse:collapse;width:100%;margin:8px 0}th,td{border:1px solid #E5DAC6;padding:5px 8px;text-align:left;font-size:13px}th{background:#F7F0E3}.ct-small li{font-size:12px}.ct-pre{white-space:pre-line}.ct-gap{border-bottom:1px solid #999;display:inline-block;min-width:80px}
      .sig{display:flex;gap:24px;margin-top:22px;page-break-inside:avoid}.sig div{flex:1;border:1px solid #E5DAC6;border-radius:8px;padding:10px}.sig img{max-width:100%;height:90px;object-fit:contain}.sig small{color:#6E5D50;display:block}.sig .blank{display:block;height:90px;border-bottom:1px solid #999;margin-bottom:6px}.sig--paper small{margin-top:6px}.lugar{margin-top:26px}
      .stamp{margin-top:14px;font-size:12px;color:#6E5D50;border-top:1px dashed #E5DAC6;padding-top:8px}@media print{body{margin:0}}`;
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${paper ? 'Borrador · ' : ''}Contrato ${esc(c.grupo || '')} · ${esc((d.viajero || {}).nombre || '')}</title><style>${css}</style></head><body>
      <div class="top"><img src="${B.site}/assets/img/logo.png" alt=""><b>${B.word}</b></div>
      ${texto(c, d)}
      ${paper ? `<p class="lugar">En ______________________, a ____ de ____________________ de ${new Date().getFullYear()}</p>
      <div class="sig sig--paper">
        <div><small>Por ${B.nombre}</small><b>${B.up}</b><small>NIF ${AGENCIA.nif}</small></div>
        <div><small>${menor ? 'Padre, madre o tutor (firma)' : 'El Viajero (firma)'}</small><span class="blank"></span><small>Nombre: ______________________________</small><small>DNI: _________________</small></div>
        ${menor ? `<div><small>El menor (firma)</small><span class="blank"></span><small>${esc((d.viajero || {}).nombre || 'Nombre: ______________________________')}</small></div>` : ''}
      </div>
      <p class="stamp">Rellena los huecos, firma${menor ? ' (padre, madre o tutor y el menor)' : ''} y envía una foto o escaneo de todas las páginas por WhatsApp al ${AGENCIA.tel} o a ${B.email}.</p>` : `      <div class="sig">
        <div><small>Por ${B.nombre}</small><b>${B.up}</b><small>NIF ${AGENCIA.nif}</small></div>
        <div><small>${menor ? 'Padre, madre o tutor' : 'El Viajero'}</small>${row.firma ? `<img src="${row.firma}" alt="Firma">` : ''}<b>${esc(menor ? (d.tutor || {}).nombre || '' : (d.viajero || {}).nombre || '')}</b><small>DNI ${esc(menor ? (d.tutor || {}).dni || '' : (d.viajero || {}).dni || '')}</small></div>
        ${menor && row.firma_menor ? `<div><small>El menor</small><img src="${row.firma_menor}" alt="Firma del menor"><b>${esc((d.viajero || {}).nombre || '')}</b></div>` : ''}
      </div>
      <p class="stamp">${row.firmado_at ? `Firmado electrónicamente en ${B.web} el ${esc(fdt(row.firmado_at))} desde la cuenta de ${esc(((d.viajero || {}).email) || 'el viajero')}. Versión del contrato ${esc(c.version || VERSION)}. Id. ${esc(row.id)}.` : 'Pendiente de firma.'}</p>`}
      <script>window.onload=function(){setTimeout(function(){window.print()},400)}<\/script></body></html>`);
    w.document.close();
  }

  /* ======================= la pestaña ======================= */
  const V = { rows: [], grupos: {}, nombres: {}, grupo: '', estado: '', q: '', err: '', loaded: false };
  async function loadAll(){
    const [c, g, cl] = await Promise.all([
      IB.sb.from('contratos').select('id, grupo_id, user_id, tipo, estado, enviado_at, firmado_at, datos').order('enviado_at', { ascending: false }).limit(5000),
      IB.sb.from('grupos').select('id, nombre'),
      IB.sb.rpc('buscar_clientes', { q: '' })
    ]);
    V.err = c.error ? c.error.message : '';
    V.rows = c.data || [];
    V.grupos = {}; (g.data || []).forEach(x => V.grupos[x.id] = x.nombre);
    V.nombres = {}; (cl.data || []).forEach(x => V.nombres[x.id] = x);
    V.loaded = true;
    const b = document.getElementById('admCCon'); if(b) b.textContent = V.rows.filter(r => r.estado === 'firmado').length || '';
  }
  const who = r => { const d = r.datos || {}, v = d.viajero || {}, c = V.nombres[r.user_id] || {}; return v.nombre || c.nombre || String(c.email || '').split('@')[0] || 'Viajero'; };
  const fecha = iso => iso ? new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const sinT = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  function visibles(){
    const q = sinT(V.q);
    return V.rows.filter(r => (!V.grupo || String(r.grupo_id) === V.grupo) && (V.estado ? r.estado === V.estado : r.estado !== 'anulado')
      && (!q || sinT([who(r), (V.nombres[r.user_id] || {}).email, V.grupos[r.grupo_id], ((r.datos || {}).tutor || {}).nombre, ((r.datos || {}).viajero || {}).dni].join(' ')).includes(q)));
  }
  function paintAll(){
    const root = document.getElementById('conView'); if(!root) return;
    if(!V.loaded){ root.innerHTML = '<div class="auth-spin"></div>'; return; }
    if(V.err){ root.innerHTML = `<div class="adm-empty"><b>No se pueden leer los contratos.</b><span>${esc(V.err)} · La tabla la crea <b>supabase/sql/contratos.sql</b>; si no existe, es que nunca se llegó a firmar ninguno en la web.</span></div>`; return; }
    const vivos = V.rows.filter(r => r.estado !== 'anulado');
    const n = { total: vivos.length, ok: vivos.filter(r => r.estado === 'firmado').length, anul: V.rows.length - vivos.length, menores: vivos.filter(r => r.estado === 'firmado' && r.tipo === 'menor').length };
    const rows = visibles();
    const gids = [...new Set(V.rows.map(r => String(r.grupo_id)))].sort((a, b) => String(V.grupos[a] || '').localeCompare(String(V.grupos[b] || '')));
    const byG = {}; rows.forEach(r => (byG[r.grupo_id] = byG[r.grupo_id] || []).push(r));
    const item = r => {
      const d = r.datos || {}, tu = r.tipo === 'menor' ? d.tutor : null;
      const st = r.estado === 'firmado' ? `<span class="ct-st is-ok">${I.ok}Firmado ${esc(fecha(r.firmado_at))}</span><button type="button" class="btn btn--ghost btn--sm" data-ct-print="${esc(r.id)}">PDF</button>`
        : r.estado === 'anulado' ? `<span class="ct-st is-off">Anulado · enviado ${esc(fecha(r.enviado_at))}</span>${r.firmado_at ? `<button type="button" class="btn btn--ghost btn--sm" data-ct-print="${esc(r.id)}">PDF</button>` : ''}`
        : `<span class="ct-st">Sin firmar · enviado ${esc(fecha(r.enviado_at))}</span>`;
      return `<div class="ct-row">
        <div><b>${esc(who(r))}</b><small>${esc((V.nombres[r.user_id] || {}).email || (d.viajero || {}).email || '')}${d.viajero && d.viajero.dni ? ` · DNI ${esc(d.viajero.dni)}` : ''}</small></div>
        <div class="ct-acts"><span class="ct-kind">${r.tipo === 'menor' ? 'Menor' : 'Mayor'}</span>${st}</div>
        ${tu && tu.telefono ? `<div class="ct-tutor">${I.phone}<span><b>${esc(tu.nombre || 'Tutor')}</b> (${esc(tu.relacion || 'tutor')}) · ${esc(tu.telefono)}</span><a class="ct-wa" href="${esc(waLink(tu.telefono))}" target="_blank" rel="noopener">WhatsApp</a></div>` : ''}
      </div>`;
    };
    root.innerHTML = `
      <p class="adm-hint ct-hint">Contratos firmados en la web mientras la firma estuvo activa (ahora los contratos van por correo). Están guardados tal cual se firmaron: con <b>PDF</b> ves el contrato completo con la firma, la fecha y la hora, listo para imprimir o guardar.</p>
      <div class="lv-stats ct-stats">
        <div class="lv-stat"><b>${n.ok}</b><small>${n.ok === 1 ? 'contrato firmado' : 'contratos firmados'}</small></div>
        <div class="lv-stat"><b>${n.total - n.ok}</b><small>enviados sin firmar</small></div>
        <div class="lv-stat"><b>${n.menores}</b><small>de menores (firmó el padre, madre o tutor)</small></div>
        <div class="lv-stat"><b>${gids.length}</b><small>${gids.length === 1 ? 'grupo' : 'grupos'}</small></div>
      </div>
      <div class="ct-filters">
        <input type="search" data-ctf="q" placeholder="Buscar viajero, DNI, tutor o grupo…" value="${esc(V.q)}" aria-label="Buscar">
        <select data-ctf="grupo" aria-label="Grupo"><option value="">Todos los grupos</option>${gids.map(g => `<option value="${esc(g)}"${g === V.grupo ? ' selected' : ''}>${esc(V.grupos[g] || 'Grupo ' + g)}</option>`).join('')}</select>
        <select data-ctf="estado" aria-label="Estado"><option value="">Firmados y sin firmar</option><option value="firmado"${V.estado === 'firmado' ? ' selected' : ''}>Solo firmados</option><option value="pendiente"${V.estado === 'pendiente' ? ' selected' : ''}>Solo sin firmar</option><option value="anulado"${V.estado === 'anulado' ? ' selected' : ''}>Anulados (${n.anul})</option></select>
        <button type="button" class="btn btn--ghost btn--sm" data-ctf-csv>Exportar CSV</button>
        <button type="button" class="btn btn--ghost btn--sm" data-ctf-reload>Actualizar</button>
      </div>
      ${Object.keys(byG).length ? Object.keys(byG).sort((a, b) => String(V.grupos[a] || '').localeCompare(String(V.grupos[b] || ''))).map(g => {
        const tot = V.rows.filter(r => String(r.grupo_id) === String(g) && r.estado !== 'anulado'), ok = tot.filter(r => r.estado === 'firmado').length;
        return `<section class="lv-card ct-group"><div class="ct-group-h"><h3>${esc(V.grupos[g] || 'Grupo borrado (n.º ' + g + ')')}</h3><small>${ok} de ${tot.length} firmados</small></div><div class="ct-list">${byG[g].map(item).join('')}</div></section>`;
      }).join('') : `<div class="adm-empty"><b>${V.rows.length ? 'No hay contratos con esos filtros.' : 'No hay ningún contrato guardado.'}</b><span>${V.rows.length ? 'Prueba con otro filtro o búsqueda.' : 'No se llegó a enviar ni firmar ningún contrato desde la web.'}</span></div>`}`;
  }
  function csv(){
    const celda = v => { let s = String(v == null ? '' : v); if(/^[=@\t\r]/.test(s) || (/^[+\-]/.test(s) && !/^[+\-]?[\d\s().,-]+$/.test(s))) s = "'" + s; return `"${s.replace(/"/g, '""')}"`; };
    const cab = ['grupo', 'viajero', 'dni', 'nacimiento', 'email', 'telefono', 'tipo', 'estado', 'enviado', 'firmado', 'tutor', 'relacion', 'dni_tutor', 'telefono_tutor', 'email_tutor', 'id'];
    const filas = visibles().map(r => { const d = r.datos || {}, v = d.viajero || {}, t = d.tutor || {}, c = V.nombres[r.user_id] || {};
      return [V.grupos[r.grupo_id] || r.grupo_id, who(r), v.dni, v.nacimiento, v.email || c.email, v.telefono || c.telefono, r.tipo === 'menor' ? 'menor' : 'mayor', r.estado, String(r.enviado_at || '').slice(0, 10), r.firmado_at ? new Date(r.firmado_at).toLocaleString('es-ES') : '', t.nombre, t.relacion, t.dni, t.telefono, t.email, r.id]; });
    const out = '﻿' + [cab].concat(filas).map(f => f.map(celda).join(';')).join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([out], { type: 'text/csv;charset=utf-8' }));
    a.download = `contratos-iberail-${new Date().toISOString().slice(0, 10)}.csv`; document.body.appendChild(a); a.click(); a.remove();
  }
  document.addEventListener('input', e => { const f = e.target.closest && e.target.closest('#conView [data-ctf]'); if(!f) return; V[f.dataset.ctf] = f.value;
    if(f.dataset.ctf === 'q'){ clearTimeout(V._t); V._t = setTimeout(() => { paintAll(); const i = document.querySelector('#conView [data-ctf="q"]'); if(i){ i.focus(); i.setSelectionRange(i.value.length, i.value.length); } }, 200); } else paintAll(); });
  document.addEventListener('click', async e => {
    const p = e.target.closest('#conView [data-ct-print]'); if(p) return printContract(p.dataset.ctPrint);
    if(e.target.closest('#conView [data-ctf-csv]')) return csv();
    if(e.target.closest('#conView [data-ctf-reload]')){ await loadAll(); paintAll(); }
  });
  async function showAll(){ paintAll(); await loadAll(); paintAll(); }
  window.IBContratos = { show: showAll, printContract };
  // el contador de la pestaña, al abrir el panel
  setTimeout(() => { if(IB.sb) IB.sb.auth.getSession().then(s => { if(s && s.data && s.data.session && !V.loaded) loadAll(); }); }, 3500);
})();
