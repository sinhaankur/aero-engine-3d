import { a320Family, a320Aircraft } from './families/a320.js'
import { a220Family, a220Aircraft } from './families/a220.js'
import { a330Family, a330Aircraft } from './families/a330.js'
import { a350Family, a350Aircraft } from './families/a350.js'
import { a380Family, a380Aircraft } from './families/a380.js'
import { a300Family, a300Aircraft } from './families/a300.js'

/**
 * Central registry. Every Airbus family is fully built out with data + authored
 * 3D models. Families are listed newest-programme-relevant first; the A300/A310
 * (the original Airbus widebody) closes the list as the historical root.
 */

export const FAMILIES = [
  { ...a320Family, stub: false },
  { ...a220Family, stub: false },
  { ...a330Family, stub: false },
  { ...a350Family, stub: false },
  { ...a380Family, stub: false },
  { ...a300Family, stub: false },
]

export const AIRCRAFT_BY_FAMILY = {
  a320: a320Aircraft,
  a220: a220Aircraft,
  a330: a330Aircraft,
  a350: a350Aircraft,
  a380: a380Aircraft,
  a300: a300Aircraft,
}

export function getFamily(id) {
  return FAMILIES.find((f) => f.id === id) || null
}

export function getAircraftForFamily(id) {
  return AIRCRAFT_BY_FAMILY[id] || []
}

export function getAircraft(familyId, aircraftId) {
  return getAircraftForFamily(familyId).find((a) => a.id === aircraftId) || null
}
