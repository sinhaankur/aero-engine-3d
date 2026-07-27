import React from 'react'
import ReactDOM from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import { useGLTF } from '@react-three/drei'
import App from './App.jsx'
import Home from './pages/Home.jsx'
import FamilyPage from './pages/FamilyPage.jsx'
import AircraftPage from './pages/AircraftPage.jsx'
import EnginePage from './pages/EnginePage.jsx'
import SystemsPage from './pages/SystemsPage.jsx'
import LiveMapPage from './pages/LiveMapPage.jsx'
import SimulatePage from './pages/SimulatePage.jsx'
import ComparePage from './pages/ComparePage.jsx'
import ProjectorPage from './pages/ProjectorPage.jsx'
import FlyPage from './pages/FlyPage.jsx'
import RoutesPage from './pages/RoutesPage.jsx'
import ComponentsPage from './pages/ComponentsPage.jsx'
import './styles/global.css'

// All aircraft/engine GLBs are Draco-compressed geometry (~80% smaller). Point
// every useGLTF at the decoder we vendor in public/draco/ — self-hosted, not the
// gstatic CDN drei defaults to, so models decode offline (projector) and don't
// depend on a third party. Path respects the Vite base (/aero-engine-3d/).
useGLTF.setDecoderPath(`${import.meta.env.BASE_URL.replace(/\/$/, '')}/draco/`)

const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'live', element: <LiveMapPage /> },
      { path: 'simulate', element: <SimulatePage /> },
      { path: 'fly', element: <FlyPage /> },
      { path: 'routes', element: <RoutesPage /> },
      { path: 'components', element: <ComponentsPage /> },
      { path: 'compare', element: <ComparePage /> },
      { path: 'systems', element: <SystemsPage /> },
      { path: 'systems/:systemId', element: <SystemsPage /> },
      { path: 'projector', element: <ProjectorPage /> },
      { path: 'engine/:engineId', element: <EnginePage /> },
      { path: 'family/:familyId', element: <FamilyPage /> },
      { path: 'family/:familyId/:aircraftId', element: <AircraftPage /> },
    ],
  },
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
)
