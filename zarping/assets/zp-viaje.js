/* Zarping — «Monta tu viaje»: formulario en 3 pasos → una fila en `rutas` (la misma tabla que Iberail)
   con marca = 'zarping' y referencia ZP-XXXXXX. El equipo la ve en el panel de iberail.com.
   · Borrador en localStorage (zp-draft-v1): si hay que crear cuenta, al volver sigue donde lo dejó.
   · Con las cuentas activas hace falta sesión para enviar (igual que el planificador de Iberail).
   · Respaldo: Netlify Forms «viaje» (IB.notify), por si la base de datos falla. */
(function(){
  const IB = window.IB, form = document.getElementById('zpForm');
  if(!IB || !form) return;
  const $ = s => document.querySelector(s), $$ = s => Array.from(document.querySelectorAll(s));
  const esc = IB.esc;
  const DRAFT = 'zp-draft-v1', TOTAL = 3;
  const TIPOS = { nieve: 'Nieve', 'fin-de-curso': 'Fin de curso', despedida: 'Despedida', festival: 'Festival', escapada: 'Escapada', 'a-medida': 'A medida' };
  const SUGIERE = {
    nieve: ['Andorra · Grandvalira', 'Andorra · Pal Arinsal', 'Sierra Nevada', 'Formigal', 'Baqueira', 'Alpes franceses'],
    'fin-de-curso': ['Mallorca', 'Ibiza', 'Salou', 'Italia', 'Londres', 'Punta Cana'],
    despedida: ['Ibiza', 'Benidorm', 'Lisboa', 'Budapest', 'Cádiz', 'Praga'],
    festival: ['Budapest', 'Bélgica', 'Países Bajos', 'Portugal', 'Valencia', 'Madrid'],
    escapada: ['Canarias', 'Menorca', 'Oporto', 'Roma', 'Marrakech', 'Londres'],
    'a-medida': ['No lo sabemos todavía']
  };
  const CODES = { madrid: 'MAD', barcelona: 'BCN', valencia: 'VLC', sevilla: 'SVQ', 'málaga': 'AGP', bilbao: 'BIO', zaragoza: 'ZAZ', alicante: 'ALC',
    valladolid: 'VLL', murcia: 'RMU', palma: 'PMI', andorra: 'AND', 'sierra nevada': 'GRX', formigal: 'FOR', baqueira: 'BAQ', mallorca: 'PMI', ibiza: 'IBZ',
    salou: 'REU', italia: 'ITA', roma: 'FCO', londres: 'LON', 'punta cana': 'PUJ', benidorm: 'BEN', lisboa: 'LIS', budapest: 'BUD', 'cádiz': 'CAD', praga: 'PRG',
    canarias: 'CAN', menorca: 'MAH', oporto: 'OPO', marrakech: 'RAK', 'bélgica': 'BEL', 'países bajos': 'AMS', portugal: 'POR' };
  const code = s => { const k = String(s || '').toLowerCase().split('·')[0].trim(); return CODES[k] || (k ? k.normalize('NFD').replace(/[^a-z]/g, '').slice(0, 3).toUpperCase() : '???'); };
  const fday = iso => new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });

  let step = 1, user = null, sending = false;
  const S = { tipo: '', dest: '', from: 'Madrid', date: '', flex: false, days: 4, pax: 10, budget: 'Sin decidir', inc: ['Transporte', 'Alojamiento'], minors: false, name: '', phone: '', email: '', group: '', notes: '', promo: false };

  /* ---------- borrador ---------- */
  function load(){
    try{ const d = JSON.parse(localStorage.getItem(DRAFT) || '{}'); if(d.t && Date.now() - d.t < 30 * 864e5) Object.assign(S, d.s || {}); }catch(e){}   // 30 días como máximo
    const t = new URLSearchParams(location.search).get('tipo');
    if(t && TIPOS[t]) S.tipo = t;
  }
  function save(){ try{ localStorage.setItem(DRAFT, JSON.stringify({ t: Date.now(), s: S })); }catch(e){} }
  function read(){
    const t = form.querySelector('[name=tipo]:checked'); S.tipo = t ? t.value : S.tipo;
    S.dest = $('#zpDest').value.trim(); S.from = $('#zpFrom').value;
    S.date = $('#zpDate').value; S.flex = $('#zpFlexible').checked;
    const b = form.querySelector('[name=budget]:checked'); S.budget = b ? b.value : 'Sin decidir';
    S.inc = $$('[name=inc]:checked').map(x => x.value); S.minors = $('#zpMinors').checked;
    S.name = $('#zpName').value.trim(); S.phone = $('#zpPhone').value.trim();
    S.email = user ? user.email : $('#zpEmail').value.trim();
    S.group = $('#zpGroup').value.trim(); S.notes = $('#zpNotes').value.trim(); S.promo = $('#zpPromo').checked;
  }
  function fill(){
    $$('[name=tipo]').forEach(x => x.checked = x.value === S.tipo);
    $('#zpDest').value = S.dest; $('#zpFrom').value = S.from; $('#zpDate').value = S.date; $('#zpFlexible').checked = S.flex;
    $$('[name=budget]').forEach(x => x.checked = x.value === S.budget);
    $$('[name=inc]').forEach(x => x.checked = S.inc.includes(x.value));
    $('#zpMinors').checked = S.minors; $('#zpName').value = S.name; $('#zpPhone').value = S.phone; $('#zpEmail').value = S.email;
    $('#zpGroup').value = S.group; $('#zpNotes').value = S.notes; $('#zpPromo').checked = S.promo;
    $('#zpDays').textContent = S.days; $('#zpPax').textContent = S.pax;
    $('#zpDate').min = new Date().toISOString().slice(0, 10);
    suggest();
  }
  function suggest(){ $('#zpDestList').innerHTML = (SUGIERE[S.tipo] || []).map(d => `<option value="${esc(d)}">`).join(''); }

  /* ---------- resumen (billete) ---------- */
  function paintSum(){
    $('#zpSumFrom').textContent = S.from; $('#zpSumFromC').textContent = code(S.from === 'Otra ciudad' ? '' : S.from) || '—';
    $('#zpSumTo').textContent = S.dest || 'Por decidir'; $('#zpSumToC').textContent = S.dest ? code(S.dest) : '???';
    $('#zpSumPlan').textContent = TIPOS[S.tipo] || '—'; $('#zpSumPax').textContent = S.pax; $('#zpSumDays').textContent = S.days;
    $('#zpSumDate').textContent = S.date ? fday(S.date) + (S.flex ? ' · flexible' : '') : (S.flex ? 'Fechas flexibles' : 'Fecha por decidir');
  }

  /* ---------- pasos ---------- */
  function err(t){ const e = $('#zpErr'); e.textContent = t || ''; e.hidden = !t; return !t; }
  function valid(n){
    if(n === 1 && !S.tipo) return err('Elige qué tipo de viaje queréis.');
    if(n === 2){
      if(S.date && S.date < new Date().toISOString().slice(0, 10)) return err('La fecha de salida ya ha pasado.');
      if(!S.date && !S.flex) return err('Pon una fecha aproximada o marca «Fechas flexibles».');
    }
    if(n === 3){
      if(IB.enabled && !user) return err('Crea tu cuenta o entra para poder enviarlo.');
      if(S.name.length < 2) return err('Escribe tu nombre.');
      if(String(S.phone).replace(/\D/g, '').length < 9) return err('Escribe un teléfono válido (te escribimos por WhatsApp).');
      if(!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(S.email)) return err('Revisa el correo: no parece válido.');
    }
    return err('');
  }
  function go(n){
    step = n;
    $$('.zp-step').forEach(f => f.hidden = Number(f.dataset.step) !== n);
    $('#zpBar').style.width = (n / TOTAL * 100) + '%';
    $('#zpStepNo').textContent = `Paso ${n} de ${TOTAL}`;
    $('#zpBack').hidden = n === 1;
    const next = $('#zpNext');
    next.querySelector('span').textContent = n === TOTAL ? (sending ? 'Enviando…' : 'Enviar mi viaje') : 'Siguiente';
    next.hidden = n === TOTAL && IB.enabled && !user;
    $('#zpGate').hidden = !(n === TOTAL && IB.enabled && !user);
    const first = form.querySelector(`.zp-step[data-step="${n}"] input:not([type=radio]):not([type=checkbox]):not([readonly])`);
    if(first && window.innerWidth > 700 && n > 1) setTimeout(() => first.focus(), 50);
  }

  /* ---------- enviar ---------- */
  function ref6(){
    const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; const buf = crypto.getRandomValues(new Uint8Array(6)); let s = '';
    for(let i = 0; i < 6; i++) s += a[buf[i] % a.length];
    return 'ZP-' + s;
  }
  function notas(){
    return [`Tipo: ${TIPOS[S.tipo]}`, S.group && `Grupo: ${S.group}`, S.minors && 'Hay menores de edad en el grupo',
      S.inc.length && `Incluir: ${S.inc.join(', ')}`, S.notes].filter(Boolean).join('\n');
  }
  async function send(){
    if(sending) return;
    read(); if(!valid(3)) return;
    sending = true; go(3); $('#zpNext').disabled = true;
    const ref = ref6();
    const row = {
      ref, nombre: S.name, email: S.email, telefono: S.phone, salida: S.from,
      fecha_salida: S.date || null, flexible: !!S.flex, dias: S.days, viajeros: S.pax,
      paradas: [{ ciudad: S.dest || 'Por decidir', pais: '', dias: S.days }],
      estilo: [TIPOS[S.tipo]].concat(S.inc), alojamiento: S.inc.includes('Alojamiento') ? 'Incluido' : 'No incluido',
      presupuesto: S.budget, notas: notas(), acepta_publicidad: !!S.promo, marca: 'zarping'
    };
    let stored = false, e1 = null;
    if(IB.enabled){
      try{
        let { error } = await IB.sb.from('rutas').insert(row);
        // si la base de datos aún no tiene alguna columna nueva (marca, publicidad), se guarda igual: la ref ZP- la identifica
        for(const col of ['marca', 'acepta_publicidad']){
          if(error && new RegExp(col).test(error.message || '')){ delete row[col]; ({ error } = await IB.sb.from('rutas').insert(row)); }
        }
        // la tabla viene del planificador de Iberail (3–60 días, hasta 30 personas): si la base de datos aún tiene esos
        // límites (antes de supabase/sql/marca.sql), se guarda dentro del rango y los números reales van en las notas
        if(error && /check|violat|constraint/i.test(error.message || '') && (row.dias < 3 || row.viajeros > 30)){
          row.notas = `Días: ${S.days} · Personas: ${S.pax}\n` + row.notas;
          row.dias = Math.max(3, Math.min(60, row.dias)); row.viajeros = Math.min(30, row.viajeros); row.paradas[0].dias = row.dias;
          ({ error } = await IB.sb.from('rutas').insert(row));
        }
        if(error) e1 = error; else stored = true;
      }catch(ex){ e1 = ex; }
      if(stored && user && (user.user_metadata || {}).telefono !== S.phone){
        IB.sb.auth.updateUser({ data: { telefono: S.phone, nombre: (user.user_metadata || {}).nombre || S.name } }).catch(() => {});
      }
    }
    const notified = await IB.notify('viaje', {
      referencia: ref, marca: 'Zarping', tipo: TIPOS[S.tipo], nombre: S.name, email: S.email, telefono: S.phone, salida: S.from,
      destino: S.dest || 'Por decidir', fecha: (S.date ? fday(S.date) : 'sin fecha') + (S.flex ? ' (flexible)' : ''), dias: String(S.days),
      viajeros: String(S.pax), presupuesto: S.budget, incluir: S.inc.join(', '), grupo: S.group, menores: S.minors ? 'Sí' : 'No',
      publicidad: S.promo ? 'Sí' : 'No', notas: S.notes
    });
    sending = false; $('#zpNext').disabled = false; go(3);
    if(IB.enabled && !stored){ err(IB.errMsg(e1)); return; }
    if(!IB.enabled && !notified){ err('No hemos podido enviarlo ahora mismo. Escríbenos por WhatsApp y te respondemos igual de rápido.'); return; }
    try{ localStorage.removeItem(DRAFT); }catch(e){}
    done(ref);
  }
  function waText(ref){
    return `¡Hola Zarping! Soy ${S.name} y acabo de pedir un viaje (ref. ${ref}).\n` +
      `${TIPOS[S.tipo]} · ${S.dest || 'destino por decidir'} · desde ${S.from}\n` +
      `${S.pax} personas · ${S.days} días · ${S.date ? fday(S.date) : 'fecha por decidir'}${S.flex ? ' (flexible)' : ''}\nPresupuesto: ${S.budget}`;
  }
  function done(ref){
    const box = $('#zpDone');
    form.hidden = true; $('.zp-sum').hidden = true;
    box.innerHTML = `
      <span class="zp-done-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M20 6L9 17l-5-5"/></svg></span>
      <span class="eyebrow">Viaje recibido</span>
      <h2>¡Gracias, ${esc(S.name.split(' ')[0])}! Ya estamos con vuestro plan.</h2>
      <p>Te escribimos al <b>${esc(S.phone)}</b> por WhatsApp con la propuesta y el precio por persona. Puedes seguirlo también desde tu cuenta.</p>
      <div class="zp-done-ref"><span>Referencia</span><b>${esc(ref)}</b><button type="button" class="pl-link" data-copy>Copiar</button></div>
      <div class="hero-actions">
        <a class="btn btn--primary" href="${esc(IB.wa(waText(ref)))}" target="_blank" rel="noopener">Escribir por WhatsApp</a>
        ${IB.enabled ? '<a class="btn btn--ghost" href="cuenta.html#rutas">Ver mis viajes</a>' : ''}
      </div>`;
    box.hidden = false; box.focus({ preventScroll: true });
    box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    box.querySelector('[data-copy]').addEventListener('click', e => IB.copy(ref).then(ok => { if(ok) e.target.textContent = 'Copiada'; }));
    try{ if(window.IBLive && IBLive.log) IBLive.log('viaje_enviado', { ref }); }catch(e){}
  }

  /* ---------- eventos ---------- */
  form.addEventListener('input', () => { read(); save(); paintSum(); });
  form.addEventListener('change', e => { read(); save(); paintSum(); if(e.target.name === 'tipo'){ suggest(); err(''); } });
  form.addEventListener('click', e => {
    const b = e.target.closest('[data-n]'); if(!b) return;
    const k = b.dataset.n, d = Number(b.dataset.d);
    if(k === 'days') S.days = Math.min(30, Math.max(1, S.days + d)); else S.pax = Math.min(300, Math.max(2, S.pax + d));
    $('#zpDays').textContent = S.days; $('#zpPax').textContent = S.pax; save(); paintSum();
  });
  $('#zpNext').addEventListener('click', () => { read(); save(); if(step < TOTAL){ if(valid(step)) go(step + 1); } else send(); });
  $('#zpBack').addEventListener('click', () => { err(''); go(Math.max(1, step - 1)); });
  form.addEventListener('submit', e => e.preventDefault());

  (async function init(){
    load(); fill(); paintSum(); go(1);
    user = await IB.getUser();
    if(user){
      const md = user.user_metadata || {};
      if(!S.name) S.name = md.nombre || md.name || '';
      if(!S.phone) S.phone = md.telefono || '';
      S.email = user.email;
      $('#zpName').value = S.name; $('#zpPhone').value = S.phone; $('#zpEmail').value = S.email; $('#zpEmail').readOnly = true;
      // vuelve de crear la cuenta con el formulario ya relleno: directo al último paso
      if(S.tipo && (S.date || S.flex)) go(3);
    }
    go(step);
  })();
})();
