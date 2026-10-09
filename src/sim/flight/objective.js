/**
 * Flight objective / director for /fly.
 *
 * The sim is a sandbox; this gives it DIRECTION — a single, phase-aware "what to
 * do right now" directive plus the targets to fly, so a new player always knows
 * the goal: fly the selected leg (FROM → TO), climb to cruise, track the course,
 * then descend and grease the landing for a score.
 *
 * It reads only the live sim state + route (no new sim coupling), and returns a
 * compact object the UI renders as a flight-director banner. Deterministic and
 * cheap — safe to call every HUD tick.
 */

import { FT, KT, RHO0 } from './model.js'

const G = 9.80665
// Approach reference speed (m/s): 1.3 × stall at landing config. CLmax lands
// around 2.5 (clean 1.5 + full-flap lift increment), matching deriveAircraft.
function vrefOf(ac) {
  const vsLdg = Math.sqrt((2 * ac.mass * G) / (RHO0 * ac.S * 2.5))
  return 1.3 * vsLdg
}

// A sensible cruise altitude for the leg: short hops stay low, longer legs go
// higher, capped to a light-jet-friendly band so guidance is always reachable.
function cruiseAltFt(legNm) {
  if (legNm < 150) return 18000
  if (legNm < 400) return 28000
  return 35000
}

/**
 * @param s     live sim state (model.js)
 * @param ac    derived aircraft (v2/vref/etc. in m/s)
 * @param leg   legProgress(from,to,…) result
 * @param route { brg } great-circle bearing FROM→TO (deg)
 * @param from  departure airport
 * @param to    destination airport
 */
export function flightObjective(s, ac, leg, route, from, to) {
  const altFt = s.h / FT
  const crsAlt = cruiseAltFt(leg.total)
  const vref = vrefOf(ac)

  // course deviation: how far the current heading is off the great-circle course
  // to the destination (−180..180, + = need to turn right)
  const hdgDeg = ((s.psi * 180) / Math.PI + 360) % 360
  let crsErr = (route.brg - hdgDeg + 540) % 360 - 180

  // defaults
  let title = ''
  let detail = ''
  let target = null        // { label, value } the director bug flies toward
  let tone = 'go'          // go | warn | done

  if (s.crashed) {
    return { title: 'Crashed', detail: 'Reset and try the approach again.', target: null, tone: 'warn', crsErr, done: false }
  }

  // --- on the ground before the flight ---
  if (s.onGround && !s.airborneOnce) {
    if (!s.eng1Started || !s.eng2Started) {
      title = `Start engines — depart ${from.code}`
      detail = 'Both engines running before you can make takeoff thrust.'
      target = { label: 'TGT', value: 'ENG START' }
    } else if (s.brakes) {
      title = `Cleared for departure to ${to.code}`
      detail = `Release the park brake, then full thrust down runway ${from.rwy.id}.`
      target = { label: 'BRK', value: 'RELEASE' }
    } else {
      title = `Takeoff — ${from.code} → ${to.code}`
      detail = `Full thrust · rotate at Vᵣ ${Math.round(ac.vr / KT)} kt · climb V₂ ${Math.round(ac.v2 / KT)} kt.`
      target = { label: 'ROTATE', value: `${Math.round(ac.vr / KT)} kt` }
    }
    return { title, detail, target, tone, crsErr, done: false }
  }

  // --- arrived / landed ---
  if (s.onGround && s.airborneOnce) {
    if (leg.arrived || leg.toGo < 5) {
      title = `Arrived at ${to.code}`
      detail = s.landingScore ? `${s.landingScore.grade} landing — ${s.landingScore.score}/100.` : 'Welcome to your destination.'
      tone = 'done'
    } else {
      title = `Landed short of ${to.code}`
      detail = `Still ${Math.round(leg.toGo)} nm to go — reset to fly the full leg.`
      tone = 'warn'
    }
    return { title, detail, target: null, tone, crsErr, done: leg.arrived }
  }

  // --- airborne: climb → cruise/track → descend → approach ---
  const toGo = leg.toGo
  // rough top-of-descent: ~3 nm per 1000 ft below cruise + a 10 nm pad
  const tod = (crsAlt / 1000) * 3 + 10

  if (altFt < crsAlt - 1500 && toGo > tod) {
    title = `Climb to ${(crsAlt / 1000).toFixed(0)},000 ft`
    detail = `Hold the climb and turn onto course ${Math.round(route.brg)}° for ${to.code}.`
    target = { label: 'CLB', value: `FL${Math.round(crsAlt / 100)}` }
  } else if (toGo > tod) {
    title = `Cruise — track ${Math.round(route.brg)}° to ${to.code}`
    detail = Math.abs(crsErr) > 6
      ? `Off course — turn ${crsErr > 0 ? 'right' : 'left'} ${Math.abs(Math.round(crsErr))}° onto ${Math.round(route.brg)}°.`
      : `On course. ${Math.round(toGo)} nm to go.`
    target = { label: 'HDG', value: `${Math.round(route.brg)}°` }
    if (Math.abs(crsErr) > 12) tone = 'warn'
  } else if (altFt > from.elevFt + 4000) {
    title = `Descend for ${to.code}`
    detail = `Top of descent — bring it down toward the field. ${Math.round(toGo)} nm to run.`
    target = { label: 'DES', value: `${Math.round(toGo)} nm` }
  } else {
    title = `Approach ${to.code}`
    detail = `Gear down, flaps set, aim for Vᵣᵉᶠ ${Math.round(vref / KT)} kt. Grease it for the score.`
    target = { label: 'Vᵣᵉᶠ', value: `${Math.round(vref / KT)} kt` }
    if (!s.gear) { detail = 'GEAR UP on approach — select gear down (G).'; tone = 'warn' }
  }

  return { title, detail, target, tone, crsErr, done: false }
}
