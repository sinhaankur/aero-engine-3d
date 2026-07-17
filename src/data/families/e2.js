import { ENGINES } from '../engines.js'

/**
 * Embraer E-Jet E2 family — the third manufacturer in the archive (Phase 4).
 * The E2s sit just below the A220/A320 in size: clean-sheet wings, full
 * closed-loop fly-by-wire and geared turbofans on a stretched E-Jet fuselage.
 * Specs are nominal public figures; safety figures are attributed in each
 * variant's `safety.sources`.
 */

export const e2Family = {
  id: 'e2',
  manufacturer: 'Embraer',
  name: 'E-Jet E2 Family',
  tagline: 'The re-winged, re-engined regional jets that nip at the A220\'s heels.',
  intro:
    'Embraer launched the E2 programme in 2013 to defend its regional-jet ' +
    'crown against the CSeries (now the A220). The fuselage cross-section ' +
    'carries over from the first-generation E-Jets, but everything around it ' +
    'is new: a higher-aspect-ratio wing with raked tips, Pratt & Whitney ' +
    'geared turbofans, and a fourth-generation full fly-by-wire system whose ' +
    'closed-loop control laws trim the tail for lower cruise drag. The result ' +
    'is double-digit fuel-burn cuts over the originals — and a family that ' +
    'competes with the A220 at the small end of the single-aisle market.',
}

export const e2Aircraft = [
  {
    id: 'e190-e2',
    name: 'Embraer E190-E2',
    familyId: 'e2',
    status: 'in-production',
    firstFlightYear: 2016,
    eisYear: 2018,
    built: 45,
    model: '/models/e190-e2.glb',
    engines: [ENGINES['pw1900g']],
    dimensions: {
      lengthM: 36.24,
      wingspanM: 33.72,
      wingAreaM2: 103,
      heightM: 10.96,
      fuselageDiaM: 3.01,
      mtowKg: 56400,
      rangeKm: 5278,
      cruiseMach: 0.82,
      ceilingM: 12497,
      paxTypical: 97,
      paxMax: 114,
    },
    timeline: [
      { date: '2013-06', label: 'E2 programme launched at the Paris Air Show.' },
      { date: '2016-05', label: 'First flight of the E190-E2, first of the E2 line.' },
      { date: '2018-04', label: 'Entry into service with Widerøe on Norwegian short-haul routes.' },
      { date: '2018', label: 'Flight tests confirm ~17% lower fuel burn per seat than the E190.' },
    ],
    safety: {
      hullLossRate: null,
      fatalEvents: 0,
      totalLosses: 0,
      risk: 'low',
      sources: ['Aviation Safety Network hull-loss database (public)'],
      notes:
        'No hull losses or fatal accidents recorded for any E2 variant to date; ' +
        'the fleet is still young and small, so rate figures are not yet meaningful.',
    },
    summary:
      'The first E2 into service — an A220-100-sized twin whose geared fans ' +
      'and new wing made it, on entry, the most efficient single-aisle flying.',
  },
  {
    id: 'e195-e2',
    name: 'Embraer E195-E2',
    familyId: 'e2',
    status: 'in-production',
    firstFlightYear: 2017,
    eisYear: 2019,
    built: 150,
    model: '/models/e195-e2.glb',
    engines: [ENGINES['pw1900g']],
    dimensions: {
      lengthM: 41.5,
      wingspanM: 35.12,
      wingAreaM2: 110,
      heightM: 10.9,
      fuselageDiaM: 3.01,
      mtowKg: 61500,
      rangeKm: 4815,
      cruiseMach: 0.82,
      ceilingM: 12497,
      paxTypical: 132,
      paxMax: 146,
    },
    timeline: [
      { date: '2017-03', label: 'First flight — the largest aircraft ever built in Brazil.' },
      { date: '2019-09', label: 'Entry into service with Azul Brazilian Airlines.' },
      { date: '2022', label: 'Porter Airlines launches an all-E195-E2 jet operation from Toronto.' },
    ],
    safety: {
      hullLossRate: null,
      fatalEvents: 0,
      totalLosses: 0,
      risk: 'low',
      sources: ['Aviation Safety Network hull-loss database (public)'],
      notes:
        'No hull losses or fatal accidents recorded to date across the E2 family.',
    },
    summary:
      'Embraer\'s flagship and the A220-300\'s closest rival — a three-metre ' +
      'stretch that turns a regional jet into a small mainline airliner.',
  },
  {
    id: 'e175-e2',
    name: 'Embraer E175-E2',
    familyId: 'e2',
    status: 'in-development',
    firstFlightYear: 2019,
    built: 2,
    model: '/models/e175-e2.glb',
    engines: [ENGINES['pw1700g']],
    dimensions: {
      lengthM: 32.4,
      wingspanM: 31.0,
      wingAreaM2: 85,
      heightM: 9.98,
      fuselageDiaM: 3.01,
      mtowKg: 44800,
      rangeKm: 3815,
      cruiseMach: 0.82,
      ceilingM: 12497,
      paxTypical: 80,
      paxMax: 90,
    },
    timeline: [
      { date: '2019-12', label: 'First flight of the smallest E2.' },
      { date: '2021', label: 'Programme slowed: US scope clauses cap regional-jet MTOW below the E175-E2\'s weight.' },
      { date: '2024', label: 'Certification campaign paused pending scope-clause relief; two test aircraft flying.' },
    ],
    safety: {
      hullLossRate: null,
      fatalEvents: 0,
      totalLosses: 0,
      risk: 'low',
      sources: ['Aviation Safety Network hull-loss database (public)'],
      notes:
        'Flight-test programme only; no in-service fleet yet.',
    },
    summary:
      'The E2 built for US regional flying — and grounded by a contract, not ' +
      'physics: pilot-union scope clauses cap regional MTOW just below it.',
  },
]
