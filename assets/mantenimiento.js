/* Iberail — web cerrada por mantenimiento hasta una hora concreta (después se abre sola).
   Va en el <head> de todas las páginas públicas (no en el panel), justo después de config.js.
   Para quitarlo antes de tiempo: HASTA = '' (o borrar el archivo y las líneas <script src="assets/mantenimiento.js">).
   El equipo puede entrar igualmente con ?equipo=1 (se recuerda en esa pestaña). */
(function(){
  var HASTA = '2026-10-10T13:30:00+02:00';   // hora de Madrid
  var fin = Date.parse(HASTA);
  if(!fin || Date.now() >= fin) return;
  try{
    if(/[?&]equipo=1\b/.test(location.search)) sessionStorage.setItem('ib-mant-off', '1');
    if(sessionStorage.getItem('ib-mant-off')) return;
  }catch(e){}

  var html = document.documentElement;
  html.classList.add('ib-mant');
  var css = document.createElement('style');
  css.textContent =
    'html.ib-mant,html.ib-mant body{overflow:hidden!important;background:#0A0A0A!important}' +
    'html.ib-mant body>*:not(#ib-mant){display:none!important}' +
    '#ib-mant{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:24px 16px;' +
      'background:#0A0A0A;color:#F1F0EB;font:400 1rem/1.55 Archivo,system-ui,sans-serif;text-align:center}' +
    '#ib-mant .mt-in{max-width:460px;width:100%}' +
    '#ib-mant .mt-logo{display:inline-flex;align-items:center;gap:10px;margin-bottom:28px;text-decoration:none;color:inherit}' +
    '#ib-mant .mt-logo img{width:40px;height:40px}' +
    '#ib-mant .mt-word{font:800 1.9rem/1 Poppins,sans-serif;letter-spacing:-.02em;color:#F1F0EB}' +
    '#ib-mant .mt-word b{color:#FFB81C;font-weight:800}' +
    '#ib-mant h1{font:800 clamp(1.7rem,6vw,2.4rem)/1 Archivo,sans-serif;font-stretch:125%;text-transform:uppercase;margin:0 0 12px;letter-spacing:-.02em}' +
    '#ib-mant p{margin:0 0 10px;color:#C9C8C2}' +
    '#ib-mant .mt-hora{display:inline-block;margin:14px 0 22px;padding:8px 16px;border-radius:0;background:#050505;border:1px solid #262626;color:#F1F0EB;' +
      'font:500 .8rem "Martian Mono",ui-monospace,monospace}' +
    '#ib-mant .mt-hora b{color:#FFB81C;font-weight:500}' +
    '#ib-mant .mt-q{white-space:nowrap}' +
    '@media (max-width:420px){#ib-mant .mt-hora{font-size:.8rem;padding:8px 14px}}' +
    '#ib-mant .mt-rail{position:relative;height:4px;border-radius:4px;background:#222;overflow:hidden;margin:0 auto 26px;max-width:280px}' +
    '#ib-mant .mt-rail i{position:absolute;top:0;left:-40%;width:40%;height:100%;border-radius:0;background:#FFB81C;animation:mtRail 1.8s ease-in-out infinite}' +
    '@keyframes mtRail{to{left:100%}}' +
    '@media (prefers-reduced-motion:reduce){#ib-mant .mt-rail i{animation:none;left:0;width:100%}}' +
    '#ib-mant .mt-wa{display:inline-flex;align-items:center;justify-content:center;min-height:46px;padding:0 22px;border-radius:0;' +
      'background:#FFB81C;color:#0C0C0C;font-weight:700;text-transform:uppercase;letter-spacing:.05em;font-size:.82rem;text-decoration:none}' +
    '#ib-mant .mt-wa:hover{background:#fff}' +
    '#ib-mant .mt-mail{display:block;margin-top:14px;font-size:.9rem;color:#A3A29C}' +
    '#ib-mant .mt-mail a{color:inherit}';
  (document.head || html).appendChild(css);

  var hora = HASTA.slice(11, 16);
  function quedan(){
    var m = Math.max(1, Math.ceil((fin - Date.now()) / 60000));
    if(m < 60) return m + ' min';
    var h = Math.floor(m / 60), r = m % 60;
    return h + ' h' + (r ? ' ' + r + ' min' : '');
  }
  function pintar(){
    if(document.getElementById('ib-mant')) return;
    var cfg = window.IBERAIL_CONFIG || {};
    var wa = cfg.WA_LINK || (cfg.WA_PHONE ? 'https://wa.me/' + cfg.WA_PHONE : '');
    var d = document.createElement('div');
    d.id = 'ib-mant';
    d.setAttribute('role', 'alert');
    d.innerHTML =
      '<div class="mt-in">' +
        '<span class="mt-logo"><img src="assets/img/icon.svg" alt=""><span class="mt-word">ibe<b>rail</b></span></span>' +
        '<h1>Estamos haciendo mejoras</h1>' +
        '<p>La web está en mantenimiento un ratito. Vuelve en nada y la tendrás lista.</p>' +
        '<div class="mt-hora">Volvemos hoy a las <b>' + hora + '</b><span class="mt-q"> · quedan <span data-mt-quedan>' + quedan() + '</span></span></div>' +
        '<div class="mt-rail" aria-hidden="true"><i></i></div>' +
        (wa ? '<a class="mt-wa" href="' + wa + '" target="_blank" rel="noopener">¿Es urgente? Escríbenos por WhatsApp</a>' : '') +
        '<span class="mt-mail">o a <a href="mailto:info@iberail.com">info@iberail.com</a></span>' +
      '</div>';
    document.body.appendChild(d);
    var q = d.querySelector('[data-mt-quedan]');
    var t = setInterval(function(){
      if(Date.now() >= fin){ clearInterval(t); location.reload(); return; }
      q.textContent = quedan();
    }, 15000);
  }
  if(document.body) pintar();
  else document.addEventListener('DOMContentLoaded', pintar);
})();
