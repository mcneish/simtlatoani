import type { BuildingId } from '../sim/buildings';
import type { ResourceId } from '../sim/state';

export function fmt(n: number): string {
  return Math.floor(n).toLocaleString('es-MX');
}

const RES_LOWER: Record<ResourceId, string> = { maiz: 'maíz', madera: 'madera', piedra: 'piedra', cacao: 'cacao' };

export const t = {
  title: 'SimTlatoani',
  tagline: 'Funda la gran México-Tenochtitlan en medio del lago de Texcoco',
  newGame: 'Nueva partida',
  continueGame: 'Continuar',
  howToPlay: 'Cómo jugar',
  back: 'Volver',
  resume: 'Reanudar',
  saveGame: 'Guardar partida',
  saved: 'Partida guardada',
  autosaved: 'Partida guardada automáticamente',
  quitToTitle: 'Salir al menú principal',
  menu: 'Menú',
  paused: 'En pausa',
  keepPlaying: 'Seguir jugando',
  date: (day: number) => `Año ${Math.floor(day / 365) + 1} · Día ${(day % 365) + 1}`,
  resources: { maiz: 'Maíz', madera: 'Madera', piedra: 'Piedra', cacao: 'Cacao' } as Record<ResourceId, string>,
  resourceLower: RES_LOWER,
  population: 'Población',
  housing: 'Vivienda',
  workers: 'Trabajadores',
  favor: 'Favor divino',
  goal: (pct: number) => `Meta: 2,500 habitantes (${pct}%)`,
  perDay: 'por día',
  speed: { pause: 'Pausa (Espacio)', x1: 'Velocidad normal', x3: 'Rápido', x10: 'Muy rápido' },
  buildings: {
    calli: {
      name: 'Calli',
      desc: 'Casa de adobe donde viven 25 personas.',
      rule: 'Se construye en la isla o en el pantano.',
    },
    chinampa: {
      name: 'Chinampa',
      desc: 'Jardín sobre el agua que produce 3 de maíz al día.',
      rule: 'Se construye en el pantano o en aguas someras.',
    },
    calzada: {
      name: 'Calzada',
      desc: 'Camino de piedra sobre el lago. Une la isla con tierra firme para traer madera y piedra.',
      rule: 'Se construye sobre el agua o el pantano.',
    },
    lenadores: {
      name: 'Leñadores',
      desc: 'Campamento que produce 2 de madera al día.',
      rule: 'Se construye en el bosque de tierra firme. Necesita una calzada hasta la isla.',
    },
    cantera: {
      name: 'Cantera',
      desc: 'Produce 1.5 de piedra al día.',
      rule: 'Se construye en las rocas de tierra firme. Necesita una calzada hasta la isla.',
    },
    tianguis: {
      name: 'Tianguis',
      desc: 'Mercado que cambia el maíz sobrante por cacao (4 de maíz → 2 de cacao al día). Siempre guarda 100 de maíz de reserva.',
      rule: 'Se construye en la isla.',
    },
    teocalli: {
      name: 'Teocalli',
      desc: 'Templo que aumenta el favor divino.',
      rule: 'Se construye en la isla.',
    },
    albarradon: {
      name: 'Albarradón',
      desc: 'Dique contra las inundaciones. Con 12 tramos, las chinampas quedan protegidas.',
      rule: 'Se construye sobre el agua.',
    },
  } as Record<BuildingId, { name: string; desc: string; rule: string }>,
  demolish: {
    name: 'Demoler',
    desc: 'Derriba un edificio. Los materiales no se recuperan.',
    rule: 'También puedes demoler con clic derecho.',
  },
  cost: 'Costo',
  free: 'Gratis',
  workersNeeded: (n: number) => `Necesita ${n} trabajadores`,
  housingFor: (n: number) => `Vivienda para ${n} personas`,
  errors: {
    bounds: 'Fuera del mapa',
    occupied: 'Ya hay algo construido aquí',
    nothing: 'No hay nada que demoler aquí',
    funds: (missing: Partial<Record<ResourceId, number>>) =>
      'Faltan recursos: ' +
      Object.entries(missing)
        .map(([r, n]) => `${n} de ${RES_LOWER[r as ResourceId]}`)
        .join(', '),
  },
  terrain: ['Aguas profundas', 'Aguas someras', 'Pantano', 'Isla', 'Tierra firme', 'Bosque', 'Rocas'],
  notConnectedMark: 'Sin calzada',
  warnings: {
    notConnected: 'Sin calzada: la madera y la piedra de tierra firme no llegan a la ciudad',
    famine: '¡Hambruna! Construye más chinampas',
    lowFavor: 'Los dioses están inquietos: construye teocalli',
    noHousing: 'La ciudad está llena: construye más calli',
    fewWorkers: (pct: number) => `Faltan trabajadores: los edificios producen al ${pct}%`,
    drought: (d: number) => `Sequía: las chinampas rinden la mitad (${d} días)`,
    lowFood: 'El maíz se está acabando',
  },
  events: {
    tribute: (m: number, p: number, c: number) =>
      `Llegó el tributo de los pueblos sometidos: +${m} de madera, +${p} de piedra, +${c} de cacao`,
    flood: (n: number) => `¡Inundación! El lago creció y destruyó ${n} construcciones`,
    floodNoDamage: '¡Inundación! El lago creció, pero no hubo daños',
    floodBlocked: 'El lago creció, pero el albarradón contuvo las aguas',
    drought: '¡Sequía! Las chinampas rendirán la mitad durante 30 días',
    droughtEnd: 'Volvieron las lluvias: terminó la sequía',
    omenEagle: 'Un águila devoró una serpiente sobre un nopal: los dioses sonríen (+favor)',
    omenHarvest: (n: number) => `Cosecha abundante: +${n} de maíz`,
    omenComet: 'Un cometa cruzó el cielo de día: mal presagio (−favor)',
    omenLake: 'Las aguas del lago hirvieron sin viento: mal presagio (−favor)',
    famine: '¡Hambruna! No alcanza el maíz y la gente abandona la ciudad',
    famineEnd: 'Terminó la hambruna',
    lowFavor: 'Los sacerdotes advierten: el favor de los dioses es muy bajo',
    milestone: (n: number) => `La ciudad alcanzó ${fmt(n)} habitantes`,
  },
  welcome: 'Bienvenido, tlatoani. Construye calli y chinampas, y une la isla con tierra firme mediante una calzada.',
  toolHint: (name: string) => `${name}: clic o arrastra para construir · clic derecho para demoler · Esc para cancelar`,
  demolishHint: 'Demoler: clic o arrastra sobre los edificios · Esc para cancelar',
  win: {
    title: '¡Has fundado la gran ciudad!',
    body: (day: number, pop: number) =>
      `En el año ${Math.floor(day / 365) + 1}, ${fmt(pop)} personas viven en México-Tenochtitlan. Tu nombre será recordado por generaciones.`,
  },
  lose: {
    favor: {
      title: 'Los dioses han abandonado Tenochtitlan',
      body: 'El favor divino llegó a cero. Sin la protección de los dioses, el pueblo abandona la isla.',
    },
    population: {
      title: 'La ciudad ha quedado desierta',
      body: 'Ya no queda nadie en la isla.',
    },
    survived: (day: number) => `Tu reinado duró ${fmt(day)} días.`,
  },
  helpTitle: 'Cómo jugar',
  help: [
    '<b>Meta:</b> alcanza 2,500 habitantes y funda la gran México-Tenochtitlan.',
    '<b>Calli</b> da vivienda y las <b>chinampas</b> dan maíz. Cada persona come maíz todos los días: si se acaba, llega la hambruna.',
    'La <b>madera</b> y la <b>piedra</b> vienen de tierra firme. Pon <b>leñadores</b> en el bosque y <b>canteras</b> en las rocas, y une la isla con la orilla con una <b>calzada</b>.',
    'Cada edificio necesita <b>trabajadores</b>. Si no hay suficiente gente, todo produce menos.',
    'El <b>tianguis</b> cambia el maíz sobrante por <b>cacao</b>, que necesitas para los <b>teocalli</b>.',
    'Los teocalli mantienen el <b>favor divino</b>. Entre más crece la ciudad, más templos necesita. Si el favor llega a cero, pierdes.',
    'Cuidado con las <b>inundaciones</b>: un <b>albarradón</b> de 12 tramos protege tus chinampas. Cada 90 días llega tributo.',
    '<b>Controles:</b> clic para construir (arrastra para construir varios), clic derecho para demoler, arrastra el mapa o usa WASD/flechas para moverte, rueda del ratón para acercar, Espacio para pausar, teclas 1–8 para elegir edificio, 9 para demoler, Esc para cancelar.',
  ],
};
