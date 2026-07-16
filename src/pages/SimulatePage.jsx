import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FAMILIES, getAircraftForFamily } from '../data/index.js'
import AirfoilFlow, { WIND_CONDITIONS } from '../sim/AirfoilFlow.jsx'
import FuelSystem from '../sim/FuelSystem.jsx'
import WindTunnel from '../sim/WindTunnel.jsx'

const TABS = [
  { id: 'aero', name: 'Aerodynamics', icon: '🌬', blurb: 'Air flowing over the wing — lift, and how a stall happens. Pick any aircraft and a wind condition.' },
  { id: 'fuel', name: 'Fuel system', icon: '⛽', blurb: 'Live fuel flow from tanks through pumps to the engines.' },
  { id: 'cfd', name: 'Wind tunnel', icon: '🌀', blurb: 'A real GPU CFD run over our A320 model — vortices and all.' },
]

const shortName = (name) => name.replace(/^Airbus /, '')

/** Compact per-variant performance strip shown under the picker. */
function SpecStrip({ aircraft }) {
  const d = aircraft.dimensions
  const maxThrust = Math.max(...aircraft.engines.map((e) => e.thrustKn))
  const cells = [
    ['MTOW', `${(d.mtowKg / 1000).toFixed(1)} t`],
    ['Wing area', `${d.wingAreaM2} m²`],
    ['Wing loading', `${Math.round(d.mtowKg / d.wingAreaM2)} kg/m²`],
    ['Cruise', `M ${d.cruiseMach}`],
    ['Range', `${d.rangeKm.toLocaleString()} km`],
    ['Ceiling', `${d.ceilingM.toLocaleString()} m`],
    ['Engine thrust', `up to ${maxThrust} kN`],
  ]
  return (
    <div className="sim-specs">
      {cells.map(([k, v]) => (
        <div key={k} className="sim-spec">
          <span className="v">{v}</span>
          <span className="k">{k}</span>
        </div>
      ))}
    </div>
  )
}

export default function SimulatePage() {
  const [tab, setTab] = useState('aero')
  const [familyId, setFamilyId] = useState('a320')
  const [aircraftId, setAircraftId] = useState('a320')
  const [wind, setWind] = useState('calm')

  const variants = getAircraftForFamily(familyId)
  const aircraft = variants.find((a) => a.id === aircraftId) || variants[0]
  const windDef = WIND_CONDITIONS.find((w) => w.id === wind)

  const pickFamily = (id) => {
    setFamilyId(id)
    setAircraftId(getAircraftForFamily(id)[0]?.id)
  }

  return (
    <div>
      <Link to="/" className="back">← Home</Link>
      <div className="ac-head">
        <h1>Simulate</h1>
      </div>
      <p className="lede">
        Interactive, real-time models of how the aircraft actually behaves — not
        stock footage, but little physics toys you can drive. Change a control and
        watch the air, or the fuel, respond.
      </p>

      <div className="sys-tabs">
        {TABS.map((t) => (
          <button key={t.id} className={t.id === tab ? 'on' : ''} onClick={() => setTab(t.id)}>
            <span className="sys-icon" aria-hidden>{t.icon}</span>
            {t.name}
          </button>
        ))}
      </div>

      <p className="sim-blurb">{TABS.find((t) => t.id === tab)?.blurb}</p>

      {tab === 'aero' && (
        <>
          <div className="sim-picker">
            <div className="sim-picker-row">
              <span className="sim-picker-label">Aircraft</span>
              {FAMILIES.map((f) => (
                <button
                  key={f.id}
                  className={`sim-chip ${f.id === familyId ? 'on' : ''}`}
                  onClick={() => pickFamily(f.id)}
                >
                  {f.name.replace(' Family', '')}
                </button>
              ))}
            </div>
            <div className="sim-picker-row">
              <span className="sim-picker-label">Variant</span>
              {variants.map((a) => (
                <button
                  key={a.id}
                  className={`sim-chip ${a.id === aircraft.id ? 'on' : ''}`}
                  onClick={() => setAircraftId(a.id)}
                >
                  {shortName(a.name)}
                </button>
              ))}
            </div>
            <div className="sim-picker-row">
              <span className="sim-picker-label">Wind</span>
              {WIND_CONDITIONS.map((w) => (
                <button
                  key={w.id}
                  className={`sim-chip ${w.id === wind ? 'on' : ''}`}
                  onClick={() => setWind(w.id)}
                  title={w.blurb}
                >
                  {w.name}
                </button>
              ))}
            </div>
          </div>

          <SpecStrip aircraft={aircraft} />
          <p className="sim-blurb">{windDef?.blurb}</p>

          <AirfoilFlow aircraft={aircraft} wind={wind} />
        </>
      )}
      {tab === 'fuel' && <FuelSystem />}
      {tab === 'cfd' && <WindTunnel />}
    </div>
  )
}
