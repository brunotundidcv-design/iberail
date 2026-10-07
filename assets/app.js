/* Iberail — capa común: configuración, cuentas (Supabase), WhatsApp y avisos */
(function(){
  const C = window.IBERAIL_CONFIG || {};
  const IB = window.IB = {};
  IB.cfg = C;
  IB.configured = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
  IB.sb = null;
  try{
    if(IB.configured && window.supabase && window.supabase.createClient){
      IB.sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, {
        auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
      });
    }
  }catch(e){ IB.sb = null; }
  IB.enabled = !!IB.sb;           // cuentas activas en esta página
  IB.hasPhone = !!C.WA_PHONE;

  /* Un solo cliente de Supabase por página. En las páginas sin cuenta la librería se carga una vez, cuando
     alguien la pide (sorteo, «en directo»…): antes cada script cargaba la suya y había dos sesiones a la vez. */
  const SUPA_JS = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js';
  let sbPend = null;
  IB.ensureSb = () => {
    if(IB.sb) return Promise.resolve(IB.sb);
    if(!IB.configured) return Promise.resolve(null);
    return sbPend || (sbPend = new Promise(res => {
      const go = () => {
        try{ IB.sb = IB.sb || window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false } }); }
        catch(e){ IB.sb = null; }
        if(!IB.sb) sbPend = null;
        res(IB.sb);
      };
      if(window.supabase && window.supabase.createClient) return go();
      const s = document.createElement('script'); s.src = SUPA_JS; s.async = true; s.onload = go; s.onerror = () => { sbPend = null; res(null); };
      document.head.appendChild(s);
    }));
  };

  /* Marcas de la misma titular (Andrea Tundidor, IAE 755). El JS es común: cada web dice la suya en
     config.js (MARCA) y lo que depende del grupo (contrato, pagos) usa grupos.marca. */
  IB.BRANDS = {
    iberail: { key: 'iberail', nombre: 'Iberail', up: 'IBERAIL', web: 'iberail.com', site: 'https://iberail.com',
      email: 'info@iberail.com', protect: 'Iberail Protect', ruta: 'ruta', esta: 'esta ruta', color: '#C43730', word: 'ibe<i>rail</i>', planner: 'rutas.html', objeto: 'un viaje combinado por Europa en tren',
      pase: 'Pase Interrail', paseNo: 'pase Interrail y billetes de tren', paseDef: 'Pase Interrail Global en 2.ª clase, válido en los trenes incluidos en el pase',
      inv: link => `¡Me voy de Interrail con Iberail! Te montan la ruta a medida por Europa y lo organizan todo. Si vamos en grupo, regístrate con mi enlace: ${link}` },
    zarping: { key: 'zarping', nombre: 'Zarping', up: 'ZARPING', web: 'zarping.com', site: 'https://zarping.com',
      email: 'info@zarping.com', protect: 'Zarping Protect', ruta: 'viaje', esta: 'este viaje', color: '#7B5CFF', word: 'zarping', planner: 'monta-tu-viaje.html', objeto: 'un viaje combinado',
      pase: 'Forfait, entradas o actividades', paseNo: 'forfait, entradas y actividades', paseDef: 'Forfait, entradas o actividades indicadas en la ficha del grupo',
      inv: link => `¡Me voy de viaje con Zarping! Lo organizan todo para el grupo: transporte, alojamiento y planes. Regístrate con mi enlace: ${link}` }
  };
  IB.brandOf = m => IB.BRANDS[String(m || '').toLowerCase()] || IB.BRANDS[C.MARCA] || IB.BRANDS.iberail;
  IB.brand = IB.brandOf(C.MARCA);

  IB.esc = s => String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');

  /* WhatsApp: solo wa.me conserva el texto del mensaje */
  IB.wa = (text, phone) => {
    const num = String(phone || C.WA_PHONE || '').replace(/\D/g, '');
    if(!num) return C.WA_LINK || 'https://w.app/' + IB.brand.key;
    return `https://wa.me/${num}` + (text ? `?text=${encodeURIComponent(text)}` : '');
  };

  /* Sesión guardada por Supabase (se lee sin cargar la librería, para el menú) */
  IB.storedUser = () => {
    if(!IB.configured) return null;
    try{
      const ref = new URL(C.SUPABASE_URL).hostname.split('.')[0];
      const raw = localStorage.getItem(`sb-${ref}-auth-token`);
      if(!raw) return null;
      const s = JSON.parse(raw);
      const sess = s && (s.currentSession || s);
      return sess && sess.user ? sess.user : null;
    }catch(e){ return null; }
  };
  IB.getUser = async () => {
    if(!IB.sb) return null;
    try{
      const { data } = await IB.sb.auth.getSession();
      return data && data.session ? data.session.user : null;
    }catch(e){ return null; }
  };
  IB.firstName = u => {
    const n = (u && u.user_metadata && (u.user_metadata.nombre || u.user_metadata.name)) || (u && u.email ? u.email.split('@')[0] : '');
    return String(n).trim().split(/\s+/)[0] || '';
  };

  /* Traducción de los errores de Supabase */
  IB.errMsg = err => {
    const m = String((err && (err.message || err.error_description)) || err || '').toLowerCase();
    if(m.includes('invalid login')) return 'Correo o contraseña incorrectos.';
    if(m.includes('not confirmed')) return 'Tu correo aún no está verificado. Te enviamos un código nuevo.';
    if(m.includes('already registered') || m.includes('already been registered')) return 'Ya existe una cuenta con ese correo. Prueba a entrar.';
    if(m.includes('expired') || m.includes('invalid') && m.includes('token') || m.includes('otp')) return 'El código no es correcto o ha caducado. Pide uno nuevo.';
    if(m.includes('rate limit') || m.includes('security purposes') || m.includes('too many')) return 'Demasiados intentos seguidos. Espera un minuto y vuelve a probar.';
    if(m.includes('password') && (m.includes('least') || m.includes('short') || m.includes('weak'))) return 'La contraseña es demasiado corta o sencilla (mínimo 8 caracteres).';
    if(m.includes('same') && m.includes('password')) return 'La nueva contraseña debe ser distinta de la anterior.';
    if(m.includes('valid email') || m.includes('invalid email') || m.includes('email address')) return 'Revisa el correo: no parece válido.';
    if(m.includes('fetch') || m.includes('network') || m.includes('failed to')) return 'No hay conexión. Revisa internet y vuelve a intentarlo.';
    if(m.includes('row-level security') || m.includes('permission')) return 'No tienes permiso para hacer esto.';
    return 'Algo no ha ido bien. Vuelve a intentarlo en un momento.';
  };

  /* Aviso por correo con Netlify Forms (respaldo: te llega un email por cada ruta) */
  IB.notify = async (formName, fields) => {
    try{
      const body = new URLSearchParams({ 'form-name': formName, ...fields }).toString();
      const r = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
      return r.ok;
    }catch(e){ return false; }
  };

  IB.copy = async text => {
    try{ await navigator.clipboard.writeText(text); return true; }
    catch(e){
      try{
        const t = document.createElement('textarea'); t.value = text; t.style.position = 'fixed'; t.style.opacity = '0';
        document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok;
      }catch(_){ return false; }
    }
  };

  IB.safeNext = n => (n && /^[a-z0-9_-]+\.html(#[a-z0-9_-]*)?$/i.test(n)) ? n : null;

  /* «Invita y gana»: quien entra con ?ref=codigo queda apuntado al registrarse (30 días) */
  const REF_KEY = 'ib-ref', REF_RE = /^[a-z0-9]{4,20}$/;
  try{
    const r = String(new URLSearchParams(location.search).get('ref') || '').trim().toLowerCase();
    if(REF_RE.test(r)) localStorage.setItem(REF_KEY, JSON.stringify({ c: r, t: Date.now() }));
  }catch(e){}
  IB.pendingRef = () => {
    try{ const x = JSON.parse(localStorage.getItem(REF_KEY) || 'null'); if(x && REF_RE.test(x.c) && Date.now() - x.t < 30 * 864e5) return x.c; }catch(e){}
    return null;
  };
  let refTried = false;
  async function claimRef(user){
    if(refTried || !user || !IB.sb) return;
    const md = user.user_metadata || {};
    const code = IB.pendingRef() || (REF_RE.test(md.ref || '') ? md.ref : null);
    if(!code) return;
    const doneKey = 'ib-ref-ok-' + user.id;
    try{ if(localStorage.getItem(doneKey)) return; }catch(e){}
    refTried = true;
    try{
      const { data, error } = await IB.sb.rpc('registrar_referido', { c: code });
      if(error) return;          // p. ej. el archivo 9 aún no está activado: se reintenta otro día
      try{ localStorage.removeItem(REF_KEY); localStorage.setItem(doneKey, data || '1'); }catch(e){}
    }catch(e){}
  }
  IB.claimRef = claimRef;


  /* Menú: botón de cuenta (solo si las cuentas están configuradas) */
  function paintAccount(user){
    const a = document.querySelector('[data-acct]');
    const m = document.querySelector('[data-acct-m]');
    if(!IB.configured){ return; }
    if(a){
      a.hidden = false;
      const t = a.querySelector('.acct-t');
      if(user){ t.textContent = IB.firstName(user) || 'Mi cuenta'; a.classList.add('is-in'); a.setAttribute('aria-label', 'Mi cuenta'); }
      else { t.textContent = 'Entrar'; a.classList.remove('is-in'); }
    }
    if(m){ m.hidden = false; m.querySelector('span').textContent = user ? 'Mi cuenta' : 'Entrar / Crear cuenta'; }
    // «Mis grupos» en el menú, solo con la sesión iniciada
    document.querySelectorAll('[data-acct-only]').forEach(el => { el.hidden = !user; });
    document.body.classList.toggle('has-acct', !!user);
  }
  IB.paintAccount = paintAccount;
  paintAccount(IB.storedUser());
  if(IB.sb){
    const su = IB.storedUser(); if(su && IB.pendingRef()) setTimeout(() => claimRef(su), 0);
    IB.sb.auth.onAuthStateChange((_ev, session) => {
      paintAccount(session ? session.user : null);
      // fuera del callback: Supabase no deja hacer consultas dentro de él
      if(session && session.user) setTimeout(() => claimRef(session.user), 0);
    });
  }
})();
