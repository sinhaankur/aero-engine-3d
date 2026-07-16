/**
 * Data schema for the Aircraft Engine & Airframe Design Archive.
 *
 * Every aircraft variant is described by a single object conforming to the
 * `Aircraft` shape below. Families group variants and tell the "family journey"
 * story over time. Keeping this as plain JS (not a DB) means the whole archive
 * is diff-able in git and trivially renderable at build time.
 *
 * All numeric specs are SI-first (metres, kilograms, kN) with imperial derived
 * in the UI. Safety figures are sourced from public aviation-safety records and
 * are explicitly attributed — see `safety.sources`.
 *
 * @typedef {Object} Engine
 * @property {string} id              Stable slug, e.g. "cfm56-5b".
 * @property {string} name            Display name, e.g. "CFM56-5B".
 * @property {string} manufacturer    e.g. "CFM International".
 * @property {string} type            "turbofan" | "turboprop" | "turbojet".
 * @property {number} thrustKn        Max takeoff thrust per engine, in kN.
 * @property {number} bypassRatio     Bypass ratio (dimensionless).
 * @property {number} fanDiameterM    Fan diameter, metres.
 * @property {string} [model]         Optional path to engine glTF in /models.
 * @property {string} notes
 *
 * @typedef {Object} Dimensions
 * @property {number} lengthM
 * @property {number} wingspanM
 * @property {number} wingAreaM2       Reference wing area (nominal public figure).
 * @property {number} heightM
 * @property {number} fuselageDiaM
 * @property {number} mtowKg          Max takeoff weight.
 * @property {number} rangeKm
 * @property {number} cruiseMach
 * @property {number} ceilingM
 * @property {number} paxTypical      Typical 2-class seating.
 * @property {number} paxMax          Max certified seating.
 *
 * @typedef {Object} TimelineEvent
 * @property {string} date            ISO date or year string.
 * @property {string} label
 *
 * @typedef {Object} Safety
 * @property {number} [hullLossRate]  Hull losses per million departures.
 * @property {number} [fatalEvents]   Count of fatal accidents (lifetime).
 * @property {number} [totalLosses]   Count of hull-loss events (lifetime).
 * @property {string} risk            "low" | "moderate" | "elevated" — qualitative bucket.
 * @property {string[]} sources       Attribution for the figures above.
 * @property {string} notes
 *
 * @typedef {Object} Aircraft
 * @property {string} id
 * @property {string} name
 * @property {string} familyId
 * @property {string} status          "in-production" | "in-service" | "retired".
 * @property {number} firstFlightYear
 * @property {number} [eisYear]       Entry into service.
 * @property {number} [built]         Units delivered (approx, public figure).
 * @property {string} model           Path to airframe glTF in /models (or "" to use procedural).
 * @property {Engine[]} engines       Available engine options.
 * @property {Dimensions} dimensions
 * @property {TimelineEvent[]} timeline
 * @property {Safety} safety
 * @property {string} summary
 *
 * @typedef {Object} Family
 * @property {string} id
 * @property {string} manufacturer
 * @property {string} name
 * @property {string} tagline
 * @property {string} intro
 */

export const RISK_LEVELS = {
  low: { label: 'Low', color: '#3fb950' },
  moderate: { label: 'Moderate', color: '#d29922' },
  elevated: { label: 'Elevated', color: '#f85149' },
}
