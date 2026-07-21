/**
 * Components database: how each major part of an airliner is actually built —
 * material, manufacturing process, the industrial technology you'd need to
 * make one, indicative cost, and who builds it today.
 *
 * Costs are indicative public estimates (teardown reports, MRO price lists,
 * analyst coverage) — real contract prices are confidential and heavily
 * discounted. They're here to give scale, not procurement data.
 */

export const COMPONENT_GROUPS = ['Airframe', 'Propulsion', 'Systems', 'Interior']

export const COMPONENTS = [
  /* ---------------- Airframe ---------------- */
  {
    id: 'wing-box',
    name: 'Wing box & wing skins',
    group: 'Airframe',
    material: 'Al-Li 2050 / 7000-series plate (A320, 737); carbon-fibre composite (A350, 787 — ~53% of the A350 by weight)',
    process:
      'Metal wings: skins machined from single billets on 30 m gantry mills, stringers riveted by automatic drilling machines. ' +
      'Composite wings: automated fibre placement (AFP) robots lay carbon tape over a mould, cured in a 30 m autoclave, then trimmed and drilled by robot.',
    technology: 'Gantry milling or AFP robots + autoclave, shot-peen forming for skin curvature, non-destructive ultrasonic inspection of every panel.',
    cost: '≈ $15–25M per shipset (analyst estimates)',
    suppliers: ['Airbus Broughton (UK)', 'Spirit AeroSystems', 'Boeing Composite Wing Center (Everett)'],
    usedOn: 'Every variant in the archive — the single most valuable structure on the aircraft.',
    note: 'The wing box doubles as the main fuel tank, which is why sealant application (fay-surface + fillet) is a certified trade of its own.',
    design: {
      driver:
        'The wing is sized to carry the whole aircraft weight as LIFT, then multiplied by the ' +
        'limit load factor (2.5 g for airliners, CS-25.337) and again by 1.5 for ultimate load. ' +
        'Bending at the wing root — weight × span — is the load case that sets spar thickness.',
      equation:
        'Lift  L = ½ ρ V² S CL  (must equal n·W).  Wing loading  W/S sets stall + cruise speed.  ' +
        'Root bending moment  M ≈ (n·W/2) · (b/4)  →  spar cap stress σ = M·c / I.',
      example:
        'A320: W ≈ 73,500 kg, S = 122.6 m² → wing loading W/S ≈ 600 kg/m². At the 2.5 g limit the ' +
        'wing lifts 2.5·73.5 t ≈ 184 t; each half (~92 t) acts ~9 m out, so root bending M ≈ 92,000·9.81·9 ' +
        '≈ 8.1 MN·m — carried by the spar caps, then ×1.5 for ultimate. That is why the root skin is ~cm-thick plate.',
    },
  },
  {
    id: 'fuselage-barrel',
    name: 'Fuselage barrels & panels',
    group: 'Airframe',
    material: 'Al 2024 skins with 7075 frames/stringers; CFRP one-piece barrels on the 787; CFRP panels on the A350',
    process:
      'Skins stretch-formed over dies, chemically milled to shave weight, then joined to frames by automated riveting machines (thousands of rivets per section). ' +
      'Composite barrels are wound in one piece around a mandrel, cured, then window/door cutouts are machined.',
    technology: 'Stretch presses, chem-milling lines or AFP + 20 m-class autoclave, automated riveters, laser tracker alignment for section join.',
    cost: '≈ $8–15M per shipset of sections',
    suppliers: ['Premium Aerotec (DE)', 'Spirit AeroSystems (Wichita)', 'Leonardo (IT)', 'KHI/MHI (JP)'],
    usedOn: 'All variants; the E2 and A220 keep metal fuselages with composite empennages.',
    note: 'Pressurisation cycles size everything: a short-haul 737/A320 fuselage sees ~40,000+ cycles in a life — fatigue, not strength, drives the design.',
    design: {
      driver:
        'The fuselage is a pressure vessel. Cabin altitude is held near 8,000 ft while the aircraft ' +
        'cruises at 40,000 ft, so the skin carries a pressure difference every flight. Fatigue from ' +
        '~40,000 pressurise/depressurise CYCLES — not a single overload — sets skin thickness + crack-stopping frames.',
      equation:
        'Hoop stress in a thin cylinder  σθ = p·R / t   (this is the big one).  ' +
        'Longitudinal stress  σx = p·R / (2t)  — exactly half. Fatigue life ~ (stress range)^−m.',
      example:
        'A320: cabin Δp ≈ 0.58 bar = 58 kPa, fuselage radius R ≈ 1.98 m. For a skin t ≈ 2 mm, ' +
        'hoop stress σθ = 58,000·1.98 / 0.002 ≈ 57 MPa per cycle. Aluminium yields ~300 MPa, so it is ' +
        'strong enough once — but 40,000 cycles is why doublers, bonded frames and crack-arrest straps exist.',
    },
  },
  {
    id: 'empennage',
    name: 'Empennage (fin + stabiliser)',
    group: 'Airframe',
    material: 'CFRP monolithic skins and spars — the A320 fin (1988) was the first large composite primary structure on a mass-produced airliner',
    process: 'Prepreg layup or resin infusion in heated moulds, autoclave cure, lightning-protection copper mesh co-cured into the outer ply.',
    technology: 'Autoclave + NDI; lightning strike certification testing (a fin takes the exit stroke).',
    cost: '≈ $3–6M per shipset',
    suppliers: ['Airbus Stade (DE)', 'Aernnova (ES)', 'Embraer Évora (PT)'],
    usedOn: 'All variants in the archive.',
    note: 'The horizontal stabiliser is also a trim fuel tank on long-haul Airbus types — CG control in cruise cuts drag.',
    design: {
      driver:
        'The tail is sized for CONTROL and STABILITY, not to carry weight. The fin must hold the ' +
        'aircraft straight after an engine fails on takeoff (max yaw); the horizontal stabiliser must ' +
        'keep it stable and trimmable across the whole CG range. Both are set by "tail volume".',
      equation:
        'Tail volume coefficient  V̄H = (SH · lH) / (S · c̄)  and  V̄V = (SV · lV) / (S · b).  ' +
        'Bigger tail area SH/SV or longer arm l → more authority. Airliners: V̄H ≈ 0.9–1.2, V̄V ≈ 0.06–0.09.',
      example:
        'A320: horizontal tail SH ≈ 31 m², arm lH ≈ 13.5 m, wing S = 122.6 m², MAC c̄ ≈ 4.29 m → ' +
        'V̄H = (31·13.5)/(122.6·4.29) ≈ 0.80. That number — not a load — is what a designer tunes first, ' +
        'trading a bigger tail (weight + drag) against a longer, heavier fuselage to reach the same arm.',
    },
  },
  {
    id: 'landing-gear',
    name: 'Landing gear',
    group: 'Airframe',
    material: '300M ultra-high-strength steel (main fittings), Ti-10V-2Fe-3Al truck beams, HVOF tungsten-carbide coatings replacing hard chrome',
    process: 'Closed-die forging of metre-scale billets, deep machining, shot peening for fatigue life, HVOF spray, then assembly with oleo-pneumatic shock absorbers.',
    technology: '30,000-tonne class forging presses (only a handful exist worldwide), precision grinding, drop-test rigs certified to CS-25.723.',
    cost: '≈ $1–3M per narrowbody shipset; A380 gear ≈ $20M+',
    suppliers: ['Safran Landing Systems', 'Collins Aerospace', 'Héroux-Devtek'],
    usedOn: 'All variants; the 737\'s short legs are why its LEAP-1B fan is smaller than the A320neo\'s.',
    note: 'Gear is designed for a hard landing at max landing weight and full fuel jettison failure — it is the most over-engineered structure on board.',
    design: {
      driver:
        'The shock strut is sized to absorb the KINETIC ENERGY of a hard landing at max landing weight ' +
        'and the certification sink rate (3.05 m/s ≈ 600 fpm, CS-25.723) without exceeding a set g on the ' +
        'airframe. Energy, not static weight, sets the oleo stroke and gas pressure.',
      equation:
        'Vertical energy at touchdown  E = ½ · m · Vsink².  Absorbed over stroke s at load factor n:  ' +
        'E ≈ n · m · g · (s · η)  (η ≈ 0.8 oleo efficiency)  →  solve for stroke s.',
      example:
        'A320 max landing ~64,500 kg at Vsink = 3.05 m/s: E = ½·64,500·3.05² ≈ 300 kJ — a small car at ' +
        '~55 km/h, in the last 0.3 s of the flight. To hold ~2 g through the airframe the oleo needs a ' +
        'stroke around s ≈ E/(n·m·g·η) ≈ 300,000/(2·64,500·9.81·0.8) ≈ 0.30 m of compressing gas + oil.',
    },
  },
  {
    id: 'radome',
    name: 'Radome & nose',
    group: 'Airframe',
    material: 'Quartz or fibreglass skins over Nomex honeycomb — must be transparent to the weather-radar X-band',
    process: 'Hand layup or AFP over a female mould, cured, painted with anti-static coating, fitted with lightning diverter strips.',
    technology: 'Transmissivity testing (the radome is an RF window first, structure second), bird-strike certification at cruise speed.',
    cost: '≈ $100–300k each',
    suppliers: ['Collins Aerospace', 'Airbus Composites España'],
    usedOn: 'All variants.',
    note: 'A repainted radome with too many paint layers can blind the weather radar — thickness is controlled to fractions of the radar wavelength.',
    design: {
      driver:
        'The radome is an RF WINDOW first, structure second: it must pass the X-band weather radar ' +
        'through it with minimal reflection, while surviving a bird strike at cruise. The wall thickness ' +
        'is tuned to the radar wavelength so the reflections cancel.',
      equation:
        'Radar wavelength  λ = c / f.  A "half-wave wall" is transparent when  t = N · λ / (2·√εr)  ' +
        '(N integer, εr = dielectric constant). Bird-strike energy  E = ½ m v² sets the skin/core.',
      example:
        'Weather radar at f ≈ 9.4 GHz → λ = 3e8/9.4e9 ≈ 32 mm. With a composite εr ≈ 4, a half-wave wall ' +
        'is t = 32/(2·√4) ≈ 8 mm — which is why adding a few coats of paint (each a fraction of a mm at the ' +
        'wrong dielectric) measurably degrades the radar. A 1.8 kg bird at 150 m/s also carries ~20 kJ it must take.',
    },
  },

  /* ---------------- Propulsion ---------------- */
  {
    id: 'fan-blade',
    name: 'Fan blade',
    group: 'Propulsion',
    material: '3D-woven carbon composite with titanium leading edge (LEAP); hollow super-plastically formed titanium (Trent, PW GTF)',
    process:
      'LEAP: carbon fibre is 3D-woven like fabric on Jacquard looms, resin-injected (RTM), machined, then a forged Ti edge is bonded on. ' +
      'Trent: two titanium skins with an internal warren girder are inflated and diffusion-bonded at 900 °C (SPF/DB).',
    technology: '3D weaving looms + RTM presses, or SPF/DB furnaces; every blade is X-rayed, ultrasounded and moment-weighed for balance.',
    cost: '≈ $30–60k per blade; a LEAP fan set ≈ $1M',
    suppliers: ['Safran/Albany (Commercy, Rochester)', 'Rolls-Royce (Barnoldswick)', 'Pratt & Whitney'],
    usedOn: 'LEAP-1A/1B (A320neo, 737 MAX), Trent XWB (A350), PW1100G/1500G/1900G (neo, A220, E2).',
    note: 'A fan blade-off event must be contained — the certification test destroys a full engine on purpose (see the fan case).',
  },
  {
    id: 'fan-case',
    name: 'Fan case & containment',
    group: 'Propulsion',
    material: 'Woven CFRP case (LEAP, GEnx) or aluminium/steel case with Kevlar wrap (older turbofans)',
    process: 'Braiding machines weave a carbon sock over a full-diameter mandrel, RTM-cured; acoustic honeycomb liners bonded inside.',
    technology: '2 m+ braiding/RTM tooling; blade-off containment test — an explosive bolt releases a blade at full RPM and the case must hold.',
    cost: '≈ $1–2M each',
    suppliers: ['Safran Aircraft Engines', 'GE Batesville', 'GKN Aerospace'],
    usedOn: 'All engines in the catalogue.',
    note: 'Containment is why fan cases weigh what a small car does: the released blade carries the energy of a truck at highway speed.',
  },
  {
    id: 'hpt-blade',
    name: 'High-pressure turbine blade',
    group: 'Propulsion',
    material: 'Single-crystal nickel superalloy (CMSX-4 / René N5 class) with EB-PVD thermal-barrier ceramic coating',
    process:
      'Investment (lost-wax) casting in vacuum furnaces where the entire blade solidifies as ONE crystal — no grain boundaries to creep. ' +
      'Hundreds of film-cooling holes are then drilled by laser/EDM, and the ceramic coat is vapour-deposited.',
    technology: 'Directional-solidification vacuum foundries (fewer than a dozen firms on Earth can do this), 5-axis laser drilling, coating EB-PVD chambers.',
    cost: '≈ $5–15k per blade — a full HPT set costs more than a supercar',
    suppliers: ['PCC Airfoils', 'Howmet Aerospace', 'Rolls-Royce Rotatives', 'Safran'],
    usedOn: 'Every turbofan in the catalogue.',
    note: 'These blades run in gas ~400 °C HOTTER than their own melting point, kept alive purely by film cooling and the ceramic coat.',
  },
  {
    id: 'combustor',
    name: 'Combustor',
    group: 'Propulsion',
    material: 'Hastelloy X / Haynes 188 sheet, ceramic matrix composite (CMC) liners on the newest cores',
    process: 'Sheet-metal rings laser-cut, rolled and welded; thousands of effusion cooling holes laser-drilled at precise angles; TAPS/lean-burn fuel nozzles additively manufactured (3D-printed on LEAP).',
    technology: 'Laser drilling, additive manufacturing (LEAP fuel nozzles were the first flight-critical 3D-printed part), emissions rigs for NOx certification.',
    cost: '≈ $500k–1M each',
    suppliers: ['GE Aviation', 'Safran', 'MTU Aero Engines'],
    usedOn: 'All engines; LEAP\'s TAPS II combustor is why it meets CAEP/8 NOx with margin.',
    note: 'The combustor is where the 3D-printing revolution entered jet engines: 20 parts became 1, 25% lighter, 5× more durable.',
  },
  {
    id: 'gtf-gearbox',
    name: 'GTF reduction gearbox',
    group: 'Propulsion',
    material: 'Case-hardened steel star gears in a planetary (star) arrangement, journal bearings',
    process: 'Precision gear grinding to sub-micron tolerance, superfinishing; the gearbox transmits ~30,000 hp through five star gears with 99.5%+ efficiency.',
    technology: 'Gear metrology at aerospace scale — P&W spent ~20 years and ~$10B developing it.',
    cost: 'Part of the ≈ $12–15M engine; the module itself ≈ $1M',
    suppliers: ['Pratt & Whitney (with Fiat Avio heritage)'],
    usedOn: 'PW1100G (A320neo), PW1500G (A220), PW1900G (E190/195-E2).',
    note: 'The gear lets the fan spin ~3× slower than the turbine — each at its own best speed. That single idea is worth ~16% fuel burn.',
  },
  {
    id: 'nacelle',
    name: 'Nacelle & thrust reverser',
    group: 'Propulsion',
    material: 'CFRP outer cowls, acoustic honeycomb sandwich liners, titanium firewall zones',
    process: 'Composite layup for cowls; reverser cascades resin-transfer moulded; acoustic liners drilled with millions of Helmholtz-resonator holes tuned to fan-blade-passing frequency.',
    technology: 'Acoustic engineering + composite production; fire-zone certification (15 min at 1100 °C flame).',
    cost: '≈ $2–4M per shipset',
    suppliers: ['Safran Nacelles', 'Collins Aerospace (ex-Rohr)', 'Spirit AeroSystems'],
    usedOn: 'All variants; the A320neo offers two different nacelle/engine combos (LEAP vs GTF).',
    note: 'Those chevron-free smooth inlets on the neo/MAX are acoustically tuned — the nacelle is as much a silencer as a fairing.',
  },
  {
    id: 'apu',
    name: 'APU (auxiliary power unit)',
    group: 'Propulsion',
    material: 'Small gas turbine: nickel alloy hot section, aluminium gearbox and load compressor',
    process: 'Built like a miniature jet engine — investment-cast turbine wheels, machined impellers — rated for start at 41,000 ft.',
    technology: 'Small-turbomachinery design; certification for unattended operation in the tailcone fire zone.',
    cost: '≈ $0.7–1.5M each',
    suppliers: ['Honeywell (131-9 family)', 'Pratt & Whitney (APS3200)'],
    usedOn: 'All variants — it lives in the tailcone (see it in Explore mode) and supplies ground power + engine-start air.',
    note: 'ETOPS rules treat the APU as a backup generator over oceans — its reliability numbers are tracked like an engine\'s.',
  },

  /* ---------------- Systems ---------------- */
  {
    id: 'cockpit-avionics',
    name: 'Cockpit & avionics',
    group: 'Systems',
    material: 'Integrated modular avionics (IMA) cabinets, LCD display units, quartz/MEMS inertial references',
    process: 'Hardware built to DO-254, software to DO-178C Level A — every line of flight-critical code is requirements-traced and independently verified.',
    technology: 'The bottleneck is certification engineering: a flight-control computer\'s software costs more to verify than to write, by far.',
    cost: '≈ $3–6M per shipset',
    suppliers: ['Thales', 'Honeywell', 'Collins Aerospace', 'GE Aerospace (avionics)'],
    usedOn: 'All variants; the E2 runs Honeywell Primus Epic 2, Airbus mixes Thales/Honeywell IMA.',
    note: 'The avionics live in the E/E bay under the cockpit floor — X-ray it in Explore mode. Dual/triple dissimilar redundancy everywhere.',
  },
  {
    id: 'flight-controls',
    name: 'Fly-by-wire actuators',
    group: 'Systems',
    material: 'Hydraulic servo-actuators; electro-hydrostatic actuators (EHA) on A380/A350 with local electric pumps',
    process: 'Precision-machined servo valves (clearances under 1 µm), assembled in clean rooms, endurance-tested for millions of cycles.',
    technology: 'Servo-valve manufacturing is a black art owned by a handful of firms; EHAs add power electronics rated for the hydraulic-loss case.',
    cost: '≈ $1.5–3M per shipset',
    suppliers: ['Moog', 'Parker Meggitt', 'Liebherr Aerospace', 'Safran Electronics'],
    usedOn: 'All Airbus/E2 (full FBW); 737 keeps cable-driven controls with hydraulic boost — compare in /systems.',
    note: 'An A320 elevator actuator responds to a computer command in milliseconds and can override a jammed partner — that architecture is the heart of FBW.',
  },
  {
    id: 'fuel-system',
    name: 'Fuel system & tanks',
    group: 'Systems',
    material: 'The wing box itself (wet wing) sealed with polysulphide sealant; AC pumps, capacitance gauging probes',
    process: 'Sealers work inside the tank through hand-holes applying fillet seals along every fastener row; pumps and FQIS probes installed through access panels.',
    technology: 'Intrinsically-safe electrics (post-TWA800 rules), nitrogen inerting systems (flammability reduction) on all modern types.',
    cost: '≈ $1–2M per shipset (pumps, valves, gauging)',
    suppliers: ['Collins Aerospace', 'Eaton', 'Parker', 'Safran'],
    usedOn: 'All variants — watch it live in /simulate → Fuel system.',
    note: 'Fuel is also the coolant (oil heat exchangers) and the trim ballast (A330/A350 tail tank). Nothing on an airliner does only one job.',
  },
  {
    id: 'electrics-hydraulics',
    name: 'Electrical & hydraulic power',
    group: 'Systems',
    material: 'Engine-driven generators (90–150 kVA), 3,000 psi hydraulic pumps (5,000 psi on A380/A350 to save pipe weight), RAT emergency turbine',
    process: 'Generator rotors balanced to aerospace grade; hydraulic lines cold-bent titanium; the RAT is drop-tested to deploy in under 2 seconds.',
    technology: 'Power-density engineering: the 787 went "more-electric" (no bleed air) with 1.45 MW of generation — the direction of travel for the industry.',
    cost: '≈ $2–4M per shipset',
    suppliers: ['Safran Electrical & Power', 'Collins', 'Eaton', 'Parker'],
    usedOn: 'All variants — the /systems page animates the A320\'s green/blue/yellow hydraulics and the electrical bus tree.',
    note: 'Lose both engines and the RAT (a pop-out wind turbine the size of a bar stool) keeps flight controls and instruments alive.',
  },

  /* ---------------- Interior ---------------- */
  {
    id: 'cabin-interior',
    name: 'Cabin interior & seats',
    group: 'Interior',
    material: 'Phenolic-resin fibreglass/Nomex honeycomb panels (self-extinguishing), 16g-certified seat frames in aluminium/titanium',
    process: 'Honeycomb panels crushed-core formed and decorated; every material passes CS-25.853 flammability, smoke and toxicity tests; seats dynamically sled-tested at 16g.',
    technology: 'Flammability labs and dynamic test sleds; lightweight engineering — every kilogram of cabin costs ~0.03 kg of fuel per flight hour.',
    cost: 'Economy seat ≈ $4–10k, lie-flat business seat ≈ $250–500k each; a widebody cabin ≈ $30M+',
    suppliers: ['Safran Seats', 'Collins Interiors', 'Recaro', 'Diehl Aviation'],
    usedOn: 'All variants — seat counts in each variant\'s data are the certified exit-limit and typical layouts.',
    note: 'A lie-flat seat has more certified mechanisms than the cockpit door — which is why one seat can cost as much as a house.',
  },
]

export function getComponent(id) {
  return COMPONENTS.find((c) => c.id === id) || null
}
