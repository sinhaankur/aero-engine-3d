import { ENGINES } from '../engines.js'

/**
 * Boeing 737 family — the first non-Airbus family in the archive (Phase 4).
 * The archive covers the NG and MAX generations, which compete head-to-head
 * with the A320ceo/neo. Specs are nominal public figures; safety figures are
 * attributed in each variant's `safety.sources`.
 */

export const b737Family = {
  id: 'b737',
  manufacturer: 'Boeing',
  name: '737 Family',
  tagline: "The A320's arch-rival — the best-selling airliner line in history.",
  intro:
    'First flown in 1967, the 737 has been stretched, re-winged and re-engined ' +
    'through four generations. This archive covers the Next Generation (NG) of ' +
    'the late 1990s and the re-engined MAX — the two generations that fight the ' +
    'A320ceo and A320neo for every narrowbody order. Unlike the fly-by-wire ' +
    'A320, the 737 keeps conventional cable-and-hydraulic flight controls, a ' +
    'design lineage that reaches back to the 1960s.',
}

export const b737Aircraft = [
  {
    id: 'b737-700',
    name: 'Boeing 737-700',
    familyId: 'b737',
    status: 'in-service',
    firstFlightYear: 1997,
    eisYear: 1998,
    built: 1128,
    model: '/models/b737-700.glb',
    engines: [ENGINES['cfm56-7b']],
    dimensions: {
      lengthM: 33.63,
      wingspanM: 35.79,
      wingAreaM2: 124.6,
      heightM: 12.55,
      fuselageDiaM: 3.76,
      mtowKg: 70080,
      rangeKm: 6370,
      cruiseMach: 0.785,
      ceilingM: 12500,
      paxTypical: 126,
      paxMax: 149,
    },
    timeline: [
      { date: '1993', label: 'Next Generation programme launched with Southwest as lead customer.' },
      { date: '1997-02', label: 'First flight of the -700, first of the NG line.' },
      { date: '1998', label: 'Entry into service with Southwest Airlines.' },
      { date: '2018-04', label: 'Southwest 1380 uncontained fan-blade failure — one fatality; fleet-wide fan-blade inspections mandated.' },
    ],
    safety: {
      hullLossRate: null,
      fatalEvents: 2,
      totalLosses: 6,
      risk: 'low',
      sources: ['Aviation Safety Network hull-loss database (public)'],
      notes:
        'Mature type with a strong record across a large fleet; the 737NG series ' +
        'overall shows one of the lowest hull-loss rates of any narrowbody generation.',
    },
    summary:
      'The baseline NG — the A319\'s direct rival. Southwest built its entire ' +
      'network on it, and it remains the backbone of many low-cost fleets.',
  },
  {
    id: 'b737-800',
    name: 'Boeing 737-800',
    familyId: 'b737',
    status: 'in-service',
    firstFlightYear: 1997,
    eisYear: 1998,
    built: 4991,
    model: '/models/b737-800.glb',
    engines: [ENGINES['cfm56-7b']],
    dimensions: {
      lengthM: 39.47,
      wingspanM: 35.79,
      wingAreaM2: 124.6,
      heightM: 12.55,
      fuselageDiaM: 3.76,
      mtowKg: 79010,
      rangeKm: 5765,
      cruiseMach: 0.785,
      ceilingM: 12500,
      paxTypical: 162,
      paxMax: 189,
    },
    timeline: [
      { date: '1997-07', label: 'First flight of the stretched -800.' },
      { date: '1998', label: 'Entry into service with Hapag-Lloyd.' },
      { date: '2000s', label: 'Becomes the best-selling single variant of the NG line — the A320\'s head-to-head rival.' },
      { date: '2019', label: 'NG production winds down as the MAX takes over the line.' },
    ],
    safety: {
      hullLossRate: 0.2,
      fatalEvents: 12,
      totalLosses: 25,
      risk: 'low',
      sources: [
        'Aviation Safety Network hull-loss database (public)',
        'Boeing Statistical Summary of Commercial Jet Airplane Accidents (public)',
      ],
      notes:
        'Very large fleet (~5,000 built) flying very high cycles; the loss rate ' +
        'per departure is low. Includes non-design losses such as the Ukraine ' +
        'Flight 752 shootdown (2020).',
    },
    summary:
      'The definitive NG and one of the most numerous jetliners ever built — ' +
      'what the A320 is measured against on every order campaign.',
  },
  {
    id: 'b737-max8',
    name: 'Boeing 737 MAX 8',
    familyId: 'b737',
    status: 'in-production',
    firstFlightYear: 2016,
    eisYear: 2017,
    built: 1600,
    model: '/models/b737-max8.glb',
    engines: [ENGINES['leap-1b']],
    dimensions: {
      lengthM: 39.52,
      wingspanM: 35.92,
      wingAreaM2: 127,
      heightM: 12.3,
      fuselageDiaM: 3.76,
      mtowKg: 82190,
      rangeKm: 6480,
      cruiseMach: 0.79,
      ceilingM: 12500,
      paxTypical: 170,
      paxMax: 210,
    },
    timeline: [
      { date: '2011', label: 'MAX programme launched in response to the A320neo.' },
      { date: '2016-01', label: 'First flight of the MAX 8.' },
      { date: '2017-05', label: 'Entry into service with Malindo Air.' },
      { date: '2018-10', label: 'Lion Air 610 lost — MCAS flight-control software implicated.' },
      { date: '2019-03', label: 'Ethiopian 302 lost; worldwide fleet grounded for 20 months.' },
      { date: '2020-11', label: 'FAA recertification after MCAS redesign and training overhaul.' },
    ],
    safety: {
      hullLossRate: null,
      fatalEvents: 2,
      totalLosses: 2,
      risk: 'moderate',
      sources: [
        'Aviation Safety Network hull-loss database (public)',
        'US House Committee final report on the 737 MAX (public, 2020)',
      ],
      notes:
        'Two fatal accidents (Lion Air 610, Ethiopian 302) traced to the MCAS ' +
        'stability augmentation and its certification; the type was grounded ' +
        'worldwide for 20 months, redesigned and recertified. Post-return ' +
        'service record has been in line with other current narrowbodies.',
    },
    summary:
      'The re-engined answer to the A320neo. Its MCAS accidents and grounding ' +
      'became modern aviation\'s defining lesson in certification and ' +
      'software-airframe integration.',
  },
]
