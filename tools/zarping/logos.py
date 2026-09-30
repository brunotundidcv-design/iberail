#!/usr/bin/env python3
"""Zarping — genera la carpeta de logos (zarping-marca/): SVG con el texto en trazos (no dependen de la fuente) + PNG.

Uso:  python3 tools/zarping/logos.py FUENTES_DIR
      FUENTES_DIR con Unbounded Bold, Manrope ExtraBold y Poppins ExtraBold en .ttf (Google Fonts).
Los PNG se sacan después con tools/zarping/logos_png.mjs (Chromium/Playwright).
"""
import sys, glob
from pathlib import Path
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'zarping-marca'
INK, LIME, VIO, PINK, WHITE, CREAM = '#0E0E12', '#D4FF3A', '#7B5CFF', '#FF6BB5', '#FFFFFF', '#F7F0E3'
IB_RED, IB_AMBER, IB_INK = '#C43730', '#F0B02A', '#1A1614'


def font(dirp, family, weight):
    for f in glob.glob(str(Path(dirp) / '*.ttf')):
        t = TTFont(f)
        if t['name'].getDebugName(1).startswith(family) and t['OS/2'].usWeightClass == weight:
            return t
    sys.exit(f'Falta la fuente {family} {weight}')


def text_path(t, s, size, x, y, track=0.0):
    """Texto → trazado SVG. track en em (p. ej. -0.07). Devuelve (d, ancho)."""
    gs, cmap, upm = t.getGlyphSet(), t.getBestCmap(), t['head'].unitsPerEm
    k = size / upm
    pen = SVGPathPen(gs)
    cx = 0
    for ch in s:
        g = cmap[ord(ch)]
        gs[g].draw(TransformPen(pen, (k, 0, 0, -k, x + cx, y)))
        cx += gs[g].width * k + track * size
    return pen.getCommands(), cx - track * size


def mark(color, x=0, y=0, s=1.0):
    """El símbolo: la estela de zarpar (en una caja de 100×100)."""
    return (f'<g transform="translate({x} {y}) scale({s})"><path d="M18 70C26 30 74 30 82 70" stroke="{color}" stroke-width="9" fill="none" '
            f'stroke-linecap="round" stroke-dasharray="1 16"/><circle cx="18" cy="72" r="11" fill="{color}"/>'
            f'<circle cx="82" cy="72" r="11" fill="none" stroke="{color}" stroke-width="8"/></g>')


def icon(x, y, size, bg=LIME, fg=INK):
    r = size * .26
    return f'<rect x="{x}" y="{y}" width="{size}" height="{size}" rx="{r}" fill="{bg}"/>' + mark(fg, x + size * .09, y + size * .06, size / 100 * .82)


def svg(w, h, body, bg=None):
    b = f'<rect width="{w}" height="{h}" fill="{bg}"/>' if bg else ''
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w:.0f} {h:.0f}" width="{w:.0f}" height="{h:.0f}">{b}{body}</svg>\n'


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    fd = sys.argv[1]
    UNB, MAN, POP = font(fd, 'Unbounded', 700), font(fd, 'Manrope', 800), font(fd, 'Poppins', 800)
    files = {}

    # palabra «zarping» (Unbounded 700, -0.07 em como en la web)
    wd, ww = text_path(UNB, 'zarping', 100, 0, 0, -0.07)

    def word(color, x, y, size):
        d, w = text_path(UNB, 'zarping', size, x, y, -0.07)
        return f'<path d="{d}" fill="{color}"/>', w

    def iberail(x, y, size, ibe, rail):
        d1, w1 = text_path(POP, 'ibe', size, x, y, -0.03)
        d2, w2 = text_path(POP, 'rail', size, x + w1 - 0.03 * size, y, -0.03)
        return f'<path d="{d1}" fill="{ibe}"/><path d="{d2}" fill="{rail}"/>', w1 + w2

    # 1) símbolo suelto (transparente)
    for n, c in [('negro', INK), ('blanco', WHITE), ('lima', LIME), ('violeta', VIO)]:
        files[f'simbolo/simbolo-{n}.svg'] = svg(100, 100, mark(c))
    # 2) icono (cuadrado redondeado): app, favicon, WhatsApp…
    files['icono/icono-lima.svg'] = svg(100, 100, icon(0, 0, 100))
    files['icono/icono-negro.svg'] = svg(100, 100, icon(0, 0, 100, INK, LIME))
    files['icono/icono-violeta.svg'] = svg(100, 100, icon(0, 0, 100, VIO, WHITE))

    # 3) logo horizontal: símbolo + palabra
    def horizontal(mc, tc, with_icon=False, ib=None):
        size = 110
        h = 150
        if with_icon:
            body = icon(0, 15, 120, *(with_icon))
            tx = 150
        else:
            body = mark(mc, -4, 0, 1.35)
            tx = 140
        wb, ww2 = word(tc, tx, 112, size)
        body += wb
        w = tx + ww2 + 6
        if ib:
            by_d, by_w = text_path(MAN, 'by', 34, tx + 4, 160, 0)
            ib_b, ib_w = iberail(tx + 4 + by_w + 10, 160, 38, *ib)
            body += f'<path d="{by_d}" fill="{tc}" opacity=".7"/>' + ib_b
            h = 178
        return svg(w, h, body)

    files['logo-horizontal/logo-color.svg'] = horizontal(VIO, INK)
    files['logo-horizontal/logo-negro.svg'] = horizontal(INK, INK)
    files['logo-horizontal/logo-blanco.svg'] = horizontal(WHITE, WHITE)
    files['logo-horizontal/logo-lima-blanco.svg'] = horizontal(LIME, WHITE)
    files['logo-horizontal/logo-icono-negro.svg'] = horizontal(None, INK, (LIME, INK))
    files['logo-horizontal/logo-icono-blanco.svg'] = horizontal(None, WHITE, (LIME, INK))
    # 4) con «by iberail»
    files['by-iberail/logo-by-iberail-color.svg'] = horizontal(VIO, INK, ib=(IB_INK, IB_RED))
    files['by-iberail/logo-by-iberail-blanco.svg'] = horizontal(LIME, WHITE, ib=(CREAM, IB_AMBER))
    files['by-iberail/logo-by-iberail-icono.svg'] = horizontal(None, INK, (LIME, INK), ib=(IB_INK, IB_RED))
    files['by-iberail/logo-by-iberail-icono-blanco.svg'] = horizontal(None, WHITE, (LIME, INK), ib=(CREAM, IB_AMBER))

    # 5) solo la palabra
    for n, c in [('negro', INK), ('blanco', WHITE), ('lima', LIME)]:
        b, w = word(c, 0, 110, 110)
        files[f'palabra/zarping-{n}.svg'] = svg(w + 4, 140, b)

    # 6) vertical (símbolo encima)
    def vertical(mc, tc, bgc=None, ib=None):
        b, w = word(tc, 0, 0, 110)
        W = max(w, 300) + 80
        body = mark(mc, W / 2 - 90, 10, 1.8)
        wb, _ = word(tc, (W - w) / 2, 300, 110)
        body += wb
        H = 350
        if ib:
            by_d, by_w = text_path(MAN, 'by', 36, 0, 0, 0)
            _, ib_w = iberail(0, 0, 40, IB_INK, IB_RED)
            x0 = (W - (by_w + 12 + ib_w)) / 2
            by_d, _ = text_path(MAN, 'by', 36, x0, 365, 0)
            ib_b, _ = iberail(x0 + by_w + 12, 365, 40, *ib)
            body += f'<path d="{by_d}" fill="{tc}" opacity=".7"/>' + ib_b
            H = 400
        return svg(W, H, body, bgc)
    files['vertical/logo-vertical-color.svg'] = vertical(VIO, INK)
    files['vertical/logo-vertical-blanco.svg'] = vertical(LIME, WHITE)
    files['vertical/logo-vertical-by-iberail.svg'] = vertical(VIO, INK, ib=(IB_INK, IB_RED))

    # 7) redes: foto de perfil (1080×1080) y portada
    files['redes/perfil-lima.svg'] = svg(1080, 1080, mark(INK, 150, 88, 7.8), LIME)
    files['redes/perfil-negro.svg'] = svg(1080, 1080, mark(LIME, 150, 88, 7.8), INK)
    files['redes/perfil-violeta.svg'] = svg(1080, 1080, mark(WHITE, 150, 88, 7.8), VIO)
    b, w = word(INK, 0, 0, 190)
    sc = 190
    wb, _ = word(INK, (1500 - w) / 2 + 60, 330, sc)
    by_d, by_w = text_path(MAN, 'by', 44, 0, 0, 0); _, ib_w = iberail(0, 0, 50, IB_INK, IB_RED)
    x0 = (1500 - (by_w + 14 + ib_w)) / 2 + 60
    by_d, _ = text_path(MAN, 'by', 44, x0, 430, 0); ib_b, _ = iberail(x0 + by_w + 14, 430, 50, IB_INK, IB_RED)
    files['redes/portada-1500x500.svg'] = svg(1500, 500, mark(INK, (1500 - w) / 2 - 150, 175, 1.9) + wb + f'<path d="{by_d}" fill="{INK}" opacity=".7"/>' + ib_b, LIME)

    for rel, content in files.items():
        p = OUT / rel
        p.parent.mkdir(parents=True, exist_ok=True)
        p.write_text(content, encoding='utf-8')
    (OUT / 'LEEME.txt').write_text('''ZARPING — logos y marca
========================

Colores
  Lima     #D4FF3A   (color principal)
  Violeta  #7B5CFF
  Negro    #0E0E12   (tinta)
  Rosa     #FF6BB5
Fuentes (Google Fonts, gratis)
  Títulos: Unbounded Bold · Texto: Manrope
Lema: «Tú pones el grupo. Nosotros, todo lo demás.»

Carpetas
  simbolo/          el símbolo solo (la estela de zarpar), fondo transparente
  icono/            símbolo dentro del cuadrado redondeado (app, favicon, WhatsApp)
  logo-horizontal/  símbolo + «zarping» — el logo principal
                    color = fondos claros · blanco / lima-blanco = fondos oscuros
  by-iberail/       logo con «by iberail» debajo
  vertical/         símbolo encima de la palabra
  palabra/          solo «zarping»
  redes/            foto de perfil (1080×1080) y portada (1500×500)

Cada logo está en SVG (se puede ampliar sin perder calidad; el texto va en trazos, no necesita la fuente)
y en PNG con fondo transparente (a 1x y a 3x, «@3x»).
Para Creatify, Canva o CapCut: usa los PNG @3x.
Se generan con: python3 tools/zarping/logos.py <carpeta de fuentes> && node tools/zarping/logos_png.mjs
''', encoding='utf-8')
    print(len(files), 'SVG en', OUT)


if __name__ == '__main__':
    main()
