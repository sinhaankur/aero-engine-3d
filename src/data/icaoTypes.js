/**
 * ICAO type designators for every variant in the archive — the bridge between
 * the encyclopedia and the live ADS-B feed (flight rows carry the designator
 * at index 18 / `flight.type`).
 *
 * Notes: ceo/neo generations share a page here, so both codes map to one
 * variant (A320 + A20N → a320). The A321XLR transmits as A21N like any neo
 * A321, so it can't be told apart in the feed; reverse lookups resolve A21N
 * to the plain A321 page.
 */

// [familyId, aircraftId, [designators]]
const ENTRIES = [
  ['a320', 'a318', ['A318']],
  ['a320', 'a319', ['A319', 'A19N']],
  ['a320', 'a320', ['A320', 'A20N']],
  ['a320', 'a321', ['A321', 'A21N']],
  ['a320', 'a321xlr', ['A21N']],
  ['b737', 'b737-700', ['B737']],
  ['b737', 'b737-800', ['B738']],
  ['b737', 'b737-max8', ['B38M']],
  ['e2', 'e175-e2', ['E275']],
  ['e2', 'e190-e2', ['E290']],
  ['e2', 'e195-e2', ['E295']],
  ['a220', 'a220-100', ['BCS1']],
  ['a220', 'a220-300', ['BCS3']],
  ['a330', 'a330-200', ['A332']],
  ['a330', 'a330-300', ['A333']],
  ['a330', 'a330-800', ['A338']],
  ['a330', 'a330-900', ['A339']],
  ['a350', 'a350-900', ['A359']],
  ['a350', 'a350-1000', ['A35K']],
  ['a380', 'a380-800', ['A388']],
  ['a300', 'a300b4', ['A30B']],
  ['a300', 'a300-600', ['A306']],
  ['a300', 'a310-200', ['A310']],
  ['a300', 'a310-300', ['A310']],
]

/** aircraftId → [designators] */
export const TYPES_FOR_AIRCRAFT = Object.fromEntries(ENTRIES.map(([, id, codes]) => [id, codes]))

/** designator → { familyId, aircraftId } (first registration wins) */
export const AIRCRAFT_FOR_TYPE = {}
for (const [familyId, aircraftId, codes] of ENTRIES) {
  for (const c of codes) {
    if (!AIRCRAFT_FOR_TYPE[c]) AIRCRAFT_FOR_TYPE[c] = { familyId, aircraftId }
  }
}
