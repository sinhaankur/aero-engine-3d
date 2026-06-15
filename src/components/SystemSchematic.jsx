/**
 * Interactive SVG schematic for an aircraft system. Draws each node (source /
 * bus / consumer / control / tank / pump) and the connections between them, with
 * flow labels. Dashed links are backup/standby paths. Hovering a node — or the
 * matching component in the parent list — highlights it and its connections, so
 * the diagram and the prose teach together.
 */

const KIND_COLOR = {
  source: '#f0a020', // generators, pumps-from-engine, tanks-of-energy
  bus: '#58a6ff',
  consumer: '#3fb950',
  control: '#a371f7',
  tank: '#39c5cf',
  pump: '#f78166',
}

export default function SystemSchematic({ schematic, activeId, onHover }) {
  const { nodes, links } = schematic
  const byId = Object.fromEntries(nodes.map((n) => [n.id, n]))

  const isActive = (id) => !activeId || activeId === id
  const linkActive = (l) => !activeId || l.from === activeId || l.to === activeId

  return (
    <svg
      viewBox="0 0 100 100"
      role="img"
      aria-label="System schematic"
      style={{ width: '100%', background: '#0d1117', borderRadius: 12, aspectRatio: '16 / 11' }}
    >
      <defs>
        <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="5" markerHeight="5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#6e7681" />
        </marker>
      </defs>

      {/* faint grid */}
      {Array.from({ length: 11 }).map((_, i) => (
        <line key={`g${i}`} x1={i * 10} y1="0" x2={i * 10} y2="100" stroke="#161d26" strokeWidth="0.2" />
      ))}
      {Array.from({ length: 11 }).map((_, i) => (
        <line key={`gh${i}`} x1="0" y1={i * 10} x2="100" y2={i * 10} stroke="#161d26" strokeWidth="0.2" />
      ))}

      {/* links */}
      {links.map((l, i) => {
        const a = byId[l.from]
        const b = byId[l.to]
        if (!a || !b) return null
        const on = linkActive(l)
        const mx = (a.x + b.x) / 2
        const my = (a.y + b.y) / 2
        return (
          <g key={`l${i}`} opacity={on ? 1 : 0.18}>
            <line
              x1={a.x}
              y1={a.y}
              x2={b.x}
              y2={b.y}
              stroke={l.backup ? '#6e7681' : '#3d6ea5'}
              strokeWidth={on ? 0.7 : 0.5}
              strokeDasharray={l.backup ? '1.6 1.2' : undefined}
              markerEnd="url(#arrow)"
            />
            {l.flow ? (
              <text x={mx} y={my - 0.8} fill="#8b98a6" fontSize="2.1" textAnchor="middle">
                {l.flow}
              </text>
            ) : null}
          </g>
        )
      })}

      {/* nodes */}
      {nodes.map((n) => {
        const color = KIND_COLOR[n.kind] || '#58a6ff'
        const on = isActive(n.id)
        const w = Math.max(13, n.label.length * 1.5)
        return (
          <g
            key={n.id}
            opacity={on ? 1 : 0.3}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => onHover?.(n.id)}
            onMouseLeave={() => onHover?.(null)}
          >
            <rect
              x={n.x - w / 2}
              y={n.y - 4}
              width={w}
              height={8}
              rx={2}
              fill="#0d1117"
              stroke={color}
              strokeWidth={activeId === n.id ? 1 : 0.5}
            />
            <text x={n.x} y={n.y + 1} fill={color} fontSize="2.5" textAnchor="middle" fontWeight="600">
              {n.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
