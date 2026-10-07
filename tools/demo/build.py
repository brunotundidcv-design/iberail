#!/usr/bin/env python3
"""Iberail — empaqueta la web en zip (como los que trae Bruno) y, aparte, la versión de DEMO del panel.

Uso:  python3 tools/demo/build.py <carpeta_salida> [versión]        (versión por defecto: 9.2)

Crea en <carpeta_salida>:
  iberail-web-v<versión>.zip        la web tal cual (lo que se sube a Netlify)
  iberail-web-v<versión>-demo.zip   la misma web, pero panel.html funciona SIN Supabase y con DATOS INVENTADOS
                                    (tools/demo/supabase-demo.js + datos-demo.js) para presentarlo.
La demo no se activa en iberail.com / zarping.com (datos-demo.js lo comprueba) y lleva la etiqueta «Demo» en el panel.
No incluye zarping/, supabase/, tools/ ni CLAUDE.md (igual que los zip de Bruno).
"""
import shutil, sys, zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEMO = Path(__file__).resolve().parent
FUERA = {'zarping', 'zarping-marca', 'tools', 'supabase', '.git', '.github', 'node_modules'}
FUERA_ARCH = {'CLAUDE.md', '.gitignore', '.DS_Store'}


def archivos_web():
    for p in sorted(ROOT.rglob('*')):
        rel = p.relative_to(ROOT)
        if p.is_dir() or rel.parts[0] in FUERA or p.name in FUERA_ARCH or p.name.startswith('.'):
            continue
        yield rel


def copiar(dest):
    if dest.exists():
        shutil.rmtree(dest)
    for rel in archivos_web():
        (dest / rel).parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(ROOT / rel, dest / rel)


def zipear(carpeta, destino):
    with zipfile.ZipFile(destino, 'w', zipfile.ZIP_DEFLATED) as z:
        for p in sorted(carpeta.rglob('*')):
            if p.is_file():
                z.write(p, p.relative_to(carpeta).as_posix())


def hacer_demo(dest):
    (dest / 'assets' / 'demo').mkdir(parents=True, exist_ok=True)
    for f in ('supabase-demo.js', 'datos-demo.js'):
        shutil.copy2(DEMO / f, dest / 'assets' / 'demo' / f)
    panel = dest / 'panel.html'
    t = panel.read_text(encoding='utf-8')
    cdn = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>'
    assert t.count(cdn) == 1, 'panel.html: no encuentro la librería de Supabase'
    # el Supabase de mentira va antes que app.js; los datos necesitan data.js (ciudades), que se adelanta
    t = t.replace(cdn, '<script src="assets/data.js"></script><script src="assets/demo/supabase-demo.js"></script><script src="assets/demo/datos-demo.js"></script>')
    t = t.replace('<script src="assets/data.js"></script>\n', '', 1) if t.count('<script src="assets/data.js"></script>') > 1 else t
    acc = '<div class="adm-top-actions">'
    assert t.count(acc) == 1
    t = t.replace(acc, acc + '\n    <span class="adm-demo" title="Panel de demostración: todos los datos son inventados">Demo · datos de ejemplo</span>')
    css = ('<style>.adm-demo{display:inline-flex;align-items:center;min-height:30px;padding:0 12px;border-radius:999px;'
           'border:1px dashed var(--line,#d9cdb8);color:var(--muted,#7a6f66);font:600 .72rem var(--mono,monospace);'
           'letter-spacing:.06em;text-transform:uppercase;white-space:nowrap}</style>')
    t = t.replace('</head>', css + '\n</head>', 1)
    t = t.replace('<title>Panel — Iberail</title>', '<title>Panel (demo) — Iberail</title>', 1)
    panel.write_text(t, encoding='utf-8')


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    out = Path(sys.argv[1]).resolve()
    ver = sys.argv[2] if len(sys.argv) > 2 else '9.2'
    out.mkdir(parents=True, exist_ok=True)
    normal, demo = out / f'iberail-web-v{ver}', out / f'iberail-web-v{ver}-demo'
    copiar(normal)
    zipear(normal, out / f'iberail-web-v{ver}.zip')
    copiar(demo)
    hacer_demo(demo)
    zipear(demo, out / f'iberail-web-v{ver}-demo.zip')
    n = sum(1 for _ in archivos_web())
    print(f'{n} archivos · {out / f"iberail-web-v{ver}.zip"} · {out / f"iberail-web-v{ver}-demo.zip"}')


if __name__ == '__main__':
    main()
