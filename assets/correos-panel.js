/* Iberail — panel: pestaña «Correos»
   Escribir un correo a un cliente, ver cómo queda cada correo automático y mandar campañas a quien aceptó publicidad (función «correos»). */
(function(){
  const IB = window.IB, root = document.getElementById('corView');
  if(!IB || !root) return;
  const $ = (s, r) => (r || root).querySelector(s);
  const esc = IB.esc;
  const AUTO = [
    ['ruta_recibida', 'Ruta recibida', 'Cuando alguien envía su ruta desde el planificador.'],
    ['presupuesto', 'Presupuesto listo', 'Cuando pasas una solicitud a «Presupuesto enviado».'],
    ['grupo', 'Bienvenida al grupo', 'Cuando metes a alguien en un grupo.'],
    ['pago_pendiente', 'Tu viaje ya tiene precio', 'Cuando le pones (o cambias) el importe a alguien. Con botón de pago.'],
    ['recordatorio', 'Recordatorio de pago', 'Los lunes, a quien le falte algo por pagar.'],
    ['pago_recibido', 'Pago recibido', 'Cuando entra un pago, por Stripe o apuntado a mano.'],
    ['cuenta_atras', 'Cuenta atrás', '30, 7 y 1 día antes de salir, con checklist.']
  ];
  const FIRMA_DEF = 'Joan – Atención al Cliente, Iberail\ninfo@iberail.com';
  const MAN = ['asunto', 'etiqueta', 'titulo', 'acento', 'texto', 'datos', 'cierre', 'boton_texto', 'boton_url'];
  let ready = false, total = null, tPrev = null, tMan = null, tPlan = null, ultimoPara = '';

  async function call(body){
    const { data } = await IB.sb.auth.getSession();
    const tok = data && data.session && data.session.access_token;
    const r = await fetch(`${String(IB.cfg.SUPABASE_URL).replace(/\/$/, '')}/functions/v1/correos`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${tok}`, apikey: IB.cfg.SUPABASE_ANON_KEY }, body: JSON.stringify(body)
    });
    const j = await r.json().catch(() => ({}));
    if(!r.ok || j.ok === false) throw new Error(j.error || (r.status === 404 ? 'La función «correos» aún no está instalada en Supabase.' : `Error ${r.status}`));
    return j;
  }
  const marca = () => ($('#corMarca') || {}).value || 'iberail';   // Iberail o Zarping: plantilla, remitente y a quién llega
  const form = () => ({ marca: marca(), asunto: $('#corAsunto').value, titulo: $('#corTitulo').value, texto: $('#corTexto').value, boton_texto: $('#corBtnT').value, boton_url: $('#corBtnU').value });
  const status = (t, bad) => { const s = $('#corStatus'); s.textContent = t; s.classList.toggle('is-bad', !!bad); };
  const leerFirma = () => { try{ return localStorage.getItem('ib-correo-firma') || FIRMA_DEF; }catch(e){ return FIRMA_DEF; } };
  const guardarFirma = v => { try{ localStorage.setItem('ib-correo-firma', v); }catch(e){} };

  // ---------- correo a un cliente ----------
  const mForm = () => { const o = { marca: marca(), para: $('#manPara').value.trim(), firma: $('#manFirma').value }; MAN.forEach(k => o[k] = $(`[data-m="${k}"]`).value); return o; };
  const mStatus = (t, bad) => { const s = $('#manStatus'); s.textContent = t; s.classList.toggle('is-bad', !!bad); };
  const mVacio = () => MAN.every(k => !$(`[data-m="${k}"]`).value.trim());
  const emailOk = e => /^[^\s@<>,;]+@[^\s@<>,;]+\.[a-z]{2,}$/i.test(e);

  function mEnviarTexto(){
    const p = $('#manPara').value.trim();
    $('#manSend').textContent = emailOk(p) ? `Enviar a ${p}` : 'Enviar';
  }
  async function mPreview(){
    try{ const j = await call({ action: 'ejemplo', tipo: 'manual', ...mForm() }); $('#manFrame').srcdoc = j.html; }catch(e){}
  }
  async function mPendientes(){
    const box = $('#manPend');
    try{
      const j = await call({ action: 'manual_pendientes' });
      box.hidden = !j.pendientes.length;
      box.innerHTML = j.pendientes.length ? `<span>Con texto ya preparado (${j.pendientes.length}):</span>` + j.pendientes.map(p => `<button type="button" class="cor-chip" data-para="${esc(p.email)}">${esc(p.nombre)}</button>`).join('') : '';
    }catch(e){ box.hidden = true; }
  }
  // al escribir el correo: si hay un texto preparado para esa persona (y aún no se ha usado), se rellena solo
  async function mPlantilla(){
    const para = $('#manPara').value.trim().toLowerCase();
    if(!emailOk(para) || para === ultimoPara) return;
    ultimoPara = para;
    try{
      const j = await call({ action: 'manual_plantilla', email: para });
      if(!j.plantilla) return;
      if(!mVacio() && !root.dataset.prellenado && !confirm('Hay un texto ya preparado para este correo. ¿Lo pongo? Se borrará lo que has escrito.')) return;
      MAN.forEach(k => $(`[data-m="${k}"]`).value = j.plantilla[k] || '');
      if(j.plantilla.firma) $('#manFirma').value = j.plantilla.firma;
      root.dataset.prellenado = '1';
      mStatus('Rellenado con el texto preparado para esta persona. Cambia lo que quieras antes de enviar.');
      mPreview();
    }catch(e){}
  }
  function mVaciar(){
    MAN.forEach(k => $(`[data-m="${k}"]`).value = '');
    $('#manPara').value = ''; ultimoPara = ''; delete root.dataset.prellenado;
    mEnviarTexto(); mPreview();
  }
  async function mSend(prueba){
    const f = mForm();
    if(!prueba && !emailOk(f.para)) return mStatus('Pon un correo válido en «Para».', true);
    if(!f.asunto.trim() || !f.titulo.trim() || !f.texto.trim()) return mStatus('Pon el asunto, el título y el texto.', true);
    if(!prueba && !confirm(`¿Enviar «${f.asunto}» a ${f.para}? No se puede deshacer.`)) return;
    const b = prueba ? $('#manTest') : $('#manSend'); b.disabled = true;
    mStatus(prueba ? 'Enviándote la prueba…' : 'Enviando…');
    try{
      const j = await call({ action: 'manual', prueba, ...f });
      guardarFirma(f.firma);
      if(prueba) mStatus(`Prueba enviada a ${j.para}. Mira tu bandeja de entrada.`);
      else { mVaciar(); mStatus(`¡Enviado a ${j.para}!`); mPendientes(); }
    }catch(e){ mStatus(e.message, true); }
    b.disabled = false;
  }

  function paint(){
    root.innerHTML = `
      <div class="adm-bar"><p class="adm-hint">Los correos de seguimiento salen solos a todos tus clientes, con la marca de su viaje. Las campañas solo llegan a quien marcó «acepto publicidad» en esa web y no se ha dado de baja.</p>
        <label class="cor-marca">Marca <select class="pl-input" id="corMarca"><option value="iberail">Iberail</option><option value="zarping">Zarping</option></select></label></div>

      <h3 class="cor-h">Correo a un cliente</h3>
      <div class="cor-camp">
        <div class="cor-form" id="manForm">
          <label>Para<input id="manPara" type="email" autocomplete="off" placeholder="nombre@gmail.com"></label>
          <div class="cor-pend" id="manPend" hidden></div>
          <label>Asunto<input data-m="asunto" maxlength="150" placeholder="Sobre tu viaje con Iberail"></label>
          <div class="cor-row cor-row--3">
            <label>Etiqueta<input data-m="etiqueta" maxlength="40" placeholder="Pago pendiente"></label>
            <label>Título grande<input data-m="titulo" maxlength="120" placeholder="Tu reserva sigue"></label>
            <label>En color<input data-m="acento" maxlength="80" placeholder="en pie."></label>
          </div>
          <label>Texto<textarea data-m="texto" rows="9" placeholder="Hola, Ana:&#10;&#10;Deja una línea en blanco entre párrafos. Pon *así* lo que quieras en negrita."></textarea></label>
          <label>Datos <small>(opcional · una fila por línea: «Importe: 100 €»)</small><textarea data-m="datos" rows="4" placeholder="Importe: 100 €&#10;Concepto: Iberail – Ana García"></textarea></label>
          <label>Texto después de los datos <small>(opcional)</small><textarea data-m="cierre" rows="4"></textarea></label>
          <label>Firma<textarea id="manFirma" rows="2"></textarea></label>
          <div class="cor-row">
            <label>Texto del botón <small>(opcional)</small><input data-m="boton_texto" maxlength="40" placeholder="Ver mi grupo"></label>
            <label>Enlace del botón<input data-m="boton_url" placeholder="https://iberail.com/grupos.html"></label>
          </div>
          <div class="cor-acts">
            <button type="button" class="btn btn--ghost btn--sm" id="manClear">Vaciar</button>
            <button type="button" class="btn btn--ghost btn--sm" id="manTest">Enviarme una prueba</button>
            <button type="button" class="btn btn--dark btn--sm" id="manSend">Enviar</button>
          </div>
          <p class="cor-status" id="manStatus" role="status"></p>
        </div>
        <div class="cor-prev"><span>Vista previa</span><iframe id="manFrame" title="Vista previa del correo al cliente"></iframe></div>
      </div>

      <h3 class="cor-h">Correos automáticos</h3>
      <div class="cor-auto">${AUTO.map(([k, t, d]) => `<button type="button" class="cor-auto-i" data-ej="${k}"><b>${esc(t)}</b><span>${esc(d)}</span><em>Ver correo →</em></button>`).join('')}</div>
      <h3 class="cor-h">Nueva campaña</h3>
      <div class="cor-camp">
        <div class="cor-form" id="corCampForm">
          <p class="cor-aud" id="corAud">Calculando a cuántas personas llega…</p>
          <label>Asunto<input id="corAsunto" maxlength="150" placeholder="El verano 2027 ya se está llenando 🚆"></label>
          <label>Título grande<input id="corTitulo" maxlength="120" placeholder="Reserva ahora y elige alojamiento"></label>
          <label>Texto<textarea id="corTexto" rows="8" placeholder="Deja una línea en blanco entre párrafos. Pon *así* lo que quieras en negrita."></textarea></label>
          <div class="cor-row">
            <label>Texto del botón<input id="corBtnT" maxlength="40" placeholder="Diseñar mi ruta"></label>
            <label>Enlace del botón<input id="corBtnU" placeholder="https://iberail.com/rutas.html"></label>
          </div>
          <div class="cor-acts">
            <button type="button" class="btn btn--ghost btn--sm" id="corTest">Enviarme una prueba</button>
            <button type="button" class="btn btn--dark btn--sm" id="corSend">Enviar campaña</button>
          </div>
          <p class="cor-status" id="corStatus" role="status"></p>
        </div>
        <div class="cor-prev"><span>Vista previa</span><iframe id="corFrame" title="Vista previa del correo"></iframe></div>
      </div>
      <div class="cor-modal" id="corModal" hidden><div class="cor-modal-in"><div class="cor-modal-h"><b id="corModalT"></b><button type="button" data-close aria-label="Cerrar">×</button></div><iframe id="corModalF" title="Correo"></iframe></div></div>`;

    $('#manFirma').value = leerFirma();
    root.addEventListener('click', async e => {
      const ej = e.target.closest('[data-ej]');
      if(ej){
        const m = $('#corModal'); m.hidden = false; $('#corModalT').textContent = 'Cargando…'; $('#corModalF').srcdoc = '';
        try{ const j = await call({ action: 'ejemplo', tipo: ej.dataset.ej, marca: marca() }); $('#corModalT').textContent = 'Asunto: ' + j.asunto; $('#corModalF').srcdoc = j.html; }
        catch(err){ $('#corModalT').textContent = err.message; }
      }
      const chip = e.target.closest('[data-para]');
      if(chip){ $('#manPara').value = chip.dataset.para; mEnviarTexto(); mPlantilla(); }
      if(e.target.closest('[data-close]') || e.target.id === 'corModal') $('#corModal').hidden = true;
    });
    root.addEventListener('input', e => {
      if(e.target.closest('#corCampForm')){ clearTimeout(tPrev); tPrev = setTimeout(preview, 500); }
      if(e.target.closest('#manForm')){
        if(e.target.id === 'manPara'){ mEnviarTexto(); clearTimeout(tPlan); tPlan = setTimeout(mPlantilla, 500); return; }
        if(e.target.dataset.m) delete root.dataset.prellenado;   // ya lo has tocado: no se pisa sin preguntar
        clearTimeout(tMan); tMan = setTimeout(mPreview, 500);
      }
    });
    $('#manClear').addEventListener('click', () => { mVaciar(); mStatus(''); });
    $('#manTest').addEventListener('click', () => mSend(true));
    $('#manSend').addEventListener('click', () => mSend(false));
    $('#corTest').addEventListener('click', () => send(true));
    $('#corSend').addEventListener('click', () => send(false));
    preview(); mPreview(); mPendientes();
    $('#corMarca').addEventListener('change', () => { audiencia(); preview(); mPreview(); });
    audiencia();
  }
  function audiencia(){
    total = null; $('#corAud').textContent = 'Calculando a cuántas personas llega…';
    call({ action: 'audiencia', marca: marca() }).then(j => { total = j.total; $('#corAud').innerHTML = `Esta campaña llegará a <b>${j.total}</b> ${j.total === 1 ? 'persona' : 'personas'} que aceptaron publicidad.`; $('#corSend').textContent = `Enviar a ${j.total} ${j.total === 1 ? 'persona' : 'personas'}`; })
      .catch(err => { $('#corAud').textContent = err.message; });
  }

  async function preview(){
    try{ const j = await call({ action: 'ejemplo', tipo: 'campana', ...form() }); $('#corFrame').srcdoc = j.html; }catch(e){}
  }

  async function send(prueba){
    const f = form();
    if(!f.asunto.trim() || !f.titulo.trim() || !f.texto.trim()) return status('Pon el asunto, el título y el texto.', true);
    if(!prueba && !confirm(`¿Enviar «${f.asunto}» a ${total == null ? 'todos los que aceptaron publicidad' : total + ' personas'}? No se puede deshacer.`)) return;
    const b = prueba ? $('#corTest') : $('#corSend'); b.disabled = true;
    status(prueba ? 'Enviándote la prueba…' : 'Enviando la campaña…');
    try{
      const j = await call({ action: 'campana', prueba, ...f });
      status(prueba ? `Prueba enviada a ${j.prueba}. Mira tu bandeja de entrada.` : `¡Campaña enviada a ${j.enviados} de ${j.total} personas!`);
    }catch(e){ status(e.message, true); }
    b.disabled = false;
  }

  window.IBCorreos = { show(){ if(!ready){ ready = true; paint(); } } };
})();
