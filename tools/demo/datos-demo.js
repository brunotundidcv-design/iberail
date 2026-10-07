/* Iberail — DATOS DE EJEMPLO para la demo del panel (todo inventado; nada es real).
   Solo va en la versión de demo (tools/demo/build.py la mete en panel.html junto a supabase-demo.js).
   Cifras que se piden para la presentación: CLIENTES clientes registrados y PENDIENTE € pendientes de cobro
   repartidos entre varios grupos. El resto (solicitudes, pagos, WhatsApp, avisos, visitas…) sale al azar, pero
   siempre igual (semilla fija), y las fechas se calculan desde «ahora» para que todo parezca reciente. */
(function(){
  const CLIENTES = 2190;
  const PENDIENTE = 260180;               // € pendientes de cobro en total («nos deben 260 mil»)
  const GRUPOS_IB = 62, GRUPOS_ZP = 12;   // grupos de Iberail y de Zarping

  // la demo NO se activa en las webs de verdad (si alguien la sube por error, el panel no enseña nada inventado)
  if(/(^|\.)(iberail|zarping)\.(com|es)$/i.test(location.hostname)){
    window.IB_DEMO_BLOQUEADA = true;
    document.addEventListener('DOMContentLoaded', () => { const t = document.getElementById('admLockText'); if(t) t.textContent = 'Esta es la versión de demo del panel: no se puede usar en la web publicada.'; });
    return;
  }

  const D = window.IB_DEMO = window.IB_DEMO || {};
  let semilla = 20261007;
  const rnd = () => { semilla |= 0; semilla = semilla + 0x6D2B79F5 | 0; let t = Math.imul(semilla ^ semilla >>> 15, 1 | semilla); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
  const ent = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const uno = l => l[Math.floor(rnd() * l.length)];
  const peso = pares => { let x = rnd() * pares.reduce((a, p) => a + p[1], 0); for(const [v, w] of pares){ if((x -= w) < 0) return v; } return pares[pares.length - 1][0]; };
  const mezcla = l => { const a = l.slice(); for(let i = a.length - 1; i > 0; i--){ const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const AHORA = Date.now(), MIN = 6e4, H = 36e5, DIA = 864e5;
  const iso = ms => new Date(ms).toISOString();
  const dia = ms => new Date(ms).toISOString().slice(0, 10);
  const sinTilde = s => s.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const uuid = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.floor(rnd() * 16); return (c === 'x' ? r : (r & 3 | 8)).toString(16); });
  const ref = p => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let s = ''; for(let i = 0; i < 6; i++) s += a[Math.floor(rnd() * a.length)]; return p + '-' + s; };
  const isoAdd = (d, n) => { const x = new Date(d + 'T12:00:00'); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };

  /* ---------- personas ---------- */
  const ELLAS = ['Lucía', 'María', 'Paula', 'Laura', 'Marta', 'Sara', 'Carla', 'Claudia', 'Andrea', 'Alba', 'Irene', 'Elena', 'Nerea', 'Julia', 'Carmen', 'Ana', 'Cristina', 'Patricia', 'Raquel', 'Natalia', 'Sofía', 'Daniela', 'Noelia', 'Rocío', 'Blanca', 'Inés', 'Lola', 'Ainhoa', 'Aitana', 'Celia', 'Miriam', 'Silvia', 'Adriana', 'Beatriz', 'Lorena', 'Jimena', 'Valeria', 'Olivia', 'Martina', 'Vega', 'Candela', 'Alicia', 'Teresa', 'Leire', 'Ariadna', 'Mar', 'Nuria', 'Eva', 'Judith', 'Cayetana'];
  const ELLOS = ['Pablo', 'Alejandro', 'Daniel', 'Javier', 'Sergio', 'Adrián', 'Álvaro', 'David', 'Diego', 'Mario', 'Carlos', 'Hugo', 'Jorge', 'Iván', 'Rubén', 'Marcos', 'Manuel', 'Miguel', 'Raúl', 'Alberto', 'Gonzalo', 'Víctor', 'Nicolás', 'Rodrigo', 'Jaime', 'Guillermo', 'Íñigo', 'Lucas', 'Martín', 'Óscar', 'Samuel', 'Héctor', 'Ignacio', 'Asier', 'Unai', 'Marc', 'Pol', 'Jordi', 'Aitor', 'Fernando', 'Tomás', 'Andrés', 'Gabriel', 'Enrique', 'Borja', 'Luis', 'Juan', 'Antonio', 'Eduardo', 'Mateo'];
  const APELLIDOS = ['García', 'Fernández', 'González', 'Rodríguez', 'López', 'Martínez', 'Sánchez', 'Pérez', 'Gómez', 'Martín', 'Jiménez', 'Hernández', 'Ruiz', 'Díaz', 'Moreno', 'Muñoz', 'Álvarez', 'Romero', 'Gutiérrez', 'Alonso', 'Navarro', 'Torres', 'Domínguez', 'Ramos', 'Vázquez', 'Ramírez', 'Gil', 'Serrano', 'Morales', 'Molina', 'Blanco', 'Suárez', 'Castro', 'Ortega', 'Delgado', 'Ortiz', 'Marín', 'Rubio', 'Núñez', 'Medina', 'Sanz', 'Castillo', 'Iglesias', 'Cortés', 'Garrido', 'Santos', 'Guerrero', 'Lozano', 'Cano', 'Prieto', 'Méndez', 'Cruz', 'Calvo', 'Gallego', 'Herrera', 'Márquez', 'León', 'Peña', 'Flores', 'Cabrera', 'Campos', 'Vega', 'Fuentes', 'Carrasco', 'Diez', 'Caballero', 'Reyes', 'Nieto', 'Aguilar', 'Pascual', 'Herrero', 'Montero', 'Lorenzo', 'Hidalgo', 'Giménez', 'Ibáñez', 'Ferrer', 'Durán', 'Benítez', 'Vargas', 'Mora', 'Vicente', 'Arias', 'Carmona', 'Crespo', 'Román', 'Pastor', 'Soto', 'Sáez', 'Velasco', 'Moya', 'Soler', 'Parra', 'Esteban', 'Bravo', 'Gallardo', 'Rojas', 'Pardo', 'Merino', 'Franco', 'Espinosa', 'Lara', 'Rivas', 'Silva', 'Arroyo', 'Redondo', 'Camacho', 'Vidal', 'Otero', 'Luque', 'Montes', 'Ríos', 'Sierra', 'Segura', 'Soriano', 'Robles', 'Bernal', 'Valero', 'Aranda', 'Echevarría', 'Goñi', 'Uriarte', 'Puig', 'Casas'];
  const DOMINIOS = [['gmail.com', 70], ['hotmail.com', 11], ['outlook.es', 8], ['icloud.com', 7], ['yahoo.es', 4]];
  const usados = new Set();
  function persona(){
    const ella = rnd() < .52, nom = uno(ella ? ELLAS : ELLOS), a1 = uno(APELLIDOS), a2 = rnd() < .35 ? ' ' + uno(APELLIDOS) : '';
    const base = sinTilde((rnd() < .7 ? nom + '.' + a1 : nom.charAt(0) + a1).toLowerCase()).replace(/[^a-z.]/g, '');
    let mail = base + (rnd() < .55 ? ent(1, 99) : '') + '@' + peso(DOMINIOS);
    while(usados.has(mail)) mail = base + ent(100, 999) + '@' + peso(DOMINIOS);
    usados.add(mail);
    return { nombre: nom + ' ' + a1 + a2, email: mail };
  }
  const tel = () => '+346' + String(ent(0, 99999999)).padStart(8, '0');

  // registros: desde finales de mayo, cada vez más (la web crece)
  const VENTANA = 132 * DIA;
  const clientes = [];
  for(let i = 0; i < CLIENTES; i++){
    const p = persona(), reg = AHORA - Math.pow(rnd(), 1.7) * VENTANA - ent(2, 600) * MIN;
    const activo = rnd() < .36 ? AHORA - rnd() * 7 * DIA : (rnd() < .06 ? null : reg + rnd() * Math.max(0, AHORA - 7 * DIA - reg));
    clientes.push({ id: uuid(), email: p.email, nombre: p.nombre, telefono: rnd() < .94 ? tel() : null, registrado: iso(reg), ultimo_acceso: activo == null ? null : iso(Math.max(reg, activo)), verificado: rnd() < .96 });
  }
  clientes.sort((a, b) => a.registrado < b.registrado ? 1 : -1);
  const EQUIPO = { id: 'equipo-demo', email: 'equipo@iberail.com', user_metadata: { nombre: 'Equipo Iberail', telefono: '+34930491439' } };
  D.user = EQUIPO;

  /* ---------- grupos, personas y pagos ---------- */
  const D0 = window.IB_DATA || { cities: [], presets: [] };
  const ciudad = n => (D0.cities || []).find(c => c.n === n) || { n, cc: '' };
  const pais = n => ((D0.countries || {})[ciudad(n).cc]) || '';
  const BARRIOS = ['Las Rozas', 'Pozuelo', 'Majadahonda', 'Chamberí', 'Moncloa', 'Getafe', 'Alcobendas', 'Boadilla', 'Torrelodones', 'Aravaca', 'Malasaña', 'Retiro', 'Leganés', 'Alcalá', 'Tres Cantos', 'Villalba'];
  const UNIS = ['ADE UCM', 'Medicina UAM', 'Teleco UPM', 'ICADE', 'Derecho UV', 'Arquitectura UPC', 'Erasmus Granada', 'Periodismo URJC', 'Biología US', 'Ingeniería UPV', 'Psicología UCM', 'Marketing ESIC', 'Economía UC3M', 'Deusto Bilbao'];
  const SALIDAS = [['Madrid', 58], ['Barcelona', 12], ['Valencia', 10], ['Sevilla', 6], ['Bilbao', 5], ['Málaga', 4], ['Zaragoza', 3], ['San Sebastián', 2]];
  const RUTAS_ULTRA = [
    ['Ámsterdam', 3, 'Berlín', 3, 'Praga', 2, 'Budapest', 2, 'Split', 4],
    ['Venecia', 2, 'Liubliana', 2, 'Zagreb', 2, 'Split', 4, 'Dubrovnik', 2],
    ['Múnich', 2, 'Viena', 2, 'Budapest', 3, 'Zagreb', 1, 'Split', 4],
    ['Berlín', 3, 'Praga', 3, 'Viena', 2, 'Liubliana', 2, 'Split', 4],
    ['París', 2, 'Múnich', 2, 'Salzburgo', 1, 'Liubliana', 2, 'Split', 4, 'Dubrovnik', 2],
    ['Praga', 3, 'Budapest', 3, 'Zagreb', 2, 'Split', 4]
  ];
  const RUTAS_OTRAS = [
    ['París', 3, 'Ámsterdam', 3, 'Berlín', 3, 'Praga', 3, 'Viena', 2, 'Budapest', 3],
    ['Niza', 3, 'Cinque Terre', 2, 'Florencia', 3, 'Roma', 4, 'Nápoles', 2],
    ['Ámsterdam', 2, 'Hamburgo', 2, 'Copenhague', 3, 'Estocolmo', 3, 'Tallin', 2, 'Riga', 2],
    ['Lisboa', 3, 'Oporto', 2],
    ['Berlín', 3, 'Cracovia', 3, 'Budapest', 3, 'Belgrado', 2, 'Sofía', 2],
    ['Bruselas', 2, 'Ámsterdam', 3, 'Colonia', 2, 'Berlín', 3, 'Praga', 3]
  ];
  const paradasDe = l => { const out = []; for(let i = 0; i < l.length; i += 2) out.push({ ciudad: l[i], pais: pais(l[i]), dias: l[i + 1] }); return out; };
  // salida para que Split cubra las 3 noches del Ultra (9–11 jul 2027): dejar Split el 12 de julio
  const salidaUltra = paradas => { const i = paradas.findIndex(p => p.ciudad === 'Split'); const antes = paradas.slice(0, i).reduce((a, p) => a + p.dias, 0); return isoAdd(isoAdd('2027-07-12', -paradas[i].dias), -antes); };

  const libres = mezcla(clientes.map(c => c.id));
  const quien = {}; clientes.forEach(c => quien[c.id] = c);
  const grupos = [], miembros = [], pagos = [], rutas = [];
  let gid = 0, pid = 0, rid = 0;
  const nombresUsados = new Set();
  function nombreGrupo(zp){
    let n, tries = 0;
    do{
      n = zp ? uno(ZP_VIAJES)[0].replace('{a}', uno(ELLAS)).replace('{o}', uno(ELLOS)).replace('{b}', uno(BARRIOS)).replace('{u}', uno(UNIS))
        : uno([`Ultra 2027 · ${uno(BARRIOS)}`, `Interrail ${uno(UNIS)}`, `Despedida de ${uno(ELLAS)} · Split`, `Despedida de ${uno(ELLOS)} · Ultra`, `Fin de carrera ${uno(UNIS)}`, `Balcanes + Ultra · ${uno(SALIDAS)[0]}`, `Centroeuropa julio · ${uno(SALIDAS)[0]}`, `Los de ${uno(BARRIOS)} · Ultra`, `Interrail verano · ${uno(BARRIOS)}`]);
      tries++;
    }while(nombresUsados.has(n) && tries < 30);
    if(nombresUsados.has(n)) n += ' ' + (tries + 1);
    nombresUsados.add(n); return n;
  }
  const ZP_VIAJES = [['Nieve Andorra · 2.º Bach', 'Andorra', 'Andorra'], ['Fin de curso Mallorca · 1.º Bach', 'Mallorca', 'España'], ['Despedida de {o} · Lisboa', 'Lisboa', 'Portugal'],
    ['Despedida de {a} · Oporto', 'Oporto', 'Portugal'], ['Sierra Nevada febrero · {u}', 'Sierra Nevada', 'España'], ['Arenal Sound · Los de {b}', 'Burriana', 'España'],
    ['Mad Cool · {b}', 'Madrid', 'España'], ['Puente de diciembre · Roma', 'Roma', 'Italia'], ['Esquí Baqueira · {u}', 'Baqueira', 'España'], ['Fin de curso Ibiza · {u}', 'Ibiza', 'España']];
  const destinoZp = nombre => { const x = ZP_VIAJES.find(v => new RegExp('^' + v[0].split('{')[0].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(nombre)); return x ? [x[1], x[2]] : ['Andorra', 'Andorra']; };
  const NOTAS_PAGO = [['Bizum', 40], ['Transferencia', 30], ['Tarjeta (Stripe)', 25], ['Efectivo en oficina', 5]];
  function pago(g, uid, importe, desde){
    const t = desde + rnd() * Math.max(DIA, AHORA - desde - 2 * H);
    pagos.push({ id: ++pid, grupo_id: g.id, user_id: uid, importe: Math.round(importe * 100) / 100, fecha: dia(t), nota: peso(NOTAS_PAGO), created_at: iso(t) });
  }
  const totalG = GRUPOS_IB + GRUPOS_ZP;
  for(let k = 0; k < totalG; k++){
    const zp = k >= GRUPOS_IB, n = zp ? ent(8, 26) : ent(4, 16);
    const creado = AHORA - (12 + Math.pow(rnd(), 1.2) * 115) * DIA;
    const g = { id: ++gid, nombre: nombreGrupo(zp), marca: zp ? 'zarping' : 'iberail', created_at: iso(creado), vip: rnd() < .1, pagos_visibles: rnd() < .8, limite_pago: null, nota_pago: null };
    grupos.push(g);
    const precio = zp ? uno([329, 389, 449, 520, 590, 690]) : uno([849, 949, 1049, 1149, 1249, 1349, 1490]);
    const pagadoTodo = rnd() < .22;
    for(let i = 0; i < n && libres.length; i++){
      const uid = libres.pop();
      const imp = precio + (rnd() < .12 ? uno([-50, 30, 60, 90]) : 0);
      miembros.push({ grupo_id: g.id, user_id: uid, importe: imp, pagado: false, added_at: iso(creado + rnd() * 5 * DIA) });
      const desde = creado + DIA;
      if(pagadoTodo){ const r = Math.min(imp, uno([150, 200, 250, 300])); pago(g, uid, r, desde); pago(g, uid, imp - r, desde + 10 * DIA); continue; }
      const est = peso([['nada', 20], ['reserva', 33], ['mitad', 27], ['casi', 8], ['todo', 12]]);
      if(est === 'reserva') pago(g, uid, Math.min(imp, uno([150, 200, 250, 300])), desde);
      if(est === 'mitad'){ const r = uno([150, 200, 250]); pago(g, uid, r, desde); pago(g, uid, Math.round(imp / 2) - r, desde + 6 * DIA); }
      if(est === 'casi'){ pago(g, uid, Math.round(imp * .5), desde); pago(g, uid, Math.round(imp * .3), desde + 9 * DIA); }
      if(est === 'todo'){ pago(g, uid, imp, desde); }
    }
    if(!pagadoTodo && rnd() < .7){ g.limite_pago = uno(['2027-03-31', '2027-04-30', '2027-05-15', '2027-05-31', '2026-12-20']); g.nota_pago = 'Si no está pagado para esa fecha, la plaza puede pasar a la lista de espera.'; }
    // la ruta del grupo (la prepara el equipo)
    const salida = peso(SALIDAS);
    if(zp){
      const [dest, paisZp] = destinoZp(g.nombre);
      const d = ent(3, 6);
      rutas.push({ id: ++rid, ref: ref('ZP'), marca: 'zarping', created_at: iso(creado + DIA), estado: 'cerrada', nombre: g.nombre, email: null, telefono: null, salida, fecha_salida: isoAdd('2027-02-10', ent(0, 140)), flexible: false, dias: d, viajeros: n, paradas: [{ ciudad: dest, pais: paisZp, dias: d }], estilo: [], alojamiento: 'Hotel', presupuesto: null, notas: null, user_id: null, grupo_id: g.id, origen: 'web', creada_por_equipo: true, acepta_publicidad: false });
    } else {
      const ultra = /Split|Ultra/.test(g.nombre) || rnd() < .4, paradas = paradasDe(uno(ultra ? RUTAS_ULTRA : RUTAS_OTRAS));
      const fecha = ultra ? salidaUltra(paradas) : isoAdd('2027-06-25', ent(0, 45));
      rutas.push({ id: ++rid, ref: ref('IB'), marca: 'iberail', created_at: iso(creado + DIA), estado: 'cerrada', nombre: g.nombre, email: null, telefono: null, salida, fecha_salida: fecha, flexible: false, dias: paradas.reduce((a, p) => a + p.dias, 0), viajeros: n, paradas, estilo: [], alojamiento: 'Hostal', presupuesto: null, notas: null, user_id: null, grupo_id: g.id, origen: 'web', creada_por_equipo: true, acepta_publicidad: false });
    }
  }

  // ajuste fino: lo pendiente de cobro tiene que dar PENDIENTE €
  const pagadoDe = {}; pagos.forEach(p => { const k = p.grupo_id + '|' + p.user_id; pagadoDe[k] = (pagadoDe[k] || 0) + p.importe; });
  const falta = m => Math.max(0, m.importe - (pagadoDe[m.grupo_id + '|' + m.user_id] || 0));
  let pendiente = miembros.reduce((a, m) => a + falta(m), 0);
  const deudores = mezcla(miembros.filter(m => falta(m) > 0));
  let i0 = 0;
  while(pendiente > PENDIENTE && deudores.length){
    const m = deudores[i0++ % deudores.length], f = falta(m); if(!f) continue;
    const g = grupos.find(x => x.id === m.grupo_id);
    const x = Math.min(f, pendiente - PENDIENTE, uno([100, 150, 200, 250, 300, f]));
    if(x <= 0) break;
    pago(g, m.user_id, x, new Date(g.created_at).getTime() + 2 * DIA);
    pagadoDe[m.grupo_id + '|' + m.user_id] = (pagadoDe[m.grupo_id + '|' + m.user_id] || 0) + x;
    pendiente -= x;
  }
  if(pendiente < PENDIENTE){   // (no debería pasar) sube el precio de alguien que ya debe
    const m = miembros.find(x => falta(x) > 0); if(m) m.importe += PENDIENTE - pendiente;
  }

  /* ---------- solicitudes de clientes (web y WhatsApp) ---------- */
  const ESTILOS = (D0.styles && Object.values(D0.styles)) || ['Fiesta y festivales', 'Cultura y ciudades'];
  const PRESUPUESTOS = (D0.budgets && Object.values(D0.budgets)) || [];
  const NOTAS = ['Queremos ir al Ultra sí o sí', 'Somos un grupo de amigos de la uni', 'Preferimos trenes nocturnos para ahorrar', '¿Se puede pagar a plazos?', 'Uno del grupo es menor (17)', 'Nos gustaría algo de playa al final', 'Vamos justo después de los exámenes', 'Buscamos lo más barato posible', '', '', '', ''];
  const sueltas = mezcla(clientes.filter(c => !miembros.some(m => m.user_id === c.id))).slice(0, 640);
  const EST_SOL = [['nueva', 3], ['en_curso', 36], ['presupuesto_enviado', 68], ['cerrada', 96], ['descartada', 88]];
  sueltas.forEach((c, i) => {
    const estado = i < 6 ? 'nueva' : peso(EST_SOL);
    const reg = new Date(c.registrado).getTime();
    const t = estado === 'nueva' ? AHORA - ent(8, 60 * 30) * MIN : reg + rnd() * Math.max(H, AHORA - reg - 3 * H);
    const ultra = rnd() < .55, base = uno(ultra ? RUTAS_ULTRA : RUTAS_OTRAS.concat(D0.presets ? D0.presets.map(p => p.stops.flatMap(s => [s.n, s.d])) : []));
    const paradas = paradasDe(base);
    const zp = rnd() < .08;
    const wa = !zp && rnd() < .07;
    rutas.push({
      id: ++rid, ref: ref(zp ? 'ZP' : 'IB'), marca: zp ? 'zarping' : 'iberail', created_at: iso(t), estado,
      nombre: c.nombre, email: c.email, telefono: c.telefono || tel(), salida: peso(SALIDAS),
      fecha_salida: ultra ? salidaUltra(paradas) : isoAdd('2027-06-20', ent(0, 70)), flexible: rnd() < .4,
      dias: paradas.reduce((a, p) => a + p.dias, 0), viajeros: peso([[1, 6], [2, 18], [3, 10], [4, 22], [5, 12], [6, 14], [8, 8], [10, 5], [12, 3]]),
      paradas: zp ? [{ ciudad: uno(['Andorra', 'Mallorca', 'Lisboa', 'Ibiza']), pais: '', dias: ent(3, 6) }] : paradas,
      estilo: mezcla(ESTILOS).slice(0, ent(1, 3)), alojamiento: uno(['Hostal', 'Hotel', 'Apartamento', 'Lo que mejor encaje']),
      presupuesto: PRESUPUESTOS.length ? uno(PRESUPUESTOS) : null, notas: uno(NOTAS) || null,
      user_id: wa ? null : c.id, grupo_id: null, origen: wa ? 'whatsapp' : 'web', creada_por_equipo: false, acepta_publicidad: rnd() < .58
    });
  });
  rutas.sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  const notasRuta = rutas.filter(r => !r.creada_por_equipo && r.estado !== 'nueva' && rnd() < .3).map(r => ({ ruta_id: r.id, nota: uno(['Presupuesto enviado por WhatsApp', 'Le interesa el pack con alojamiento', 'Llamar el lunes', 'Pendiente de que confirme el grupo', 'Pidió hostales céntricos', 'Quiere pagar en 3 plazos']), updated_at: r.created_at }));

  /* ---------- avisos ---------- */
  const avisos = [], leidos = [];
  let aid = 0;
  const AV = [
    ['Ya tenéis los billetes', 'Os hemos subido los billetes a vuestra cuenta. Descargadlos y llevadlos en el móvil el día del viaje.', false],
    ['Recordatorio de pago', 'Os recordamos que el pago final del viaje vence pronto. En vuestra cuenta veis lo que lleva pagado cada uno y lo que falta.', true],
    ['Alojamiento en Split confirmado', 'Ya tenéis el apartamento de Split para las noches del Ultra. Lo veis en «Mis grupos».', false],
    ['Qué llevar al viaje', 'DNI o pasaporte, tarjeta sanitaria europea, cargador y los billetes descargados en el móvil.', false]
  ];
  mezcla(grupos).slice(0, 16).forEach((g, i) => {
    const [t, c, imp] = AV[i % AV.length], at = AHORA - ent(30, 60 * 24 * 20) * MIN;
    avisos.push({ id: ++aid, created_at: iso(at), titulo: t, cuerpo: c, importante: imp, para_todos: false, grupo_id: g.id, ruta_id: null, user_id: null });
    miembros.filter(m => m.grupo_id === g.id).forEach(m => { if(rnd() < .78) leidos.push({ aviso_id: aid, user_id: m.user_id, leido_at: iso(at + rnd() * (AHORA - at)) }); });
  });
  [['Nuevas rutas para el verano 2027', 'Ya tenéis en la web las rutas con el Ultra Europe como final. Si vais en grupo, escribidnos y os preparamos la vuestra.', AHORA - 9 * DIA],
   ['Sorteo de entradas para el Ultra', 'Apúntate gratis desde tu cuenta: entras en todos nuestros sorteos.', AHORA - 4 * DIA]].forEach(([t, c, at]) => {
    avisos.push({ id: ++aid, created_at: iso(at), titulo: t, cuerpo: c, importante: false, para_todos: true, grupo_id: null, ruta_id: null, user_id: null });
    clientes.forEach(cl => { if(new Date(cl.registrado).getTime() < at && rnd() < .41) leidos.push({ aviso_id: aid, user_id: cl.id, leido_at: iso(at + rnd() * (AHORA - at)) }); });
  });
  avisos.sort((a, b) => a.created_at < b.created_at ? 1 : -1);

  /* ---------- invita y gana ---------- */
  const padrinos = mezcla(clientes).slice(0, 64);
  const codigos = padrinos.map(p => ({ user_id: p.id, codigo: sinTilde(p.nombre.split(' ')[0]).toUpperCase().slice(0, 6) + '-' + ref('X').slice(2, 5) }));
  const referidos = [];
  mezcla(clientes).slice(0, 236).forEach(c => { const p = uno(padrinos); if(p.id !== c.id) referidos.push({ user_id: c.id, padrino: p.id, created_at: c.registrado }); });
  const comisiones = [];
  mezcla(grupos.filter(g => g.marca === 'iberail')).slice(0, 23).forEach((g, i) => {
    const est = i < 6 ? 'pendiente' : i < 21 ? 'pagada' : 'anulada', at = AHORA - ent(1, 40) * DIA;
    comisiones.push({ id: i + 1, created_at: iso(at), padrino: uno(padrinos).id, grupo_id: g.id, grupo_nombre: g.nombre, personas: ent(5, 11), importe: 40, estado: est, pagada_at: est === 'pagada' ? iso(at + ent(1, 5) * DIA) : null });
  });

  /* ---------- WhatsApp ---------- */
  const chats = [], mensajes = [];
  let mid = 0;
  const CONV = [
    [['in', 'Hola! Somos 6 y queremos ir al Ultra desde Madrid, ¿cuánto sale más o menos?'], ['out', 'bot', '¡Hola! 😊 Para 6 personas con el Ultra como final te preparamos la ruta a medida. ¿Qué fechas tenéis en mente y desde dónde salís?'], ['in', 'Salimos el 1 de julio desde Madrid'], ['out', 'bot', 'Perfecto. Te dejo creada la solicitud y el equipo te manda el presupuesto hoy mismo.']],
    [['in', '¿Cuánto me falta por pagar?'], ['out', 'bot', 'Te faltan *650,00 €* de tu parte del viaje. Lo puedes pagar con tarjeta desde «Mis grupos».']],
    [['in', 'Quiero hablar con una persona'], ['out', 'bot', 'Claro, le paso tu mensaje al equipo y te escriben enseguida.']],
    [['in', '¿El pase Interrail incluye los trenes nocturnos?'], ['out', 'bot', 'El pase cubre el viaje, pero los nocturnos suelen pedir reserva de litera o asiento aparte. Te lo dejamos todo reservado en tu ruta.']],
    [['in', '¿Puedo cambiar Praga por Viena?'], ['out', 'bot', 'Sí, sin problema. Se lo paso al equipo para que te ajuste la ruta y el precio.'], ['out', 'panel', 'Hecho, ya lo tienes cambiado en tu cuenta 👍']]
  ];
  mezcla(clientes.filter(c => c.telefono)).slice(0, 46).forEach((c, i) => {
    const conv = CONV[i % CONV.length], fin = AHORA - Math.pow(rnd(), 2) * 6 * DIA - ent(1, 50) * MIN, t0 = fin - conv.length * 3 * MIN;
    const telf = c.telefono.replace(/\D/g, '');
    conv.forEach(([dir, autor, txt], j) => {
      const texto = txt == null ? autor : txt, au = txt == null ? (dir === 'in' ? 'cliente' : 'bot') : autor;
      mensajes.push({ id: ++mid, telefono: telf, dir, autor: dir === 'in' ? 'cliente' : au, texto, created_at: iso(t0 + j * 3 * MIN), meta: {} });
    });
    const necesita = i % CONV.length === 2 && rnd() < .7;
    chats.push({ telefono: telf, nombre: c.nombre, ultimo_at: iso(fin), ultimo_in_at: iso(fin - 3 * MIN), ultimo_txt: mensajes[mensajes.length - 1].texto, atencion: necesita, motivo: necesita ? 'Quiere hablar con una persona del equipo' : null, modo: i % CONV.length === 4 ? 'humano' : 'bot', pausa_hasta: i % CONV.length === 4 ? iso(AHORA + 6 * H) : null, no_leidos: rnd() < .2 ? ent(1, 3) : 0 });
  });

  /* ---------- documentos, alojamientos y seguro ---------- */
  const documentos = [], alojamientos = [], seguros = [], ofertas = [];
  let did = 0, alid = 0, sid = 0;
  const VUELOS = [['Vueling', 'VY'], ['Iberia', 'IB'], ['Ryanair', 'FR'], ['Air Europa', 'UX']];
  const AEROP = { 'Ámsterdam': 'Ámsterdam (AMS)', 'Venecia': 'Venecia (VCE)', 'Múnich': 'Múnich (MUC)', 'Berlín': 'Berlín (BER)', 'París': 'París (CDG)', 'Praga': 'Praga (PRG)', 'Niza': 'Niza (NCE)', 'Lisboa': 'Lisboa (LIS)', 'Bruselas': 'Bruselas (BRU)' };
  const ORIG = { 'Madrid': 'Madrid (MAD)', 'Barcelona': 'Barcelona (BCN)', 'Valencia': 'Valencia (VLC)', 'Sevilla': 'Sevilla (SVQ)', 'Bilbao': 'Bilbao (BIO)', 'Málaga': 'Málaga (AGP)', 'Zaragoza': 'Zaragoza (ZAZ)', 'San Sebastián': 'Bilbao (BIO)' };
  const HOSTALES = { 'Split': ['Apartamentos Riva Split', 'Hostel Diocletian'], 'Ámsterdam': ['ClinkNOORD'], 'Berlín': ['Generator Berlin Mitte'], 'Praga': ['Czech Inn'], 'Budapest': ['Maverick City Lodge'], 'Venecia': ['Anda Venice'], 'Liubliana': ['Hostel Celica'], 'Zagreb': ['Swanky Mint'], 'Dubrovnik': ['Old Town Hostel'], 'Múnich': ['Wombat\'s City Hostel'], 'Viena': ['Wombat\'s The Naschmarkt'], 'París': ['Generator Paris'], 'Salzburgo': ['YoHo Salzburg'] };
  grupos.filter(g => g.marca === 'iberail').slice(0, 24).forEach((g, i) => {
    const r = rutas.find(x => x.grupo_id === g.id); if(!r || !r.paradas.length) return;
    const ms = miembros.filter(m => m.grupo_id === g.id), [cia, cod] = uno(VUELOS), p0 = r.paradas[0].ciudad;
    if(AEROP[p0]) documentos.push({ id: ++did, created_at: iso(AHORA - ent(1, 20) * DIA), ruta_id: null, grupo_id: g.id, tipo: 'vuelo', titulo: null, origen: ORIG[r.salida] || 'Madrid (MAD)', destino: AEROP[p0], fecha: r.fecha_salida, hora: uno(['07:05', '09:40', '11:15', '14:30', '18:55']), compania: cia, numero: cod + ent(1000, 8999), localizador: ref('X').slice(2) + ent(1, 9), pasajeros: ms.map(m => quien[m.user_id].nombre.split(' ')[0]).join(', '), notas: null, archivo: `g/${g.id}/billetes-${dia(AHORA)}.pdf`, archivo_nombre: `billetes-${sinTilde(p0).toLowerCase()}.pdf` });
    if(i < 8){
      let cur = r.fecha_salida;
      r.paradas.forEach(p => { const sal = isoAdd(cur, p.dias); const hs = HOSTALES[p.ciudad]; if(hs) alojamientos.push({ id: ++alid, grupo_id: g.id, ciudad: p.ciudad, nombre: uno(hs), direccion: 'Dirección de ejemplo', entrada: cur, salida: sal, notas: null, enlace: null, fotos: [], created_at: g.created_at }); cur = sal; });
    }
    if(i < 14){
      const precio = uno([39, 45, 59]);
      ofertas.push({ grupo_id: g.id, plan: 'Totaltravel', cancelacion: rnd() < .5, precio, limite: '2027-05-31', aseguradora: '' });
      ms.forEach(m => { if(rnd() < .45) seguros.push({ id: ++sid, grupo_id: g.id, user_id: m.user_id, precio, plan: 'Totaltravel', cancelacion: false, estado: rnd() < .6 ? 'contratado' : 'pagado', poliza: null, pagado_at: iso(AHORA - ent(1, 30) * DIA), contratado_at: null, created_at: iso(AHORA - ent(1, 30) * DIA) }); });
    }
  });

  /* ---------- web en directo: visitas de hoy, actividad y quién está ahora ---------- */
  const PAGINAS = [['Portada', 30], ['Split · Ultra', 16], ['Planificador', 15], ['Destinos', 11], ['Sorteo', 9], ['Mi cuenta', 7], ['Mis grupos', 6], ['Contacto', 3], ['Zarping · Portada', 3]];
  const POR_HORA = [14, 9, 6, 4, 3, 3, 6, 14, 26, 38, 46, 52, 58, 62, 60, 58, 64, 72, 84, 96, 104, 98, 76, 40];
  const visitas = [], medianoche = new Date(); medianoche.setHours(0, 0, 0, 0);
  for(let t = medianoche.getTime(); t < AHORA; t += H){
    const h = new Date(t).getHours(), n = Math.round(POR_HORA[h] * (.8 + rnd() * .4) * Math.min(1, (AHORA - t) / H));
    for(let i = 0; i < n; i++) visitas.push({ id: visitas.length + 1, pagina: peso(PAGINAS), con_cuenta: rnd() < .28, created_at: iso(t + rnd() * Math.min(H, AHORA - t)) });
  }
  // si es muy temprano, también las de anoche (para que «Últimas visitas» no salga vacío)
  if(visitas.length < 60) for(let i = 0; i < 80; i++) visitas.push({ id: visitas.length + 1, pagina: peso(PAGINAS), con_cuenta: rnd() < .28, created_at: iso(medianoche.getTime() - rnd() * 4 * H) });
  visitas.sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  const TIPOS = [['pagina', 46], ['alojamiento', 9], ['fotos', 7], ['pago_iniciado', 6], ['pago_ok', 5], ['aviso_leido', 9], ['mapa', 7], ['documento', 6], ['whatsapp', 3], ['seguro_pedido', 2]];
  const actividad = [], conCuenta = miembros.map(m => m.user_id);
  for(let i = 0; i < 400; i++){
    const tipo = peso(TIPOS), u = uno(conCuenta), at = AHORA - Math.pow(rnd(), 1.6) * 2 * DIA;
    const ciudadA = uno(['Split', 'Praga', 'Budapest', 'Berlín', 'Ámsterdam']);
    const det = tipo === 'alojamiento' ? { ciudad: ciudadA } : tipo === 'fotos' ? { ciudad: ciudadA, vistas: ent(2, 8), total: 8 } : tipo === 'pago_iniciado' ? { boton: uno(['Pagar mi parte', 'Pagar una parte']) } : tipo === 'aviso_leido' ? { titulo: uno(AV)[0] } : tipo === 'documento' ? { titulo: 'Billetes de avión' } : tipo === 'seguro_pedido' ? { precio: 45 } : {};
    actividad.push({ id: i + 1, user_id: u, tipo, pagina: tipo === 'pagina' ? uno(['Mis grupos', 'Mi cuenta', 'Split · Ultra', 'Portada']) : 'Mis grupos', detalle: det, created_at: iso(at) });
  }
  actividad.sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  D.presencia = [];
  for(let i = 0, n = ent(19, 31); i < n; i++){
    const c = rnd() < .3 ? uno(clientes) : null;
    D.presencia.push({ p: peso(PAGINAS), t: AHORA - Math.pow(rnd(), 1.5) * 26 * MIN, c: !!c, n: c ? c.nombre.split(' ')[0] : '', u: c ? c.id : null });
  }

  /* ---------- sorteo ---------- */
  const inscritos = mezcla(clientes).slice(0, 1214).map(c => ({ user_id: c.id, extra: rnd() < .31 ? 1 : 0, created_at: iso(Math.max(new Date(c.registrado).getTime(), AHORA - 20 * DIA) + rnd() * 3 * H) }));
  inscritos.sort((a, b) => a.created_at < b.created_at ? 1 : -1);
  const proximo = new Date(AHORA + 6 * DIA);
  const sorteoCfg = { id: 1, fecha: dia(proximo.getTime()), hora: '20:00', entradas: 3, total: 10, tanda: 2, publicado: false, acta: '', sonidos: {}, premios: null };

  /* ---------- todo junto ---------- */
  D.db = {
    rutas, rutas_notas: notasRuta, grupos, grupo_miembros: miembros, pagos, documentos, avisos, avisos_leidos: leidos,
    comisiones, referidos, rrpp_codigos: codigos, wa_config: [{ id: 1, bot_activo: true, horas_pausa: 12 }], wa_chats: chats, wa_mensajes: mensajes,
    visitas, actividad, alojamientos, seguros, seguro_ofertas: ofertas,
    sorteo_inscritos: inscritos, sorteo_config: [sorteoCfg], sorteo_ganadores: [], admins: [{ user_id: EQUIPO.id }]
  };
  D.rpc = {
    is_admin: () => true,
    buscar_clientes: ({ q }) => { const s = sinTilde(String(q || '').toLowerCase()); return clientes.filter(c => !s || sinTilde(`${c.nombre} ${c.email} ${c.telefono || ''}`.toLowerCase()).includes(s)); },
    rrpp_reglas: () => [{ importe: 40, minimo: 5 }],
    sorteo_restantes: () => [{ entradas: 3, dadas: 0 }],
    pagos_grupo: ({ gid }) => pagos.filter(p => String(p.grupo_id) === String(gid)),
    companeros_grupo: () => [],
    wa_destinatarios: () => []
  };
  const marcaNom = m => m === 'zarping' ? 'Zarping' : 'Iberail';
  const correoHtml = (titulo, texto, marca) => `<!doctype html><meta charset="utf-8"><body style="margin:0;background:#F7F0E3;font-family:Inter,Arial,sans-serif;color:#1A1614"><div style="max-width:560px;margin:24px auto;background:#fff;border-radius:18px;overflow:hidden;border:1px solid #eadfcc"><div style="background:${marca === 'zarping' ? '#0E0E12' : '#C43730'};color:#fff;padding:18px 24px;font:800 22px Poppins,Arial">${marcaNom(marca).toLowerCase()}</div><div style="padding:26px 24px"><h1 style="margin:0 0 12px;font-size:24px">${String(titulo || 'Tu viaje').replace(/</g, '&lt;')}</h1><p style="line-height:1.6;color:#4a3f38">${String(texto || 'Texto del correo.').replace(/</g, '&lt;').replace(/\n/g, '<br>')}</p><p style="margin-top:22px;font-size:12px;color:#9a8f86">Vista previa de la demo · no se envía nada.</p></div></div></body>`;
  const EJ = { ruta_recibida: 'Hemos recibido tu ruta', presupuesto: 'Tu presupuesto está listo', grupo: 'Bienvenido a tu grupo', pago_pendiente: 'Tu viaje ya tiene precio', recordatorio: 'Recordatorio de pago', pago_recibido: 'Pago recibido', cuenta_atras: 'Quedan 30 días para tu viaje' };
  D.funciones = {
    correos: b => {
      if(b.action === 'ejemplo') return { ok: true, asunto: b.asunto || EJ[b.tipo] || 'Correo de ejemplo', html: correoHtml(b.titulo || EJ[b.tipo] || 'Correo de ejemplo', b.texto || 'Hola, Lucía:\n\nAsí es como le llega este correo a tus clientes, con la marca de su viaje.', b.marca) };
      if(b.action === 'audiencia') return { ok: true, total: rutas.filter(r => r.acepta_publicidad && (b.marca || 'iberail') === (r.marca || 'iberail')).length };
      if(b.action === 'manual_pendientes') return { ok: true, pendientes: [] };
      if(b.action === 'manual_plantilla') return { ok: true, plantilla: null };
      if(b.action === 'manual') return { ok: true, para: b.prueba ? EQUIPO.email : b.para };
      if(b.action === 'campana') return { ok: true, enviados: b.prueba ? 1 : rutas.filter(r => r.acepta_publicidad).length, total: rutas.filter(r => r.acepta_publicidad).length };
      return { ok: true };
    },
    whatsapp: b => {
      if(b.action === 'probar'){
        const t = String(b.texto || '').toLowerCase();
        const r = /persona|humano/.test(t) ? 'Claro, le paso tu mensaje al equipo y te escriben enseguida.'
          : /pagar|falta/.test(t) ? 'Para decirte lo que te falta necesito tu móvil o tu correo de la cuenta. ¿Me lo pasas?'
          : /ultra|somos/.test(t) ? '¡Genial! Para el Ultra Europe (9–11 de julio) os preparamos la ruta a medida terminando en Split. ¿Desde dónde salís y cuántos sois?'
          : /tarda|praga|budapest/.test(t) ? 'De Praga a Budapest hay unas 6 h 30 min en tren directo. Va incluido en el pase Interrail.'
          : 'Somos Iberail: te organizamos tu Interrail a medida por Europa, con el Ultra Europe de Split como parada estrella. ¿Te ayudo a montar tu ruta?';
        return { ok: true, respuesta: r, acciones: /persona|humano/.test(t) ? [{ tipo: 'humano', resumen: 'Quiere hablar con el equipo' }] : [] };
      }
      if(b.action === 'aviso') return { ok: true, total: 8, enviados: 8, fallos: [] };
      return { ok: true };
    }
  };
  D.imagenDe = (b, p) => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="900" height="600"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#F0B02A"/><stop offset="1" stop-color="#C43730"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#g)"/><text x="50%" y="52%" font-family="sans-serif" font-size="34" fill="#fff" text-anchor="middle">Archivo de ejemplo</text></svg>`);

  /* ---------- que se note vivo: llegan visitas, solicitudes e inscripciones de vez en cuando ---------- */
  function vivo(){
    const sb = window.supabase && window.supabase.createClient();
    if(!sb) return;
    const visita = () => { const v = { pagina: peso(PAGINAS), con_cuenta: rnd() < .28 }; sb.from('visitas').insert(v).then(() => {}); };
    const quienEntra = () => {
      if(rnd() < .5 && D.presencia.length > 14) D.presencia.splice(Math.floor(rnd() * D.presencia.length), 1);
      else { const c = rnd() < .3 ? uno(clientes) : null; D.presencia.push({ p: peso(PAGINAS), t: Date.now(), c: !!c, n: c ? c.nombre.split(' ')[0] : '', u: c ? c.id : null }); }
      if(D.presenciaCambia) D.presenciaCambia();
    };
    const solicitud = () => {
      const c = uno(clientes), ultra = rnd() < .6, paradas = paradasDe(uno(ultra ? RUTAS_ULTRA : RUTAS_OTRAS));
      sb.from('rutas').insert({ ref: ref('IB'), marca: 'iberail', estado: 'nueva', nombre: c.nombre, email: c.email, telefono: c.telefono || tel(), salida: peso(SALIDAS), fecha_salida: ultra ? salidaUltra(paradas) : isoAdd('2027-06-20', ent(0, 60)), flexible: rnd() < .4, dias: paradas.reduce((a, p) => a + p.dias, 0), viajeros: uno([2, 4, 5, 6, 8]), paradas, estilo: mezcla(ESTILOS).slice(0, 2), alojamiento: 'Hostal', presupuesto: PRESUPUESTOS.length ? uno(PRESUPUESTOS) : null, notas: null, user_id: c.id, grupo_id: null, origen: 'web', creada_por_equipo: false, acepta_publicidad: true }).then(() => {});
    };
    const inscripcion = () => { const c = clientes.find(x => !inscritos.some(i => i.user_id === x.id)); if(c) sb.from('sorteo_inscritos').insert({ user_id: c.id, extra: 0 }).then(() => {}); };
    const programa = (fn, a, b) => { const go = () => { try{ fn(); }catch(e){} setTimeout(go, (a + rnd() * (b - a)) * 1000); }; setTimeout(go, (a + rnd() * (b - a)) * 1000); };
    programa(visita, 4, 14);
    programa(quienEntra, 8, 25);
    programa(solicitud, 75, 160);
    programa(inscripcion, 50, 120);
  }
  window.addEventListener('load', () => setTimeout(vivo, 1500));

  // cabecera: el equipo dentro (en la demo no hay sesión guardada en el navegador)
  document.addEventListener('DOMContentLoaded', () => {
    const a = document.querySelector('[data-acct]'); if(!a) return;
    a.hidden = false; const t = a.querySelector('.acct-t'); if(t) t.textContent = 'Equipo';
  });

  // resumen en la consola (para quien prepare la presentación)
  const conDeuda = new Set(miembros.filter(m => falta(m) > 0).map(m => m.grupo_id)).size;
  D.resumen = { clientes: clientes.length, grupos: grupos.length, gruposConDeuda: conDeuda, pendiente: miembros.reduce((a, m) => a + falta(m), 0), cobrado: pagos.reduce((a, p) => a + p.importe, 0), personasEnGrupos: miembros.length, solicitudes: rutas.length };
  console.info('[demo] datos de ejemplo', D.resumen);
})();
