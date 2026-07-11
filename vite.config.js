import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// GitHub Pages serves static files only, so a hard refresh or a shared deep link
// like /family/a380 would 404. Emitting a 404.html that's a copy of index.html
// makes Pages fall back to the SPA, which then routes client-side.
function spaFallback() {
  let outDir = 'dist'
  return {
    name: 'spa-404-fallback',
    apply: 'build',
    configResolved(cfg) {
      outDir = cfg.build.outDir
    },
    closeBundle() {
      const index = path.resolve(outDir, 'index.html')
      const notFound = path.resolve(outDir, '404.html')
      if (fs.existsSync(index)) fs.copyFileSync(index, notFound)
    },
  }
}

// base is set to the repo name so assets resolve under
// https://sinhaankur.github.io/AirbusEngine3D/
export default defineConfig({
  plugins: [react(), spaFallback()],
  base: '/AirbusEngine3D/',
})
