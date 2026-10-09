/**
 * Rapier collision layer — real WASM physics for "did I hit something solid?"
 *
 * The flight MODEL stays analytical (true lift/drag/thrust — that's what makes
 * the handling good). Rapier does the one thing the analytical model can't: real
 * 3D collision against the world. We build static colliders for the buildings,
 * the control tower, and the terrain, then each frame cast the aircraft's hull
 * against them. A hit → a crash, with the impact point, so you can actually fly
 * INTO things instead of through them.
 *
 * Rapier is Rust compiled to WASM (@dimforge/rapier3d-compat) — genuine on-device
 * WASM physics. It's lazy-loaded (dynamic import) so its WASM never touches the
 * initial bundle; callers await init() once, then collision checks are sync+fast.
 */

let RAPIER = null
let world = null
let hull = null            // the moving collider that represents the aircraft
let ready = false
let initPromise = null

/** Load Rapier's WASM + build the collision world. Idempotent; call once. */
export function initCollision(obstacles = []) {
  if (initPromise) return initPromise
  initPromise = (async () => {
    try {
      RAPIER = await import('@dimforge/rapier3d-compat')
      await RAPIER.init()
      world = new RAPIER.World({ x: 0, y: 0, z: 0 }) // no gravity: the flight model owns motion
      buildStatics(obstacles)
      // the aircraft hull — a kinematic body we teleport to the flight model's
      // position each frame; a capsule roughly the size of a fuselage.
      const bodyDesc = RAPIER.RigidBodyDesc.kinematicPositionBased()
      const body = world.createRigidBody(bodyDesc)
      const colDesc = RAPIER.ColliderDesc.capsule(8, 4) // half-height 8m, radius 4m
      hull = world.createCollider(colDesc, body)
      ready = true
      return true
    } catch {
      ready = false
      return false
    }
  })()
  return initPromise
}

/** Build static colliders for the world's solid things. Each obstacle:
 *  { pos:[x,y,z], size:[w,h,d] } — matching the boxes the scene draws. */
function buildStatics(obstacles) {
  if (!world || !RAPIER) return
  // ground plane (large, thin box at y=0) so a wings-level belly scrape is caught
  const groundBody = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
  world.createCollider(RAPIER.ColliderDesc.cuboid(20000, 0.5, 20000).setTranslation(0, -0.5, 0), groundBody)
  for (const o of obstacles) {
    const [x, y, z] = o.pos
    const [w, h, d] = o.size
    const b = world.createRigidBody(RAPIER.RigidBodyDesc.fixed())
    world.createCollider(RAPIER.ColliderDesc.cuboid(w / 2, h / 2, d / 2).setTranslation(x, y, z), b)
  }
}

/** True once the WASM world is live. */
export function collisionReady() { return ready }

/**
 * Move the hull to the aircraft's world position and report whether it's now
 * intersecting a SOLID obstacle (not the ground — ground contact is the flight
 * model's job). Returns { hit:boolean, point:{x,y,z}|null }. Cheap, sync.
 */
export function checkCollision(x, y, z) {
  if (!ready || !hull || !world) return { hit: false, point: null }
  hull.setTranslation({ x, y, z }, true)
  world.step()
  let hit = false
  let point = null
  world.intersectionPairsWith(hull, (other) => {
    // ignore the ground collider (its half-height is 0.5 at y=-0.5); only count
    // real above-ground obstacles so normal landings aren't flagged as crashes.
    const t = other.translation()
    if (t.y > 1) { hit = true; point = { x, y, z } }
  })
  return { hit, point }
}

/** Tear down the world (on unmount / aircraft change). */
export function disposeCollision() {
  try { world?.free() } catch { /* already freed */ }
  world = null; hull = null; ready = false; initPromise = null
}
