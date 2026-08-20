/**
 * The site's own tech stack — a colophon. This project is itself an engineering
 * artefact, so we're transparent about how it's built, in the same spirit as the
 * /components database is transparent about how aircraft are built. Grouped by
 * layer; each entry links to the project it credits.
 *
 * Keep this in sync with package.json (runtime deps) and the pipeline scripts in
 * blender/ and cfd/ when the stack changes.
 */

export const TECH_STACK = [
  {
    group: 'Interface',
    items: [
      { name: 'React 18', role: 'UI + hash router', url: 'https://react.dev' },
      { name: 'Vite', role: 'build + dev server', url: 'https://vitejs.dev' },
      { name: 'React Router', role: 'client-side routing', url: 'https://reactrouter.com' },
    ],
  },
  {
    group: '3D & simulation',
    items: [
      { name: 'Three.js', role: 'WebGL renderer', url: 'https://threejs.org' },
      { name: 'React Three Fiber', role: 'declarative Three.js', url: 'https://docs.pmnd.rs/react-three-fiber' },
      { name: 'drei', role: 'R3F helpers (sky, globe)', url: 'https://github.com/pmndrs/drei' },
      { name: 'Draco', role: 'mesh compression', url: 'https://google.github.io/draco/' },
    ],
  },
  {
    group: 'Content pipeline',
    items: [
      { name: 'Blender', role: 'airframe + engine models', url: 'https://www.blender.org' },
      { name: 'FluidX3D', role: 'GPU CFD wind tunnel', url: 'https://github.com/ProjectPhysX/FluidX3D' },
      { name: 'glTF-Transform', role: 'GLB optimisation', url: 'https://gltf-transform.dev' },
    ],
  },
  {
    group: 'Live data & hosting',
    items: [
      { name: 'Cloudflare Workers', role: 'ADS-B + weather proxy', url: 'https://workers.cloudflare.com' },
      { name: 'airplanes.live', role: 'real-time traffic feed', url: 'https://airplanes.live' },
      { name: 'Open-Meteo', role: 'global cloud cover', url: 'https://open-meteo.com' },
      { name: 'NASA Blue Marble', role: 'Earth day/night maps', url: 'https://visibleearth.nasa.gov' },
      { name: 'GitHub Pages', role: 'static hosting + CI', url: 'https://pages.github.com' },
    ],
  },
]
