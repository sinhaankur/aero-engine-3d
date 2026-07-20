/**
 * Real startup + before-takeoff procedure for /fly.
 *
 * An ordered checklist grouped by phase; each item has a `done(state)` predicate
 * evaluated live against the sim, so the panel can tick items off and point at
 * the next action as you flip the actual switches. Mirrors the real Airbus flow:
 * cold & dark → APU → engine start → before taxi → before takeoff.
 *
 * The list is only meaningful when you spawn "cold & dark"; when you spawn ready
 * everything is already satisfied and the panel collapses to "ready to roll".
 */

export const CHECKLIST = [
  {
    phase: 'POWER / APU',
    items: [
      { label: 'APU MASTER', hint: 'overhead → APU MASTER on', done: (s) => s.apuMaster },
      { label: 'APU START', hint: 'overhead → APU START (supplies bleed air)', done: (s) => s.apuRunning },
      { label: 'FUEL PUMPS', hint: 'overhead → both tank pumps on', done: (s) => s.fuelPump1 && s.fuelPump2 },
      { label: 'BEACON', hint: 'beacon on before engine start', done: (s) => s.beacon },
    ],
  },
  {
    phase: 'ENGINE START',
    items: [
      { label: 'ENG 2 MASTER', hint: 'start the right engine first', done: (s) => s.eng2Master },
      { label: 'ENG 2 RUNNING', hint: 'wait for N2 to stabilise at idle', done: (s) => s.eng2Started },
      { label: 'ENG 1 MASTER', hint: 'then the left engine (cross-bleed)', done: (s) => s.eng1Master },
      { label: 'ENG 1 RUNNING', hint: 'both engines at idle', done: (s) => s.eng1Started },
    ],
  },
  {
    phase: 'BEFORE TAKEOFF',
    items: [
      { label: 'FLAPS SET', hint: 'takeoff flap (1 or 2) selected', done: (s) => s.flap >= 1 && s.flap <= 2 },
      { label: 'NAV / STROBE LT', hint: 'exterior lights on for departure', done: (s) => s.navLights && s.strobe },
      { label: 'SPEEDBRAKE RET', hint: 'speedbrake lever fully retracted', done: (s) => s.speedbrake < 0.02 },
      { label: 'PARK BRAKE OFF', hint: 'release to roll', done: (s) => !s.brakes },
    ],
  },
]

/**
 * Progress through the checklist: returns { total, done, nextItem, nextPhase,
 * complete } for the panel. `nextItem` is the first unmet item (what to do now).
 */
export function checklistProgress(state) {
  let total = 0
  let done = 0
  let nextItem = null
  let nextPhase = null
  for (const grp of CHECKLIST) {
    for (const it of grp.items) {
      total += 1
      if (it.done(state)) done += 1
      else if (!nextItem) { nextItem = it; nextPhase = grp.phase }
    }
  }
  return { total, done, nextItem, nextPhase, complete: done === total }
}

/** Are both engines started and self-sustaining? (ready to taxi) */
export function enginesReady(state) {
  return state.eng1Started && state.eng2Started
}
