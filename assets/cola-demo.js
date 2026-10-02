/* Iberail — sala de espera de DEMOSTRACIÓN (para vídeos y proyectos de Bruno).
   Solo sale si se abre la web con ?cola en el enlace (iberail.com/?cola, sorteo.html?cola…): a los visitantes normales
   no les sale nunca. La carga el script del <head> de cada página pública. Por decisión consciente NO se activa para todos.
     ?cola          personas delante al azar de 2 a 31 y tiempo al azar de 50 s a 2 min
     ?cola=23-95    23 personas y 95 segundos (para repetir la misma toma) · tecla R = otra vez
   Al acabar: «¡Es tu turno!» y se abre la página de debajo. El ?cola se quita de la barra de direcciones al empezar. */
(function(){
  const CSS = `
html.is-cola body{visibility:hidden;overflow:hidden}
.ibq{position:fixed;inset:0;z-index:2147483000;visibility:visible;overflow:auto;background:#260C08;color:#F7F2E8;font-family:'Inter',system-ui,sans-serif;-webkit-font-smoothing:antialiased;transition:opacity .6s ease}
.ibq.is-out{opacity:0;pointer-events:none}
.ibq *{box-sizing:border-box;margin:0;padding:0}
.ibq-bg{position:fixed;inset:0;overflow:hidden;pointer-events:none}
.ibq-bg i{position:absolute;border-radius:50%;filter:blur(70px);opacity:.55;animation:ibqFlota 14s ease-in-out infinite alternate}
.ibq-bg i:nth-child(1){width:520px;height:520px;left:-160px;top:-140px;background:radial-gradient(circle,rgba(240,83,47,.55),transparent 65%)}
.ibq-bg i:nth-child(2){width:460px;height:460px;right:-150px;bottom:-120px;background:radial-gradient(circle,rgba(255,197,61,.35),transparent 65%);animation-delay:-5s}
.ibq-bg i:nth-child(3){width:380px;height:380px;left:40%;top:55%;background:radial-gradient(circle,rgba(240,83,47,.25),transparent 65%);animation-delay:-9s}
@keyframes ibqFlota{to{transform:translate(40px,30px) scale(1.12)}}
.ibq-wrap{position:relative;min-height:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:32px 16px 40px}
.ibq-brand{display:flex;align-items:center;gap:10px;margin-bottom:34px}
.ibq-brand img{width:34px;height:34px}
.ibq-word{font-family:'Poppins',sans-serif;font-weight:800;font-size:1.6rem;letter-spacing:-.02em;text-transform:lowercase;color:#F7F2E8}
.ibq-word b{color:#FFC53D;font-weight:800}
.ibq-card{width:100%;max-width:520px;background:linear-gradient(180deg,rgba(255,255,255,.07),rgba(255,255,255,.03));border:1px solid rgba(255,255,255,.1);border-radius:28px;padding:30px 26px 26px;box-shadow:0 30px 80px -30px rgba(0,0,0,.6),inset 0 1px 0 rgba(255,255,255,.08);backdrop-filter:blur(10px);-webkit-backdrop-filter:blur(10px)}
.ibq-k{display:inline-flex;align-items:center;gap:8px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.72rem;letter-spacing:.14em;text-transform:uppercase;color:#FFD66B}
.ibq-k i{width:8px;height:8px;border-radius:50%;background:#F0532F;animation:ibqVivo 1.6s infinite}
@keyframes ibqVivo{0%{box-shadow:0 0 0 0 rgba(240,83,47,.7)}70%{box-shadow:0 0 0 9px rgba(240,83,47,0)}100%{box-shadow:0 0 0 0 rgba(240,83,47,0)}}
.ibq h1{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-weight:800;font-size:clamp(1.7rem,6vw,2.3rem);line-height:1.05;letter-spacing:-.02em;margin-top:12px;color:#F7F2E8}
.ibq-sub{color:#D9C3B3;margin-top:10px;font-size:.98rem;line-height:1.5}
.ibq-pos{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin-top:26px}
.ibq-n{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-weight:800;font-size:clamp(4rem,19vw,6rem);line-height:.85;letter-spacing:-.04em;font-variant-numeric:tabular-nums;color:#fff;transition:transform .35s cubic-bezier(.2,.7,.2,1),color .35s}
.ibq-n.is-tick{transform:translateY(-6px) scale(1.04);color:#FFD66B}
.ibq-nl{font-size:1rem;font-weight:700;color:#F7F2E8;line-height:1.3;padding-bottom:6px;margin-top:8px}
.ibq-eta{text-align:right;padding-bottom:6px}
.ibq-eta small{display:block;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.68rem;letter-spacing:.12em;text-transform:uppercase;color:#D9C3B3}
.ibq-eta b{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-size:1.5rem;font-weight:700;font-variant-numeric:tabular-nums;white-space:nowrap}
.ibq-via{position:relative;height:54px;margin-top:22px}
.ibq-rail{position:absolute;left:0;right:0;top:34px;height:4px;border-radius:4px;background:repeating-linear-gradient(90deg,rgba(255,255,255,.18) 0 10px,transparent 10px 16px)}
.ibq-fill{position:absolute;left:0;top:34px;height:4px;border-radius:4px;background:linear-gradient(90deg,#F0532F,#FFC53D);width:0;transition:width .9s cubic-bezier(.2,.7,.2,1);box-shadow:0 0 18px rgba(255,197,61,.45)}
.ibq-tren{position:absolute;top:8px;left:4%;transform:translateX(-50%);font-size:26px;transition:left .9s cubic-bezier(.2,.7,.2,1);filter:drop-shadow(0 6px 10px rgba(0,0,0,.4))}
.ibq-tren span{display:inline-block;animation:ibqTraq .32s ease-in-out infinite alternate}
@keyframes ibqTraq{to{transform:translateY(-1.5px)}}
.ibq-meta{position:absolute;right:-4px;top:12px;font-size:22px}
.ibq-pct{display:flex;justify-content:space-between;margin-top:8px;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.72rem;color:#D9C3B3;letter-spacing:.06em}
.ibq-gente{display:flex;align-items:center;gap:12px;margin-top:22px;padding:12px 14px;border-radius:16px;background:rgba(0,0,0,.18);border:1px solid rgba(255,255,255,.1)}
.ibq-caras{display:flex;flex:0 0 auto}
.ibq-caras span{width:30px;height:30px;border-radius:50%;display:grid;place-items:center;font:700 .72rem 'Inter',system-ui,sans-serif;color:#2A1611;border:2px solid #260C08;margin-left:-8px;transition:transform .4s,opacity .4s}
.ibq-caras span:first-child{margin-left:0}
.ibq-caras span.is-out{transform:translateX(-14px) scale(.6);opacity:0}
.ibq-gente p{font-size:.86rem;color:#D9C3B3;line-height:1.35}
.ibq-gente p b{color:#F7F2E8}
.ibq-nota{display:flex;gap:10px;margin-top:16px;font-size:.84rem;color:#D9C3B3;line-height:1.45}
.ibq-nota svg{flex:0 0 18px;width:18px;height:18px;stroke:#FFD66B;fill:none;stroke-width:2;margin-top:1px}
.ibq-upd{margin-top:18px;text-align:center;font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:.68rem;letter-spacing:.08em;color:rgba(217,195,179,.65)}
.ibq-turno{display:none;text-align:center;padding:10px 0 4px}
.ibq-card.is-dentro .ibq-cola{display:none}
.ibq-card.is-dentro .ibq-turno{display:block;animation:ibqEntra .6s cubic-bezier(.2,.7,.2,1)}
@keyframes ibqEntra{from{opacity:0;transform:translateY(14px) scale(.97)}}
.ibq-ok{width:78px;height:78px;margin:6px auto 0;border-radius:50%;display:grid;place-items:center;background:linear-gradient(135deg,#FFD66B,#E9A53A);box-shadow:0 0 0 10px rgba(255,214,107,.12),0 20px 40px -12px rgba(233,165,58,.6)}
.ibq-ok svg{width:38px;height:38px;stroke:#2A1611;fill:none;stroke-width:3;stroke-dasharray:40;stroke-dashoffset:40;animation:ibqTraza .6s .25s forwards}
@keyframes ibqTraza{to{stroke-dashoffset:0}}
.ibq-turno h2{font-family:'Bricolage Grotesque',system-ui,sans-serif;font-weight:800;font-size:2rem;margin-top:18px;letter-spacing:-.02em;color:#F7F2E8}
.ibq-turno p{color:#D9C3B3;margin-top:8px}
.ibq-go{display:inline-flex;align-items:center;gap:10px;margin-top:22px;padding:15px 28px;border:0;border-radius:999px;background:#F0532F;color:#fff;font:700 1rem 'Inter',system-ui,sans-serif;cursor:pointer;box-shadow:0 14px 30px -12px rgba(240,83,47,.8)}
.ibq-go svg{width:18px;height:18px;stroke:currentColor;fill:none;stroke-width:2.4}
.ibq-bar{height:3px;border-radius:3px;background:rgba(255,255,255,.12);margin:18px auto 0;max-width:220px;overflow:hidden}
.ibq-bar i{display:block;height:100%;width:0;background:#FFD66B}
.ibq-card.is-dentro .ibq-bar i{animation:ibqLlena 2.8s linear .3s forwards}
@keyframes ibqLlena{to{width:100%}}
.ibq-pie{margin-top:26px;font-size:.78rem;color:rgba(217,195,179,.6);text-align:center}
@media (prefers-reduced-motion:reduce){.ibq *{animation:none!important;transition:none!important}}`;

  const HTML = `
<div class="ibq-bg" aria-hidden="true"><i></i><i></i><i></i></div>
<div class="ibq-wrap">
  <div class="ibq-brand"><img src="assets/img/icon.svg" alt=""><span class="ibq-word">ibe<b>rail</b></span></div>
  <section class="ibq-card" aria-live="polite">
    <div class="ibq-cola">
      <span class="ibq-k"><i></i>Sala de espera</span>
      <h1>Estás en la cola para entrar</h1>
      <p class="ibq-sub">Ahora mismo hay muchísima gente entrando a la vez. Te guardamos el sitio y entras en cuanto sea tu turno.</p>
      <div class="ibq-pos">
        <div><div class="ibq-n" data-q="n">–</div><div class="ibq-nl" data-q="ntxt">personas delante de ti</div></div>
        <div class="ibq-eta"><small>Tiempo estimado</small><b data-q="eta">–</b></div>
      </div>
      <div class="ibq-via" aria-hidden="true"><div class="ibq-rail"></div><div class="ibq-fill" data-q="fill"></div><div class="ibq-tren" data-q="tren"><span>🚆</span></div><div class="ibq-meta">🏁</div></div>
      <div class="ibq-pct"><span data-q="pct">0 %</span><span>Tu turno</span></div>
      <div class="ibq-gente"><div class="ibq-caras" data-q="caras" aria-hidden="true"></div><p data-q="gente"></p></div>
      <div class="ibq-nota"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v5M12 16.5v.5"/></svg><span>No cierres ni recargues esta página: perderías tu sitio en la cola.</span></div>
      <div class="ibq-upd" data-q="upd">Actualizado ahora</div>
    </div>
    <div class="ibq-turno">
      <div class="ibq-ok"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>
      <h2>¡Es tu turno!</h2>
      <p>Gracias por esperar. Ya puedes entrar.</p>
      <button type="button" class="ibq-go" data-q="go">Entrar en iberail<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></button>
      <div class="ibq-bar"><i></i></div>
    </div>
  </section>
  <p class="ibq-pie">Tu Europa en tren, desde España</p>
</div>`;

  const m = /[?&]cola(?:=(\d+)-(\d+))?(?:&|$)/.exec(location.search);
  if(!m) return;
  const fijo = m[1] ? { n: +m[1], t: +m[2] } : null;
  // fuera el ?cola de la barra de direcciones (que en el vídeo se vea la dirección normal)
  try{ const u = new URL(location.href); u.searchParams.delete('cola'); history.replaceState(history.state, '', u.pathname + (u.search || '') + u.hash); }catch(e){}

  const azar = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const COLORES = ['#FFD66B', '#FF8A5B', '#FFE39A', '#F7C9A8', '#FFB86B', '#E9D5B5', '#FFC53D'];
  const LETRAS = 'ABCDEFGHIJLMNOPRSTVAMLCJ';
  let el = null, timers = [];
  const limpiar = () => { timers.forEach(x => { clearTimeout(x); clearInterval(x); }); timers = []; };

  function montar(){
    const st = document.createElement('style'); st.textContent = CSS; document.head.appendChild(st);
    el = document.createElement('div'); el.className = 'ibq'; el.setAttribute('role', 'dialog'); el.setAttribute('aria-modal', 'true'); el.setAttribute('aria-label', 'Sala de espera');
    el.innerHTML = HTML;
    document.body.appendChild(el);
    el.querySelector('[data-q="go"]').addEventListener('click', salir);
    document.addEventListener('keydown', e => { if((e.key === 'r' || e.key === 'R') && el) empezar(); });
    empezar();
  }
  const q = k => el.querySelector(`[data-q="${k}"]`);

  function empezar(){
    limpiar();
    el.classList.remove('is-out'); el.querySelector('.ibq-card').classList.remove('is-dentro');
    document.documentElement.classList.add('is-cola');
    const N = Math.max(2, Math.min(31, fijo ? fijo.n : azar(2, 31)));
    const T = Math.max(50, Math.min(120, fijo ? fijo.t : azar(50, 120)));
    const t0 = performance.now();
    // cuándo sale cada persona de delante: repartido a lo largo de T, a ratos de dos en dos
    const salidas = Array.from({ length: N }, (_, i) => ((i + .2 + Math.random() * .6) / N) * T * 1000).sort((a, b) => a - b);
    for(let i = 1; i < N - 1; i++) if(Math.random() < .18) salidas[i] = salidas[i - 1] + azar(80, 260);
    salidas.sort((a, b) => a - b);
    salidas[N - 1] = Math.max(salidas[N - 2] || 0, T * 1000 - azar(300, 900));   // el último sale justo al acabar el tiempo
    let quedan = N, ultUpd = performance.now();
    const caras = q('caras');
    caras.innerHTML = Array.from({ length: 5 }, (_, i) => `<span style="background:${COLORES[(i * 3 + N) % COLORES.length]}">${LETRAS[(i * 7 + N) % LETRAS.length]}</span>`).join('');
    const fmt = ms => { const s = Math.max(0, Math.ceil(ms / 1000)); return s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`; };
    function pintar(){
      const t = performance.now() - t0, nEl = q('n');
      if(nEl.textContent !== String(quedan)){ nEl.textContent = quedan; nEl.classList.add('is-tick'); setTimeout(() => nEl.classList.remove('is-tick'), 380); ultUpd = performance.now(); }
      q('ntxt').textContent = quedan === 1 ? 'persona delante de ti' : 'personas delante de ti';
      q('eta').textContent = fmt(T * 1000 - t);
      const p = Math.min(100, Math.round(((N - quedan) / N) * 100));
      q('fill').style.width = p + '%'; q('tren').style.left = Math.max(4, p) + '%'; q('pct').textContent = p + ' %';
      const detras = N + azar(0, 2) + Math.round(t / 3000);
      q('gente').innerHTML = quedan > 1 ? `<b>${quedan} personas</b> delante y <b>${detras}</b> esperando detrás de ti` : '<b>¡Eres el siguiente!</b> Prepárate para entrar';
      const hace = Math.round((performance.now() - ultUpd) / 1000);
      q('upd').textContent = hace < 2 ? 'Actualizado ahora' : `Actualizado hace ${hace} s`;
    }
    salidas.forEach((ms, i) => timers.push(setTimeout(() => {
      quedan = N - i - 1;
      const c = caras.firstElementChild;
      if(c){ c.classList.add('is-out'); setTimeout(() => { c.remove(); const s = document.createElement('span'); s.style.background = COLORES[azar(0, COLORES.length - 1)]; s.textContent = LETRAS[azar(0, LETRAS.length - 1)]; caras.appendChild(s); }, 400); }
      if(quedan <= 0){ pintar(); timers.push(setTimeout(dentro, 700)); }
    }, ms)));
    timers.push(setInterval(pintar, 1000)); pintar();
  }
  function dentro(){
    limpiar();
    el.querySelector('.ibq-card').classList.add('is-dentro');
    timers.push(setTimeout(salir, 3300));
  }
  function salir(){
    limpiar();
    document.documentElement.classList.remove('is-cola');
    window.scrollTo(0, 0);
    el.classList.add('is-out');
  }

  if(document.body) montar(); else document.addEventListener('DOMContentLoaded', montar, { once: true });
})();
