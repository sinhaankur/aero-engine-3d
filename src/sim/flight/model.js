/**
 * Flight-dynamics core for /fly.
 *
 * Physics level: point-mass performance model with attitude kinematics — the
 * same fidelity class as an engineering "performance" model, not a stick-free
 * stability sim. Real ISA atmosphere, real dimensions-derived aero (lift-curve
 * slope from aspect ratio, induced drag from the span, thrust lapse with
 * density), real wind/turbulence layers. Every number the HUD shows (IAS/TAS/
 * Mach/density/OAT) falls out of these equations, not canned values.
 *
 * World frame (matches the three.js scene): x east, y up, z south; heading
 * psi = 0 flies toward −z, positive clockwise viewed from above.
 */

const G = 9.80665
const R_AIR = 287.053
const GAMMA = 1.4
export const RHO0 = 1.225
export const KT = 0.514444 // m/s per knot
export const FT = 0.3048

/* ------------------------------------------------------------------ */
/* ISA atmosphere (troposphere + lower stratosphere, to 20 km)         */
/* ------------------------------------------------------------------ */
export function isa(hM, isaDevC = 0) {
  const h = Math.max(0, Math.min(hM, 20000))
  let T, p
  if (h <= 11000) {
    T = 288.15 - 0.0065 * h
    p = 101325 * Math.pow(T / 288.15, G / (0.0065 * R_AIR))
  } else {
    T = 216.65
    p = 22632 * Math.exp((-G * (h - 11000)) / (R_AIR * T))
  }
  const Tdev = T + isaDevC
  const rho = p / (R_AIR * Tdev) // pressure unchanged, density carries the deviation
  const a = Math.sqrt(GAMMA * R_AIR * Tdev)
  return { T: Tdev, oatC: Tdev - 273.15, p, rho, a, sigma: rho / RHO0 }
}

/* ------------------------------------------------------------------ */
/* Turbofan parameter model — shared by /fly (live) and /simulate      */
/* (static). Given an N1 fraction and the atmosphere, returns the ECAM  */
/* engine readouts. Crude but self-consistent turbofan behaviour.       */
/* ------------------------------------------------------------------ */
export function engineParams(n1raw, atm, t = 0, buffet = 0) {
  const n1 = Math.max(0, n1raw)
  const egt = Math.round(380 + n1 * 340 + (1 - atm.sigma) * 120)      // °C
  const ff = Math.round((300 + n1 * 2400) * Math.pow(atm.sigma, 0.5)) // kg/h per engine
  const n2 = Math.round(58 + n1 * 47)                                  // % HP spool
  const oilP = Math.round(35 + n1 * 55)                                // psi
  const oilT = Math.round(70 + n1 * 55 + (1 - atm.sigma) * 10)         // °C
  const vib = +(0.4 + Math.abs(Math.sin(t * 0.7)) * 0.15 + (n1 < 0.25 ? 0.5 : 0) + buffet * 1.5).toFixed(1)
  return { n1: Math.round(n1 * 100), n2, egt, ff, oilP, oilT, vib, thrustPct: Math.round(n1 * 100) }
}

/* ------------------------------------------------------------------ */
/* Weather: the "actual conditions" catalogue                          */
/* ------------------------------------------------------------------ */
export const WEATHER = {
  clear: {
    name: 'Clear day', isaDev: 0, windKt: 5, windDir: 240, gustKt: 0, turb: 0.05,
    visKm: 60, sky: 'day', blurb: 'ISA standard, light 5 kt breeze.',
  },
  gusty: {
    name: 'Gusty crosswind', isaDev: 0, windKt: 18, windDir: 300, gustKt: 12, turb: 0.4,
    visKm: 40, sky: 'day', blurb: '18 kt gusting 30, 60° off the runway — the classic crosswind workout.',
  },
  storm: {
    name: 'Storm front', isaDev: -5, windKt: 32, windDir: 210, gustKt: 18, turb: 1.0,
    visKm: 6, sky: 'storm', blurb: 'Severe turbulence, 32 kt gusting 50. Airlines would be holding.',
  },
  hot: {
    name: 'Hot & high', isaDev: 28, windKt: 6, windDir: 180, gustKt: 0, turb: 0.15,
    visKm: 30, sky: 'haze', blurb: 'ISA+28 °C: thin air, long takeoff roll, weak climb — density altitude made visible.',
  },
  winter: {
    name: 'Winter ops', isaDev: -25, windKt: 12, windDir: 30, gustKt: 4, turb: 0.2,
    visKm: 25, sky: 'cold', blurb: 'ISA−25 °C: dense air, short roll, strong climb. Cold air is engine power.',
  },
}

/**
 * Wind vector at height, with a real atmospheric boundary layer.
 *
 * The reported `windKt` is the free-stream (≈10 m reference) value. This builds
 * the vertical profile around it:
 *  • Boundary layer: a log-law from the surface roughness up to the BL top
 *    (~600 m over open terrain), so wind is near-zero on the deck and reaches
 *    the free-stream by the top — real wind shear you fly through on approach.
 *  • Above the BL: a gentle power-law increase to ~2× by cruise + a direction
 *    veer with height (Ekman/thermal-wind turning).
 *  • Turbulence: mechanical (rotor) turbulence is STRONGEST near the ground and
 *    decays with height; add an extra kick when low over the runway/buildings.
 *
 * Terrain enters through `terrain`: {roughness, gustBoost} — rougher ground
 * (buildings, hills) gives a fatter log profile and more low-level turbulence.
 */
export function windAt(hM, wx, t, terrain = null) {
  const z0 = terrain?.roughness ?? 0.3   // surface roughness length (m): 0.03 open, 1+ urban
  const blTop = 600                        // boundary-layer top (m AGL)
  const h = Math.max(hM, z0 * 1.1)

  // fraction of free-stream from the log law, saturating at the BL top
  const logFrac = Math.min(1, Math.log(h / z0) / Math.log(blTop / z0))
  // above the BL, a mild power-law increase toward cruise
  const aloft = hM > blTop ? Math.pow(hM / blTop, 0.11) : 1
  const profile = logFrac * aloft

  // direction veers right with height (northern-hemisphere convention)
  const veer = Math.min(hM / 1000, 12) * 8 * (1 - logFrac * 0.4)
  const dir = ((wx.windDir + veer) * Math.PI) / 180

  // turbulence intensity: high near the surface, decaying through the BL
  const surfTurb = Math.max(0, 1 - hM / blTop)                 // 1 on the deck → 0 at BL top
  const terrKick = (terrain?.gustBoost ?? 0) * surfTurb
  const gustAmp = wx.gustKt * (0.4 + surfTurb * 1.1 + terrKick)
  const gust = gustAmp * (Math.sin(t * 0.9) * 0.5 + Math.sin(t * 2.7 + 1.3) * 0.3 + Math.sin(t * 0.23) * 0.2)

  const spd = (wx.windKt * profile + gust) * KT
  // meteorological "from" direction → velocity vector it pushes toward
  return {
    x: -Math.sin(dir) * spd, z: Math.cos(dir) * spd,
    spdKt: spd / KT, dirDeg: (wx.windDir + veer + 360) % 360,
    shear: 1 - logFrac, // 0 aloft, →1 near the deck: how much shear you're in
  }
}

/* ------------------------------------------------------------------ */
/* Aircraft: derive an aero model from the variant's real data         */
/* ------------------------------------------------------------------ */
export function deriveAircraft(aircraft) {
  const d = aircraft.dimensions
  const S = d.wingAreaM2
  const b = d.wingspanM
  const AR = (b * b) / S
  const e = 0.78
  const engineCount = aircraft.familyId === 'a380' ? 4 : 2
  const thrustMax = Math.max(...aircraft.engines.map((en) => en.thrustKn)) * 1000 * engineCount
  const mass = d.mtowKg * 0.85 // typical mid-mission weight
  // finite-wing lift slope (per rad), Helmbold-ish
  const clAlpha = (2 * Math.PI * AR) / (AR + 2)
  return {
    name: aircraft.name,
    S, b, AR, e, mass, thrustMax, engineCount,
    clAlpha,
    cd0: 0.022,
    alpha0: -2 * (Math.PI / 180), // zero-lift AoA (cambered wing)
    alphaStall: 15 * (Math.PI / 180),
    clMaxClean: 1.5,
    mmo: d.cruiseMach + 0.04,
    ceilingM: d.ceilingM,
    // takeoff reference speeds (m/s TAS≈IAS at sea level). Vs at T-O flap
    // (CLmax≈2.1); VR≈1.12·Vs, V1 just below VR, V2 the safe climb-out speed.
    get vsTO() { return Math.sqrt((2 * mass * G) / (RHO0 * S * 2.1)) },
    vr: 1.12 * Math.sqrt((2 * mass * G) / (RHO0 * S * 2.1)),
    v1: 1.08 * Math.sqrt((2 * mass * G) / (RHO0 * S * 2.1)),
    v2: 1.20 * Math.sqrt((2 * mass * G) / (RHO0 * S * 2.1)),
    flaps: [
      { name: 'UP', dCl: 0, dCd: 0 },
      { name: '1', dCl: 0.35, dCd: 0.012 },
      { name: '2', dCl: 0.65, dCd: 0.028 },
      { name: 'FULL', dCl: 1.0, dCd: 0.065 },
    ],
  }
}

/* ------------------------------------------------------------------ */
/* State + integrator                                                  */
/* ------------------------------------------------------------------ */
// Runway geometry shared by the sim and the 3D scene (metres, centred on z=0).
export const RUNWAY = { halfLen: 1600, width: 45, heading: 0, threshold: 1500 }

// Build a runway descriptor from a real length; the sim/scene are centred on
// z=0 so the near threshold sits at +halfLen and departures run toward −z.
export function runwayFor(lenM = 3200) {
  const halfLen = lenM / 2
  return { halfLen, width: 45, heading: 0, threshold: halfLen - 100 }
}

export function createState(ac, rwy = RUNWAY, coldDark = false) {
  // Two start states: "ready" (engines running, cleared to roll — the quick
  // default) or "cold & dark" (everything off; you run the real startup flow).
  const running = !coldDark
  return {
    // position of the gear/CG reference over the world, h = gear height AGL.
    // Spawn on the runway threshold, on the centreline, lined up down −z.
    x: 0, z: rwy.threshold, h: 0,
    v: 0,            // TAS m/s
    psi: 0,          // heading rad, 0 = down the runway (−z)
    gamma: 0,        // flight-path angle
    alpha: 0, phi: 0,
    theta: 0,
    throttle: 0,
    flap: 1,         // takeoff flap preselected
    gear: true,
    brakes: true,    // park brake set on the threshold, real-sim style
    speedbrake: 0,   // 0..1 spoiler/speedbrake deployment
    onGround: true,
    stalled: false, buffet: 0,
    crashed: false, landedHard: false, touchdownVs: null,
    t: 0,
    fuelKg: ac ? ac.mass * 0.12 : 8000,
    coldDark,

    // flight phase for ATC / coaching: parked → takeoff → climb → cruise →
    // descent → approach → landed
    phase: 'parked', airborneOnce: false,

    // --- engines: master switches, run state + spool (N1 fraction 0..1) ---
    // `started` = the engine has lit and is self-sustaining at/above idle.
    eng1Master: running, eng2Master: running,
    eng1Started: running, eng2Started: running,
    eng1N1: running ? 0.2 : 0, eng2N1: running ? 0.2 : 0,
    eng1StartTimer: 0, eng2StartTimer: 0, // seconds since start initiated
    engStartValve: false,                 // overhead ENG start selector (mode SEL)

    // --- overhead systems ---
    apuMaster: !coldDark, apuRunning: !coldDark,
    beacon: running, navLights: running, strobe: false, landingLights: running,
    fuelPump1: running, fuelPump2: running,
    seatbeltSign: true,

    // --- autopilot / FCU (Airbus flight control unit) ---
    apOn: false, athrOn: false,
    fcuSpd: 250,          // selected speed (kt)
    fcuHdg: 0,            // selected heading (deg)
    fcuAlt: 10000,        // selected altitude (ft)
    fcuVs: 0,             // selected vertical speed (fpm)
    apVsMode: false,      // true = V/S mode, false = ALT capture/hold
    apHdgMode: false,     // true = HDG select engaged
    apAlt: null,          // captured ALT hold target (m), legacy field kept
  }
}

/**
 * Autopilot / autothrust driver. When AP or A/THR is engaged, this overwrites
 * the relevant control channels from the FCU targets each frame, before the
 * physics step. Mirrors the Airbus split: AP flies pitch+roll, A/THR flies
 * speed via the thrust levers. Returns nothing; mutates `controls`.
 */
export function autoflight(s, ac, controls, out, dt) {
  // --- A/THR: hold FCU speed by trimming throttle toward target IAS ---
  if (s.athrOn && !s.onGround) {
    const iasKt = out ? out.iasKt : 0
    const err = s.fcuSpd - iasKt
    controls.throttle = Math.max(0, Math.min(1, controls.throttle + err * 0.004 * dt * 60))
  }
  if (!s.apOn) return
  // --- AP roll channel: HDG select ---
  if (s.apHdgMode) {
    let dpsi = s.fcuHdg - (((s.psi * 180) / Math.PI) % 360 + 360) % 360
    if (dpsi > 180) dpsi -= 360
    if (dpsi < -180) dpsi += 360
    controls.roll = Math.max(-0.6, Math.min(0.6, dpsi * 0.03))
  } else {
    controls.roll = 0 // wings level
  }
  // --- AP pitch channel: V/S or ALT capture/hold ---
  const altFt = s.h / FT
  const vsFpm = out ? out.vsFpm : 0
  const altErr = s.fcuAlt - altFt
  if (s.apVsMode && Math.abs(altErr) > 120) {
    // hold selected V/S, but don't blow through the selected altitude
    const vsCmd = Math.sign(altErr) === Math.sign(s.fcuVs) || s.fcuVs === 0 ? s.fcuVs : 0
    controls.pitch = Math.max(-0.6, Math.min(0.6, (vsCmd - vsFpm) * 0.00035))
  } else {
    // ALT capture/hold toward FCU altitude
    controls.pitch = Math.max(-0.5, Math.min(0.5, altErr * 0.004 - vsFpm * 0.0004))
  }
}

/**
 * One integration step. controls: {pitch −1..1 (pull +), roll −1..1,
 * yaw −1..1, throttle 0..1, flap idx, gear bool, brakes bool,
 * speedbrake 0..1}.
 * Returns derived readouts for the HUD.
 */
export function stepFlight(s, ac, controls, wx, dt) {
  dt = Math.min(dt, 0.05)
  s.t += dt
  const atm = isa(s.h, wx.isaDev)

  // Terrain under the aircraft: rougher + gustier near the airport (buildings
  // within ~2.5 km of the field) than out over open country. Drives the wind
  // boundary layer and low-level (mechanical/rotor) turbulence.
  const nearField = Math.hypot(s.x, Math.abs(s.z) - 1500) < 2500
  const terrain = nearField
    ? { roughness: 0.8, gustBoost: 0.6 }   // built-up airport environment
    : { roughness: 0.2, gustBoost: 0.15 }  // open terrain
  const wind = windAt(s.h, wx, s.t, terrain)

  // --- controls → attitude rates ---
  // Base turbulence from the weather, amplified low down where mechanical
  // turbulence off the terrain is strongest (wind.shear → 1 near the deck).
  const lowLevel = 1 + wind.shear * (1.2 + (terrain.gustBoost * 2))
  const turb = wx.turb * lowLevel * (Math.sin(s.t * 5.1) * 0.4 + Math.sin(s.t * 11.7 + 2) * 0.35 + Math.sin(s.t * 2.3 + 5) * 0.25)
  s.throttle = controls.throttle
  s.flap = controls.flap
  s.gear = controls.gear
  s.brakes = controls.brakes
  if (controls.speedbrake != null) s.speedbrake = controls.speedbrake

  const flap = ac.flaps[s.flap]

  // --- engine start + spool ---
  // A real start needs: master ON, fuel to that side, and a bleed-air source to
  // spin the starter — the APU, or the OTHER engine already running (cross-bleed).
  // With that, the engine lights and self-sustains at idle after a short crank;
  // then N1 follows the throttle. No start source ⇒ the engine can't run.
  const spool = (n1, target, up) => n1 + (target - n1) * Math.min(1, dt / (up ? 2.2 : 3.5))
  const stepEngine = (masterK, fuelOK, startedK, timerK, n1K, otherStarted) => {
    const master = s[masterK]
    const started = s[startedK]
    const bleed = s.apuRunning || otherStarted   // APU or cross-bleed
    if (!master || !fuelOK) {
      // shutdown / no fuel: spool down to zero and mark not started
      s[startedK] = false; s[timerK] = 0
      s[n1K] = Math.max(0, spool(s[n1K], 0, false))
      return
    }
    if (!started) {
      if (bleed) {
        // cranking: starter drags N1 up; light-off ~8 s, idle by ~25 s
        s[timerK] += dt
        const crank = Math.min(0.2, (s[timerK] / 25) * 0.2)
        s[n1K] = Math.max(s[n1K], crank)
        if (s[timerK] > 25) s[startedK] = true
      } else {
        // no start source — windmill only, decays
        s[timerK] = 0
        s[n1K] = Math.max(0, spool(s[n1K], 0, false))
      }
      return
    }
    // running: N1 follows the thrust lever above idle
    const target = 0.2 + s.throttle * 0.78
    s[n1K] = Math.max(0, spool(s[n1K], target, target > s[n1K]))
  }
  stepEngine('eng1Master', s.fuelPump1, 'eng1Started', 'eng1StartTimer', 'eng1N1', s.eng2Started)
  stepEngine('eng2Master', s.fuelPump2, 'eng2Started', 'eng2StartTimer', 'eng2N1', s.eng1Started)
  // fraction of installed thrust actually available (average of live engines)
  const perEng = ac.thrustMax / Math.max(ac.engineCount, 1)
  const liveN1 = [s.eng1N1, s.eng2N1].reduce((a, b) => a + Math.max(0, (b - 0.2) / 0.78), 0)
  const thrustAvail = perEng * (ac.engineCount / 2) * Math.max(0, liveN1)

  if (!s.onGround) {
    // bank: rate-command, max ~30°/s, capped at 67° (protections-ish)
    s.phi += controls.roll * 0.9 * dt + turb * 0.15 * dt
    s.phi = Math.max(-1.17, Math.min(1.17, s.phi))
    if (Math.abs(controls.roll) < 0.02) s.phi *= Math.pow(0.5, dt / 1.2) // spiral damping toward level
  } else {
    s.phi = 0
  }

  // AoA: pitch input commands alpha (FBW-flavoured), turbulence jitters it.
  // On the ground the gear pins the deck angle low until you rotate: alpha is
  // held near the ground-run value and only builds when you pull back AT/after
  // VR (nose-up authority grows with speed), so the jet flies off near VR the
  // way it should — not 50 kt late.
  let alphaCmd
  if (s.onGround) {
    const canRotate = s.v > ac.vr * 0.92 ? 1 : Math.max(0, (s.v - ac.vr * 0.6) / (ac.vr * 0.32))
    alphaCmd = 0.015 + Math.max(0, controls.pitch) * 0.19 * canRotate
  } else {
    alphaCmd = 0.06 + controls.pitch * 0.14
  }
  s.alpha += (alphaCmd - s.alpha) * Math.min(1, dt * 2.5) + turb * 0.01
  const effStall = ac.alphaStall + (flap.dCl > 0 ? 0.02 : 0)

  // --- aero forces ---
  let cl = ac.clAlpha * (s.alpha - ac.alpha0) + flap.dCl
  const clMax = ac.clMaxClean + flap.dCl
  s.stalled = s.alpha > effStall
  if (s.stalled) {
    const over = (s.alpha - effStall) / 0.12
    cl = Math.max(clMax * (1 - 0.55 * Math.min(over, 1)), 0.4)
  }
  cl = Math.min(cl, clMax)
  const q = 0.5 * atm.rho * s.v * s.v
  const cd = ac.cd0 + flap.dCd + (s.gear ? 0.02 : 0) + s.speedbrake * 0.06 + (cl * cl) / (Math.PI * ac.AR * ac.e)
  // spoilers also spoil lift when deployed
  const clSpoiled = cl * (1 - s.speedbrake * 0.35)
  const L = q * ac.S * clSpoiled
  const D = q * ac.S * cd
  // thrust: available (engine-gated) thrust scaled by density lapse
  const T = thrustAvail * Math.pow(atm.sigma, 0.72)
  const W = ac.mass * G

  // --- point-mass equations ---
  if (s.onGround) {
    const mu = s.brakes ? 0.32 : 0.02
    const Nforce = Math.max(W - L, 0)
    const acc = (T - D - mu * Nforce) / ac.mass
    s.v = Math.max(0, s.v + acc * dt)
    s.gamma = 0
    // nosewheel steering below 60 kt, rudder above
    s.psi += controls.yaw * (s.v < 30 ? 0.35 : 0.06) * dt * Math.min(s.v / 8, 1)
    // rotation & liftoff: once past VR with the nose coming up and lift beating
    // weight, the gear leaves the ground and we establish a shallow initial climb
    if (L > W * 0.98 && s.v > ac.vr * 0.95 && s.alpha > 0.05) {
      s.onGround = false
      s.gamma = 0.04
    }
  } else {
    const vDot = (T * Math.cos(s.alpha) - D) / ac.mass - G * Math.sin(s.gamma)
    const gammaDot = (L * Math.cos(s.phi) + T * Math.sin(s.alpha) * Math.cos(s.phi)) / (ac.mass * Math.max(s.v, 30)) - (G * Math.cos(s.gamma)) / Math.max(s.v, 30)
    const psiDot = (L * Math.sin(s.phi)) / (ac.mass * Math.max(s.v, 30) * Math.cos(s.gamma || 0.001))
    s.v = Math.max(20, s.v + vDot * dt)
    s.gamma += gammaDot * dt + turb * 0.004
    // Energy limit: a jet can't climb steeper than its excess thrust allows —
    // sustained climb angle ≈ (T − D)/W. Cap gamma to that (plus a little for
    // trading kinetic energy) so full-alpha pulls give a realistic ~10–15°
    // climb that bleeds speed, not a 7000 fpm rocket. Descent isn't power-limited.
    const gammaMax = Math.min(0.18, Math.max(0.02, (T - D) / W * 0.7 + 0.04))
    s.gamma = Math.max(-0.35, Math.min(gammaMax, s.gamma))
    s.psi += psiDot * dt
  }
  s.theta = s.gamma + s.alpha
  s.buffet = s.stalled ? 1 : Math.max(0, s.buffet - dt * 3)

  // --- integrate position (air velocity + wind drift) ---
  const vx = s.v * Math.cos(s.gamma) * Math.sin(s.psi) + (s.onGround ? 0 : wind.x)
  const vz = -s.v * Math.cos(s.gamma) * Math.cos(s.psi) + (s.onGround ? 0 : wind.z)
  const vy = s.v * Math.sin(s.gamma)
  s.x += vx * dt
  s.z += vz * dt
  s.h = Math.max(0, s.h + vy * dt)

  // --- touchdown / crash ---
  if (!s.onGround && s.h <= 0.01) {
    const vsFpm = vy / FT * 60
    s.touchdownVs = Math.round(vsFpm)
    if (vsFpm < -900 || Math.abs(s.phi) > 0.25) {
      s.crashed = true
    } else {
      s.onGround = true
      s.landedHard = vsFpm < -500
      s.gamma = 0
      s.h = 0
    }
  }

  // --- fuel burn: crude TSFC ~ 15 g/kN·s ---
  s.fuelKg = Math.max(0, s.fuelKg - (T / 1000) * 0.015 * dt)

  // --- flight phase (drives ATC + coaching) ---
  const vsFpmNow = (vy / FT) * 60
  if (!s.onGround) s.airborneOnce = true
  if (s.onGround) {
    s.phase = s.airborneOnce ? 'landed' : (s.v > 3 ? 'takeoff' : 'parked')
  } else if (s.h / FT < 1500 && s.airborneOnce && vsFpmNow < -200) {
    s.phase = 'approach'
  } else if (vsFpmNow > 200) {
    s.phase = 'climb'
  } else if (vsFpmNow < -200) {
    s.phase = 'descent'
  } else {
    s.phase = 'cruise'
  }

  // --- readouts ---
  const tas = s.v
  const iasKt = (tas * Math.sqrt(atm.sigma)) / KT
  const mach = tas / atm.a
  const eng = (n1raw) => engineParams(n1raw, atm, s.t, s.buffet)
  return {
    atm, wind,
    iasKt,
    tasKt: tas / KT,
    mach,
    altFt: s.h / FT,
    vsFpm: (vy / FT) * 60,
    hdg: (((s.psi * 180) / Math.PI) % 360 + 360) % 360,
    n1: Math.round((s.eng1N1 + s.eng2N1) * 50),
    eng1: eng(s.eng1N1),
    eng2: eng(s.eng2N1),
    L, D, T, W,
    overspeed: mach > ac.mmo || iasKt > 350,
    aoaDeg: (s.alpha * 180) / Math.PI,
  }
}
