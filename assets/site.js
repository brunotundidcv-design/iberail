/* Iberail — shared behaviour */
document.documentElement.classList.add('js');

const reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- top bar + mobile menu ---------- */
(function(){
  const bar = document.querySelector('.topbar');
  const burger = document.querySelector('.burger');
  const menu = document.getElementById('mobileMenu');
  const mbar = document.getElementById('mbar');
  if(bar){
    const onScroll = () => {
      bar.classList.toggle('is-scrolled', window.scrollY > 8);
      if(mbar) mbar.classList.toggle('is-visible', window.scrollY > 240);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, {passive:true});
  }
  if(burger && menu){
    const setOpen = (open) => {
      burger.setAttribute('aria-expanded', String(open));
      burger.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
      menu.classList.toggle('is-open', open);
      document.body.classList.toggle('menu-open', open);
    };
    burger.addEventListener('click', () => setOpen(burger.getAttribute('aria-expanded') !== 'true'));
    menu.querySelectorAll('a').forEach(a => a.addEventListener('click', () => setOpen(false)));
    document.addEventListener('keydown', e => { if(e.key === 'Escape') setOpen(false); });
    window.addEventListener('resize', () => { if(getComputedStyle(burger).display === 'none') setOpen(false); });
  }
})();

/* ---------- scroll reveal ---------- */
(function(){
  const els = document.querySelectorAll('[data-reveal]');
  if(!els.length) return;
  if(reduceMotion || !('IntersectionObserver' in window)){
    els.forEach(el => el.classList.add('is-in'));
    return;
  }
  const io = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if(entry.isIntersecting){
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    });
  }, {threshold:0.12, rootMargin:'0px 0px -40px 0px'});
  // stagger siblings that sit in the same group
  document.querySelectorAll('[data-reveal-group]').forEach(group => {
    group.querySelectorAll(':scope > [data-reveal]').forEach((el, i) => el.style.setProperty('--rd', (i % 8) * 70 + 'ms'));
  });
  els.forEach(el => io.observe(el));
})();

/* ---------- page transition: curtain with the Iberail mark ---------- */
(function(){
  const html = document.documentElement;
  if(reduceMotion){ html.classList.remove('is-arriving'); return; }

  // arriving from another page of the site: lift the curtain
  if(html.classList.contains('is-arriving')){
    requestAnimationFrame(() => requestAnimationFrame(() => {
      html.classList.add('is-arrived');
      html.classList.remove('is-arriving');
    }));
  }
  // coming back via the back/forward cache: make sure nothing is covering the page
  window.addEventListener('pageshow', e => {
    if(e.persisted){ html.classList.remove('is-leaving','is-arriving'); }
  });

  document.addEventListener('click', e => {
    if(e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = e.target.closest('a[href]');
    if(!a || a.target === '_blank' || a.hasAttribute('download')) return;
    const href = a.getAttribute('href');
    if(!href || href.startsWith('#') || /^[a-z]+:/i.test(href)) return;
    // same page with only a hash change: let the browser scroll
    const url = new URL(href, location.href);
    if(url.pathname === location.pathname && url.hash) return;
    e.preventDefault();
    try{ sessionStorage.setItem('ib-nav', '1'); }catch(err){}
    html.classList.remove('is-arrived');
    html.classList.add('is-leaving');
    setTimeout(() => { location.href = href; }, 520);
  });
})();

/* ---------- SVG (SMIL) animations respect reduced motion too ---------- */
if(reduceMotion){
  document.querySelectorAll('svg').forEach(s => { if(s.pauseAnimations) s.pauseAnimations(); });
}

/* ---------- FAQ accordion ---------- */
document.querySelectorAll('.faq-q').forEach(btn => {
  btn.addEventListener('click', () => {
    const item = btn.closest('.faq-item');
    const open = !item.classList.contains('is-open');
    document.querySelectorAll('.faq-item.is-open').forEach(i => {
      i.classList.remove('is-open');
      i.querySelector('.faq-q').setAttribute('aria-expanded','false');
    });
    item.classList.toggle('is-open', open);
    btn.setAttribute('aria-expanded', String(open));
  });
});

/* ---------- horizontal scroller arrows ---------- */
document.querySelectorAll('[data-scroll-target]').forEach(btn => {
  btn.addEventListener('click', () => {
    const track = document.getElementById(btn.dataset.scrollTarget);
    if(!track) return;
    const card = track.querySelector('.ticket');
    const step = card ? card.getBoundingClientRect().width + 18 : 300;
    track.scrollBy({left: step * Number(btn.dataset.dir || 1), behavior: reduceMotion ? 'auto' : 'smooth'});
  });
});

/* ---------- booking window: countdown + "you are here" ---------- */
(function(){
  const box = document.querySelector('[data-season]');
  if(!box) return;
  const now = new Date();
  const y = now.getFullYear();
  const m = now.getMonth(); // 0-11

  // summer season = 1 July. After August we count to next year's.
  // Ultra Europe 2027 (9, 10 y 11 de julio): cuenta atrás al festival mientras no haya empezado
  const ULTRA = new Date(2027, 6, 9, 0, 0, 0);
  const toUltra = now < ULTRA;
  const inSeason = !toUltra && (m === 6 || m === 7);
  const targetYear = (m >= 8) ? y + 1 : y;
  const target = toUltra ? ULTRA : new Date(targetYear, 6, 1, 0, 0, 0);

  document.querySelectorAll('[data-season-year]').forEach(el => el.textContent = inSeason ? y : targetYear);

  // phases: Sep–Dec, Jan–Mar, Apr–Jun, Jul–Aug
  const phase = (m >= 8) ? 0 : (m <= 2) ? 1 : (m <= 5) ? 2 : 3;
  box.querySelectorAll('.timeline li').forEach((li, i) => {
    li.classList.toggle('is-now', i === phase);
    li.classList.toggle('is-past', i < phase);
    const old = li.querySelector('.here-tag');
    if(old) old.remove();
    if(i === phase){
      const t = document.createElement('span');
      t.className = 'here-tag';
      t.textContent = 'AHORA';
      li.querySelector('.when').appendChild(t);
    }
  });

  const cd = box.querySelector('.countdown');
  const caption = box.querySelector('.countdown-caption');
  if(!cd) return;
  if(!toUltra && caption) caption.innerHTML = 'para el <b>1 de julio</b>, el arranque del verano Interrail';
  if(inSeason){
    cd.hidden = true;
    if(caption) caption.innerHTML = '<b>La temporada ya está en marcha.</b> Escríbenos y miramos qué hueco queda.';
    return;
  }
  const out = {
    d: cd.querySelector('[data-cd="d"]'), h: cd.querySelector('[data-cd="h"]'),
    m: cd.querySelector('[data-cd="m"]'), s: cd.querySelector('[data-cd="s"]')
  };
  const pad = n => String(n).padStart(2, '0');
  function tick(){
    let diff = Math.max(0, target - new Date());
    const d = Math.floor(diff / 864e5); diff -= d * 864e5;
    const h = Math.floor(diff / 36e5); diff -= h * 36e5;
    const mi = Math.floor(diff / 6e4); diff -= mi * 6e4;
    const s = Math.floor(diff / 1e3);
    out.d.textContent = d; out.h.textContent = pad(h); out.m.textContent = pad(mi); out.s.textContent = pad(s);
  }
  tick();
  setInterval(tick, 1000);
})();

/* ---------- countries: region filter + search ---------- */
(function(){
  const grid = document.getElementById('countryGrid');
  if(!grid) return;
  const cards = Array.from(grid.querySelectorAll('.ticket'));
  const chips = document.querySelectorAll('.chip[data-region]');
  const input = document.getElementById('countrySearch');
  const empty = document.getElementById('countryEmpty');
  const norm = s => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  let region = 'all';

  function apply(){
    const q = norm(input ? input.value.trim() : '');
    let shown = 0;
    cards.forEach(c => {
      const show = (region === 'all' || c.dataset.region === region) && (!q || norm(c.dataset.search).includes(q));
      c.hidden = !show;
      if(show){ shown++; c.classList.add('is-in'); }
    });
    if(empty) empty.classList.toggle('is-visible', shown === 0);
  }
  chips.forEach(chip => chip.addEventListener('click', () => {
    region = chip.dataset.region;
    chips.forEach(c => c.setAttribute('aria-pressed', String(c === chip)));
    apply();
  }));
  if(input) input.addEventListener('input', apply);
})();

/* ---------- country rows on phones: tap to show the description ---------- */
document.querySelectorAll('.dest-grid .ticket-body').forEach(body => {
  body.addEventListener('click', () => {
    if(window.innerWidth > 560) return;
    const t = body.closest('.ticket');
    t.classList.toggle('is-open');
  });
});

/* ---------- hero: season-year outside the season block + rotating demand notes ---------- */
(function(){
  const d = new Date(), m = d.getMonth(), y = d.getFullYear();
  const yr = (m === 6 || m === 7) ? y : (m >= 8 ? y + 1 : y);
  document.querySelectorAll('[data-demand] [data-season-year]').forEach(el => el.textContent = yr);
  const rot = document.querySelector('.demand-rot');
  if(!rot) return;
  const items = rot.querySelectorAll('p');
  if(items.length < 2 || reduceMotion) return;
  let i = 0;
  setInterval(() => {
    if(document.hidden) return;
    items[i].classList.remove('is-on');
    i = (i + 1) % items.length;
    items[i].classList.add('is-on');
  }, 4200);
})();

/* ---------- aviso emergente: tiempo de respuesta más largo de lo normal ----------
   Para quitarlo cuando baje la demanda: on: false */
(function(){
  const BUSY = { on: true, hasta: '1 hora' };
  if(!BUSY.on || document.getElementById('admApp')) return;
  const KEY = 'ib-busy-visto';
  try{ if(sessionStorage.getItem(KEY)) return; }catch(e){}
  const box = document.createElement('aside');
  box.className = 'busy is-warn';
  box.setAttribute('role', 'alert');
  box.setAttribute('aria-live', 'assertive');
  box.innerHTML = `
    <span class="busy-ic" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z"/><path d="M12 9v4M12 17h.01"/></svg></span>
    <div class="busy-txt">
      <small><i></i>Aviso importante</small>
      <b>Las respuestas pueden tardar hasta <span class="nw">${BUSY.hasta}</span></b>
      <p>Debido al elevado volumen de solicitudes, nuestros tiempos de respuesta son más largos de lo habitual. Atendemos todas las consultas por estricto orden de llegada: <strong>enviar varios mensajes no acelera la respuesta</strong> y puede retrasarla.</p>
      <button type="button" class="busy-ok" data-busy-close>Entendido</button>
    </div>
    <button type="button" class="busy-x" data-busy-close aria-label="Cerrar aviso"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
  // en móvil se coloca justo encima de la barra inferior (WhatsApp / botón del planificador) si está a la vista
  let raf = 0;
  const place = () => {
    raf = 0;
    let off = 12;
    ['#mbar', '.pl-nav'].forEach(sel => {
      const el = document.querySelector(sel); if(!el) return;
      const cs = getComputedStyle(el); if(cs.display === 'none' || cs.visibility === 'hidden') return;
      const r = el.getBoundingClientRect();
      if(r.height && r.top < innerHeight - 4 && r.bottom > innerHeight - 30) off = Math.max(off, innerHeight - r.top + 10);
    });
    box.style.setProperty('--busy-b', off + 'px');
  };
  const queue = () => { if(!raf) raf = requestAnimationFrame(place); };
  const close = () => {
    try{ sessionStorage.setItem(KEY, '1'); }catch(e){}
    box.classList.remove('is-in');
    removeEventListener('scroll', queue); removeEventListener('resize', queue);
    setTimeout(() => box.remove(), 400);
  };
  box.addEventListener('click', e => { if(e.target.closest('[data-busy-close]')) close(); });
  document.addEventListener('keydown', e => { if(e.key === 'Escape' && box.isConnected && box.classList.contains('is-in')) close(); });
  setTimeout(() => {
    document.body.appendChild(box); place();
    addEventListener('scroll', queue, { passive: true }); addEventListener('resize', queue);
    const mb = document.getElementById('mbar'); if(mb) mb.addEventListener('transitionend', queue);
    requestAnimationFrame(() => requestAnimationFrame(() => box.classList.add('is-in')));
  }, 2200);
})();
