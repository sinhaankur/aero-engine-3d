import { useState } from 'react'

function asset(path) {
  return import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
}

const VIEWS = [
  { id: 'hero', name: 'Chase view' },
  { id: 'side', name: 'Side view' },
  { id: 'top', name: 'Top view' },
]

const short = (name) => name.replace(/^(Airbus|Boeing) /, '')

/**
 * Precomputed FluidX3D runs that ship with the site, keyed by variant id.
 * Every run is a real GPU lattice-Boltzmann simulation over that variant's own
 * parametric model — each takes a GPU roughly an hour offline, so runs are
 * baked ahead of time with `cfd/run_variant.sh <id> <length> <wing-area> [aoa]`
 * and committed as video. Forces are the run's settled averages; indicative
 * only (voxel walls, no boundary-layer model).
 */
const RUNS = {
  a320: {
    speed: '77 m/s · 150 kn',
    aoa: '8° nose-up',
    grid: '315 × 630 × 158 (31.4M cells)',
    lift: '≈ 172 kN (CL ≈ 0.39)',
    drag: '≈ 170 kN (CD ≈ 0.38)',
    playback: '2.3 s of airflow, ~3× slow motion',
    solver: 'Lattice-Boltzmann (D3Q19) + LES',
  },
  'b737-800': {
    speed: '77 m/s · 150 kn',
    aoa: '8° nose-up',
    grid: '315 × 630 × 158 (31.4M cells)',
    lift: '≈ 244 kN (CL ≈ 0.54)',
    drag: '≈ 321 kN (CD ≈ 0.71)',
    playback: '2.3 s of airflow, ~3× slow motion',
    solver: 'Lattice-Boltzmann (D3Q19) + LES',
  },
}

/**
 * Aerodynamically distinct representatives: within a family, variants share
 * the wing and general configuration, so at this voxel fidelity their flow
 * pictures are near-identical. Siblings show their representative's run,
 * clearly labelled, instead of shipping hundreds of MB of duplicate video.
 * (The A310 keeps its own slot — it genuinely has a different wing.)
 */
const REP_FOR = {
  a318: 'a320', a319: 'a320', a321: 'a320', a321xlr: 'a320',
  'b737-700': 'b737-800', 'b737-max8': 'b737-800',
  'a220-100': 'a220-300',
  'a330-200': 'a330-900', 'a330-300': 'a330-900', 'a330-800': 'a330-900',
  'a350-1000': 'a350-900',
  a300b4: 'a300-600',
  'a310-200': 'a310-300',
}

function PendingRun({ aircraft }) {
  const d = aircraft.dimensions
  return (
    <div className="sim-cfd-pending">
      <h3>{short(aircraft.name)} — run not baked yet</h3>
      <p>
        The wind tunnel is <b>real GPU CFD</b>, not an animation, so every
        aircraft's run is computed offline (roughly an hour of GPU time each)
        and shipped as video. This variant's case is fully wired — its exact
        length and wing area feed the solver — it just hasn't been baked yet:
      </p>
      <code>cfd/run_variant.sh {aircraft.id} {d.lengthM} {d.wingAreaM2} 8</code>
      <p>
        A note on <em>environments</em>: in a wind tunnel, changing air density
        or temperature scales the forces but barely changes the flow picture —
        what reshapes the vortices is the <b>angle of attack</b> (and Mach). So
        CFD runs are baked per aircraft and AoA, while the Aerodynamics tab
        models storms, icing, altitude and temperature live. Pick the A320 to
        see a finished run.
      </p>
    </div>
  )
}

export default function WindTunnel({ aircraft }) {
  const [view, setView] = useState('hero')
  const ownId = aircraft?.id ?? 'a320'
  const name = aircraft ? short(aircraft.name) : 'A320'
  // exact run if baked; otherwise the family representative's run
  const id = RUNS[ownId] ? ownId : REP_FOR[ownId] && RUNS[REP_FOR[ownId]] ? REP_FOR[ownId] : null
  const run = id && RUNS[id]

  if (!run) return <PendingRun aircraft={aircraft} />
  const isRep = id !== ownId

  return (
    <div className="sim-cfd">
      {isRep && (
        <p className="sim-blurb">
          Showing the <b>{id.toUpperCase().replace('B737', '737')}</b> case — within a family the wing and
          configuration are shared, so the flow picture is representative for the {name}.
        </p>
      )}
      <div className="sim-canvas-wrap">
        <video
          key={`${id}-${view}`}
          className="sim-cfd-video"
          src={asset(`media/cfd/${id}-${view}.mp4`)}
          poster={view === 'hero' ? asset(`media/cfd/${id}-poster.jpg`) : undefined}
          autoPlay
          loop
          muted
          playsInline
        />
        <div className="sim-readout">
          {Object.entries({
            Aircraft: `${id.toUpperCase().replace('B737', '737')} (our parametric model)`,
            Condition: `${run.speed} · ${run.aoa}`,
            Grid: run.grid,
            Solver: run.solver,
            'Lift (measured)': run.lift,
            'Drag (measured)': run.drag,
            Playback: run.playback,
          }).map(([k, v]) => (
            <div className="sim-lift" key={k}>
              <span className="k">{k}</span>
              <span className="v sim-cfd-v">{v}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="sim-controls">
        {VIEWS.map((v) => (
          <button
            key={v.id}
            className={`sim-cfd-view ${v.id === view ? 'on' : ''}`}
            onClick={() => setView(v.id)}
          >
            {v.name}
          </button>
        ))}
      </div>

      <p className="sim-note">
        This is not an animation — it is a <b>real CFD run</b> over the exact same
        parametric {name} model you can orbit on this site. The glowing filaments are{' '}
        <em>vortex cores</em> (Q-criterion isosurfaces, coloured by air speed): watch
        them roll up at the wingtips, peel off the wing at this high angle of attack,
        and tangle into the turbulent wake. Simulated with{' '}
        <a href="https://github.com/ProjectPhysX/FluidX3D" target="_blank" rel="noreferrer">
          FluidX3D
        </a>{' '}
        (GPU lattice-Boltzmann) on a single laptop GPU — the model, case setup and
        pipeline are in this repo under <b>cfd/</b>. One honest caveat: with 15 cm
        voxel walls and no boundary-layer model, the measured lift reads low and drag
        reads high versus the real aircraft — the numbers are indicative, not
        certified aerodynamics.
      </p>
    </div>
  )
}
