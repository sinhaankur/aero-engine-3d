/**
 * Flight-sim CORE — the framework-agnostic engine.
 *
 * Everything re-exported here is pure JS: no React, no Three.js, no DOM (except
 * `audio.js`, which needs Web Audio — see the note below). This is the barrel a
 * host app imports to drive a flight: build an aircraft, create a state, step the
 * physics each frame, and read guidance. The AirbusEngine3D site consumes it
 * through its React/Three components; HELIONDRIFT (or any engine) can consume the
 * exact same core directly.
 *
 * Minimal driving loop:
 *
 *   import { deriveAircraft, createState, stepFlight, runwayFor } from './core.js'
 *   const ac = deriveAircraft(aircraftData)        // aircraftData: see model.js shape
 *   const rwy = runwayFor(3200)                    // runway from a real length
 *   const state = createState(ac, rwy)             // engines running, lined up
 *   const controls = { pitch:0, roll:0, yaw:0, throttle:1, flap:1, gear:true, brakes:false, speedbrake:0 }
 *   // each frame (dt seconds):
 *   const out = stepFlight(state, ac, controls, WEATHER.clear, dt, assist)
 *   // `out` carries the HUD readouts (ias/tas/mach/n1/forces…); `state` is mutated in place.
 *
 * Guidance / game layer (all optional, all pure):
 *   flightObjective(state, ac, leg, route, from, to) → the "what to do now" director
 *   updateAtc(...) / callsignFor(name)               → scripted tower radio
 *   checklistProgress(state)                          → cold-&-dark startup flow
 *   legProgress(from, to, flownNm, gsKt)              → route progress + ETA
 *
 * PORTABILITY NOTES (the seam):
 *   • model.js, objective.js, atc.js, procedures.js — pure, zero deps. Portable as-is.
 *   • airports.js — pure data + great-circle math. Portable; swap the AIRPORTS
 *     table for your world's fields.
 *   • collision.js — pure logic but dynamically imports @dimforge/rapier3d-compat
 *     (WASM). Portable if the host bundles Rapier; it's lazy so it costs nothing
 *     until initCollision() is called.
 *   • audio.js — pure of frameworks but uses the Web Audio API (browser only).
 *     Import it only in a browser host; skip it on a server/headless engine.
 *   • The data SHAPE a host must provide (dimensions, engines, flaps…) is
 *     documented at the top of model.js (deriveAircraft) — that's the contract.
 */

// --- physics + atmosphere + weather ---
export {
  isa, engineParams, deriveAircraft, createState, stepFlight, autoflight,
  runwayFor, RUNWAY, windAt, WEATHER,
  RHO0, KT, FT,
} from './model.js'

// --- guidance / game layer ---
export { flightObjective } from './objective.js'
export { updateAtc, callsignFor } from './atc.js'
export { checklistProgress } from './procedures.js'

// --- world collision (WASM; lazy) ---
export { initCollision, checkCollision, collisionReady, disposeCollision } from './collision.js'

// --- geo / route (pure data + great-circle math) ---
export {
  AIRPORTS, AIRPORT_BY_CODE, distanceNm, bearingDeg, etaHours, legProgress,
} from '../../data/airports.js'
