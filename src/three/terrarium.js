/**
 * Terrarium DEM loader for three-tile.
 *
 * three-tile's built-in `terrain-rgb` loader decodes MAPBOX Terrain-RGB
 * (`-10000 + (R<<16|G<<8|B)*0.1`). Our free, keyless elevation source is the
 * AWS "elevation-tiles-prod/terrarium" bucket, which is TERRARIUM-encoded
 * (`(R*256 + G + B/256) - 32768`) — the only encoding that bucket serves.
 * Feeding Terrarium PNGs to the Mapbox decoder gives garbage heights, so we
 * register our own loader under a distinct dataType ("terrarium").
 *
 * It mirrors the built-in loader's shape (crop/resize the tile to a small DEM
 * grid, build a TileGeometry) but decodes on the MAIN THREAD — the grid is
 * downsampled to ≤64×64 per tile, so the per-tile cost is trivial and we avoid
 * shipping a second web-worker. Martini meshing still happens inside
 * TileGeometry.setData.
 */
import { ImageLoader, MathUtils } from 'three'
import { TileGeometryLoader, TileGeometry, getBoundsCoord, registerDEMLoader, LoaderFactory } from 'three-tile'

const DATA_TYPE = 'terrarium'

// crop the clip region out of the source tile and resize to targetSize (nearest,
// so we don't blur elevation steps), returning the raw RGBA pixels — same idea as
// three-tile's internal getSubImageData.
function subImageData(image, clipBounds, targetSize) {
  const rect = getBoundsCoord(clipBounds, image.width)
  const size = Math.min(targetSize, rect.sw)
  const canvas = new OffscreenCanvas(size, size)
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(image, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, size, size)
  return ctx.getImageData(0, 0, size, size)
}

// Terrarium RGB → metres. Transparent pixels (tile edges / no data) read as 0.
function decodeTerrarium(imgData) {
  const px = imgData.data
  const count = px.length >>> 2
  const dem = new Float32Array(count)
  for (let i = 0; i < count; i++) {
    const j = i * 4
    const a = px[j + 3]
    if (a === 0) { dem[i] = 0; continue }
    dem[i] = px[j] * 256 + px[j + 1] + px[j + 2] / 256 - 32768
  }
  return dem
}

class TerrariumLoader extends TileGeometryLoader {
  info = { version: '1.0', description: 'Terrarium (AWS) DEM loader' }
  dataType = DATA_TYPE
  #imageLoader = new ImageLoader(LoaderFactory.manager)

  // base TileGeometryLoader.load() resolves the tile URL + clipBounds and calls this
  async doLoad(url, params) {
    const img = await this.#imageLoader.loadAsync(url)
    const { clipBounds, z } = params
    // same pixel-budget curve the built-in loader uses: more detail at higher zoom
    const targetSize = MathUtils.clamp((z + 2) * 3, 2, 64)
    const imgData = subImageData(img, clipBounds, targetSize)
    const dem = decodeTerrarium(imgData)
    const geometry = new TileGeometry()
    geometry.setData(dem)
    return geometry
  }
}

let _registered = false
/** Register the Terrarium DEM loader once. Call before creating the TileMap. */
export function ensureTerrariumLoader() {
  if (_registered) return DATA_TYPE
  registerDEMLoader(new TerrariumLoader())
  _registered = true
  return DATA_TYPE
}

export const TERRARIUM_DATA_TYPE = DATA_TYPE
