/**
 * Real-world airport + primary-runway database for the Earth Engine.
 *
 * A curated set of major hubs with the data the sim needs to place you on a
 * real runway: position (lat/lon), field elevation, and the primary runway's
 * identifier, true heading and length. Values are from public aeronautical
 * data (OurAirports / AIP), rounded to what the sim uses.
 *
 * `id` is the IATA code (what the UI shows). `rwy` describes one usable runway;
 * heading is TRUE degrees of the takeoff direction, length in metres, elev in
 * feet. The sim builds a runway of that length/heading at the field elevation.
 */

export const AIRPORTS = [
  // code, city,            lat,     lon,      elevFt, rwyId,  hdgTrue, lenM
  ['JFK', 'New York',        40.640, -73.779,   13, '04L',  31, 3682],
  ['LAX', 'Los Angeles',     33.942, -118.408, 125, '25R', 249, 3685],
  ['SFO', 'San Francisco',   37.619, -122.375,  13, '28R', 297, 3618],
  ['SEA', 'Seattle',         47.449, -122.309, 433, '16L', 180, 3627],
  ['ORD', 'Chicago',         41.978, -87.905,  672, '10L', 100, 3962],
  ['DFW', 'Dallas',          32.897, -97.038,  607, '17R', 176, 4085],
  ['ATL', 'Atlanta',         33.637, -84.428, 1026, '08L',  93, 3776],
  ['DEN', 'Denver',          39.862, -104.673,5434, '16R', 180, 3658],
  ['MIA', 'Miami',           25.793, -80.291,   8, '08R',  92, 3962],
  ['YYZ', 'Toronto',         43.677, -79.625, 569, '05',   58, 3389],
  ['MEX', 'Mexico City',     19.436, -99.072, 7316, '05R',  47, 3963],
  ['GRU', 'São Paulo',      -23.435, -46.473,2461, '10R', 100, 3700],
  ['EZE', 'Buenos Aires',   -34.822, -58.536,  67, '11',  106, 3300],
  ['LHR', 'London',          51.470, -0.454,   83, '27R', 270, 3902],
  ['CDG', 'Paris',           49.010, 2.548,    392,'26R', 266, 2700],
  ['FRA', 'Frankfurt',       50.033, 8.570,    364,'25C', 250, 4000],
  ['AMS', 'Amsterdam',       52.309, 4.764,    -11,'18R', 183, 3800],
  ['MAD', 'Madrid',          40.472, -3.561,  2001,'36L',   1, 4350],
  ['FCO', 'Rome',            41.800, 12.239,   13, '16R', 160, 3900],
  ['IST', 'Istanbul',        41.262, 28.742,  325, '17L', 180, 4100],
  ['DXB', 'Dubai',           25.253, 55.365,   62, '30R', 302, 4000],
  ['DOH', 'Doha',            25.273, 51.608,   13, '16R', 160, 4250],
  ['DEL', 'Delhi',           28.556, 77.100,  777, '29',  293, 4430],
  ['BOM', 'Mumbai',          19.089, 72.868,   39, '27',  270, 3660],
  ['SIN', 'Singapore',       1.359, 103.989,   22, '02L',  23, 4000],
  ['BKK', 'Bangkok',        13.690, 100.750,    5, '19R', 193, 3700],
  ['HKG', 'Hong Kong',      22.308, 113.918,   28, '07R',  75, 3800],
  ['PVG', 'Shanghai',       31.143, 121.805,   13, '16R', 165, 4000],
  ['PEK', 'Beijing',        40.079, 116.603,  116, '18R', 180, 3800],
  ['HND', 'Tokyo Haneda',   35.552, 139.780,   21, '34R', 337, 3000],
  ['NRT', 'Tokyo Narita',   35.765, 140.386,  135, '16R', 163, 4000],
  ['SYD', 'Sydney',        -33.946, 151.177,   21, '16R', 156, 3962],
  ['JNB', 'Johannesburg',  -26.139, 28.246,  5558, '03L',  33, 4421],
  ['CAI', 'Cairo',          30.122, 31.406,  382, '05C',  50, 4000],
  ['GIG', 'Rio de Janeiro',-22.809, -43.251,  28, '10',  105, 4000],
  ['KEF', 'Reykjavík',      63.985, -22.605, 171, '19',  190, 3065],
].map(([code, city, lat, lon, elevFt, rwyId, hdgTrue, lenM]) => ({
  code, city, lat, lon, elevFt, rwy: { id: rwyId, hdgTrue, lenM },
}))

export const AIRPORT_BY_CODE = Object.fromEntries(AIRPORTS.map((a) => [a.code, a]))

const R_EARTH_NM = 3440.065
const rad = (d) => (d * Math.PI) / 180
const deg = (r) => (r * 180) / Math.PI

/** Great-circle distance between two airports, in nautical miles. */
export function distanceNm(a, b) {
  const dphi = rad(b.lat - a.lat)
  const dlmb = rad(b.lon - a.lon)
  const s = Math.sin(dphi / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dlmb / 2) ** 2
  return 2 * R_EARTH_NM * Math.asin(Math.min(1, Math.sqrt(s)))
}

/** Initial great-circle bearing from a → b, true degrees. */
export function bearingDeg(a, b) {
  const phi1 = rad(a.lat), phi2 = rad(b.lat)
  const dl = rad(b.lon - a.lon)
  const y = Math.sin(dl) * Math.cos(phi2)
  const x = Math.cos(phi1) * Math.sin(phi2) - Math.sin(phi1) * Math.cos(phi2) * Math.cos(dl)
  return (deg(Math.atan2(y, x)) + 360) % 360
}

/** Rough great-circle ETA (hours) at a cruise groundspeed in knots. */
export function etaHours(a, b, gsKt = 470) {
  return distanceNm(a, b) / gsKt
}
