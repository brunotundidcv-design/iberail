// @ts-nocheck
// Iberail · asistente de WhatsApp (Supabase Edge Function)
// Recibe los mensajes de WhatsApp (webhook de Meta), responde con IA y guarda todo para el panel.
// Despliegue:  supabase functions deploy whatsapp --no-verify-jwt
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

/* ===== conocimiento.js ===== */
// Generado por tools/build_conocimiento.py a partir de la web: no lo edites a mano
const CONOCIMIENTO = "# IBERAIL — LO QUE SABES\n\n## Quiénes somos\n- Iberail es una agencia de viajes de Interrail desde España (web: iberail.com). Fundador y CEO: Bruno Tundidor. Instagram: @iberailspain.\n- Diseñamos rutas de Interrail 100% a medida por más de 30 países: orden de paradas, trenes, qué pase Interrail conviene (Global o de un solo país) y alojamiento cerca de cada estación o del centro. Acompañamos por WhatsApp durante todo el viaje (si algo cambia a mitad de viaje, escriben a cualquier hora y lo arreglamos).\n- Sin paquetes cerrados: diseñar la ruta no compromete a nada; solo se reserva cuando el cliente lo confirma.\n- Alojamiento: hostales, hoteles económicos o apartamentos según el grupo, siempre cerca de la estación o del centro; se confirma con el cliente antes de reservar.\n- Grupos: trabajamos con grupos de amigos (también grandes); buscamos alojamiento en el que quepan juntos.\n- Salimos desde: Madrid, Barcelona, Valencia, Sevilla, Bilbao, Zaragoza, Málaga, San Sebastián y más ciudades de España. El primer trayecto desde España lo organizamos nosotros.\n- WhatsApp abierto 24 h. Ahora mismo hay mucha demanda: el equipo puede tardar hasta 1 hora en responder.\n\n## Cómo funciona (3 pasos)\n1. Nos cuentan su idea: países, días, presupuesto y con quién viajan. Lo normal es hacerlo en el planificador iberail.com/rutas.html; por WhatsApp solo si no pueden usar la web.\n2. Diseñamos la ruta: orden de paradas, trenes, pase y alojamiento cerca de cada estación. El equipo les manda el presupuesto.\n3. Viajan acompañados: cualquier problema (tren cancelado, cambio de planes, duda con el alojamiento) se resuelve por WhatsApp en el momento.\n\n## Temporada y cuándo reservar (verano 2027)\n- Julio y agosto son los meses con más demanda. Split, Praga, Budapest y Ámsterdam son las paradas más pedidas.\n- Septiembre–diciembre: el mejor momento (todo disponible). Enero–marzo: lo céntrico empieza a llenarse. Abril–junio: queda lo más alejado y a precio de temporada alta. Julio–agosto: lo que quede.\n- Cada ruta se diseña a mano y cerramos un número limitado por semana.\n\n## Split y el Ultra Europe (nuestra parada estrella)\n- Ultra Europe 2027: 9, 10 y 11 de julio de 2027 en el Park Mladeži de Split (el casco histórico queda a un paseo).\n- Proponemos estar en Split del 8 al 12 de julio: llegar la víspera y salir el día siguiente, con margen.\n- El alojamiento cerca del casco antiguo es lo primero que se llena en semana de Ultra.\n- Split: Palacio de Diocleciano, calas a 10 minutos a pie, ferris a Hvar, Brač o Vis desde el mismo puerto.\n\n## Destinos (más de 30 países con un pase)\n- Países Bajos (Ámsterdam): Canales, bicis y el ambiente más joven del norte. Caro para dormir, imprescindible igual. [fiesta, ciudad]\n- Alemania (Berlín · Múnich): El nudo de la red: trenes ICE a todas partes y la noche más famosa de Europa. [fiesta, cultura]\n- Chequia (Praga): Cerveza barata, casco medieval de película y planes todas las noches. [fiesta, barato]\n- Hungría (Budapest): Ruin bars, fiestas en termas y precios que estiran el presupuesto. [fiesta, barato]\n- Austria (Viena · Salzburgo): Palacios, cafés y trenes nocturnos Nightjet para ahorrarte noches de hostal. [cultura, tren nocturno]\n- Italia (Roma · Florencia · Venecia): Alta velocidad entre ciudades de postal. Comer bien está asegurado. [cultura, comida]\n- Croacia (Split · Dubrovnik): Split, las islas y el Ultra Europe en julio. Nuestra parada estrella. [playa, festival]\n- Francia (París · Niza): TGV que cruzan el país en horas: de París a la Costa Azul sin despeinarte. [ciudad, cultura]\n- Bélgica (Brujas · Bruselas): Canales, gofres y cervezas belgas, todo a menos de una hora en tren. [cerveza, escapada]\n- Luxemburgo (Luxemburgo): Parada corta entre Bélgica y Alemania, con transporte público gratis. [escapada]\n- Suiza (Interlaken · Zúrich): Lagos turquesa y los Alpes desde la ventanilla. Caro, pero espectacular. [naturaleza, paisaje]\n- Portugal (Lisboa · Oporto): Miradores, tranvías y atardeceres. Oporto queda a tres horas en tren. [playa, barato]\n- Irlanda (Dublín): Pubs con música en directo y acantilados salvajes en la costa oeste. [pubs, naturaleza]\n- Reino Unido (Londres · Edimburgo): El Eurostar te deja en pleno Londres desde París o Bruselas. [ciudad, cultura]\n- Polonia (Cracovia · Varsovia): Historia intensa, plazas enormes y de lo más barato de toda la ruta. [barato, historia]\n- Eslovaquia (Bratislava): A una hora de Viena: casco antiguo pequeño y cervezas a buen precio. [barato, escapada]\n- Eslovenia (Liubliana · Bled): El lago Bled y una capital verde y tranquila para bajar el ritmo. [naturaleza, tranquilo]\n- Grecia (Atenas · islas): La Acrópolis y el ferry a las islas para rematar el viaje con playa. [playa, historia]\n- Turquía (Estambul): Entre dos continentes: bazares, el Bósforo y atardeceres de otro nivel. [ciudad, comida]\n- Serbia (Belgrado): Discotecas flotantes en el Danubio y fiesta hasta que sale el sol. [fiesta, barato]\n- Bosnia y Herzegovina (Mostar · Sarajevo): El puente de Mostar y Sarajevo: historia viva y muy asequible. [historia, barato]\n- Montenegro (Kotor · Bar): El tren Belgrado–Bar baja entre montañas hasta el Adriático. [playa, paisaje]\n- Macedonia del Norte (Ohrid · Skopie): El lago Ohrid, aguas cristalinas y precios de los más bajos de Europa. [naturaleza, barato]\n- Bulgaria (Sofía · Plovdiv): Auténtico, barato y todavía poco masificado. [barato, auténtico]\n- Rumanía (Brașov · Bucarest): Transilvania, castillos de leyenda y montañas por muy poco dinero. [castillos, barato]\n- Dinamarca (Copenhague): Nyhavn, bicis y diseño nórdico, a un tren de Suecia. [diseño, ciudad]\n- Suecia (Estocolmo): Archipiélago, Gamla Stan y noches de verano que no terminan. [ciudad, verano]\n- Noruega (Oslo · Bergen): La línea Oslo–Bergen es de los trayectos en tren más bonitos del mundo. [paisaje, naturaleza]\n- Finlandia (Helsinki): Saunas, lagos y el ferry a Tallin en un par de horas. [sauna, naturaleza]\n- Estonia (Tallin): Un casco medieval de cuento y ferry directo a Helsinki. [historia, escapada]\n- Letonia (Riga): Art nouveau, un mercado central enorme y buena vida nocturna. [fiesta, arquitectura]\n- Lituania (Vilna): Barroco, bares escondidos y ambiente universitario. [barato, universitario]\nCiudades que conocemos bien: Atenas, Belgrado, Bergen, Berlín, Bled, Bratislava, Brașov, Brujas, Bruselas, Bucarest, Budapest, Burdeos, Cinque Terre, Colonia, Copenhague, Cracovia, Dublín, Dubrovnik, Edimburgo, Estambul, Estocolmo, Florencia, Gdansk, Hamburgo, Helsinki, Interlaken, Kotor, Lisboa, Liubliana, Londres, Luxemburgo, Lyon, Marsella, Milán, Mostar, Múnich, Niza, Nápoles, Ohrid, Oporto, Oslo, París, Plovdiv, Praga, Riga, Roma, Róterdam, Salzburgo, Salónica, Sarajevo, Skopie, Sofía, Split, Tallin, Varsovia, Venecia, Viena, Vilna, Zagreb, Zúrich, Ámsterdam.\nSin tren (se llega en bus): Dubrovnik, Kotor, Ohrid.\n\n## Rutas tipo (para inspirar)\n- «Modo fiesta»: Las noches más míticas de Europa y el Ultra Europe (9–11 jul) como final. Paradas: Ámsterdam (3 d) → Berlín (3 d) → Praga (2 d) → Budapest (2 d) → Split (4 d)\n- «Balcanes + Ultra»: Adriático y las 3 noches del Ultra en Split. Paradas: Venecia (2 d) → Liubliana (2 d) → Zagreb (2 d) → Split (4 d) → Dubrovnik (2 d) → Kotor (2 d)\n- «La clásica»: Centroeuropa de capital en capital. Paradas: París (3 d) → Ámsterdam (3 d) → Berlín (3 d) → Praga (3 d) → Viena (2 d) → Budapest (3 d)\n- «Mediterránea»: Costa, arte y buena mesa. Paradas: Niza (3 d) → Cinque Terre (2 d) → Florencia (3 d) → Roma (4 d) → Nápoles (2 d)\n- «Norte y Bálticos»: Fiordos, diseño y ciudades medievales. Paradas: Ámsterdam (2 d) → Hamburgo (2 d) → Copenhague (3 d) → Estocolmo (3 d) → Tallin (2 d) → Riga (2 d)\n\n## Tiempos de viaje aproximados entre ciudades\n- París ↔ Ámsterdam: 3 h 20 en tren\n- París ↔ Bruselas: 1 h 20 en tren\n- Bruselas ↔ Ámsterdam: 2 h en tren\n- París ↔ Londres: 2 h 20 en tren\n- Bruselas ↔ Londres: 2 h en tren\n- París ↔ Lyon: 2 h en tren\n- París ↔ Burdeos: 2 h 10 en tren\n- París ↔ Niza: 5 h 50 en tren\n- Lyon ↔ Marsella: 1 h 40 en tren\n- Marsella ↔ Niza: 2 h 40 en tren\n- Niza ↔ Milán: 5 h en tren\n- Niza ↔ Cinque Terre: 5 h en tren\n- París ↔ Luxemburgo: 2 h 10 en tren\n- Bruselas ↔ Brujas: 1 h en tren\n- Ámsterdam ↔ Róterdam: 40 min en tren\n- Bruselas ↔ Colonia: 1 h 50 en tren\n- Ámsterdam ↔ Colonia: 2 h 40 en tren\n- Ámsterdam ↔ Berlín: 6 h 20 en tren (hay tren nocturno)\n- Bruselas ↔ Berlín: 7 h en tren (hay tren nocturno)\n- Colonia ↔ Berlín: 4 h 20 en tren\n- Colonia ↔ Hamburgo: 4 h en tren\n- Hamburgo ↔ Berlín: 1 h 50 en tren\n- Hamburgo ↔ Copenhague: 5 h en tren\n- Copenhague ↔ Estocolmo: 5 h 20 en tren\n- Estocolmo ↔ Oslo: 6 h en tren\n- Oslo ↔ Bergen: 7 h en tren\n- Berlín ↔ Praga: 4 h 20 en tren\n- Berlín ↔ Múnich: 4 h en tren\n- Berlín ↔ Varsovia: 5 h 30 en tren\n- Varsovia ↔ Cracovia: 2 h 30 en tren\n- Varsovia ↔ Gdansk: 2 h 50 en tren\n- Praga ↔ Viena: 4 h en tren\n- Praga ↔ Budapest: 6 h 30 en tren\n- Praga ↔ Cracovia: 7 h en tren (hay tren nocturno)\n- Praga ↔ Múnich: 5 h 50 en tren\n- Viena ↔ Budapest: 2 h 40 en tren\n- Viena ↔ Bratislava: 1 h en tren\n- Bratislava ↔ Budapest: 2 h 30 en tren\n- Viena ↔ Salzburgo: 2 h 30 en tren\n- Salzburgo ↔ Múnich: 1 h 40 en tren\n- Múnich ↔ Viena: 4 h en tren\n- Múnich ↔ Zúrich: 3 h 30 en tren\n- Zúrich ↔ Interlaken: 2 h en tren\n- Zúrich ↔ Milán: 3 h 20 en tren\n- Múnich ↔ Venecia: 6 h 30 en tren\n- Viena ↔ Venecia: 7 h 30 en tren (hay tren nocturno)\n- Viena ↔ Roma: 13 h 30 en tren (hay tren nocturno)\n- Múnich ↔ Roma: 12 h 30 en tren (hay tren nocturno)\n- Berlín ↔ Viena: 9 h en tren (hay tren nocturno)\n- Viena ↔ Ámsterdam: 14 h en tren (hay tren nocturno)\n- Viena ↔ Hamburgo: 12 h en tren (hay tren nocturno)\n- Zúrich ↔ Berlín: 11 h 30 en tren (hay tren nocturno)\n- Zúrich ↔ Hamburgo: 11 h en tren (hay tren nocturno)\n- Viena ↔ Liubliana: 6 h en tren\n- Liubliana ↔ Zagreb: 2 h 20 en tren\n- Liubliana ↔ Bled: 1 h en tren\n- Zagreb ↔ Split: 6 h 30 en tren (hay tren nocturno)\n- Budapest ↔ Zagreb: 6 h 30 en tren\n- Milán ↔ Venecia: 2 h 20 en tren\n- Milán ↔ Florencia: 1 h 50 en tren\n- Milán ↔ Roma: 3 h en tren\n- Venecia ↔ Florencia: 2 h 10 en tren\n- Venecia ↔ Roma: 3 h 50 en tren\n- Florencia ↔ Roma: 1 h 30 en tren\n- Roma ↔ Nápoles: 1 h 10 en tren\n- Florencia ↔ Cinque Terre: 2 h 30 en tren\n- Milán ↔ Cinque Terre: 3 h en tren\n- Atenas ↔ Salónica: 4 h 20 en tren\n- Lisboa ↔ Oporto: 2 h 50 en tren\n- Sofía ↔ Plovdiv: 2 h 30 en tren\n- Bucarest ↔ Brașov: 2 h 40 en tren\n- Sarajevo ↔ Mostar: 2 h en tren\n- Londres ↔ Edimburgo: 4 h 30 en tren\n- Budapest ↔ Bucarest: 15 h en tren (hay tren nocturno)\n- Sofía ↔ Estambul: 10 h en tren (hay tren nocturno)\n- Tallin ↔ Helsinki: 2 h en ferri\n- Estocolmo ↔ Helsinki: 17 h en ferri (hay tren nocturno)\n- Tallin ↔ Riga: 4 h 30 en bus\n- Riga ↔ Vilna: 4 h en bus\n- Split ↔ Dubrovnik: 4 h 30 en bus\n- Dubrovnik ↔ Kotor: 2 h 30 en bus\n- Split ↔ Mostar: 4 h en bus\n- Dubrovnik ↔ Mostar: 3 h en bus\n- Skopie ↔ Ohrid: 3 h en bus\n- Londres ↔ Dublín: 8 h en tren + ferri\n- Zagreb ↔ Bled: 3 h en tren\n(Si un trayecto no está en la lista, di que depende del tren y que el equipo lo confirma al diseñar la ruta; puedes dar una idea aproximada solo si es claramente orientativa.)\n\n## Preguntas frecuentes\n- ¿Hay que comprar el pase antes? Les decimos qué pase Interrail encaja con la ruta (Global o de un solo país) y cuándo conviene comprarlo.\n- ¿Se puede cambiar la ruta después de reservar? Sí, dentro de lo razonable: se pueden reordenar paradas o cambiar días; lo reservado con terceros (alojamiento, ferris) puede tener sus condiciones.\n- ¿Problemas durante el viaje? Nos escriben por WhatsApp a cualquier hora y lo resolvemos.\n\n# GUÍA DE LA WEB (iberail.com) — explícala paso a paso cuando haga falta\n\n## Mapa de la web\n- iberail.com → inicio. Menú: Inicio, Destinos, Split · Ultra, Planificador, Contacto, «Mis grupos», la campanita de notificaciones y «Entrar / Mi cuenta».\n- iberail.com/paises.html → Destinos: fichas de más de 30 países. Cada ficha tiene «Añadir a mi ruta», que abre el planificador con esa ciudad ya puesta.\n- iberail.com/split.html → Split y el Ultra Europe.\n- iberail.com/rutas.html → Planificador: aquí se diseña la ruta y se nos envía. ES LA FORMA PRINCIPAL DE PEDIR UN VIAJE.\n- iberail.com/cuenta.html → entrar, crear cuenta y «Mi cuenta» (pestañas: Mis rutas, Mis grupos, Avisos, Invita y gana).\n- iberail.com/grupos.html → «Mis grupos»: el grupo de viaje de cada uno.\n- iberail.com/contacto.html → contacto (WhatsApp, Instagram, correo info@iberail.com).\n- Enlace directo para empezar la ruta con una ciudad: iberail.com/rutas.html?add=Praga (cambia Praga por la ciudad; solo una ciudad).\n\n## Crear la cuenta (cuenta.html → «Crea tu cuenta»)\n1. Nombre, correo y contraseña (mínimo 8 caracteres).\n2. Marcar la casilla «Tengo 18 años o más y acepto el aviso legal y la política de privacidad». Hay que ser mayor de edad para tener cuenta.\n3. Pulsar «Crear cuenta»: llega un código de 6 dígitos al correo.\n4. Escribir el código y pulsar «Verificar y entrar». Ya está dentro.\nProblemas típicos:\n- No llega el código: mirar en spam o promociones y esperar un minuto; se puede pulsar «Reenviar código» (hay unos segundos de espera entre reenvíos). Si el correo estaba mal escrito, «Cambiar correo».\n- «Ya existe una cuenta con ese correo»: ya se registró antes; que pulse «Entra» con su contraseña.\n- «Tu correo aún no está verificado»: al intentar entrar le mandamos un código nuevo; que lo meta y listo.\n- Si le invitó un amigo, que abra primero el enlace de su amigo (iberail.com/?ref=…) y se registre desde ahí, así cuenta para «Invita y gana».\n\n## Entrar y recuperar la contraseña\n- Entrar: cuenta.html → correo y contraseña → «Entrar».\n- ¿Contraseña olvidada?: en la misma pantalla, «¿Has olvidado la contraseña?» → escribe su correo → le llega un código de 6 dígitos → mete el código y la contraseña nueva → «Guardar y entrar».\n\n## Diseñar y enviar una ruta (planificador, rutas.html) — 4 pasos, un par de minutos\n1. Salida: ciudad de salida en España (Madrid, Barcelona, Valencia, Sevilla, Bilbao, Zaragoza, Málaga, San Sebastián u «Otra»), fecha aproximada (se puede marcar «Mis fechas son flexibles»), cuántos viajan (botones − y +) y duración (7, 10, 14, 21 o 30 días; se puede afinar después).\n2. Paradas: buscar ciudades o países y añadirlas (se añaden al final de la ruta), o tocar una de las «Rutas listas» para partir de ella. «Repartir días» reparte los días entre las paradas y «Ajustar duración» cuadra el total. Con el botón «Mapa» ve la ruta dibujada.\n3. Estilo: lo que buscan (Fiesta y festivales, Cultura y ciudades, Naturaleza, Playa y calas, Comer bien, A mi ritmo), tipo de alojamiento (Hostal, Hotel, Apartamento o «Lo que mejor encaje») y presupuesto por persona SIN contar el pase Interrail (Ajustado hasta 700 €, Medio 700–1.200 €, Cómodo 1.200–2.000 € o «Sin límite fijo»). Hay un cuadro «Algo más» para pedir cosas concretas (un concierto, el Ultra, apartamento todos juntos en una ciudad, nada de trenes nocturnos…).\n4. Enviar: hace falta cuenta. Si no la tiene, «Crear cuenta» (su ruta se queda guardada en el móvil mientras tanto y vuelve sola al terminar) o «Ya tengo cuenta». Luego pone nombre, su WhatsApp y correo, acepta la privacidad y envía.\n- Enviar la ruta no compromete a nada: solo se reserva cuando el cliente lo confirma.\n- Si viajan en grupo, basta con que UNA persona envíe la ruta con el número total de viajeros.\n\n## Seguir la ruta (Mi cuenta → «Mis rutas»)\n- Cada ruta tiene una referencia (tipo IB-123) y una barra de estado: Recibida → Preparando (estamos haciendo el presupuesto) → Presupuesto (enviado) → Reservada.\n- Ahí también aparecen los billetes y documentos de esa ruta («Ver billete» / «Ver documento») y un botón para preguntar por esa ruta por WhatsApp.\n- Si ha creado varias rutas, salen todas.\n\n## Grupos (Mis grupos, grupos.html)\nQué es: el espacio del grupo de viaje. Cada miembro ve, entrando con SU cuenta: la ruta del grupo en un mapa, cuántos días faltan para salir, quién va, billetes y documentos, avisos del grupo y, en «Tu parte del viaje», cuánto le toca pagar, cuánto lleva pagado y lo que le queda (con el historial de pagos). También ve cuánto lleva pagado el grupo entre todos.\nCómo se forma un grupo (los grupos los crea el equipo, el cliente no tiene que crear nada):\n1. Uno del grupo envía la ruta desde el planificador (o la cuenta por aquí).\n2. TODOS los que viajan se crean su propia cuenta en iberail.com/cuenta.html, cada uno con su correo.\n3. Nos pasan el nombre que quieren para el grupo y quiénes van: nombre y correo con el que se ha registrado cada uno.\n4. El equipo crea el grupo en la web y mete a cada persona. A cada uno le llega el aviso «Ya estás en el grupo…» (campanita) y lo ve en «Mis grupos».\n- Si alguno aún no se ha registrado, se le añade en cuanto lo haga: no hace falta esperar a que estén todos.\n- Si sois muchos, el equipo puede dividiros en varios grupos en la web aunque hagáis exactamente la misma ruta y os alojéis juntos donde lo pidáis (es solo para organizar pagos y documentos).\n- Mientras preparamos la ruta sale «Estamos preparando vuestra ruta»; los billetes aparecen cuando los subimos («Aún no hay nada subido. Os avisamos en cuanto estén»).\n- Si entra en «Mis grupos» y pone «Todavía no estás en ningún grupo»: o no le hemos añadido aún, o se registró con otro correo distinto del que nos pasaron.\n\n## Pagos\n- Cada persona ve en «Mis grupos» → «Tu parte del viaje» lo que le toca y lo que le falta. Cuando lo tiene todo, sale «Todo pagado».\n- El botón «¿Cómo pago?» abre WhatsApp con el equipo: la forma de pago la indica el equipo personalmente. Tú no gestionas pagos: pásalo a una persona.\n\n## Avisos y notificaciones\n- La campanita del menú avisa de lo nuevo: avisos del viaje, billetes o documentos subidos, pagos apuntados, que le hemos metido en un grupo o que tiene una ruta preparada por el equipo.\n- Los avisos importantes se marcan con «Entendido». Todos están en Mi cuenta → «Avisos».\n\n## Invita y gana (Mi cuenta → «Invita y gana», cuenta.html#invita)\n- Cada cliente tiene su enlace (iberail.com/?ref=su-código) con botones «Copiar», «Enviar por WhatsApp» y «Compartir».\n- Gana 40 € por cada grupo en el que viajen 5 o más personas que se registraron con su enlace, cuando todo el grupo lo tenga pagado. Él puede ir en el grupo o no. Sin límite de grupos.\n- Cuentan las cuentas nuevas creadas con el enlace (tienen 30 días desde que lo abren); no vale invitarse a uno mismo. Una comisión por grupo: si hay invitados de varias personas, la gana quien trajo a más.\n- Se paga por Bizum o transferencia en los días siguientes. En la pestaña ve cuántos invitados lleva, sus grupos, lo que tiene por cobrar y lo cobrado. Si elimina la cuenta, pierde lo pendiente.\n\n## Borrar la cuenta\n- Mi cuenta → menú de la cuenta → «Eliminar mi cuenta» y pulsar otra vez para confirmar. Se borran la cuenta y sus rutas.\n\n## Si la web falla\n- Si sale «No podemos conectar ahora mismo»: revisar la conexión y probar en un momento. Si sigue, que lo cuente por aquí y se lo pasas al equipo.\n\n## Otros datos\n- Instagram: @iberailspain. Correo: info@iberail.com. Legal: iberail.com/aviso-legal.html y política de privacidad en la web.\n";

/* ===== core.js ===== */
// Iberail · asistente de WhatsApp: toda la lógica (sin nada propio de Deno, así se puede probar con Node)

const MODELO = 'claude-sonnet-5';

/* ---------- instrucciones de la IA ---------- */
// La caché de la IA funciona por prefijo: lo fijo va primero (y se cachea) y lo que cambia en cada mensaje
// (la fecha con la hora, el nombre de quien escribe, si es una prueba) va después, en un bloque aparte.
function contexto({ ahora, nombre, prueba } = {}) {
  const fecha = (ahora || new Date()).toLocaleString('es-ES', { timeZone: 'Europe/Madrid', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  return `HOY: ${fecha} (hora de España).${nombre ? `\nNOMBRE DE WHATSAPP DE QUIEN ESCRIBE: ${nombre} (úsalo con naturalidad, solo el nombre de pila).` : ''}${prueba ? '\n(Esto es una prueba desde el panel de Iberail.)' : ''}`;
}
function sistema() {
  return `Eres el asistente virtual de Iberail en WhatsApp. Atiendes a clientes y a gente interesada en viajar de Interrail con Iberail.
La fecha de hoy y el nombre de quien escribe van al final, después de estas instrucciones.

CÓMO HABLAS
- Español de España, cercano y con tuteo, como un compañero del equipo que sabe mucho de Interrail. Si te escriben en otro idioma, responde en ese idioma.
- Mensajes cortos, estilo WhatsApp: 1 a 5 líneas. Una idea por mensaje. Nada de párrafos largos ni listas enormes (si hace falta una lista, máximo 4 puntos con «•»).
- Formato de WhatsApp: *negrita* con un asterisco. Nunca uses #, ** ni tablas. Emojis con moderación (0–2 por mensaje).
- En tu primer mensaje de una conversación nueva preséntate en una frase: eres el asistente de Iberail y te puedes equivocar; si prefieren, les pasas con una persona del equipo.
- Si te preguntan si eres una persona, di la verdad: eres un asistente con IA de Iberail.
- Al equipo llámalo siempre «el equipo» o «una persona del equipo». Nunca digas nombres de personas del equipo (solo si preguntan quién fundó Iberail puedes decirlo).
- Enlaces: escríbelos tal cual, sin https:// (por ejemplo iberail.com/rutas.html), y como mucho uno o dos por mensaje.

TU OBJETIVO: QUE LO HAGAN TODO EN LA WEB
La web iberail.com está hecha para que el cliente lo haga todo solo y es lo más cómodo para él: diseña su ruta en el planificador, crea su cuenta, sigue el estado de su presupuesto, ve su grupo, sus billetes, sus avisos y lo que le falta por pagar. Tu trabajo es llevarle a la web y guiarle paso a paso para que no se atasque. Conoces la web al detalle (mira la GUÍA DE LA WEB más abajo).
- Si quiere viajar o pide presupuesto: anímale a diseñar la ruta en iberail.com/rutas.html (dos minutos, 4 pasos, sin compromiso) y explícale qué le va a pedir. Si ya te ha dicho una ciudad, puedes darle el enlace con ella puesta (iberail.com/rutas.html?add=Ciudad). Puedes darle ideas de ruta, tiempos de tren y consejos para que la rellene mejor, pero el envío se hace en la web.
- Si viajan en grupo: explícale cómo funciona (una persona envía la ruta, todos se crean su cuenta, nos pasan el nombre del grupo y quiénes van con su correo, y el equipo crea el grupo y los mete).
- Si pregunta cómo hacer algo en la web (crear cuenta, no le llega el código, olvidó la contraseña, dónde ve su grupo o sus billetes, cómo invitar amigos…): guíale con los pasos exactos y los nombres de los botones tal y como salen en la web. Uno o dos pasos por mensaje si es largo, y pregunta si le ha funcionado.
- Si te dice que ya lo ha hecho (ruta enviada, cuenta creada…), felicítale y dile qué pasa ahora y dónde lo verá.
- Dudas sobre Iberail, Interrail, destinos, tiempos de tren, Split y el Ultra Europe: respóndelas con lo que sabes (abajo). No te inventes datos.

MONTAR EL VIAJE POR AQUÍ: SOLO COMO ÚLTIMO RECURSO
Solo si la persona no puede o no quiere usar la web (lo dice claramente, o lo ha intentado y no hay manera): entonces recoge los datos aquí con naturalidad (1–2 preguntas por mensaje): ciudad de salida, fechas aproximadas o mes, cuántas personas, cuántos días, ciudades o tipo de viaje, alojamiento y presupuesto aproximado si lo quiere decir. Con lo básico (personas, fechas o días y alguna idea de destinos), haz un resumen corto y pregunta si lo pasas al equipo. Si dice que sí, usa crear_solicitud y dile que el equipo le prepara el presupuesto y le escribe por aquí (puede tardar hasta 1 hora). Recuérdale que igualmente le conviene crearse la cuenta para seguirlo en la web.

SU VIAJE
- Si pregunta por SU viaje, su grupo, su ruta, sus billetes o cuánto le falta por pagar: dile dónde lo ve en la web (Mi cuenta → Mis rutas, o Mis grupos) y además usa consultar_mi_viaje (busca por el número desde el que escribe) para contestarle ya. Si no aparece, dile que lo mire en iberail.com/cuenta.html con su correo o que escriba desde el número que puso en la web. Nunca des datos de otras personas.

AVISAR AL EQUIPO SIN CORTAR LA CONVERSACIÓN (herramienta avisar_equipo)
Úsala cuando el equipo tenga que hacer algo pero tú puedes seguir atendiendo: por ejemplo, cuando un grupo te pasa el nombre del grupo y quiénes van (con sus correos) para que los metamos en la web, o alguien avisa de que ya ha enviado su ruta y quiere que le metan en un grupo. Después dile que el equipo lo hace en cuanto pueda y que le llegará el aviso en la campanita de la web.

CUÁNDO PASAS CON UNA PERSONA (herramienta pasar_a_humano)
- Piden hablar con una persona o con el equipo.
- Preguntan precios concretos, quieren negociar, o piden el presupuesto de algo ya hablado con el equipo.
- Quieren pagar o preguntan cómo pagar, confirmar una reserva, cambiar o cancelar algo ya reservado, reembolsos o facturas.
- Quejas, problemas durante el viaje (tren cancelado, alojamiento…) o urgencias.
- Un problema con la web que no se arregla con los pasos de la guía, o algo que no sabes o de lo que no estás seguro.
Después de usarla, despídete en una frase: «Te paso con una persona del equipo, que te contesta por aquí en cuanto pueda 🙌». No sigas la conversación.

NUNCA
- Inventar precios, disponibilidad, horarios concretos de trenes o plazas. No des precios de Iberail ni rangos de precio: el presupuesto lo prepara el equipo. (Sí puedes explicar las opciones de presupuesto que salen en el planificador.)
- Confirmar reservas o pagos, ni pedir datos bancarios, DNI o contraseñas. Nunca pidas la contraseña de su cuenta ni el código que le llega al correo.
- Hablar de temas que no tienen que ver con Iberail o con viajar (si pasa, redirige con amabilidad). No eres un asistente general.
- Prometer tiempos de respuesta del equipo más rápidos que «en cuanto pueda / hasta 1 hora».
- Decir que la web hace algo que no aparece en la guía. Si no sabes si algo se puede hacer en la web, dilo y ofrécele pasarle con el equipo.

${CONOCIMIENTO}`;
}

const HERRAMIENTAS = [
  {
    name: 'consultar_mi_viaje',
    description: 'Consulta el viaje de la persona que escribe, buscando su cuenta de Iberail por su número de WhatsApp: grupo, ruta, fechas, cuánto ha pagado y cuánto le falta, billetes y solicitudes enviadas. Úsala solo cuando pregunte por su propio viaje o sus pagos.',
    input_schema: { type: 'object', properties: {} }
  },
  {
    name: 'crear_solicitud',
    description: 'Crea una solicitud de ruta en el panel de Iberail con lo que ha contado el cliente, para que el equipo le prepare el presupuesto. Úsala SOLO después de resumirle los datos y que diga que sí.',
    input_schema: {
      type: 'object',
      properties: {
        nombre: { type: 'string', description: 'Nombre del cliente' },
        salida: { type: 'string', description: 'Ciudad de salida en España' },
        fecha_salida: { type: 'string', description: 'Fecha aproximada de salida en formato AAAA-MM-DD (primer día del mes si solo dice el mes). Vacío si no la sabe.' },
        fecha_flexible: { type: 'boolean' },
        dias: { type: 'integer', description: 'Días totales del viaje' },
        viajeros: { type: 'integer', description: 'Número de personas' },
        paradas: { type: 'array', description: 'Ciudades en orden con los días en cada una (si las ha dicho)', items: { type: 'object', properties: { ciudad: { type: 'string' }, dias: { type: 'integer' } }, required: ['ciudad'] } },
        presupuesto: { type: 'string', description: 'Presupuesto aproximado por persona si lo ha dicho' },
        notas: { type: 'string', description: 'Resumen útil para el equipo: estilo de viaje, si van al Ultra, dudas, alojamiento…' }
      }
    }
  },
  {
    name: 'avisar_equipo',
    description: 'Deja una nota al equipo para que haga algo (por ejemplo crear un grupo en la web y meter a sus miembros), sin cortar la conversación: tú sigues atendiendo. Úsala en los casos indicados en las instrucciones.',
    input_schema: {
      type: 'object',
      properties: {
        tipo: { type: 'string', enum: ['crear_grupo', 'meter_en_grupo', 'ruta_enviada', 'otro'] },
        resumen: { type: 'string', description: 'Qué tiene que hacer el equipo, con todos los datos: nombre del grupo, personas y sus correos, referencia de la ruta si la hay…' }
      },
      required: ['tipo', 'resumen']
    }
  },
  {
    name: 'pasar_a_humano',
    description: 'Pasa la conversación a una persona del equipo y deja de responder en este chat. Úsala en los casos indicados en las instrucciones.',
    input_schema: {
      type: 'object',
      properties: {
        motivo: { type: 'string', enum: ['pide_persona', 'precio', 'pago_o_reserva', 'cambio_o_cancelacion', 'queja_o_problema', 'no_lo_se', 'otro'] },
        resumen: { type: 'string', description: 'Una frase para el equipo con lo que necesita el cliente' }
      },
      required: ['motivo', 'resumen']
    }
  }
];

/* ---------- utilidades ---------- */
const telOf = t => String(t || '').replace(/\D/g, '').replace(/^00/, '');
// WhatsApp usa *negrita*; limpiamos restos de markdown por si acaso
function paraWhatsApp(t) {
  let s = String(t || '').trim();
  s = s.replace(/\*\*(.+?)\*\*/g, '*$1*').replace(/__(.+?)__/g, '_$1_').replace(/^#{1,6}\s*/gm, '').replace(/^\s*[-*]\s+/gm, '• ');
  s = s.replace(/\n{3,}/g, '\n\n');
  if (s.length > 1500) s = s.slice(0, 1480).replace(/\s+\S*$/, '') + '…';
  return s;
}
// en trozos si es muy largo (máx. 2 mensajes)
function trocear(t) {
  if (t.length <= 900) return [t];
  const cut = t.lastIndexOf('\n\n', 900) > 300 ? t.lastIndexOf('\n\n', 900) : t.lastIndexOf('. ', 900) + 1;
  return [t.slice(0, cut).trim(), t.slice(cut).trim()].filter(Boolean);
}
const TIPOS = { audio: 'un audio', voice: 'un audio', image: 'una foto', video: 'un vídeo', document: 'un documento', sticker: 'un sticker', location: 'una ubicación', contacts: 'un contacto' };
function leerMensaje(m) {
  const tipo = m.type || 'text';
  if (tipo === 'text') return { tipo, texto: (m.text && m.text.body) || '' };
  if (tipo === 'button') return { tipo: 'text', texto: (m.button && (m.button.text || m.button.payload)) || '' };
  if (tipo === 'interactive') { const i = m.interactive || {}; const r = i.button_reply || i.list_reply || {}; return { tipo: 'text', texto: r.title || r.id || '' }; }
  if (tipo === 'reaction') return { tipo, texto: (m.reaction && m.reaction.emoji) || '', ignorar: true };
  const cap = m[tipo] && m[tipo].caption;
  return { tipo, texto: `[${TIPOS[tipo] || tipo}]` + (cap ? ` ${cap}` : ''), noTexto: true };
}

/* ---------- conversación → mensajes para la IA ---------- */
function aMensajes(historial) {
  const out = [];
  for (const h of historial) {
    const role = h.dir === 'in' ? 'user' : 'assistant';
    let text = h.texto || '';
    if (!text.trim()) continue;
    if (h.dir === 'in' && h.tipo && h.tipo !== 'text') text = `(El cliente ha enviado ${TIPOS[h.tipo] || h.tipo}; no puedes verlo ni escucharlo.) ${text}`;
    if (h.dir === 'out' && (h.autor === 'humano' || h.autor === 'panel')) text = `[Mensaje del equipo]: ${text}`;
    if (h.dir === 'out' && h.autor === 'sistema') text = `[Aviso automático enviado]: ${text}`;
    const last = out[out.length - 1];
    if (last && last.role === role) last.content += '\n' + text; else out.push({ role, content: text });
  }
  while (out.length && out[0].role !== 'user') out.shift();
  return out;
}

/* ---------- la IA con sus herramientas ---------- */
// modelos que aceptan output_config.effort (si AI_MODEL apunta a otro, se manda sin él)
const conEsfuerzo = (m: string) => /^claude-(fable|mythos)-5|^claude-opus-(5|4-[5-8])|^claude-sonnet-(5|4-6)/.test(String(m || ''));
async function responder({ tel, nombre, historial, deps, prueba = false }) {
  const messages = aMensajes(historial);
  if (!messages.length || messages[messages.length - 1].role !== 'user') return { texto: '', acciones: [] };
  const system = [
    { type: 'text', text: sistema(), cache_control: { type: 'ephemeral' } },
    { type: 'text', text: contexto({ ahora: deps.now(), nombre, prueba }) }
  ];
  const acciones = [];
  for (let vuelta = 0; vuelta < 5; vuelta++) {
    const modelo = deps.modelo || MODELO;
    const res = await deps.ai.messages({ model: modelo, max_tokens: 4000, ...(conEsfuerzo(modelo) ? { output_config: { effort: 'low' } } : {}), system, tools: HERRAMIENTAS, messages });
    if (res && (res.stop_reason === 'max_tokens' || res.stop_reason === 'refusal')) throw new Error('respuesta ' + res.stop_reason);
    const content = (res && res.content) || [];
    const usos = content.filter(c => c.type === 'tool_use');
    const texto = content.filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
    if (res.stop_reason !== 'tool_use' || !usos.length) return { texto, acciones };
    messages.push({ role: 'assistant', content });
    const resultados = [];
    for (const u of usos) {
      let out;
      try { out = await herramienta(u.name, u.input || {}, { tel, deps, prueba, acciones }); }
      catch (e) { out = { ok: false, error: String(e && e.message || e) }; }
      resultados.push({ type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out) });
    }
    messages.push({ role: 'user', content: resultados });
  }
  return { texto: '', acciones };
}

async function herramienta(nombre, input, { tel, deps, prueba, acciones }) {
  if (nombre === 'consultar_mi_viaje') {
    if (!tel) return { encontrado: false, nota: 'Prueba sin número: no hay a quién buscar.' };
    const r = await deps.db.cliente(tel);
    acciones.push({ tipo: 'consulta', encontrado: !!(r && r.encontrado) });
    return r || { encontrado: false };
  }
  if (nombre === 'crear_solicitud') {
    if (prueba) { acciones.push({ tipo: 'solicitud', ref: 'IB-PRUEBA', datos: input }); return { ok: true, ref: 'IB-PRUEBA', nota: 'Modo prueba: no se ha creado nada.' }; }
    const ref = await deps.db.crearSolicitud(tel, input);
    acciones.push({ tipo: 'solicitud', ref, datos: input });
    return { ok: true, ref };
  }
  if (nombre === 'avisar_equipo') {
    acciones.push({ tipo: 'aviso_equipo', clase: input.tipo, resumen: input.resumen });
    return { ok: true, nota: prueba ? 'Modo prueba: no se ha avisado a nadie.' : 'Aviso enviado al equipo. Sigue atendiendo con normalidad.' };
  }
  if (nombre === 'pasar_a_humano') {
    acciones.push({ tipo: 'humano', motivo: input.motivo, resumen: input.resumen });
    return { ok: true, nota: 'Hecho. Despídete en una frase y no sigas.' };
  }
  return { ok: false, error: 'herramienta desconocida' };
}

/* ---------- webhook de WhatsApp ---------- */
async function procesarWebhook(body, deps) {
  const hechos = [];
  for (const entry of (body && body.entry) || []) {
    for (const ch of entry.changes || []) {
      const v = ch.value || {};
      if (ch.field === 'messages' && Array.isArray(v.messages)) {
        const nombres = {}; (v.contacts || []).forEach(c => { nombres[telOf(c.wa_id)] = c.profile && c.profile.name; });
        for (const m of v.messages) hechos.push(await entrante(m, nombres[telOf(m.from)], deps));
      }
      if (ch.field === 'smb_message_echoes') {
        for (const m of v.message_echoes || v.messages || []) hechos.push(await eco(m, deps));
      }
    }
  }
  return hechos;
}

const iso = d => new Date(d).toISOString();
const AVISOS = { crear_grupo: 'Crear grupo', meter_en_grupo: 'Meter en grupo', ruta_enviada: 'Ruta enviada', otro: 'Aviso' };
const MOTIVOS = { pide_persona: 'Quiere hablar contigo', precio: 'Pregunta precio', pago_o_reserva: 'Pago o reserva', cambio_o_cancelacion: 'Cambio o cancelación', queja_o_problema: 'Queja o problema', no_lo_se: 'El asistente no sabía responder', otro: 'Te necesita' };
async function entrante(m, nombre, deps) {
  const { db, wa } = deps;
  const tel = telOf(m.from), ahora = deps.now();
  const { tipo, texto, noTexto, ignorar } = leerMensaje(m);
  if (ignorar) return 'reaccion';
  await db.asegurarChat(tel, nombre);
  const nuevo = await db.guardar({ wa_id: m.id, telefono: tel, dir: 'in', autor: 'cliente', tipo, texto });
  if (!nuevo) return 'duplicado';
  const chat = (await db.chat(tel)) || {};
  const patch = { ultimo_at: iso(ahora), ultimo_txt: texto.slice(0, 200), ultimo_in_at: iso(ahora), no_leidos: (chat.no_leidos || 0) + 1 };
  if (nombre && nombre !== chat.nombre) patch.nombre = nombre;
  // la pausa (porque contestó el equipo) caduca sola
  let pausado = chat.modo === 'humano' && (!chat.pausa_hasta || new Date(chat.pausa_hasta) > ahora);
  if (chat.modo === 'humano' && !pausado) { patch.modo = 'bot'; patch.pausa_hasta = null; }
  const cfg = (await db.config()) || { bot_activo: true, horas_pausa: 12 };
  if (!cfg.bot_activo || pausado) { patch.atencion = true; await db.actualizar(tel, patch); return 'para_bruno'; }
  await db.actualizar(tel, patch);
  if (wa.escribiendo) wa.escribiendo(m.id).catch(() => {});

  // audios, fotos…: la IA no los puede ver; se contesta una vez y se avisa al equipo
  if (noTexto) {
    const hist = await db.historial(tel, 6);
    const yaAvisado = hist.some(h => h.autor === 'bot' && /no puedo (escuchar|ver)/i.test(h.texto || '') && ahora - new Date(h.created_at) < 30 * 60e3);
    await db.actualizar(tel, { atencion: true, motivo: `Ha enviado ${TIPOS[tipo] || tipo}` });
    if (yaAvisado) return 'no_texto_silencio';
    const t = tipo === 'audio' || tipo === 'voice'
      ? '¡Hola! Soy el asistente de Iberail 🤖 Todavía no puedo escuchar audios. Si me lo escribes, te contesto al momento; si no, una persona del equipo lo escucha y te responde en cuanto pueda.'
      : `¡Gracias! Todavía no puedo ver ${TIPOS[tipo] || 'esto'}, así que se lo paso al equipo. Si me cuentas por escrito qué necesitas, te ayudo ya.`;
    await enviar(tel, t, 'bot', deps);
    return 'no_texto';
  }

  // si escribe varios mensajes seguidos, se contesta una vez a todos
  if (deps.esperaMs) {
    await deps.sleep(deps.esperaMs);
    if ((await db.ultimoEntrante(tel)) !== m.id) return 'agrupado';
  }
  const historial = await db.historial(tel, 60);
  // freno por si alguien abusa: como mucho 25 respuestas del asistente por hora en un mismo chat
  if (historial.filter(h => h.autor === 'bot' && ahora - new Date(h.created_at) < 3600e3).length >= 25) {
    await db.actualizar(tel, { atencion: true, motivo: 'Muchos mensajes seguidos: el asistente se ha parado en este chat' });
    return 'limite';
  }
  let r;
  try { r = await responder({ tel, nombre: patch.nombre || chat.nombre || nombre, historial: historial.slice(-24), deps }); }
  catch (e) {
    deps.log && deps.log('IA falló', e);
    await db.actualizar(tel, { atencion: true, motivo: 'El asistente no pudo responder' });
    return 'error_ia';
  }
  const humano = r.acciones.find(a => a.tipo === 'humano');
  let salida = paraWhatsApp(r.texto);
  if (!salida && humano) salida = 'Te paso con una persona del equipo, que te contesta por aquí en cuanto pueda 🙌';
  if (salida) for (const trozo of trocear(salida)) await enviar(tel, trozo, 'bot', deps, r.acciones.length ? { acciones: r.acciones } : null);
  const sol = r.acciones.find(a => a.tipo === 'solicitud');
  if (humano) await db.actualizar(tel, { modo: 'humano', pausa_hasta: iso(+ahora + (cfg.horas_pausa || 12) * 3600e3), atencion: true, motivo: `${MOTIVOS[humano.motivo] || 'Te necesita'}: ${humano.resumen || ''}`.slice(0, 300) });
  else {
    const partes = [];
    if (sol) partes.push(`Nueva solicitud ${sol.ref} creada por el asistente`);
    for (const a of r.acciones.filter(a => a.tipo === 'aviso_equipo')) partes.push(`${AVISOS[a.clase] || 'Aviso'}: ${a.resumen || ''}`);
    if (partes.length) await db.actualizar(tel, { atencion: true, motivo: partes.join(' · ').slice(0, 800) });
  }
  return humano ? 'respondido_y_pasado' : 'respondido';
}

// el equipo ha contestado desde la app del móvil: el bot se aparta de ese chat unas horas
async function eco(m, deps) {
  const { db } = deps;
  const tel = telOf(m.to), ahora = deps.now();
  if (!tel) return 'eco_sin_destino';
  const { tipo, texto, ignorar } = leerMensaje(m);
  if (ignorar) return 'reaccion';
  await db.asegurarChat(tel, null);
  const nuevo = await db.guardar({ wa_id: m.id, telefono: tel, dir: 'out', autor: 'humano', tipo, texto });
  if (!nuevo) return 'eco_duplicado';
  const cfg = (await db.config()) || { horas_pausa: 12 };
  await db.actualizar(tel, { modo: 'humano', pausa_hasta: iso(+ahora + (cfg.horas_pausa || 12) * 3600e3), atencion: false, no_leidos: 0, ultimo_at: iso(ahora), ultimo_txt: texto.slice(0, 200) });
  return 'eco_pausa';
}

async function enviar(tel, texto, autor, deps, meta) {
  const r = await deps.wa.texto(tel, texto);
  await deps.db.guardar({ wa_id: r && r.id, telefono: tel, dir: 'out', autor, tipo: 'text', texto, meta: meta || null });
  await deps.db.actualizar(tel, { ultimo_at: iso(deps.now()), ultimo_txt: texto.slice(0, 200) });
  return r;
}

/* ---------- acciones del panel (solo el equipo) ---------- */
async function accionPanel(body, deps) {
  const { db, wa } = deps, ahora = deps.now();
  if (body.action === 'enviar') {
    const tel = telOf(body.telefono), texto = String(body.texto || '').trim();
    if (!tel || !texto) return { ok: false, error: 'Falta el número o el texto.' };
    const chat = await db.chat(tel);
    if (!chat || !chat.ultimo_in_at || ahora - new Date(chat.ultimo_in_at) > 24 * 3600e3)
      return { ok: false, error: 'Han pasado más de 24 h desde su último mensaje: WhatsApp solo deja escribirle con una plantilla aprobada. Escríbele desde la app o espera a que te escriba.' };
    await enviar(tel, texto.slice(0, 4000), 'panel', deps);
    const cfg = (await db.config()) || { horas_pausa: 12 };
    await db.actualizar(tel, { modo: 'humano', pausa_hasta: iso(+ahora + (cfg.horas_pausa || 12) * 3600e3), atencion: false, no_leidos: 0 });
    return { ok: true };
  }
  if (body.action === 'aviso') {
    const aviso = await db.aviso(body.aviso_id);
    if (!aviso) return { ok: false, error: 'No encuentro ese aviso.' };
    const dest = await db.destinatarios(body.aviso_id);
    let enviados = 0; const fallos = [];
    for (const d of dest) {
      try {
        const r = await wa.plantilla(d.telefono, deps.plantillaAviso || 'aviso_viaje', [d.nombre || 'viajero', String(aviso.titulo).slice(0, 60)]);
        await db.asegurarChat(d.telefono, d.nombre);
        await db.guardar({ wa_id: r && r.id, telefono: d.telefono, dir: 'out', autor: 'sistema', tipo: 'template', texto: `Aviso: ${aviso.titulo}` });
        enviados++;
      } catch (e) { fallos.push({ nombre: d.nombre, error: String(e && e.message || e).slice(0, 160) }); }
    }
    return { ok: true, enviados, fallos, total: dest.length };
  }
  if (body.action === 'probar') {
    const hist = (body.historial || []).slice(-20).map(h => ({ dir: h.de === 'cliente' ? 'in' : 'out', autor: h.de === 'cliente' ? 'cliente' : 'bot', tipo: 'text', texto: h.texto }));
    hist.push({ dir: 'in', autor: 'cliente', tipo: 'text', texto: String(body.texto || '') });
    const r = await responder({ tel: telOf(body.telefono) || null, nombre: body.nombre || null, historial: hist, deps, prueba: true });
    const humano = r.acciones.find(a => a.tipo === 'humano');
    return { ok: true, respuesta: paraWhatsApp(r.texto) || (humano ? 'Te paso con una persona del equipo, que te contesta por aquí en cuanto pueda 🙌' : ''), acciones: r.acciones };
  }
  return { ok: false, error: 'Acción desconocida.' };
}

/* ===== index.ts ===== */

const env = (k: string, d = '') => Deno.env.get(k) ?? d;
const PROVEEDOR = env('WA_PROVIDER', 'meta');                 // 'meta' (API de Meta directa), 'dualhook' o '360dialog'
const WA_TOKEN = env('WA_TOKEN');                              // token de Meta (usuario del sistema), API key de Dualhook (dh_live_...) o de 360dialog
const WA_PHONE_ID = env('WA_PHONE_ID');                        // identificador del número (Meta y Dualhook)
const GRAPH = PROVEEDOR === 'dualhook'
  ? `https://api.dualhook.com/${env('WA_GRAPH_VERSION', 'v25.0')}`
  : `https://graph.facebook.com/${env('WA_GRAPH_VERSION', 'v23.0')}`;
const sb = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS' };
const json = (o: unknown, status = 200) => new Response(JSON.stringify(o), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });

/* ---------- WhatsApp ---------- */
async function waPost(body: Record<string, unknown>) {
  const url = PROVEEDOR === '360dialog' ? 'https://waba-v2.360dialog.io/messages' : `${GRAPH}/${WA_PHONE_ID}/messages`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (PROVEEDOR === '360dialog') headers['D360-API-KEY'] = WA_TOKEN; else headers['Authorization'] = `Bearer ${WA_TOKEN}`;
  const r = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ messaging_product: 'whatsapp', ...body }) });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(`WhatsApp ${r.status}: ${JSON.stringify(out).slice(0, 300)}`);
  return out;
}
const wa = {
  texto: async (to: string, body: string) => { const o = await waPost({ recipient_type: 'individual', to, type: 'text', text: { body, preview_url: true } }); return { id: o?.messages?.[0]?.id ?? null }; },
  plantilla: async (to: string, name: string, params: string[]) => {
    const o = await waPost({ to, type: 'template', template: { name, language: { code: env('WA_TEMPLATE_LANG', 'es') }, components: [{ type: 'body', parameters: params.map(text => ({ type: 'text', text })) }] } });
    return { id: o?.messages?.[0]?.id ?? null };
  },
  // marca como leído y enseña «escribiendo…» mientras piensa la IA
  escribiendo: (id: string) => waPost({ status: 'read', message_id: id, typing_indicator: { type: 'text' } })
};

/* ---------- IA (Anthropic) ---------- */
const ai = {
  messages: async (body: Record<string, unknown>) => {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
    const out = await r.json();
    if (!r.ok) throw new Error(`IA ${r.status}: ${JSON.stringify(out).slice(0, 300)}`);
    return out;
  }
};

/* ---------- base de datos ---------- */
const db = {
  config: async () => (await sb.from('wa_config').select('*').eq('id', 1).maybeSingle()).data,
  chat: async (tel: string) => (await sb.from('wa_chats').select('*').eq('telefono', tel).maybeSingle()).data,
  asegurarChat: async (tel: string, nombre: string | null) => {
    await sb.from('wa_chats').upsert({ telefono: tel, ...(nombre ? { nombre } : {}) }, { onConflict: 'telefono', ignoreDuplicates: true });
  },
  actualizar: async (tel: string, patch: Record<string, unknown>) => { await sb.from('wa_chats').update(patch).eq('telefono', tel); },
  guardar: async (row: Record<string, unknown>) => {
    const { error } = await sb.from('wa_mensajes').insert(row);
    if (error && (error.code === '23505' || /duplicate/i.test(error.message))) return false;
    if (error) throw error;
    return true;
  },
  historial: async (tel: string, n: number) => ((await sb.from('wa_mensajes').select('dir,autor,tipo,texto,created_at').eq('telefono', tel).order('created_at', { ascending: false }).limit(n)).data || []).reverse(),
  ultimoEntrante: async (tel: string) => (await sb.from('wa_mensajes').select('wa_id').eq('telefono', tel).eq('dir', 'in').order('created_at', { ascending: false }).limit(1).maybeSingle()).data?.wa_id,
  cliente: async (tel: string) => { const { data, error } = await sb.rpc('wa_cliente', { tel }); if (error) throw error; return data; },
  crearSolicitud: async (tel: string, datos: unknown) => { const { data, error } = await sb.rpc('wa_crear_solicitud', { tel, datos }); if (error) throw error; return data; },
  aviso: async (id: number) => (await sb.from('avisos').select('*').eq('id', id).maybeSingle()).data,
  destinatarios: async (id: number) => { const { data, error } = await sb.rpc('wa_destinatarios', { aviso: id }); if (error) throw error; return data || []; }
};

const deps = {
  db, wa, ai,
  now: () => new Date(),
  sleep: (ms: number) => new Promise(r => setTimeout(r, ms)),
  esperaMs: Number(env('BOT_ESPERA_MS', '4000')),
  modelo: env('AI_MODEL', MODELO),
  plantillaAviso: env('WA_TEMPLATE_AVISO', 'aviso_viaje'),
  log: (...a: unknown[]) => console.error(...a)
};

/* ---------- seguridad del webhook ---------- */
// comparación en tiempo constante (no da pistas de cuántos caracteres coinciden)
function igual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
async function firmaOk(req: Request, raw: string) {
  const secreto = env('WA_APP_SECRET');
  if (!secreto) return false;
  const sig = req.headers.get('x-hub-signature-256') || '';
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(raw)));
  const hex = 'sha256=' + [...mac].map(b => b.toString(16).padStart(2, '0')).join('');
  return igual(hex, sig);
}
async function esEquipo(req: Request) {
  const jwt = (req.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
  if (!jwt) return false;
  const { data } = await sb.auth.getUser(jwt);
  if (!data?.user) return false;
  const { data: adm } = await sb.from('admins').select('user_id').eq('user_id', data.user.id).maybeSingle();
  return !!adm;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  const url = new URL(req.url);
  // verificación del webhook (Meta la hace una vez al configurarlo)
  if (req.method === 'GET') {
    if (url.searchParams.get('hub.mode') === 'subscribe' && url.searchParams.get('hub.verify_token') === env('WA_VERIFY_TOKEN'))
      return new Response(url.searchParams.get('hub.challenge') || '', { status: 200 });
    return new Response('Iberail WhatsApp OK', { status: 200 });
  }
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const raw = await req.text();
  let body: any = {};
  try { body = JSON.parse(raw); } catch { return new Response('bad json', { status: 400 }); }

  // mensajes que llegan de WhatsApp
  if (body.object === 'whatsapp_business_account' || Array.isArray(body.entry)) {
    // Meta firma con WA_APP_SECRET; 360dialog y Dualhook no firman, así que ahí basta la clave en la URL (?k=WA_WEBHOOK_KEY)
    const clave = env('WA_WEBHOOK_KEY'), secreto = env('WA_APP_SECRET');
    if (!clave && !secreto) { console.error('webhook sin proteger: pon WA_APP_SECRET (Meta) o WA_WEBHOOK_KEY en los secretos de la función'); return new Response('webhook sin proteger', { status: 503 }); }
    if (clave && !igual(url.searchParams.get('k') || '', clave)) return new Response('forbidden', { status: 403 });
    if (secreto && !(await firmaOk(req, raw))) return new Response('bad signature', { status: 401 });
    // se contesta a WhatsApp al momento y el trabajo sigue en segundo plano
    const tarea = procesarWebhook(body, deps).catch(e => console.error('webhook', e));
    // @ts-ignore EdgeRuntime existe en Supabase
    if (typeof EdgeRuntime !== 'undefined' && EdgeRuntime.waitUntil) EdgeRuntime.waitUntil(tarea); else await tarea;
    return new Response('ok', { status: 200 });
  }

  // acciones del panel de Iberail (solo el equipo)
  if (body.action) {
    if (!(await esEquipo(req))) return json({ ok: false, error: 'Solo el equipo de Iberail.' }, 403);
    try { return json(await accionPanel(body, deps)); }
    catch (e) { return json({ ok: false, error: String((e as Error)?.message || e).slice(0, 300) }, 500); }
  }
  return json({ ok: false, error: 'Petición desconocida.' }, 400);
});
