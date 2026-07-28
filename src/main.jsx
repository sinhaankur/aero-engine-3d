import React, { Suspense, lazy } from 'react'
import ReactDOM from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import App from './App.jsx'
import Home from './pages/Home.jsx'   // landing page — eager for instant first paint
import './styles/global.css'

// Every other page is code-split so the initial load only pulls Home + shared
// chrome, not all 12 pages. Each becomes its own chunk fetched on navigation.
const FamilyPage = lazy(() => import('./pages/FamilyPage.jsx'))
const AircraftPage = lazy(() => import('./pages/AircraftPage.jsx'))
const EnginePage = lazy(() => import('./pages/EnginePage.jsx'))
const SystemsPage = lazy(() => import('./pages/SystemsPage.jsx'))
const LiveMapPage = lazy(() => import('./pages/LiveMapPage.jsx'))
const SimulatePage = lazy(() => import('./pages/SimulatePage.jsx'))
const ComparePage = lazy(() => import('./pages/ComparePage.jsx'))
const ProjectorPage = lazy(() => import('./pages/ProjectorPage.jsx'))
const FlyPage = lazy(() => import('./pages/FlyPage.jsx'))
const RoutesPage = lazy(() => import('./pages/RoutesPage.jsx'))
const ComponentsPage = lazy(() => import('./pages/ComponentsPage.jsx'))

// wrap a lazy page element in a Suspense boundary with a lightweight fallback
const L = (El) => (
  <Suspense fallback={<div className="viewport-loading" style={{ minHeight: '60vh' }}>Loading…</div>}>
    {El}
  </Suspense>
)

// The Draco decoder path (useGLTF.setDecoderPath) is configured lazily inside
// the 3D layer, NOT here — importing drei at the app entry would drag the whole
// ~1.2 MB three+drei bundle into the initial load for every visitor, even those
// who never open a 3D view.

const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'live', element: L(<LiveMapPage />) },
      { path: 'simulate', element: L(<SimulatePage />) },
      { path: 'fly', element: L(<FlyPage />) },
      { path: 'routes', element: L(<RoutesPage />) },
      { path: 'components', element: L(<ComponentsPage />) },
      { path: 'compare', element: L(<ComparePage />) },
      { path: 'systems', element: L(<SystemsPage />) },
      { path: 'systems/:systemId', element: L(<SystemsPage />) },
      { path: 'projector', element: L(<ProjectorPage />) },
      { path: 'engine/:engineId', element: L(<EnginePage />) },
      { path: 'family/:familyId', element: L(<FamilyPage />) },
      { path: 'family/:familyId/:aircraftId', element: L(<AircraftPage />) },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
