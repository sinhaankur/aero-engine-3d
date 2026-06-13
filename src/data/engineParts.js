/**
 * In-depth breakdown of a high-bypass turbofan (modelled on the CFM LEAP-1A).
 *
 * Each part's `node` matches the named node in `public/models/engine-leap-1a.glb`
 * (authored in Blender), so the EngineViewer can isolate, highlight, and explode
 * parts individually. `axis`/`offset` drive the exploded-view animation: parts
 * slide along the engine's X axis (intake at +X) by `offset` metres.
 *
 * Specs are nominal public LEAP-1A figures, for educational/visual reference.
 *
 * @typedef {Object} EnginePart
 * @property {string} node      glTF node name (must match the .glb).
 * @property {string} name      Display name.
 * @property {string} stage     Section of the engine this belongs to.
 * @property {number} offset    Exploded-view slide distance along +X (metres).
 * @property {string} function  What the part does.
 * @property {string[]} specs   Notable facts/figures.
 */

export const ENGINE_MODELS = {
  'leap-1a': {
    id: 'leap-1a',
    name: 'CFM LEAP-1A',
    model: '/models/engine-leap-1a.glb',
    overview:
      'A high-bypass-ratio (≈11:1) turbofan. Most of the thrust comes from the ' +
      'big fan pushing cold "bypass" air around the core; the core itself is a ' +
      'compact gas generator that drives the fan. Air flows front (+X) to back.',
  },
}

/** Ordered front-to-back. `offset` spreads them along +X in the exploded view. */
export const LEAP_1A_PARTS = [
  {
    node: '03_Spinner',
    name: 'Spinner (nose cone)',
    stage: 'Fan',
    offset: 6.0,
    function:
      'The pointed cone at the centre of the fan. It sheds rain and ice and ' +
      'smooths incoming airflow onto the fan blade roots. Its spiral marking ' +
      'gives a visual cue that the fan is spinning (a bird/ground-crew deterrent).',
    specs: ['Rotates with the fan', 'Sheds ice & FOD', 'Anti-icing aerodynamic shape'],
  },
  {
    node: '04_Fan_Blades',
    name: 'Fan (woven carbon-fibre blades)',
    stage: 'Fan',
    offset: 4.6,
    function:
      'The single most important part for thrust on a high-bypass engine. The ' +
      'large fan accelerates a huge mass of air; ~90% bypasses the core, ~10% ' +
      'feeds it. LEAP famously uses 3D-woven carbon-fibre composite blades to ' +
      'cut weight.',
    specs: ['18 composite fan blades', 'Fan dia. ≈ 1.98 m', 'Bypass ratio ≈ 11:1'],
  },
  {
    node: '02_Fan_Case',
    name: 'Fan case / containment ring',
    stage: 'Fan',
    offset: 3.2,
    function:
      'The structural ring around the fan. Critically, it is a containment case: ' +
      'if a fan blade ever fails, this ring must trap the debris so it cannot ' +
      'cut into the wing or fuselage.',
    specs: ['Blade-off containment', 'Holds fan tip clearance', 'Mounts inlet acoustics'],
  },
  {
    node: '01_Nacelle_Cowl',
    name: 'Nacelle & inlet cowl',
    stage: 'Nacelle',
    offset: 2.0,
    function:
      'The aerodynamic outer shell. It forms the bypass duct (the gap between ' +
      'cowl and core) where most of the thrust-producing cold air flows, houses ' +
      'acoustic liners to cut noise, and on many engines opens to reveal the core.',
    specs: ['Forms the bypass duct', 'Acoustic noise liners', 'Thrust-reverser housing'],
  },
  {
    node: '05_Core_Casing',
    name: 'Core (compressor casing)',
    stage: 'Core',
    offset: 0.0,
    function:
      'Inside the core, multi-stage compressors squeeze the ~10% of air fed to ' +
      'the core to very high pressure before combustion. This is the "gas ' +
      'generator" that ultimately drives the fan.',
    specs: ['High-pressure compressor', 'Overall pressure ratio ≈ 40:1', 'Titanium/nickel alloys'],
  },
  {
    node: '06_Combustor',
    name: 'Combustor',
    stage: 'Core',
    offset: -1.4,
    function:
      'Fuel is injected and burned with the compressed air here, raising gas ' +
      'temperature to ~1,500–2,000 °C. LEAP uses a TAPS combustor and 3D-printed ' +
      'fuel nozzles to lower fuel burn and emissions.',
    specs: ['Burns Jet-A fuel', 'Gas temp ~1,500–2,000 °C', '3D-printed fuel nozzles'],
  },
  {
    node: '07_Turbine',
    name: 'Turbine',
    stage: 'Core',
    offset: -2.8,
    function:
      'The hot, high-pressure gas spins the turbine, which is mechanically ' +
      'connected forward to drive the compressor and the fan. Turbine blades run ' +
      'hotter than their own melting point and rely on internal cooling + coatings.',
    specs: ['Drives compressor + fan', 'Ceramic-matrix-composite shrouds', 'Internally air-cooled'],
  },
  {
    node: '08_Exhaust_Nozzle',
    name: 'Exhaust nozzle',
    stage: 'Exhaust',
    offset: -4.2,
    function:
      'Shapes and accelerates the hot core exhaust as it leaves the engine, ' +
      'converting remaining pressure into a fast jet that adds to total thrust.',
    specs: ['Accelerates core exhaust', 'Sets back-pressure', 'Heat-resistant alloy'],
  },
  {
    node: '09_Exhaust_Plug',
    name: 'Exhaust plug (tail cone)',
    stage: 'Exhaust',
    offset: -5.6,
    function:
      'The central cone in the exhaust. It smooths the core flow as it merges ' +
      'with the bypass air and helps set the effective nozzle area.',
    specs: ['Smooths core exhaust', 'Sets nozzle exit area', 'Reduces base drag'],
  },
  {
    node: '10_Pylon',
    name: 'Pylon (mount)',
    stage: 'Structure',
    offset: 0.0,
    function:
      'The strut that hangs the engine from the wing. It carries all engine ' +
      'thrust and weight into the airframe and routes fuel, air, and wiring.',
    specs: ['Carries thrust & weight', 'Routes fuel/air/wiring', 'Fuse-pin safety mounts'],
  },
]

export const ENGINE_PARTS_BY_MODEL = {
  'leap-1a': LEAP_1A_PARTS,
}
