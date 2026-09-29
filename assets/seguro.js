/* Iberail — «Iberail Protect», el seguro de viaje que se ofrece en cada grupo
   · «Mis grupos» (cuenta.js pinta <div data-seguro="ID">): tarjeta con todo lo que cubre y «Contratar y pagar»:
     pago APARTE del viaje en Stripe (stripe-checkout con seguro:true); el webhook lo apunta en `seguros` como pagado.
     No toca el presupuesto del viaje (grupo_miembros.importe) ni la tabla pagos.
   · Panel (panel.js pinta <section data-seguro-admin="ID">): activar la oferta, precio, plan, fecha límite
     y seguir quién lo ha pedido / contratado (nº de póliza).
   SQL: supabase/sql/seguros.sql (tablas seguro_ofertas, seguros + RPC anular_seguro). */
(function(){
  const IB = window.IB;
  if(!IB) return;
  const esc = IB.esc;
  const NOMBRE = 'Iberail Protect';
  const eur = n => { const [i, d] = Math.abs(Number(n) || 0).toFixed(2).split('.'); return i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + (d === '00' ? '' : ',' + d) + ' €'; };
  const fd = iso => iso ? new Date(String(iso).slice(0, 10) + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'long' }) : '';
  const dias = iso => iso ? Math.ceil((new Date(String(iso).slice(0, 10) + 'T23:59:59') - new Date()) / 864e5) : null;

  const S = {
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
    med: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 11c0 5.6-7 10-7 10z"/><path d="M12 9v6M9 12h6"/></svg>',
    undo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/></svg>',
    bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="7" width="14" height="13" rx="2"/><path d="M9 7V5a3 3 0 0 1 6 0v2M9 11v5M15 11v5"/></svg>',
    plane: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 16l20-7-4 11-5-4-4 3 1-5z"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
    law: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v18M5 21h14M5 7h14M7 7l-3 7h6zM17 7l-3 7h6z"/></svg>',
    ball: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>',
    wifi: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0"/><circle cx="12" cy="19.5" r="1"/></svg>',
    clock: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    ok: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5L20 7"/></svg>'
  };
  // coberturas máximas por persona (según el plan contratado con la aseguradora)
  const PLANES = {
    completo: {
      titulo: 'Protección completa',
      top: [['med', '5.000.000 €', 'Gastos médicos'], ['undo', '5.000 €', 'Cancelación del viaje', 'c'], ['bag', '2.500 €', 'Robo o pérdida de equipaje']],
      lista: [
        ['med', 'Gastos médicos en el extranjero', 'hasta 5.000.000 €'],
        ['home', 'Repatriación o transporte sanitario', 'ilimitado'],
        ['undo', 'Cancelación del viaje (35 causas: enfermedad, accidente, problema familiar grave…)', 'hasta 5.000 €', 'c'],
        ['undo', 'Interrupción del viaje', 'hasta 3.500 €'],
        ['bag', 'Robo, daños o pérdida de equipaje', 'hasta 2.500 €'],
        ['bag', 'Retraso en la entrega de la maleta', 'hasta 350 €'],
        ['plane', 'Cancelación de vuelo u overbooking', 'hasta 500 €'],
        ['plane', 'Retraso del transporte', 'hasta 350 €'],
        ['plane', 'Pérdida de reservas por retraso', 'hasta 300 €'],
        ['plane', 'Sala VIP si se retrasa el vuelo', 'incluido'],
        ['law', 'Responsabilidad civil', 'hasta 80.000 €'],
        ['law', 'Accidentes en viaje', 'hasta 10.000 €'],
        ['law', 'Asesoramiento jurídico durante el viaje', 'incluido'],
        ['ball', 'Actividades deportivas por diversión', 'incluido'],
        ['wifi', 'eSIM con 1 GB de datos para Europa', 'de regalo']
      ]
    },
    basico: {
      titulo: 'Lo esencial',
      top: [['med', '300.000 €', 'Gastos médicos'], ['undo', '2.500 €', 'Cancelación del viaje', 'c'], ['bag', '1.500 €', 'Robo o pérdida de equipaje']],
      lista: [
        ['med', 'Gastos médicos en el extranjero', 'hasta 300.000 €'],
        ['home', 'Repatriación o transporte sanitario', 'ilimitado'],
        ['undo', 'Cancelación del viaje (11 causas: enfermedad, accidente, problema familiar grave…)', 'hasta 2.500 €', 'c'],
        ['undo', 'Interrupción del viaje', 'hasta 1.500 €'],
        ['bag', 'Robo, daños o pérdida de equipaje', 'hasta 1.500 €'],
        ['bag', 'Retraso en la entrega de la maleta', 'hasta 200 €'],
        ['plane', 'Cancelación de vuelo u overbooking', 'hasta 300 €'],
        ['plane', 'Retraso del transporte', 'hasta 150 €'],
        ['law', 'Responsabilidad civil', 'hasta 60.000 €'],
        ['law', 'Accidentes en viaje', 'hasta 6.000 €'],
        ['ball', 'Actividades deportivas por diversión', 'incluido']
      ]
    }
  };
  const plan = o => PLANES[o && o.plan] || PLANES.completo;
  const visible = (o, x) => !x[3] || o.cancelacion;
  const legal = o => `${NOMBRE} es un seguro de viaje gestionado por Iberail y emitido por una aseguradora autorizada en España${o.aseguradora ? ` (${esc(o.aseguradora)})` : ''}. Importes máximos por persona. Las condiciones completas y el teléfono de asistencia 24 h vienen en tu certificado.`;

  /* ======================= «Mis grupos» ======================= */
  const C = {};   // grupo → { oferta, seguro }
  async function loadCli(gid){
    const { data: s } = await IB.sb.auth.getSession(), uid = s && s.session && s.session.user ? s.session.user.id : null;
    if(!uid) return (C[gid] = null);
    const [o, g] = await Promise.all([
      IB.sb.from('seguro_ofertas').select('*').eq('grupo_id', Number(gid)).maybeSingle(),
      IB.sb.from('seguros').select('*').eq('grupo_id', Number(gid)).eq('user_id', uid).neq('estado', 'anulado').limit(1)
    ]);
    return (C[gid] = o.error ? null : { oferta: o.data, seguro: (g.data || [])[0] || null });
  }
  function cliHtml(gid){
    const c = C[gid]; if(!c) return '';
    const o = c.oferta, s = c.seguro;
    if(!s && (!o || !o.activo)) return '';
    if(s && s.estado === 'solicitado' && (!o || !o.activo)) return '';
    const mine = s && s.estado !== 'solicitado' ? s : null;
    const p = plan(mine || o), oo = mine ? { ...o, plan: mine.plan, cancelacion: mine.cancelacion } : o;
    const d = o && o.limite ? dias(o.limite) : null, cerrado = !mine && d != null && d < 0;
    if(cerrado) return '';
    const pagado = s && (s.estado === 'pagado' || s.estado === 'contratado');
    const estado = !pagado ? '' : s.estado === 'contratado'
      ? `<div class="sg-state is-ok">${S.ok}<div><b>Estás protegido</b><span>${s.poliza ? `Póliza nº ${esc(s.poliza)}. ` : ''}Tu certificado está en los documentos de tu grupo.</span></div></div>`
      : `<div class="sg-state">${S.ok}<div><b>Pagado · lo estamos activando</b><span>Hemos recibido tu pago de ${esc(eur(s.precio))}. En breve te enviamos tu certificado con el teléfono de asistencia 24 h.</span></div></div>`;
    return `<article class="sg-card${mine ? ' is-mine' : ''}">
      <div class="sg-glow" aria-hidden="true"></div>
      <header class="sg-head">
        <span class="sg-shield">${S.shield}</span>
        <div><small>Seguro de viaje</small><h3>${NOMBRE}</h3><p>${esc(p.titulo)} · viaja tranquilo de principio a fin</p></div>
        ${mine ? '' : `<div class="sg-price"><b>${esc(eur(o.precio))}</b><small>por persona, todo el viaje</small></div>`}
      </header>
      <div class="sg-top">${p.top.filter(x => visible(oo, x)).map(([i, v, t]) => `<div class="sg-tile">${S[i]}<b>${esc(v)}</b><small>${esc(t)}</small></div>`).join('')}</div>
      <details class="sg-more"><summary>Ver todo lo que cubre</summary>
        <ul>${p.lista.filter(x => visible(oo, x)).map(([i, t, v]) => `<li>${S[i]}<span>${esc(t)}</span><b>${esc(v)}</b></li>`).join('')}</ul>
      </details>
      ${estado || `<div class="sg-cta">
        ${d != null ? `<span class="sg-limit${d <= 3 ? ' is-hot' : ''}">${S.clock}${d === 0 ? 'Último día para añadirlo' : `Disponible hasta el ${esc(fd(o.limite))} · ${d === 1 ? 'queda 1 día' : `quedan ${d} días`}`}</span>` : ''}
        <button type="button" class="sg-btn" data-sg-add="${esc(gid)}">${S.shield}Contratar y pagar · ${esc(eur(o.precio))}</button>
        ${oo.cancelacion ? '<small class="sg-tip">Añádelo cuanto antes: la cancelación te cubre desde que lo contratas.</small>' : ''}
      </div>`}
      <p class="sg-legal">${legal(o || {})}</p>
    </article>`;
  }
  const paintCli = gid => document.querySelectorAll(`[data-seguro="${gid}"]`).forEach(el => { el.innerHTML = cliHtml(gid); });
  async function mountCli(el){
    const gid = el.dataset.seguro; el.dataset.sgMounted = '1';
    if(C[gid] !== undefined) el.innerHTML = cliHtml(gid);
    await loadCli(gid); if(el.isConnected) el.innerHTML = cliHtml(gid);
  }
  function pedir(btn){
    const gid = btn.dataset.sgAdd, o = C[gid] && C[gid].oferta; if(!o) return;
    if(!window.IBPay) return alert('No podemos abrir el pago ahora mismo. Prueba en un momento.');
    if(!confirm(`¿Contratar ${NOMBRE} por ${eur(o.precio)}?\n\nSe paga aparte del viaje, en la pasarela de pago segura (tarjeta, Apple Pay o Google Pay).`)) return;
    dispatchEvent(new CustomEvent('ib:seguro', { detail: { precio: o.precio } }));
    IBPay.start(btn, gid, null, { seguro: true });
  }
  // vuelta desde Stripe: grupos.html?seguro=ok | ?seguro=cancelado
  (function(){
    const q = new URLSearchParams(location.search), v = q.get('seguro');
    if(v !== 'ok' && v !== 'cancelado') return;
    const n = document.createElement('div'); n.className = 'pay-note' + (v === 'ok' ? ' is-ok' : ''); n.setAttribute('role', 'status');
    n.innerHTML = v === 'ok' ? `<b>¡${NOMBRE} contratado!</b><span>Hemos recibido tu pago. En breve te enviamos tu certificado.</span>` : '<b>Pago cancelado</b><span>No se ha cobrado nada. Puedes contratar el seguro cuando quieras.</span>';
    const x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Cerrar'); x.textContent = '×'; x.onclick = () => n.remove(); n.appendChild(x);
    const go = () => { document.body.appendChild(n); setTimeout(() => n.classList.add('is-in'), 30); setTimeout(() => { n.classList.remove('is-in'); setTimeout(() => n.remove(), 400); }, 9000); };
    if(document.body) go(); else addEventListener('DOMContentLoaded', go);
    try{ q.delete('seguro'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); }catch(e){}
  })();

  /* ======================= panel ======================= */
  const A = {};
  async function loadAdm(gid){
    const [o, s, m, cl] = await Promise.all([
      IB.sb.from('seguro_ofertas').select('*').eq('grupo_id', Number(gid)).maybeSingle(),
      IB.sb.from('seguros').select('*').eq('grupo_id', Number(gid)).neq('estado', 'anulado'),
      IB.sb.from('grupo_miembros').select('user_id').eq('grupo_id', Number(gid)),
      IB.sb.rpc('buscar_clientes', { q: '' })
    ]);
    const nombres = {}; (cl.data || []).forEach(x => nombres[x.id] = x);
    A[gid] = { ...(A[gid] || {}), oferta: o.data, seguros: s.data || [], miembros: (m.data || []).map(x => x.user_id), nombres, err: (o.error || s.error) ? (o.error || s.error).message : '' };
  }
  function admHtml(gid){
    const a = A[gid]; if(!a) return '';
    const head = `<div class="adm-docs-head"><h3>${S.shield}${NOMBRE} · seguro de viaje</h3><small>${a.seguros.filter(x => x.estado === 'contratado').length} contratados · ${a.seguros.filter(x => x.estado === 'pagado').length} pagados por contratar</small></div>`;
    if(a.err) return head + '<p class="adm-docs-empty is-err">Falta crear las tablas: ejecuta <b>supabase/sql/seguros.sql</b> en Supabase.</p>';
    const o = a.oferta || { activo: false, plan: 'completo', cancelacion: true, precio: '', limite: '', aseguradora: '' };
    const who = uid => { const c = a.nombres[uid]; return c ? (c.nombre || String(c.email || '').split('@')[0]) : 'Viajero'; };
    const rows = a.miembros.map(uid => {
      const s = a.seguros.find(x => x.user_id === uid);
      const acts = !s ? (a.oferta ? `<span class="ct-st sg-st-no">Sin seguro</span><button type="button" class="ct-link" data-sg-give="${esc(gid)}:${esc(uid)}" title="Si te lo ha pagado por Bizum o transferencia">Marcar pagado</button>` : '<span class="ct-st sg-st-no">Sin seguro</span>')
        : s.estado === 'solicitado' ? `<span class="ct-st sg-st-no">Sin pagar</span><button type="button" class="ct-link" data-sg-void="${esc(gid)}:${esc(s.id)}">Quitar</button>`
        : s.estado === 'contratado' ? `<span class="ct-st is-ok">${S.ok}Contratado${s.poliza ? ' · ' + esc(s.poliza) : ''}</span><button type="button" class="ct-link" data-sg-void="${esc(gid)}:${esc(s.id)}">Anular</button>`
        : `<span class="ct-st">Pagado · ${esc(eur(s.precio))}</span><input class="sg-pol" data-sg-pol="${esc(s.id)}" placeholder="Nº de póliza"><button type="button" class="btn btn--dark btn--sm" data-sg-done="${esc(gid)}:${esc(s.id)}">Contratado</button><button type="button" class="ct-link" data-sg-void="${esc(gid)}:${esc(s.id)}">Anular</button>`;
      return `<div class="ct-row"><div><b>${esc(who(uid))}</b><small>${esc((a.nombres[uid] || {}).email || '')}</small></div><div class="ct-acts">${acts}</div></div>`;
    }).join('');
    return head + `
      <div class="sg-adm-form" data-sg-form="${esc(gid)}">
        <label class="sg-switch"><input type="checkbox" data-f="activo"${o.activo ? ' checked' : ''}><span>Ofrecer el seguro a este grupo</span></label>
        <div class="ct-cond-grid">
          <label>Plan<select data-f="plan"><option value="completo"${o.plan === 'completo' ? ' selected' : ''}>Completo (médicos 5 M€, cancelación 5.000 €)</option><option value="basico"${o.plan === 'basico' ? ' selected' : ''}>Básico (médicos 300.000 €, cancelación 2.500 €)</option></select></label>
          <label>Precio por persona (€)<input data-f="precio" inputmode="decimal" value="${esc(o.precio)}" placeholder="57,35"></label>
          <label>Disponible hasta<input data-f="limite" type="date" value="${esc(o.limite || '')}"></label>
          <label class="sg-inline"><input type="checkbox" data-f="cancelacion"${o.cancelacion ? ' checked' : ''}> Incluye cancelación del viaje</label>
          <label class="ct-wide">Aseguradora (se muestra en letra pequeña; por ley el cliente debe poder saber quién le asegura)<input data-f="aseguradora" value="${esc(o.aseguradora || '')}" placeholder="Nombre de la aseguradora de la póliza"></label>
        </div>
        <button type="button" class="btn btn--dark btn--sm" data-sg-save="${esc(gid)}">Guardar</button>
      </div>
      ${a.miembros.length ? `<div class="ct-list">${rows}</div>` : ''}
      <p class="adm-hint">Se paga aparte del viaje (no cambia su presupuesto). Cuando salga «Pagado», contrátalo con sus datos, sube el certificado a sus documentos y márcalo como «Contratado».</p>
      <p class="ct-msg" data-sg-msg="${esc(gid)}"></p>`;
  }
  const paintAdm = gid => document.querySelectorAll(`[data-seguro-admin="${gid}"]`).forEach(el => { el.innerHTML = admHtml(gid); });
  async function mountAdm(el){
    const gid = el.dataset.seguroAdmin; el.dataset.sgMounted = '1';
    if(A[gid]) el.innerHTML = admHtml(gid);
    await loadAdm(gid); if(el.isConnected) el.innerHTML = admHtml(gid);
  }
  const msg = (gid, t, bad) => { const m = document.querySelector(`[data-sg-msg="${gid}"]`); if(m){ m.textContent = t; m.classList.toggle('is-err', !!bad); } };
  async function save(gid){
    const f = document.querySelector(`[data-sg-form="${gid}"]`), v = k => f.querySelector(`[data-f="${k}"]`);
    const precio = Math.round(parseFloat(String(v('precio').value).replace(',', '.')) * 100) / 100;
    if(!(precio > 0)) return msg(gid, 'Pon el precio por persona.', true);
    const row = { grupo_id: Number(gid), activo: v('activo').checked, plan: v('plan').value, cancelacion: v('cancelacion').checked, precio, limite: v('limite').value || null, aseguradora: v('aseguradora').value.trim() || null, updated_at: new Date().toISOString() };
    const { error } = await IB.sb.from('seguro_ofertas').upsert(row);
    if(error) return msg(gid, 'Error: ' + error.message, true);
    await loadAdm(gid); paintAdm(gid); msg(gid, row.activo ? 'Guardado. El grupo ya lo ve en «Mis grupos».' : 'Guardado. La oferta está desactivada.');
  }
  async function give(gid, uid){
    const o = A[gid] && A[gid].oferta; if(!o) return;
    if(!confirm(`¿Marcar ${NOMBRE} como pagado por este viajero (${eur(o.precio)}, por Bizum o transferencia)? No cambia su presupuesto del viaje.`)) return;
    const { error } = await IB.sb.from('seguros').insert({ grupo_id: Number(gid), user_id: uid, precio: o.precio, plan: o.plan, cancelacion: o.cancelacion, estado: 'pagado', pagado_at: new Date().toISOString() });
    if(error) return msg(gid, 'Error: ' + error.message, true);
    await loadAdm(gid); paintAdm(gid); msg(gid, 'Marcado como pagado. Ahora contrátalo y márcalo como «Contratado».');
  }

  /* ======================= eventos ======================= */
  document.addEventListener('click', async e => {
    const t = e.target;
    const ad = t.closest('[data-sg-add]'); if(ad) return pedir(ad);
    const sv = t.closest('[data-sg-save]'); if(sv) return save(sv.dataset.sgSave);
    const gv = t.closest('[data-sg-give]'); if(gv){ const [gid, uid] = gv.dataset.sgGive.split(':'); return give(gid, uid); }
    const dn = t.closest('[data-sg-done]'); if(dn){ const [gid, id] = dn.dataset.sgDone.split(':'); const pol = (document.querySelector(`[data-sg-pol="${id}"]`) || {}).value || '';
      const { error } = await IB.sb.from('seguros').update({ estado: 'contratado', poliza: pol.trim() || null, contratado_at: new Date().toISOString() }).eq('id', Number(id));
      if(error) return msg(gid, 'Error: ' + error.message, true); await loadAdm(gid); paintAdm(gid); return; }
    const vd = t.closest('[data-sg-void]'); if(vd){ const [gid, id] = vd.dataset.sgVoid.split(':');
      if(!confirm('¿Anular este seguro? Si ya estaba pagado, la devolución hazla desde Stripe.')) return;
      const { error } = await IB.sb.rpc('anular_seguro', { p_id: Number(id) });
      if(error) return msg(gid, 'Error: ' + error.message, true); await loadAdm(gid); paintAdm(gid); }
  });

  const scan = () => {
    document.querySelectorAll('[data-seguro]:not([data-sg-mounted])').forEach(mountCli);
    document.querySelectorAll('[data-seguro-admin]:not([data-sg-mounted])').forEach(mountAdm);
  };
  new MutationObserver(scan).observe(document.documentElement, { childList: true, subtree: true });
  scan();
  window.IBSeguro = { PLANES, NOMBRE };
})();
