/* Iberail — sala de espera al entrar en la web (proyecto de clase).
   Cola simulada: entre 15 y 35 personas delante y entre 45 s y 2 min 15 s de espera.
   Sale una vez por visita (al pasar se apunta en sessionStorage; si recargas durante la cola, vuelves a empezar).
   Se carga en el <head> de todas las páginas públicas (no en el panel) para tapar la web antes de que se vea.
   PARA QUITARLA: pon COLA_ON a false (o borra este archivo y las líneas <script src="assets/cola.js">). */
(function(){
  const COLA_ON = true;
  const PERSONAS = [15, 35];          // personas delante (mín, máx)
  const ESPERA = [45, 135];           // segundos de espera (mín, máx)
  const ENTRA_SOLO = 6;               // segundos en «¡Es tu turno!» antes de entrar solo
  const KEY = 'ib-cola-ok';

  if(!COLA_ON) return;
  if(/zarping/i.test(location.hostname) || (window.IBERAIL_CONFIG || {}).MARCA === 'zarping') return;
  if(/bot|crawl|spider|slurp|bingpreview|facebookexternalhit|whatsapp|telegram|twitterbot|linkedin|embedly|lighthouse/i.test(navigator.userAgent)) return;   // buscadores y vistas previas de enlaces pasan directos
  try{ if(sessionStorage.getItem(KEY)) return; }catch(e){ return; }

  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const root = document.documentElement;
  root.classList.add('ib-cola');

  const css = document.createElement('style');
  css.textContent = `
html.ib-cola,html.ib-cola body{overflow:hidden!important;background:#140B08}
html.ib-cola body>*:not(.cola){visibility:hidden!important}
.cola{position:fixed;inset:0;z-index:2147483000;overflow-y:auto;-webkit-overflow-scrolling:touch;color:#F7F2E8;font-family:'Inter',ui-sans-serif,system-ui,-apple-system,'Segoe UI',sans-serif;
  background:radial-gradient(120% 60% at 20% 0%,#4A1A12 0%,rgba(74,26,18,0) 60%),radial-gradient(90% 50% at 100% 100%,#4A2410 0%,rgba(74,36,16,0) 60%),linear-gradient(180deg,#2A0E0A 0%,#1A0B08 100%);
  transition:opacity .45s ease}
.cola.is-out{opacity:0;pointer-events:none}
.cola-in{min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;padding:calc(28px + env(safe-area-inset-top)) 16px calc(28px + env(safe-area-inset-bottom))}
.cola-logo{display:flex;align-items:center;gap:12px;text-decoration:none}
.cola-logo img{width:40px;height:40px;border-radius:9px}
.cola-logo .brand-word{font-family:'Poppins','Bricolage Grotesque',sans-serif;font-weight:800;font-size:1.9rem;letter-spacing:-.045em;line-height:1;color:#F7F0E3}
.cola-logo .brand-word b{font-weight:inherit;color:#F0B02A}
.cola-card{width:min(440px,100%);padding:30px 28px 22px;border-radius:30px;border:1px solid rgba(255,255,255,.1);background:linear-gradient(160deg,rgba(255,255,255,.07),rgba(255,255,255,.02));box-shadow:0 30px 70px -30px rgba(0,0,0,.7);backdrop-filter:blur(6px);-webkit-backdrop-filter:blur(6px)}
.cola-k{display:flex;align-items:center;gap:10px;font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace;font-size:.78rem;letter-spacing:.16em;text-transform:uppercase;color:#FFC53D}
.cola-k i{width:10px;height:10px;border-radius:50%;background:#F0532F;box-shadow:0 0 0 0 rgba(240,83,47,.6);animation:colaPing 1.6s infinite}
@keyframes colaPing{70%{box-shadow:0 0 0 8px rgba(240,83,47,0)}100%{box-shadow:0 0 0 0 rgba(240,83,47,0)}}
.cola-h{margin:14px 0 10px;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:clamp(1.7rem,7vw,2.05rem);line-height:1.08;letter-spacing:-.02em;color:#FFF8EC}
.cola-p{margin:0;color:#D9C3B3;font-size:1rem;line-height:1.55}
.cola-row{display:flex;align-items:flex-end;justify-content:space-between;gap:12px;margin-top:24px}
.cola-n{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:clamp(4.2rem,20vw,5.2rem);line-height:.9;letter-spacing:-.03em;color:#fff;font-variant-numeric:tabular-nums}
.cola-nl{display:block;margin-top:6px;font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:1.05rem;line-height:1.25;color:#FFF3DC;max-width:13ch}
.cola-eta{text-align:right;flex-shrink:0}
.cola-eta small{display:block;font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace;font-size:.7rem;letter-spacing:.14em;text-transform:uppercase;color:#D9C3B3;line-height:1.4}
.cola-eta b{display:block;margin-top:4px;font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:1.75rem;color:#fff;font-variant-numeric:tabular-nums;white-space:nowrap}
.cola-track{position:relative;height:46px;margin:30px 0 8px}
.cola-rail{position:absolute;left:0;right:22px;bottom:6px;height:4px;border-radius:4px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.22) 0 12px,transparent 12px 20px)}
.cola-fill{position:absolute;left:0;bottom:6px;height:4px;border-radius:4px;background:linear-gradient(90deg,#F0532F,#FF8A3D);width:0;transition:width 1s linear}
.cola-train{position:absolute;bottom:4px;left:0;font-size:30px;line-height:1;transform:translateX(-4px);transition:left 1s linear}
.cola-flag{position:absolute;right:0;bottom:2px;font-size:26px;line-height:1}
.cola-pct{display:flex;justify-content:space-between;font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace;font-size:.8rem;letter-spacing:.08em;color:#D9C3B3}
.cola-crowd{display:flex;align-items:center;gap:14px;margin-top:22px;padding:16px 18px;border-radius:18px;border:1px solid rgba(255,255,255,.08);background:rgba(0,0,0,.22)}
.cola-av{display:flex;flex-shrink:0}
.cola-av span{width:32px;height:32px;margin-left:-9px;border-radius:50%;display:grid;place-items:center;font-weight:700;font-size:.85rem;color:#2A0E0A;border:2px solid #241009;animation:colaPop .4s ease}
.cola-av span:first-child{margin-left:0}
@keyframes colaPop{from{transform:scale(.4);opacity:0}}
.cola-crowd p{flex:1;min-width:0;margin:0;font-size:.95rem;line-height:1.35;color:#E9D9C8}
.cola-crowd b{color:#fff}
.cola-warn{display:flex;gap:12px;align-items:flex-start;margin-top:18px;font-size:.93rem;line-height:1.45;color:#E9D9C8}
.cola-warn svg{flex-shrink:0;width:20px;height:20px;margin-top:1px;fill:none;stroke:#FFC53D;stroke-width:2;stroke-linecap:round}
.cola-upd{margin-top:16px;text-align:center;font-family:'IBM Plex Mono',ui-monospace,Menlo,monospace;font-size:.75rem;letter-spacing:.1em;color:rgba(217,195,179,.7)}
.cola-lema{color:rgba(217,195,179,.6);font-size:.92rem}
.cola-ok{text-align:center;padding:36px 28px 30px}
.cola-chk{width:92px;height:92px;margin:0 auto 22px;border-radius:50%;display:grid;place-items:center;background:radial-gradient(circle at 35% 30%,#FFD978,#F0B02A);box-shadow:0 0 0 12px rgba(240,176,42,.16);animation:colaPop .5s ease}
.cola-chk svg{width:38px;height:38px;fill:none;stroke:#2A0E0A;stroke-width:3;stroke-linecap:round;stroke-linejoin:round}
.cola-ok .cola-h{margin:0 0 8px;font-size:clamp(2rem,9vw,2.4rem)}
.cola-go{display:inline-flex;align-items:center;justify-content:center;gap:12px;width:100%;max-width:280px;margin-top:24px;padding:17px 26px;border:0;border-radius:999px;background:#F0532F;color:#fff;font:700 1.08rem/1 'Bricolage Grotesque',sans-serif;cursor:pointer;box-shadow:0 14px 34px -12px rgba(240,83,47,.75);transition:transform .15s,background .15s}
.cola-go:focus{outline:none}.cola-go:focus-visible{outline:2px solid #FFC53D;outline-offset:4px}.cola-go:hover{background:#D63E1C}.cola-go:active{transform:scale(.97)}
.cola-go svg{width:18px;height:18px;fill:none;stroke:currentColor;stroke-width:2.4;stroke-linecap:round;stroke-linejoin:round}
.cola-bar{width:100%;max-width:280px;height:4px;margin:18px auto 0;border-radius:4px;background:rgba(255,255,255,.12);overflow:hidden}
.cola-bar i{display:block;height:100%;width:0;background:#FFC53D;border-radius:4px}
.sr-cola{position:absolute;width:1px;height:1px;overflow:hidden;clip:rect(0 0 0 0);white-space:nowrap}
@media (prefers-reduced-motion: reduce){.cola *{animation:none!important;transition:none!important}}
`;
  (document.head || root).appendChild(css);

  /* ---------- la cola ---------- */
  const delante0 = rnd(PERSONAS[0], PERSONAS[1]);
  const total = rnd(ESPERA[0], ESPERA[1]) * 1000;
  const t0 = Date.now();
  // momentos en que sale cada persona de delante: repartidos con ritmo irregular, el último justo al acabar
  const pesos = Array.from({ length: delante0 }, () => 0.4 + Math.random() * 1.6);
  const suma = pesos.reduce((a, b) => a + b, 0);
  let acc = 0;
  const salidas = pesos.map(p => (acc += p) / suma * total);
  let detras = rnd(15, 30);

  const LETRAS = 'AAABCCDEFGJLLMMMNPRSSTV';
  const COLORES = ['#F2E3C6', '#FF8A5C', '#FFB26B', '#FFD36B', '#F6C6A8', '#F0532F', '#FFC53D'];
  const persona = () => ({ l: LETRAS[rnd(0, LETRAS.length - 1)], c: COLORES[rnd(0, COLORES.length - 1)] });
  let caras = Array.from({ length: 5 }, persona);

  const fmt = s => s < 60 ? `${s} s` : `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ''}`;
  const per = n => `${n} ${n === 1 ? 'persona' : 'personas'}`;

  const el = document.createElement('div');
  el.className = 'cola';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'colaH');
  const logo = '<a class="cola-logo" href="index.html" tabindex="-1" aria-label="Iberail"><img src="assets/img/icon.svg" alt=""><span class="brand-word">ibe<b>rail</b></span></a>';
  el.innerHTML = `<div class="cola-in">
    ${logo}
    <div class="cola-card">
      <div class="cola-k"><i aria-hidden="true"></i>Sala de espera</div>
      <h1 class="cola-h" id="colaH">Estás en la cola para entrar</h1>
      <p class="cola-p">Ahora mismo hay muchísima gente entrando a la vez. Te guardamos el sitio y entras en cuanto sea tu turno.</p>
      <div class="cola-row">
        <div><div class="cola-n" data-n>${delante0}</div><span class="cola-nl" data-nl>${delante0 === 1 ? 'persona delante' : 'personas delante'} de ti</span></div>
        <div class="cola-eta"><small>Tiempo<br>estimado</small><b data-eta>${fmt(Math.ceil(total / 1000))}</b></div>
      </div>
      <div class="cola-track" aria-hidden="true"><div class="cola-rail"></div><div class="cola-fill" data-fill></div><span class="cola-train" data-train>🚆</span><span class="cola-flag">🏁</span></div>
      <div class="cola-pct" aria-hidden="true"><span data-pct>0 %</span><span>Tu turno</span></div>
      <div class="cola-crowd"><div class="cola-av" data-av aria-hidden="true"></div><p data-crowd></p></div>
      <div class="cola-warn"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 7.5v5.5M12 16.5v.01"/></svg><span>No cierres ni recargues esta página: perderías tu sitio en la cola.</span></div>
      <div class="cola-upd" data-upd>Actualizado ahora</div>
      <div class="sr-cola" aria-live="polite" data-sr></div>
    </div>
    <div class="cola-lema">Tu Europa en tren, desde España</div>
  </div>`;
  const $ = s => el.querySelector(s);

  let ultimoDelante = delante0, ultimoSr = 0, timer = null;
  function pintaCaras(n){
    $('[data-av]').innerHTML = caras.slice(0, Math.min(n, 5)).map(p => `<span style="background:${p.c}">${p.l}</span>`).join('');
  }
  function tick(){
    const t = Date.now() - t0;
    const delante = Math.max(0, delante0 - salidas.filter(s => s <= t).length);
    if(t >= total || delante === 0) return turno();
    if(delante !== ultimoDelante){
      for(let i = delante; i < ultimoDelante; i++){ caras.shift(); caras.push(persona()); }
      ultimoDelante = delante;
      pintaCaras(delante);
    }
    if(Math.random() < 0.22) detras += rnd(1, 2);                 // sigue llegando gente detrás
    else if(detras > 8 && Math.random() < 0.06) detras -= 1;      // alguno se cansa y se va
    const pct = Math.min(99, Math.floor(t / total * 100));
    $('[data-n]').textContent = delante;
    $('[data-nl]').textContent = (delante === 1 ? 'persona delante' : 'personas delante') + ' de ti';
    $('[data-eta]').textContent = fmt(Math.max(1, Math.ceil((total - t) / 1000)));
    $('[data-fill]').style.width = `calc((100% - 22px) * ${pct / 100})`;
    $('[data-train]').style.left = `calc((100% - 52px) * ${pct / 100})`;
    $('[data-pct]').textContent = `${pct} %`;
    $('[data-crowd]').innerHTML = `<b>${per(delante)}</b> delante y <b>${detras}</b> esperando detrás de ti`;
    if(t - ultimoSr > 15000){ ultimoSr = t; $('[data-sr]').textContent = `${per(delante)} delante de ti. Tiempo estimado: ${fmt(Math.ceil((total - t) / 1000))}.`; }
  }

  function turno(){
    clearInterval(timer);
    el.innerHTML = `<div class="cola-in">
      ${logo}
      <div class="cola-card cola-ok">
        <div class="cola-chk" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
        <h1 class="cola-h" id="colaH">¡Es tu turno!</h1>
        <p class="cola-p">Gracias por esperar. Ya puedes entrar.</p>
        <button type="button" class="cola-go" data-go>Entrar en iberail <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
        <div class="cola-bar" aria-hidden="true"><i data-bar></i></div>
      </div>
      <div class="cola-lema">Tu Europa en tren, desde España</div>
    </div>`;
    const go = $('[data-go]');
    go.addEventListener('click', entrar);
    try{ go.focus({ preventScroll: true }); }catch(e){}
    const bar = $('[data-bar]');
    if(!reduce && bar.animate) bar.animate([{ width: '0%' }, { width: '100%' }], { duration: ENTRA_SOLO * 1000, fill: 'forwards' });
    else bar.style.width = '100%';
    setTimeout(entrar, ENTRA_SOLO * 1000);
  }

  let dentro = false;
  function entrar(){
    if(dentro) return; dentro = true;
    try{ sessionStorage.setItem(KEY, String(Date.now())); }catch(e){}
    el.classList.add('is-out');
    root.classList.remove('ib-cola');
    setTimeout(() => el.remove(), 500);
  }

  function monta(){
    document.body.appendChild(el);
    pintaCaras(delante0);
    tick();
    timer = setInterval(tick, 1000);
  }
  if(document.body) monta();
  else document.addEventListener('DOMContentLoaded', monta);
})();
