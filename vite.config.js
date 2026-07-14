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
  // Listen on all interfaces so other devices on the LAN (projector,
  // phone, tablet) can open the site via this machine's IP.
  server: {
    host: true,
  },
  preview: {
    host: true,
  },
  build: {
    rollupOptions: {
      output: {
        // Split the Three.js stack into its own long-lived chunk. It's large and
        // changes rarely, so isolating it lets the browser cache it across app
        // deploys and lets the lazy viewer routes share one copy.
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
        },
      },
    },
    // The isolated three chunk is ~1.1 MB — that's just how big Three.js is, and
    // it's lazy-loaded + cached separately, so keep the threshold above it to
    // stay quiet rather than chase an un-splittable dependency.
    chunkSizeWarningLimit: 1200,
  },
})
