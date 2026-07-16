import { ENGINES } from '../engines.js'

/**
 * Airbus A380 — the world's largest passenger airliner and the only full-length
 * double-deck jet. A four-engine quadjet whose 79.75 m span was set by the
 * ICAO "80-metre box". Production ran 2003–2021 (251 built); an outstanding
 * safety record with no hull losses or fatalities.
 *
 * Specs are nominal public figures (Airbus, Wikipedia); safety figures are
 * attributed in the variant's `safety.sources`.
 */

export const a380Family = {
  id: 'a380',
  manufacturer: 'Airbus',
  name: 'A380',
  tagline: "The world's largest passenger airliner — full-length double deck.",
  intro:
    'Launched in 2000 as the A3XX to challenge the Boeing 747, the A380 is the ' +
    'only full-length double-deck airliner ever built. It first flew in 2005 and ' +
    'entered service with Singapore Airlines in 2007. Four engines and two full ' +
    'decks give it unmatched capacity — typically ~525 seats, up to 853. Weak ' +
    'orders ended production in 2021 after 251 aircraft, but it remains a ' +
    'flagship for operators like Emirates and has never suffered a hull loss.',
}

export const a380Aircraft = [
  {
    id: 'a380-800',
    name: 'Airbus A380-800',
    familyId: 'a380',
    status: 'in-service',
    firstFlightYear: 2005,
    eisYear: 2007,
    built: 251,
    model: '/models/a380-800.glb',
    engines: [ENGINES['trent-900'], ENGINES['gp7200']],
    dimensions: {
      lengthM: 72.72,
      wingspanM: 79.75,
      wingAreaM2: 845,
      heightM: 24.09,
      fuselageDiaM: 7.14,
      mtowKg: 575000,
      rangeKm: 15700,
      cruiseMach: 0.85,
      ceilingM: 13100,
      paxTypical: 525,
      paxMax: 853,
    },
    timeline: [
      { date: '2000-12', label: 'A380 programme launched (from the A3XX study).' },
      { date: '2005-04', label: 'Maiden flight from Toulouse.' },
      { date: '2007-10', label: 'Entry into service with Singapore Airlines.' },
      { date: '2010-11', label: 'Qantas 32 uncontained engine failure survived with no injuries.' },
      { date: '2021-12', label: 'Final A380 delivered; production ends after 251 aircraft.' },
    ],
    safety: {
      hullLossRate: null,
      fatalEvents: 0,
      totalLosses: 0,
      risk: 'low',
      sources: ['Aviation Safety Network', 'Wikipedia: Airbus A380'],
      notes:
        'An outstanding record: no hull losses and no fatalities across 7.3M+ ' +
        'block hours. Two uncontained engine failures (Qantas 32, 2010; Air France ' +
        '66, 2017) were both handled safely, demonstrating the type\'s redundancy.',
    },
    summary:
      'The only full-length double-decker — a four-engine giant built for the ' +
      'highest-density long-haul routes and major hub operations.',
  },
]
