import { ENGINES } from '../engines.js'

/**
 * Airbus A330 family — the twin-aisle, twin-engine widebody that shares its wing
 * and much of its structure with the four-engine A340. The A330ceo offered a
 * three-way engine choice (Trent 700 / CF6 / PW4000); the re-engined A330neo
 * (-800 / -900) is exclusively Trent 7000 with new A350-style winglets.
 *
 * Specs are nominal public figures (Airbus, Wikipedia); safety figures are
 * attributed in each variant's `safety.sources`.
 */

export const a330Family = {
  id: 'a330',
  manufacturer: 'Airbus',
  name: 'A330 Family',
  tagline: 'Twin-aisle medium/long-haul workhorse, including the A330neo.',
  intro:
    'Launched in 1987 alongside the four-engine A340 and sharing its wing, the ' +
    'A330 first flew in 1992 and entered service in 1994. As a big, efficient ' +
    'twinjet it became one of the best-selling widebodies ever, passing 1,000 ' +
    'deliveries in 2013. The -300 optimised capacity and the shortened -200 ' +
    'optimised range; the 2018 A330neo re-engined the family with Rolls-Royce ' +
    'Trent 7000s and new winglets for double-digit fuel savings.',
}

export const a330Aircraft = [
  {
    id: 'a330-300',
    name: 'Airbus A330-300',
    familyId: 'a330',
    status: 'in-production',
    firstFlightYear: 1992,
    eisYear: 1994,
    built: 780,
    model: '/models/a330-300.glb',
    engines: [ENGINES['trent-700'], ENGINES['cf6-80e1'], ENGINES['pw4000-100']],
    dimensions: {
      lengthM: 63.66,
      wingspanM: 60.3,
      heightM: 16.83,
      fuselageDiaM: 5.64,
      mtowKg: 242000,
      rangeKm: 11750,
      cruiseMach: 0.82,
      ceilingM: 12500,
      paxTypical: 277,
      paxMax: 440,
    },
    timeline: [
      { date: '1987-06', label: 'Programme launched together with the A340.' },
      { date: '1992-11', label: 'First flight from Toulouse.' },
      { date: '1994-01', label: 'Entry into service with Air Inter.' },
      { date: '2013-07', label: '1,000th A330 delivered — first Airbus widebody to the milestone.' },
    ],
    safety: {
      hullLossRate: 0.19,
      fatalEvents: 3,
      totalLosses: 8,
      risk: 'low',
      sources: ['Aviation Safety Network', 'Wikipedia: List of A330 accidents'],
      notes:
        'The original, highest-volume variant. Family-wide the A330 has ~14 ' +
        'hull losses over 30+ years and 1,600+ aircraft; several were ground ' +
        'losses from war or fire rather than in-flight accidents.',
    },
    summary:
      'The baseline high-capacity variant and long the family volume seller — a ' +
      'staple of medium- and long-haul fleets worldwide.',
  },
  {
    id: 'a330-200',
    name: 'Airbus A330-200',
    familyId: 'a330',
    status: 'in-service',
    firstFlightYear: 1997,
    eisYear: 1998,
    built: 650,
    model: '/models/a330-200.glb',
    engines: [ENGINES['trent-700'], ENGINES['cf6-80e1'], ENGINES['pw4000-100']],
    dimensions: {
      lengthM: 58.82,
      wingspanM: 60.3,
      heightM: 17.39,
      fuselageDiaM: 5.64,
      mtowKg: 242000,
      rangeKm: 13450,
      cruiseMach: 0.82,
      ceilingM: 12500,
      paxTypical: 247,
      paxMax: 406,
    },
    timeline: [
      { date: '1997-08', label: 'First flight of the shortened long-range variant.' },
      { date: '1998', label: 'Entry into service with Canada 3000.' },
      { date: '2009-06', label: 'Air France 447 lost over the Atlantic (228 fatalities); led to pitot-tube changes fleet-wide.' },
    ],
    safety: {
      hullLossRate: 0.24,
      fatalEvents: 2,
      totalLosses: 6,
      risk: 'moderate',
      sources: ['Aviation Safety Network', 'BEA Final Report AF447', 'Wikipedia: List of A330 accidents'],
      notes:
        'A shorter, taller-tailed long-range variant. Its record includes the ' +
        'deadliest A330 accident, Air France 447 (2009), whose investigation drove ' +
        'important changes to airspeed sensing and stall-recovery training.',
    },
    summary:
      'A shortened, longer-range development with a taller fin — built for thin ' +
      'long-haul routes and widely used on transatlantic and transpacific sectors.',
  },
  {
    id: 'a330-900',
    name: 'Airbus A330-900neo',
    familyId: 'a330',
    status: 'in-production',
    firstFlightYear: 2017,
    eisYear: 2018,
    built: 160,
    model: '/models/a330-900.glb',
    engines: [ENGINES['trent-7000']],
    dimensions: {
      lengthM: 63.66,
      wingspanM: 64.0,
      heightM: 16.79,
      fuselageDiaM: 5.64,
      mtowKg: 251000,
      rangeKm: 13600,
      cruiseMach: 0.82,
      ceilingM: 12500,
      paxTypical: 287,
      paxMax: 440,
    },
    timeline: [
      { date: '2014-07', label: 'A330neo launched with the exclusive Trent 7000 and new winglets.' },
      { date: '2017-10', label: 'First flight of the A330-900.' },
      { date: '2018-12', label: 'Entry into service with TAP Air Portugal.' },
    ],
    safety: {
      hullLossRate: null,
      fatalEvents: 0,
      totalLosses: 0,
      risk: 'low',
      sources: ['Aviation Safety Network (new variant)', 'Wikipedia: Airbus A330neo'],
      notes:
        'The re-engined stretch and the neo volume seller; no hull losses. Inherits ' +
        'the mature A330 airframe with new engines, winglets and pylons.',
    },
    summary:
      'The re-engined A330-300 — same fuselage length, new Trent 7000s and ' +
      'A350-style winglets for roughly 14% better per-seat fuel burn.',
  },
  {
    id: 'a330-800',
    name: 'Airbus A330-800neo',
    familyId: 'a330',
    status: 'in-service',
    firstFlightYear: 2018,
    eisYear: 2020,
    built: 12,
    model: '/models/a330-800.glb',
    engines: [ENGINES['trent-7000']],
    dimensions: {
      lengthM: 58.82,
      wingspanM: 64.0,
      heightM: 17.39,
      fuselageDiaM: 5.64,
      mtowKg: 251000,
      rangeKm: 15000,
      cruiseMach: 0.82,
      ceilingM: 12500,
      paxTypical: 257,
      paxMax: 406,
    },
    timeline: [
      { date: '2018-11', label: 'First flight of the A330-800.' },
      { date: '2020-10', label: 'Entry into service with Kuwait Airways.' },
    ],
    safety: {
      hullLossRate: null,
      fatalEvents: 0,
      totalLosses: 0,
      risk: 'low',
      sources: ['Aviation Safety Network (rare, new variant)'],
      notes:
        'The re-engined -200; the rarest current A330 with only a handful built. ' +
        'No hull losses. Offers the longest range of the family (~15,000 km).',
    },
    summary:
      'The re-engined long-range short-body — a low-volume niche variant that ' +
      'flies the family\'s longest sectors.',
  },
]
