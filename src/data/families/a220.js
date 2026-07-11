import { ENGINES } from '../engines.js'

/**
 * Airbus A220 family — the clean-sheet 100–150 seat narrowbody that began life
 * as the Bombardier CSeries (CS100 / CS300) and became an Airbus product in
 * 2018. Five-abreast cabin, carbon-fibre wing, Pratt & Whitney geared turbofans.
 *
 * Specs are nominal public figures (Airbus "Facts & Figures", Wikipedia);
 * safety figures are attributed in each variant's `safety.sources`.
 */

export const a220Family = {
  id: 'a220',
  manufacturer: 'Airbus',
  name: 'A220 Family',
  tagline: 'The 100–150 seat clean-sheet narrowbody (ex-Bombardier CSeries).',
  intro:
    'Conceived by Bombardier in the 2000s as an all-new, fuel-efficient jet for ' +
    'the 100–150 seat market, the CSeries first flew in 2013 and entered service ' +
    'with Swiss in 2016. A carbon-fibre wing, a five-abreast cabin and Pratt & ' +
    'Whitney geared turbofans gave it class-leading efficiency and cabin comfort. ' +
    'Airbus took a controlling stake in 2018 and rebranded it the A220. Two ' +
    'variants — the -100 and the stretched -300 — share over 99% of their parts ' +
    'and a common type rating.',
}

export const a220Aircraft = [
  {
    id: 'a220-100',
    name: 'Airbus A220-100',
    familyId: 'a220',
    status: 'in-production',
    firstFlightYear: 2013,
    eisYear: 2016,
    built: 60,
    model: '/models/a220-100.glb',
    engines: [ENGINES['pw1500g']],
    dimensions: {
      lengthM: 35.0,
      wingspanM: 35.1,
      heightM: 11.5,
      fuselageDiaM: 3.7,
      mtowKg: 63100,
      rangeKm: 6700,
      cruiseMach: 0.82,
      ceilingM: 12500,
      paxTypical: 110,
      paxMax: 135,
    },
    timeline: [
      { date: '2008-07', label: 'Bombardier launches the CSeries programme (CS100 / CS300).' },
      { date: '2013-09', label: 'First flight of the CS100 in Mirabel, Quebec.' },
      { date: '2016-07', label: 'Entry into service with Swiss International Air Lines.' },
      { date: '2018-07', label: 'Airbus takes control; CS100 rebranded the A220-100.' },
    ],
    safety: {
      hullLossRate: null,
      fatalEvents: 0,
      totalLosses: 0,
      risk: 'low',
      sources: ['Aviation Safety Network', 'Airbus A220 Facts & Figures', 'Wikipedia: Airbus A220'],
      notes:
        'The smaller variant has no hull-loss accidents. A fatal December 2024 ' +
        'smoke event and a June 2025 maintenance ground-fire both involved the ' +
        'larger -300, not the -100.',
    },
    summary:
      'The shorter member, best on thinner routes — its lighter weight actually ' +
      'gives it slightly longer range than the -300 on the same fuel.',
  },
  {
    id: 'a220-300',
    name: 'Airbus A220-300',
    familyId: 'a220',
    status: 'in-production',
    firstFlightYear: 2015,
    eisYear: 2016,
    built: 380,
    model: '/models/a220-300.glb',
    engines: [ENGINES['pw1500g']],
    dimensions: {
      lengthM: 38.7,
      wingspanM: 35.1,
      heightM: 11.5,
      fuselageDiaM: 3.7,
      mtowKg: 70900,
      rangeKm: 6300,
      cruiseMach: 0.82,
      ceilingM: 12500,
      paxTypical: 140,
      paxMax: 160,
    },
    timeline: [
      { date: '2015-02', label: 'First flight of the stretched CS300.' },
      { date: '2016-12', label: 'Entry into service with airBaltic.' },
      { date: '2018-07', label: 'Rebranded the A220-300 under Airbus.' },
      { date: '2025-06', label: 'First A220 hull loss: an airBaltic jet destroyed by a ground fire during maintenance.' },
    ],
    safety: {
      hullLossRate: null,
      fatalEvents: 1,
      totalLosses: 1,
      risk: 'low',
      sources: ['Aviation Safety Network', 'Aerospace Global News', 'Wikipedia: Airbus A220'],
      notes:
        'One fatal smoke event (Dec 2024, one crew fatality) and the family\'s ' +
        'first hull loss (June 2025, an airBaltic ground fire during a maintenance ' +
        'APU run, no injuries). Still a strong record for the fleet size.',
    },
    summary:
      'The higher-capacity stretch and the volume seller of the family, competing ' +
      'directly with the smallest 737 and A319/A320 on 120–150 seat routes.',
  },
]
