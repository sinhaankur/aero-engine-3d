/**
 * In-depth breakdown of the A320-family turbofans. Each engine has a Blender-
 * authored glTF in /public/models whose part nodes are named identically across
 * engines, so one EngineViewer drives them all. `node` matches the glTF node;
 * `offset` slides the part along +X (intake) in the exploded view. Nodes that a
 * given model doesn't contain are simply ignored by the viewer.
 *
 * Specs are nominal public figures, for educational/visual reference.
 *
 * @typedef {Object} EnginePart
 * @property {string} node
 * @property {string} name
 * @property {string} stage
 * @property {number} offset
 * @property {string} function
 * @property {string[]} specs
 */

/**
 * Shared part definitions. Per-engine data can override any field (e.g. the fan
 * blade count / material, or the combustor temperature) via `overrides`.
 */
function partsTemplate(overrides = {}) {
  const base = {
    spinner: {
      node: '03_Spinner', name: 'Spinner (nose cone)', stage: 'Fan', offset: 6.0,
      function:
        'The pointed cone at the centre of the fan. It sheds rain and ice and ' +
        'smooths incoming airflow onto the fan blade roots; its spiral marking ' +
        'is a spinning-fan visual cue for ground crew.',
      specs: ['Rotates with the fan', 'Sheds ice & FOD', 'Aerodynamic anti-icing shape'],
    },
    fan: {
      node: '04_Fan_Blades', name: 'Fan blades', stage: 'Fan', offset: 4.6,
      function:
        'The single most important part for thrust. The fan accelerates a large ' +
        'mass of air; most of it bypasses the core to make thrust efficiently.',
      specs: ['Main thrust producer', 'Sets the bypass ratio'],
    },
    inletLip: {
      node: '01b_Inlet_Lip', name: 'Inlet lip', stage: 'Nacelle', offset: 2.8,
      function:
        'The leading edge of the intake. Often a polished metal ring, it is anti-' +
        'iced with hot bleed air and shapes the air smoothly into the fan.',
      specs: ['Anti-iced leading edge', 'Polished metal', 'Sets intake airflow'],
    },
    fanCase: {
      node: '02_Fan_Case', name: 'Fan case / containment ring', stage: 'Fan', offset: 3.2,
      function:
        'The structural ring around the fan, and a containment case: if a blade ' +
        'fails it must trap the debris so it cannot cut into the airframe.',
      specs: ['Blade-off containment', 'Holds fan tip clearance', 'Mounts acoustics'],
    },
    nacelle: {
      node: '01_Nacelle_Cowl', name: 'Nacelle & cowl', stage: 'Nacelle', offset: 2.0,
      function:
        'The aerodynamic outer shell. It forms the bypass duct where most thrust-' +
        'producing cold air flows, and houses acoustic liners and the thrust reverser.',
      specs: ['Forms the bypass duct', 'Acoustic noise liners', 'Thrust-reverser housing'],
    },
    core: {
      node: '05_Core_Casing', name: 'Core (compressor casing)', stage: 'Core', offset: 0.0,
      function:
        'Multi-stage compressors squeeze the core airflow to very high pressure ' +
        'before combustion. This gas generator ultimately drives the fan.',
      specs: ['High-pressure compressor', 'High overall pressure ratio', 'Titanium / nickel alloys'],
    },
    combustor: {
      node: '06_Combustor', name: 'Combustor', stage: 'Core', offset: -1.4,
      function:
        'Fuel is injected and burned with the compressed air here, raising gas ' +
        'temperature dramatically to drive the turbine.',
      specs: ['Burns Jet-A fuel', 'Very high gas temperature'],
    },
    turbine: {
      node: '07_Turbine', name: 'Turbine', stage: 'Core', offset: -2.8,
      function:
        'The hot gas spins the turbine, which drives the compressor and fan up ' +
        'front. Blades run hotter than their melting point and rely on cooling + coatings.',
      specs: ['Drives compressor + fan', 'Internally air-cooled', 'Superalloy blades'],
    },
    nozzle: {
      node: '08_Exhaust_Nozzle', name: 'Exhaust nozzle', stage: 'Exhaust', offset: -4.2,
      function:
        'Shapes and accelerates the hot core exhaust into a fast jet that adds to ' +
        'total thrust.',
      specs: ['Accelerates core exhaust', 'Sets back-pressure', 'Heat-resistant alloy'],
    },
    plug: {
      node: '09_Exhaust_Plug', name: 'Exhaust plug (tail cone)', stage: 'Exhaust', offset: -5.6,
      function:
        'The central cone in the exhaust; it smooths the core flow as it merges ' +
        'with the bypass air and helps set the effective nozzle area.',
      specs: ['Smooths core exhaust', 'Sets nozzle exit area', 'Reduces base drag'],
    },
    pylon: {
      node: '10_Pylon', name: 'Pylon (mount)', stage: 'Structure', offset: 0.0,
      function:
        'The strut that hangs the engine from the wing, carrying all thrust and ' +
        'weight into the airframe and routing fuel, air and wiring.',
      specs: ['Carries thrust & weight', 'Routes fuel/air/wiring', 'Fuse-pin safety mounts'],
    },
  }
  // apply overrides keyed by the same short keys
  for (const k of Object.keys(overrides)) {
    base[k] = { ...base[k], ...overrides[k] }
  }
  return base
}

function orderParts(t, keys) {
  return keys.map((k) => t[k]).filter(Boolean)
}

// Front-to-back display order shared by all engines.
const ORDER = ['spinner', 'fan', 'inletLip', 'fanCase', 'nacelle', 'core', 'combustor', 'turbine', 'nozzle', 'plug', 'pylon']

/* ------------------------------------------------------------------ */
/* LEAP-1A — high bypass (~11:1), woven carbon-fibre fan               */
/* ------------------------------------------------------------------ */
const leap = partsTemplate({
  fan: {
    name: 'Fan (woven carbon-fibre blades)',
    function:
      'LEAP uses 3D-woven carbon-fibre composite fan blades to cut weight while ' +
      'moving a huge mass of bypass air (~90% bypasses the core).',
    specs: ['18 composite fan blades', 'Fan dia. ≈ 1.98 m', 'Bypass ratio ≈ 11:1'],
  },
  core: { specs: ['High-pressure compressor', 'Overall pressure ratio ≈ 40:1', 'Ti / Ni alloys'] },
  combustor: {
    function:
      'LEAP uses a TAPS combustor with 3D-printed fuel nozzles to lower fuel ' +
      'burn and emissions; gas temperature reaches ~1,500–2,000 °C.',
    specs: ['Burns Jet-A fuel', 'Gas temp ~1,500–2,000 °C', '3D-printed fuel nozzles'],
  },
  turbine: { specs: ['Drives compressor + fan', 'Ceramic-matrix-composite shrouds', 'Air-cooled'] },
})

/* ------------------------------------------------------------------ */
/* CFM56-5B — the A320ceo workhorse, lower bypass (~5.5:1)              */
/* ------------------------------------------------------------------ */
const cfm56 = partsTemplate({
  fan: {
    name: 'Fan (titanium blades)',
    function:
      'The CFM56 uses wide-chord titanium fan blades. With a lower bypass ratio ' +
      'than newer engines, its fan is smaller in diameter.',
    specs: ['36 titanium fan blades', 'Fan dia. ≈ 1.73 m', 'Bypass ratio ≈ 5.5:1'],
  },
  core: { specs: ['High-pressure compressor', 'Overall pressure ratio ≈ 35:1', 'Proven 1990s core'] },
  combustor: { specs: ['Burns Jet-A fuel', 'Annular combustor', 'Single/dual-annular options'] },
})

/* ------------------------------------------------------------------ */
/* IAE V2500 — known for its bright polished inlet lip                 */
/* ------------------------------------------------------------------ */
const v2500 = partsTemplate({
  inletLip: {
    function:
      "The V2500's brightly polished bare-metal inlet lip is a recognisable " +
      'signature. It is anti-iced with hot bleed air and shapes airflow into the fan.',
    specs: ['Polished bare-metal lip', 'Hot-air anti-icing', 'A V2500 trademark look'],
  },
  fan: {
    name: 'Fan (wide-chord blades)',
    function:
      'A slimmer fan than the high-bypass newcomers; the V2500 trades a little ' +
      'bypass for a compact, fuel-efficient cruise on longer narrowbody sectors.',
    specs: ['22 wide-chord blades', 'Fan dia. ≈ 1.60 m', 'Bypass ratio ≈ 4.9:1'],
  },
  core: { specs: ['High-pressure compressor', 'Efficient cruise core', 'Ti / Ni alloys'] },
})

/* ------------------------------------------------------------------ */
/* PW1100G GTF — geared turbofan; the gearbox is its defining feature   */
/* ------------------------------------------------------------------ */
const pw1100g = partsTemplate({
  fan: {
    name: 'Fan (large geared fan)',
    function:
      'A very large fan that can spin slowly and efficiently because a reduction ' +
      'gearbox decouples it from the fast-spinning core — the heart of the GTF idea.',
    specs: ['20 fan blades', 'Fan dia. ≈ 2.06 m', 'Bypass ratio ≈ 12.5:1'],
  },
  gearbox: {
    node: '11_Reduction_Gearbox', name: 'Reduction gearbox', stage: 'Core', offset: -0.7,
    function:
      "The GTF's defining part. This planetary gearbox lets the fan turn ~3× " +
      'slower than the low-pressure turbine, so both the fan and the core run at ' +
      'their own optimal speeds — cutting fuel burn and noise.',
    specs: ['~3:1 reduction', 'Lets fan & core spin independently', 'Key to the "G" in GTF'],
  },
})

export const ENGINE_MODELS = {
  'leap-1a': {
    id: 'leap-1a', name: 'CFM LEAP-1A', model: '/models/engine-leap-1a.glb',
    overview:
      'A high-bypass-ratio (≈11:1) turbofan. Most thrust comes from the big fan ' +
      'pushing cold bypass air around the core; the core is a compact gas ' +
      'generator that drives the fan. Air flows front (+X) to back.',
  },
  'cfm56-5b': {
    id: 'cfm56-5b', name: 'CFM56-5B', model: '/models/engine-cfm56-5b.glb',
    overview:
      'The A320ceo workhorse. A proven, lower-bypass (≈5.5:1) turbofan with a ' +
      'smaller fan than the new-generation engines, powering thousands of A320s.',
  },
  'v2500': {
    id: 'v2500', name: 'IAE V2500', model: '/models/engine-v2500.glb',
    overview:
      'The alternative A320ceo powerplant, recognisable by its brightly polished ' +
      'inlet lip. A compact, fuel-efficient ≈4.9:1-bypass turbofan.',
  },
  'pw1100g': {
    id: 'pw1100g', name: 'Pratt & Whitney PW1100G GTF', model: '/models/engine-pw1100g.glb',
    overview:
      'A geared turbofan (GTF): a reduction gearbox lets the large fan spin ' +
      'slowly and efficiently while the core spins fast. Very high bypass (≈12.5:1).',
  },
}

export const ENGINE_PARTS_BY_MODEL = {
  'leap-1a': orderParts(leap, ORDER),
  'cfm56-5b': orderParts(cfm56, ORDER),
  'v2500': orderParts(v2500, ORDER),
  // GTF: insert the gearbox right after the core in the front-to-back order.
  'pw1100g': orderParts(pw1100g, ['spinner', 'fan', 'inletLip', 'fanCase', 'nacelle', 'core', 'gearbox', 'combustor', 'turbine', 'nozzle', 'plug', 'pylon']),
}

// Back-compat export (some code imported LEAP_1A_PARTS directly).
export const LEAP_1A_PARTS = ENGINE_PARTS_BY_MODEL['leap-1a']

/**
 * How a turbofan actually works — the Brayton cycle, in order. Each stage names
 * the part nodes it involves so the "How it works" walkthrough can highlight the
 * right geometry in 3D as the user steps through Suck → Squeeze → Bang → Blow.
 *
 * @typedef {Object} CycleStage
 * @property {string} key
 * @property {string} title
 * @property {string} motto    The classic "suck/squeeze/bang/blow" shorthand.
 * @property {string[]} nodes  glTF node names highlighted for this stage.
 * @property {string} what     Plain-language explanation of what happens here.
 */
export const TURBOFAN_CYCLE = [
  {
    key: 'intake',
    title: '1 · Intake',
    motto: 'Suck',
    nodes: ['01b_Inlet_Lip', '01_Nacelle_Cowl', '03_Spinner'],
    what:
      'Air enters through the inlet. The cowl and lip slow and smooth the ' +
      'airflow so it reaches the fan evenly, even when the aircraft is climbing ' +
      'or in a crosswind.',
  },
  {
    key: 'fan',
    title: '2 · Fan & bypass',
    motto: 'Suck',
    nodes: ['04_Fan_Blades', '02_Fan_Case'],
    what:
      'The big fan grabs a huge mass of air. On a high-bypass engine ~85–90% of ' +
      'it goes straight around the core as cold "bypass" air — this is what ' +
      'actually produces most of the thrust, quietly and efficiently. The rest ' +
      'is fed into the core.',
  },
  {
    key: 'compress',
    title: '3 · Compression',
    motto: 'Squeeze',
    nodes: ['05_Core_Casing', '11_Reduction_Gearbox'],
    what:
      'The core air is squeezed by rows of compressor blades to many times ' +
      'atmospheric pressure (overall pressure ratios of 35–40:1). Squeezing it ' +
      'first makes the burning far more efficient.',
  },
  {
    key: 'combust',
    title: '4 · Combustion',
    motto: 'Bang',
    nodes: ['06_Combustor'],
    what:
      'Fuel is sprayed into the high-pressure air and ignited. It burns ' +
      'continuously (not in pulses), and the gas temperature shoots up to ' +
      '~1,500–2,000 °C, expanding violently.',
  },
  {
    key: 'turbine',
    title: '5 · Turbine',
    motto: 'Blow',
    nodes: ['07_Turbine'],
    what:
      'The hot, expanding gas blasts through the turbine and spins it. The ' +
      'turbine is shafted forward to drive the compressor and the fan — so the ' +
      'engine powers itself. This is the key feedback loop of the whole engine.',
  },
  {
    key: 'exhaust',
    title: '6 · Exhaust',
    motto: 'Blow',
    nodes: ['08_Exhaust_Nozzle', '09_Exhaust_Plug'],
    what:
      'Whatever energy is left leaves through the nozzle as a fast jet, adding a ' +
      "little more thrust. The bypass air and core exhaust mix and leave the " +
      'back of the engine together.',
  },
]
