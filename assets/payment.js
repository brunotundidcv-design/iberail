/* Iberail — pago con Mollie (tarjeta y los métodos activados en Mollie) desde «Mis grupos»
   El importe lo calcula el servidor (función mollie-checkout): aquí solo se dice de qué grupo es el pago.
   (Antes era Stripe: las funciones stripe-* siguen en el repo pero la web ya no las llama.) */
(function(){
  const IB = window.IB;
  if(!IB) return;

  const eur = n => Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const PART_MIN = 20;

  /* PAUSA: con PAGOS_PAUSA = true no se abre el pago: al pulsar «Pagar» sale un aviso.
     Además, si la función mollie-checkout aún no está desplegada (o le falta la clave), sale el mismo aviso. */
  const PAGOS_PAUSA = false;
  const FUNCION = 'mollie-checkout';

  function avisoPausa(){
    if(document.querySelector('.pay-note.is-pausa')) return;
    const n = document.createElement('div');
    n.className = 'pay-note is-pausa';
    n.setAttribute('role', 'status');
    const wa = (IB.cfg && IB.cfg.WA_PHONE) || '34930491439';
    n.innerHTML = '<b>Pagos en mantenimiento</b><span>Nuestra pasarela de pago está dando problemas y la estamos cambiando por una nueva. '
      + 'Ahora mismo no se puede pagar con tarjeta y no se te ha cobrado nada. Si necesitas pagar ya, '
      + `<a href="https://wa.me/${wa}?text=${encodeURIComponent(`Hola ${(IB.brand && IB.brand.nombre) || 'Iberail'}, quiero hacer un pago de mi viaje`)}" target="_blank" rel="noopener">escríbenos por WhatsApp</a>.</span>`;
    const close = document.createElement('button');
    close.type = 'button'; close.setAttribute('aria-label', 'Cerrar'); close.textContent = '×';
    close.onclick = () => n.remove();
    n.appendChild(close);
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('is-in'), 30);
    setTimeout(() => { n.classList.remove('is-in'); setTimeout(() => n.remove(), 400); }, 15000);
  }

  async function startPayment(btn, groupId, amount, extra){
    if(PAGOS_PAUSA) return avisoPausa();
    if(!IB.sb) return alert('No podemos conectar ahora mismo. Prueba en un momento.');
    const { data } = await IB.sb.auth.getSession();
    const token = data && data.session && data.session.access_token;
    if(!token){ location.href = 'cuenta.html?next=' + encodeURIComponent(location.pathname + location.hash); return; }

    const label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Abriendo el pago…';
    try{
      const res = await fetch(`${String(IB.cfg.SUPABASE_URL).replace(/\/$/, '')}/functions/v1/${FUNCION}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: IB.cfg.SUPABASE_ANON_KEY },
        body: JSON.stringify({ grupo_id: Number(groupId), ...(amount ? { importe: amount } : {}), ...(extra || {}) })
      });
      const j = await res.json().catch(() => ({}));
      // función sin desplegar o sin clave de Mollie: aviso de mantenimiento en vez de un error
      if(res.status === 404 || (res.status >= 500 && /api.?key|unauthori[sz]ed|authenticat/i.test(j.error || ''))){ btn.disabled = false; btn.innerHTML = label; return avisoPausa(); }
      if(!res.ok || !j.url) throw new Error(j.error || (res.status === 404 ? 'El pago con tarjeta aún no está activado.' : `Error ${res.status}`));
      location.href = j.url;   // página de pago de Mollie
    }catch(e){
      btn.disabled = false;
      btn.innerHTML = label;
      const red = /NetworkError|Failed to fetch|Load failed/i.test(e.message || '');
      alert('No hemos podido abrir el pago: ' + (red ? 'no hay conexión con el servidor de pagos. Prueba en un momento y, si sigue, escríbenos por WhatsApp.' : (e.message || 'error desconocido')));
      console.error('Pago Mollie:', e);
    }
  }

  window.IBPay = { start: startPayment };   // seguro.js: IBPay.start(btn, grupo, null, { seguro: true }) → pago aparte del viaje

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-stripe-group]');
    if(btn && !btn.disabled){
      e.preventDefault();
      if(btn.dataset.amount){
        const inp = btn.closest('.gx-pay-partbox').querySelector('input');
        const v = Math.round(parseFloat(String(inp.value).replace(',', '.')) * 100) / 100, max = Number(btn.dataset.max);
        if(!(v >= PART_MIN) || v > max){ inp.focus(); inp.setCustomValidity(`Entre ${eur(PART_MIN)} y ${eur(max)}`); inp.reportValidity(); return; }
        return startPayment(btn, btn.dataset.stripeGroup, v);
      }
      return startPayment(btn, btn.dataset.stripeGroup);
    }
    // «Pagar una parte»: abre un recuadro para elegir cuánto
    const part = e.target.closest('[data-pay-part]');
    if(part){ e.preventDefault(); openPart(part); }
  });

  function openPart(part){
    const card = part.closest('.gx-pay');
    const open = card.querySelector('.gx-pay-partbox');
    if(open){ open.remove(); part.setAttribute('aria-expanded', 'false'); return; }
    const max = Number(part.dataset.max), sug = Math.max(PART_MIN, Math.round(max / 2));
    const box = document.createElement('div');
    box.className = 'gx-pay-partbox';
    box.innerHTML = `<label><span>¿Cuánto quieres pagar ahora?</span><span class="gx-pay-in"><input type="number" inputmode="decimal" min="${PART_MIN}" max="${max}" step="1" value="${sug}"><em>€</em></span></label>
      <div class="gx-pay-chips">${[0.25, 0.5].map(k => Math.round(max * k)).filter(v => v >= PART_MIN).map(v => `<button type="button" data-set="${v}">${eur(v)}</button>`).join('')}</div>
      <button type="button" class="gx-pay-cta" data-stripe-group="${part.dataset.payPart}" data-amount="1" data-max="${max}">Pagar ${eur(sug)}</button>
      <small>Mínimo ${eur(PART_MIN)}. El resto lo puedes pagar cuando quieras.</small>`;
    card.appendChild(box);
    part.setAttribute('aria-expanded', 'true');
    const inp = box.querySelector('input'), go = box.querySelector('.gx-pay-cta');
    const sync = () => { inp.setCustomValidity(''); const v = parseFloat(String(inp.value).replace(',', '.')); go.textContent = v > 0 ? `Pagar ${eur(Math.min(v, max))}` : 'Pagar'; };
    inp.addEventListener('input', sync);
    box.addEventListener('click', ev => { const b = ev.target.closest('[data-set]'); if(b){ inp.value = b.dataset.set; sync(); } });
    inp.focus(); inp.select();
  }

  /* enlace desde el correo: grupos.html?pagar=ID (&parte=1) → abre el pago de ese grupo en cuanto se pinta */
  const qs = new URLSearchParams(location.search);
  const pagar = qs.get('pagar');
  if(pagar && /^\d+$/.test(pagar)){
    const parte = qs.get('parte') === '1';
    const clean = () => { try{ qs.delete('pagar'); qs.delete('parte'); history.replaceState(null, '', location.pathname + (qs.toString() ? '?' + qs : '') + location.hash); }catch(e){} };
    const tryGo = () => {
      const btn = document.querySelector(`[data-stripe-group="${pagar}"]:not([data-amount])`);
      if(!btn) return false;
      clean();
      btn.closest('.gx-pay').scrollIntoView({ behavior: 'smooth', block: 'center' });
      const part = document.querySelector(`[data-pay-part="${pagar}"]`);
      if(parte && part) openPart(part); else startPayment(btn, pagar);
      return true;
    };
    if(!tryGo()){
      const mo = new MutationObserver(() => { if(tryGo()) mo.disconnect(); });
      mo.observe(document.body, { childList: true, subtree: true });
    }
  }

  /* vuelta desde Mollie: grupos.html?pago=ok | ?pago=cancelado */
  const estado = new URLSearchParams(location.search).get('pago');
  window.__ibPago = estado;   // live.js lo lee (esta URL se limpia enseguida)
  if(estado === 'ok' || estado === 'cancelado'){
    const ok = estado === 'ok';
    const n = document.createElement('div');
    n.className = 'pay-note' + (ok ? ' is-ok' : '');
    n.setAttribute('role', 'status');
    n.innerHTML = ok
      ? '<b>¡Gracias!</b><span>Si has completado el pago, en unos segundos lo verás apuntado en tu parte del viaje y te llegará el correo de confirmación.</span>'
      : '<b>Pago cancelado</b><span>No se ha cobrado nada. Puedes intentarlo otra vez cuando quieras.</span>';
    const close = document.createElement('button');
    close.type = 'button'; close.setAttribute('aria-label', 'Cerrar'); close.textContent = '×';
    close.onclick = () => n.remove();
    n.appendChild(close);
    document.body.appendChild(n);
    setTimeout(() => n.classList.add('is-in'), 30);
    setTimeout(() => { n.classList.remove('is-in'); setTimeout(() => n.remove(), 400); }, 9000);
    // quitamos ?pago= para que no vuelva a salir al recargar
    try{ history.replaceState(null, '', location.pathname + location.hash); }catch(e){}
  }
})();
