import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { AnimatePresence, m, useReducedMotion } from 'framer-motion'

/**
 * Two-level primary navigation. The top bar shows four L1 categories; opening
 * one reveals its L2 items in a dropdown. This replaced a flat 10-item bar —
 * the IA now groups every page by intent, which is both clearer and lets the
 * bar stay calm and premium.
 *
 * Interaction: hover opens on pointer devices; click/Enter/Space toggles (so it
 * works on touch and keyboard too). Escape closes; a click outside closes;
 * navigating closes. One menu open at a time. Motion is a short fade+glide on
 * the house ease, and collapses to a plain fade under reduced motion.
 */

// L1 → L2 map. `live` marks the interactive/real-time items so the bar can hint
// at them. Order is by how people reach for them.
export const NAV = [
  {
    id: 'explore', label: 'Explore',
    blurb: 'The fleet, up close',
    items: [
      { to: '/', label: 'All aircraft', desc: 'Every family and variant in 3D' },
      { to: '/family/a320', label: 'Families', desc: 'A320 · A350 · A380 and more' },
      { to: '/compare', label: 'Compare', desc: 'Overlay two variants at true scale' },
    ],
  },
  {
    id: 'experience', label: 'Experience',
    blurb: 'Fly it, watch it, test it',
    items: [
      { to: '/fly', label: 'Fly', desc: 'Cockpit-level flight, any variant', live: true },
      { to: '/live', label: 'Live traffic', desc: 'Every aircraft in the sky now', live: true },
      { to: '/simulate', label: 'Simulate', desc: 'Lift, stalls, wind, a CFD tunnel', live: true },
      { to: '/routes', label: 'Routes', desc: 'Can a variant fly this route?' },
    ],
  },
  {
    id: 'learn', label: 'Learn',
    blurb: 'How it all works',
    items: [
      { to: '/systems', label: 'Systems', desc: 'Electrics, hydraulics, fly-by-wire' },
      { to: '/components', label: 'Components', desc: 'How every part is built + costs' },
      { to: '/figures', label: 'Figures', desc: 'Interactive isometric explainers' },
    ],
  },
  {
    id: 'reference', label: 'Reference',
    blurb: 'Specs & tools',
    items: [
      { to: '/engine/leap-1a', label: 'Engines', desc: 'Exploded turbofans + the cycle' },
      { to: '/projector', label: 'Projector apps', desc: 'Kiosk APKs for an aviation wall' },
    ],
  },
]

// which L1 group owns the current path, so its label can show active
function activeGroup(pathname) {
  const seg = pathname.split('/').filter(Boolean)[0] || ''
  for (const g of NAV) {
    for (const it of g.items) {
      const itSeg = it.to.split('/').filter(Boolean)[0] || ''
      if (itSeg === seg) return g.id
    }
  }
  return null
}

export default function NavMenu() {
  const reduce = useReducedMotion()
  const { pathname } = useLocation()
  const [open, setOpen] = useState(null) // id of the open L1, or null
  const ref = useRef(null)
  const hoverTimer = useRef(0)
  const current = activeGroup(pathname)

  // close on route change
  useEffect(() => { setOpen(null) }, [pathname])

  // click-outside + Escape close
  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(null) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(null) }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('pointerdown', onDown); document.removeEventListener('keydown', onKey) }
  }, [open])

  const openNow = (id) => { clearTimeout(hoverTimer.current); setOpen(id) }
  const closeSoon = () => { hoverTimer.current = setTimeout(() => setOpen(null), 120) }

  const panel = reduce
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 } }
    : { initial: { opacity: 0, y: -6 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -6 } }

  return (
    <nav className="topnav2" ref={ref} aria-label="Primary">
      {NAV.map((g) => {
        const isOpen = open === g.id
        return (
          <div
            key={g.id}
            className={`nav2-group ${isOpen ? 'open' : ''} ${current === g.id ? 'current' : ''}`}
            onPointerEnter={() => openNow(g.id)}
            onPointerLeave={closeSoon}
          >
            <button
              type="button"
              className="nav2-trigger"
              aria-expanded={isOpen}
              aria-haspopup="true"
              onClick={() => setOpen(isOpen ? null : g.id)}
            >
              {g.label}
              <span className="nav2-caret" aria-hidden>▾</span>
            </button>
            <AnimatePresence>
              {isOpen && (
                <m.div
                  className="nav2-panel"
                  role="menu"
                  key="panel"
                  variants={panel}
                  initial="initial"
                  animate="animate"
                  exit="exit"
                  transition={{ duration: reduce ? 0.14 : 0.22, ease: [0.16, 1, 0.3, 1] }}
                  onPointerEnter={() => openNow(g.id)}
                  onPointerLeave={closeSoon}
                >
                  <div className="nav2-panel-head">{g.blurb}</div>
                  {g.items.map((it) => (
                    <Link key={it.to} to={it.to} role="menuitem" className="nav2-item">
                      <span className="nav2-item-label">
                        {it.label}
                        {it.live && <span className="nav2-live" aria-hidden>LIVE</span>}
                      </span>
                      <span className="nav2-item-desc">{it.desc}</span>
                    </Link>
                  ))}
                </m.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </nav>
  )
}
