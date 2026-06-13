import { Link, Outlet } from 'react-router-dom'

export default function App() {
  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="brand">
          ✈ Aircraft Design Archive
        </Link>
        <span className="brand-sub">3D · blueprints · engines · timelines · safety</span>
      </header>
      <main className="content">
        <Outlet />
      </main>
      <footer className="footer">
        Data-driven archive. Specs are nominal public figures; safety figures are
        attributed per aircraft and sourced from public aviation-safety records.
      </footer>
    </div>
  )
}
