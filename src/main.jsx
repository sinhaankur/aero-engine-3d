import React from 'react'
import ReactDOM from 'react-dom/client'
import { createHashRouter, RouterProvider } from 'react-router-dom'
import App from './App.jsx'
import Home from './pages/Home.jsx'
import FamilyPage from './pages/FamilyPage.jsx'
import AircraftPage from './pages/AircraftPage.jsx'
import SystemsPage from './pages/SystemsPage.jsx'
import './styles/global.css'

const router = createHashRouter([
  {
    path: '/',
    element: <App />,
    children: [
      { index: true, element: <Home /> },
      { path: 'systems', element: <SystemsPage /> },
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
