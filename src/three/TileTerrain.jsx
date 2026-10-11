/**
 * TileTerrain — real-world streamed terrain for /fly (phase 2 of docs/fly-terrain-plan.md).
 *
 * Streams a moving window of real ELEVATION (AWS Terrarium DEM) + imagery tiles
 * around the aircraft using `three-tile`, so you fly over the actual Earth near the
 * departure field. It is a NETWORK-GATED ENHANCEMENT: only mounted when online and
 * on a capable device tier; when it can't run, the caller keeps the existing
 * procedural ground, so the projector / offline never regress.
 *
 * Integration into our runway-relative frame:
 *   • three-tile places tiles in its own geographic world. We compute the field's
 *     position with `map.geo2world(lat,lon)` and OFFSET the whole map so the field
 *     sits at our scene origin (where the runway is).
 *   • We ROTATE the map group by the runway's true heading (headingOffset from #1)
 *     so real north lines up with our runway-along-−z convention.
 *   • `map.update(camera)` each frame drives the quadtree LOD / tile streaming.
 *
 * Tiles are routed through the Cloudflare Worker `/tile` proxy (edge-cached), which
 * keeps upstreams swappable and shields us from their rate limits.
 */
import { useEffect, useMemo, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { TileMap, TileSource } from 'three-tile'
import { ensureTerrariumLoader, TERRARIUM_DATA_TYPE } from './terrarium.js'

const WORKER = import.meta.env.VITE_FLIGHT_API || ''

// Build the tile source URLs through the worker proxy. The worker's /tile route
// maps a layer + z/x/y to the real upstream (DEM = AWS Terrarium, img = whatever
// open imagery we settle on) and edge-caches the result.
const demUrl = `${WORKER}/tile/dem/{z}/{x}/{y}.png`
const imgUrl = `${WORKER}/tile/img/{z}/{x}/{y}.png`

/**
 * @param simRef      the shared sim container (for the aircraft world position)
 * @param lat,lon     departure field geographic position
 * @param headingDeg  runway true heading (degrees) — aligns real north to our frame
 * @param onReady     optional callback once the map is built (e.g. to hide proc ground)
 */
export default function TileTerrain({ simRef, lat, lon, headingDeg = 0, onReady }) {
  const { camera, scene } = useThree()
  const groupRef = useRef()

  // Build the TileMap once. three-tile's TileMap IS a THREE.Object3D.
  const map = useMemo(() => {
    if (!WORKER) return null
    ensureTerrariumLoader()
    const demSource = new TileSource({
      dataType: TERRARIUM_DATA_TYPE,
      url: demUrl,
      maxLevel: 15,                 // AWS Terrarium tops out at z15
      attribution: 'AWS Terrain Tiles / Mapzen (Terrarium)',
    })
    const imgSource = new TileSource({
      dataType: 'image',
      url: imgUrl,
      maxLevel: 18,
      attribution: 'Imagery via ada-flight-proxy',
    })
    return TileMap.create({
      imgSource,
      demSource,
      minLevel: 7,
      lon0: 0,
    })
  }, [])

  // Place the map so the departure field sits at our scene origin, rotated so real
  // north matches our runway-relative frame. three-tile builds its world in metres
  // (Web Mercator), so geo2world gives the field's offset; we subtract it.
  useEffect(() => {
    if (!map || !groupRef.current) return
    const g = groupRef.current
    g.clear()
    g.add(map)
    // the field's position in the map's own world
    const fieldWorld = map.geo2world(new THREE.Vector3(lon, lat, 0))
    // our scene: x east, z south, y up. three-tile: x east, y up, -z... we align by
    // translating the map so the field lands at (0,0,0), then rotating about Y by the
    // runway heading so "down the runway" (−z) points along the real takeoff heading.
    map.position.set(-fieldWorld.x, -fieldWorld.y, -fieldWorld.z)
    g.rotation.y = -(headingDeg * Math.PI) / 180
    onReady?.()
    return () => { g.clear() }
  }, [map, lat, lon, headingDeg, onReady])

  // drive LOD / streaming each frame from our camera
  useFrame(() => {
    if (map) map.update(camera)
  })

  // dispose the map's GPU resources on unmount
  useEffect(() => () => {
    if (!map) return
    scene.remove(map)
    map.traverse((o) => {
      o.geometry?.dispose?.()
      const m = o.material
      if (Array.isArray(m)) m.forEach((x) => x?.dispose?.())
      else m?.dispose?.()
    })
  }, [map, scene])

  if (!map) return null
  return <group ref={groupRef} />
}
