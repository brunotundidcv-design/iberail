/* Iberail — web cerrada por mantenimiento hasta una hora concreta (después se abre sola).
   Va en el <head> de todas las páginas públicas (no en el panel), justo después de config.js.
   Para quitarlo antes de tiempo: HASTA = '' (o borrar el archivo y las líneas <script src="assets/mantenimiento.js">).
   El equipo puede entrar igualmente con ?equipo=1 (se recuerda en esa pestaña).
   INICIO = hora a la que empezó el mantenimiento (solo mueve el tren de la ruta; si se deja vacío, la ruta se oculta).
   Concepto: panel de salidas de una estación + minijuego «Ruta Interrail» (Pac-Man ferroviario: el tren se come los billetes y huye de los retrasos;
   por Split, Budapest, Praga, Berlín y Ámsterdam). */
(function(){
  var HASTA  = '2026-10-21T17:30:00+02:00';   // hora de Madrid
  var INICIO = '2026-10-21T16:00:00+02:00';   // hora de Madrid
  var RANKING = false;                        // true = ranking del minijuego (necesita la tabla de 15-ranking-juego.sql)
  var fin = Date.parse(HASTA);
  if(!fin || Date.now() >= fin) return;
  try{
    if(/[?&]equipo=1\b/.test(location.search)) sessionStorage.setItem('ib-mant-off', '1');
    if(sessionStorage.getItem('ib-mant-off')) return;
  }catch(e){}

  var ini = Date.parse(INICIO) || 0;
  var CIUDADES = ['Split', 'Budapest', 'Praga', 'Berlín', 'Ámsterdam'];
  var html = document.documentElement;
  html.classList.add('ib-mant');

  var css = document.createElement('style');
  css.textContent = [
    'html.ib-mant,html.ib-mant body{overflow:hidden!important;background:#0A0A0A!important}',
    'html.ib-mant body>*:not(#ib-mant){display:none!important}',
    '#ib-mant{position:fixed;inset:0;z-index:2147483647;display:flex;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:30px 16px 44px;',
      'background:radial-gradient(ellipse 80% 50% at 50% -8%,rgba(255,184,28,.2),transparent 70%),radial-gradient(ellipse 60% 40% at 100% 100%,rgba(255,184,28,.08),transparent 70%),#080808;',
      'color:#F1F0EB;font:400 1rem/1.55 "Funnel Sans",system-ui,sans-serif;text-align:center}',
    '#ib-mant *{box-sizing:border-box}',
    '#ib-mant .mt-in{position:relative;z-index:1;max-width:600px;width:100%;margin:auto}',

    /* fondo: estrellas y un tren que pasa */
    '#ib-mant .mt-bg{position:fixed;inset:0;z-index:0;pointer-events:none;overflow:hidden}',
    '#ib-mant .mt-bg s{position:absolute;width:2px;height:2px;border-radius:50%;background:#F1F0EB;opacity:.5;animation:mtTw 3.2s ease-in-out infinite}',
    '@keyframes mtTw{50%{opacity:.08}}',
    '#ib-mant .mt-pasa{position:absolute;left:0;bottom:0;width:820px;height:46px;opacity:.5;animation:mtPasa 22s linear 1.5s infinite;transform:translateX(-840px)}',
    '@keyframes mtPasa{to{transform:translateX(100vw)}}',

    '#ib-mant .mt-logo{display:inline-flex;align-items:center;gap:10px;margin-bottom:20px;color:inherit}',
    '#ib-mant .mt-logo img{width:38px;height:38px}',
    '#ib-mant .mt-word{font:800 1.8rem/1 Poppins,sans-serif;letter-spacing:-.02em;color:#F1F0EB}',
    '#ib-mant .mt-word b{color:#FFB81C;font-weight:800}',
    '#ib-mant h1{font:800 clamp(2.1rem,8vw,3.2rem)/1 "Funnel Display",sans-serif;margin:0 0 12px;letter-spacing:-.04em}',
    '#ib-mant h1 em{font-style:normal;color:#FFB81C}',
    '#ib-mant p{margin:0 auto 6px;color:#C9C8C2;max-width:440px}',
    '#ib-mant p b{color:#FFB81C;font-weight:600}',

    /* panel de salidas */
    '#ib-mant .mt-board{margin:26px auto 0;max-width:560px;border-radius:22px;background:linear-gradient(180deg,#121212,#0A0A0A);border:1px solid #2a2a2a;overflow:hidden;',
      'box-shadow:0 40px 80px -40px #000,0 0 0 1px rgba(255,184,28,.06),inset 0 1px 0 rgba(255,255,255,.05)}',
    '#ib-mant .mt-bh{display:flex;justify-content:space-between;align-items:center;gap:10px;padding:11px 16px;background:#FFB81C;color:#0C0C0C;',
      'font:800 .72rem "Funnel Sans",sans-serif;letter-spacing:.14em;text-transform:uppercase}',
    '#ib-mant .mt-bh span{display:inline-flex;align-items:center;gap:8px}',
    '#ib-mant .mt-bh i{width:8px;height:8px;border-radius:50%;background:#0C0C0C;animation:mtBlink 1.4s ease-in-out infinite}',
    '#ib-mant .mt-bh b{font-variant-numeric:tabular-nums;font-weight:800;letter-spacing:.06em}',
    '@keyframes mtBlink{50%{opacity:.2}}',
    '#ib-mant .mt-bc{padding:20px 12px 18px}',
    '#ib-mant .mt-lab{font:700 .66rem "Funnel Sans",sans-serif;letter-spacing:.2em;text-transform:uppercase;color:#8C8B85;margin-bottom:12px}',
    '#ib-mant .mt-fls{display:flex;justify-content:center;align-items:flex-start;gap:8px}',
    '#ib-mant .mt-g{display:flex;flex-direction:column;align-items:center;gap:8px}',
    '#ib-mant .mt-pair{display:flex;gap:5px}',
    '#ib-mant .mt-g>span{font:700 .6rem "Funnel Sans",sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#6F6E69}',
    '#ib-mant .mt-fls em{font:800 clamp(1.6rem,7vw,2.6rem)/clamp(54px,16.5vw,88px) "Funnel Display",sans-serif;font-style:normal;color:#FFB81C;animation:mtBlink 1s step-end infinite}',
    '#ib-mant .mt-fl{position:relative;display:block;width:clamp(34px,11vw,58px);height:clamp(54px,16.5vw,88px);border-radius:9px;border:1px solid #2c2c2c;',
      'background:linear-gradient(180deg,#242424 0 49.5%,#0a0a0a 50.5% 100%);color:#F1F0EB;',
      'font:800 clamp(2.1rem,10.5vw,3.7rem)/clamp(54px,16.5vw,88px) "Funnel Display",sans-serif;font-variant-numeric:tabular-nums;',
      'box-shadow:inset 0 1px 0 rgba(255,255,255,.08),0 10px 20px -10px #000}',
    '#ib-mant .mt-fl::after{content:"";position:absolute;left:0;right:0;top:50%;height:2px;margin-top:-1px;background:#050505;box-shadow:0 1px 0 rgba(255,255,255,.06)}',
    '#ib-mant .mt-fl::before{content:"";position:absolute;top:calc(50% - 4px);left:-2px;width:4px;height:8px;border-radius:2px;background:#333;box-shadow:calc(100% + 0px) 0 0 #333}',
    '#ib-mant .mt-fl.flip{animation:mtFlip .34s ease-in-out}',
    '@keyframes mtFlip{0%{transform:perspective(320px) rotateX(0)}45%{transform:perspective(320px) rotateX(-88deg);filter:brightness(.5)}55%{transform:perspective(320px) rotateX(88deg);filter:brightness(.5)}100%{transform:perspective(320px) rotateX(0)}}',
    '#ib-mant .mt-bf{display:grid;grid-template-columns:repeat(4,auto);justify-content:space-between;gap:10px;padding:14px 18px;border-top:1px solid #222;background:#0d0d0d;text-align:left}',
    '#ib-mant .mt-bf span{display:block;font:700 .58rem "Funnel Sans",sans-serif;letter-spacing:.16em;text-transform:uppercase;color:#6F6E69;margin-bottom:3px}',
    '#ib-mant .mt-bf b{display:block;font:800 .95rem "Funnel Display",sans-serif;letter-spacing:.02em;color:#F1F0EB;white-space:nowrap}',
    '#ib-mant .mt-est{color:#FFB81C!important;display:flex!important;align-items:center;gap:7px}',
    '#ib-mant .mt-est i{width:8px;height:8px;border-radius:50%;background:#FFB81C;box-shadow:0 0 10px #FFB81C;animation:mtBlink 1.2s ease-in-out infinite}',

    /* ruta */
    '#ib-mant .mt-ruta{position:relative;margin:34px 28px 0}',
    '#ib-mant .mt-via{position:relative;height:6px;border-radius:6px;background:#1E1E1E}',
    '#ib-mant .mt-via::after{content:"";position:absolute;inset:0;border-radius:6px;background:repeating-linear-gradient(90deg,transparent 0 9px,rgba(0,0,0,.55) 9px 12px)}',
    '#ib-mant .mt-via i{position:absolute;left:0;top:0;height:100%;border-radius:6px;background:linear-gradient(90deg,rgba(255,184,28,.35),#FFB81C);transition:width 1s linear}',
    '#ib-mant .mt-tren{position:absolute;top:-13px;width:34px;height:30px;margin-left:-17px;transition:left 1s linear;z-index:2;filter:drop-shadow(0 4px 8px rgba(255,184,28,.45))}',
    '#ib-mant .mt-paradas{position:relative;height:44px}',
    '#ib-mant .mt-parada{position:absolute;top:-10px;transform:translateX(-50%);display:flex;flex-direction:column;align-items:center;gap:7px;font:600 .66rem "Funnel Sans",sans-serif;color:#6F6E69;letter-spacing:.02em}',
    '#ib-mant .mt-parada u{width:14px;height:14px;border-radius:50%;background:#0A0A0A;border:3px solid #2A2A2A;transition:.4s;text-decoration:none}',
    '#ib-mant .mt-parada.on{color:#F1F0EB}',
    '#ib-mant .mt-parada.on u{border-color:#FFB81C;background:#FFB81C;box-shadow:0 0 0 5px rgba(255,184,28,.18)}',

    /* juego */
    '#ib-mant .mt-juego{margin:30px auto 0;padding:18px 16px 14px;border-radius:26px;background:linear-gradient(180deg,#151515,#0B0B0B);border:1px solid #2a2a2a;box-shadow:0 40px 80px -40px #000,0 0 60px -20px rgba(255,184,28,.15)}',
    '#ib-mant .mt-juego h2{font:800 1.35rem/1.1 "Funnel Display",sans-serif;margin:0 0 4px;letter-spacing:-.02em}',
    '#ib-mant .mt-juego h2 b{color:#FFB81C}',
    '#ib-mant .mt-juego small{display:block;margin-bottom:14px;color:#8C8B85;font-size:.82rem}',
    '#ib-mant .mt-cv{position:relative;border-radius:16px;overflow:hidden;border:1px solid #2c2c2c;background:#0B0B0B;aspect-ratio:4/3;width:100%;box-shadow:0 0 0 4px #121212,0 0 0 5px #262626}',
    '#ib-mant canvas{display:block;width:100%;height:100%;touch-action:none;cursor:pointer;-webkit-tap-highlight-color:transparent;outline:none;-webkit-user-select:none;user-select:none}',
    '#ib-mant .mt-jb{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-top:16px;font-size:.78rem;color:#8C8B85;text-align:left}',
    '#ib-mant .mt-jb b{color:#FFB81C;font-weight:600}',
    '#ib-mant .mt-snd{padding:7px 13px;border-radius:999px;border:1px solid #333;background:#101010;color:#C9C8C2;font:600 .75rem "Funnel Sans",sans-serif;cursor:pointer}',
    '#ib-mant .mt-snd[aria-pressed="true"]{border-color:#FFB81C;color:#FFB81C}',

    '#ib-mant .mt-rank{margin-top:18px;padding-top:16px;border-top:1px solid #242424;text-align:left}',
    '#ib-mant .mt-rank h3{margin:0 0 10px;display:flex;justify-content:space-between;align-items:baseline;gap:10px;font:800 1rem "Funnel Display",sans-serif;letter-spacing:-.01em}',
    '#ib-mant .mt-rank h3 small{margin:0;font:600 .7rem "Funnel Sans",sans-serif;color:#6F6E69;letter-spacing:.06em;text-transform:uppercase}',
    '#ib-mant .mt-rank input{width:100%;margin:0 0 10px;padding:10px 13px;border-radius:12px;border:1px solid #2f2f2f;background:#0E0E0E;color:#F1F0EB;font:600 .85rem "Funnel Sans",sans-serif;outline:none}',
    '#ib-mant .mt-rank input:focus{border-color:#FFB81C}',
    '#ib-mant .mt-rank ol{list-style:none;margin:0;padding:0;display:grid;gap:5px}',
    '#ib-mant .mt-rank li{display:grid;grid-template-columns:30px 1fr auto;align-items:center;gap:8px;padding:8px 12px;border-radius:12px;background:#101010;border:1px solid #1d1d1d;font:600 .85rem "Funnel Sans",sans-serif;color:#C9C8C2}',
    '#ib-mant .mt-rank li b{font:800 .85rem "Funnel Display",sans-serif;color:#6F6E69}',
    '#ib-mant .mt-rank li:nth-child(1) b{color:#FFD45A}#ib-mant .mt-rank li:nth-child(2) b{color:#D5D5D0}#ib-mant .mt-rank li:nth-child(3) b{color:#D9955A}',
    '#ib-mant .mt-rank li em{font:800 .85rem "Funnel Display",sans-serif;font-style:normal;font-variant-numeric:tabular-nums;color:#F1F0EB}',
    '#ib-mant .mt-rank li.me{background:rgba(255,184,28,.12);border-color:rgba(255,184,28,.45);color:#FFB81C}',
    '#ib-mant .mt-rank li.me em{color:#FFB81C}',
    '#ib-mant .mt-rank li.nuevo{animation:mtNuevo 1.4s ease-out}',
    '@keyframes mtNuevo{0%{transform:scale(1.04);box-shadow:0 0 0 0 rgba(255,184,28,.6)}100%{transform:scale(1);box-shadow:0 0 0 14px rgba(255,184,28,0)}}',
    '#ib-mant .mt-pie{margin-top:30px}',
    '#ib-mant .mt-wa{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 22px;border-radius:14px;',
      'background:#FFB81C;color:#0C0C0C;font-weight:700;text-decoration:none;transition:.2s}',
    '#ib-mant .mt-wa:hover{background:#fff;transform:translateY(-1px)}',
    '#ib-mant .mt-mail{display:block;margin-top:14px;font-size:.9rem;color:#A3A29C}',
    '#ib-mant .mt-mail a{color:inherit}',
    '@media (max-width:460px){#ib-mant .mt-bf{grid-template-columns:1fr 1fr}#ib-mant .mt-parada{font-size:.58rem}#ib-mant .mt-jb{flex-direction:column;align-items:flex-start}}',
    '@media (prefers-reduced-motion:reduce){#ib-mant .mt-bg s,#ib-mant .mt-pasa,#ib-mant .mt-bh i,#ib-mant .mt-est i,#ib-mant .mt-fls em{animation:none}#ib-mant .mt-pasa{display:none}#ib-mant .mt-via i,#ib-mant .mt-tren{transition:none}#ib-mant .mt-fl.flip{animation:none}}'
  ].join('');
  (document.head || html).appendChild(css);

  function dos(n){ return (n < 10 ? '0' : '') + n; }
  function quedan(){
    var s = Math.max(0, Math.ceil((fin - Date.now()) / 1000));
    return { h: Math.floor(s / 3600), m: Math.floor(s % 3600 / 60), s: s % 60 };
  }
  function horaTxt(){
    var h = HASTA.slice(11, 16), f = new Date(fin), n = new Date();
    return '<span style="white-space:nowrap">' + (f.toDateString() === n.toDateString() ? 'hoy' : dos(f.getDate()) + '/' + dos(f.getMonth() + 1)) + ' a las <b>' + h + '</b></span>';
  }
  function reloj(){
    try{ return new Date().toLocaleTimeString('es-ES', { timeZone: 'Europe/Madrid', hour12: false }); }
    catch(e){ var n = new Date(); return dos(n.getHours()) + ':' + dos(n.getMinutes()) + ':' + dos(n.getSeconds()); }
  }
  function par(id){ return '<div class="mt-pair"><span class="mt-fl" data-fl="' + id + '0">0</span><span class="mt-fl" data-fl="' + id + '1">0</span></div>'; }

  function pintar(){
    if(document.getElementById('ib-mant')) return;
    var cfg = window.IBERAIL_CONFIG || {};
    // el mismo enlace que el resto de la web (wa.me con el número); el enlace corto solo si no hay número
    var wa = cfg.WA_PHONE ? 'https://wa.me/' + cfg.WA_PHONE + '?text=' + encodeURIComponent('Hola Iberail, tengo una duda') : (cfg.WA_LINK || '');
    var i, paradas = '', estrellas = '';
    for(i = 0; i < CIUDADES.length; i++){
      var pos = i / (CIUDADES.length - 1);
      paradas += '<div class="mt-parada" data-p="' + pos + '" style="left:' + (pos * 100) + '%"><u></u>' + CIUDADES[i] + '</div>';
    }
    for(i = 0; i < 42; i++){
      estrellas += '<s style="left:' + (Math.random() * 100).toFixed(1) + '%;top:' + (Math.random() * 70).toFixed(1) + '%;animation-delay:' + (Math.random() * 3).toFixed(1) + 's;transform:scale(' + (0.6 + Math.random() * 1.1).toFixed(2) + ')"></s>';
    }
    var trenSvg =
      '<svg viewBox="0 0 34 30" aria-hidden="true"><rect x="2" y="3" width="30" height="20" rx="7" fill="#FFB81C"/>' +
      '<rect x="6" y="7" width="9" height="7" rx="2" fill="#0A0A0A"/><rect x="19" y="7" width="9" height="7" rx="2" fill="#0A0A0A"/>' +
      '<rect x="2" y="17" width="30" height="3" fill="#C98A00"/><circle cx="10" cy="26" r="3" fill="#F1F0EB"/><circle cx="24" cy="26" r="3" fill="#F1F0EB"/></svg>';
    // silueta del tren que cruza al fondo: locomotora + 4 vagones con ventanas encendidas
    var pasa = '<svg viewBox="0 0 820 46" width="820" height="46" aria-hidden="true"><rect x="0" y="43" width="820" height="2" fill="#FFB81C" opacity=".4"/>';
    for(i = 0; i < 4; i++){
      pasa += '<rect x="' + (i * 176 + 6) + '" y="8" width="166" height="32" rx="7" fill="#1a1a1a" stroke="#2c2c2c"/>';
      for(var w = 0; w < 7; w++) pasa += '<rect x="' + (i * 176 + 18 + w * 22) + '" y="14" width="13" height="9" rx="2" fill="#FFB81C" opacity="' + (w % 3 === 1 ? .35 : .85) + '"/>';
      pasa += '<rect x="' + (i * 176 + 6) + '" y="29" width="166" height="3" fill="#FFB81C" opacity=".5"/>';
    }
    pasa += '<path d="M712 40 L712 14 Q712 8 720 8 L770 8 Q792 10 806 26 L812 40 Z" fill="#FFB81C"/><path d="M768 12 L788 12 L802 26 L768 26 Z" fill="#0A0A0A"/>' +
      '<rect x="722" y="14" width="14" height="10" rx="2" fill="#0A0A0A"/><rect x="742" y="14" width="14" height="10" rx="2" fill="#0A0A0A"/></svg>';

    var d = document.createElement('div');
    d.id = 'ib-mant';
    d.setAttribute('role', 'alert');
    d.innerHTML =
      '<div class="mt-bg" aria-hidden="true">' + estrellas + '<div class="mt-pasa">' + pasa + '</div></div>' +
      '<div class="mt-in">' +
        '<span class="mt-logo"><img src="assets/img/icon.svg" alt=""><span class="mt-word">ibe<b>rail</b></span></span>' +
        '<h1>Estamos puliendo<br>la <em>web</em></h1>' +
        '<p>Estamos dejando todo a punto para tus rutas. Volvemos ' + horaTxt() + '.</p>' +
        '<div class="mt-board">' +
          '<div class="mt-bh"><span><i></i>Salidas · Departures</span><b data-mt="reloj">' + reloj() + '</b></div>' +
          '<div class="mt-bc"><div class="mt-lab">La web sale en</div>' +
            '<div class="mt-fls" aria-live="off">' +
              '<div class="mt-g">' + par('h') + '<span>horas</span></div><em>:</em>' +
              '<div class="mt-g">' + par('m') + '<span>min</span></div><em>:</em>' +
              '<div class="mt-g">' + par('s') + '<span>seg</span></div>' +
            '</div></div>' +
          '<div class="mt-bf">' +
            '<div><span>Hora</span><b>' + HASTA.slice(11, 16) + '</b></div>' +
            '<div><span>Destino</span><b>iberail.com</b></div>' +
            '<div><span>Vía</span><b>1</b></div>' +
            '<div><span>Estado</span><b class="mt-est"><i></i>En obras</b></div>' +
          '</div>' +
        '</div>' +
        (ini && ini < fin ? '<div class="mt-ruta"><div class="mt-via"><i data-mt="via"></i></div><div class="mt-tren" data-mt="tren">' + trenSvg + '</div><div class="mt-paradas">' + paradas + '</div></div>' : '') +
        '<div class="mt-juego">' +
          '<h2>Mientras esperas: <b>Ruta Interrail</b></h2>' +
          '<small>Come los billetes, esquiva a los retrasos y llega hasta Ámsterdam.</small>' +
          '<div class="mt-cv"><canvas tabindex="0" aria-label="Minijuego Ruta Interrail: flechas o desliza para mover el tren"></canvas></div>' +
          '<div class="mt-jb"><span><b>Flechas</b> o desliza para moverte · come billetes y esquiva a los retrasos<br>Récord: <b data-mt="rec">0</b> puntos</span>' +
            '<button type="button" class="mt-snd" data-mt="snd" aria-pressed="false">Sonido: no</button></div>' +
          (RANKING ? '<div class="mt-rank"><h3>Ranking de la estación <small>top 10</small></h3>' +
            '<input type="text" maxlength="14" placeholder="Tu nombre para salir en el ranking" autocomplete="off" data-mt="nombre">' +
            '<ol data-mt="rank"></ol></div>' : '') +
        '</div>' +
        '<div class="mt-pie">' +
          (wa ? '<a class="mt-wa" href="' + wa + '" target="_blank" rel="noopener">¿Es urgente? Escríbenos por WhatsApp</a>' : '') +
          '<span class="mt-mail">o a <a href="mailto:info@iberail.com">info@iberail.com</a></span>' +
        '</div>' +
      '</div>';
    document.body.appendChild(d);

    var q = function(k){ return d.querySelector('[data-mt="' + k + '"]'); };
    var eVia = q('via'), eTren = q('tren'), eReloj = q('reloj');
    var stops = d.querySelectorAll('.mt-parada');
    var fl = {};
    ['h0', 'h1', 'm0', 'm1', 's0', 's1'].forEach(function(k){ fl[k] = d.querySelector('[data-fl="' + k + '"]'); });

    function ponDigito(k, ch, anim){
      var el = fl[k];
      if(el.textContent === ch) return;
      if(!anim){ el.textContent = ch; return; }
      el.classList.remove('flip'); void el.offsetWidth; el.classList.add('flip');
      setTimeout(function(){ el.textContent = ch; }, 150);
    }
    function tick(primera){
      if(Date.now() >= fin){ clearInterval(t); location.reload(); return; }
      var r = quedan(), a = !primera;
      var hs = dos(r.h), ms = dos(r.m), ss = dos(r.s);
      ponDigito('h0', hs.charAt(0), a); ponDigito('h1', hs.charAt(1), a);
      ponDigito('m0', ms.charAt(0), a); ponDigito('m1', ms.charAt(1), a);
      ponDigito('s0', ss.charAt(0), a); ponDigito('s1', ss.charAt(1), a);
      eReloj.textContent = reloj();
      if(eVia){
        var p = Math.min(1, Math.max(0, (Date.now() - ini) / (fin - ini)));
        eVia.style.width = (p * 100) + '%';
        eTren.style.left = (p * 100) + '%';
        for(var i = 0; i < stops.length; i++) stops[i].classList.toggle('on', p >= parseFloat(stops[i].getAttribute('data-p')) - 0.001);
      }
    }
    var t = setInterval(tick, 1000);
    tick(true);

    juego(d.querySelector('canvas'), q('rec'), q('snd'), RANKING ? crearRanking(q('rank'), q('nombre')) : { add: function(){ return null; } });
  }

  /* ---------- ranking de la estación: rivales ficticios + jugadores reales (Supabase, tabla ranking_juego) ----------
     Si la tabla no existe o no hay conexión, el ranking sigue funcionando solo con las partidas de este navegador. */
  var SEMILLA = [['Marta_Interrail', 4180], ['Dani.Budapest', 3650], ['Lucía R.', 3120], ['Pau94', 2740], ['Inés_Praga', 2290],
                 ['Álex M.', 1910], ['CarlosV', 1560], ['Noa', 1240], ['RaulTren', 930], ['Sofi_Split', 640]];
  var PROHIBIDAS = /(put[ao]s?|mierda|joder|cabr[oó]n|polla|co[ñn]o|nazi|hitler|maric[oó]n|gilipollas|zorra|follar|cunt|fuck|shit|nigg)/i;
  function sano(n){
    n = String(n || '').replace(/[<>&"]/g, '').trim().slice(0, 14);
    if(!n || PROHIBIDAS.test(n) || /https?:|www\.|\.com|\.es|@/i.test(n)) return 'Anónimo';
    return n;
  }
  function crearRanking(ul, inp){
    var cfg = window.IBERAIL_CONFIG || {};
    var API = cfg.SUPABASE_URL ? cfg.SUPABASE_URL + '/rest/v1/ranking_juego' : '', KEY = cfg.SUPABASE_ANON_KEY || '';
    var cli;
    try{
      cli = localStorage.getItem('ib-mant-cli');
      if(!cli){ cli = 'c' + Math.random().toString(36).slice(2, 12) + Date.now().toString(36); localStorage.setItem('ib-mant-cli', cli); }
    }catch(e){ cli = 'c' + Math.random().toString(36).slice(2, 12); }
    var mios = [], remotos = null, pend = [];
    try{ mios = JSON.parse(localStorage.getItem('ib-mant-rank') || '[]'); }catch(e){}
    try{ inp.value = localStorage.getItem('ib-mant-name') || ''; }catch(e){}
    function limpio(v){ return String(v || '').replace(/[<>&"]/g, '').trim().slice(0, 14); }
    function nombre(){ return sano(limpio(inp.value) || 'Jugador'); }
    function guardar(){ try{ localStorage.setItem('ib-mant-rank', JSON.stringify(mios)); localStorage.setItem('ib-mant-name', limpio(inp.value)); }catch(e){} }

    function todos(){
      var l = SEMILLA.map(function(s){ return { n: s[0], s: s[1], me: false }; });
      if(remotos){
        // la mejor partida de cada jugador real (un mismo navegador no ocupa varias filas)
        var mejor = {};
        remotos.concat(pend).forEach(function(r){ var k = r.cliente || r.nombre; if(!mejor[k] || r.puntos > mejor[k].puntos) mejor[k] = r; });
        Object.keys(mejor).forEach(function(k){ var r = mejor[k]; l.push({ n: sano(r.nombre), s: r.puntos, me: r.cliente === cli, id: r.id }); });
      }else{
        mios.forEach(function(m){ l.push({ n: m.n, s: m.s, me: true, id: m.id }); });
      }
      return l.sort(function(a, b){ return b.s - a.s; });
    }
    function render(nuevoId){
      var l = todos(), i;
      ul.innerHTML = '';
      function fila(r, pos){
        var li = document.createElement('li'), b = document.createElement('b'), n = document.createElement('span'), e = document.createElement('em');
        b.textContent = pos; n.textContent = r.n; e.textContent = r.s;
        if(r.me) li.className = 'me' + (r.id && r.id === nuevoId ? ' nuevo' : '');
        li.appendChild(b); li.appendChild(n); li.appendChild(e); ul.appendChild(li);
      }
      for(i = 0; i < Math.min(10, l.length); i++) fila(l[i], i + 1);
      for(i = 10; i < l.length; i++) if(l[i].me){ fila(l[i], i + 1); break; }   // tu mejor puesto aunque no entre en el top 10
    }
    function cargar(){
      if(!API || !window.fetch) return;
      fetch(API + '?select=id,nombre,puntos,cliente&order=puntos.desc&limit=200', { headers: { apikey: KEY } })
        .then(function(r){ if(!r.ok) throw 0; return r.json(); })
        .then(function(rows){ if(Array.isArray(rows)){ remotos = rows; render(); } })
        .catch(function(){});
    }
    inp.addEventListener('input', function(){
      var v = nombre(); mios.forEach(function(m){ m.n = v; }); guardar(); render();
    });
    inp.addEventListener('keydown', function(e){ e.stopPropagation(); });
    render(); cargar();
    setInterval(function(){ if(document.getElementById('ib-mant')) cargar(); }, 20000);

    return {
      add: function(puntos, nivel){
        if(puntos <= 0) return null;
        var id = 'l' + Date.now() + Math.random().toString(36).slice(2, 6), nom = nombre();
        mios.push({ n: nom, s: puntos, id: id });
        mios.sort(function(a, b){ return b.s - a.s; }); mios = mios.slice(0, 3);   // solo tus 3 mejores partidas (modo sin conexión)
        guardar();
        var ent = { id: id, nombre: nom, puntos: puntos, cliente: cli };
        pend.push(ent);
        if(API && window.fetch){
          fetch(API, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
                       body: JSON.stringify({ nombre: nom, puntos: puntos, nivel: nivel || 1, cliente: cli }) })
            .then(function(r){ if(!r.ok) throw 0; pend = pend.filter(function(p){ return p !== ent; }); cargar(); })
            .catch(function(){});
        }
        var l = todos(), i = 0;
        while(i < l.length && l[i].s > puntos) i++;
        render(id);
        return { pos: i + 1, total: Math.max(l.length, i + 1), rival: i > 0 ? l[i - 1].n : null, falta: i > 0 ? l[i - 1].s - puntos + 10 : 0 };
      }
    };
  }

  /* =====================================================================================
     Ruta Interrail: tren en scroll lateral. Salta las obras, recoge billetes, llega a la siguiente ciudad.
     ===================================================================================== */
  function juego(cv, eRec, bSnd, rk){
    var ctx = cv.getContext && cv.getContext('2d');
    if(!ctx) return;
    var W = 480, H = 360, GY = 104, TW = 480, AMBAR = '#FFB81C';

    function hex(c){ return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
    function mix(a, b, k){ return 'rgb(' + Math.round(a[0] + (b[0] - a[0]) * k) + ',' + Math.round(a[1] + (b[1] - a[1]) * k) + ',' + Math.round(a[2] + (b[2] - a[2]) * k) + ')'; }
    // ciudades: cielo, astro, siluetas y ventanas encendidas
    var PAL = [
      { n: 'Split',     top: '#1B2A5E', bot: '#FF8A5B', cel: '#FFD27A', cy: 86, cr: 34, star: .12, far: '#6B3F66', mid: '#2B2040', lit: .10 },
      { n: 'Budapest',  top: '#140F3D', bot: '#B24A8F', cel: '#F5E9D0', cy: 40,  cr: 15, star: .55, far: '#3A2760', mid: '#1C1233', lit: .35 },
      { n: 'Praga',     top: '#050B1F', bot: '#12406B', cel: '#E8E4D0', cy: 34,  cr: 16, star: 1,   far: '#1B3350', mid: '#0B1626', lit: .40 },
      { n: 'Berlín',    top: '#0B0E14', bot: '#3B4A63', cel: '#C9D3E6', cy: 46,  cr: 13, star: .6,  far: '#2A3345', mid: '#11151D', lit: .30 },
      { n: 'Ámsterdam', top: '#3D4C86', bot: '#FFB58A', cel: '#FFE3A8', cy: 82, cr: 28, star: .08, far: '#7A6A8C', mid: '#3C3050', lit: .14 }
    ];
    PAL.forEach(function(p){ p.rt = hex(p.top); p.rb = hex(p.bot); p.rc = hex(p.cel); });

    function rng(s){ return function(){ s |= 0; s = s + 0x6D2B79F5 | 0; var t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

    /* ---- siluetas de cada ciudad, dibujadas una vez en canvas fuera de pantalla y repetidas al desplazarse ---- */
    var tiles = [], tileSc = 0;
    function nuevoLienzo(h, sc){
      var c = document.createElement('canvas'); c.width = Math.round(TW * sc); c.height = Math.round(h * sc);
      var g = c.getContext('2d'); g.scale(sc, sc); return { c: c, g: g, h: h };
    }
    function construir(sc){
      tileSc = sc; tiles = [];
      PAL.forEach(function(p, ci){
        var r = rng(ci * 977 + 13), far = nuevoLienzo(100, sc), mid = nuevoLienzo(150, sc), g, TH, x, w, h;
        // lejos: edificios genericos de la ciudad
        g = far.g; TH = 100; g.fillStyle = p.far; x = 0;
        var alto = [30, 46, 52, 56, 40][ci];
        while(x < TW){
          w = 14 + r() * 26; if(x + w > TW) w = TW - x;
          h = 16 + r() * alto; g.fillRect(x, TH - h, w, h);
          if(ci === 2 && r() < .5){ g.beginPath(); g.moveTo(x + 1, TH - h); g.lineTo(x + w / 2, TH - h - 14 - r() * 10); g.lineTo(x + w - 1, TH - h); g.fill(); }
          x += w + (r() < .3 ? 5 : 0);
        }
        // cerca: monumentos
        g = mid.g; TH = 150;
        function B(bx, bw, bh){ g.fillStyle = p.mid; g.fillRect(bx, TH - bh, bw, bh); luces(bx, bw, bh); }
        function luces(bx, bw, bh){
          if(!p.lit) return;
          for(var yy = TH - bh + 8; yy < TH - 7; yy += 10) for(var xx = bx + 4; xx < bx + bw - 5; xx += 7){
            if(r() < p.lit){ g.fillStyle = 'rgba(255,200,87,.85)'; g.fillRect(xx, yy, 3, 4); }
          }
        }
        function T(tx, tw, base, peak){ g.fillStyle = p.mid; g.beginPath(); g.moveTo(tx, TH - base); g.lineTo(tx + tw, TH - base); g.lineTo(tx + tw / 2, TH - base - peak); g.fill(); }
        function bajos(x0, x1, hmin, hmax){ var bx = x0; while(bx < x1){ var bw = 22 + r() * 22; if(bx + bw > x1) bw = x1 - bx; B(bx, bw, hmin + r() * (hmax - hmin)); bx += bw + 2; } }
        function palmera(px, ph){
          g.strokeStyle = p.mid; g.lineWidth = 3; g.beginPath(); g.moveTo(px, TH); g.quadraticCurveTo(px - 5, TH - ph / 2, px + 5, TH - ph); g.stroke();
          g.lineWidth = 2.2;
          [[-24, 8], [-16, -4], [0, -10], [16, -4], [24, 8], [-8, 14], [10, 14]].forEach(function(f){
            g.beginPath(); g.moveTo(px + 5, TH - ph); g.quadraticCurveTo(px + 5 + f[0] / 2, TH - ph + f[1] - 12, px + 5 + f[0], TH - ph + f[1]); g.stroke();
          });
        }
        if(ci === 0){          // Split: casas bajas, campanario de San Duje y palmeras
          bajos(0, 286, 18, 36); bajos(332, 480, 18, 34);
          B(296, 24, 98); g.fillStyle = p.mid; g.fillRect(292, TH - 100, 32, 5); g.fillRect(300, TH - 122, 16, 22); T(298, 20, 122, 22);
          g.fillStyle = 'rgba(255,200,87,.7)'; g.fillRect(304, TH - 84, 4, 10); g.fillRect(304, TH - 62, 4, 10); g.fillRect(304, TH - 40, 4, 10);
          palmera(60, 70); palmera(196, 58); palmera(436, 74);
        }else if(ci === 1){    // Budapest: Parlamento con cupula y chapiteles
          bajos(0, 118, 22, 44); bajos(366, 480, 22, 44);
          B(124, 232, 34);
          for(x = 128; x < 352; x += 17) T(x, 9, 34, 15);
          B(208, 64, 50); g.fillStyle = p.mid; g.beginPath(); g.arc(240, TH - 84, 25, Math.PI, 0); g.fill();
          g.fillRect(239, TH - 84 - 25 - 20, 2, 20); T(235, 10, 84 + 25, 22);
          B(140, 14, 62); T(137, 20, 62, 26); B(332, 14, 62); T(329, 20, 62, 26);
          g.fillStyle = 'rgba(255,200,87,.8)'; for(x = 134; x < 346; x += 12) g.fillRect(x, TH - 22, 4, 7);
        }else if(ci === 2){    // Praga: iglesia de Tyn, castillo y agujas
          bajos(0, 6, 20, 30); B(10, 134, 32); B(60, 40, 56); B(72, 14, 72); T(68, 22, 72, 36); B(108, 10, 66); T(105, 16, 66, 44);
          bajos(150, 190, 22, 46);
          B(196, 26, 88); T(193, 32, 88, 54); B(256, 26, 88); T(253, 32, 88, 54); B(222, 34, 54); T(220, 38, 54, 24);
          bajos(290, 372, 22, 50); B(380, 16, 70); T(377, 22, 70, 36); bajos(404, 480, 22, 48);
        }else if(ci === 3){    // Berlin: Torre de TV y Puerta de Brandeburgo
          bajos(0, 100, 26, 60); bajos(214, 346, 30, 66); bajos(380, 480, 26, 56);
          for(x = 114; x < 200; x += 15) B(x, 6, 36);
          g.fillStyle = p.mid; g.fillRect(108, TH - 44, 100, 8); g.fillRect(118, TH - 52, 80, 8); g.fillRect(150, TH - 62, 16, 10); T(147, 22, 62, 8);
          g.beginPath(); g.moveTo(357, TH); g.lineTo(367, TH); g.lineTo(364, TH - 96); g.lineTo(360, TH - 96); g.fill();
          g.beginPath(); g.arc(362, TH - 100, 11, 0, 6.3); g.fill(); g.fillRect(361, TH - 144, 2, 36);
          g.fillStyle = '#E5342B'; g.beginPath(); g.arc(362, TH - 145, 2.2, 0, 6.3); g.fill();
        }else{                 // Amsterdam: casas de canal con hastiales y un molino
          x = 0;
          while(x < 332){
            w = 20 + r() * 12; h = 46 + r() * 38; B(x, w, h);
            var tipo = Math.floor(r() * 4); g.fillStyle = p.mid;
            if(tipo === 0){ g.fillRect(x - 1, TH - h - 3, w + 2, 3); }
            else if(tipo === 1){ g.beginPath(); g.moveTo(x, TH - h); g.quadraticCurveTo(x + w / 2, TH - h - 22, x + w, TH - h); g.fill(); }
            else if(tipo === 2){ for(var k = 0; k < 3; k++) g.fillRect(x + k * w / 6, TH - h - (k + 1) * 4, w - k * w / 3, 4); }
            else{ T(x, w, h, w * .7); }
            x += w + 1;
          }
          bajos(334, 372, 30, 50);
          g.fillStyle = p.mid; g.beginPath(); g.moveTo(392, TH); g.lineTo(412, TH); g.lineTo(408, TH - 54); g.lineTo(396, TH - 54); g.fill();
          g.beginPath(); g.arc(402, TH - 54, 8, Math.PI, 0); g.fill();
          g.strokeStyle = p.mid; g.lineWidth = 2.4;
          [[-34, -22], [34, 22], [22, -34], [-22, 34]].forEach(function(b){ g.beginPath(); g.moveTo(402, TH - 58); g.lineTo(402 + b[0], TH - 58 + b[1]); g.stroke(); });
          bajos(430, 480, 24, 44);
        }
        tiles.push({ far: far, mid: mid });
      });
    }

    var best = 0, sonido = false, ac = null;
    try{ best = parseInt(localStorage.getItem('ib-mant-best4'), 10) || 0; }catch(e){}
    eRec.textContent = best;

    /* ---- sonido (apagado por defecto) ---- */
    function tono(f1, f2, dur, tipo, vol, retraso){
      if(!sonido || !ac) return;
      var t0 = ac.currentTime + (retraso || 0), o = ac.createOscillator(), g = ac.createGain();
      o.type = tipo; o.frequency.setValueAtTime(f1, t0); o.frequency.exponentialRampToValueAtTime(f2, t0 + dur);
      g.gain.setValueAtTime(vol, t0); g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
      o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + .02);
    }
    bSnd.addEventListener('click', function(){
      sonido = !sonido;
      if(sonido && !ac){ try{ ac = new (window.AudioContext || window.webkitAudioContext)(); }catch(e){ sonido = false; } }
      if(ac && ac.state === 'suspended') ac.resume();
      bSnd.textContent = 'Sonido: ' + (sonido ? 'sí' : 'no'); bSnd.setAttribute('aria-pressed', sonido ? 'true' : 'false');
      if(sonido) tono(600, 1100, .12, 'sine', .08);
    });

    /* ---- Pac-Man ferroviario: el tren se come los billetes del mapa y huye de los retrasos ---- */
    var MAPA = [
      '###################',
      '#o.......#.......o#',
      '#.##.###.#.###.##.#',
      '#.................#',
      '#.##.#.#####.#.##.#',
      '#....#...#...#....#',
      '####.### # ###.####',
      '#....#       #....#',
      '#.##.# ##### #.##.#',
      '#....#...#...#....#',
      '#.##.###.#.###.##.#',
      '#o...............o#',
      '###################'
    ];
    var COLS = 19, ROWS = 13, CELL = 24, BX = 12, BY = 48;
    var DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];
    var COLG = ['#E5342B', '#FF7AB6', '#3DD6E8', '#FF9A3D'], AGR = [.92, .78, .62, .48];
    var NEON = ['#FF8A5B', '#C77DFF', '#3DD6E8', '#8DA9C4', '#FFB58A'];
    var rkRes = null, pelletId = 0;   // pelletId: cada billete P nuevo permite comerse a cada fantasma UNA vez
    var est = 'idle', mapa, dots, pac, fant, want, face = { x: 1, y: 0 }, score, vidas, nivel, asust, combo, pausa, parts, flos, shake, ovT, banT, banName, banNum, hasta, last = 0, mazeCv = null, mazeNivel = -1, mazeSc = 0;

    function rand(n){ return Math.floor(Math.random() * n); }
    function esMuro(x, y){ return y < 0 || y >= ROWS || x < 0 || x >= COLS || mapa[y][x] === '#'; }
    function nuevoMapa(){
      mapa = MAPA.map(function(r){ return r.split(''); }); dots = 0;
      mapa[11][9] = ' ';
      for(var y = 0; y < ROWS; y++) for(var x = 0; x < COLS; x++) if(mapa[y][x] === '.' || mapa[y][x] === 'o') dots++;
      mazeNivel = -1;
    }
    function reiniciarPos(){
      pac = { cx: 9, cy: 11, tx: 9, ty: 11, dx: 0, dy: 0, p: 0 };
      want = { x: -1, y: 0 }; face = { x: -1, y: 0 }; asust = 0; combo = 0;
      var st = [[7, 7], [8, 7], [10, 7], [11, 7]], w = [0, 1.6, 3.2, 4.8];
      fant = st.map(function(s, i){ return { i: i, cx: s[0], cy: s[1], tx: s[0], ty: s[1], dx: 0, dy: 0, p: 0, wait: Math.max(0, w[i] - nivel * .4) }; });
    }
    function reset(){
      rkRes = null; score = 0; vidas = 3; nivel = 0; parts = []; flos = []; shake = 0; ovT = 0; pausa = 1.4;
      banT = 2.4; banName = PAL[0].n; banNum = 1; hasta = 'SALIDA';
      nuevoMapa(); reiniciarPos();
    }
    reset();

    function ajustar(){
      var r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2.5);
      if(!r.width) return;
      cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.width * H / W * dpr);
      var sc = cv.width / W;
      ctx.setTransform(sc, 0, 0, sc, 0, 0);
      mazeNivel = -1;
    }
    ajustar();
    window.addEventListener('resize', ajustar);

    function snd(n){
      if(n === 'tk') tono(660, 880, .05, 'square', .03);
      else if(n === 'pase') tono(300, 1200, .35, 'triangle', .09);
      else if(n === 'eat') tono(400, 1500, .18, 'sine', .09);
      else if(n === 'hit') tono(260, 40, .6, 'sawtooth', .1);
      else if(n === 'city'){ tono(523, 523, .14, 'triangle', .07); tono(659, 659, .14, 'triangle', .07, .14); tono(784, 784, .26, 'triangle', .07, .28); }
      else if(n === 'over') tono(330, 110, .6, 'triangle', .09);
    }

    /* ---- particulas y textos ---- */
    function chispas(x, y, n, col, vel, grav, vida, tam){
      for(var i = 0; i < n; i++){
        var a = Math.random() * 6.283, v = vel * (.3 + Math.random() * .7);
        parts.push({ x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: grav, life: vida * (.6 + Math.random() * .4), max: vida, c: col, s: tam * (.6 + Math.random() * .8) });
      }
    }
    function flota(x, y, t, col){ flos.push({ x: x, y: y, txt: t, col: col || AMBAR, life: 1 }); }
    function posE(e){ return { x: e.cx + (e.tx - e.cx) * e.p, y: e.cy + (e.ty - e.cy) * e.p }; }
    function px(c){ return { x: BX + c.x * CELL + CELL / 2, y: BY + c.y * CELL + CELL / 2 }; }

    /* ---- control: flechas / WASD, deslizar, o tocar hacia donde quieres ir ---- */
    function empezar(){ reset(); est = 'play'; snd('city'); }
    function girar(nx, ny){
      want = { x: nx, y: ny };
      if(est === 'play' && pausa <= 0 && (pac.dx || pac.dy) && pac.dx === -nx && pac.dy === -ny){
        // dar la vuelta en mitad de la celda
        var ax = pac.tx, ay = pac.ty; pac.tx = pac.cx; pac.ty = pac.cy; pac.cx = ax; pac.cy = ay; pac.dx = nx; pac.dy = ny; pac.p = 1 - pac.p; face = want;
      }
    }
    function pulsar(){ if(est === 'idle' || (est === 'over' && ovT > .6)) empezar(); }
    var sx = 0, sy = 0, abajo = false, moved = false;
    cv.addEventListener('pointerdown', function(e){
      e.preventDefault(); try{ cv.focus({ preventScroll: true }); }catch(x){}
      if(est !== 'play'){ pulsar(); return; }
      abajo = true; moved = false; sx = e.clientX; sy = e.clientY;
    });
    cv.addEventListener('pointermove', function(e){
      if(!abajo || est !== 'play') return;
      var dx = e.clientX - sx, dy = e.clientY - sy;
      if(Math.max(Math.abs(dx), Math.abs(dy)) < 14) return;
      moved = true;
      if(Math.abs(dx) > Math.abs(dy)) girar(dx > 0 ? 1 : -1, 0); else girar(0, dy > 0 ? 1 : -1);
      sx = e.clientX; sy = e.clientY;
    });
    window.addEventListener('pointerup', function(e){
      if(abajo && !moved && est === 'play' && e && e.clientX !== undefined){
        var r = cv.getBoundingClientRect(), hp = px(posE(pac));
        var dx = (e.clientX - r.left) / r.width * W - hp.x, dy = (e.clientY - r.top) / r.height * H - hp.y;
        if(Math.abs(dx) > Math.abs(dy)) girar(dx > 0 ? 1 : -1, 0); else girar(0, dy > 0 ? 1 : -1);
      }
      abajo = false;
    });
    window.addEventListener('pointercancel', function(){ abajo = false; });
    window.addEventListener('keydown', function(e){
      if(!document.getElementById('ib-mant')) return;
      var k = e.key, map = { ArrowUp: [0, -1], w: [0, -1], W: [0, -1], ArrowDown: [0, 1], s: [0, 1], S: [0, 1], ArrowLeft: [-1, 0], a: [-1, 0], A: [-1, 0], ArrowRight: [1, 0], d: [1, 0], D: [1, 0] };
      if(map[k] && (est === 'play' || document.activeElement === cv)){
        if(est === 'play') girar(map[k][0], map[k][1]); else pulsar();
        e.preventDefault();
      }else if((k === ' ' || k === 'Enter') && document.activeElement === cv){ pulsar(); e.preventDefault(); }
    });

    /* ---- logica ---- */
    function libreDe(e, d){ return !esMuro(e.cx + d.x, e.cy + d.y); }
    function elegirPac(e){
      var c = mapa[e.cy][e.cx];
      if(c === '.'){ mapa[e.cy][e.cx] = ' '; dots--; score += 10; snd('tk'); }
      else if(c === 'o'){ mapa[e.cy][e.cx] = ' '; dots--; score += 50; asust = Math.max(3, 7 - nivel * .6); combo = 0; pelletId++; snd('pase'); }
      if(want && libreDe(e, want)){ e.dx = want.x; e.dy = want.y; face = want; }
      else if(!((e.dx || e.dy) && libreDe(e, { x: e.dx, y: e.dy }))){ e.dx = 0; e.dy = 0; }
    }
    function elegirFant(g){
      var ops = DIRS.filter(function(d){ return libreDe(g, d) && !((g.dx || g.dy) && d.x === -g.dx && d.y === -g.dy); });
      if(!ops.length) ops = DIRS.filter(function(d){ return libreDe(g, d); });
      var enSala = g.cy === 7 && g.cx >= 6 && g.cx <= 12;
      var obj = enSala ? { x: g.cx < 9 ? 8 : 10, y: 5 } : (g.i === 3 && Math.abs(pac.cx - g.cx) + Math.abs(pac.cy - g.cy) < 6 ? { x: 1, y: 11 } : { x: pac.cx, y: pac.cy });
      var d;
      if(asust > 0 && g.pel !== pelletId && !enSala) d = ops[rand(ops.length)];
      else if(enSala || Math.random() < AGR[g.i]){
        d = ops[0]; var mejor = 1e9;
        ops.forEach(function(o){ var dd = Math.pow(g.cx + o.x - obj.x, 2) + Math.pow(g.cy + o.y - obj.y, 2); if(dd < mejor){ mejor = dd; d = o; } });
      }else d = ops[rand(ops.length)];
      g.dx = d.x; g.dy = d.y;
    }
    function mover(e, v, dt, elegir){
      if(!(e.dx || e.dy)){
        elegir(e);
        if(!(e.dx || e.dy)) return;
        e.tx = e.cx + e.dx; e.ty = e.cy + e.dy; e.p = 0;
      }
      e.p += v * dt;
      while(e.p >= 1){
        e.p -= 1; e.cx = e.tx; e.cy = e.ty; elegir(e);
        if(!(e.dx || e.dy)){ e.p = 0; e.tx = e.cx; e.ty = e.cy; return; }
        e.tx = e.cx + e.dx; e.ty = e.cy + e.dy;
      }
    }
    function morir(){
      var h = px(posE(pac)); chispas(h.x, h.y, 26, AMBAR, 230, 300, .9, 3); chispas(h.x, h.y, 12, '#E5342B', 200, 300, .8, 2.6);
      vidas--; shake = .4; snd('hit');
      if(vidas <= 0){
        est = 'over'; ovT = 0; snd('over'); rkRes = rk.add(score, nivel + 1);
        if(score > best){ best = score; eRec.textContent = best; try{ localStorage.setItem('ib-mant-best4', String(best)); }catch(e){} }
      }else{ reiniciarPos(); pausa = 1.4; }
    }
    function subirNivel(){
      nivel++; score += 100; banT = 2.6; banName = PAL[nivel % PAL.length].n; banNum = nivel % PAL.length + 1; hasta = 'LLEGADA'; snd('city');
      nuevoMapa(); reiniciarPos(); pausa = 1.8;
    }
    function actualizar(dt){
      if(banT > 0) banT -= dt;
      if(shake > 0) shake -= dt;
      if(pausa > 0){ pausa -= dt; return; }
      mover(pac, 5.6, dt, elegirPac);
      var vg = asust > 0 ? 3 : Math.min(6.2, 4.3 + nivel * .3);
      fant.forEach(function(g){ if(g.wait > 0){ g.wait -= dt; return; } mover(g, vg, dt, elegirFant); });
      if(asust > 0) asust -= dt;
      var pp = posE(pac);
      for(var i = 0; i < fant.length; i++){
        var g = fant[i], gp = posE(g);
        if(g.wait > 0 && g.cx === g.tx && g.cy === g.ty && false) continue;
        if(Math.abs(gp.x - pp.x) + Math.abs(gp.y - pp.y) < .85){
          if(asust > 0 && g.pel !== pelletId){
            combo++; var pts = [50, 100, 150, 200][Math.min(combo, 4) - 1]; score += pts; g.pel = pelletId;
            var c = px(gp); chispas(c.x, c.y, 16, COLG[g.i], 200, 200, .6, 2.6); flota(c.x, c.y - 12, '+' + pts, '#FFFFFF'); snd('eat');
            var st = [[7, 7], [8, 7], [10, 7], [11, 7]][g.i]; g.cx = g.tx = st[0]; g.cy = g.ty = st[1]; g.dx = g.dy = 0; g.p = 0; g.wait = 2.2;
          }else{ morir(); return; }
        }
      }
      if(dots <= 0) subirNivel();
    }
    function animar(dt){
      for(var i = parts.length - 1; i >= 0; i--){
        var p = parts[i]; p.life -= dt;
        if(p.life <= 0){ parts.splice(i, 1); continue; }
        p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt;
      }
      for(i = flos.length - 1; i >= 0; i--){ flos[i].life -= dt * 1.1; flos[i].y -= 24 * dt; if(flos[i].life <= 0) flos.splice(i, 1); }
      if(shake > 0 && est !== 'play') shake -= dt;
      if(est === 'over') ovT += dt;
    }

    /* ---- dibujo ---- */
    function rr(x0, y0, w, h, r){
      ctx.beginPath();
      ctx.moveTo(x0 + r, y0); ctx.arcTo(x0 + w, y0, x0 + w, y0 + h, r); ctx.arcTo(x0 + w, y0 + h, x0, y0 + h, r);
      ctx.arcTo(x0, y0 + h, x0, y0, r); ctx.arcTo(x0, y0, x0 + w, y0, r); ctx.closePath();
    }
    function txt(s, x, y, tam, col, peso, al){
      ctx.font = (peso || 800) + ' ' + tam + 'px "Funnel Display","Funnel Sans",system-ui,sans-serif';
      ctx.textAlign = al || 'center'; ctx.fillStyle = col || '#F1F0EB'; ctx.fillText(s, x, y);
    }
    function pintarLaberinto(){
      var sc = cv.width / W, c = document.createElement('canvas'); c.width = cv.width; c.height = cv.height;
      var g = c.getContext('2d'); g.scale(sc, sc);
      var col = NEON[nivel % NEON.length];
      for(var y = 0; y < ROWS; y++) for(var x = 0; x < COLS; x++){
        if(mapa[y][x] !== '#') continue;
        var X = BX + x * CELL, Y = BY + y * CELL;
        g.fillStyle = 'rgba(255,255,255,.035)'; g.fillRect(X, Y, CELL, CELL);
        g.strokeStyle = col; g.lineWidth = 2.2; g.lineCap = 'round'; g.shadowColor = col; g.shadowBlur = 7;
        g.beginPath();
        if(y > 0 && mapa[y - 1][x] !== '#'){ g.moveTo(X + 2, Y + 1.2); g.lineTo(X + CELL - 2, Y + 1.2); }
        if(y < ROWS - 1 && mapa[y + 1][x] !== '#'){ g.moveTo(X + 2, Y + CELL - 1.2); g.lineTo(X + CELL - 2, Y + CELL - 1.2); }
        if(x > 0 && mapa[y][x - 1] !== '#'){ g.moveTo(X + 1.2, Y + 2); g.lineTo(X + 1.2, Y + CELL - 2); }
        if(x < COLS - 1 && mapa[y][x + 1] !== '#'){ g.moveTo(X + CELL - 1.2, Y + 2); g.lineTo(X + CELL - 1.2, Y + CELL - 2); }
        g.stroke();
      }
      mazeCv = c; mazeNivel = nivel; mazeSc = cv.width;
    }
    function dibujarFant(g){
      var p = px(posE(g)), tt = performance.now() / 1000, esp = asust > 0 && g.pel !== pelletId, blink = esp && asust < 2 && Math.floor(asust * 6) % 2 === 0;
      var colr = esp ? (blink ? '#F4F2EA' : '#2D4BFF') : COLG[g.i], w = Math.sin(tt * 12 + g.i) * 1.2;
      ctx.save(); ctx.translate(p.x, p.y + (g.wait > 0 ? Math.sin(tt * 6 + g.i) * 1.5 : 0));
      ctx.shadowColor = colr; ctx.shadowBlur = 8; ctx.fillStyle = colr;
      ctx.beginPath(); ctx.arc(0, -1, 9.5, Math.PI, 0); ctx.lineTo(9.5, 9.5);
      ctx.lineTo(6.3, 6.5 + w); ctx.lineTo(3.2, 9.5); ctx.lineTo(0, 6.5 - w); ctx.lineTo(-3.2, 9.5); ctx.lineTo(-6.3, 6.5 + w); ctx.lineTo(-9.5, 9.5); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
      if(esp){
        ctx.fillStyle = blink ? '#E5342B' : '#fff'; ctx.fillRect(-4.5, -3, 2.6, 2.6); ctx.fillRect(1.9, -3, 2.6, 2.6);
        ctx.strokeStyle = blink ? '#E5342B' : '#fff'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(-5.5, 4); ctx.lineTo(-3, 2); ctx.lineTo(0, 4); ctx.lineTo(3, 2); ctx.lineTo(5.5, 4); ctx.stroke();
      }else{
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(-3.7, -2, 3, 0, 6.3); ctx.arc(3.7, -2, 3, 0, 6.3); ctx.fill();
        var ex = g.dx * 1.3, ey = g.dy * 1.3; ctx.fillStyle = '#0A0A0A'; ctx.beginPath(); ctx.arc(-3.7 + ex, -2 + ey, 1.5, 0, 6.3); ctx.arc(3.7 + ex, -2 + ey, 1.5, 0, 6.3); ctx.fill();
      }
      ctx.restore();
    }
    function dibujarPac(){
      var p = px(posE(pac)), tt = performance.now() / 1000, mov = pac.dx || pac.dy, m = mov && est === 'play' && pausa <= 0 ? .08 + .3 * Math.abs(Math.sin(tt * 16)) : .18;
      ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(Math.atan2(face.y, face.x));
      ctx.shadowColor = AMBAR; ctx.shadowBlur = 12;
      var lg = ctx.createLinearGradient(0, -10, 0, 10); lg.addColorStop(0, '#FFD45A'); lg.addColorStop(1, '#E39A00');
      ctx.fillStyle = lg; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 10.5, m, 6.283 - m); ctx.closePath(); ctx.fill(); ctx.shadowBlur = 0;
      ctx.fillStyle = '#0A0A0A'; rr(1, -8.5, 5, 7, 1.6); ctx.fill();
      ctx.restore();
    }
    function dibujarPuntos(){
      var tt = performance.now() / 1000;
      for(var y = 0; y < ROWS; y++) for(var x = 0; x < COLS; x++){
        var c = mapa[y][x]; if(c !== '.' && c !== 'o') continue;
        var p = px({ x: x, y: y });
        if(c === '.'){ ctx.fillStyle = '#FFE3A0'; ctx.beginPath(); ctx.arc(p.x, p.y, 2, 0, 6.3); ctx.fill(); }
        else{
          var s = 1 + Math.sin(tt * 6) * .12;
          ctx.save(); ctx.translate(p.x, p.y); ctx.scale(s, s); ctx.shadowColor = '#fff'; ctx.shadowBlur = 12;
          var pg = ctx.createLinearGradient(-9, -7, 9, 7); pg.addColorStop(0, '#FFE69A'); pg.addColorStop(1, '#FF9A00');
          ctx.fillStyle = pg; rr(-9, -7, 18, 14, 4); ctx.fill(); ctx.shadowBlur = 0; txt('P', 0, 4, 10, '#3A2300', 800); ctx.restore();
        }
      }
    }
    function interfaz(){
      txt(String(score), 14, 36, 28, '#F1F0EB', 800, 'left');
      txt('PUNTOS', 14, 46, 8, '#B8B6AD', 700, 'left');
      txt(PAL[nivel % PAL.length].n + ' · nivel ' + (nivel + 1), W / 2, 30, 12, '#C9C8C2', 700);
      txt('Próxima: ' + PAL[(nivel + 1) % PAL.length].n, W / 2, 43, 9, '#8C8B85', 600);
      for(var i = 0; i < vidas; i++){
        ctx.save(); ctx.translate(W - 22 - i * 22, 28); ctx.fillStyle = AMBAR; ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 8, .5, 6.283 - .5); ctx.closePath(); ctx.fill(); ctx.restore();
      }
      if(asust > 0){ ctx.fillStyle = '#2D4BFF'; ctx.fillRect(W - 14 - 60, 42, 60 * Math.min(1, asust / 7), 3); }
      if(banT > 0 && est === 'play'){
        var ap = banT > 2.2 ? (2.6 - banT) / .4 : (banT < .4 ? banT / .4 : 1); ap = Math.max(0, Math.min(1, ap));
        var by = BY + 4 + (1 - ap) * -20;
        ctx.save(); ctx.globalAlpha = ap;
        rr(W / 2 - 112, by + 150, 224, 54, 12); ctx.fillStyle = 'rgba(8,8,8,.92)'; ctx.fill(); ctx.strokeStyle = AMBAR; ctx.lineWidth = 2; ctx.stroke();
        txt(hasta + ' · PARADA ' + banNum + ' DE 5', W / 2, by + 168, 9, AMBAR, 800);
        txt(banName, W / 2, by + 193, 25, '#F1F0EB', 800);
        ctx.restore();
      }
      if(pausa > 0 && est === 'play' && banT <= 0) txt('¡LISTO!', W / 2, BY + 9 * CELL + 17, 17, AMBAR, 800);
      for(i = 0; i < flos.length; i++){ var f = flos[i]; ctx.globalAlpha = Math.min(1, f.life * 1.6); txt(f.txt, f.x, f.y, 13, f.col, 800); ctx.globalAlpha = 1; }
    }
    function cartel(){
      if(est === 'play') return;
      var a = est === 'over' ? Math.min(1, Math.max(0, (ovT - .35) / .35)) : 1;
      if(a <= 0) return;
      ctx.save(); ctx.globalAlpha = a; ctx.fillStyle = 'rgba(6,6,8,.82)'; ctx.fillRect(0, 0, W, H);
      if(est === 'idle'){
        txt('RUTA INTERRAIL', W / 2, 108, 34, '#F1F0EB');
        txt('Come todos los billetes del mapa', W / 2, 136, 13, '#C9C8C2', 500);
        txt('Huye de los retrasos · llega a Ámsterdam', W / 2, 156, 13, '#C9C8C2', 500);
        ctx.save(); ctx.translate(W / 2, 200); ctx.fillStyle = AMBAR; rr(-84, -22, 168, 44, 14); ctx.fill();
        ctx.fillStyle = '#0A0A0A'; ctx.beginPath(); ctx.arc(-84, 0, 7, 0, 6.3); ctx.arc(84, 0, 7, 0, 6.3); ctx.fill(); ctx.restore();
        txt('JUGAR', W / 2, 208, 19, '#0C0C0C');
        txt('flechas · desliza · o toca hacia donde quieras ir', W / 2, 246, 11, '#8C8B85', 500);
        txt('el billete P te deja comerte a los retrasos', W / 2, 264, 11, '#8C8B85', 500);
      }else{
        txt('FIN DE LÍNEA', W / 2, 96, 14, AMBAR, 800);
        txt(String(score), W / 2, 150, 56, '#F1F0EB');
        txt('puntos', W / 2, 172, 12, '#B8B6AD', 600);
        txt('Has llegado hasta ' + PAL[nivel % PAL.length].n, W / 2, 194, 13, '#C9C8C2', 600);
        var nueva = score >= best && score > 0;
        txt(nueva ? '¡NUEVO RÉCORD!' : 'Récord: ' + best, W / 2, 214, 13, nueva ? AMBAR : '#8C8B85', 800);
        if(rkRes){
          if(rkRes.pos === 1) txt('¡Eres el nº 1 de la estación!', W / 2, 238, 14, '#FFD45A', 800);
          else{
            txt('Puesto nº ' + rkRes.pos + ' de ' + rkRes.total, W / 2, 238, 14, '#F1F0EB', 800);
            txt('Te faltan ' + rkRes.falta + ' puntos para superar a ' + rkRes.rival, W / 2, 255, 11, '#FFB81C', 600);
          }
        }
        if(ovT > .6){ ctx.fillStyle = AMBAR; rr(W / 2 - 70, 272, 140, 38, 13); ctx.fill(); txt('OTRA VEZ', W / 2, 297, 16, '#0C0C0C'); }
      }
      ctx.restore();
    }
    function dibujar(){
      if(mazeNivel !== nivel || mazeSc !== cv.width) pintarLaberinto();
      var b = PAL[nivel % PAL.length];
      ctx.save();
      if(shake > 0) ctx.translate((Math.random() - .5) * 7 * Math.min(1, shake * 3), (Math.random() - .5) * 7 * Math.min(1, shake * 3));
      ctx.fillStyle = '#0A0A0A'; ctx.fillRect(-10, -10, W + 20, H + 20);
      var g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(' + b.rt.join(',') + ',.55)'); g.addColorStop(1, 'rgba(' + b.rb.join(',') + ',.28)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(6,6,8,.5)'; ctx.fillRect(BX, BY, COLS * CELL, ROWS * CELL);
      ctx.drawImage(mazeCv, 0, 0, W, H);
      dibujarPuntos();
      fant.forEach(dibujarFant);
      if(!(est === 'over' && ovT > .05) ) dibujarPac();
      for(var i = 0; i < parts.length; i++){ var p = parts[i]; ctx.globalAlpha = Math.max(0, p.life / p.max); ctx.fillStyle = p.c; ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s); }
      ctx.globalAlpha = 1;
      ctx.restore();
      if(est !== 'idle') interfaz();
      cartel();
    }
    function frame(ts){
      if(!document.getElementById('ib-mant')) return;
      var dt = Math.min(.033, ((ts - (last || ts)) / 1000) || 0); last = ts;
      if(cv.width < 10) ajustar();
      else{
        if(est === 'play') actualizar(dt);
        animar(dt); dibujar();
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  if(document.body) pintar();
  else document.addEventListener('DOMContentLoaded', pintar);
})();
