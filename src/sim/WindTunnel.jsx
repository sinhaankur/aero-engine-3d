import { useState } from 'react'

function asset(path) {
  return import.meta.env.BASE_URL.replace(/\/$/, '') + '/' + path.replace(/^\//, '')
}

const VIEWS = [
  { id: 'hero', name: 'Chase view' },
  { id: 'side', name: 'Side view' },
  { id: 'top', name: 'Top view' },
]

// One precomputed run of cfd/run_a320.sh — see docs/cfd-pipeline.md.
// Forces are the run's settled averages (t = 15k–20k steps); indicative only.
const RUN = {
  aircraft: 'A320 (our parametric model)',
  speed: '77 m/s · 150 kn',
  aoa: '8° nose-up',
  grid: '315 × 630 × 158 (31.4M cells)',
  lift: '≈ 172 kN (CL ≈ 0.39)',
  drag: '≈ 170 kN (CD ≈ 0.38)',
  playback: '2.3 s of airflow, ~3× slow motion',
  solver: 'Lattice-Boltzmann (D3Q19) + LES',
}

export default function WindTunnel() {
  const [view, setView] = useState('hero')

  return (
    <div className="sim-cfd">
      <div className="sim-canvas-wrap">
        <video
          key={view}
          className="sim-cfd-video"
          src={asset(`media/cfd/a320-${view}.mp4`)}
          poster={view === 'hero' ? asset('media/cfd/a320-poster.jpg') : undefined}
          autoPlay
          loop
          muted
          playsInline
        />
        <div className="sim-readout">
          {Object.entries({
            Aircraft: RUN.aircraft,
            Condition: `${RUN.speed} · ${RUN.aoa}`,
            Grid: RUN.grid,
            Solver: RUN.solver,
            'Lift (measured)': RUN.lift,
            'Drag (measured)': RUN.drag,
            Playback: RUN.playback,
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
        parametric A320 model you can orbit on this site. The glowing filaments are{' '}
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
