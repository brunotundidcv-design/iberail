/* Iberail — pago con tarjeta (Stripe Checkout) desde «Mis grupos»
   El importe lo calcula el servidor (función stripe-checkout): aquí solo se dice de qué grupo es el pago. */
(function(){
  const IB = window.IB;
  if(!IB) return;

  async function startPayment(btn, groupId){
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
        body: JSON.stringify({ grupo_id: Number(groupId) })
      });
      const j = await res.json().catch(() => ({}));
      if(!res.ok || !j.url) throw new Error(j.error || (res.status === 404 ? 'El pago con tarjeta aún no está activado.' : `Error ${res.status}`));
      location.href = j.url;   // página de pago de Stripe
    }catch(e){
      btn.disabled = false;
      btn.innerHTML = label;
      alert('No hemos podido abrir el pago: ' + (e.message || 'error desconocido'));
    }
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-stripe-group]');
    if(!btn || btn.disabled) return;
    e.preventDefault();
    startPayment(btn, btn.dataset.stripeGroup);
  });

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
