import { ENGINES } from '../engines.js'

/**
 * Airbus A300 / A310 — the aircraft that started Airbus. The A300 was the
 * world's first twin-engine widebody (first flight 1972); the A310 is a shorter,
 * new-technology derivative. Together they pioneered ETOPS twin-jet long-haul,
 * the two-crew widebody cockpit and the first carbon-fibre fin box.
 *
 * Specs are nominal public figures (Airbus, Wikipedia, type spec sheets);
 * safety figures are attributed in each variant's `safety.sources`.
 */

export const a300Family = {
  id: 'a300',
  manufacturer: 'Airbus',
  name: 'A300 / A310',
  tagline: "Airbus's first aircraft — the original wide-body twinjet.",
  intro:
    'The A300 launched Airbus in 1969 and first flew in 1972 as the world\'s ' +
    'first twin-engine widebody — smaller and more economical than the three- ' +
    'engine DC-10 and TriStar. It pioneered ETOPS twin-jet long-haul (1977) and ' +
    'the two-crew widebody cockpit (1982). The shorter A310 followed in 1982 with ' +
    'new-technology wings and the first carbon-fibre fin box. Between them they ' +
    'built the foundation — the fuselage cross-section, the ETOPS case and the ' +
    'digital cockpit — that every later Airbus widebody inherited.',
}

export const a300Aircraft = [
  {
    id: 'a300b4',
    name: 'Airbus A300B4',
    familyId: 'a300',
    status: 'retired',
    firstFlightYear: 1974,
    eisYear: 1974,
    built: 248,
    model: '/models/a300b4.glb',
    engines: [ENGINES['cf6-80c2'], ENGINES['jt9d']],
    dimensions: {
      lengthM: 53.62,
      wingspanM: 44.84,
      heightM: 16.53,
      fuselageDiaM: 5.64,
      mtowKg: 165000,
      rangeKm: 5375,
      cruiseMach: 0.8,
      ceilingM: 12200,
      paxTypical: 250,
      paxMax: 336,
    },
    timeline: [
      { date: '1969-05', label: 'Airbus founded to build the A300 — its first aircraft.' },
      { date: '1972-10', label: 'First flight of the A300B1 in Toulouse.' },
      { date: '1974-12', label: 'Longer-range A300B4 first flew; entered service.' },
      { date: '1977', label: 'First aircraft to receive ETOPS certification.' },
    ],
    safety: {
      hullLossRate: 0.46,
      fatalEvents: 11,
      totalLosses: 20,
      risk: 'moderate',
      sources: ['AirSafe.com fatal-event rate', 'Aviation Safety Network', 'Wikipedia: Airbus A300'],
      notes:
        'An early-1970s design with a higher loss rate than modern types, in line ' +
        'with its generation. Its ETOPS certification opened long over-water routes ' +
        'to twin-jets for the first time.',
    },
    summary:
      'The medium/long-range production A300 and the aircraft that founded Airbus ' +
      '— the world\'s first widebody twinjet.',
  },
  {
    id: 'a300-600',
    name: 'Airbus A300-600',
    familyId: 'a300',
    status: 'in-service',
    firstFlightYear: 1983,
    eisYear: 1984,
    built: 313,
    model: '/models/a300-600.glb',
    engines: [ENGINES['cf6-80c2'], ENGINES['pw4000-100']],
    dimensions: {
      lengthM: 54.08,
      wingspanM: 44.84,
      heightM: 16.62,
      fuselageDiaM: 5.64,
      mtowKg: 170500,
      rangeKm: 7500,
      cruiseMach: 0.8,
      ceilingM: 12200,
      paxTypical: 266,
      paxMax: 361,
    },
    timeline: [
      { date: '1983', label: 'Advanced A300-600 first flight, with the A310\'s tail and cockpit.' },
      { date: '1984', label: 'Entry into service.' },
      { date: '2001-11', label: 'American 587 lost after the fin separated following rudder over-use (265 fatalities).' },
    ],
    safety: {
      hullLossRate: 0.6,
      fatalEvents: 4,
      totalLosses: 8,
      risk: 'moderate',
      sources: ['Aviation Safety Network', 'NTSB AA587 report', 'Wikipedia: Airbus A300'],
      notes:
        'The modernised A300. Its record includes American 587 (2001), where ' +
        'excessive rudder inputs overloaded and separated the composite fin — a ' +
        'landmark case in pilot-training and rudder-design guidance. Still widely ' +
        'flown as a freighter (notably by FedEx and UPS).',
    },
    summary:
      'The advanced, modernised A300 — new tail, two-crew glass cockpit and a ' +
      'long second life as a dedicated freighter.',
  },
  {
    id: 'a310-200',
    name: 'Airbus A310-200',
    familyId: 'a300',
    status: 'retired',
    firstFlightYear: 1982,
    eisYear: 1983,
    built: 85,
    model: '/models/a310-200.glb',
    engines: [ENGINES['cf6-80c2'], ENGINES['jt9d']],
    dimensions: {
      lengthM: 46.66,
      wingspanM: 43.89,
      heightM: 15.8,
      fuselageDiaM: 5.64,
      mtowKg: 142000,
      rangeKm: 6800,
      cruiseMach: 0.8,
      ceilingM: 12500,
      paxTypical: 220,
      paxMax: 280,
    },
    timeline: [
      { date: '1978-07', label: 'Launched as the A300B10 with Swissair and Lufthansa orders.' },
      { date: '1982-04', label: 'First flight of the shorter A310.' },
      { date: '1983', label: 'Entry into service; production ended 1988.' },
    ],
    safety: {
      hullLossRate: 0.4,
      fatalEvents: 3,
      totalLosses: 6,
      risk: 'moderate',
      sources: ['Aviation Safety Network', 'Wikipedia: Airbus A310'],
      notes:
        'The shorter, new-wing derivative. A small early production run; loss rate ' +
        'is typical of its 1980s generation.',
    },
    summary:
      'A shortened, new-technology A300 with a smaller wing and a two-crew ' +
      'cockpit — sized for thinner widebody routes.',
  },
  {
    id: 'a310-300',
    name: 'Airbus A310-300',
    familyId: 'a300',
    status: 'in-service',
    firstFlightYear: 1985,
    eisYear: 1985,
    built: 170,
    model: '/models/a310-300.glb',
    engines: [ENGINES['cf6-80c2'], ENGINES['pw4000-100']],
    dimensions: {
      lengthM: 46.66,
      wingspanM: 43.89,
      heightM: 15.8,
      fuselageDiaM: 5.64,
      mtowKg: 164000,
      rangeKm: 9540,
      cruiseMach: 0.8,
      ceilingM: 12500,
      paxTypical: 220,
      paxMax: 280,
    },
    timeline: [
      { date: '1985-07', label: 'First flight of the extended-range -300.' },
      { date: '1985-12', label: 'Entered service with Swissair — first airliner with a carbon-fibre fin box.' },
    ],
    safety: {
      hullLossRate: 0.4,
      fatalEvents: 3,
      totalLosses: 7,
      risk: 'moderate',
      sources: ['Aviation Safety Network', 'Wikipedia: Airbus A310'],
      notes:
        'The extended-range A310 and the standard production version, with trim- ' +
        'tank fuel for true intercontinental range. Still used by military and ' +
        'freight operators.',
    },
    summary:
      'The long-range A310 — extra fuel, higher weights and the first carbon-fibre ' +
      'tail box, giving a small widebody genuine intercontinental legs.',
  },
]
