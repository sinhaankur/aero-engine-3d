import { useEffect, useRef, useState } from 'react'
import { isaAtmosphere } from './atmosphere.js'
import { VariablesLive, GoodVsBad } from './FlightFactors.jsx'

/**
 * A 2D airflow-over-wing visualization. This is an intuition-builder, not a CFD
 * solver: air "packets" stream past a NACA-shaped airfoil, deflect around it,
 * speed up over the low-pressure upper surface, and — past the critical angle of
 * attack — separate into a turbulent wake (stall). Lift rises with angle of
 * attack up to the stall, then collapses, which the lift gauge reflects.
 *
 * The gauge is per-aircraft AND per-atmosphere: from the selected variant's
 * real wing area and MTOW we compute actual lift ½·ρ·V²·S·Cₗ, with ρ from the
 * ISA model at the chosen altitude and day temperature. Wind conditions
 * perturb the free stream — gusts modulate airspeed, turbulence jitters the
 * effective angle of attack, wind shear models a microburst, a storm cell
 * combines violent gusts with rain and lightning, and icing degrades the wing
 * itself (earlier stall, less lift).
 *
 * Physics model (deliberately simple, tuned to read well):
 *  - the airfoil is a thin cambered body; we compute a signed distance-ish field
 *    and a deflection that pushes particles around it
 *  - upper-surface particles get a speed boost (Bernoulli intuition)
 *  - beyond the stall angle, upper flow downstream of the crest goes turbulent:
 *    particles get random walk + the boost fades (separation)
 */

const STALL_DEG = 15       // critical angle of attack, clean wing
const STALL_DEG_ICED = 11  // ice accretion trips the flow much earlier
const ICE_CL_PENALTY = 0.75 // iced wing keeps ~75% of its lift coefficient
const KT = 0.514444        // knots -> m/s
const G = 9.81

export const WIND_CONDITIONS = [
  { id: 'calm', name: 'Calm', blurb: 'Steady air — the baseline. Lift depends only on your speed, your angle of attack, and how thick the air is.' },
  { id: 'gusts', name: 'Gusty headwind', blurb: 'The headwind surges and fades, so airspeed — and lift — pulse with it. This is why gusty days mean bumpy approaches.' },
  { id: 'turb', name: 'Turbulence', blurb: 'Rough air keeps changing the direction the wind meets the wing, jittering the effective angle of attack and the lift with it.' },
  { id: 'shear', name: 'Wind shear', blurb: 'A microburst-style encounter: every few seconds the headwind collapses, airspeed drops ~40%, and lift falls with the square of it.' },
  { id: 'storm', name: 'Storm cell', blurb: 'Inside a thunderstorm: violent gust swings, updrafts and downdrafts, rain and lightning. Real crews avoid these cells by 20+ nautical miles — feel why.' },
  { id: 'icing', name: 'Icing', blurb: `Supercooled droplets freeze onto the leading edge. The distorted wing makes ~25% less lift and stalls at ${STALL_DEG_ICED}° instead of ${STALL_DEG}° — the reason wings carry anti-ice.` },
]

// free-stream perturbation for a wind condition at time t (seconds):
// vFac scales airspeed, dAoa shifts the effective angle of attack (deg),
// jitter drives ambient particle shake; storm/icing/shear flag their regimes.
function windEnv(wind, t) {
  switch (wind) {
    case 'gusts': {
      const gust = 0.14 * Math.sin(t * 1.1) + 0.06 * Math.sin(t * 3.7 + 1.3)
      return { vFac: 1 + gust, dAoa: 1.4 * Math.sin(t * 2.1), jitter: 0.18 }
    }
    case 'turb': {
      // layered sines read as random-ish but stay smooth and bounded
      const n = Math.sin(t * 1.7) * Math.sin(t * 2.9 + 1.7) + 0.5 * Math.sin(t * 5.3 + 0.4)
      return { vFac: 1 + 0.05 * Math.sin(t * 4.1), dAoa: 2.8 * n, jitter: 0.55 }
    }
    case 'shear': {
      const p = t % 10
      const dip = p > 2 && p < 5 ? Math.sin(((p - 2) / 3) * Math.PI) : 0
      return { vFac: 1 - 0.38 * dip, dAoa: 0, jitter: 0.15 * dip, shear: dip > 0.25 }
    }
    case 'storm': {
      // a broadband gust spectrum + updraft/downdraft cells swinging the AoA
      const gust = 0.2 * Math.sin(t * 0.9) + 0.12 * Math.sin(t * 2.7 + 1) + 0.07 * Math.sin(t * 5.1 + 2)
      const cell = Math.sin(t * 2.1) * Math.sin(t * 3.7 + 1.2) + 0.6 * Math.sin(t * 6.3)
      return { vFac: 1 + gust, dAoa: 4.5 * cell, jitter: 0.95, storm: true }
    }
    case 'icing':
      return { vFac: 1, dAoa: 0, jitter: 0.08, icing: true }
    default:
      return { vFac: 1, dAoa: 0, jitter: 0 }
  }
}

// simple lift coefficient curve: linear then drop past the (condition-
// dependent) stall angle; an iced wing also pays a flat lift penalty
function liftCoef(aoaDeg, stallDeg = STALL_DEG, iced = false) {
  const lin = 0.11 * aoaDeg + 0.2
  const cl = aoaDeg > stallDeg ? Math.max(0.35, lin - 0.16 * (aoaDeg - stallDeg) * 1.6) : lin
  return iced ? cl * ICE_CL_PENALTY : cl
}

// NACA-4 half-thickness (same family used for the 3D wings), 0..1 chord.
function thickness(xc, t = 0.14) {
  if (xc < 0 || xc > 1) return 0
  return (
    5 * t * (0.2969 * Math.sqrt(xc) - 0.1260 * xc - 0.3516 * xc * xc +
      0.2843 * xc ** 3 - 0.1015 * xc ** 4)
  )
}
function camber(xc, m = 0.02, p = 0.4) {
  if (xc < 0 || xc > 1) return 0
  return xc < p
    ? (m / (p * p)) * (2 * p * xc - xc * xc)
    : (m / ((1 - p) ** 2)) * (1 - 2 * p + 2 * p * xc - xc * xc)
}

const FALLBACK_DIMS = { mtowKg: 78000, wingAreaM2: 122.6 }

export default function AirfoilFlow({
  aircraft, wind = 'calm', height = 420, fill = false,
  // controls may be owned by the parent (SimulatePage shares them with the
  // flight-envelope chart); uncontrolled falls back to internal state
  aoa: aoaProp, onAoa, kt: ktProp, onKt, alt: altProp, onAlt, isaDev: isaDevProp, onIsaDev,
}) {
  const canvasRef = useRef(null)
  const [aoaI, setAoaI] = useState(6)        // angle of attack, degrees
  const [ktI, setKtI] = useState(250)        // airspeed, knots (TAS)
  const [altI, setAltI] = useState(0)        // pressure altitude, metres
  const [isaDevI, setIsaDevI] = useState(0)  // day temperature vs ISA, °C
  const [showPressure, setShowPressure] = useState(true)
  const aoa = aoaProp ?? aoaI
  const setAoa = onAoa ?? setAoaI
  const kt = ktProp ?? ktI
  const setKt = onKt ?? setKtI
  const alt = altProp ?? altI
  const setAlt = onAlt ?? setAltI
  const isaDev = isaDevProp ?? isaDevI
  const setIsaDev = onIsaDev ?? setIsaDevI

  const dims = aircraft?.dimensions || FALLBACK_DIMS
  const shortName = (aircraft?.name || 'Airbus A320').replace(/^(Airbus|Boeing) /, '')
  const stateRef = useRef({})
  stateRef.current = {
    aoa, kt, alt, isaDev, showPressure, wind,
    S: dims.wingAreaM2 || FALLBACK_DIMS.wingAreaM2,
    mtowKg: dims.mtowKg || FALLBACK_DIMS.mtowKg,
  }

  // live readout, pushed from the animation loop at ~8 Hz
  const [out, setOut] = useState({
    cl: liftCoef(6), aoaEff: 6, ktEff: 250, vMs: 250 * KT, qKpa: 0, tonnes: 0, pct: 0,
    rho: 1.225, tempC: 15, mach: 0, soundMs: 340,
    stalled: false, shear: false, buffet: false, iced: false, storm: false,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    const dpr = Math.min(2, window.devicePixelRatio || 1)
    const t0 = performance.now()
    let lastOut = -1

    function resize() {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      canvas.width = w * dpr
      canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    resize()
    window.addEventListener('resize', resize)

    // airfoil geometry in canvas space, computed each frame from layout
    function geom() {
      const w = canvas.clientWidth
      const h = canvas.clientHeight
      const chord = Math.min(w * 0.42, 360)
      const cx = w * 0.5
      const cy = h * 0.5
      return { w, h, chord, cx, cy }
    }

    // map a chord fraction + surface to a world point, given AoA rotation
    function surfacePoint(xc, upper, g, aoaRad) {
      const yt = thickness(xc)
      const yc = camber(xc)
      const yy = (yc + (upper ? yt : -yt))
      // local coords (chord along +x, origin at quarter-chord-ish LE)
      let lx = (xc - 0.25) * g.chord
      let ly = -yy * g.chord   // canvas y is down; lift is up
      // rotate by -aoa (nose up = leading edge rotates up)
      const ca = Math.cos(-aoaRad)
      const sa = Math.sin(-aoaRad)
      const rx = lx * ca - ly * sa
      const ry = lx * sa + ly * ca
      return [g.cx + rx, g.cy + ry]
    }

    // small arrow with a filled head, used for pressure and force vectors
    function arrow(x1, y1, x2, y2, color, w = 1.5) {
      const dx = x2 - x1, dy = y2 - y1
      const len = Math.hypot(dx, dy)
      if (len < 3) return
      const ux = dx / len, uy = dy / len
      ctx.strokeStyle = color
      ctx.fillStyle = color
      ctx.lineWidth = w
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke()
      const hs = Math.min(7, 3 + len * 0.08)
      ctx.beginPath()
      ctx.moveTo(x2, y2)
      ctx.lineTo(x2 - ux * hs - uy * hs * 0.55, y2 - uy * hs + ux * hs * 0.55)
      ctx.lineTo(x2 - ux * hs + uy * hs * 0.55, y2 - uy * hs - ux * hs * 0.55)
      ctx.closePath(); ctx.fill()
    }

    // the headline intuition: lift vs weight, drawn as vectors at the
    // quarter-chord. Weight is the fixed reference; lift grows/shrinks live.
    function drawForces(g, lw, stalled) {
      const ox = g.cx, oy = g.cy
      const wLen = 46
      ctx.font = '10px ui-monospace, Menlo, monospace'
      arrow(ox, oy, ox, oy + wLen, 'rgba(232,234,237,0.8)', 2)
      ctx.fillStyle = 'rgba(232,234,237,0.8)'
      ctx.fillText('W', ox + 7, oy + wLen + 2)
      const lLen = Math.max(6, Math.min(118, wLen * lw))
      const lCol = stalled ? '#ff9d4d' : lw >= 1 ? '#d8ff3e' : 'rgba(216,255,62,0.55)'
      arrow(ox, oy, ox, oy - lLen, lCol, 2.5)
      ctx.fillStyle = lCol
      ctx.fillText(`L ${Math.round(lw * 100)}%`, ox + 7, oy - lLen + 3)
    }

    function drawAirfoil(g, aoaRad, stalled, spdFrac, buffet, iced, suction) {
      ctx.save()
      // high-speed buffet: the airframe trembles as airspeed nears Vmo
      if (buffet > 0.01) {
        ctx.translate((Math.random() - 0.5) * 2.6 * buffet, (Math.random() - 0.5) * 2.6 * buffet)
      }
      ctx.beginPath()
      const N = 40
      for (let i = 0; i <= N; i++) {
        const xc = i / N
        const [px, py] = surfacePoint(xc, true, g, aoaRad)
        i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
      }
      for (let i = N; i >= 0; i--) {
        const xc = i / N
        const [px, py] = surfacePoint(xc, false, g, aoaRad)
        ctx.lineTo(px, py)
      }
      ctx.closePath()
      ctx.fillStyle = '#161b22'
      // an iced wing reads pale/frosted; a stalled one warns in orange
      ctx.strokeStyle = stalled ? '#ff9d4d' : iced ? '#cfeaf7' : '#d8ff3e'
      ctx.lineWidth = 2
      ctx.fill()
      ctx.stroke()

      // icing: a frost cap along the leading-edge upper surface
      if (iced) {
        ctx.beginPath()
        for (let i = 0; i <= 12; i++) {
          const xc = (i / 12) * 0.3
          const [px, py] = surfacePoint(xc, true, g, aoaRad)
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py)
        }
        ctx.strokeStyle = 'rgba(220,240,250,0.9)'
        ctx.lineWidth = 4
        ctx.stroke()
      }

      // pressure hint: low-pressure blue wash over the upper surface.
      // Its intensity and reach scale with dynamic pressure (∝ V²), so winding
      // the speed up makes the suction zone visibly bloom.
      if (stateRef.current.showPressure) {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        for (let i = 0; i < N; i++) {
          const xc = i / N
          const [px, py] = surfacePoint(xc, true, g, aoaRad)
          const boost = Math.max(0, 1 - Math.abs(xc - 0.25) * 1.6)
          ctx.beginPath()
          ctx.arc(px, py - 3, 10 + 7 * spdFrac, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(62,200,255,${(0.04 + 0.10 * spdFrac * spdFrac) * boost})`
          ctx.fill()
        }
        ctx.restore()

        // the "how it actually works" arrows: suction pulling the upper
        // surface up (long, cyan), higher pressure pushing on the lower
        // surface (short, pale). In a stall, the suction aft of the crest
        // collapses with the separated flow.
        const drawPressureArrows = (upper) => {
          for (let xc = 0.06; xc <= 0.9; xc += upper ? 0.07 : 0.14) {
            const [ax, ay] = surfacePoint(xc - 0.02, upper, g, aoaRad)
            const [bx, by] = surfacePoint(xc + 0.02, upper, g, aoaRad)
            let nx = -(by - ay), ny = bx - ax
            const nl = Math.hypot(nx, ny) || 1
            nx /= nl; ny /= nl
            if ((upper && ny > 0) || (!upper && ny < 0)) { nx = -nx; ny = -ny }
            const [px, py] = surfacePoint(xc, upper, g, aoaRad)
            const boost = Math.max(0.12, 1 - Math.abs(xc - 0.25) * 1.5)
            let mag = (upper ? 8 + 26 * suction : 4 + 9 * suction) * boost
            if (upper && stalled && xc > 0.45) mag *= 0.25 // separated: suction gone
            if (upper) {
              arrow(px, py, px + nx * mag, py + ny * mag, 'rgba(62,200,255,0.85)', 1.3)
            } else {
              // pressure pushes INTO the lower surface
              arrow(px + nx * mag, py + ny * mag, px, py, 'rgba(200,200,190,0.55)', 1.1)
            }
          }
        }
        drawPressureArrows(true)
        drawPressureArrows(false)
      }
      ctx.restore()
    }

    // particle field. Spread initial x across the whole width so the flow is
    // populated on frame one, and stagger reset x over a wide band so particles
    // trickle back in continuously instead of marching in as one wall.
    const particles = []
    function spawn(g) {
      return {
        x: Math.random() * g.w,          // seeded across the field
        y: Math.random() * g.h,
        turb: 0,
        life: 0,
      }
    }
    function reset(p, g) {
      p.x = -Math.random() * g.w * 0.5   // re-enter spread over the left half
      p.y = Math.random() * g.h
      p.turb = 0
      p.life = 0
    }

    // storm rain: fast diagonal streaks riding the wind
    const rain = []
    function stepRain(g, vx) {
      while (rain.length < 150) rain.push({ x: Math.random() * g.w, y: Math.random() * g.h })
      ctx.strokeStyle = 'rgba(150,190,230,0.34)'
      ctx.lineWidth = 1
      const rvx = vx * 1.2
      const rvy = 7.5
      for (const r of rain) {
        r.x += rvx
        r.y += rvy
        if (r.x > g.w + 10 || r.y > g.h + 10) {
          // re-enter along the top or the left, weighted by travel direction
          if (Math.random() < 0.6) { r.x = Math.random() * g.w; r.y = -10 }
          else { r.x = -10; r.y = Math.random() * g.h }
        }
        ctx.beginPath()
        ctx.moveTo(r.x, r.y)
        ctx.lineTo(r.x - rvx * 1.5, r.y - rvy * 1.5)
        ctx.stroke()
      }
    }

    function step() {
      const g = geom()
      const st = stateRef.current
      const t = (performance.now() - t0) / 1000
      const env = windEnv(st.wind, t)
      const atmo = isaAtmosphere(st.alt, st.isaDev)

      const ktEff = st.kt * env.vFac
      const aoaEff = st.aoa + env.dAoa       // what the air actually meets
      const aoaRad = (st.aoa * Math.PI) / 180 // the wing stays where you set it
      const flowRad = (aoaEff * Math.PI) / 180
      const stallDeg = env.icing ? STALL_DEG_ICED : STALL_DEG
      const stall = aoaEff > stallDeg
      const vx = 0.4 + ktEff / 70            // base horizontal speed, canvas units
      // 0 at 120 kt -> 1 at 350 kt: drives all the "energy" visuals below
      const spdFrac = Math.min(1, Math.max(0, (ktEff - 120) / 230))
      // approaching Vmo (~350 kt for these narrowbodies): overspeed buffet
      const buffet = Math.max(0, Math.min(1.2, (ktEff - 330) / 20))

      // trails: fade the canvas instead of clearing, for streak lines — fade
      // less at speed so the streaks linger and the whole field rushes
      ctx.fillStyle = `rgba(8,9,11,${0.30 - 0.14 * spdFrac})`
      ctx.fillRect(0, 0, g.w, g.h)

      // storm: lightning double-flash washing over the whole field
      if (env.storm) {
        const cyc = t % 7.4
        if (cyc < 0.07 || (cyc > 0.16 && cyc < 0.22)) {
          ctx.fillStyle = 'rgba(200,215,255,0.16)'
          ctx.fillRect(0, 0, g.w, g.h)
        }
      }

      // the pool densifies as the wind winds up
      const targetN = 520 + Math.round(460 * spdFrac)
      while (particles.length < targetN) particles.push(spawn(g))

      const leX = g.cx - 0.25 * g.chord * Math.cos(aoaRad)
      const crestX = g.cx                                  // ~mid chord
      const teX = g.cx + 0.75 * g.chord * Math.cos(aoaRad) // trailing edge x

      for (let pi = 0; pi < Math.min(particles.length, targetN); pi++) {
        const p = particles[pi]
        p.life += 1
        // vertical deflection: air near the airfoil band bends around it
        const nearBand = Math.abs(p.y - g.cy) < g.chord * 0.5 &&
          p.x > leX - 40 && p.x < teX + 120
        const upper = p.y < g.cy

        let dvx = vx
        let dvy = 0

        if (nearBand) {
          const throughFrac = (p.x - leX) / (teX - leX) // 0 at LE, 1 at TE
          // deflect around the body: push upper particles up, lower down, as they
          // approach; then follow the surface back down past the crest
          const prox = 1 - Math.min(1, Math.abs(p.y - g.cy) / (g.chord * 0.5))
          if (upper) {
            // camber + AoA turns the flow; speed up over the front upper surface
            dvy = -Math.sin(flowRad) * vx * 0.8 * prox
            if (throughFrac > 0 && throughFrac < 1) dvx *= 1 + 0.5 * prox * (1 - Math.abs(throughFrac - 0.3))
            // separation past the crest when stalled -> turbulence
            if (stall && p.x > crestX) {
              p.turb = Math.min(1, p.turb + 0.08)
            }
          } else {
            dvy = Math.sin(flowRad) * vx * 0.5 * prox
          }
          // downwash: everything leaves angled slightly down (reaction to lift)
          if (p.x > crestX) dvy += Math.sin(flowRad) * vx * 0.35 * prox
        }

        // ambient shake from the wind condition (gusts / rough air / storm)
        if (env.jitter > 0.02) {
          dvy += (Math.random() - 0.5) * 3.2 * env.jitter
          dvx += (Math.random() - 0.5) * 1.2 * env.jitter
        }

        // turbulence random-walk in the separated wake
        if (p.turb > 0.02) {
          dvy += (Math.random() - 0.5) * 4 * p.turb
          dvx += (Math.random() - 0.5) * 2 * p.turb
          p.turb *= 0.985
        }

        p.x += dvx
        p.y += dvy

        // draw as a streak: longer, brighter and hotter as speed rises —
        // the fastest air over the crest blooms from cyan toward white
        const sp = Math.min(1, (dvx - vx * 0.8) / (vx * 0.9))
        const stretch = 1.4 + 2.4 * spdFrac
        let col
        if (p.turb > 0.05) col = `rgba(255,157,77,${0.5 + p.turb * 0.4})`
        else if (sp > 0.15) {
          const hot = sp * spdFrac
          col = `rgba(${Math.round(62 + 170 * hot)},${Math.round(200 + 45 * hot)},255,${0.65 + 0.3 * spdFrac})`
        } else col = `rgba(150,168,190,${0.45 + 0.25 * spdFrac})`
        ctx.strokeStyle = col
        ctx.lineWidth = (p.turb > 0.05 ? 1.6 : 1) + 0.5 * spdFrac
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - dvx * stretch, p.y - dvy * stretch)
        ctx.stroke()

        if (p.x > g.w + 20 || p.y < -20 || p.y > g.h + 20) reset(p, g)
      }

      if (env.storm) stepRain(g, vx)

      // live physics for the on-canvas force + pressure arrows
      const cl = liftCoef(aoaEff, stallDeg, !!env.icing)
      const v = ktEff * KT
      const liftN = 0.5 * atmo.rho * v * v * st.S * cl
      const lw = liftN / (st.mtowKg * G)
      const suction = Math.min(1.2, Math.max(0.1, (cl / 1.85) * (0.4 + 0.8 * spdFrac)))

      drawAirfoil(g, aoaRad, stall, spdFrac, buffet, !!env.icing, suction)
      drawForces(g, lw, stall)

      // push the physics readout to React, throttled
      if (t - lastOut > 0.12) {
        lastOut = t
        setOut({
          cl,
          aoaEff,
          ktEff,
          vMs: v,
          qKpa: (0.5 * atmo.rho * v * v) / 1000,
          tonnes: liftN / G / 1000,
          pct: (liftN / (st.mtowKg * G)) * 100,
          rho: atmo.rho,
          tempC: atmo.tempC,
          mach: v / atmo.soundMs,
          soundMs: atmo.soundMs,
          stalled: stall,
          shear: !!env.shear,
          buffet: buffet > 0.05,
          iced: !!env.icing,
          storm: !!env.storm,
        })
      }

      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  const S = stateRef.current.S
  const mtowT = stateRef.current.mtowKg / 1000
  // the weight bar runs 0–300% of MTOW with a marker at the 100% line, so the
  // airspeed slider keeps visibly moving the bar across its whole range
  const BAR_MAX = 300
  const barPct = Math.min(100, (out.pct / BAR_MAX) * 100)

  const note = (
    <>
      Blue streaks are air moving <em>faster</em> (lower pressure) over the
      upper surface — that suction is most of the lift. Raise the angle of
      attack and lift grows… until the flow separates into an orange turbulent
      wake and lift collapses: a stall. The gauge is real physics for the{' '}
      <b>{shortName}</b>: ½·ρ·V²·S·Cₗ with its {S} m² wing, against the{' '}
      {mtowT.toFixed(0)} t it can weigh at takeoff. Now climb: the thinning
      air (watch ρ) quietly steals lift — the reason jets fly fast up high,
      and why hot, high runways demand more speed.
    </>
  )

  return (
    <div className={`sim-aero ${fill ? 'is-fill' : ''}`}>
      <div className="sim-canvas-wrap" style={fill ? undefined : { height }}>
        <canvas ref={canvasRef} className="sim-canvas" />
        <div className="sim-readout">
          <div className={`sim-lift ${out.stalled ? 'is-stall' : ''}`}>
            <span className="k">Lift</span>
            <span className="v">{out.tonnes.toFixed(0)} t</span>
            <span className="k2">Cₗ {out.cl.toFixed(2)} · {Math.round(out.ktEff)} kt eff · q {out.qKpa.toFixed(1)} kPa</span>
          </div>
          <div className="sim-liftbar">
            <div className="sim-liftbar-fill" style={{ width: `${barPct}%` }} />
            <div className="sim-liftbar-mark" style={{ left: `${(100 / BAR_MAX) * 100}%` }} />
          </div>
          <div className="sim-liftbar-cap">
            {out.pct.toFixed(0)}% of the {shortName}'s {mtowT.toFixed(0)} t MTOW
          </div>
          <div className="sim-liftbar-cap">
            ρ {out.rho.toFixed(3)} kg/m³ · {out.tempC.toFixed(0)}°C · M {out.mach.toFixed(2)}
          </div>
          {out.stalled && <div className="sim-stall-tag">STALL · FLOW SEPARATED{out.iced ? ' AT 11° — WING ICED' : ''}</div>}
          {out.shear && <div className="sim-stall-tag">WIND SHEAR · AIRSPEED LOST</div>}
          {out.storm && <div className="sim-stall-tag">SEVERE TURBULENCE · STORM CELL</div>}
          {out.iced && !out.stalled && <div className="sim-stall-tag">ICE ACCRETION · Cₗ −25% · STALLS AT {STALL_DEG_ICED}°</div>}
          {out.buffet && !out.stalled && <div className="sim-stall-tag">HIGH-SPEED BUFFET · NEAR Vmo</div>}
        </div>
        {fill && <p className="sim-note sim-note-hud">{note}</p>}
      </div>

      <div className="sim-controls">
        <label className="sim-ctrl">
          <span>Angle of attack <b>{aoa}°</b></span>
          <input type="range" min="-4" max="22" step="1" value={aoa}
            onChange={(e) => setAoa(+e.target.value)} />
        </label>
        <label className="sim-ctrl">
          <span>Airspeed <b>{kt} kt</b></span>
          <input type="range" min="120" max="350" step="5" value={kt}
            onChange={(e) => setKt(+e.target.value)} />
        </label>
        <label className="sim-ctrl">
          <span>Altitude <b>{(alt / 1000).toFixed(1)} km</b></span>
          <input type="range" min="0" max="12000" step="250" value={alt}
            onChange={(e) => setAlt(+e.target.value)} />
        </label>
        <label className="sim-ctrl">
          <span>Day temp <b>ISA {isaDev >= 0 ? '+' : ''}{isaDev}°C</b></span>
          <input type="range" min="-20" max="30" step="1" value={isaDev}
            onChange={(e) => setIsaDev(+e.target.value)} />
        </label>
        <label className="sim-toggle">
          <input type="checkbox" checked={showPressure}
            onChange={(e) => setShowPressure(e.target.checked)} />
          Show low-pressure zone
        </label>
      </div>

      {/* the actual equations, with the current numbers substituted live */}
      <details className="sim-math">
        <summary>The math, live — every number above, derived</summary>
        <div className="sim-math-rows">
          <div className="sim-math-row">
            <span className="f">T = 15 − 6.5·h + ΔISA</span>
            <span className="v">= 15 − 6.5·{(alt / 1000).toFixed(1)} {isaDev >= 0 ? '+' : '−'} {Math.abs(isaDev)} = <b>{out.tempC.toFixed(1)} °C</b> <span className="why">— ISA lapse rate: 6.5 °C colder per km</span></span>
          </div>
          <div className="sim-math-row">
            <span className="f">ρ = p / (R·T)</span>
            <span className="v">= <b>{out.rho.toFixed(3)} kg/m³</b> <span className="why">— air density; 1.225 at sea level, ~0.31 at 12 km. Hot day → thinner air</span></span>
          </div>
          <div className="sim-math-row">
            <span className="f">V = kt × 0.514</span>
            <span className="v">= {Math.round(out.ktEff)} × 0.514 = <b>{out.vMs.toFixed(0)} m/s</b>, M = V/a = {out.vMs.toFixed(0)}/{out.soundMs.toFixed(0)} = <b>{out.mach.toFixed(2)}</b> <span className="why">— a = √(γRT) falls as it gets colder</span></span>
          </div>
          <div className="sim-math-row">
            <span className="f">q = ½·ρ·V²</span>
            <span className="v">= ½ × {out.rho.toFixed(3)} × {out.vMs.toFixed(0)}² = <b>{out.qKpa.toFixed(1)} kPa</b> <span className="why">— dynamic pressure: the energy of the oncoming air</span></span>
          </div>
          <div className="sim-math-row">
            <span className="f">Cₗ(α) = 0.11·α + 0.20</span>
            <span className="v">= 0.11 × {out.aoaEff.toFixed(1)} + 0.20{out.iced ? ' × 0.75 (iced)' : ''} = <b>{out.cl.toFixed(2)}</b> <span className="why">— valid below the stall at {out.iced ? STALL_DEG_ICED : STALL_DEG}°; beyond it, Cₗ collapses</span></span>
          </div>
          <div className="sim-math-row">
            <span className="f">L = q·S·Cₗ</span>
            <span className="v">= {out.qKpa.toFixed(1)} × {S} × {out.cl.toFixed(2)} = <b>{(out.qKpa * S * out.cl).toFixed(0)} kN</b> = {out.tonnes.toFixed(1)} t <span className="why">— vs MTOW·g = {(mtowT * G).toFixed(0)} kN → L/W = {out.pct.toFixed(0)}%</span></span>
          </div>
        </div>
      </details>

      <VariablesLive out={out} S={S} mtowKg={stateRef.current.mtowKg} alt={alt} isaDev={isaDev} kt={kt} />
      <GoodVsBad aircraft={aircraft} />

      {!fill && <p className="sim-note">{note}</p>}
    </div>
  )
}
