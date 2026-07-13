import { useState } from 'react'
import { Link } from 'react-router-dom'
import AirfoilFlow from '../sim/AirfoilFlow.jsx'
import FuelSystem from '../sim/FuelSystem.jsx'

const TABS = [
  { id: 'aero', name: 'Aerodynamics', icon: '🌬', blurb: 'Air flowing over the wing — lift, and how a stall happens.' },
  { id: 'fuel', name: 'Fuel system', icon: '⛽', blurb: 'Live fuel flow from tanks through pumps to the engines.' },
]

export default function SimulatePage() {
  const [tab, setTab] = useState('aero')

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

      {tab === 'aero' ? <AirfoilFlow /> : <FuelSystem />}
    </div>
  )
}
