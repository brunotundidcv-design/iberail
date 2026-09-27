/* Iberail — pago con tarjeta (Stripe Checkout) desde «Mis grupos»
   El importe lo calcula el servidor (función stripe-checkout): aquí solo se dice de qué grupo es el pago. */
(function(){
  const IB = window.IB;
  if(!IB) return;

  const eur = n => Number(n).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';
  const PART_MIN = 20;

  async function startPayment(btn, groupId, amount){
    if(!IB.sb) return alert('No podemos conectar ahora mismo. Prueba en un momento.');
    const { data } = await IB.sb.auth.getSession();
    const token = data && data.session && data.session.access_token;
    if(!token){ location.href = 'cuenta.html?next=' + encodeURIComponent(location.pathname + location.hash); return; }

    const label = btn.innerHTML;
    btn.disabled = true;
    btn.textContent = 'Abriendo el pago…';
    try{
      const res = await fetch(`${String(IB.cfg.SUPABASE_URL).replace(/\/$/, '')}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, apikey: IB.cfg.SUPABASE_ANON_KEY },
        body: JSON.stringify(amount ? { grupo_id: Number(groupId), importe: amount } : { grupo_id: Number(groupId) })
      });
      const j = await res.json().catch(() => ({}));
      if(!res.ok || !j.url) throw new Error(j.error || (res.status === 404 ? 'El pago con tarjeta aún no está activado.' : `Error ${res.status}`));
      location.href = j.url;   // página de pago de Stripe
    }catch(e){
      btn.disabled = false;
      btn.innerHTML = label;
      const red = /NetworkError|Failed to fetch|Load failed/i.test(e.message || '');
      alert('No hemos podido abrir el pago: ' + (red ? 'no hay conexión con el servidor de pagos. Prueba en un momento y, si sigue, escríbenos por WhatsApp.' : (e.message || 'error desconocido')));
      console.error('Pago Stripe:', e);
    }
  }

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

  /* vuelta desde Stripe: grupos.html?pago=ok | ?pago=cancelado */
  const estado = new URLSearchParams(location.search).get('pago');
  if(estado === 'ok' || estado === 'cancelado'){
    const ok = estado === 'ok';
    const n = document.createElement('div');
    n.className = 'pay-note' + (ok ? ' is-ok' : '');
    n.setAttribute('role', 'status');
    n.innerHTML = ok
      ? '<b>¡Pago recibido!</b><span>En unos segundos lo verás apuntado en tu parte del viaje. Te llegará el recibo por correo.</span>'
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
