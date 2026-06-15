/**
 * How each major aircraft system works internally — modelled on the Airbus A320,
 * the family this archive details. Each system is written to teach: what it does,
 * how the parts interconnect, where the redundancy is, and what happens when
 * something fails. The `schematic` field drives an interactive SVG diagram whose
 * nodes are cross-referenced by the `components` list, so hovering a component
 * highlights it in the diagram.
 *
 * Figures are nominal public A320 specifications, for educational reference.
 *
 * @typedef {Object} SystemComponent
 * @property {string} id      Matches a node id in the schematic.
 * @property {string} name
 * @property {string} role    One-line description of what it does.
 *
 * @typedef {Object} SchematicNode
 * @property {string} id
 * @property {string} label
 * @property {number} x        0..100 viewBox coords
 * @property {number} y
 * @property {string} kind     'source' | 'bus' | 'consumer' | 'control' | 'tank' | 'pump'
 *
 * @typedef {Object} SchematicLink
 * @property {string} from
 * @property {string} to
 * @property {string} [flow]   label on the connection (e.g. "115V AC")
 * @property {boolean} [backup] dashed = backup/standby path
 *
 * @typedef {Object} AircraftSystem
 * @property {string} id
 * @property {string} name
 * @property {string} icon
 * @property {string} summary
 * @property {string[]} how       Ordered "how it works" steps.
 * @property {SystemComponent[]} components
 * @property {string} redundancy
 * @property {string} failure     What happens / pilot sees on failure.
 * @property {{nodes: SchematicNode[], links: SchematicLink[]}} schematic
 */

export const SYSTEMS = [
  /* ------------------------------------------------------------------ */
  {
    id: 'electrical',
    name: 'Electrical',
    icon: '⚡',
    summary:
      'Generates, distributes and backs up the electrical power that runs almost ' +
      'everything else — from cockpit displays to fuel pumps. Built around two ' +
      'engine generators with layered backups so the aircraft never goes dark.',
    how: [
      'Each engine drives an Integrated Drive Generator (IDG) that produces 115V / 400Hz AC, regardless of engine RPM (a constant-speed drive keeps the frequency steady).',
      'Each IDG feeds its own AC bus (AC BUS 1, AC BUS 2). Normally the two sides run split — each engine powers its own half of the aircraft.',
      'Transformer-Rectifier Units (TRUs) convert 115V AC down to 28V DC for the DC buses and to charge the batteries.',
      'If an IDG fails, a bus tie contactor closes and the working generator picks up both sides automatically.',
      'If both engine generators are lost, the APU generator can take over on the ground or in flight. If that is also gone, the Ram Air Turbine (RAT) drops into the airflow and powers the essential bus.',
      'Two batteries are the last resort, powering the hot/essential buses and enabling an APU start.',
    ],
    components: [
      { id: 'idg1', name: 'IDG 1 (engine 1 generator)', role: 'Makes 115V/400Hz AC from engine 1.' },
      { id: 'idg2', name: 'IDG 2 (engine 2 generator)', role: 'Makes 115V/400Hz AC from engine 2.' },
      { id: 'apu', name: 'APU generator', role: 'Backup AC source, usable in flight and on the ground.' },
      { id: 'rat', name: 'Ram Air Turbine (RAT)', role: 'Emergency wind-driven generator for the essential bus.' },
      { id: 'ac1', name: 'AC BUS 1', role: 'Distributes AC to the left-side loads.' },
      { id: 'ac2', name: 'AC BUS 2', role: 'Distributes AC to the right-side loads.' },
      { id: 'tru', name: 'TRU (transformer-rectifier)', role: 'Converts 115V AC to 28V DC.' },
      { id: 'batt', name: 'Batteries', role: 'Last-resort DC; power essential buses and APU start.' },
    ],
    redundancy:
      '2 engine generators + APU generator + RAT + 2 batteries. Any single ' +
      'generator can power the whole aircraft via the bus tie. The essential bus ' +
      'can be fed all the way down to battery-only flight.',
    failure:
      'Loss of one generator is transparent — the other side takes over with a ' +
      'brief ECAM advisory. Loss of all AC triggers the RAT and an "EMER ELEC ' +
      'CONFIG" with only essential instruments powered.',
    schematic: {
      nodes: [
        { id: 'idg1', label: 'IDG 1', x: 12, y: 20, kind: 'source' },
        { id: 'idg2', label: 'IDG 2', x: 88, y: 20, kind: 'source' },
        { id: 'apu', label: 'APU GEN', x: 50, y: 10, kind: 'source' },
        { id: 'ac1', label: 'AC BUS 1', x: 25, y: 48, kind: 'bus' },
        { id: 'ac2', label: 'AC BUS 2', x: 75, y: 48, kind: 'bus' },
        { id: 'tru', label: 'TRU → DC', x: 50, y: 66, kind: 'control' },
        { id: 'batt', label: 'BATT', x: 50, y: 84, kind: 'source' },
        { id: 'rat', label: 'RAT', x: 6, y: 70, kind: 'source' },
      ],
      links: [
        { from: 'idg1', to: 'ac1', flow: '115V AC' },
        { from: 'idg2', to: 'ac2', flow: '115V AC' },
        { from: 'apu', to: 'ac1', flow: 'AC', backup: true },
        { from: 'apu', to: 'ac2', flow: 'AC', backup: true },
        { from: 'ac1', to: 'ac2', flow: 'bus tie', backup: true },
        { from: 'ac1', to: 'tru', flow: '' },
        { from: 'ac2', to: 'tru', flow: '' },
        { from: 'tru', to: 'batt', flow: '28V DC' },
        { from: 'rat', to: 'tru', flow: 'emer', backup: true },
      ],
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'hydraulics',
    name: 'Hydraulics',
    icon: '🛢️',
    summary:
      'Three independent hydraulic circuits — Green, Blue and Yellow — provide the ' +
      'muscle to move flight controls, landing gear, brakes and flaps. Triple ' +
      'redundancy means no single failure can leave the aircraft uncontrollable.',
    how: [
      'Three separate circuits (Green, Blue, Yellow) each hold fluid at ~3,000 psi. They are never interconnected by fluid — only power can be shared between them.',
      'Green is pressurised by an engine-1-driven pump; Yellow by an engine-2-driven pump. Blue is pressurised by an electric pump.',
      'The Power Transfer Unit (PTU) lets Green and Yellow help each other: it transfers power (not fluid) hydraulically if one side loses pressure.',
      'Each flight-control surface is driven by actuators fed from different circuits, so losing one circuit never disables a whole control axis.',
      'If all engine/electric pumps fail, the RAT pressurises the Blue circuit to keep the essential flight controls alive.',
      'Yellow also has a hand pump and an electric pump for gear/door operation on the ground without engines running.',
    ],
    components: [
      { id: 'green', name: 'Green circuit', role: 'Engine-1 pump; gear, normal brakes, slats/flaps, controls.' },
      { id: 'yellow', name: 'Yellow circuit', role: 'Engine-2 pump; alternate brakes, cargo doors, controls.' },
      { id: 'blue', name: 'Blue circuit', role: 'Electric pump (+RAT backup); spoilers, controls.' },
      { id: 'ptu', name: 'Power Transfer Unit', role: 'Shares hydraulic power between Green and Yellow.' },
      { id: 'rat', name: 'RAT', role: 'Pressurises Blue when all else is lost.' },
      { id: 'ctl', name: 'Flight controls', role: 'Ailerons, elevators, rudder, spoilers — fed from multiple circuits.' },
    ],
    redundancy:
      'Three fully independent circuits, two driven by different engines and one ' +
      'electric. The PTU and RAT add two more ways to keep pressure. Each control ' +
      'axis is reachable by at least two circuits.',
    failure:
      'Loss of one circuit: the others cover its surfaces, perhaps with reduced ' +
      'rate. The "PTU" runs to back up Green/Yellow (its characteristic bark on ' +
      'the ground). Loss of all three is beyond design assumptions; the RAT keeps ' +
      'Blue alive for basic control.',
    schematic: {
      nodes: [
        { id: 'eng1', label: 'ENG 1', x: 12, y: 14, kind: 'source' },
        { id: 'eng2', label: 'ENG 2', x: 88, y: 14, kind: 'source' },
        { id: 'green', label: 'GREEN', x: 20, y: 42, kind: 'pump' },
        { id: 'yellow', label: 'YELLOW', x: 80, y: 42, kind: 'pump' },
        { id: 'blue', label: 'BLUE', x: 50, y: 30, kind: 'pump' },
        { id: 'ptu', label: 'PTU', x: 50, y: 52, kind: 'control' },
        { id: 'rat', label: 'RAT', x: 50, y: 12, kind: 'source' },
        { id: 'ctl', label: 'FLIGHT CONTROLS', x: 50, y: 82, kind: 'consumer' },
      ],
      links: [
        { from: 'eng1', to: 'green', flow: 'pump' },
        { from: 'eng2', to: 'yellow', flow: 'pump' },
        { from: 'rat', to: 'blue', flow: 'emer', backup: true },
        { from: 'green', to: 'ptu', flow: '' },
        { from: 'yellow', to: 'ptu', flow: '' },
        { from: 'green', to: 'ctl', flow: '3000 psi' },
        { from: 'yellow', to: 'ctl', flow: '3000 psi' },
        { from: 'blue', to: 'ctl', flow: '3000 psi' },
      ],
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'fbw',
    name: 'Fly-by-wire & avionics',
    icon: '🕹️',
    summary:
      'The A320 was the first airliner with full digital fly-by-wire: the ' +
      'sidestick sends electrical signals to flight-control computers, which ' +
      'decide how to move the surfaces — and keep the jet inside a safe flight ' +
      'envelope no matter what the pilot commands.',
    how: [
      'There is no mechanical cable from the sidestick to the surfaces (except a backup on rudder and trim). The stick is a set of electrical sensors.',
      'Pilot inputs go to the flight-control computers: two ELACs (Elevator/Aileron) and three SECs (Spoilers/Elevator), cross-monitoring each other.',
      'The computers interpret the stick as a *demand* (e.g. "pitch at this rate / hold this load factor"), not a direct surface deflection — this is the heart of fly-by-wire.',
      'Flight-envelope protections are baked in: the aircraft will not let you stall, over-speed, over-bank or over-stress it in Normal Law.',
      'Commands are sent to the hydraulic actuators on each surface. The computers constantly compare commanded vs actual and vote out a faulty channel.',
      'If computers or sensors degrade, the system reverts through Alternate Law to Direct Law (stick moves surfaces directly) and finally mechanical backup — progressively trading protection for simplicity.',
    ],
    components: [
      { id: 'stick', name: 'Sidestick', role: 'Electrical sensors; sends pitch/roll demand, not cable pull.' },
      { id: 'elac', name: 'ELAC ×2', role: 'Elevator & aileron computers; run Normal Law.' },
      { id: 'sec', name: 'SEC ×3', role: 'Spoiler & elevator computers; backups + ground spoilers.' },
      { id: 'adirs', name: 'ADIRS', role: 'Air-data & inertial reference — speed, altitude, attitude.' },
      { id: 'surf', name: 'Control surfaces', role: 'Ailerons, elevators, spoilers driven by hydraulic actuators.' },
      { id: 'law', name: 'Control laws', role: 'Normal → Alternate → Direct → mechanical backup.' },
    ],
    redundancy:
      'Five flight-control computers of two dissimilar types, three air-data/inertial ' +
      'units, and multiple hydraulic actuators per surface. Dissimilar hardware and ' +
      'software guard against a common-mode fault.',
    failure:
      'Failures drop the aircraft down the control-law ladder. Even in the worst ' +
      'case, rudder and pitch-trim have a direct mechanical path so the crew can ' +
      'still fly and land. Protections relax as laws degrade, with clear ECAM cues.',
    schematic: {
      nodes: [
        { id: 'stick', label: 'SIDESTICK', x: 12, y: 24, kind: 'control' },
        { id: 'adirs', label: 'ADIRS', x: 12, y: 60, kind: 'source' },
        { id: 'elac', label: 'ELAC ×2', x: 42, y: 32, kind: 'control' },
        { id: 'sec', label: 'SEC ×3', x: 42, y: 60, kind: 'control' },
        { id: 'law', label: 'CONTROL LAWS', x: 68, y: 46, kind: 'bus' },
        { id: 'surf', label: 'SURFACES', x: 90, y: 46, kind: 'consumer' },
      ],
      links: [
        { from: 'stick', to: 'elac', flow: 'demand' },
        { from: 'stick', to: 'sec', flow: 'demand', backup: true },
        { from: 'adirs', to: 'elac', flow: 'air data' },
        { from: 'adirs', to: 'sec', flow: 'air data' },
        { from: 'elac', to: 'law', flow: '' },
        { from: 'sec', to: 'law', flow: '' },
        { from: 'law', to: 'surf', flow: 'actuate' },
      ],
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'fuel',
    name: 'Fuel',
    icon: '⛽',
    summary:
      'Stores fuel in the wings and centre tank, feeds both engines and the APU, ' +
      'and actively manages weight and balance by moving fuel between tanks so the ' +
      'aircraft stays trimmed and the wings stay structurally relieved.',
    how: [
      'Fuel lives in three tanks: left wing, right wing, and a centre tank between them. The wings hold the bulk; the centre tank adds range.',
      'Each engine is normally fed by booster pumps in its own wing tank, keeping the two sides independent.',
      'The centre tank is used first: its pumps push fuel into the wing tanks (centre-tank transfer) so the wing tanks stay full longer.',
      'Keeping the wing tanks full longer is deliberate — the fuel weight in the wings counteracts lift bending loads, relieving the wing structure.',
      'A crossfeed valve can connect both sides so either tank can feed either engine if a pump or engine fails.',
      'Fuel is also a heat sink: it cools engine oil and hydraulic fluid via heat exchangers before being burned.',
    ],
    components: [
      { id: 'lwing', name: 'Left wing tank', role: 'Feeds engine 1; holds fuel out at the wing for load relief.' },
      { id: 'rwing', name: 'Right wing tank', role: 'Feeds engine 2.' },
      { id: 'ctr', name: 'Centre tank', role: 'Extra range; transferred into the wings first.' },
      { id: 'xfeed', name: 'Crossfeed valve', role: 'Lets either tank feed either engine.' },
      { id: 'pumps', name: 'Booster pumps', role: 'Pressurise feed lines to the engines and APU.' },
      { id: 'eng', name: 'Engines + APU', role: 'Consumers of the fuel.' },
    ],
    redundancy:
      'Two independent wing feeds plus a crossfeed; multiple booster pumps per ' +
      'tank; engines can also suction-feed if all pumps fail. The centre tank is ' +
      'an additive, not a single point of failure.',
    failure:
      'A pump failure is covered by the second pump or by opening the crossfeed. ' +
      'An imbalance between wings is corrected by crossfeeding from the heavy side ' +
      'to the engine on the light side.',
    schematic: {
      nodes: [
        { id: 'lwing', label: 'L WING', x: 16, y: 30, kind: 'tank' },
        { id: 'ctr', label: 'CENTRE', x: 50, y: 22, kind: 'tank' },
        { id: 'rwing', label: 'R WING', x: 84, y: 30, kind: 'tank' },
        { id: 'xfeed', label: 'CROSSFEED', x: 50, y: 52, kind: 'control' },
        { id: 'pumps', label: 'BOOST PUMPS', x: 50, y: 68, kind: 'pump' },
        { id: 'eng1', label: 'ENG 1', x: 20, y: 86, kind: 'consumer' },
        { id: 'eng2', label: 'ENG 2', x: 80, y: 86, kind: 'consumer' },
      ],
      links: [
        { from: 'ctr', to: 'lwing', flow: 'transfer', backup: true },
        { from: 'ctr', to: 'rwing', flow: 'transfer', backup: true },
        { from: 'lwing', to: 'xfeed', flow: '' },
        { from: 'rwing', to: 'xfeed', flow: '' },
        { from: 'xfeed', to: 'pumps', flow: '' },
        { from: 'pumps', to: 'eng1', flow: 'feed' },
        { from: 'pumps', to: 'eng2', flow: 'feed' },
      ],
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'pneumatic',
    name: 'Bleed air & pressurisation',
    icon: '💨',
    summary:
      'Hot high-pressure air "bled" from the engine compressors does a surprising ' +
      'amount of work: it pressurises the cabin, runs the air conditioning, de-ices ' +
      'the wings and engine inlets, and starts the other engine.',
    how: [
      'Air is tapped from the engine high-pressure compressor — already hot (~200°C) and at several atmospheres of pressure.',
      'It passes through pre-coolers (cooled by cold fan air) and pressure-regulating valves so downstream systems get a controlled supply.',
      'The air conditioning "packs" expand this air through turbines to cool it, then mix it to a comfortable cabin temperature.',
      'Outflow valves bleed conditioned air overboard at a controlled rate; the balance between inflow (packs) and outflow sets the cabin pressure (altitude).',
      'The same bleed air heats the wing leading edges and engine inlets for anti-icing, and inflates door seals.',
      'On the ground, the APU or a ground cart supplies bleed air to start the engines and run the packs before the engines are running.',
    ],
    components: [
      { id: 'bleed', name: 'Engine bleed ports', role: 'Tap hot HP air from the compressor.' },
      { id: 'precool', name: 'Pre-cooler & valves', role: 'Regulate temperature and pressure of the bleed supply.' },
      { id: 'packs', name: 'Air-con packs', role: 'Expand & cool the air to cabin temperature.' },
      { id: 'cabin', name: 'Cabin', role: 'Receives conditioned air; pressure set by inflow vs outflow.' },
      { id: 'outflow', name: 'Outflow valve', role: 'Controls how fast air leaves — sets cabin altitude.' },
      { id: 'antiice', name: 'Anti-ice', role: 'Hot air to wing slats & engine inlets.' },
      { id: 'apu', name: 'APU / ground', role: 'Bleed source for engine start and ground air.' },
    ],
    redundancy:
      'Two engine bleed sources plus the APU; two packs feeding a common manifold. ' +
      'A bleed leak is isolated by closing that side; one pack can pressurise the ' +
      'cabin (at a lower flow).',
    failure:
      'Loss of one bleed/pack is handled by the other side. Total loss of ' +
      'pressurisation triggers an emergency descent to a breathable altitude with ' +
      'passenger oxygen masks deploying automatically.',
    schematic: {
      nodes: [
        { id: 'bleed', label: 'ENG BLEED', x: 14, y: 22, kind: 'source' },
        { id: 'apu', label: 'APU', x: 14, y: 60, kind: 'source' },
        { id: 'precool', label: 'PRE-COOL', x: 38, y: 38, kind: 'control' },
        { id: 'packs', label: 'PACKS', x: 60, y: 30, kind: 'control' },
        { id: 'antiice', label: 'ANTI-ICE', x: 60, y: 62, kind: 'consumer' },
        { id: 'cabin', label: 'CABIN', x: 82, y: 38, kind: 'consumer' },
        { id: 'outflow', label: 'OUTFLOW', x: 82, y: 64, kind: 'control' },
      ],
      links: [
        { from: 'bleed', to: 'precool', flow: 'hot HP air' },
        { from: 'apu', to: 'precool', flow: 'ground', backup: true },
        { from: 'precool', to: 'packs', flow: '' },
        { from: 'precool', to: 'antiice', flow: 'hot air' },
        { from: 'packs', to: 'cabin', flow: 'cool air' },
        { from: 'cabin', to: 'outflow', flow: 'pressure' },
      ],
    },
  },

  /* ------------------------------------------------------------------ */
  {
    id: 'gear',
    name: 'Landing gear & brakes',
    icon: '🛞',
    summary:
      'Retractable tricycle gear carries the aircraft on the ground and absorbs ' +
      'the landing. Carbon brakes, anti-skid and autobrake stop it; a free-fall ' +
      'backup guarantees the wheels come down even with no hydraulics.',
    how: [
      'Two main gear legs (under the wings) carry most of the weight; a steerable nose gear handles ground steering.',
      'The Green hydraulic circuit normally raises and lowers the gear and powers normal braking.',
      'Oleo-pneumatic struts (oil + nitrogen) absorb the landing impact and damp taxi bumps.',
      'Carbon multi-disc brakes on the main wheels do the stopping; an anti-skid system modulates pressure at each wheel to prevent locking, like ABS.',
      'Autobrake can be pre-armed (LO/MED/MAX) to apply a set deceleration the instant the wheels spin up on touchdown.',
      'If hydraulics fail, a gravity free-fall extension unlocks the gear and lets it fall and lock down; the Yellow circuit (with its electric pump) provides alternate braking with accumulator backup.',
    ],
    components: [
      { id: 'nose', name: 'Nose gear', role: 'Steering on the ground; retracts forward.' },
      { id: 'main', name: 'Main gear ×2', role: 'Carry the weight and the brakes.' },
      { id: 'green', name: 'Green hydraulics', role: 'Normal extend/retract and normal brakes.' },
      { id: 'brakes', name: 'Carbon brakes', role: 'Multi-disc brakes with anti-skid.' },
      { id: 'antiskid', name: 'Anti-skid / autobrake', role: 'Prevents lock-up; applies preset deceleration.' },
      { id: 'freefall', name: 'Free-fall extension', role: 'Gravity backup if hydraulics are lost.' },
    ],
    redundancy:
      'Normal (Green) and alternate (Yellow + accumulator) braking, plus a ' +
      'gravity free-fall that needs no hydraulic power at all to get three greens.',
    failure:
      'Hydraulic loss → free-fall the gear and use alternate brakes (anti-skid ' +
      'may be lost, so the crew brakes gently). A single brake fault is isolated; ' +
      'the accumulator still gives several braking applications.',
    schematic: {
      nodes: [
        { id: 'green', label: 'GREEN HYD', x: 14, y: 24, kind: 'source' },
        { id: 'freefall', label: 'FREE-FALL', x: 14, y: 64, kind: 'source' },
        { id: 'nose', label: 'NOSE GEAR', x: 46, y: 18, kind: 'consumer' },
        { id: 'main', label: 'MAIN GEAR ×2', x: 46, y: 46, kind: 'consumer' },
        { id: 'brakes', label: 'CARBON BRAKES', x: 74, y: 46, kind: 'consumer' },
        { id: 'antiskid', label: 'ANTI-SKID', x: 74, y: 74, kind: 'control' },
      ],
      links: [
        { from: 'green', to: 'nose', flow: 'extend' },
        { from: 'green', to: 'main', flow: 'extend' },
        { from: 'freefall', to: 'main', flow: 'gravity', backup: true },
        { from: 'freefall', to: 'nose', flow: 'gravity', backup: true },
        { from: 'main', to: 'brakes', flow: '' },
        { from: 'brakes', to: 'antiskid', flow: 'modulate' },
      ],
    },
  },
]

export function getSystem(id) {
  return SYSTEMS.find((s) => s.id === id) || null
}
