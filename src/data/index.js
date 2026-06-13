import { a320Family, a320Aircraft } from './families/a320.js'

/**
 * Central registry. Add new families here as they're built out. The A320 family
 * is fully populated; the others are declared as stubs so the family-journey
 * landing page can show the full Airbus roadmap with "coming soon" markers.
 */

const STUB_FAMILIES = [
  { id: 'a220', manufacturer: 'Airbus', name: 'A220 Family', tagline: 'The 100–150 seat clean-sheet narrowbody (ex-Bombardier CSeries).', intro: '', stub: true },
  { id: 'a330', manufacturer: 'Airbus', name: 'A330 Family', tagline: 'Twin-aisle medium/long-haul workhorse, including the A330neo.', intro: '', stub: true },
  { id: 'a350', manufacturer: 'Airbus', name: 'A350 Family', tagline: 'Carbon-fibre long-haul widebody (A350-900 / -1000).', intro: '', stub: true },
  { id: 'a380', manufacturer: 'Airbus', name: 'A380', tagline: "The world's largest passenger airliner — full-length double deck.", intro: '', stub: true },
  { id: 'a300', manufacturer: 'Airbus', name: 'A300 / A310', tagline: "Airbus's first aircraft — the original wide-body twinjet.", intro: '', stub: true },
]

export const FAMILIES = [
  { ...a320Family, stub: false },
  ...STUB_FAMILIES,
]

export const AIRCRAFT_BY_FAMILY = {
  a320: a320Aircraft,
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
