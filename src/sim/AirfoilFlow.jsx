import { useEffect, useRef, useState } from 'react'

/**
 * A 2D airflow-over-wing visualization. This is an intuition-builder, not a CFD
 * solver: air "packets" stream past a NACA-shaped airfoil, deflect around it,
 * speed up over the low-pressure upper surface, and — past the critical angle of
 * attack — separate into a turbulent wake (stall). Lift rises with angle of
 * attack up to the stall, then collapses, which the lift gauge reflects.
 *
 * Physics model (deliberately simple, tuned to read well):
 *  - the airfoil is a thin cambered body; we compute a signed distance-ish field
 *    and a deflection that pushes particles around it
 *  - upper-surface particles get a speed boost (Bernoulli intuition)
 *  - beyond the stall angle, upper flow downstream of the crest goes turbulent:
 *    particles get random walk + the boost fades (separation)
 */

const STALL_DEG = 15 // critical angle of attack

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

export default function AirfoilFlow({ height = 420 }) {
  const canvasRef = useRef(null)
  const [aoa, setAoa] = useState(6)        // angle of attack, degrees
  const [speed, setSpeed] = useState(60)   // relative airspeed (arbitrary units)
  const [showPressure, setShowPressure] = useState(true)
  const stateRef = useRef({ aoa, speed, showPressure })
  stateRef.current = { aoa, speed, showPressure }

  const stalled = aoa > STALL_DEG
  // simple lift coefficient curve: linear then drop past stall
  const clLinear = 0.11 * aoa + 0.2
  const cl = stalled ? Math.max(0.35, clLinear - 0.16 * (aoa - STALL_DEG) * 1.6) : clLinear

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    let raf
    const dpr = Math.min(2, window.devicePixelRatio || 1)

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

    function drawAirfoil(g, aoaRad) {
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
      ctx.strokeStyle = stateRef.current.aoa > STALL_DEG ? '#ff9d4d' : '#d8ff3e'
      ctx.lineWidth = 2
      ctx.fill()
      ctx.stroke()

      // pressure hint: low-pressure blue wash over the upper surface
      if (stateRef.current.showPressure) {
        ctx.save()
        ctx.globalCompositeOperation = 'lighter'
        for (let i = 0; i < N; i++) {
          const xc = i / N
          const [px, py] = surfacePoint(xc, true, g, aoaRad)
          const boost = Math.max(0, 1 - Math.abs(xc - 0.25) * 1.6)
          ctx.beginPath()
          ctx.arc(px, py - 3, 10, 0, Math.PI * 2)
          ctx.fillStyle = `rgba(62,200,255,${0.05 * boost})`
          ctx.fill()
        }
        ctx.restore()
      }
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

    function step() {
      const g = geom()
      const { aoa: A, speed: S } = stateRef.current
      const aoaRad = (A * Math.PI) / 180
      const stall = A > STALL_DEG
      const vx = 0.6 + S / 40           // base horizontal speed

      // trails: fade the canvas instead of clearing, for streak lines
      ctx.fillStyle = 'rgba(8,9,11,0.28)'
      ctx.fillRect(0, 0, g.w, g.h)

      // keep the pool full
      while (particles.length < 520) particles.push(spawn(g))

      const leX = g.cx - 0.25 * g.chord * Math.cos(aoaRad)
      const crestX = g.cx                                  // ~mid chord
      const teX = g.cx + 0.75 * g.chord * Math.cos(aoaRad) // trailing edge x

      for (const p of particles) {
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
            dvy = -Math.sin(aoaRad) * vx * 0.8 * prox
            if (throughFrac > 0 && throughFrac < 1) dvx *= 1 + 0.5 * prox * (1 - Math.abs(throughFrac - 0.3))
            // separation past the crest when stalled -> turbulence
            if (stall && p.x > crestX) {
              p.turb = Math.min(1, p.turb + 0.08)
            }
          } else {
            dvy = Math.sin(aoaRad) * vx * 0.5 * prox
          }
          // downwash: everything leaves angled slightly down (reaction to lift)
          if (p.x > crestX) dvy += Math.sin(aoaRad) * vx * 0.35 * prox
        }

        // turbulence random-walk in the separated wake
        if (p.turb > 0.02) {
          dvy += (Math.random() - 0.5) * 4 * p.turb
          dvx += (Math.random() - 0.5) * 2 * p.turb
          p.turb *= 0.985
        }

        p.x += dvx
        p.y += dvy

        // draw as a short streak
        const sp = Math.min(1, (dvx - vx * 0.8) / (vx * 0.9))
        let col
        if (p.turb > 0.05) col = `rgba(255,157,77,${0.5 + p.turb * 0.4})`
        else if (sp > 0.15) col = 'rgba(62,200,255,0.75)'  // fast = low pressure
        else col = 'rgba(150,168,190,0.5)'
        ctx.strokeStyle = col
        ctx.lineWidth = p.turb > 0.05 ? 1.6 : 1
        ctx.beginPath()
        ctx.moveTo(p.x, p.y)
        ctx.lineTo(p.x - dvx * 1.4, p.y - dvy * 1.4)
        ctx.stroke()

        if (p.x > g.w + 20 || p.y < -20 || p.y > g.h + 20) reset(p, g)
      }

      drawAirfoil(g, aoaRad)
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('resize', resize)
    }
  }, [])

  return (
    <div className="sim-aero">
      <div className="sim-canvas-wrap" style={{ height }}>
        <canvas ref={canvasRef} className="sim-canvas" />
        <div className="sim-readout">
          <div className={`sim-lift ${stalled ? 'is-stall' : ''}`}>
            <span className="k">Lift Cₗ</span>
            <span className="v">{cl.toFixed(2)}</span>
          </div>
          <div className="sim-liftbar">
            <div className="sim-liftbar-fill" style={{ width: `${Math.min(100, (cl / 1.6) * 100)}%` }} />
          </div>
          {stalled && <div className="sim-stall-tag">STALL · FLOW SEPARATED</div>}
        </div>
      </div>

      <div className="sim-controls">
        <label className="sim-ctrl">
          <span>Angle of attack <b>{aoa}°</b></span>
          <input type="range" min="-4" max="22" step="1" value={aoa}
            onChange={(e) => setAoa(+e.target.value)} />
        </label>
        <label className="sim-ctrl">
          <span>Airspeed <b>{speed}</b></span>
          <input type="range" min="20" max="100" step="1" value={speed}
            onChange={(e) => setSpeed(+e.target.value)} />
        </label>
        <label className="sim-toggle">
          <input type="checkbox" checked={showPressure}
            onChange={(e) => setShowPressure(e.target.checked)} />
          Show low-pressure zone
        </label>
      </div>

      <p className="sim-note">
        Blue streaks are air moving <em>faster</em> (lower pressure) over the
        upper surface — that suction is most of the lift. Raise the angle of
        attack and lift grows… until about {STALL_DEG}°, where the flow can no
        longer follow the upper surface, separates into an orange turbulent wake,
        and lift collapses. That's a stall.
      </p>
    </div>
  )
}
