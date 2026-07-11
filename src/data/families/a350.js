import { ENGINES } from '../engines.js'

/**
 * Airbus A350 family — the clean-sheet, carbon-fibre "eXtra Wide Body" long-haul
 * twinjet, powered exclusively by the Rolls-Royce Trent XWB. Two variants: the
 * baseline -900 and the 7-metre-longer -1000. Recognisable by its curved
 * wingtips and the black "flying-V" mask around the cockpit windows.
 *
 * Specs are nominal public figures (Airbus, Wikipedia); safety figures are
 * attributed in each variant's `safety.sources`.
 */

export const a350Family = {
  id: 'a350',
  manufacturer: 'Airbus',
  name: 'A350 Family',
  tagline: 'Carbon-fibre long-haul widebody (A350-900 / -1000).',
  intro:
    'Redesigned in 2006 as a clean-sheet "eXtra Wide Body" to answer the Boeing ' +
    '787 and 777, the A350 is the first Airbus built largely from carbon-fibre ' +
    'composite. It first flew in 2013 and entered service with Qatar Airways in ' +
    '2015. A nine-abreast composite fuselage, curved wingtips and the exclusive ' +
    'Rolls-Royce Trent XWB give it class-leading long-haul efficiency; the ' +
    'ultra-long-range -900ULR flies the world\'s longest scheduled flights.',
}

export const a350Aircraft = [
  {
    id: 'a350-900',
    name: 'Airbus A350-900',
    familyId: 'a350',
    status: 'in-production',
    firstFlightYear: 2013,
    eisYear: 2015,
    built: 560,
    model: '/models/a350-900.glb',
    engines: [ENGINES['trent-xwb']],
    dimensions: {
      lengthM: 66.8,
      wingspanM: 64.75,
      heightM: 17.05,
      fuselageDiaM: 5.96,
      mtowKg: 283000,
      rangeKm: 15740,
      cruiseMach: 0.85,
      ceilingM: 13100,
      paxTypical: 325,
      paxMax: 440,
    },
    timeline: [
      { date: '2006-12', label: 'Relaunched as the clean-sheet A350 XWB.' },
      { date: '2013-06', label: 'First flight from Toulouse.' },
      { date: '2015-01', label: 'Entry into service with Qatar Airways.' },
      { date: '2024-01', label: 'First hull loss (JAL runway collision at Haneda); all 379 aboard evacuated safely.' },
    ],
    safety: {
      hullLossRate: null,
      fatalEvents: 0,
      totalLosses: 1,
      risk: 'low',
      sources: ['Aviation Safety Network', 'Wikipedia: Airbus A350'],
      notes:
        'An excellent safety record with no A350 passenger fatalities. Its only ' +
        'hull loss — the January 2024 Haneda runway collision — saw all 379 aboard ' +
        'the A350 evacuate; the carbon-fibre fuselage kept the cabin survivable.',
    },
    summary:
      'The baseline and best-selling variant — a nine-abreast composite twinjet ' +
      'that reset the efficiency bar for long-haul flying.',
  },
  {
    id: 'a350-1000',
    name: 'Airbus A350-1000',
    familyId: 'a350',
    status: 'in-production',
    firstFlightYear: 2016,
    eisYear: 2018,
    built: 150,
    model: '/models/a350-1000.glb',
    engines: [ENGINES['trent-xwb']],
    dimensions: {
      lengthM: 73.78,
      wingspanM: 64.75,
      heightM: 17.08,
      fuselageDiaM: 5.96,
      mtowKg: 322000,
      rangeKm: 16480,
      cruiseMach: 0.85,
      ceilingM: 13100,
      paxTypical: 380,
      paxMax: 480,
    },
    timeline: [
      { date: '2016-11', label: 'First flight of the stretched -1000.' },
      { date: '2018-02', label: 'Entry into service with Qatar Airways.' },
      { date: '2024', label: 'Uprated Trent XWB-97 the subject of engine inspection directives after an in-flight event.' },
    ],
    safety: {
      hullLossRate: null,
      fatalEvents: 0,
      totalLosses: 0,
      risk: 'low',
      sources: ['Aviation Safety Network (new variant)', 'Wikipedia: Airbus A350'],
      notes:
        'No hull losses. Uses the more powerful Trent XWB-97 and a strengthened ' +
        'six-wheel main gear; shares 95% of its parts and its type rating with the -900.',
    },
    summary:
      'The 7-metre stretch carrying up to ~40 more passengers on the longest ' +
      'routes — the family\'s flagship, competing with the Boeing 777.',
  },
]
