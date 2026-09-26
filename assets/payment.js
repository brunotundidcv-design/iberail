/* Iberail — integración con Stripe para pagos de grupos */
(function(){
  const IB = window.IB;
  if(!IB) return;

  const STRIPE_PUBLIC_KEY = ''; // Se carga desde config.js cuando tengamos la clave real
  let stripe = null;

  /* Inicializar Stripe cuando se carga la clave */
  function initStripe(key){
    if(!key || stripe) return;
    if(!window.Stripe) return console.error('Librería Stripe no cargada');
    try{
      stripe = window.Stripe(key);
      console.log('✓ Stripe inicializado');
    } catch(e){
      console.error('✗ Error inicializando Stripe:', e);
    }
  }

  /* Crear una sesión de pago en Supabase y redirigir a Checkout */
  async function startPayment(groupId, amount){
    if(!stripe) return alert('Stripe no está disponible. Intenta de nuevo en un momento.');
    if(amount <= 0) return alert('No hay cantidad a pagar.');

    const user = IB.storedUser && IB.storedUser();
    if(!user) return alert('Debes estar conectado para pagar.');

    try{
      // Llamar a edge function de Supabase que crea la sesión
      const sbUrl = IB.cfg && IB.cfg.SUPABASE_URL ? IB.cfg.SUPABASE_URL.replace(/\/$/, '') : 'https://yyuydlaiiaynqutasxaz.supabase.co';
      const res = await fetch(`${sbUrl}/functions/v1/stripe-checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          groupId,
          amount: Math.round(amount * 100), // Stripe usa centésimas
          userEmail: user.email,
          userId: user.id
        })
      });

      if(!res.ok) throw new Error(`HTTP ${res.status}`);
      const { sessionId, error } = await res.json();
      if(error) throw new Error(error);

      // Redirigir a Stripe Checkout
      const { error: stripeError } = await stripe.redirectToCheckout({ sessionId });
      if(stripeError) throw stripeError;
    } catch(e){
      console.error('Error en pago:', e);
      alert('No pudimos procesar el pago: ' + (e.message || 'error desconocido'));
    }
  }

  /* Event listener para botones de pago */
  document.addEventListener('click', e => {
    const btn = e.target.closest('[data-stripe-payment]');
    if(!btn) return;
    e.preventDefault();

    const val = btn.dataset.stripePayment; // formato: "groupId-amount"
    const [gid, amt] = val.split('-');
    if(!gid || !amt) return;

    const amount = parseFloat(amt);
    startPayment(gid, amount);
  });

  /* Carga Stripe solo si hay clave configurada (sin clave no se carga nada de terceros) */
  const KEY = IB.cfg && IB.cfg.STRIPE_PUBLIC_KEY;
  if(KEY){
    if(window.Stripe) initStripe(KEY);
    else {
      const s = document.createElement('script');
      s.src = 'https://js.stripe.com/v3/';
      s.onload = () => initStripe(KEY);
      document.head.appendChild(s);
    }
  }

  /* Exportar para uso desde cuenta.js */
  window.IBPayment = {
    init: initStripe,
    start: startPayment
  };
})();
