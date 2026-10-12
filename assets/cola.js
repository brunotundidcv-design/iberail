/* Iberail — sala de espera al entrar en la web, con la temática del Día de la Hispanidad (12/10/2026).
   Cola simulada: entre 600 y 1.200 personas delante y entre 2 y 6 minutos de espera.
   · Sale una vez al día por navegador (localStorage ib-cola-<fecha>, recogido en la política de cookies).
   · Se apaga sola en HASTA (con la temática de la Hispanidad). Para quitarla antes: COLA_ON = false
     (o borrar este archivo y las líneas <script src="assets/cola.js">).
   · Va en el <head> (después de mantenimiento.js) de: portada, destinos, Split, planificador, contacto, cuenta y grupos.
     NO va en sorteo.html (para no tapar el resultado del sorteo), ni en las legales, ni en el panel, ni en Zarping.
   · El equipo pasa directo con ?equipo=1 (se recuerda en esa pestaña). ?cola=1 la enseña siempre (para probarla).
   · No sale a buscadores, vistas previas de enlaces ni robots, ni con la web en mantenimiento.
   · Al acabar avisa con el evento «ib-cola-fin» (la bienvenida de la Hispanidad espera a que termine). */
(function(){
  var COLA_ON = true;
  var HASTA = '2026-10-13T00:00:00+02:00';   // hora de Madrid
  var PERSONAS = [600, 1200];                 // personas delante (mín, máx)
  var ESPERA = [120, 360];                    // segundos de espera (mín, máx)
  var ENTRA_SOLO = 6;                         // segundos en «¡Es tu turno!» antes de entrar solo

  var q = location.search, forzar = /[?&]cola=1\b/.test(q);
  if(!COLA_ON) return;
  if(!forzar){
    if(Date.now() >= Date.parse(HASTA)) return;
    if(/zarping/i.test(location.hostname) || (window.IBERAIL_CONFIG || {}).MARCA === 'zarping') return;
    if(/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|twitterbot|linkedin|embedly|lighthouse|headless/i.test(navigator.userAgent) || navigator.webdriver) return;
    if(document.documentElement.classList.contains('ib-mant')) return;
  }
  var hoy = new Date().toLocaleDateString('sv-SE', { timeZone: 'Europe/Madrid' });
  var KEY = 'ib-cola-' + hoy;
  try{
    if(/[?&]equipo=1\b/.test(q)) sessionStorage.setItem('ib-cola-off', '1');
    if(!forzar && (sessionStorage.getItem('ib-cola-off') || localStorage.getItem(KEY))) return;
  }catch(e){ if(!forzar) return; }

  var rnd = function(a, b){ return a + Math.floor(Math.random() * (b - a + 1)); };
  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  var root = document.documentElement;
  root.classList.add('ib-cola');

  var css = document.createElement('style');
  css.textContent = [
'html.ib-cola,html.ib-cola body{overflow:hidden!important;background:#0B0B0B}',
'html.ib-cola body>*:not(.cola){visibility:hidden!important}',
'.cola{position:fixed;inset:0;z-index:2147483000;overflow-y:auto;-webkit-overflow-scrolling:touch;color:#F3F2EE;font-family:"Funnel Sans",system-ui,-apple-system,"Segoe UI",sans-serif;',
'  background:radial-gradient(70% 45% at 100% 0%,rgba(241,191,0,.16),transparent 70%),radial-gradient(80% 50% at 0% 100%,rgba(170,21,27,.38),transparent 72%),#0B0B0B;transition:opacity .45s ease}',
'.cola::before{content:"";position:absolute;inset:0;pointer-events:none;background-image:radial-gradient(rgba(255,255,255,.06) 1.2px,transparent 1.6px);background-size:24px 24px}',
'.cola.is-out{opacity:0;pointer-events:none}',
/* la bandera que ondea arriba */
'.cola-flag{position:absolute;left:0;right:0;top:0;height:clamp(46px,7vw,64px);overflow:hidden;pointer-events:none;filter:drop-shadow(0 10px 18px rgba(0,0,0,.55))}',
'.cola-flag svg{position:absolute;top:0;left:0;width:200%;max-width:none;height:100%;animation:colaOnda 10s linear infinite}',
'@keyframes colaOnda{to{transform:translateX(-50%)}}',
'.cola-in{position:relative;min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;padding:calc(84px + env(safe-area-inset-top)) 16px calc(28px + env(safe-area-inset-bottom))}',
'.cola-top{display:flex;align-items:center;gap:12px;flex-wrap:wrap;justify-content:center}',
'.cola-logo{display:flex;align-items:center;gap:10px;text-decoration:none}',
'.cola-logo img{width:38px;height:38px;border-radius:9px}',
'.cola-logo span{font-family:Poppins,sans-serif;font-weight:800;font-size:1.8rem;letter-spacing:-.045em;line-height:1;color:#F3F2EE}',
'.cola-logo b{font-weight:inherit;color:#F1BF00}',
'.cola-dia{display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 7px;border-radius:999px;border:1px solid rgba(241,191,0,.5);background:rgba(170,21,27,.25);color:#F1BF00;font-weight:700;font-size:.74rem;letter-spacing:.12em;text-transform:uppercase}',
'.cola-dia i{width:22px;height:15px;border-radius:3px;background:linear-gradient(#AA151B 0 25%,#F1BF00 25% 75%,#AA151B 75%)}',
'.cola-card{position:relative;width:min(460px,100%);padding:28px 26px 22px;border-radius:28px;border:1px solid #262626;background:linear-gradient(160deg,#161413,#0E0D0C);box-shadow:0 40px 80px -36px rgba(0,0,0,.9)}',
'.cola-k{display:flex;align-items:center;gap:10px;font-weight:700;font-size:.76rem;letter-spacing:.16em;text-transform:uppercase;color:#F1BF00}',
'.cola-k i{width:10px;height:10px;border-radius:50%;background:#E23A3F;box-shadow:0 0 0 0 rgba(226,58,63,.6);animation:colaPing 1.6s infinite}',
'@keyframes colaPing{70%{box-shadow:0 0 0 8px rgba(226,58,63,0)}100%{box-shadow:0 0 0 0 rgba(226,58,63,0)}}',
'.cola-h{margin:12px 0 8px;font-family:"Funnel Display",sans-serif;font-weight:800;font-size:clamp(1.7rem,7vw,2.1rem);line-height:1.04;letter-spacing:-.04em;color:#fff}',
'.cola-p{margin:0;color:#C9C8C2;font-size:.98rem;line-height:1.55}',
/* panel LED */
'.cola-led{position:relative;overflow:hidden;margin-top:20px;padding:24px 20px 16px;border-radius:20px;background:#050505;border:1px solid #262626;background-image:radial-gradient(rgba(255,255,255,.06) 1.2px,transparent 1.6px);background-size:8px 8px}',
'.cola-led::before{content:"";position:absolute;left:0;right:0;top:0;height:9px;background:linear-gradient(#AA151B 0 25%,#F1BF00 25% 75%,#AA151B 75%)}',
'.cola-row{display:block}',
'.cola-n{font-family:Doto,"Funnel Display",monospace;font-weight:900;font-size:clamp(3.6rem,17vw,4.8rem);line-height:.9;letter-spacing:.02em;color:#F1BF00;font-variant-numeric:tabular-nums;text-shadow:0 0 18px rgba(241,191,0,.55)}',
'.cola-nl{display:block;margin-top:8px;font-weight:700;font-size:.98rem;line-height:1.25;color:#F3F2EE}',
'.cola-eta{display:flex;flex-wrap:wrap;align-items:baseline;justify-content:space-between;gap:4px 10px;margin-top:14px;padding-top:12px;border-top:1px dashed rgba(255,255,255,.16)}',
'.cola-eta small{font-weight:700;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:#A3A29C;white-space:nowrap}',
'.cola-eta b{font-family:Doto,"Funnel Display",monospace;font-weight:900;font-size:1.55rem;color:#fff;font-variant-numeric:tabular-nums;white-space:nowrap}',
/* la vía con el tren hasta la bandera */
'.cola-track{position:relative;height:40px;margin:22px 0 6px}',
'.cola-rail{position:absolute;left:0;right:30px;bottom:6px;height:4px;border-radius:4px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.22) 0 12px,transparent 12px 20px)}',
'.cola-fill{position:absolute;left:0;bottom:6px;height:4px;border-radius:4px;background:linear-gradient(90deg,#AA151B,#E23A3F 40%,#F1BF00);width:0;transition:width 1s linear}',
'.cola-train{position:absolute;bottom:4px;left:0;font-size:28px;line-height:1;transform:translateX(-4px);transition:left 1s linear}',
'.cola-meta{position:absolute;right:0;bottom:4px;width:26px;height:36px}',
'.cola-meta::before{content:"";position:absolute;left:2px;bottom:0;width:2px;height:36px;border-radius:2px;background:#C9C8C2}',
'.cola-meta::after{content:"";position:absolute;left:4px;top:0;width:22px;height:15px;border-radius:0 3px 3px 0;background:linear-gradient(#AA151B 0 25%,#F1BF00 25% 75%,#AA151B 75%);transform-origin:left center;animation:colaBandera 1.4s ease-in-out infinite alternate}',
'@keyframes colaBandera{to{transform:skewY(6deg) scaleX(.92)}}',
'.cola-pct{display:flex;justify-content:space-between;font-weight:700;font-size:.78rem;letter-spacing:.08em;color:#A3A29C}',
'.cola-crowd{display:flex;align-items:center;gap:14px;margin-top:18px;padding:14px 16px;border-radius:16px;border:1px solid #262626;background:rgba(255,255,255,.03)}',
'.cola-av{display:flex;flex-shrink:0}',
'.cola-av span{width:30px;height:30px;margin-left:-9px;border-radius:50%;display:grid;place-items:center;font-weight:800;font-size:.8rem;color:#140B08;border:2px solid #0E0D0C;animation:colaPop .4s ease}',
'.cola-av span:first-child{margin-left:0}',
'@keyframes colaPop{from{transform:scale(.4);opacity:0}}',
'.cola-crowd p{flex:1;min-width:0;margin:0;font-size:.93rem;line-height:1.35;color:#C9C8C2}',
'.cola-crowd b{color:#fff}',
'.cola-warn{display:flex;gap:12px;align-items:flex-start;margin-top:16px;font-size:.9rem;line-height:1.45;color:#C9C8C2}',
'.cola-warn svg{flex-shrink:0;width:20px;height:20px;margin-top:1px;fill:none;stroke:#F1BF00;stroke-width:2;stroke-linecap:round}',
'.cola-upd{margin-top:14px;text-align:center;font-weight:600;font-size:.74rem;letter-spacing:.1em;color:#8C8B86}',
'.cola-lema{color:#A3A29C;font-size:.9rem;text-align:center}',
'.cola-lema b{color:#F1BF00;font-weight:700}',
/* ¡Es tu turno! */
'.cola-ok{text-align:center;padding:34px 26px 28px}',
'.cola-chk{width:92px;height:92px;margin:0 auto 20px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#FFE27A,#F1BF00);box-shadow:0 0 0 10px rgba(170,21,27,.55),0 0 0 20px rgba(241,191,0,.14);animation:colaPop .5s ease}',
'.cola-chk svg{width:38px;height:38px;fill:none;stroke:#140B08;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}',
'.cola-ok .cola-h{margin:0 0 8px;font-size:clamp(2rem,9vw,2.5rem)}',
'.cola-go{display:inline-flex;align-items:center;justify-content:center;gap:12px;width:100%;max-width:290px;margin-top:22px;padding:17px 26px;border:0;border-radius:14px;background:#F1BF00;color:#0B0B0B;font:800 1.06rem/1 "Funnel Sans",sans-serif;cursor:pointer;box-shadow:0 14px 34px -14px rgba(241,191,0,.85);transition:transform .15s,background .15s}',
'.cola-go:focus{outline:none}.cola-go:focus-visible{outline:2px solid rgba(255,255,255,.55);outline-offset:3px}.cola-go:hover{background:#FFD21A}.cola-go:active{transform:scale(.97)}',
'.cola-go svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}',
'.cola-bar{width:100%;max-width:290px;height:4px;margin:16px auto 0;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden}',
'.cola-bar i{display:block;height:100%;width:0;background:linear-gradient(90deg,#AA151B,#F1BF00);border-radius:4px}',
'.cola-cf{position:absolute;inset:0;pointer-events:none;overflow:hidden}',
'.cola-cf i{position:absolute;top:-20px;width:9px;height:16px;border-radius:2px;animation:colaCae linear forwards}',
'@keyframes colaCae{to{transform:translate3d(var(--x),110vh,0) rotate(var(--r))}}',
'.sr-cola{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}',
'@media (prefers-reduced-motion: reduce){.cola *,.cola *::before,.cola *::after{animation:none!important;transition:none!important}}'
  ].join('\n');
  (document.head || root).appendChild(css);

  /* ---------- la cola ---------- */
  var delante0 = rnd(PERSONAS[0], PERSONAS[1]);
  var total = rnd(ESPERA[0], ESPERA[1]) * 1000;
  var t0 = Date.now();
  // momentos en que sale cada persona de delante: ritmo irregular (a ratos va más rápido), el último justo al acabar
  var pesos = [], suma = 0, i;
  for(i = 0; i < delante0; i++){ var p = 0.3 + Math.random() * 1.7; if(Math.random() < .04) p *= 6; pesos.push(p); suma += p; }
  var salidas = [], acc = 0;
  for(i = 0; i < delante0; i++){ acc += pesos[i]; salidas.push(acc / suma * total); }
  var fuera = 0;                                   // cuántas han salido ya (las salidas van en orden)
  var detras = rnd(180, 420);

  var LETRAS = 'AAABCCDEFGJLLMMMNPRSSTV';
  var COLORES = ['#F1BF00', '#FFE27A', '#E23A3F', '#F3F2EE', '#FFB81C', '#F6C6A8', '#D7301E'];
  var persona = function(){ return { l: LETRAS[rnd(0, LETRAS.length - 1)], c: COLORES[rnd(0, COLORES.length - 1)] }; };
  var caras = []; for(i = 0; i < 5; i++) caras.push(persona());

  var num = function(n){ return n.toLocaleString('es-ES'); };
  var fmt = function(s){ return s < 60 ? s + ' s' : Math.floor(s / 60) + ' min' + (s % 60 ? ' ' + (s % 60) + ' s' : ''); };
  var per = function(n){ return num(n) + ' ' + (n === 1 ? 'persona' : 'personas'); };

  var el = document.createElement('div');
  el.className = 'cola';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'colaH');
  // bandera que ondea arriba: tres franjas (1:2:1) que siguen una onda; el dibujo se repite y se desplaza sin cortes
  var bandera = (function(){
    var W = 2400, P = 400, A = 7, y0 = 9, alto = 50, pts = function(o, rev){ var a = []; for(var x = 0; x <= W; x += 20) a.push(x + ' ' + (y0 + o * alto + A * Math.sin(2 * Math.PI * x / P)).toFixed(1)); return rev ? a.reverse() : a; };
    var franja = function(o1, o2, c){ return '<path fill="' + c + '" d="M' + pts(o1).concat(pts(o2, true)).join(' L') + 'Z"/>'; };
    return '<svg viewBox="0 0 ' + W + ' 72" preserveAspectRatio="none"><defs><linearGradient id="colaSombra" gradientUnits="userSpaceOnUse" x1="0" x2="' + P + '" spreadMethod="repeat">' +
      '<stop offset="0" stop-color="#fff" stop-opacity=".2"/><stop offset=".25" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#000" stop-opacity=".28"/><stop offset=".75" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity=".2"/></linearGradient></defs>' +
      franja(0, .25, '#AA151B') + franja(.25, .75, '#F1BF00') + franja(.75, 1, '#AA151B') + '<path fill="url(#colaSombra)" d="M' + pts(0).concat(pts(1, true)).join(' L') + 'Z"/></svg>';
  })();
  var cabeza = '<div class="cola-flag" aria-hidden="true">' + bandera + '</div>' +
    '<div class="cola-top"><a class="cola-logo" href="index.html" tabindex="-1" aria-label="Iberail"><img src="assets/img/icon.svg" alt=""><span>ibe<b>rail</b></span></a>' +
    '<span class="cola-dia"><i aria-hidden="true"></i>12 de octubre</span></div>';
  var lema = '<div class="cola-lema">Feliz <b>Día de la Hispanidad</b> · Desde España, a toda Europa</div>';
  el.innerHTML = cabeza.replace('<div class="cola-top">', '<div class="cola-in"><div class="cola-top">') +
    '<div class="cola-card">' +
      '<div class="cola-k"><i aria-hidden="true"></i>Sala de espera</div>' +
      '<h1 class="cola-h" id="colaH">Estás en la cola para entrar</h1>' +
      '<p class="cola-p">Hoy, Día de la Hispanidad, hay muchísima gente entrando a la vez. Te guardamos el sitio y entras en cuanto sea tu turno.</p>' +
      '<div class="cola-led">' +
        '<div class="cola-row">' +
          '<div><div class="cola-n" data-cola-n>' + num(delante0) + '</div><span class="cola-nl" data-cola-nl>personas delante de ti</span></div>' +
          '<div class="cola-eta"><small>Tiempo estimado</small><b data-cola-eta>' + fmt(Math.ceil(total / 1000)) + '</b></div>' +
        '</div>' +
        '<div class="cola-track" aria-hidden="true"><div class="cola-rail"></div><div class="cola-fill" data-cola-fill></div><span class="cola-train" data-cola-train>🚆</span><span class="cola-meta"></span></div>' +
        '<div class="cola-pct" aria-hidden="true"><span data-cola-pct>0 %</span><span>Tu turno</span></div>' +
      '</div>' +
      '<div class="cola-crowd"><div class="cola-av" data-cola-av aria-hidden="true"></div><p data-cola-crowd></p></div>' +
      '<div class="cola-warn"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg><span>No cierres ni recargues esta página: perderías tu sitio en la cola.</span></div>' +
      '<div class="cola-upd" data-cola-upd>Actualizado ahora</div>' +
      '<div class="sr-cola" aria-live="polite" data-cola-sr></div>' +
    '</div>' + lema + '</div>';
  var $ = function(s){ return el.querySelector(s); };

  var ultimoDelante = delante0, ultimoSr = 0, timer = null;
  function pintaCaras(){ $('[data-cola-av]').innerHTML = caras.map(function(p){ return '<span style="background:' + p.c + '">' + p.l + '</span>'; }).join(''); }
  function tick(){
    var t = Date.now() - t0;
    while(fuera < delante0 && salidas[fuera] <= t) fuera++;
    var delante = delante0 - fuera;
    if(t >= total || delante <= 0) return turno();
    if(delante !== ultimoDelante){
      var salen = Math.min(5, ultimoDelante - delante);
      for(var k = 0; k < salen; k++){ caras.shift(); caras.push(persona()); }
      ultimoDelante = delante;
      pintaCaras();
    }
    if(Math.random() < 0.7) detras += rnd(1, 6);                    // sigue llegando gente detrás
    else if(Math.random() < 0.15) detras = Math.max(60, detras - rnd(1, 3));   // alguno se cansa y se va
    var pct = Math.min(99, Math.floor(t / total * 100));
    $('[data-cola-n]').textContent = num(delante);
    $('[data-cola-nl]').textContent = (delante === 1 ? 'persona delante' : 'personas delante') + ' de ti';
    $('[data-cola-eta]').textContent = fmt(Math.max(1, Math.ceil((total - t) / 1000)));
    $('[data-cola-fill]').style.width = 'calc((100% - 30px) * ' + (pct / 100) + ')';
    $('[data-cola-train]').style.left = 'calc((100% - 60px) * ' + (pct / 100) + ')';
    $('[data-cola-pct]').textContent = pct + ' %';
    $('[data-cola-crowd]').innerHTML = '<b>' + per(delante) + '</b> delante y <b>' + num(detras) + '</b> esperando detrás de ti';
    if(t - ultimoSr > 15000){ ultimoSr = t; $('[data-cola-sr]').textContent = per(delante) + ' delante de ti. Tiempo estimado: ' + fmt(Math.ceil((total - t) / 1000)) + '.'; }
  }

  function confeti(){
    if(reduce) return;
    var cf = document.createElement('div'); cf.className = 'cola-cf'; cf.setAttribute('aria-hidden', 'true');
    var cols = ['#AA151B', '#F1BF00', '#F1BF00', '#E23A3F', '#FFE27A', '#FFFFFF'], h = '';
    for(var k = 0; k < 70; k++){
      h += '<i style="left:' + (Math.random() * 100).toFixed(1) + '%;background:' + cols[k % cols.length] + ';--x:' + rnd(-80, 80) + 'px;--r:' + rnd(-540, 540) + 'deg;animation-duration:' + (2.2 + Math.random() * 2.2).toFixed(2) + 's;animation-delay:' + (Math.random() * .6).toFixed(2) + 's"></i>';
    }
    cf.innerHTML = h; el.appendChild(cf);
  }
  function turno(){
    clearInterval(timer);
    el.innerHTML = cabeza.replace('<div class="cola-top">', '<div class="cola-in"><div class="cola-top">') +
      '<div class="cola-card cola-ok">' +
        '<div class="cola-chk" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
        '<h1 class="cola-h" id="colaH">¡Es tu turno!</h1>' +
        '<p class="cola-p">Gracias por esperar. Ya puedes entrar.</p>' +
        '<button type="button" class="cola-go" data-cola-go>Entrar en iberail <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>' +
        '<div class="cola-bar" aria-hidden="true"><i data-cola-bar></i></div>' +
      '</div>' + lema + '</div>';
    confeti();
    var go = $('[data-cola-go]');
    go.addEventListener('click', entrar);
    try{ go.focus({ preventScroll: true }); }catch(e){}
    var bar = $('[data-cola-bar]');
    if(!reduce && bar.animate) bar.animate([{ width: '0%' }, { width: '100%' }], { duration: ENTRA_SOLO * 1000, fill: 'forwards' });
    else bar.style.width = '100%';
    setTimeout(entrar, ENTRA_SOLO * 1000);
  }

  var dentro = false;
  function entrar(){
    if(dentro) return; dentro = true;
    try{ localStorage.setItem(KEY, String(Date.now())); }catch(e){}
    el.classList.add('is-out');
    root.classList.remove('ib-cola');
    setTimeout(function(){ el.remove(); }, 500);
    try{ window.dispatchEvent(new Event('ib-cola-fin')); }catch(e){}
  }

  function monta(){
    document.body.appendChild(el);
    pintaCaras();
    tick();
    timer = setInterval(tick, 1000);
  }
  if(document.body) monta();
  else document.addEventListener('DOMContentLoaded', monta);
})();
