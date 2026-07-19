/**
 * Lightweight ATC controller for the /fly tower view.
 *
 * Watches the sim's flight phase + telemetry and emits radio-style clearances
 * the way a real tower would sequence a departure and arrival: taxi → line up →
 * cleared for takeoff → contact departure/climb → pattern → cleared to land.
 * It is intentionally scripted (not a real controller AI) but reacts to what
 * the aircraft is actually doing — altitude, speed, gear, phase transitions.
 */

const RWY = '27'
const ATIS = 'Information ALPHA'

// Build a fixed callsign from the aircraft name, airline-style.
export function callsignFor(name) {
  const tail = (name.replace(/[^A-Z0-9]/gi, '').slice(-3) || 'ABC').toUpperCase()
  return `AIRBUS ${tail}`
}

/**
 * Given the previous ATC memory and the current sim state, return
 * { log, memory } — log is the running list of {from, text} radio calls.
 * Only appends when the situation actually changes, so it reads like a real
 * frequency rather than spamming every frame.
 */
export function updateAtc(mem, s, out, csign, weather) {
  mem = mem || { phase: null, said: {}, log: [], altBand: null }
  const push = (from, text) => {
    mem.log = [...mem.log.slice(-7), { from, text, t: Date.now() }]
  }
  const once = (key, from, text) => { if (!mem.said[key]) { mem.said[key] = true; push(from, text) } }

  const altFt = out ? out.altFt : 0
  const iasKt = out ? out.iasKt : 0

  // initial handshake
  once('atis', 'PILOT', `Tower, ${csign}, holding short runway ${RWY}, ${ATIS}.`)
  once('wind', 'TOWER', `${csign}, ${RWY}, winds ${Math.round(weather?.windDir ?? 240)} at ${Math.round(weather?.windKt ?? 5)}, hold short.`)

  // phase machine
  if (s.phase !== mem.phase) {
    switch (s.phase) {
      case 'takeoff':
        once('clr-to', 'TOWER', `${csign}, runway ${RWY}, cleared for takeoff, winds ${Math.round(weather?.windDir ?? 240)} at ${Math.round(weather?.windKt ?? 5)}.`)
        once('rolling', 'PILOT', `Cleared for takeoff, ${RWY}, ${csign}.`)
        break
      case 'climb':
        once('airborne', 'TOWER', `${csign}, radar contact, climb and maintain flight level two-five-zero, contact departure.`)
        once('climb-ack', 'PILOT', `Climb two-five-zero, good day, ${csign}.`)
        break
      case 'cruise':
        once('level', 'DEPARTURE', `${csign}, maintain present level, cleared en-route.`)
        break
      case 'descent':
        once('descend', 'APPROACH', `${csign}, descend at pilot's discretion, expect vectors ILS runway ${RWY}.`)
        break
      case 'approach':
        once('appr', 'TOWER', `${csign}, runway ${RWY}, ${s.gear ? 'cleared to land' : 'gear appears up, check gear'}, winds ${Math.round(weather?.windDir ?? 240)} at ${Math.round(weather?.windKt ?? 5)}.`)
        break
      case 'landed':
        push('TOWER', `${csign}, ${s.landedHard ? 'firm one — ' : ''}nice landing, vacate at the next taxiway, contact ground.`)
        break
      default:
        break
    }
    mem.phase = s.phase
  }

  // altitude-band callouts while climbing
  const band = Math.floor(altFt / 5000)
  if (s.phase === 'climb' && band !== mem.altBand && band > 0) {
    mem.altBand = band
    if (band * 5000 >= s.fcuAlt - 500) push('PILOT', `${csign}, level ${Math.round(s.fcuAlt / 100)}.`)
  }

  // safety nudges
  if (out?.overspeed) once('spd', 'APPROACH', `${csign}, check speed.`)
  if (s.stalled) once('stall', 'TOWER', `${csign}, low energy, low energy!`)

  return mem
}
