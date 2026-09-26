/* Iberail — cuenta: registro con código por correo, entrar, recuperar contraseña, mis rutas, mis grupos y avisos */
(function(){
  const IB = window.IB, root = document.getElementById('auth');
  if(!IB || !root) return;
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = IB.esc;
  const params = new URLSearchParams(location.search);
  const next = IB.safeNext(params.get('next'));
  const MODE = root.dataset.mode || 'cuenta';   // 'grupos' en grupos.html: página directa de «Mis grupos»
  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  const STATUS = {
    nueva: ['Recibida', 1], en_curso: ['Preparando tu presupuesto', 2],
    presupuesto_enviado: ['Presupuesto enviado', 3], cerrada: ['Reservada', 4], descartada: ['Archivada', 0]
  };
  let pendingEmail = '';
  try{ pendingEmail = sessionStorage.getItem('ib-pending-email') || ''; }catch(e){}
  const setPending = e => { pendingEmail = e; try{ sessionStorage.setItem('ib-pending-email', e); }catch(_){} };

  /* ---------- UI helpers ---------- */
  function show(view){
    $$('.auth-view', root).forEach(v => v.hidden = v.dataset.view !== view);
    root.dataset.view = view;
    document.body.classList.toggle('is-dash', view === 'dash');
    msg('');
    $$('[data-email]', root).forEach(b => b.textContent = pendingEmail);
    const v = $(`.auth-view[data-view="${view}"]`, root);
    const first = v && v.querySelector('input:not([type=checkbox]):not([readonly])');
    if(first && view !== 'dash' && window.innerWidth > 700) setTimeout(() => first.focus(), 60);
    if(view === 'codigo' || view === 'nueva') startCooldown(view === 'codigo' ? 'signup' : 'recovery');
  }
  function msg(text, ok){
    const m = $('#authMsg');
    m.hidden = !text; m.textContent = text || '';
    m.classList.toggle('is-ok', !!ok);
    if(text && !ok){ m.classList.remove('is-shake'); void m.offsetWidth; m.classList.add('is-shake'); }
  }
  function busy(form, on, label){
    const b = form.querySelector('button[type=submit]'); if(!b) return;
    b.disabled = on; b.classList.toggle('is-busy', on);
    const s = b.querySelector('span');
    if(on){ b.dataset.label = s.textContent; s.textContent = label || 'Un momento…'; }
    else if(b.dataset.label){ s.textContent = b.dataset.label; }
  }
  function finish(){
    try{ sessionStorage.removeItem('ib-pending-email'); }catch(e){}
    if(next){ location.href = next; return; }
    // al iniciar sesión se entra directo a «Mis grupos»
    // salvo si venía a una pestaña concreta (p. ej. el enlace iberail.com/cuenta#invita)
    if(MODE === 'cuenta' && !['rutas', 'avisos', 'invita'].includes(location.hash.slice(1))){ location.href = 'grupos.html'; return; }
    dash();
  }

  /* ---------- password fields ---------- */
  $$('.pw-toggle', root).forEach(b => b.addEventListener('click', () => {
    const i = document.getElementById(b.dataset.pw);
    const vis = i.type === 'password'; i.type = vis ? 'text' : 'password';
    b.setAttribute('aria-label', vis ? 'Ocultar contraseña' : 'Mostrar contraseña'); b.classList.toggle('is-on', vis);
  }));
  const strength = p => {
    let s = 0; if(p.length >= 8) s++; if(p.length >= 12) s++;
    if(/[A-Z]/.test(p) && /[a-z]/.test(p)) s++; if(/\d/.test(p) && /[^A-Za-z0-9]/.test(p)) s++;
    return Math.min(4, s);
  };
  const rp = $('#rePass');
  if(rp) rp.addEventListener('input', () => {
    const s = rp.value ? Math.max(1, strength(rp.value)) : 0;
    $('#pwMeter').dataset.s = s;
    $('#pwHint').textContent = !rp.value ? 'Mínimo 8 caracteres' : rp.value.length < 8 ? `Faltan ${8 - rp.value.length} caracteres` : ['', 'Débil', 'Aceptable', 'Buena', 'Muy segura'][s];
  });

  /* ---------- 6-digit code boxes ---------- */
  function wireOtp(box, onFull){
    const inputs = $$('input', box);
    const val = () => inputs.map(i => i.value).join('');
    const fill = (str, from) => {
      const d = str.replace(/\D/g, '').split('');
      let k = from;
      d.forEach(ch => { if(k < inputs.length){ inputs[k].value = ch; k++; } });
      inputs[Math.min(k, inputs.length - 1)].focus();
      box.classList.toggle('is-full', val().length === inputs.length);
      if(val().length === inputs.length) onFull(val());
    };
    inputs.forEach((inp, i) => {
      inp.addEventListener('input', () => {
        const v = inp.value.replace(/\D/g, '');
        inp.value = '';
        if(v) fill(v, i); else box.classList.remove('is-full');
      });
      inp.addEventListener('keydown', e => {
        if(e.key === 'Backspace' && !inp.value && i > 0){ inputs[i - 1].value = ''; inputs[i - 1].focus(); e.preventDefault(); box.classList.remove('is-full'); }
        if(e.key === 'ArrowLeft' && i > 0) inputs[i - 1].focus();
        if(e.key === 'ArrowRight' && i < inputs.length - 1) inputs[i + 1].focus();
      });
      inp.addEventListener('paste', e => { e.preventDefault(); fill((e.clipboardData || window.clipboardData).getData('text'), 0); });
      inp.addEventListener('focus', () => inp.select());
    });
    return { value: val, clear(){ inputs.forEach(i => i.value = ''); box.classList.remove('is-full'); inputs[0].focus(); }, error(){ box.classList.remove('is-err'); void box.offsetWidth; box.classList.add('is-err'); } };
  }

  /* ---------- resend with cooldown ---------- */
  let coolT;
  function startCooldown(type){
    const b = $(`[data-resend="${type}"]`, root); if(!b) return;
    let left = 45; b.disabled = true;
    const tick = () => { b.textContent = left > 0 ? `Reenviar código (${left}s)` : 'Reenviar código'; if(left <= 0){ b.disabled = false; clearInterval(coolT); } left--; };
    clearInterval(coolT); tick(); coolT = setInterval(tick, 1000);
  }
  $$('[data-resend]', root).forEach(b => b.addEventListener('click', async () => {
    if(!pendingEmail) return show('login');
    b.disabled = true;
    const { error } = b.dataset.resend === 'signup'
      ? await IB.sb.auth.resend({ type: 'signup', email: pendingEmail })
      : await IB.sb.auth.resetPasswordForEmail(pendingEmail);
    if(error){ msg(IB.errMsg(error)); b.disabled = false; return; }
    msg('Código reenviado. Puede tardar un minuto en llegar.', true);
    startCooldown(b.dataset.resend);
  }));
  ['input', 'change'].forEach(ev => root.addEventListener(ev, e => {
    const m = $('#authMsg');
    if(!m.hidden && !m.classList.contains('is-ok') && !e.target.closest('.otp')) msg('');
  }));
  $$('[data-to]', root).forEach(b => b.addEventListener('click', () => show(b.dataset.to)));

  /* ---------- forms ---------- */
  const fLogin = $('[data-view="login"]', root), fReg = $('[data-view="registro"]', root), fCode = $('[data-view="codigo"]', root);
  const fForgot = $('[data-view="olvido"]', root), fNew = $('[data-view="nueva"]', root);
  // quien llega con el enlace de un amigo lo ve al registrarse
  if(IB.pendingRef()){
    const sub = $('.auth-sub', fReg);
    if(sub) sub.insertAdjacentHTML('afterend', '<p class="auth-ref"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7M7.5 8a2.5 2.5 0 010-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 010 5"/></svg><span>Te registras con la invitación de un amigo</span></p>');
  }

  fReg.addEventListener('submit', async e => {
    e.preventDefault();
    const nombre = $('#reName').value.trim(), email = $('#reEmail').value.trim().toLowerCase(), pass = $('#rePass').value;
    if(nombre.length < 2) return msg('Escribe tu nombre.');
    if(!EMAIL_RE.test(email)) return msg('Revisa el correo: no parece válido.');
    if(pass.length < 8) return msg('La contraseña necesita al menos 8 caracteres.');
    if(!$('#reConsent').checked) return msg('Confirma que tienes 18 años o más y que aceptas el aviso legal y la política de privacidad.');
    busy(fReg, true, 'Creando tu cuenta…');
    const { data, error } = await IB.sb.auth.signUp({
      email, password: pass,
      // el código de invitación viaja con la cuenta (por si verifica el correo en otro dispositivo)
      options: { data: IB.pendingRef() ? { nombre, ref: IB.pendingRef() } : { nombre }, emailRedirectTo: location.origin + '/cuenta.html' }
    });
    busy(fReg, false);
    if(error) return msg(IB.errMsg(error));
    if(data && data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0){
      $('#liEmail').value = email; show('login');
      return msg('Ya existe una cuenta con ese correo. Entra con tu contraseña.');
    }
    setPending(email);
    if(data && data.session) return finish();
    show('codigo');
  });

  const otpCode = wireOtp($('#codeOtp'), () => fCode.requestSubmit ? fCode.requestSubmit() : fCode.dispatchEvent(new Event('submit', { cancelable: true })));
  fCode.addEventListener('submit', async e => {
    e.preventDefault();
    const token = otpCode.value();
    if(token.length < 6) return msg('Introduce los 6 dígitos del código.');
    busy(fCode, true, 'Verificando…');
    let { error } = await IB.sb.auth.verifyOtp({ email: pendingEmail, token, type: 'signup' });
    if(error){ const r = await IB.sb.auth.verifyOtp({ email: pendingEmail, token, type: 'email' }); error = r.error; }
    busy(fCode, false);
    if(error){ otpCode.error(); otpCode.clear(); return msg(IB.errMsg(error)); }
    msg('¡Correo verificado!', true);
    finish();
  });

  fLogin.addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#liEmail').value.trim().toLowerCase(), pass = $('#liPass').value;
    if(!EMAIL_RE.test(email)) return msg('Revisa el correo: no parece válido.');
    if(!pass) return msg('Escribe tu contraseña.');
    busy(fLogin, true, 'Entrando…');
    const { error } = await IB.sb.auth.signInWithPassword({ email, password: pass });
    busy(fLogin, false);
    if(error){
      if(/not confirmed/i.test(error.message || '')){
        setPending(email);
        await IB.sb.auth.resend({ type: 'signup', email });
        show('codigo');
        return msg('Tu correo aún no está verificado: te hemos enviado un código nuevo.', true);
      }
      return msg(IB.errMsg(error));
    }
    finish();
  });

  fForgot.addEventListener('submit', async e => {
    e.preventDefault();
    const email = $('#fgEmail').value.trim().toLowerCase();
    if(!EMAIL_RE.test(email)) return msg('Revisa el correo: no parece válido.');
    busy(fForgot, true, 'Enviando…');
    const { error } = await IB.sb.auth.resetPasswordForEmail(email);
    busy(fForgot, false);
    if(error) return msg(IB.errMsg(error));
    setPending(email); show('nueva');
    msg('Si hay una cuenta con ese correo, te llegará un código en un momento.', true);
  });

  const otpReset = wireOtp($('#resetOtp'), () => $('#nwPass').focus());
  fNew.addEventListener('submit', async e => {
    e.preventDefault();
    const token = otpReset.value(), pass = $('#nwPass').value;
    if(token.length < 6) return msg('Introduce los 6 dígitos del código.');
    if(pass.length < 8) return msg('La contraseña necesita al menos 8 caracteres.');
    busy(fNew, true, 'Guardando…');
    const v = await IB.sb.auth.verifyOtp({ email: pendingEmail, token, type: 'recovery' });
    if(v.error){ busy(fNew, false); otpReset.error(); otpReset.clear(); return msg(IB.errMsg(v.error)); }
    const u = await IB.sb.auth.updateUser({ password: pass });
    busy(fNew, false);
    if(u.error) return msg(IB.errMsg(u.error));
    finish();
  });

  /* ---------- dashboard ---------- */
  let chan = null, reloadT = null, refreshT = null, ownFiles = [], me = null;
  const I_PLANE = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 15.5v-2l-8-5V3.5a1.5 1.5 0 00-3 0V8.5l-8 5v2l8-2.5V18l-2 1.5V21l3.5-1 3.5 1v-1.5L13 18v-5z"/></svg>';
  const I_DOC = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h4"/></svg>';
  const I_USERS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.6a3.5 3.5 0 010 6.8M18 14.2a6.5 6.5 0 013.5 5.8"/></svg>';
  const normS = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const code = s => { const m = String(s || '').match(/\(([A-Za-z]{3})\)/); return m ? m[1].toUpperCase() : (normS(s).replace(/[^a-z]/g, '').slice(0, 3) || '···').toUpperCase(); };
  const place = s => String(s || '').replace(/\s*\([A-Za-z]{3}\)\s*/, ' ').trim();
  const fday = iso => new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
  const byDate = (a, b) => String(a.fecha || '9999').localeCompare(String(b.fecha || '9999')) || String(a.hora || '').localeCompare(String(b.hora || '')) || a.id - b.id;

  function docCard(d, urls){
    const url = d.archivo && urls[d.archivo];
    const pdf = /\.pdf$/i.test(d.archivo_nombre || d.archivo || '');
    const open = url ? `<a class="btn btn--dark btn--sm tk-open" href="${esc(url)}" target="_blank" rel="noopener">${I_DOC}<span>${d.tipo === 'vuelo' ? 'Ver billete' : 'Ver documento'}${pdf ? ' (PDF)' : ''}</span></a>`
      : d.archivo ? '<span class="tk-na">No se puede abrir ahora mismo. Recarga la página.</span>' : '';
    if(d.tipo === 'vuelo'){
      const vuelo = [d.compania, d.numero].filter(Boolean).join(' ');
      return `<li class="tk">
        <div class="tk-route">
          <div class="tk-end"><b>${esc(code(d.origen))}</b><small>${esc(place(d.origen))}</small></div>
          <span class="tk-line" aria-hidden="true"><i></i>${I_PLANE}<i></i></span>
          <div class="tk-end tk-end--to"><b>${esc(code(d.destino))}</b><small>${esc(place(d.destino))}</small></div>
        </div>
        <dl class="tk-meta">
          ${d.fecha ? `<div><dt>Fecha</dt><dd>${esc(fday(d.fecha))}</dd></div>` : ''}
          ${d.hora ? `<div><dt>Sale</dt><dd>${esc(String(d.hora).slice(0, 5))}</dd></div>` : ''}
          ${vuelo ? `<div><dt>Vuelo</dt><dd>${esc(vuelo)}</dd></div>` : ''}
          ${d.localizador ? `<div><dt>Localizador</dt><dd><button type="button" class="tk-copy" data-copy-loc="${esc(d.localizador)}" aria-label="Copiar localizador ${esc(d.localizador)}">${esc(d.localizador)}</button></dd></div>` : ''}
        </dl>
        ${d.pasajeros ? `<p class="tk-pax"><span>Pasajeros</span>${esc(d.pasajeros)}</p>` : ''}
        ${open}
      </li>`;
    }
    return `<li class="tk tk--doc">
      <div class="tk-doc"><span class="tk-doc-ic">${I_DOC}</span><div><b>${esc(d.titulo || 'Documento')}</b>${d.fecha || d.notas ? `<small>${esc([d.fecha ? fday(d.fecha) : '', d.notas || ''].filter(Boolean).join(' · '))}</small>` : ''}</div></div>
      ${open}
    </li>`;
  }
  function docsBlock(list, urls, shared){
    if(!list.length) return '';
    const flights = list.filter(d => d.tipo === 'vuelo').length;
    const title = flights === list.length ? (shared ? (flights === 1 ? 'Billete de avión del grupo' : 'Billetes de avión del grupo') : (flights === 1 ? 'Tu billete de avión' : 'Tus billetes de avión')) : 'Billetes y documentos';
    return `<div class="rc-docs"><h4>${I_PLANE}${title}<small>${list.length}</small></h4><ul>${list.slice().sort(byDate).map(d => docCard(d, urls)).join('')}</ul></div>`;
  }
  function routeCard(r, docs, urls, groups){
    const st = STATUS[r.estado] || STATUS.nueva;
    const created = new Date(r.created_at).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
    const stops = (r.paradas || []).map(p => esc(cityName(p.ciudad))).join(' → ');
    const steps = ['Recibida', 'Preparando', 'Presupuesto', 'Reservada'].map((t, i) =>
      `<li class="${st[1] > i + 1 ? 'is-done' : st[1] === i + 1 ? 'is-now' : ''}"><i></i>${t}</li>`).join('');
    const g = r.grupo_id ? groups.find(x => x.id === r.grupo_id) : null;
    const tag = r.grupo_id ? `<span class="rcard-tag">${I_USERS}Ruta del grupo${g ? ' · ' + esc(g.nombre) : ''}</span>` : r.creada_por_equipo ? '<span class="rcard-tag">Preparada por Iberail</span>' : '';
    const when = r.fecha_salida ? `salida el ${esc(fday(r.fecha_salida))}` : `${r.creada_por_equipo ? 'preparada' : 'enviada'} el ${esc(created)}`;
    return `<article class="rcard${docs.length ? ' has-docs' : ''}" data-id="${esc(r.id)}">
      <div class="rcard-top"><span class="mono">${esc(r.ref)}</span><span class="st st--${esc(r.estado)}">${esc(st[0])}</span></div>
      ${tag}
      <h3>${esc(cityName(r.salida))} → ${esc(cityName(((r.paradas || []).slice(-1)[0] || {}).ciudad) || '…')}</h3>
      <p class="rcard-route">${stops}</p>
      ${window.IBGroupMap && r.estado !== 'descartada' ? IBGroupMap.button(r) : ''}
      <p class="rcard-meta">${esc(r.dias)} días · ${esc(r.viajeros)} ${r.viajeros == 1 ? 'persona' : 'personas'} · ${when}</p>
      ${r.estado === 'descartada' ? '' : `<ol class="rcard-steps">${steps}</ol>`}
      ${docsBlock(docs, urls, !!r.grupo_id)}
      <a class="pl-link" href="${esc(IB.wa(`Hola Iberail, os escribo por mi ruta ${r.ref}`))}" target="_blank" rel="noopener">Preguntar por esta ruta en WhatsApp</a>
    </article>`;
  }
  const I_BELL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8a6 6 0 0112 0c0 5 2 6 2 7H4c0-1 2-2 2-7z"/><path d="M10 19a2 2 0 004 0"/></svg>';
  const I_CHECK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
  const I_STAR = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6 6.6.8-4.9 4.6 1.3 6.5L12 17.2 6.1 20.4l1.3-6.5L2.5 9.3l6.6-.8z"/></svg>';
  const eur = n => { const [i, d] = Math.abs(Number(n) || 0).toFixed(2).split('.'); return (Number(n) < 0 ? '−' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, '.') + ',' + d + ' €'; };
  const fshort = iso => new Date(iso + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' });
  const ago = iso => {
    const s = (Date.now() - new Date(iso)) / 1000;
    if(s < 60) return 'ahora mismo';
    if(s < 3600) return `hace ${Math.floor(s / 60)} min`;
    if(s < 86400) return `hace ${Math.floor(s / 3600)} h`;
    if(s < 86400 * 7) return `hace ${Math.floor(s / 86400)} d`;
    return new Date(iso).toLocaleDateString('es-ES', { day: 'numeric', month: 'short' });
  };
  const initials = s => String(s || '?').trim().split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '?';
  const plural = (n, a, b) => n === 1 ? a : b;
  // lo que se pinta en la cuenta (se vuelve a pintar sin recargar al marcar un aviso)
  let V = { routes: [], allRoutes: [], groups: [], docs: [], urls: {}, mates: {}, mine: {}, team: {}, pagos: [], avisos: [], allAvisos: [], admin: false, previews: 0, read: new Set(), v7: false };
  let tab = null;

  const I_EURO = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 7a6.5 6.5 0 100 10"/><path d="M4 10.5h9M4 13.5h9"/></svg>';
  const I_ROUTE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H15a3 3 0 000-6H9a3 3 0 010-6h6.5"/></svg>';
  const AV_COLORS = ['#F0532F', '#FFC53D', '#8FB8A8', '#C9A2F2', '#7FB3E8', '#F29E7F', '#B7D36B'];
  const avColor = s => { let h = 0; for(const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0; return AV_COLORS[h % AV_COLORS.length]; };
  const daysTo = iso => Math.round((new Date(iso + 'T12:00:00') - new Date(new Date().toDateString() + ' 12:00')) / 864e5);
  function payBox(g){
    if(!V.v7) return '';
    const m = V.mine[g.id] || {}, imp = Number(m.importe || 0);
    const list = V.pagos.filter(p => String(p.grupo_id) === String(g.id)).sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)));
    const pag = list.reduce((a, p) => a + Number(p.importe), 0), marcado = !!m.pagado, falta = marcado ? 0 : Math.max(0, imp - pag);
    if(marcado && !imp) return `<div class="gx-card gx-pay is-done"><div class="gx-ring gx-ring--ok" role="img" aria-label="Todo pagado"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="34" class="gx-ring-fg"/></svg><span>${I_CHECK}</span></div><div class="gx-pay-main"><small>Tu parte del viaje</small><b class="gx-pay-big is-ok">Todo pagado</b><p>Lo tienes todo pagado. ¡Ya solo queda disfrutar del viaje!</p></div></div>`;
    if(!imp && !list.length) return `<div class="gx-card gx-pay is-empty"><span class="gx-ic">${I_EURO}</span><div><b>Tu parte del viaje</b><p>Cuando cerremos el precio, aquí verás lo que te toca pagar y lo que llevas pagado.</p></div></div>`;
    const done = marcado || (imp > 0 && falta <= 0), pct = done ? 100 : imp ? Math.min(100, Math.round(pag / imp * 100)) : 100;
    const R = 34, C = 2 * Math.PI * R;
    return `<div class="gx-card gx-pay${done ? ' is-done' : ''}">
      <div class="gx-ring" role="img" aria-label="Llevas pagado el ${pct}%">
        <svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="${R}" class="gx-ring-bg"/><circle cx="40" cy="40" r="${R}" class="gx-ring-fg" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${(C * (1 - pct / 100)).toFixed(1)}"/></svg>
        <span>${done ? I_CHECK : pct + '%'}</span>
      </div>
      <div class="gx-pay-main">
        <small>Tu parte del viaje</small>
        ${done ? `<b class="gx-pay-big is-ok">Todo pagado</b>` : `<b class="gx-pay-big">Te ${plural(falta, 'queda', 'quedan')} <span class="nw">${eur(falta)}</span></b>`}
        <p>${marcado && pag < imp ? 'Iberail lo ha marcado como pagado. ¡Ya solo queda disfrutar del viaje!' : imp && pag > imp ? `${eur(pag)} pagados de ${eur(imp)}: hay ${eur(pag - imp)} de más, lo revisamos contigo.` : `${eur(pag)} pagados de ${eur(imp)}`}</p>
        ${list.length ? `<details class="gx-log"><summary>${list.length} ${plural(list.length, 'pago', 'pagos')}</summary><ul>${list.map(p => `<li><span>${esc(fshort(p.fecha))}</span><b>${eur(p.importe)}</b>${p.nota ? `<em>${esc(p.nota)}</em>` : ''}</li>`).join('')}</ul></details>` : ''}
      </div>
      ${!done ? (IB.cfg && IB.cfg.STRIPE_ON && falta > 0
        ? `<button type="button" class="gx-pay-cta" data-stripe-group="${esc(g.id)}">Pagar ${eur(falta)}</button>`
        : `<a class="gx-pay-cta" href="${esc(IB.wa(`Hola Iberail, soy de «${g.nombre}». ¿Cómo os pago lo que me falta (${eur(falta)})?`))}" target="_blank" rel="noopener">¿Cómo pago?</a>`) : ''}
    </div>`;
  }
  // cómo va cada persona del grupo (solo totales; el grupo decide si se comparte)
  function teamBox(g){
    const rows = V.team[g.id];
    if(!rows || rows.length < 2) return '';
    const done = rows.filter(r => r.completo).length;
    // lo que lleva cubierto el grupo: cada persona cuenta como mucho su importe (lo pagado de más no suma)
    const tot = rows.reduce((a, r) => a + Number(r.importe || 0), 0);
    const paid = rows.reduce((a, r) => { const imp = Number(r.importe || 0), pag = Number(r.pagado || 0); return a + (!imp ? 0 : r.completo ? imp : Math.min(pag, imp)); }, 0);
    // la barra avanza con el dinero (si hay precios) y, si no, con las personas que ya lo tienen todo pagado
    const pct = tot ? Math.min(100, Math.floor(paid / tot * 100)) : rows.length ? Math.round(done / rows.length * 100) : 0;
    const full = done === rows.length;
    const sorted = rows.slice().sort((a, b) => (b.soy_yo - a.soy_yo) || (a.completo - b.completo) || String(a.nombre).localeCompare(String(b.nombre), 'es'));
    return `<div class="gx-card gx-team">
      <div class="gx-sec-h"><span class="gx-ic">${I_USERS}</span><b>Pagos del grupo</b><em class="gx-pill${done === rows.length ? ' is-ok' : ''}">${done === rows.length ? `${I_CHECK}Todos pagados` : `${done} de ${rows.length} pagados`}</em></div>
      <div class="gx-team-bar${full ? ' is-full' : ''}" role="img" aria-label="${tot ? `Lleváis pagado el ${pct}%` : `${done} de ${rows.length} personas lo tienen todo pagado`}"><i style="width:${pct}%"></i></div>
      ${tot ? `<p class="gx-team-sum">Entre todos lleváis <b>${eur(paid)}</b> de ${eur(tot)} <span>· ${pct}%</span></p>` : ''}
      <ul class="gx-team-list">${sorted.map(r => {
        const imp = Number(r.importe || 0), pag = Number(r.pagado || 0), falta = Math.max(0, imp - pag), p = r.completo ? 100 : imp ? Math.min(100, Math.round(pag / imp * 100)) : 0;
        const st = r.completo ? `<span class="gx-st is-ok">${I_CHECK}Todo pagado</span>` : imp ? `<span class="gx-st is-due">Faltan ${eur(falta)}</span>` : '<span class="gx-st">Sin precio aún</span>';
        return `<li class="${r.completo ? 'is-ok' : ''}${r.soy_yo ? ' is-me' : ''}">
          <i class="gx-av" style="--c:${avColor(r.user_id)}">${esc(initials(r.nombre))}</i>
          <div class="gx-team-main"><b>${esc(String(r.nombre).split(' ')[0])}${r.soy_yo ? ' <small>(tú)</small>' : ''}</b>${imp ? `<small>${eur(Math.min(pag, imp) || (r.completo ? imp : 0))} de ${eur(imp)}</small>` : ''}${imp || r.completo ? `<span class="gx-mini"><i style="width:${p}%"></i></span>` : ''}</div>
          ${st}
        </li>`; }).join('')}</ul>
    </div>`;
  }
  function avisoItem(a, compact, preview){
    const seen = preview || V.read.has(String(a.id));
    const from = a.para_todos ? 'Iberail' : a.user_id && !a.grupo_id && !a.ruta_id ? 'Invita y gana' : a.grupo_id ? `Grupo «${(V.groups.find(g => String(g.id) === String(a.grupo_id)) || {}).nombre || ''}»` : (() => { const r = V.routes.find(x => String(x.id) === String(a.ruta_id)); return r ? `Ruta ${r.ref}` : 'Tu ruta'; })();
    return `<article class="aviso${a.importante ? ' is-imp' : ''}${seen ? ' is-seen' : ''}" data-aviso="${esc(a.id)}">
      <div class="aviso-top">${compact ? '' : `<span>${I_BELL}${esc(from)}</span>`}<small>${esc(ago(a.created_at))}</small></div>
      <h4>${a.importante ? '<em>Importante</em>' : ''}${esc(a.titulo)}</h4>
      ${a.cuerpo ? `<p>${esc(a.cuerpo)}</p>` : ''}
      ${preview ? '<span class="aviso-seen">Publicado para el grupo</span>' : seen ? `<span class="aviso-seen">${I_CHECK}Visto</span>` : `<button type="button" class="btn btn--dark btn--sm" data-ok="${esc(a.id)}">${I_CHECK}Entendido</button>`}
    </article>`;
  }
  function routeLine(r){
    const st = STATUS[r.estado] || STATUS.nueva;
    const stops = [{ c: r.salida, d: '' }].concat((r.paradas || []).map(p => ({ c: p.ciudad, d: p.dias })));
    const tag = MODE === 'grupos' ? 'div' : 'button';
    return `<${tag}${tag === 'button' ? ` type="button" data-goto-route="${esc(r.id)}"` : ''} class="gx-card gx-route">
      <div class="gx-sec-h"><span class="gx-ic">${I_ROUTE}</span><b>Vuestra ruta</b><em class="gx-pill">${esc(st[0])}</em></div>
      <ol class="gx-line">${stops.map((s, i) => `<li class="${i === 0 ? 'is-start' : ''}"><i></i><b>${esc(s.c)}</b><small>${i === 0 ? 'Salida' : `${s.d} ${plural(+s.d, 'día', 'días')}`}</small></li>`).join('')}</ol>
      <p class="gx-route-meta">${esc(r.dias)} días${r.fecha_salida ? ` · salida el ${esc(fday(r.fecha_salida))}` : ''}</p>
    </${tag}>`;
  }
  // la ruta del grupo en un mapa interactivo (gmap.js); si no se puede dibujar, se queda la lista de paradas
  function routeMapCard(r){
    const st = STATUS[r.estado] || STATUS.nueva;
    const stops = [{ c: cityName(r.salida), d: '' }].concat((r.paradas || []).map(p => ({ c: cityName(p.ciudad), d: p.dias })));
    return `<div class="gx-card gx-route gx-map-card">
      <div class="gx-sec-h"><span class="gx-ic">${I_ROUTE}</span><b>Vuestra ruta</b><em class="gx-pill">${esc(st[0])}</em></div>
      <ol class="gx-line">${stops.map((s, i) => `<li class="${i === 0 ? 'is-start' : ''}"><i></i><b>${esc(s.c)}</b><small>${i === 0 ? 'Salida' : `${s.d} ${plural(+s.d, 'día', 'días')}`}</small></li>`).join('')}</ol>
      ${window.IBGroupMap ? IBGroupMap.button(r) : ''}
      <p class="gx-route-meta">${esc(r.dias)} días${r.fecha_salida ? ` · salida el ${esc(fday(r.fecha_salida))}` : ''}${MODE === 'grupos' || r.grupo_id ? '' : ` · <button type="button" class="pl-link" data-goto-route="${esc(r.id)}">Ver la ficha</button>`}</p>
    </div>`;
  }
  // «Austria, Viena» → «Viena» (las paradas escritas a mano se muestran con el nombre de la ciudad)
  const cityName = n => { const c = window.IBMap && IBMap.city ? IBMap.city(n) : null; return c ? c.n : n; };
  function groupCard(g){
    const prev = !!g._preview;
    const routes = (V.allRoutes || V.routes).filter(r => r.grupo_id === g.id), rids = new Set(routes.map(r => r.id));
    const docs = V.docs.filter(d => d.grupo_id === g.id || rids.has(d.ruta_id)), mates = V.mates[g.id] || [];
    const avs = (V.allAvisos && V.allAvisos.length ? V.allAvisos : V.avisos).filter(a => String(a.grupo_id) === String(g.id)).slice(0, 3);
    // cuándo empieza el viaje: la salida de la ruta o, si no, el primer billete con fecha
    const start = (routes.find(r => r.fecha_salida) || {}).fecha_salida || (docs.map(d => d.fecha).filter(Boolean).sort()[0]);
    const left = start ? daysTo(start) : null;
    const me = mates.find(m => m.soy_yo), others = mates.filter(m => !m.soy_yo);
    const names = others.map(m => String(m.nombre).split(' ')[0]);
    const who = names.length ? (me ? `${names.join(', ')} y tú` : names.slice(0, -1).join(', ') + (names.length > 1 ? ' y ' : '') + names.slice(-1)) : '';
    const stack = mates.length ? `<div class="gx-mates"><span class="gx-stack">${mates.slice(0, 8).map(m => `<i class="${m.soy_yo ? 'is-me' : ''}" style="--c:${avColor(m.user_id || m.nombre)}" title="${esc(m.nombre)}">${esc(initials(m.nombre))}</i>`).join('')}${mates.length > 8 ? `<i class="is-more">+${mates.length - 8}</i>` : ''}</span><span class="gx-who">${esc(who)}</span></div>` : '';
    const stats = [
      left != null ? (left > 0 ? `<div class="is-hl"><dt>Faltan</dt><dd>${left}<small> ${plural(left, 'día', 'días')}</small></dd></div>` : left === 0 ? '<div class="is-hl"><dt>Salís</dt><dd>¡Hoy!</dd></div>' : '<div><dt>Viaje</dt><dd>En marcha</dd></div>') : '',
      start ? `<div><dt>Salida</dt><dd>${esc(new Date(start + 'T12:00:00').toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).replace('.', ''))}</dd></div>` : '',
      `<div><dt>Personas</dt><dd>${mates.length || '—'}</dd></div>`,
      `<div><dt>Billetes</dt><dd>${docs.length}</dd></div>`
    ].join('');
    const edit = V.admin ? `<a class="gx-edit" href="panel.html#grupo-${esc(g.id)}">Editar en el panel<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>` : '';
    const vip = !!g.vip;
    const vipBar = vip ? `<div class="gx-card gx-vipbar"><span class="gx-vipbar-ic">${I_STAR}</span><div><b>${prev ? 'Grupo VIP' : 'Sois grupo VIP'}</b><p>Gracias por confiar en Iberail. Escribidnos cuando queráis y os atendemos con prioridad.</p></div><a class="gx-vipbar-cta" href="${esc(IB.wa(`Hola Iberail, somos el grupo VIP «${g.nombre}».`))}" target="_blank" rel="noopener">Línea VIP</a></div>` : '';
    return `<section class="gx${prev ? ' is-preview' : ''}${vip ? ' is-vip' : ''}">
      <header class="gx-hero">
        <div class="gx-top"><span class="gx-top-left"><span class="gx-kicker"><i></i>${prev ? 'Vista del equipo · así lo ven ellos' : 'Tu grupo de viaje'}</span>${vip ? `<span class="gx-vip" title="Grupo VIP">${I_STAR}VIP</span>` : ''}</span>${edit}</div>
        <h2>${esc(g.nombre)}</h2>
        ${stack}
        <dl class="gx-stats">${stats}</dl>
      </header>
      <div class="gx-body">
        ${vipBar}
        ${prev ? '' : payBox(g)}
        ${teamBox(g)}
        ${routes.length ? routes.map(routeMapCard).join('') : `<div class="gx-card gx-soon"><span class="gx-ic">${I_ROUTE}</span><div><b>Estamos preparando vuestra ruta</b><p>En cuanto esté lista, os aparece aquí a todos.</p></div><span class="gx-dots" aria-hidden="true"><i></i><i></i><i></i></span></div>`}
        ${avs.length ? `<div class="gx-avisos"><div class="gx-sec-h"><span class="gx-ic">${I_BELL}</span><b>Avisos del grupo</b></div>${avs.map(a => avisoItem(a, true, prev)).join('')}</div>` : ''}
        ${docs.length ? `<div class="gx-docs">${docsBlock(docs, V.urls, true)}</div>` : `<div class="gx-card gx-soon"><span class="gx-ic">${I_PLANE}</span><div><b>Billetes y documentos</b><p>Aún no hay nada subido. Os avisamos en cuanto estén.</p></div></div>`}
      </div>
    </section>`;
  }
  function paintDash(){
    const { routes, groups, docs, urls } = V;
    const unread = V.avisos.filter(a => !V.read.has(String(a.id)));
    const ownG = groups.length - V.previews;
    const adminNote = V.admin && V.previews ? `<p class="dash-admin-note"><b>Vista del equipo.</b> ${ownG ? `Además de ${ownG === 1 ? 'tu grupo' : 'tus grupos'}, aquí ves ${V.previews === 1 ? 'el otro grupo' : `los otros ${V.previews} grupos`}` : `Aquí ves ${V.previews === 1 ? 'el grupo' : `los ${V.previews} grupos`}`} tal y como ${V.previews === 1 ? 'lo' : 'los'} ven sus miembros.</p>` : '';
    $('#myGroups').innerHTML = groups.length ? adminNote + groups.map(groupCard).join('') :
      `<div class="dash-empty dash-empty--groups"><span class="dash-empty-ic">${I_USERS}</span><b>Todavía no estás en ningún grupo</b><p>Si viajas con más gente, os metemos a todos en vuestro grupo: aquí veréis la ruta, los billetes y los avisos del viaje, y cada uno lo que le falta por pagar.</p><div class="dash-empty-act">${MODE === 'grupos' ? '<a class="btn btn--dark btn--sm" href="cuenta.html#rutas">Ver mis rutas</a>' : ''}<a class="btn btn--ghost btn--sm" href="${esc(IB.wa('Hola Iberail, viajamos en grupo y queremos que nos organicéis el viaje'))}" target="_blank" rel="noopener">¿Viajáis en grupo? Escríbenos</a></div></div>`;
    $('#myRoutes').innerHTML = routes.length ? routes.map(r => routeCard(r, docs.filter(d => d.ruta_id === r.id), urls, groups)).join('') :
      `<div class="dash-empty"><p>${groups.length ? 'Tu ruta aparecerá aquí en cuanto la preparemos.' : 'Aún no has enviado ninguna ruta.'}</p><a class="btn btn--primary" href="rutas.html">Diseñar mi ruta</a></div>`;
    $('#myAvisos').innerHTML = !V.v7 ? '<div class="dash-empty"><p>Aquí te saldrán los avisos de tu viaje.</p></div>' : V.avisos.length ?
      unread.concat(V.avisos.filter(a => V.read.has(String(a.id)))).map(a => avisoItem(a, false)).join('') :
      `<div class="dash-empty"><span class="dash-empty-ic">${I_BELL}</span><b>No tienes avisos</b><p>Cuando haya algo importante de tu viaje (billetes, horarios, pagos), te lo dejamos aquí.</p></div>`;
    // pestañas con contador
    $('#dtR').textContent = routes.length || '';
    $('#dtG').textContent = groups.length || '';
    const dA = $('#dtA'); dA.textContent = unread.length || ''; dA.classList.toggle('is-hot', !!unread.length);
    const lR = $('#dlR'), lA = $('#dlA');
    if(lR) lR.textContent = routes.filter(r => !r.grupo_id).length || '';
    if(lA){ lA.textContent = unread.length || ''; lA.classList.toggle('is-hot', !!unread.length); }
    // aviso destacado arriba (lo más importante sin leer)
    const top = unread.slice().sort((a, b) => (b.importante - a.importante) || (new Date(b.created_at) - new Date(a.created_at)))[0];
    $('#dashAlerts').innerHTML = top ? `<div class="dash-alert${top.importante ? ' is-imp' : ''}">
        <span class="dash-alert-ic">${I_BELL}</span>
        <div><small>${top.importante ? 'Aviso importante' : 'Aviso nuevo'}${unread.length > 1 ? ` · ${unread.length} sin leer` : ''}</small><b>${esc(top.titulo)}</b>${top.cuerpo ? `<p>${esc(top.cuerpo)}</p>` : ''}</div>
        <div class="dash-alert-act"><button type="button" class="btn btn--dark btn--sm" data-ok="${esc(top.id)}">${I_CHECK}Entendido</button>${unread.length > 1 ? (MODE === 'grupos' ? '<a class="pl-link" href="cuenta.html#avisos">Ver todos</a>' : '<button type="button" class="pl-link" data-tab="avisos">Ver todos</button>') : ''}</div>
      </div>` : '';
    paintInvita();
    if(MODE === 'grupos' && V.inv && V.groups.length - V.previews > 0){
      const d = V.inv;
      $('#myGroups').insertAdjacentHTML('beforeend', `<a class="inv-promo" href="cuenta.html#invita"><span class="gx-ic">${I_GIFT}</span><span><b>Invita y gana ${eurR(d.importe)}</b><small>Por cada grupo de ${d.minimo} o más amigos que traigas con tu enlace.</small></span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>`);
    }
    if(!tab) setTab(pickTab(), true); else setTab(tab, true);
  }
  /* ---------- «Invita y gana» ---------- */
  const I_GIFT = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="8" width="18" height="4" rx="1"/><path d="M12 8v13M19 12v7a2 2 0 01-2 2H7a2 2 0 01-2-2v-7M7.5 8a2.5 2.5 0 010-5C11 3 12 8 12 8s1-5 4.5-5a2.5 2.5 0 010 5"/></svg>';
  const I_LINK = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7"/><path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7"/></svg>';
  const I_WA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 01-12.3 7.4L3 21l2.1-5.6A8.5 8.5 0 1121 11.5z"/></svg>';
  const I_SHARE = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.2 10.8l7.6-4.4M8.2 13.2l7.6 4.4"/></svg>';
  const eurR = n => Number(n) % 1 === 0 ? `${Number(n)} €` : eur(n);
  const invLink = () => `${location.origin}/?ref=${V.inv.codigo}`;
  const invMsg = () => `¡Me voy de Interrail con Iberail! Te montan la ruta a medida por Europa y lo organizan todo. Si vamos en grupo, regístrate con mi enlace: ${invLink()}`;
  function paintInvita(){
    const box = $('#myInvita'), tb = $('#dtab-invita');
    if(tb) tb.hidden = !V.inv;
    if(!box || !V.inv) return;
    const d = V.inv, prize = eurR(d.importe), min = d.minimo;
    const com = d.comisiones || [], inv = d.invitados || [], grs = d.grupos || [];
    const pend = com.filter(c => c.estado === 'pendiente'), paid = com.filter(c => c.estado === 'pagada');
    const sum = l => l.reduce((a, c) => a + Number(c.importe), 0);
    const won = com.filter(c => c.estado !== 'anulada').length;
    const bI = $('#dtI'); if(bI){ bI.textContent = pend.length || ''; bI.classList.toggle('is-hot', !!pend.length); }
    const share = navigator.share ? `<button type="button" class="btn btn--ghost-light btn--sm" data-inv-share>${I_SHARE}Compartir</button>` : '';
    const groupRow = g => {
      const mine = Number(g.mios), n = Number(g.personas), p = Number(g.pagados);
      let st, cls = '';
      if(g.comision === 'pagada'){ st = `${I_CHECK}Cobrado`; cls = ' is-ok'; }
      else if(g.comision === 'pendiente'){ st = `${I_GIFT}¡${prize} ganados!`; cls = ' is-won'; }
      else if(g.comision === 'anulada') st = 'Anulada';
      else if(mine < min) st = `Faltan ${min - mine} ${plural(min - mine, 'invitado', 'invitados')}`;
      else st = `Pagados ${p} de ${n}`;
      const pct = g.comision ? 100 : mine < min ? Math.round(mine / min * 50) : 50 + Math.round(p / Math.max(1, n) * 50);
      const hint = g.comision ? (g.comision === 'pendiente' ? 'Te lo pagamos en los próximos días.' : g.comision === 'pagada' ? 'Ya te lo hemos pagado.' : 'Esta comisión se ha anulado.')
        : mine < min ? `${mine} de tus invitados van en este grupo: con ${min} ya cuenta.` : `Ya hay ${mine} de tus invitados. En cuanto todo el grupo lo tenga pagado, ganas ${prize}.`;
      return `<li class="${g.comision && g.comision !== 'anulada' ? 'is-ok' : ''}">
        <span class="inv-gic">${I_USERS}</span>
        <div class="inv-gmain"><b>${esc(g.nombre)}</b><small>${esc(hint)}</small><span class="gx-mini"><i style="width:${pct}%"></i></span></div>
        <span class="gx-st${cls}">${st}</span></li>`;
    };
    box.innerHTML = `<section class="gx inv">
      <header class="gx-hero">
        <div class="gx-top"><span class="gx-kicker"><i></i>Invita y gana</span></div>
        <h2>Gana ${prize} por cada grupo de ${min} o más que traigas</h2>
        <p class="inv-lead">Comparte tu enlace. Cuando ${min} o más personas que se registren con él viajen juntas en un grupo y lo tengan todo pagado, te llevas ${prize}. Sin límite de grupos.</p>
        <div class="inv-link">
          <span class="inv-link-ic">${I_LINK}</span>
          <span class="inv-url" title="${esc(invLink())}"><span class="inv-host">${esc(location.host)}/</span>?ref=<b>${esc(d.codigo)}</b></span>
          <button type="button" class="inv-copy" data-inv-copy>Copiar</button>
        </div>
        <div class="inv-share">
          <a class="btn btn--wa btn--sm" href="https://wa.me/?text=${encodeURIComponent(invMsg())}" target="_blank" rel="noopener">${I_WA}Enviar por WhatsApp</a>
          ${share}
        </div>
        <dl class="gx-stats">
          <div><dt>Invitados</dt><dd>${inv.length}</dd></div>
          <div><dt>Grupos</dt><dd>${won}</dd></div>
          <div class="${pend.length ? 'is-hl' : ''}"><dt>Por cobrar</dt><dd>${eurR(sum(pend))}</dd></div>
          <div><dt>Cobrado</dt><dd>${eurR(sum(paid))}</dd></div>
        </dl>
      </header>
      <div class="gx-body">
        ${pend.length ? `<div class="gx-card inv-won"><span class="gx-ic">${I_GIFT}</span><div><b>Tienes ${eurR(sum(pend))} por cobrar</b><p>Te lo pagamos por Bizum o transferencia en los próximos días. Si cambias de número, escríbenos.</p></div></div>` : ''}
        ${!inv.length ? `<div class="gx-card inv-steps"><ol>
          <li><b>1</b><span><strong>Comparte tu enlace</strong>Por WhatsApp, Instagram o donde quieras.</span></li>
          <li><b>2</b><span><strong>Tus amigos se registran con él</strong>Queda apuntado solo, no tienen que hacer nada más.</span></li>
          <li><b>3</b><span><strong>Viajan en grupo y lo pagan</strong>Con ${min} o más de ellos en un grupo todo pagado, ganas ${prize}.</span></li>
        </ol></div>` : ''}
        ${grs.length ? `<div class="gx-card inv-groups"><div class="gx-sec-h"><span class="gx-ic">${I_USERS}</span><b>Tus grupos</b></div><ul>${grs.map(groupRow).join('')}</ul></div>` : ''}
        ${inv.length ? `<div class="gx-card inv-people"><div class="gx-sec-h"><span class="gx-ic">${I_GIFT}</span><b>Se han registrado con tu enlace</b><em class="gx-pill">${inv.length}</em></div>
          <ul>${inv.map(p => `<li><i class="gx-av" style="--c:${avColor(p.nombre + p.desde)}">${esc(initials(p.nombre))}</i><span>${esc(p.nombre)}</span><small>${esc(ago(p.desde))}</small></li>`).join('')}</ul>
          ${!grs.length ? `<p class="inv-note">Cuando les metamos en un grupo de viaje, aquí verás cómo va.</p>` : ''}</div>` : ''}
        ${com.length ? `<details class="gx-card inv-hist"><summary>Historial · ${com.length} ${plural(com.length, 'comisión', 'comisiones')}</summary><ul>${com.map(c => `<li><span>${esc(new Date(c.fecha).toLocaleDateString('es-ES', { day: 'numeric', month: 'short', year: 'numeric' }))}</span><b>${esc(c.grupo || 'Grupo')}</b><em class="gx-st${c.estado === 'pagada' ? ' is-ok' : c.estado === 'pendiente' ? ' is-won' : ''}">${c.estado === 'pagada' ? 'Cobrado' : c.estado === 'pendiente' ? 'Por cobrar' : 'Anulada'}</em><strong>${eurR(c.importe)}</strong></li>`).join('')}</ul></details>` : ''}
        <details class="inv-terms"><summary>Condiciones del programa</summary><ul>
          <li>Cuentan las personas que crean su cuenta con tu enlace (tienen 30 días desde que lo abren). Solo cuentas nuevas, y no puedes invitarte a ti mismo.</li>
          <li>Ganas ${prize} por cada grupo en el que viajen ${min} o más de tus invitados, cuando todo el grupo lo tenga pagado. Tú puedes ir en el grupo o no.</li>
          <li>Una sola comisión por grupo: si en el mismo grupo hay invitados de varias personas, la gana quien trajo a más.</li>
          <li>Te lo pagamos por Bizum o transferencia en los días siguientes. Si el viaje se cancela o hay fraude, Iberail puede anular la comisión.</li>
          <li>Si eliminas tu cuenta, pierdes lo que tengas pendiente de cobrar.</li>
        </ul></details>
      </div>
    </section>`;
  }
  function pickTab(){
    if(MODE === 'grupos') return 'grupos';
    const h = (location.hash || '').slice(1);
    if(['rutas', 'grupos', 'avisos'].includes(h) || (h === 'invita' && V.inv)) return h;
    return V.groups.length ? 'grupos' : 'rutas';
  }
  function setTab(t, quiet){
    if(MODE === 'grupos') t = 'grupos';
    if(t === 'invita' && !V.inv) t = V.groups.length ? 'grupos' : 'rutas';
    tab = t;
    $$('#dashTabs [data-t]').forEach(b => b.setAttribute('aria-selected', b.dataset.t === t));
    $$('.dash-pane').forEach(p => p.hidden = p.dataset.pane !== t);
    if(!quiet && MODE === 'cuenta'){ try{ history.replaceState(null, '', '#' + t); }catch(e){} }
  }
  async function markRead(id, btn){
    if(!me || V.read.has(String(id))) return;
    if(btn) btn.disabled = true;
    const { error } = await IB.sb.from('avisos_leidos').insert({ aviso_id: Number(id), user_id: me.id });
    if(error && !/duplicate|23505/i.test((error.message || '') + (error.code || ''))){ if(btn) btn.disabled = false; return msg(IB.errMsg(error)); }
    V.read.add(String(id)); paintDash();
    document.dispatchEvent(new CustomEvent('ib:aviso-leido'));
  }

  const safe = async q => { try{ const r = await q; return r.error ? { data: [], error: r.error } : r; }catch(e){ return { data: [], error: e }; } };
  async function loadRoutes(user, quiet){
    me = user;
    const box = $('#myRoutes');
    if(!quiet){ box.innerHTML = '<div class="auth-spin"></div>'; $('#myGroups').innerHTML = '<div class="auth-spin"></div>'; }
    const mem = await safe(IB.sb.from('grupo_miembros').select('*').eq('user_id', user.id));
    const gids = (mem.data || []).map(m => m.grupo_id);
    const [own, grp, gr, mt, pg, av, rd, iv] = await Promise.all([
      IB.sb.from('rutas').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      gids.length ? safe(IB.sb.from('rutas').select('*').in('grupo_id', gids).order('created_at', { ascending: false })) : { data: [] },
      gids.length ? safe(IB.sb.from('grupos').select('*').in('id', gids)) : { data: [] },
      gids.length ? safe(IB.sb.rpc('companeros_grupo')) : { data: [] },
      gids.length ? safe(IB.sb.from('pagos').select('*').eq('user_id', user.id)) : { data: [] },
      safe(IB.sb.from('avisos').select('*').order('created_at', { ascending: false }).limit(100)),
      safe(IB.sb.from('avisos_leidos').select('aviso_id').eq('user_id', user.id)),
      safe(IB.sb.rpc('mi_invita'))
    ]);
    if(own.error){ box.innerHTML = `<p class="dash-empty">${esc(IB.errMsg(own.error))}</p>`; return; }
    const routes = (grp.data || []).filter(r => !own.data.some(o => o.id === r.id)).concat(own.data)
      .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    // el equipo ve también todos los demás grupos, tal y como los ven sus miembros
    let isAdmin = false, pgroups = [], proutes = [];
    try{ const r = await IB.sb.rpc('is_admin'); isAdmin = !!(r && r.data); }catch(e){}
    if(isAdmin){
      const all = await safe(IB.sb.from('grupos').select('*').order('created_at', { ascending: false }));
      pgroups = (all.data || []).filter(g => !gids.includes(g.id)).map(g => ({ ...g, _preview: true }));
    }
    const pgids = pgroups.map(g => g.id);
    if(pgids.length) proutes = (await safe(IB.sb.from('rutas').select('*').in('grupo_id', pgids).order('created_at', { ascending: false }))).data || [];
    const groups = (gr.data || []).concat(pgroups);
    const allg = gids.concat(pgids);
    const rids = routes.concat(proutes).map(r => r.id);
    const [dr, dg] = await Promise.all([
      rids.length ? safe(IB.sb.from('documentos').select('*').in('ruta_id', rids)) : { data: [] },
      allg.length ? safe(IB.sb.from('documentos').select('*').in('grupo_id', allg)) : { data: [] }
    ]);
    const docs = (dr.data || []).concat(dg.data || []);
    const urls = {};
    const paths = [...new Set(docs.map(d => d.archivo).filter(Boolean))];
    if(paths.length){
      try{
        const { data } = await IB.sb.storage.from('documentos').createSignedUrls(paths, 3600);
        (data || []).forEach(x => { if(x && x.signedUrl && !x.error) urls[x.path] = x.signedUrl; });
      }catch(e){}
    }
    const mine = new Set(own.data.filter(r => !r.grupo_id).map(r => r.id));
    ownFiles = docs.filter(d => mine.has(d.ruta_id) && d.archivo).map(d => d.archivo);
    const mates = {}; (mt.data || []).forEach(m => { (mates[m.grupo_id] = mates[m.grupo_id] || []).push(m); });
    if(pgids.length){
      const [pm, cl] = await Promise.all([safe(IB.sb.from('grupo_miembros').select('*').in('grupo_id', pgids)), safe(IB.sb.rpc('buscar_clientes', { q: '' }))]);
      const nm = {}; (cl.data || []).forEach(c => nm[c.id] = c.nombre || String(c.email || '').split('@')[0]);
      (pm.data || []).sort((a, b) => String(a.added_at).localeCompare(String(b.added_at))).forEach(m => { (mates[m.grupo_id] = mates[m.grupo_id] || []).push({ grupo_id: m.grupo_id, user_id: m.user_id, nombre: nm[m.user_id] || 'Viajero', soy_yo: false }); });
    }
    const myRows = {}; (mem.data || []).forEach(m => { myRows[m.grupo_id] = m; });
    const team = {};
    if(!av.error && allg.length){
      const res = await Promise.all(allg.map(g => safe(IB.sb.rpc('pagos_grupo', { g }))));
      allg.forEach((g, i) => { team[g] = res[i].error ? null : (res[i].data || []); });
    }
    // avisos «tuyos» (el equipo recibe todos: aquí solo cuentan los que te tocan como viajero)
    const myRids = new Set(routes.map(r => r.id));
    const allAvisos = av.data || [];
    const avisos = isAdmin ? allAvisos.filter(a => a.para_todos || gids.includes(a.grupo_id) || (a.ruta_id && myRids.has(a.ruta_id)) || a.user_id === user.id) : allAvisos;
    V = { routes, allRoutes: routes.concat(proutes), groups, docs, urls, mates, mine: myRows, team, pagos: pg.data || [], avisos, allAvisos, admin: isAdmin, previews: pgids.length, read: new Set((rd.data || []).map(x => String(x.aviso_id))), v7: !av.error,
      inv: !iv.error && iv.data && iv.data.codigo ? iv.data : null };
    paintDash();
    // los enlaces a los archivos caducan en 1 h: se renuevan solos
    clearTimeout(refreshT); if(paths.length) refreshT = setTimeout(() => loadRoutes(user, true), 50 * 60 * 1000);
    if(!chan){
      const again = () => { clearTimeout(reloadT); reloadT = setTimeout(() => { if(me) loadRoutes(me, true); }, 400); };
      chan = IB.sb.channel('mis-rutas')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'rutas' }, again)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'documentos' }, again)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'grupo_miembros', filter: `user_id=eq.${user.id}` }, again);
      // pagos y avisos solo si ya existen en la base de datos (archivo 7)
      if(V.v7) chan = chan
        .on('postgres_changes', { event: '*', schema: 'public', table: 'pagos', filter: `user_id=eq.${user.id}` }, again)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'avisos' }, again);
      // «Invita y gana» (archivo 9): cuando ganas o cobras una comisión
      if(V.inv) chan = chan.on('postgres_changes', { event: '*', schema: 'public', table: 'comisiones', filter: `padrino=eq.${user.id}` }, again);
      chan.subscribe();
    }
  }
  root.addEventListener('click', async e => {
    const ok = e.target.closest('[data-ok]'); if(ok) return markRead(ok.dataset.ok, ok);
    const tb = e.target.closest('#dashTabs [data-t], [data-tab]'); if(tb) return setTab(tb.dataset.t || tb.dataset.tab);
    const gr = e.target.closest('[data-goto-route]'); if(gr){ setTab('rutas'); const c = $(`.rcard[data-id="${gr.dataset.gotoRoute}"]`); if(c){ c.scrollIntoView({ behavior: 'smooth', block: 'start' }); c.classList.remove('is-flash'); void c.offsetWidth; c.classList.add('is-flash'); } return; }
    const gmo = e.target.closest('[data-gm-open]');
    if(gmo && window.IBGroupMap){ const r = (V.allRoutes || V.routes).find(x => String(x.id) === gmo.dataset.gmOpen); if(r){ const g = r.grupo_id ? V.groups.find(x => String(x.id) === String(r.grupo_id)) : null; IBGroupMap.open(r, g ? `Ruta de «${g.nombre}»` : `Tu ruta ${r.ref || ''}`); } return; }
    const ic = e.target.closest('[data-inv-copy]');
    if(ic && V.inv){ const okc = await IB.copy(invLink()); ic.textContent = okc ? '¡Copiado!' : 'No se pudo'; ic.classList.toggle('is-done', okc); setTimeout(() => { ic.textContent = 'Copiar'; ic.classList.remove('is-done'); }, 1800); return; }
    const is = e.target.closest('[data-inv-share]');
    if(is && V.inv){ try{ await navigator.share({ title: 'Iberail', text: invMsg().replace(/: https?:\/\/\S+$/, ':'), url: invLink() }); }catch(_){} return; }
    const b = e.target.closest('[data-copy-loc]'); if(!b) return;
    const okc = await IB.copy(b.dataset.copyLoc);
    b.classList.add('is-copied'); b.textContent = okc ? 'Copiado' : b.dataset.copyLoc;
    setTimeout(() => { b.classList.remove('is-copied'); b.textContent = b.dataset.copyLoc; }, 1600);
  });
  // si se marca todo como leído desde la campana, se actualiza la cuenta
  document.addEventListener('ib:avisos-leidos', () => { if(me) loadRoutes(me, true); });
  $('#dashTabs').addEventListener('keydown', e => {
    if(!/^Arrow(Left|Right)$/.test(e.key)) return;
    const bs = $$('#dashTabs [data-t]'), i = bs.findIndex(b => b.getAttribute('aria-selected') === 'true');
    const n = bs[(i + (e.key === 'ArrowRight' ? 1 : bs.length - 1)) % bs.length]; setTab(n.dataset.t); n.focus();
  });
  window.addEventListener('hashchange', () => { if(MODE === 'grupos') return; const h = location.hash.slice(1); if(['rutas', 'grupos', 'avisos', 'invita'].includes(h) && root.dataset.view === 'dash') setTab(h, true); });
  async function dash(){
    const user = await IB.getUser();
    if(!user) return show('login');
    show('dash');
    const md = user.user_metadata || {};
    $$('[data-name]', root).forEach(n => n.textContent = IB.firstName(user) || 'viajero');
    const el = $('[data-email-line]', root); if(el) el.textContent = user.email + (md.telefono ? ' · ' + md.telefono : '');
    IB.sb.rpc('is_admin').then(({ data }) => { $('#dashAdmin').hidden = !data; }).catch(() => {});
    loadRoutes(user);
  }
  $('#logoutBtn').addEventListener('click', async () => {
    if(chan){ IB.sb.removeChannel(chan); chan = null; }
    clearTimeout(refreshT); me = null; tab = null;
    await IB.sb.auth.signOut();
    show('login'); msg('Has cerrado sesión.', true);
  });
  let delArmed = false, delT;
  $('#deleteBtn').addEventListener('click', async e => {
    const b = e.currentTarget;
    if(!delArmed){
      delArmed = true; b.textContent = 'Pulsa otra vez para borrar tu cuenta y tus rutas';
      b.classList.add('is-armed'); clearTimeout(delT);
      delT = setTimeout(() => { delArmed = false; b.textContent = 'Eliminar mi cuenta'; b.classList.remove('is-armed'); }, 5000);
      return;
    }
    b.disabled = true;
    // primero se borran los archivos de sus rutas (los del grupo se quedan para el resto)
    if(ownFiles.length){ try{ await IB.sb.storage.from('documentos').remove(ownFiles); }catch(_){} }
    const { error } = await IB.sb.rpc('delete_my_account');
    if(error){ b.disabled = false; return msg(IB.errMsg(error)); }
    await IB.sb.auth.signOut();
    show('login'); msg('Tu cuenta y tus datos se han eliminado.', true);
  });

  /* ---------- start ---------- */
  (async function(){
    if(!IB.configured){ show('off'); return; }
    if(!IB.enabled){
      show('off');
      $('[data-view="off"] h1', root).textContent = 'No podemos conectar ahora mismo.';
      $('[data-view="off"] .auth-sub', root).textContent = 'Revisa tu conexión y vuelve a intentarlo en un momento. Mientras tanto, puedes escribirnos por WhatsApp.';
      return;
    }
    const user = await IB.getUser();
    if(user){ if(next) location.replace(next); else dash(); return; }
    const modo = params.get('modo');
    if(modo === 'codigo' && pendingEmail) show('codigo');
    else show(modo === 'registro' ? 'registro' : 'login');
  })();
})();
