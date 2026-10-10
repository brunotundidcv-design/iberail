/* Iberail — pases Interrail Global que recomienda el planificador («¿Qué pase te conviene?», planner.js · paintPase).
   Tipos de pase según la oferta de Interrail (revisar si cambia). PRECIOS: rellenar con los oficiales vigentes, en euros,
   2.ª clase, por persona. Mientras un precio esté en null, el planificador recomienda el pase sin enseñar precio
   («El precio exacto va en tu presupuesto»). No poner precios inventados ni aproximados. */
window.IB_PASES = {
  actualizado: '',            // fecha en que se copiaron los precios, p. ej. '2026-10-10'
  // flexibles: X días de viaje en tren dentro de un periodo
  flexibles: [
    { dias: 4,  periodo: '1 mes',   maxDias: 31, joven: null, adulto: null },
    { dias: 5,  periodo: '1 mes',   maxDias: 31, joven: null, adulto: null },
    { dias: 7,  periodo: '1 mes',   maxDias: 31, joven: null, adulto: null },
    { dias: 10, periodo: '2 meses', maxDias: 61, joven: null, adulto: null },
    { dias: 15, periodo: '2 meses', maxDias: 61, joven: null, adulto: null }
  ],
  // continuos: todos los días seguidos que quieras
  continuos: [
    { nombre: '15 días seguidos', maxDias: 15, joven: null, adulto: null },
    { nombre: '22 días seguidos', maxDias: 22, joven: null, adulto: null },
    { nombre: '1 mes seguido',    maxDias: 31, joven: null, adulto: null },
    { nombre: '2 meses seguidos', maxDias: 61, joven: null, adulto: null },
    { nombre: '3 meses seguidos', maxDias: 92, joven: null, adulto: null }
  ]
};
