import { useEffect, useMemo, useRef, useState } from 'react'
import { distanceNm } from '../../data/airports.js'

/**
 * Departures board + departure-slot clearance for /fly.
 *
 * Shows the REAL aircraft on the ground at the selected departure field right
 * now (from the live ADS-B feed — anything onGround within a few nm of the field
 * centre), and runs a lightweight ATC slot: you request clearance, hold for a
 * slot sized by how busy the field is, then get cleared for takeoff. It's a
 * flavour layer over the sim — it never blocks the aircraft physically, it just
 * gates the "cleared" call and shows who's really parked around you.
 */

// ADS-B pseudo-types for ground stations / towers / obstacles — not aircraft
const GROUND_STATION = /^(TWR|GND|GID|SERVICE|VEHICLE)$/i

// real aircraft physically at this field: on the ground within ~8 nm of the
// centre, with an actual identity (skip ground stations, unnamed obstacles)
function planesAtField(flights, airport) {
  if (!airport || !flights) return []
  const here = { lat: airport.lat, lon: airport.lon }
  return flights
    .filter((f) =>
      f.onGround &&
      !GROUND_STATION.test(f.type) &&
      (f.callsign || f.reg) &&                 // must have a real identity
      distanceNm(here, { lat: f.lat, lon: f.lon }) <= 8,
    )
    .sort((a, b) => (a.callsign || a.reg || '').localeCompare(b.callsign || b.reg || ''))
}

// a plausible hold time (s): busier field → longer wait, with some jitter
function slotSeconds(trafficCount) {
  const base = 12 + Math.min(trafficCount, 20) * 4     // 12 s empty … ~90 s busy
  return Math.round(base + Math.random() * base * 0.4)
}

export default function AirportBoard({ airport, flights, status, myCallsign, onCleared, cleared }) {
  const [phase, setPhase] = useState('idle')   // idle | holding | cleared
  const [remain, setRemain] = useState(0)
  const [ahead, setAhead] = useState(0)
  const holdTotal = useRef(1)
  const timer = useRef(null)

  const traffic = useMemo(() => planesAtField(flights, airport), [flights, airport])

  // reset the clearance whenever the field changes
  useEffect(() => {
    setPhase('idle'); setRemain(0); clearInterval(timer.current)
  }, [airport?.code])

  // parent tells us it reset the sim (cleared=false) → drop back to idle
  useEffect(() => { if (!cleared && phase === 'cleared') setPhase('idle') }, [cleared, phase])

  const request = () => {
    if (phase !== 'idle') return
    const n = traffic.length
    let t = slotSeconds(n)
    holdTotal.current = t
    const startAhead = Math.min(n, 2 + Math.floor(Math.random() * 4))
    setAhead(startAhead)
    setRemain(t)
    setPhase('holding')
    clearInterval(timer.current)
    timer.current = setInterval(() => {
      t -= 1
      setRemain(t)
      // thin out the queue proportionally as the hold counts down
      setAhead(Math.round(startAhead * (t / holdTotal.current)))
      if (t <= 0) {
        clearInterval(timer.current)
        setPhase('cleared')
        onCleared?.()
      }
    }, 1000)
  }

  useEffect(() => () => clearInterval(timer.current), [])

  const live = status === 'live'

  return (
    <div className="apt-board">
      <div className="apt-head">
        <span className="apt-code">{airport?.code}</span>
        <span className="apt-city">{airport?.city}</span>
        <span className={`apt-live ${live ? 'on' : ''}`}>{live ? '● LIVE' : status === 'loading' ? 'linking…' : 'no feed'}</span>
      </div>

      <div className="apt-ground">
        <div className="apt-ground-h">ON THE GROUND NOW · {traffic.length}</div>
        {traffic.length === 0 && (
          <div className="apt-empty">{live ? 'No ADS-B traffic reporting on the field.' : 'Waiting for live traffic…'}</div>
        )}
        <ul className="apt-list">
          {traffic.slice(0, 8).map((f) => (
            <li key={f.id}>
              <b>{f.callsign || f.reg || f.id}</b>
              <span>{f.type || '—'}</span>
              <span className="apt-reg">{f.reg}</span>
            </li>
          ))}
        </ul>
        {traffic.length > 8 && <div className="apt-more">+{traffic.length - 8} more parked / taxiing</div>}
      </div>

      <div className="apt-slot">
        {phase === 'idle' && (
          <button className="apt-req" onClick={request} disabled={!airport}>Request departure slot</button>
        )}
        {phase === 'holding' && (
          <div className="apt-hold">
            <div className="apt-hold-top"><b>{myCallsign}</b> — hold for slot</div>
            <div className="apt-hold-num">{remain}s · {ahead > 0 ? `${ahead} ahead` : 'next for departure'}</div>
            <div className="apt-hold-bar"><span style={{ width: `${((holdTotal.current - remain) / holdTotal.current) * 100}%` }} /></div>
          </div>
        )}
        {phase === 'cleared' && (
          <div className="apt-clear">✔ <b>{myCallsign}</b> cleared for takeoff — {airport?.rwy?.id}</div>
        )}
      </div>
    </div>
  )
}
