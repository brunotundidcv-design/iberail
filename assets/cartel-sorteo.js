/* Iberail — cartel del sorteo para stories (1080×1920), con el aspecto de la web v16:
   fondo noche con puntos, la red de trenes hacia Split, la tarjeta de cuenta atrás del «Inicio» de la cuenta,
   la entrada dorada del Ultra y los pasos. Textos grandes para que se lean en el móvil.
   · IBCartel.dibujar({ fecha: 'AAAA-MM-DD' | '', hora: 'HH:MM', icono: url })  →  Promise<canvas>
     Con fecha de hoy pone «Hoy», con la de mañana «Mañana» y si no, el día de la semana.
     Sin fecha (o ya pasada): «Próximo sorteo, muy pronto».
   Lo usan sorteo.js (botón «Descargar el cartel») y el cartel que se prepara a mano para cada sorteo. */
(function(){
  const W = 1080, H = 1920, M = 80;
  const FD = '"Unbounded", "Geist", system-ui, sans-serif', FB = '"Geist", system-ui, sans-serif';
  const FM = '"Geist Mono", ui-monospace, monospace', FL = '"Poppins", "Unbounded", system-ui, sans-serif';
  const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

  function rr(c, x, y, w, h, r){ c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
  function fit(c, txt, font, size, maxW){ do { c.font = font.replace('{s}', size); size -= 2; } while(c.measureText(txt).width > maxW && size > 10); return size + 2; }
  function wrap(c, txt, maxW){ const out = []; let l = ''; txt.split(' ').forEach(w => { const t = l ? l + ' ' + w : w; if(c.measureText(t).width > maxW && l){ out.push(l); l = w; } else l = t; }); if(l) out.push(l); return out; }
  const ls = (c, v) => { try{ c.letterSpacing = v; }catch(e){} };
  const grad = (c, x0, x1, stops) => { const g = c.createLinearGradient(x0, 0, x1, 0); stops.forEach(([p, col]) => g.addColorStop(p, col)); return g; };
  const warm = (c, x0, x1) => grad(c, x0, x1, [[0, '#FFB81C'], [.4, '#FFB81C'], [.75, '#FF5A36'], [1, '#FF5FA0']]);
  const spec = (c, x0, x1) => grad(c, x0, x1, [[0, '#FFB81C'], [.25, '#FF5A36'], [.5, '#FF5A36'], [.75, '#8E97B0'], [1, '#E6E9F0']]);

  function cuando(fecha, hora){
    if(!fecha) return null;
    const d = new Date(fecha + 'T12:00:00'), dias = Math.round((d - new Date(new Date().toDateString() + ' 12:00')) / 864e5);
    if(!(dias >= 0)) return null;
    return { rel: dias === 0 ? 'hoy' : dias === 1 ? 'mañana' : 'dia', dia: DIAS[d.getDay()], n: d.getDate(), mes: d.toLocaleDateString('es-ES', { month: 'long' }), hora: hora || '20:00' };
  }
  const icono = url => new Promise(res => { if(!url) return res(null); const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = url; });

  async function dibujar(o){
    o = o || {};
    try{ await Promise.all([`800 100px ${FD}`, `600 30px ${FB}`, `600 24px ${FM}`, `800 60px ${FL}`].map(f => document.fonts.load(f))); }catch(e){}
    const img = await icono(o.icono), q = cuando(o.fecha, o.hora);
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');

    /* ---------- fondo: noche con puntos y luces suaves (como la web) ---------- */
    c.fillStyle = '#06070C'; c.fillRect(0, 0, W, H);
    [[140, 320, 900, 'rgba(142,151,176,.34)'], [1000, 860, 760, 'rgba(255,90,54,.20)'], [540, 1330, 700, 'rgba(255,184,28,.13)'], [80, 1820, 640, 'rgba(230,233,240,.10)']].forEach(([x, y, r, col]) => {
      const g = c.createRadialGradient(x, y, 0, x, y, r); g.addColorStop(0, col); g.addColorStop(1, 'rgba(6,7,12,0)'); c.fillStyle = g; c.fillRect(0, 0, W, H);
    });
    c.fillStyle = 'rgba(255,255,255,.07)';
    for(let y = 18; y < H; y += 36) for(let x = 18; x < W; x += 36){ c.beginPath(); c.arc(x, y, 1.4, 0, 6.283); c.fill(); }

    /* ---------- la red de trenes, rumbo a Split ---------- */
    const ciu = [['MADRID', 96, 214], ['BARCELONA', 250, 150], ['PARÍS', 400, 92], ['BERLÍN', 590, 120], ['PRAGA', 730, 84], ['BUDAPEST', 870, 140], ['SPLIT', 960, 232]];
    c.save();
    c.strokeStyle = 'rgba(214,220,240,.12)'; c.lineWidth = 2;
    [[0, 2], [2, 4], [3, 5], [1, 3], [4, 6]].forEach(([a, b]) => { c.beginPath(); c.moveTo(ciu[a][1], ciu[a][2]); c.lineTo(ciu[b][1], ciu[b][2]); c.stroke(); });
    c.strokeStyle = spec(c, 96, 960); c.lineWidth = 4; c.setLineDash([14, 10]); c.lineCap = 'round';
    c.beginPath(); ciu.forEach(([, x, y], i) => i ? c.lineTo(x, y) : c.moveTo(x, y)); c.stroke(); c.setLineDash([]);
    ciu.forEach(([n, x, y], i) => {
      const fin = i === ciu.length - 1;
      if(fin){
        c.save(); c.shadowColor = 'rgba(255,90,54,.9)'; c.shadowBlur = 24; c.fillStyle = '#FF5A36'; c.beginPath(); c.arc(x, y, 12, 0, 6.283); c.fill(); c.restore();
        c.strokeStyle = 'rgba(255,90,54,.55)'; c.lineWidth = 3; c.beginPath(); c.arc(x, y, 26, 0, 6.283); c.stroke();
      } else { c.fillStyle = '#F3F5FB'; c.beginPath(); c.arc(x, y, 6, 0, 6.283); c.fill(); }
    });
    // nombres con fondo, como las etiquetas de un mapa (así la línea no los tacha)
    ciu.forEach(([n, x, y], i) => {
      const fin = i === ciu.length - 1;
      c.font = `600 ${fin ? 22 : 17}px ${FM}`; ls(c, '3px'); c.textBaseline = 'middle';
      const w = c.measureText(n).width, lx = fin ? x - 40 - w : Math.min(W - 24 - w, Math.max(24, x - w / 2)), ly = fin ? y : (i % 2 ? y + 34 : y - 30);
      rr(c, lx - 10, ly - 15, w + 17, 30, 8); c.fillStyle = 'rgba(8,9,16,.88)'; c.fill();
      c.fillStyle = fin ? '#FF8FC0' : 'rgba(214,220,240,.72)'; c.textAlign = 'left'; c.fillText(n, lx, ly + 1);
      ls(c, '0px'); c.textBaseline = 'alphabetic';
    });
    c.restore();

    /* ---------- marca y «en directo» ---------- */
    const my = 340;
    if(img) c.drawImage(img, M, my - 36, 72, 72);
    c.font = `800 62px ${FL}`; c.textBaseline = 'middle'; c.textAlign = 'left';
    const bx = M + (img ? 88 : 0), w1 = c.measureText('ibe').width;
    c.fillStyle = '#F3F5FB'; c.fillText('ibe', bx, my + 3); c.fillStyle = '#FFB81C'; c.fillText('rail', bx + w1, my + 3);
    const live = q ? 'EN DIRECTO' : 'MUY PRONTO', liveCol = q ? ['rgba(60,203,138,.14)', '#5DFFC2'] : ['rgba(255,184,28,.16)', '#FFD27A'];
    c.font = `700 24px ${FM}`; ls(c, '3px'); const lw = c.measureText(live).width + 70;
    rr(c, W - M - lw, my - 28, lw, 56, 28); c.fillStyle = liveCol[0]; c.fill();
    c.fillStyle = liveCol[1]; c.beginPath(); c.arc(W - M - lw + 28, my, 8, 0, 6.283); c.fill();
    c.fillText(live, W - M - lw + 48, my + 2); ls(c, '0px'); c.textBaseline = 'alphabetic';

    /* ---------- titular ---------- */
    c.textAlign = 'left';
    c.font = `600 26px ${FM}`; ls(c, '5px'); c.fillStyle = '#B3B9CC'; c.fillText('SORTEO · ENTRADAS GRATIS', M, 452); ls(c, '0px');
    const t1 = 'Sorteamos entradas para el';
    ls(c, '-1px'); c.font = `800 ${fit(c, t1, `800 {s}px ${FD}`, 66, W - M * 2)}px ${FD}`; c.fillStyle = '#F3F5FB'; c.fillText(t1, M, 540);
    ls(c, '-6px'); const s2 = fit(c, 'Ultra Europe', `800 {s}px ${FD}`, 150, W - M * 2); c.font = `800 ${s2}px ${FD}`;
    const uw = c.measureText('Ultra Europe').width; c.fillStyle = warm(c, M, M + uw); c.fillText('Ultra Europe', M - 4, 672);
    ls(c, '0px');

    /* ---------- tarjeta de cuenta atrás (como el «Inicio» de la cuenta) ---------- */
    const cx = M, cy = 724, cw = W - M * 2, ch = 372;
    c.save(); rr(c, cx, cy, cw, ch, 44); c.clip();
    let g = c.createLinearGradient(cx, cy, cx + cw * .6, cy + ch); g.addColorStop(0, '#1d1436'); g.addColorStop(1, '#0b0b18'); c.fillStyle = g; c.fillRect(cx, cy, cw, ch);
    [[cx + cw, cy, 'rgba(255,90,54,.40)'], [cx, cy + ch, 'rgba(142,151,176,.42)']].forEach(([x, y, col]) => { const r = c.createRadialGradient(x, y, 0, x, y, 560); r.addColorStop(0, col); r.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = r; c.fillRect(cx, cy, cw, ch); });
    g = c.createLinearGradient(cx, cy, cx + cw, cy + ch); g.addColorStop(.35, 'rgba(255,255,255,0)'); g.addColorStop(.5, 'rgba(255,255,255,.06)'); g.addColorStop(.62, 'rgba(255,255,255,0)'); c.fillStyle = g; c.fillRect(cx, cy, cw, ch);
    c.restore();
    rr(c, cx, cy, cw, ch, 44); c.strokeStyle = 'rgba(255,255,255,.16)'; c.lineWidth = 2; c.stroke();
    c.textAlign = 'left'; c.font = `600 24px ${FM}`; ls(c, '4px'); c.fillStyle = '#DADEEA'; c.fillText('CUENTA ATRÁS', cx + 44, cy + 66);
    const pill = q ? (q.rel === 'hoy' ? 'HOY' : q.rel === 'mañana' ? 'MAÑANA' : q.dia.toUpperCase()) : 'PRONTO';
    c.font = `700 22px ${FM}`; const pw = c.measureText(pill).width + 64;
    rr(c, cx + cw - 44 - pw, cy + 38, pw, 46, 23); c.fillStyle = q ? 'rgba(60,203,138,.14)' : 'rgba(255,184,28,.16)'; c.fill();
    c.fillStyle = q ? '#3CCB8A' : '#FFD27A'; c.beginPath(); c.arc(cx + cw - 44 - pw + 25, cy + 61, 7, 0, 6.283); c.fill();
    c.fillStyle = q ? '#5DFFC2' : '#FFD27A'; c.textBaseline = 'middle'; c.fillText(pill, cx + cw - 44 - pw + 42, cy + 62); c.textBaseline = 'alphabetic'; ls(c, '0px');
    // «Hoy, a las 23:00 h»
    const [hA, hB] = q ? [(q.rel === 'hoy' ? 'Hoy' : q.rel === 'mañana' ? 'Mañana' : 'El ' + q.dia) + ', a las ', q.hora + ' h'] : ['Próximo sorteo, ', 'muy pronto'];
    ls(c, '-3px'); const hs = fit(c, hA + hB, `800 {s}px ${FD}`, 64, cw - 88); c.font = `800 ${hs}px ${FD}`;
    const aw = c.measureText(hA).width, bw2 = c.measureText(hB).width;
    c.fillStyle = '#FFFFFF'; c.fillText(hA, cx + 44, cy + 162); c.fillStyle = warm(c, cx + 44 + aw, cx + 44 + aw + bw2); c.fillText(hB, cx + 44 + aw, cy + 162); ls(c, '0px');
    // cajas
    const cajas = q ? [[`${q.dia.slice(0, 3).toUpperCase()} ${q.n}`, q.mes.toUpperCase()], [q.hora, 'HORA ESPAÑA'], ['0 €', 'PARTICIPAR', 1]] : [['3 días', 'DE FESTIVAL'], ['9–11', 'JULIO · SPLIT'], ['0 €', 'PARTICIPAR', 1]];
    const bxw = (cw - 88 - 28) / 3, byy = cy + 198, bh = 140;
    cajas.forEach(([v, k, cal], i) => {
      const x = cx + 44 + i * (bxw + 14);
      rr(c, x, byy, bxw, bh, 26); c.fillStyle = 'rgba(0,0,0,.38)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; c.stroke();
      c.textAlign = 'center'; ls(c, '-2px'); c.font = `800 ${fit(c, v, `800 {s}px ${FD}`, 58, bxw - 34)}px ${FD}`;
      const vw = c.measureText(v).width; c.fillStyle = cal ? warm(c, x + bxw / 2 - vw / 2, x + bxw / 2 + vw / 2) : '#FFFFFF'; c.fillText(v, x + bxw / 2, byy + 80);
      ls(c, '3px'); c.font = `600 ${fit(c, k, `600 {s}px ${FM}`, 21, bxw - 24)}px ${FM}`; c.fillStyle = '#C9CEDD'; c.fillText(k, x + bxw / 2, byy + 118); ls(c, '0px');
    });

    /* ---------- la entrada dorada ---------- */
    const tw = 640, th = 270, stub = tw * .72;
    const t = document.createElement('canvas'); t.width = tw; t.height = th; const k = t.getContext('2d');
    rr(k, 0, 0, tw, th, 26); g = k.createLinearGradient(0, 0, tw, th);
    g.addColorStop(0, '#FFF3CF'); g.addColorStop(.3, '#FFD66B'); g.addColorStop(.55, '#F2B23E'); g.addColorStop(.75, '#E39A2E'); g.addColorStop(1, '#FFE39A'); k.fillStyle = g; k.fill();
    k.globalCompositeOperation = 'destination-out'; [0, th].forEach(y => { k.beginPath(); k.arc(stub, y, 20, 0, 6.283); k.fill(); }); k.globalCompositeOperation = 'source-over';
    k.fillStyle = '#2A1611'; k.textAlign = 'left';
    k.globalAlpha = .7; k.font = `600 18px ${FM}`; ls(k, '4px'); k.fillText('ADMIT ONE · ABONO 3 DÍAS', 34, 52); k.globalAlpha = 1;
    ls(k, '-3px'); k.font = `800 ${fit(k, 'Ultra Europe', `800 {s}px ${FD}`, 60, stub - 60)}px ${FD}`; k.fillText('Ultra Europe', 32, 124);
    ls(k, '-1px'); k.fillStyle = '#9A2E14'; k.font = `800 38px ${FD}`; k.fillText('2027', 34, 172);
    k.strokeStyle = 'rgba(42,22,17,.3)'; k.setLineDash([10, 8]); k.lineWidth = 3;
    k.beginPath(); k.moveTo(34, 196); k.lineTo(stub - 30, 196); k.stroke(); k.beginPath(); k.moveTo(stub, 30); k.lineTo(stub, th - 30); k.stroke(); k.setLineDash([]);
    k.fillStyle = '#2A1611'; ls(k, '0px'); k.font = `700 26px ${FB}`; k.fillText('Split, Croacia · 9—11 jul', 34, 238);
    k.textAlign = 'center'; const sx = stub + (tw - stub) / 2;
    k.globalAlpha = .6; k.font = `600 18px ${FM}`; ls(k, '4px'); k.fillText('Nº', sx, 70); k.globalAlpha = 1;
    ls(k, '-1px'); k.font = `800 40px ${FD}`; k.fillText('FREE', sx, 124); ls(k, '0px');
    for(let i = 0, x = sx - 56; x < sx + 56; i++){ const w = [3, 6, 2, 4, 7, 3][i % 6]; k.fillRect(x, 158, w, 70); x += w + [4, 3, 5, 3, 4, 5][i % 6]; }
    const ty = 1262;
    g = c.createRadialGradient(540, ty, 0, 540, ty, 480); g.addColorStop(0, 'rgba(255,184,28,.26)'); g.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = g; c.fillRect(0, ty - 480, W, 960);
    c.save(); c.translate(540, ty); c.rotate(-.05);
    c.save(); c.rotate(-.1); c.translate(-24, -16); c.globalAlpha = .55; rr(c, -tw / 2, -th / 2, tw, th, 26); c.fillStyle = '#8E5018'; c.fill(); c.restore();
    c.shadowColor = 'rgba(0,0,0,.6)'; c.shadowBlur = 50; c.shadowOffsetY = 26; c.drawImage(t, -tw / 2, -th / 2);
    c.restore();

    /* ---------- cómo participar ---------- */
    const pasos = ['Entra en la web de Iberail', 'Pulsa «Participar gratis»', q ? `A las ${q.hora}, mira tu resultado` : 'El día del sorteo, mira tu resultado'];
    const py = 1444, gap = 16, pw2 = (W - M * 2 - gap * 2) / 3, ph = 176;
    pasos.forEach((txt, i) => {
      const x = M + i * (pw2 + gap);
      rr(c, x, py, pw2, ph, 30); g = c.createLinearGradient(0, py, 0, py + ph); g.addColorStop(0, 'rgba(255,255,255,.09)'); g.addColorStop(1, 'rgba(255,255,255,.03)'); c.fillStyle = g; c.fill();
      c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; c.stroke();
      rr(c, x + 24, py + 24, 50, 50, 16); c.fillStyle = [warm(c, x + 24, x + 74), grad(c, x + 24, x + 74, [[0, '#FF5A36'], [1, '#8E97B0']]), grad(c, x + 24, x + 74, [[0, '#8E97B0'], [1, '#E6E9F0']])][i]; c.fill();
      c.fillStyle = '#FFFFFF'; c.textAlign = 'center'; c.font = `800 26px ${FD}`; c.fillText(String(i + 1), x + 49, py + 59);
      c.textAlign = 'left'; c.fillStyle = '#F3F5FB'; c.font = `600 29px ${FB}`;
      wrap(c, txt, pw2 - 44).slice(0, 2).forEach((l, j) => c.fillText(l, x + 24, py + 116 + j * 34));
    });

    /* ---------- pie ---------- */
    c.textAlign = 'center';
    const u = 'iberail.com/sorteo'; ls(c, '-3px'); c.font = `800 ${fit(c, u, `800 {s}px ${FD}`, 70, W - M * 2)}px ${FD}`;
    const ww = c.measureText(u).width; c.fillStyle = warm(c, W / 2 - ww / 2, W / 2 + ww / 2); c.fillText(u, W / 2, 1712); ls(c, '0px');
    c.font = `600 28px ${FB}`; c.fillStyle = '#DADEEA';
    c.fillText('Participación extra: story mencionando a @iberailspain', W / 2, 1768);
    c.fillText('+ captura con tu nombre por WhatsApp (+300 seguidores)', W / 2, 1806);
    c.font = `500 22px ${FB}`; c.fillStyle = '#80869C';
    c.fillText('Sorteo gratuito · +18 · Residentes en España · Bases en iberail.com', W / 2, 1852);
    return cv;
  }

  window.IBCartel = { dibujar };
})();
