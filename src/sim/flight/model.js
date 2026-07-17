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
 * Wind vector at altitude: power-law growth off the surface value plus a
 * slow direction veer with height, gusts as a bounded random walk.
 */
export function windAt(hM, wx, t) {
  const scale = Math.pow(Math.max(hM, 2) / 10, 0.14) // ~×2 by cruise
  const veer = Math.min(hM / 1000, 12) * 2 // deg of veer per km, capped
  const dir = ((wx.windDir + veer) * Math.PI) / 180
  const gust = wx.gustKt * (Math.sin(t * 0.9) * 0.5 + Math.sin(t * 2.7 + 1.3) * 0.3 + Math.sin(t * 0.23) * 0.2)
  const spd = (wx.windKt * scale + gust) * KT
  // meteorological "from" direction → velocity vector it pushes toward
  return { x: -Math.sin(dir) * spd, z: Math.cos(dir) * spd, spdKt: spd / KT, dirDeg: (wx.windDir + veer + 360) % 360 }
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
    vr: 1.12 * Math.sqrt((2 * mass * G) / (RHO0 * S * 2.1)), // rotate speed w/ T-O flap
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
export function createState(ac) {
  return {
    // position of the gear/CG reference over the world, h = gear height AGL
    x: 0, z: 1500, h: 0,
    v: 0,            // TAS m/s
    psi: 0,          // heading rad, 0 = down the runway (−z)
    gamma: 0,        // flight-path angle
    alpha: 0, phi: 0,
    theta: 0,
    throttle: 0,
    flap: 1,         // takeoff flap preselected
    gear: true,
    brakes: false,
    onGround: true,
    stalled: false, buffet: 0,
    crashed: false, landedHard: false, touchdownVs: null,
    apAlt: null, apOn: false,
    t: 0,
    fuelKg: ac ? ac.mass * 0.12 : 8000,
  }
}

/**
 * One integration step. controls: {pitch −1..1 (pull +), roll −1..1,
 * yaw −1..1, throttle 0..1, flap idx, gear bool, brakes bool}.
 * Returns derived readouts for the HUD.
 */
export function stepFlight(s, ac, controls, wx, dt) {
  dt = Math.min(dt, 0.05)
  s.t += dt
  const atm = isa(s.h, wx.isaDev)
  const wind = windAt(s.h, wx, s.t)

  // --- controls → attitude rates ---
  const turb = wx.turb * (Math.sin(s.t * 5.1) * 0.4 + Math.sin(s.t * 11.7 + 2) * 0.35 + Math.sin(s.t * 2.3 + 5) * 0.25)
  s.throttle = controls.throttle
  s.flap = controls.flap
  s.gear = controls.gear
  s.brakes = controls.brakes

  const flap = ac.flaps[s.flap]

  if (!s.onGround) {
    // bank: rate-command, max ~30°/s, capped at 67° (protections-ish)
    s.phi += controls.roll * 0.9 * dt + turb * 0.15 * dt
    s.phi = Math.max(-1.17, Math.min(1.17, s.phi))
    if (Math.abs(controls.roll) < 0.02) s.phi *= Math.pow(0.5, dt / 1.2) // spiral damping toward level
  } else {
    s.phi = 0
  }

  // AoA: pitch input commands alpha (FBW-flavoured), turbulence jitters it
  const alphaCmd = 0.06 + controls.pitch * (s.onGround ? 0.16 : 0.14)
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
  const cd = ac.cd0 + flap.dCd + (s.gear ? 0.02 : 0) + (cl * cl) / (Math.PI * ac.AR * ac.e)
  const L = q * ac.S * cl
  const D = q * ac.S * cd
  const T = s.throttle * ac.thrustMax * Math.pow(atm.sigma, 0.72)
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
    // rotation & liftoff
    if (L > W && s.v > ac.vr * 0.9 && s.alpha > 0.03) {
      s.onGround = false
      s.gamma = 0.03
    }
  } else {
    const vDot = (T * Math.cos(s.alpha) - D) / ac.mass - G * Math.sin(s.gamma)
    const gammaDot = (L * Math.cos(s.phi) + T * Math.sin(s.alpha) * Math.cos(s.phi)) / (ac.mass * Math.max(s.v, 30)) - (G * Math.cos(s.gamma)) / Math.max(s.v, 30)
    const psiDot = (L * Math.sin(s.phi)) / (ac.mass * Math.max(s.v, 30) * Math.cos(s.gamma || 0.001))
    s.v = Math.max(20, s.v + vDot * dt)
    s.gamma += gammaDot * dt + turb * 0.004
    s.gamma = Math.max(-0.5, Math.min(0.42, s.gamma))
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

  // --- readouts ---
  const tas = s.v
  const iasKt = (tas * Math.sqrt(atm.sigma)) / KT
  const mach = tas / atm.a
  return {
    atm, wind,
    iasKt,
    tasKt: tas / KT,
    mach,
    altFt: s.h / FT,
    vsFpm: (vy / FT) * 60,
    hdg: (((s.psi * 180) / Math.PI) % 360 + 360) % 360,
    n1: 20 + s.throttle * 78,
    L, D, T, W,
    overspeed: mach > ac.mmo || iasKt > 350,
    aoaDeg: (s.alpha * 180) / Math.PI,
  }
}
