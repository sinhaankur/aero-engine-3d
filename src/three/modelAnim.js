import * as THREE from 'three'

/**
 * Shared aircraft-model animation. The generated GLBs name their moving parts
 * (FanBlades / Spinner, Flap_L/R, Aileron_L/R) and carry landing gear as the
 * generic Cylinder / Torus nodes below the belly. This collects those nodes once
 * from a cloned scene and exposes an update() so every viewer — /fly, explore,
 * aircraft page, engine — animates the SAME way.
 *
 * Frame convention (raw GLB, per glb-axis-convention): x = length (chord aft is
 * +x), y = span, z = up (±, up is −z). So the fan spins about x, control
 * surfaces hinge about the spanwise y, and gear retracts along z.
 */
export function collectParts(root) {
  const fans = []
  const flaps = []
  const ailerons = []
  const gear = []
  const box = new THREE.Box3().setFromObject(root)
  const height = box.max.z - box.min.z
  const c = new THREE.Vector3()
  const gb = new THREE.Box3()      // reused per-gear bbox
  // track how far the LOWEST gear point sits below the fuselage belly, so we
  // retract just enough to tuck the wheels into the belly — never so far that a
  // wheel punches out the top of the hull (the old height*0.42 overshot badly,
  // leaving a wheel floating above/beside the fuselage).
  let gearLowZ = -Infinity        // largest z = lowest point (up is −z)
  root.traverse((o) => {
    if (!o.isMesh) return
    if (/FanBlades|Spinner/i.test(o.name)) {
      // The generator exports fan blades with their local origin at the model
      // origin (0,0,0) instead of the blade centre, so a naive rotation.x sweeps
      // the whole disc around the fuselage axis — the blades fly OUT of the
      // nacelle. Re-centre the geometry on the spin axis (the blade's own centre
      // in y/z) and shift the node back to compensate, so rotation.x now spins
      // the fan in place inside the cowling. Idempotent via a userData guard.
      if (!o.userData._fanCentred) {
        o.updateWorldMatrix(true, false)
        o.geometry.computeBoundingBox()
        const bb = o.geometry.boundingBox
        // spin axis is local x; recentre only the y/z the disc rotates in
        const cy = (bb.min.y + bb.max.y) / 2
        const cz = (bb.min.z + bb.max.z) / 2
        o.geometry.translate(0, -cy, -cz)
        o.position.y += cy
        o.position.z += cz
        o.userData._fanCentred = true
      }
      fans.push(o); return
    }
    if (/^Flap_/i.test(o.name)) { flaps.push({ o, side: /R$/i.test(o.name) ? 1 : -1, y0: o.rotation.y }); return }
    if (/^Aileron_/i.test(o.name)) { ailerons.push({ o, side: /R$/i.test(o.name) ? 1 : -1, y0: o.rotation.y }); return }
    if (/Cylinder|Torus/i.test(o.name)) {
      gb.setFromObject(o); gb.getCenter(c)
      if (c.z > box.max.z - height * 0.5) {
        gear.push({ o, z0: o.position.z })
        if (gb.max.z > gearLowZ) gearLowZ = gb.max.z
      }
    }
  })
  // Retract only far enough to tuck the wheels up INTO the belly. Aiming the
  // lowest gear point at ~belly-fairing depth keeps the wheels inside the hull;
  // the old height*0.42 drove them clean through the crown and out the top (the
  // "floating blob" beside the fuselage). 0.16·height lands a main wheel just
  // inside the belly on the whole fleet (regional jet → widebody).
  const bellyTuck = box.max.z - height * 0.16
  const travel = Math.max(0, gearLowZ - bellyTuck)
  const retractDist = isFinite(gearLowZ) ? travel : height * 0.16
  return { fans, flaps, ailerons, gear, retractDist }
}

/**
 * Drive the parts one frame.
 *   parts   : from collectParts
 *   dt      : seconds
 *   opts.n1        0..1 fan speed (default idle)
 *   opts.flap      0..1 flap fraction (0 up, 1 full)
 *   opts.gearDown  bool
 *   opts.roll      −1..1 aileron command
 *   opts.flapDeg   max flap deflection in degrees (default 40)
 */
export function updateParts(parts, dt, opts = {}) {
  const { n1 = 0.05, flap = 0, gearDown = true, roll = 0, flapDeg = 40, skipGear = false } = opts
  for (const f of parts.fans) f.rotation.x += Math.max(0.04, n1) * 42 * dt

  const flapTarget = (flap) * (flapDeg * Math.PI / 180)
  for (const fp of parts.flaps) {
    const t = fp.y0 + flapTarget * fp.side
    fp.o.rotation.y += (t - fp.o.rotation.y) * Math.min(1, dt * 2.2)
  }
  for (const al of parts.ailerons) {
    const t = al.y0 + roll * 0.4 * al.side
    al.o.rotation.y += (t - al.o.rotation.y) * Math.min(1, dt * 6)
  }
  if (!skipGear && parts.gear.length) {
    const target = gearDown ? 0 : -parts.retractDist
    for (const gm of parts.gear) {
      gm.o.position.z += ((gm.z0 + target) - gm.o.position.z) * Math.min(1, dt * 2)
    }
  }
}

// meshes touched by rotation-only animation (fans + control surfaces) — safe to
// animate alongside a position-based exploded view without conflict
export function rotationParts(parts) {
  return new Set([...parts.fans, ...parts.flaps.map((f) => f.o), ...parts.ailerons.map((a) => a.o)])
}

/**
 * A slow looping "demo" schedule for static showcase pages: the aircraft cycles
 * its gear and sweeps the flaps so you can see the parts work without controls.
 * Returns {n1, flap, gearDown, roll} for a given time t (seconds).
 */
export function demoSchedule(t) {
  const cycle = t % 16
  // 0-4 s clean, 4-8 flaps out + gear down, 8-12 gear up, 12-16 flaps in
  const flap = cycle < 4 ? 0 : cycle < 8 ? (cycle - 4) / 4 : cycle < 12 ? 1 : 1 - (cycle - 12) / 4
  const gearDown = cycle < 9
  const roll = Math.sin(t * 0.5) * 0.6
  return { n1: 0.45, flap: Math.max(0, Math.min(1, flap)), gearDown, roll }
}
