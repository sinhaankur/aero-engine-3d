import { Link, Outlet } from 'react-router-dom'

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          <span className="brand-mark">✈</span> ADA / Aircraft Design Archive
        </Link>
        <nav className="topnav">
          <Link to="/">Index</Link>
          <Link to="/live">Live</Link>
          <Link to="/simulate">Simulate</Link>
          <Link to="/systems">Systems</Link>
        </nav>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">
        <div className="footer-cols">
          <div className="footer-brand">
            <span className="brand"><span className="brand-mark">✈</span> Aircraft Design Archive</span>
            <p>
              An interactive encyclopedia of aircraft families — 3D models,
              blueprints, engines, systems and attributed safety records.
            </p>
          </div>
          <div className="footer-col">
            <h4>Explore</h4>
            <Link to="/">Families</Link>
            <Link to="/">All aircraft</Link>
            <Link to="/systems">Systems</Link>
          </div>
          <div className="footer-col">
            <h4>Families</h4>
            <Link to="/family/a320">A320</Link>
            <Link to="/family/a350">A350</Link>
            <Link to="/family/a380">A380</Link>
          </div>
        </div>
        <div className="footer-fine">
          Specs are nominal public figures; safety figures are attributed per
          aircraft and sourced from public aviation-safety records. Not affiliated
          with Airbus.
        </div>
      </footer>
    </div>
  )
}
