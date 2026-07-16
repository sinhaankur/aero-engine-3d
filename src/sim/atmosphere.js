/**
 * ISA troposphere (valid to 11 km): temperature falls 6.5 °C/km, pressure
 * follows the barometric power law, and a hot or cold day (ISA deviation)
 * shifts density at the same pressure altitude — the "density altitude" story.
 * Shared by the airfoil sim, the flight envelope and the variables panel.
 */
export function isaAtmosphere(altM, isaDevC = 0) {
  const h = Math.min(altM, 11000)
  const Tisa = 288.15 - 0.0065 * h
  const p = 101325 * Math.pow(1 - (0.0065 * h) / 288.15, 5.2559)
  const T = Tisa + isaDevC
  return {
    rho: p / (287.05 * T),               // kg/m³
    pKpa: p / 1000,
    tempC: T - 273.15,
    soundMs: Math.sqrt(1.4 * 287.05 * T),
  }
}
