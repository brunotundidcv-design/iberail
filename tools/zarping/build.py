#!/usr/bin/env python3
"""Zarping — genera la web estática en zarping/ (segunda agencia, misma titular que Iberail).

Uso:  python3 tools/zarping/build.py

· Monta cada página con la misma cabecera, menú y pie (tools/zarping/pages/*.html = solo el <main>).
· Copia el JS/CSS COMÚN desde assets/ (cuentas, grupos, pagos, contratos, seguro…): la marca sale de
  zarping/assets/config.js (MARCA: 'zarping'). Si cambias un JS común de Iberail, vuelve a ejecutar esto.
· Las páginas legales, «Mi cuenta» y «Mis grupos» salen de las de Iberail con los textos cambiados.
Netlify: sitio aparte con «Base directory» = zarping (sin comando de build: todo está ya generado).
"""
import re, shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / 'tools' / 'zarping'
OUT = ROOT / 'zarping'
SITE = 'https://zarping.com'
WA_NUM = '34930491439'
WA = f'https://wa.me/{WA_NUM}'

# JS y CSS comunes con Iberail (se copian tal cual)
SHARED = ['app.js', 'site.js', 'site.css', 'notif.js', 'live.js', 'payment.js', 'cuenta.js',
          'alojamientos.js', 'contratos.js', 'seguro.js']

ARROW = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>'
I_WA = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 01-12.3 7.4L3 21l2.1-5.6A8.5 8.5 0 1121 11.5z"/></svg>'
I_USERS = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0113 0M16 4.6a3.5 3.5 0 010 6.8M18 14.2a6.5 6.5 0 013.5 5.8"/></svg>'
I_USER = '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/></svg>'
I_BELL = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0"/></svg>'
I_IG = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.4" cy="6.6" r="1" class="dot"/></svg>'
# el símbolo: la estela de zarpar (de un punto a otro)
MARK = ('<svg class="zp-mark" viewBox="0 0 100 100" aria-hidden="true"><path d="M18 70C26 30 74 30 82 70" stroke="currentColor" '
        'stroke-width="9" fill="none" stroke-linecap="round" stroke-dasharray="1 16"/><circle cx="18" cy="72" r="11" fill="currentColor"/>'
        '<circle cx="82" cy="72" r="11" fill="none" stroke="currentColor" stroke-width="8"/></svg>')

NAV = [('viajes.html', 'Viajes'), ('destinos.html', 'Destinos'), ('festivales.html', 'Festivales'), ('monta-tu-viaje.html', 'Monta tu viaje'), ('contacto.html', 'Contacto')]

LD = ('{"@context":"https://schema.org","@type":"TravelAgency","name":"Zarping","url":"https://zarping.com",'
      '"logo":"https://zarping.com/assets/img/logo.png","image":"https://zarping.com/assets/img/og.jpg",'
      '"description":"Viajes en grupo desde España: nieve, fin de curso, despedidas, festivales y escapadas.",'
      '"telephone":"+34930491439","email":"info@zarping.com","areaServed":"ES","priceRange":"€€",'
      '"address":{"@type":"PostalAddress","addressLocality":"Las Rozas de Madrid","addressRegion":"Madrid","addressCountry":"ES"}}')


def head(title, desc, path, noindex=False, extra=''):
    url = SITE + '/' + ('' if path == 'index.html' else path)
    return f'''<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{title}</title>
<meta name="description" content="{desc}">
<link rel="canonical" href="{url}">
{'<meta name="robots" content="noindex">' if noindex else ''}
<meta name="theme-color" content="#0E0E12">
<meta name="color-scheme" content="light">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Zarping">
<meta property="og:locale" content="es_ES">
<meta property="og:title" content="{title}">
<meta property="og:description" content="{desc}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE}/assets/img/og.jpg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="assets/img/icon.svg">
<link rel="icon" type="image/png" href="assets/img/favicon.png">
<link rel="apple-touch-icon" href="assets/img/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Unbounded:wght@500;600;700&family=Manrope:wght@400;500;600;700;800&family=Poppins:wght@800&display=swap" rel="stylesheet">
<link rel="stylesheet" href="assets/site.css">
<link rel="stylesheet" href="assets/zarping.css">
<script src="assets/config.js"></script>
<script>try{{if(sessionStorage.getItem('ib-nav')){{sessionStorage.removeItem('ib-nav');if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.documentElement.classList.add('is-arriving')}}}}catch(e){{}}</script>
<script type="application/ld+json">{LD}</script>{extra}
</head>'''


CUR = ' aria-current="page"'


def header(active):
    items = ''.join(f'<li><a href="{h}"{CUR if h == active else ""}>{t}</a></li>' for h, t in NAV)
    items += f'<li data-acct-only hidden><a class="nav-groups" href="grupos.html"{CUR if active == "grupos.html" else ""}>{I_USERS}Mis grupos</a></li>'
    mm = ''.join(f'<a href="{h}"{CUR if h == active else ""}><span class="mm-n">0{i + 1}</span>{t}{ARROW}</a>' for i, (h, t) in enumerate(NAV))
    return f'''<body class="zp">
<div class="curtain" aria-hidden="true"><img src="assets/img/icon.svg" alt=""><span class="rail"></span></div>
<a class="sr-only" href="#main">Saltar al contenido</a>
<header class="topbar zp-top">
  <div class="container">
    <a class="brand" href="index.html" aria-label="Zarping, inicio"><img src="assets/img/icon.svg" alt="" width="30" height="30"><span class="brand-word zp-word">zarping</span></a>
    <nav aria-label="Principal"><ul class="nav">{items}</ul></nav>
    <div class="topbar-cta">
      <button class="bell" type="button" data-bell hidden aria-label="Notificaciones" aria-expanded="false" aria-haspopup="dialog">{I_BELL}<b class="bell-n" hidden></b></button>
      <a class="acct" href="cuenta.html" data-acct hidden><span class="acct-av" aria-hidden="true">{I_USER}</span><span class="acct-t">Entrar</span></a>
      <a class="zp-top-wa" href="{WA}" target="_blank" rel="noopener" aria-label="Escríbenos por WhatsApp">{I_WA}</a>
      <a class="btn btn--lime btn--sm zp-top-cta" href="monta-tu-viaje.html">Monta tu viaje</a>
      <button class="burger" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="mobileMenu"><span></span><span></span><span></span></button>
    </div>
  </div>
</header>
<div class="mobile-menu" id="mobileMenu">
  <nav class="mm-links" aria-label="Menú móvil">{mm}</nav>
  <div class="mm-foot">
    <a class="btn btn--primary btn--block" href="monta-tu-viaje.html">Monta tu viaje {ARROW}</a>
    <a class="btn btn--dark btn--block" href="grupos.html" data-acct-only hidden>{I_USERS} Mis grupos</a>
    <a class="btn btn--ghost btn--block" href="cuenta.html" data-acct-m hidden>{I_USER} <span>Entrar / Mi cuenta</span></a>
    <a class="btn btn--ghost btn--block" href="{WA}" target="_blank" rel="noopener">{I_WA} Escríbenos por WhatsApp</a>
    <p><span class="live-dot"></span>Te atendemos por WhatsApp 24 h</p>
  </div>
</div>'''


FOOTER = f'''<footer class="footer zp-foot">
  <div class="container">
    <div class="footer-top">
      <div>
        <a class="brand" href="index.html"><img src="assets/img/icon.svg" alt="" width="30" height="30"><span class="brand-word zp-word">zarping</span></a>
        <p class="footer-tag">Viajes en grupo desde España: nieve, fin de curso, despedidas, festivales y escapadas. Tú pones el grupo; nosotros, todo lo demás.</p>
        <a class="zp-sister" href="https://iberail.com" target="_blank" rel="noopener"><small>¿Europa en tren?</small><span>Eso es cosa de <b class="brand-word">ibe<b>rail</b></b>, nuestra agencia hermana</span></a>
      </div>
      <div>
        <h4>Explora</h4>
        <ul><li><a href="viajes.html">Viajes</a></li><li><a href="destinos.html">Destinos</a></li><li><a href="viajes.html#nieve">Nieve</a></li><li><a href="viajes.html#fin-de-curso">Fin de curso</a></li><li><a href="festivales.html">Festivales</a></li><li><a href="monta-tu-viaje.html">Monta tu viaje</a></li><li><a href="contacto.html">Contacto</a></li></ul>
      </div>
      <div>
        <h4>Hablamos</h4>
        <ul>
          <li><a class="footer-ig" href="{WA}" target="_blank" rel="noopener">{I_WA}WhatsApp</a></li>
          <li><a class="footer-ig" href="https://www.instagram.com/zarping/" target="_blank" rel="noopener">{I_IG}Instagram</a></li>
          <li><a href="mailto:info@zarping.com">info@zarping.com</a></li>
          <li><span class="zp-foot-24"><i class="live-dot"></i>WhatsApp 24 h</span></li>
        </ul>
      </div>
    </div>
    <div class="footer-big" aria-hidden="true">zarping</div>
    <div class="footer-bottom">
      <span>© <span id="year">2026</span> Zarping. Todos los derechos reservados.</span>
      <span class="footer-legal"><a href="aviso-legal.html">Aviso legal</a> · <a href="politica-privacidad.html">Privacidad</a> · <a href="politica-cookies.html">Cookies</a></span>
    </div>
  </div>
</footer>'''

SUPA = '<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>'
BASE_JS = ['app.js', 'site.js', 'notif.js']
ACCT_JS = ['app.js', 'site.js', 'payment.js', 'cuenta.js', 'alojamientos.js', 'contratos.js', 'seguro.js', 'notif.js']


def scripts(names, supa=False, extra=''):
    s = SUPA if supa else ''
    s += '\n'.join(f'<script src="assets/{n}"></script>' for n in names)
    s += '\n<script src="assets/live.js" defer></script>' + extra
    s += "\n<script>var y=document.getElementById('year');if(y)y.textContent=new Date().getFullYear()</script>\n</body>\n</html>\n"
    return s


def page(name, title, desc, main, js, supa=False, noindex=False, fab=True, extra_js=''):
    fab_html = (f'<a class="fab" href="{WA}?text=Hola%20Zarping%2C%20quiero%20informaci%C3%B3n%20para%20un%20viaje%20en%20grupo" '
                f'target="_blank" rel="noopener" aria-label="Escríbenos por WhatsApp"><span class="fab-ic">{I_WA}</span>'
                '<span class="fab-label">¿Dudas? Escríbenos</span></a>'
                f'\n<div class="mbar" id="mbar"><a class="mbar-wa" href="{WA}?text=Hola%20Zarping%2C%20quiero%20informaci%C3%B3n%20para%20un%20viaje%20en%20grupo" '
                f'target="_blank" rel="noopener" aria-label="Escríbenos por WhatsApp">{I_WA}<span>WhatsApp</span></a>'
                f'<a class="btn btn--lime" href="monta-tu-viaje.html">Monta tu viaje {ARROW}</a></div>') if fab else ''
    html = head(title, desc, name, noindex) + '\n' + header(name) + '\n' + main.strip() + '\n' + fab_html + '\n' + FOOTER + '\n' + scripts(js, supa, extra_js)
    html = re.sub(r'\n{3,}', '\n\n', html)
    (OUT / name).write_text(html, encoding='utf-8')
    return html


MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre']


def fechas(a, b):
    from datetime import date
    x, y = date.fromisoformat(a), date.fromisoformat(b)
    if x.year == y.year and x.month == y.month:
        return f'{x.day}–{y.day} de {MESES[x.month - 1]} de {x.year}'
    if x.year == y.year:
        return f'{x.day} de {MESES[x.month - 1]} – {y.day} de {MESES[y.month - 1]} de {x.year}'
    return f'{x.day} de {MESES[x.month - 1]} de {x.year} – {y.day} de {MESES[y.month - 1]} de {y.year}'


def festivales_main():
    """festivales.html sale de tools/zarping/festivales.json (los pasados se ocultan solos en el navegador)."""
    import json, html
    from datetime import date
    from urllib.parse import quote
    d = json.loads((SRC / 'festivales.json').read_text(encoding='utf-8'))
    fs = sorted(d['festivales'], key=lambda f: f['inicio'])
    rev = date.fromisoformat(d['revisado'])
    e = html.escape
    zonas = {'espana': 'España', 'europa': 'Europa', 'mundo': 'Resto del mundo'}
    cards, mes_prev = [], ''
    for f in fs:
        i = date.fromisoformat(f['inicio'])
        mes = f'{MESES[i.month - 1]} {i.year}'
        if mes != mes_prev:
            cards.append(f'<h2 class="zp-fest-mes" data-mes>{mes.capitalize()}</h2>')
            mes_prev = mes
        conf = f.get('confirmado', True)
        dest = quote(f"{f['nombre'].split(' · ')[0]} · {f['ciudad']}")
        web = f'<a class="zp-fest-web" href="{e(f["web"])}" target="_blank" rel="noopener">Web oficial</a>' if f.get('web') else ''
        cards.append(f'''<article class="zp-fest zp-fest--{f['zona']}" data-zona="{f['zona']}" data-fin="{f['fin']}">
  <div class="zp-fest-date"><b>{i.day}</b><span>{MESES[i.month - 1][:3]}</span></div>
  <div class="zp-fest-body">
    <h3>{e(f['nombre'])}</h3>
    <p class="zp-fest-where"><span aria-hidden="true">{f['flag']}</span>{e(f['ciudad'])}, {e(f['pais'])}</p>
    <p class="zp-fest-when">{fechas(f['inicio'], f['fin'])}{'' if conf else ' <em>· por confirmar</em>'}</p>
    <p class="zp-fest-tags"><span>{e(f['estilo'])}</span><span>{zonas[f['zona']]}</span></p>
  </div>
  <div class="zp-fest-go"><a class="btn btn--primary btn--sm" href="monta-tu-viaje.html?tipo=festival&amp;dest={dest}">Ir con Zarping</a>{web}</div>
</article>''')
    main = (SRC / 'pages' / 'festivales.html').read_text(encoding='utf-8')
    main = main.replace('{{FESTIVALES}}', '\n'.join(cards)).replace('{{TOTAL}}', str(len(fs)))
    main = main.replace('{{REVISADO}}', f'{rev.day} de {MESES[rev.month - 1]} de {rev.year}')
    return main


ESTILOS = {'playa': '🏖️ Playa', 'islas': '🏝️ Islas', 'ciudad': '🏙️ Ciudad', 'fiesta': '🎉 Fiesta', 'naturaleza': '🌿 Naturaleza',
           'aventura': '🧗 Aventura', 'cultura': '🏛️ Cultura', 'nieve': '❄️ Nieve'}


def destinos_main():
    """destinos.html sale de tools/zarping/destinos.json."""
    import json, html
    from urllib.parse import quote
    e = html.escape
    ds = json.loads((SRC / 'destinos.json').read_text(encoding='utf-8'))['destinos']
    zonas = {'espana': 'España', 'europa': 'Europa', 'mundo': 'Resto del mundo'}
    cards = []
    for d in ds:
        tipo = 'nieve' if d['estilos'][0] == 'nieve' else 'escapada'
        lugar = d['lugar'] if d['zona'] != 'espana' else f"{d['lugar']}, España"
        acts = ''.join(f'<li>{e(a)}</li>' for a in d['actividades'])
        tags = ''.join(f'<span>{ESTILOS[x]}</span>' for x in d['estilos'])
        cards.append(f'''<article class="zp-dest zp-dest--{d['zona']}" data-zona="{d['zona']}" data-est="{' '.join(d['estilos'])}">
  <div class="zp-dest-h"><span class="zp-dest-emo" aria-hidden="true">{d['emoji']}</span><div><h3>{e(d['nombre'])}</h3><p><span aria-hidden="true">{d['flag']}</span> {e(lugar)}</p></div></div>
  <p class="zp-dest-meta"><span>🗓️ {e(d['epoca'])}</span><span>⏱️ {e(d['dias'])} días</span></p>
  <ul class="zp-dest-acts">{acts}</ul>
  <p class="zp-fest-tags">{tags}</p>
  <a class="btn btn--primary btn--sm" href="monta-tu-viaje.html?tipo={tipo}&amp;dest={quote(d['nombre'])}">Pedir precio <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a>
</article>''')
    est = '\n'.join(f'      <button type="button" data-e="{k}">{v}</button>' for k, v in ESTILOS.items())
    main = (SRC / 'pages' / 'destinos.html').read_text(encoding='utf-8')
    return (main.replace('{{DESTINOS}}', '\n'.join(cards)).replace('{{ESTILOS}}', est)
            .replace('{{TOTAL}}', str(len(ds))).replace('{{ACTS}}', str(sum(len(d['actividades']) for d in ds))))


def iberail_main(file):
    t = (ROOT / file).read_text(encoding='utf-8')
    m = re.search(r'<main id="main">.*?</main>', t, re.S)
    return m.group(0)


def rebrand(s):
    """Textos de Iberail → Zarping en las páginas que se reaprovechan."""
    rep = [
        ('https://iberail.com', SITE), ('iberail.com', 'zarping.com'), ('info@iberail.com', 'info@zarping.com'),
        ('Nombre comercial:</b> Iberail', 'Nombres comerciales:</b> Zarping (esta web) e Iberail (iberail.com)'),
        ('Iberail Protect', 'Zarping Protect'), ('Iberail', 'Zarping'),
        ('Tu Interrail, en un solo sitio.', 'Tus viajes, en un solo sitio.'),
        ('Tus rutas y tus billetes', 'Tus viajes y tus billetes'),
        ('La ruta y los documentos del grupo', 'El plan y los documentos del grupo'),
        ('Tu grupo de viaje: la ruta, los billetes', 'Tu grupo de viaje: el plan, los billetes'),
        ('Entra para ver tu grupo: la ruta, los billetes', 'Entra para ver tu grupo: el plan, los billetes'),
        ('Accede para enviar y seguir tus rutas.', 'Accede para pedir y seguir tus viajes.'),
        ('Mientras tanto puedes diseñar tu ruta y enviárnosla sin registrarte.', 'Mientras tanto puedes contarnos tu viaje por WhatsApp.'),
        ('Diseñar mi ruta', 'Montar mi viaje'), ('Nueva ruta', 'Nuevo viaje'), ('Mis rutas', 'Mis viajes'),
        ('href="rutas.html"', 'href="monta-tu-viaje.html"'),
        ('href="panel.html"', 'href="https://iberail.com/panel.html"'),
        ('<b>Panel de Zarping</b>', '<b>Panel del equipo</b>'),
        ('respuesta en máx. 30 min', 'respuesta rápida'), ('WhatsApp 24 h, respuesta en máx. 30 min.', 'WhatsApp 24 h.'),
        ('<span>MAD</span><i></i><span>SPL</span>', '<span>MAD</span><i></i><span>AND</span>'),
        ('Los horarios, tarifas, plazas y condiciones de los servicios ferroviarios y de los pases Interrail dependen de sus respectivos operadores, ajenos a Zarping, que pueden modificarlos en cualquier momento.',
         'Los horarios, tarifas, plazas y condiciones de los transportes, alojamientos, forfaits, entradas y demás servicios dependen de sus respectivos proveedores, ajenos a Zarping, que pueden modificarlos en cualquier momento.'),
        # privacidad y cookies: el planificador de rutas de Iberail → «Monta tu viaje»
        ('<td>ib-draft-v2</td>', '<td>zp-draft-v1</td>'),
        ('Guardar la ruta que estás diseñando en el planificador, incluidos los datos de contacto que hayas escrito, para que no la pierdas si recargas o cierras la página. Se guarda en el almacenamiento local de tu navegador y no sale de él hasta que envías la ruta.',
         'Guardar el viaje que estás pidiendo en «Monta tu viaje», incluidos los datos de contacto que hayas escrito, para que no lo pierdas si recargas o cierras la página. Se guarda en el almacenamiento local de tu navegador y no sale de él hasta que lo envías.'),
        ('Hasta que envías la ruta, o 30 días como máximo', 'Hasta que envías el viaje, o 30 días como máximo'),
        ('tu cuenta y tu panel de rutas', 'tu cuenta y tus viajes'),
        ('el borrador de ruta solo si usas el planificador', 'el borrador del viaje solo si usas «Monta tu viaje»'),
        ('algunas librerías y el mapa del planificador desde jsDelivr', 'algunas librerías desde jsDelivr'),
        ('consultar el mapa de la ruta o un documento', 'consultar un documento'),
        ('ven tu nombre, la ruta y los documentos del grupo', 'ven tu nombre, el plan y los documentos del grupo'),
        ('Los datos de tus rutas y de tu cuenta', 'Los datos de tus viajes y de tu cuenta'),
        ('Quién está detrás de Zarping y las condiciones para usar esta web.', 'Quién está detrás de Zarping y las condiciones para usar esta web. Zarping e Iberail son marcas de la misma titular.'),
    ]
    for a, b in rep:
        s = s.replace(a, b)
    s = s.replace('<img src="assets/img/icon.svg" alt="" width="54" height="54">', '<img src="assets/img/icon.svg" alt="" width="54" height="54">')
    return s


def main():
    (OUT / 'assets' / 'img').mkdir(parents=True, exist_ok=True)
    for f in SHARED:
        shutil.copyfile(ROOT / 'assets' / f, OUT / 'assets' / f)
    # site.css lleva colores de Iberail escritos a mano (coral, ámbar, granate): se pasan a los de Zarping
    css = (ROOT / 'assets' / 'site.css').read_text(encoding='utf-8')
    for a, b in [(r'rgba\(240,\s*83,\s*47,', 'rgba(123,92,255,'), (r'rgba\(255,\s*197,\s*61,', 'rgba(212,255,58,'),
                 (r'rgba\(59,\s*21,\s*16,', 'rgba(26,22,38,'), (r'rgba\(31,\s*18,\s*14,', 'rgba(14,14,18,'),
                 (r'(?i)#F0532F', '#7B5CFF'), (r'(?i)#D63E1C', '#6243F2'), (r'(?i)#FFC53D', '#D4FF3A'),
                 (r'(?i)#3B1510', '#1A1626'), (r'(?i)#260C08', '#0E0E12'), (r'(?i)#1F120E', '#0E0E12')]:
        css = re.sub(a, b, css)
    (OUT / 'assets' / 'site.css').write_text('/* Copia de assets/site.css de Iberail con los colores de Zarping (tools/zarping/build.py). */\n' + css, encoding='utf-8')

    # config.js: las mismas claves públicas de Supabase que Iberail + la marca
    cfg = (ROOT / 'assets' / 'config.js').read_text(encoding='utf-8')
    cfg = cfg.replace('/* Configuración de Iberail (generado por build.py; edita los valores ahí). */',
                      '/* Configuración de Zarping (generado por tools/zarping/build.py a partir de assets/config.js de Iberail). */')
    cfg = cfg.replace('WA_LINK: "https://w.app/iberail",', 'WA_LINK: "https://wa.me/' + WA_NUM + '",\n  MARCA: "zarping",   // Iberail / Zarping: textos, contratos y pagos (ver IB.BRANDS en app.js)')
    assert 'MARCA: "zarping"' in cfg, 'no se ha podido poner la marca en config.js'
    (OUT / 'assets' / 'config.js').write_text(cfg, encoding='utf-8')
    (OUT / '_redirects').write_text('# zarping.es y www → zarping.com\n'
        'https://zarping.es/*      https://zarping.com/:splat  301!\n'
        'https://www.zarping.es/*  https://zarping.com/:splat  301!\n'
        'https://www.zarping.com/* https://zarping.com/:splat  301!\n'
        '# el panel del equipo está en Iberail\n'
        '/panel.html  https://iberail.com/panel.html  302\n'
        '/*  /404.html  404\n', encoding='utf-8')
    (OUT / 'robots.txt').write_text('User-agent: *\nAllow: /\nDisallow: /cuenta.html\nDisallow: /grupos.html\n\nSitemap: https://zarping.com/sitemap.xml\n', encoding='utf-8')
    urls = ['', 'viajes.html', 'destinos.html', 'festivales.html', 'monta-tu-viaje.html', 'contacto.html', 'aviso-legal.html', 'politica-privacidad.html', 'politica-cookies.html']
    (OUT / 'sitemap.xml').write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
        ''.join(f'  <url><loc>{SITE}/{u}</loc></url>\n' for u in urls) + '</urlset>\n', encoding='utf-8')

    P = lambda n: (SRC / 'pages' / n).read_text(encoding='utf-8')
    page('index.html', 'Zarping — Viajes en grupo desde España',
         'Nieve, fin de curso, despedidas, festivales y escapadas en grupo. Precio cerrado por persona, pagos por separado, contratos online y WhatsApp 24 h.',
         P('index.html'), BASE_JS)
    page('viajes.html', 'Viajes en grupo · Zarping',
         'Nieve en Andorra y Sierra Nevada, viajes de fin de curso, despedidas, festivales y escapadas: te lo organizamos todo para el grupo.',
         P('viajes.html'), BASE_JS)
    page('monta-tu-viaje.html', 'Monta tu viaje · Zarping',
         'Cuéntanos el plan en 2 minutos y te mandamos una propuesta con precio cerrado por persona para todo el grupo.',
         P('monta-tu-viaje.html'), ['app.js', 'site.js', 'notif.js', 'zp-viaje.js'], supa=True, fab=False)
    page('destinos.html', 'Destinos para viajar en grupo: España, Europa y el mundo · Zarping',
         'Lanzarote, Ibiza, Menorca, Lisboa, Budapest, Marrakech, Bali, Tailandia y más: destinos con sus actividades. Os organizamos el viaje en grupo con precio cerrado por persona.',
         destinos_main(), BASE_JS)
    page('festivales.html', 'Próximos festivales en España, Europa y el mundo · Zarping',
         'Calendario de los próximos festivales: Tomorrowland, Primavera Sound, Mad Cool, Sziget, Coachella y más. Os organizamos el viaje en grupo: transporte y alojamiento.',
         festivales_main(), BASE_JS)
    page('contacto.html', 'Contacto · Zarping', 'Escríbenos por WhatsApp o por correo: te ayudamos a montar el viaje del grupo.',
         P('contacto.html'), BASE_JS)
    page('404.html', 'Página no encontrada · Zarping', 'Esta página no existe.', P('404.html'), BASE_JS, noindex=True)

    # cuenta y grupos: las mismas de Iberail (mismo JS), con los textos de Zarping
    page('cuenta.html', 'Mi cuenta · Zarping', 'Entra para pedir y seguir tus viajes, tu grupo y los avisos.',
         rebrand(iberail_main('cuenta.html')), ACCT_JS, supa=True, noindex=True, fab=False)
    page('grupos.html', 'Mis grupos · Zarping', 'Tu grupo de viaje: el plan, los billetes, los alojamientos, los avisos y los pagos.',
         rebrand(iberail_main('grupos.html')), ACCT_JS, supa=True, noindex=True, fab=False)
    for f, t in [('aviso-legal.html', 'Aviso legal'), ('politica-privacidad.html', 'Política de privacidad'), ('politica-cookies.html', 'Política de cookies')]:
        page(f, f'{t} · Zarping', f'{t} de zarping.com.', rebrand(iberail_main(f)), BASE_JS, fab=False)

    # restos de Iberail que no deberían quedar en la web de Zarping
    for f in OUT.glob('*.html'):
        t = f.read_text(encoding='utf-8')
        t = re.sub(r'<a[^>]*iberail\.com.*?</a>', '', t, flags=re.S)   # la agencia hermana se nombra a propósito
        t = re.sub(r'<div class="faq-item">[^\n]*Interrail\?.*?</div></div></div>', '', t)
        for bad in ['Interrail', 'rutas.html', 'paises.html', 'split.html', 'Iberail Protect', 'planificador']:
            n = t.count(bad)
            if n and not (f.name.startswith('politica') or f.name == 'aviso-legal.html'):
                print(f'  aviso: {f.name} contiene «{bad}» ×{n}')
    print('Zarping generado en', OUT)


if __name__ == '__main__':
    main()
