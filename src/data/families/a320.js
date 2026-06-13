import { ENGINES } from '../engines.js'

/**
 * Airbus A320 family — the first fully built-out family and the template every
 * other family follows. Specs are nominal public figures; safety figures are
 * attributed in each variant's `safety.sources`.
 */

export const a320Family = {
  id: 'a320',
  manufacturer: 'Airbus',
  name: 'A320 Family',
  tagline: 'The narrowbody that redefined short- and medium-haul flying.',
  intro:
    'Launched in 1984 and entering service in 1988, the A320 was the first ' +
    'civil airliner with a digital fly-by-wire flight control system and a ' +
    'sidestick. The family stretched and shrank around the original A320 to ' +
    'cover 100–240 seats, and the 2010s "neo" re-engining gave it a second ' +
    'life. It is one of the best-selling airliner families in history.',
}

export const a320Aircraft = [
  {
    id: 'a318',
    name: 'Airbus A318',
    familyId: 'a320',
    status: 'retired',
    firstFlightYear: 2002,
    eisYear: 2003,
    built: 80,
    model: '',
    engines: [ENGINES['cfm56-5b'], ENGINES['pw1100g']],
    dimensions: {
      lengthM: 31.44,
      wingspanM: 35.8,
      heightM: 12.51,
      fuselageDiaM: 3.95,
      mtowKg: 68000,
      rangeKm: 5750,
      cruiseMach: 0.78,
      ceilingM: 12500,
      paxTypical: 107,
      paxMax: 132,
    },
    timeline: [
      { date: '1999', label: 'Programme launched as the "baby Airbus".' },
      { date: '2002-01', label: 'First flight.' },
      { date: '2003', label: 'Entry into service.' },
      { date: '2013', label: 'Production effectively ended — lowest seller of the family.' },
    ],
    safety: {
      hullLossRate: null,
      fatalEvents: 0,
      totalLosses: 0,
      risk: 'low',
      sources: ['Aviation Safety Network hull-loss database (public)'],
      notes: 'Small fleet; no hull-loss accidents recorded as of the last public review.',
    },
    summary:
      'The shortest member of the family, aimed at thin routes. Limited sales ' +
      'meant it was the first variant retired from production.',
  },
  {
    id: 'a319',
    name: 'Airbus A319',
    familyId: 'a320',
    status: 'in-service',
    firstFlightYear: 1995,
    eisYear: 1996,
    built: 1500,
    model: '',
    engines: [ENGINES['cfm56-5b'], ENGINES['v2500'], ENGINES['leap-1a'], ENGINES['pw1100g']],
    dimensions: {
      lengthM: 33.84,
      wingspanM: 35.8,
      heightM: 11.76,
      fuselageDiaM: 3.95,
      mtowKg: 75500,
      rangeKm: 6940,
      cruiseMach: 0.78,
      ceilingM: 12500,
      paxTypical: 124,
      paxMax: 156,
    },
    timeline: [
      { date: '1995-08', label: 'First flight.' },
      { date: '1996', label: 'Entry into service.' },
      { date: '2011', label: 'A319neo offered with new engines.' },
    ],
    safety: {
      hullLossRate: 0.16,
      fatalEvents: 1,
      totalLosses: 3,
      risk: 'low',
      sources: ['Aviation Safety Network', 'Boeing Statistical Summary methodology (for rate framing)'],
      notes: 'Among the safest narrowbodies by hull-loss rate per million departures.',
    },
    summary:
      'A shortened A320 with the same wing and systems, popular with low-cost ' +
      'carriers and as a corporate-jet base (ACJ319).',
  },
  {
    id: 'a320',
    name: 'Airbus A320',
    familyId: 'a320',
    status: 'in-production',
    firstFlightYear: 1987,
    eisYear: 1988,
    built: 4800,
    model: '/models/a320.glb',
    engines: [ENGINES['cfm56-5b'], ENGINES['v2500'], ENGINES['leap-1a'], ENGINES['pw1100g']],
    dimensions: {
      lengthM: 37.57,
      wingspanM: 35.8,
      heightM: 11.76,
      fuselageDiaM: 3.95,
      mtowKg: 78000,
      rangeKm: 6300,
      cruiseMach: 0.78,
      ceilingM: 12500,
      paxTypical: 150,
      paxMax: 194,
    },
    timeline: [
      { date: '1984-03', label: 'Programme launched.' },
      { date: '1987-02', label: 'First flight.' },
      { date: '1988', label: 'Entry into service with Air France.' },
      { date: '2016', label: 'A320neo enters service with new engines and sharklets.' },
    ],
    safety: {
      hullLossRate: 0.12,
      fatalEvents: 12,
      totalLosses: 20,
      risk: 'low',
      sources: ['Aviation Safety Network hull-loss database (public)'],
      notes:
        'Extremely large fleet and flight-hour base; very low loss rate per ' +
        'departure. Figures are lifetime cumulative across all operators.',
    },
    summary:
      'The baseline and best-known variant — the first fly-by-wire narrowbody ' +
      'and the reference against which the rest of the family is sized.',
  },
  {
    id: 'a321',
    name: 'Airbus A321',
    familyId: 'a320',
    status: 'in-production',
    firstFlightYear: 1993,
    eisYear: 1994,
    built: 3000,
    model: '',
    engines: [ENGINES['cfm56-5b'], ENGINES['v2500'], ENGINES['leap-1a'], ENGINES['pw1100g']],
    dimensions: {
      lengthM: 44.51,
      wingspanM: 35.8,
      heightM: 11.76,
      fuselageDiaM: 3.95,
      mtowKg: 93500,
      rangeKm: 5950,
      cruiseMach: 0.78,
      ceilingM: 12500,
      paxTypical: 185,
      paxMax: 244,
    },
    timeline: [
      { date: '1993-03', label: 'First flight (stretched A320).' },
      { date: '1994', label: 'Entry into service.' },
      { date: '2017', label: 'A321neo enters service; becomes the family best-seller.' },
    ],
    safety: {
      hullLossRate: 0.09,
      fatalEvents: 2,
      totalLosses: 5,
      risk: 'low',
      sources: ['Aviation Safety Network hull-loss database (public)'],
      notes: 'The largest of the conventional variants; strong safety record.',
    },
    summary:
      'The stretched, highest-capacity member. The neo version became the ' +
      'commercial centre of gravity for the whole family.',
  },
  {
    id: 'a321xlr',
    name: 'Airbus A321XLR',
    familyId: 'a320',
    status: 'in-service',
    firstFlightYear: 2022,
    eisYear: 2024,
    built: 30,
    model: '',
    engines: [ENGINES['leap-1a'], ENGINES['pw1100g']],
    dimensions: {
      lengthM: 44.51,
      wingspanM: 35.8,
      heightM: 11.76,
      fuselageDiaM: 3.95,
      mtowKg: 101000,
      rangeKm: 8700,
      cruiseMach: 0.78,
      ceilingM: 12500,
      paxTypical: 180,
      paxMax: 220,
    },
    timeline: [
      { date: '2018', label: 'Launched at Farnborough as an "Xtra Long Range" A321neo.' },
      { date: '2022-06', label: 'First flight.' },
      { date: '2024-11', label: 'Entry into service with Iberia.' },
    ],
    safety: {
      hullLossRate: null,
      fatalEvents: 0,
      totalLosses: 0,
      risk: 'low',
      sources: ['Aviation Safety Network (new type, limited service history)'],
      notes:
        'Newest variant; too little service history for a statistically ' +
        'meaningful rate. A rear centre fuel tank extends range to transatlantic.',
    },
    summary:
      'A long-range derivative that lets a single-aisle jet fly thin ' +
      'transatlantic routes previously needing a widebody.',
  },
]
